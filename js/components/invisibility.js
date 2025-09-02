import { SelfieSegmentation } from '@mediapipe/selfie_segmentation'

export const invisibilityComponent = {
  schema: {
    enabled: { default: false },
    blur: { default: 24 },
    mirror: { default: true },
  },

  init() {
    // State
    this.video = null
    this.segmenter = null
    this.sending = false
    this.bgReady = false
    this.cloakEnabled = true
    this._frameId = null
    this._gotFirstResult = false
    this._paused = false
    this._alive = true

    // === Overlay canvas (DOM) ===
    this.outCanvas = document.createElement('canvas')
    this.outCanvas.id = 'invisibilityCanvas'
    Object.assign(this.outCanvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '0', // below your UI, above the AR GL canvas
      pointerEvents: 'none',
      display: 'none', // show after first result
      background: 'transparent', // no accidental white
    })
    document.body.appendChild(this.outCanvas)
    this.outCtx = this.outCanvas.getContext('2d')

    // Clean-plate background canvas (offscreen)
    this.bgCanvas = document.createElement('canvas')
    this.bgCtx = this.bgCanvas.getContext('2d')

    // Build MediaPipe
    this.segmenter = new SelfieSegmentation({
      locateFile: (f) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}`,
    })
    this.segmenter.setOptions({ modelSelection: 1 })
    this.segmenter.onResults((r) => this.onResults(r))

    // Start after scene ready
    if (this.el.sceneEl.hasLoaded) this._startWhenVideoReady()
    else
      this.el.sceneEl.addEventListener('loaded', () =>
        this._startWhenVideoReady()
      )

    // Keep overlay canvas sized to viewport
    const resize = () => this._fitOverlayToViewport()
    window.addEventListener('resize', resize)
    this._cleanupResize = () => window.removeEventListener('resize', resize)

    // Pause on background to save battery
    const vis = () => {
      this._paused = document.hidden
    }
    document.addEventListener('visibilitychange', vis)
    this._cleanupVis = () =>
      document.removeEventListener('visibilitychange', vis)
  },

  async _startWhenVideoReady() {
    // Poll for 8thWall's <video>
    let tries = 0
    while (!this.video && tries < 250) {
      // ~5s
      this.video = document.querySelector('video')
      if (this.video?.videoWidth) break
      await new Promise((r) => setTimeout(r, 20))
      tries++
    }
    if (!this.video) {
      console.warn('[invisibility] no <video> found')
      return
    }

    // Size internal canvases to the video’s native size
    this._resizeInternal(
      this.video.videoWidth || 640,
      this.video.videoHeight || 480
    )
    // Size overlay to viewport
    this._fitOverlayToViewport()

    // Use requestVideoFrameCallback for better frame sync
    const useRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype

    const scheduleNext = () => {
      if (!this._alive) return

      if (useRVFC) {
        this._frameId = this.video.requestVideoFrameCallback(async () => {
          if (!this._alive) return
          if (
            this.data.enabled &&
            !this._paused &&
            this.video?.readyState >= 2 &&
            !this.sending
          ) {
            this.sending = true
            try {
              await this.segmenter.send({ image: this.video })
            } catch (e) {
              console.warn('[invisibility] segmenter error', e)
            } finally {
              this.sending = false
            }
          }
          scheduleNext() // next video frame
        })
      } else {
        this._frameId = requestAnimationFrame(async () => {
          if (!this._alive) return
          if (
            this.data.enabled &&
            !this._paused &&
            this.video?.readyState >= 2 &&
            !this.sending
          ) {
            this.sending = true
            try {
              await this.segmenter.send({ image: this.video })
            } catch (e) {
              console.warn('[invisibility] segmenter error', e)
            } finally {
              this.sending = false
            }
          }
          scheduleNext()
        })
      }
    }

    // Start the frame processing
    scheduleNext()
  },

  /************ UI API ************/
  enable() {
    this.el.setAttribute('invisibility', 'enabled: true')
  },
  disable() {
    this.el.setAttribute('invisibility', 'enabled: false')
    this.outCanvas.style.display = 'none'
  },
  toggleCloak() {
    this.cloakEnabled = !this.cloakEnabled
  },
  setBlur(px) {
    this.data.blur = +px || 0
  },
  setMirror(on) {
    this.data.mirror = !!on
  },

  captureBackground() {
    if (!this.video) return
    this.bgCanvas.width = this.outCanvas.width
    this.bgCanvas.height = this.outCanvas.height
    this.bgCtx.save()
    // Don't mirror capture - mirror during playback to match live video
    this._drawVideoTo(this.bgCtx, this.bgCanvas.width, this.bgCanvas.height)
    this.bgCtx.restore()
    this.bgReady = true
  },

  /***************** Internals *****************/
  _fitOverlayToViewport() {
    // Match CSS size (what the user sees)
    const cssW = window.innerWidth
    const cssH = window.innerHeight
    this.outCanvas.style.width = cssW + 'px'
    this.outCanvas.style.height = cssH + 'px'

    // Store CSS dimensions for drawing calculations
    this._cssW = cssW
    this._cssH = cssH

    // Backing store at device pixels for sharp video & blur
    this._dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))
    const w = Math.floor(cssW * this._dpr)
    const h = Math.floor(cssH * this._dpr)

    if (this.outCanvas.width !== w || this.outCanvas.height !== h) {
      this.outCanvas.width = w
      this.outCanvas.height = h
    }

    // Reset transform - handle scaling manually in drawing
    this.outCtx.setTransform(1, 0, 0, 1, 0, 0)
  },

  _resizeInternal(w, h) {
    this._internalW = w
    this._internalH = h
    this.bgCanvas.width = w
    this.bgCanvas.height = h
  },

  _drawVideoTo(ctx, w, h) {
    // Use "cover" scaling like 8th Wall - fill entire viewport, crop if needed
    const vw = this.video.videoWidth || this._internalW
    const vh = this.video.videoHeight || this._internalH
    const s = Math.max(w / vw, h / vh) // Use max for cover behavior
    const dw = vw * s
    const dh = vh * s
    const dx = (w - dw) / 2
    const dy = (h - dh) / 2

    ctx.drawImage(this.video, 0, 0, vw, vh, dx, dy, dw, dh)
  },

  onResults(results) {
    // results.image has same aspect as input video -> render to full viewport canvas
    const ctx = this.outCtx
    const W = this.outCanvas.width // Device pixels
    const H = this.outCanvas.height // Device pixels
    ctx.save()
    ctx.clearRect(0, 0, W, H)

    // Draw live video first (mirrored if requested)
    if (this.data.mirror) {
      ctx.translate(W, 0)
      ctx.scale(-1, 1)
    }
    this._drawVideoTo(ctx, W, H)

    // Apply segmentation mask with same cover scaling as video
    const vw = results.image.width
    const vh = results.image.height
    const s = Math.max(W / vw, H / vh) // Use max for cover behavior
    const dw = vw * s
    const dh = vh * s
    const dx = (W - dw) / 2
    const dy = (H - dh) / 2

    if (this.data.enabled && this.cloakEnabled && this.bgReady) {
      // DPR-scaled blur for proper effect on high-DPI screens
      const blurBase = Math.max(0, this.data.blur | 0)
      const blurPx = blurBase * (this._dpr || 1)

      // Enhanced blur implementation for higher values
      if (blurPx > 0) {
        ctx.globalCompositeOperation = 'destination-out'

        // For high blur values (>12), use multiple passes for better effect
        if (blurBase > 12) {
          // Multi-pass blur for extreme softness
          const passes = Math.min(3, Math.floor(blurBase / 8))
          const passBlur = blurPx / passes

          for (let i = 0; i < passes; i++) {
            ctx.filter = `blur(${passBlur}px)`
            ctx.drawImage(
              results.segmentationMask,
              0,
              0,
              vw,
              vh,
              dx,
              dy,
              dw,
              dh
            )
          }
        } else {
          // Standard single-pass blur for normal values
          ctx.filter = `blur(${blurPx}px)`
          ctx.drawImage(results.segmentationMask, 0, 0, vw, vh, dx, dy, dw, dh)
        }
      } else {
        // No blur - sharp edges
        ctx.globalCompositeOperation = 'destination-out'
        ctx.drawImage(results.segmentationMask, 0, 0, vw, vh, dx, dy, dw, dh)
      }

      ctx.filter = 'none'
      ctx.globalCompositeOperation = 'destination-over'

      // Draw saved background (already mirrored if needed)
      ctx.drawImage(
        this.bgCanvas,
        0,
        0,
        this.bgCanvas.width,
        this.bgCanvas.height,
        0,
        0,
        W,
        H
      )
    }

    ctx.restore()

    if (!this._gotFirstResult) {
      this._gotFirstResult = true
      if (this.data.enabled) this.outCanvas.style.display = 'block'
    }
  },

  tick() {
    // If disabled, hide overlay
    if (!this.data.enabled && this.outCanvas.style.display !== 'none') {
      this.outCanvas.style.display = 'none'
    } else if (this.data.enabled && this._gotFirstResult) {
      this.outCanvas.style.display = 'block'
    }
  },

  remove() {
    this._alive = false
    if (this._frameId) {
      const useRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype
      if (useRVFC && this.video?.cancelVideoFrameCallback) {
        this.video.cancelVideoFrameCallback(this._frameId)
      } else {
        cancelAnimationFrame(this._frameId)
      }
      this._frameId = null
    }
    this.segmenter?.close?.()
    if (this._cleanupResize) this._cleanupResize()
    if (this._cleanupVis) this._cleanupVis()
    if (this.outCanvas?.parentNode)
      this.outCanvas.parentNode.removeChild(this.outCanvas)
  },
}

export const invisibilityCloakComponent = {
  schema: {
    enabled: { default: false },
    blur: { default: 6 },
    mirror: { default: true },
    whiteThreshold: { default: 200 },
    sensitivity: { default: 0.3 },
  },

  init() {
    // State
    this.video = null
    this.sending = false
    this.bgReady = false
    this.cloakEnabled = true
    this._frameId = null
    this._gotFirstResult = false
    this._paused = false
    this._alive = true

    // === Overlay canvas (DOM) ===
    this.outCanvas = document.createElement('canvas')
    this.outCanvas.id = 'invisibilityCloakCanvas'
    Object.assign(this.outCanvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '0', // below your UI, above the AR GL canvas
      pointerEvents: 'none',
      display: 'none', // show after first result
      background: 'transparent',
    })
    document.body.appendChild(this.outCanvas)
    this.outCtx = this.outCanvas.getContext('2d')

    // Clean-plate background canvas (offscreen)
    this.bgCanvas = document.createElement('canvas')
    this.bgCtx = this.bgCanvas.getContext('2d')

    // Working canvas for color detection
    this.workCanvas = document.createElement('canvas')
    this.workCtx = this.workCanvas.getContext('2d')

    // Precreate temporary canvases to avoid per-frame allocations
    this.tempCanvas = document.createElement('canvas')
    this.tempCtx = this.tempCanvas.getContext('2d')
    this.maskCanvas = document.createElement('canvas')
    this.maskCtx = this.maskCanvas.getContext('2d')

    // Start after scene ready
    if (this.el.sceneEl.hasLoaded) this._startWhenVideoReady()
    else
      this.el.sceneEl.addEventListener('loaded', () =>
        this._startWhenVideoReady()
      )

    // Keep overlay canvas sized to viewport
    const resize = () => this._fitOverlayToViewport()
    window.addEventListener('resize', resize)
    this._cleanupResize = () => window.removeEventListener('resize', resize)

    // Pause on background to save battery
    const vis = () => {
      this._paused = document.hidden
    }
    document.addEventListener('visibilitychange', vis)
    this._cleanupVis = () =>
      document.removeEventListener('visibilitychange', vis)
  },

  async _startWhenVideoReady() {
    // Poll for 8thWall's <video>
    let tries = 0
    while (!this.video && tries < 250) {
      this.video = document.querySelector('video')
      if (this.video?.videoWidth) break
      await new Promise((r) => setTimeout(r, 20))
      tries++
    }
    if (!this.video) {
      console.warn('[invisibility-cloak] no <video> found')
      return
    }

    // Size internal canvases to the video's native size
    this._resizeInternal(
      this.video.videoWidth || 640,
      this.video.videoHeight || 480
    )
    // Size overlay to viewport
    this._fitOverlayToViewport()

    // Use requestVideoFrameCallback for better frame sync
    const useRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype

    const scheduleNext = () => {
      if (!this._alive) return

      if (useRVFC) {
        this._frameId = this.video.requestVideoFrameCallback(() => {
          if (!this._alive) return
          if (
            this.data.enabled &&
            !this._paused &&
            this.video?.readyState >= 2 &&
            !this.sending
          ) {
            this.sending = true
            try {
              this._processFrame()
            } catch (e) {
              console.warn('[invisibility-cloak] processing error', e)
            } finally {
              this.sending = false
            }
          }
          scheduleNext() // next video frame
        })
      } else {
        this._frameId = requestAnimationFrame(() => {
          if (!this._alive) return
          if (
            this.data.enabled &&
            !this._paused &&
            this.video?.readyState >= 2 &&
            !this.sending
          ) {
            this.sending = true
            try {
              this._processFrame()
            } catch (e) {
              console.warn('[invisibility-cloak] processing error', e)
            } finally {
              this.sending = false
            }
          }
          scheduleNext()
        })
      }
    }

    // Start the frame processing
    scheduleNext()
  },

  /************ UI API ************/
  enable() {
    this.el.setAttribute('invisibility-cloak', 'enabled: true')
  },
  disable() {
    this.el.setAttribute('invisibility-cloak', 'enabled: false')
    this.outCanvas.style.display = 'none'
  },
  toggleCloak() {
    this.cloakEnabled = !this.cloakEnabled
  },
  setBlur(px) {
    this.data.blur = +px || 0
  },
  setMirror(on) {
    this.data.mirror = !!on
  },
  setWhiteThreshold(value) {
    this.data.whiteThreshold = Math.max(0, Math.min(255, +value || 180))
  },

  captureBackground() {
    if (!this.video) return
    this.bgCanvas.width = this.outCanvas.width
    this.bgCanvas.height = this.outCanvas.height
    this.bgCtx.save()
    this._drawVideoTo(this.bgCtx, this.bgCanvas.width, this.bgCanvas.height)
    this.bgCtx.restore()
    this.bgReady = true
  },

  /***************** Internals *****************/
  _fitOverlayToViewport() {
    // Match CSS size (what the user sees)
    const cssW = window.innerWidth
    const cssH = window.innerHeight
    this.outCanvas.style.width = cssW + 'px'
    this.outCanvas.style.height = cssH + 'px'

    // Store CSS dimensions for drawing calculations
    this._cssW = cssW
    this._cssH = cssH

    // Backing store at device pixels for sharp video & blur
    this._dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))
    const w = Math.floor(cssW * this._dpr)
    const h = Math.floor(cssH * this._dpr)

    if (this.outCanvas.width !== w || this.outCanvas.height !== h) {
      this.outCanvas.width = w
      this.outCanvas.height = h
    }

    // Reset transform - handle scaling manually in drawing
    this.outCtx.setTransform(1, 0, 0, 1, 0, 0)
  },

  _resizeInternal(w, h) {
    this._internalW = w
    this._internalH = h
    this.bgCanvas.width = w
    this.bgCanvas.height = h
    this.workCanvas.width = w
    this.workCanvas.height = h
    // temp/mask canvases are sized dynamically in _processFrame
  },

  _drawVideoTo(ctx, w, h) {
    // Use "cover" scaling like 8th Wall - fill entire viewport, crop if needed
    const vw = this.video.videoWidth || this._internalW
    const vh = this.video.videoHeight || this._internalH
    const s = Math.max(w / vw, h / vh) // Use max for cover behavior
    const dw = vw * s
    const dh = vh * s
    const dx = (w - dw) / 2
    const dy = (h - dh) / 2

    ctx.drawImage(this.video, 0, 0, vw, vh, dx, dy, dw, dh)
  },

  _detectWhiteCloth() {
    // Draw current video frame to work canvas for analysis
    this.workCtx.drawImage(
      this.video,
      0,
      0,
      this.workCanvas.width,
      this.workCanvas.height
    )

    // Get image data for color analysis
    const imageData = this.workCtx.getImageData(
      0,
      0,
      this.workCanvas.width,
      this.workCanvas.height
    )
    const data = imageData.data
    const width = this.workCanvas.width
    const height = this.workCanvas.height

    // Create initial mask with improved detection
    const maskData = new Uint8ClampedArray(data.length)
    const threshold = this.data.whiteThreshold

    // First pass: detect white/light colored areas with more lenient criteria
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      // Multiple detection methods for better coverage
      const brightness = (r + g + b) / 3
      const maxChannel = Math.max(r, g, b)
      const minChannel = Math.min(r, g, b)
      const saturation =
        maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0

      // More flexible white detection
      const isHighBrightness = brightness > threshold * 0.75 // Lower brightness threshold
      const isLowSaturation = saturation < 0.25 // Allow some color variation
      const isWhiteish =
        r > threshold * 0.7 && g > threshold * 0.7 && b > threshold * 0.7
      const hasWhiteBalance =
        Math.abs(r - g) < 40 && Math.abs(g - b) < 40 && Math.abs(b - r) < 40

      // Detect white cloth with multiple criteria
      if (
        (isHighBrightness && isLowSaturation) ||
        (isWhiteish && hasWhiteBalance) ||
        brightness > threshold + 30
      ) {
        maskData[i] = 255
        maskData[i + 1] = 255
        maskData[i + 2] = 255
        maskData[i + 3] = 255
      } else {
        maskData[i] = 0
        maskData[i + 1] = 0
        maskData[i + 2] = 0
        maskData[i + 3] = 0
      }
    }

    // Second pass: morphological operations to fill gaps and smooth edges
    const smoothedMask = new Uint8ClampedArray(data.length)
    const kernelSize = 3 // 3x3 kernel for dilation

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4

        // Check neighborhood for dilation (fill gaps)
        let whiteNeighbors = 0
        let totalNeighbors = 0

        for (let dy = -kernelSize; dy <= kernelSize; dy++) {
          for (let dx = -kernelSize; dx <= kernelSize; dx++) {
            const ny = y + dy
            const nx = x + dx

            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const nIdx = (ny * width + nx) * 4
              totalNeighbors++
              if (maskData[nIdx + 3] > 0) whiteNeighbors++
            }
          }
        }

        // Dilation: if enough neighbors are white, make this pixel white
        const whiteRatio = whiteNeighbors / totalNeighbors
        if (whiteRatio > 0.3 || maskData[idx + 3] > 0) {
          // Lower threshold for better coverage
          smoothedMask[idx] = 255
          smoothedMask[idx + 1] = 255
          smoothedMask[idx + 2] = 255
          smoothedMask[idx + 3] = 255
        } else {
          smoothedMask[idx] = 0
          smoothedMask[idx + 1] = 0
          smoothedMask[idx + 2] = 0
          smoothedMask[idx + 3] = 0
        }
      }
    }

    // Create ImageData object for the final mask
    const maskImageData = new ImageData(smoothedMask, width, height)
    return maskImageData
  },

  _processFrame() {
    if (!this._gotFirstResult) {
      this._gotFirstResult = true
      if (this.data.enabled) this.outCanvas.style.display = 'block'
    }

    const ctx = this.outCtx
    const W = this.outCanvas.width // Device pixels
    const H = this.outCanvas.height // Device pixels

    ctx.save()
    ctx.clearRect(0, 0, W, H)

    // Draw live video first (mirrored if requested)
    if (this.data.mirror) {
      ctx.translate(W, 0)
      ctx.scale(-1, 1)
    }
    this._drawVideoTo(ctx, W, H)

    if (this.data.enabled && this.cloakEnabled && this.bgReady) {
      // Detect white cloth areas
      const whiteMask = this._detectWhiteCloth()

      // Ensure temp canvas matches output size (reuse; no per-frame creates)
      if (this.tempCanvas.width !== W || this.tempCanvas.height !== H) {
        this.tempCanvas.width = W
        this.tempCanvas.height = H
      }
      const tempCtx = this.tempCtx

      // Scale mask to output resolution
      const vw = this.workCanvas.width
      const vh = this.workCanvas.height
      const s = Math.max(W / vw, H / vh)
      const dw = vw * s
      const dh = vh * s
      const dx = (W - dw) / 2
      const dy = (H - dh) / 2

      // Ensure mask canvas matches work resolution (reuse)
      if (this.maskCanvas.width !== vw || this.maskCanvas.height !== vh) {
        this.maskCanvas.width = vw
        this.maskCanvas.height = vh
      }
      this.maskCtx.putImageData(whiteMask, 0, 0)

      // Clear and scale mask to match video output
      tempCtx.clearRect(0, 0, W, H)
      tempCtx.drawImage(this.maskCanvas, 0, 0, vw, vh, dx, dy, dw, dh)

      // Apply blur to mask edges for smoother effect
      const blurBase = Math.max(0, this.data.blur | 0)
      const blurPx = blurBase * (this._dpr || 1)

      if (blurPx > 0) {
        tempCtx.filter = `blur(${blurPx}px)`
        tempCtx.drawImage(this.tempCanvas, 0, 0)
        tempCtx.filter = 'none'
      }

      // Use the mask to composite background over white areas
      ctx.globalCompositeOperation = 'destination-out'
      ctx.drawImage(this.tempCanvas, 0, 0)

      ctx.globalCompositeOperation = 'destination-over'

      // Draw saved background
      ctx.drawImage(
        this.bgCanvas,
        0,
        0,
        this.bgCanvas.width,
        this.bgCanvas.height,
        0,
        0,
        W,
        H
      )
    }

    ctx.restore()
  },

  tick() {
    // If disabled, hide overlay
    if (!this.data.enabled && this.outCanvas.style.display !== 'none') {
      this.outCanvas.style.display = 'none'
    } else if (this.data.enabled && this._gotFirstResult) {
      this.outCanvas.style.display = 'block'
    }
  },

  remove() {
    this._alive = false
    if (this._frameId) {
      const useRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype
      if (useRVFC && this.video?.cancelVideoFrameCallback) {
        this.video.cancelVideoFrameCallback(this._frameId)
      } else {
        cancelAnimationFrame(this._frameId)
      }
      this._frameId = null
    }
    if (this._cleanupResize) this._cleanupResize()
    if (this._cleanupVis) this._cleanupVis()
    if (this.outCanvas?.parentNode)
      this.outCanvas.parentNode.removeChild(this.outCanvas)
  },
}
