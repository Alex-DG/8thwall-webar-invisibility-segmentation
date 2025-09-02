export const uiManagerComponent = {
  init() {
    // State management
    this.currentMode = 'full' // 'full' or 'cloak'

    // Attach both components
    if (!this.el.components['invisibility']) {
      this.el.setAttribute('invisibility', '') // defaults
    }
    if (!this.el.components['invisibility-cloak']) {
      this.el.setAttribute('invisibility-cloak', '') // defaults
    }

    // Component getters
    const getActiveComponent = () => {
      return this.currentMode === 'full'
        ? this.el.components['invisibility']
        : this.el.components['invisibility-cloak']
    }

    const getInactiveComponent = () => {
      return this.currentMode === 'full'
        ? this.el.components['invisibility-cloak']
        : this.el.components['invisibility']
    }

    // HTML controls
    const startBtn = document.getElementById('startBtn')
    const bgBtn = document.getElementById('bgBtn')
    const toggleBtn = document.getElementById('toggleBtn')
    const blur = document.getElementById('blur')
    const mirror = document.getElementById('mirror')
    const modeBtn = document.getElementById('modeBtn')
    const slideToggleBtn = document.getElementById('slideToggleBtn')
    const controlsContent = document.querySelector('.controls-content')

    // Mode switching functionality
    modeBtn?.addEventListener('click', () => {
      // Disable current component
      getActiveComponent()?.disable()

      // Switch mode
      this.currentMode = this.currentMode === 'full' ? 'cloak' : 'full'
      modeBtn.textContent = this.currentMode === 'full' ? 'Full' : 'Cloak'

      // Reset UI state when switching modes
      startBtn.disabled = false
      bgBtn.disabled = true
      toggleBtn.disabled = true
      bgBtn.textContent = 'Capture'

      console.log(`Switched to ${this.currentMode} mode`)
    })

    startBtn?.addEventListener('click', () => {
      getActiveComponent()?.enable()
      startBtn.disabled = true
      bgBtn.disabled = false
      toggleBtn.disabled = false
    })

    bgBtn?.addEventListener('click', () => {
      bgBtn.disabled = true
      bgBtn.textContent = 'Capturing…'
      setTimeout(() => {
        getActiveComponent()?.captureBackground()
        bgBtn.textContent = 'Re-capture'
        bgBtn.disabled = false
      }, 900)
    })

    toggleBtn?.addEventListener('click', () => {
      getActiveComponent()?.toggleCloak()
      toggleBtn.textContent = getActiveComponent()?.cloakEnabled
        ? 'Disable'
        : 'Enable'
    })

    blur?.addEventListener('input', (e) =>
      getActiveComponent()?.setBlur(e.target.value)
    )
    mirror?.addEventListener('change', (e) =>
      getActiveComponent()?.setMirror(e.target.checked)
    )

    // Slide toggle functionality
    slideToggleBtn?.addEventListener('click', () => {
      const isHidden = controlsContent.classList.contains('hidden')
      const contentElement = controlsContent.querySelector('.controls-content')
      const expandIcon = slideToggleBtn.querySelector('.toggle-icon-expand')
      const collapseIcon = slideToggleBtn.querySelector('.toggle-icon-collapse')

      console.log('Toggle clicked, currently hidden:', isHidden)

      if (isHidden) {
        // Show controls
        controlsContent.classList.remove('hidden')

        // Toggle icons: show collapse (down arrow), hide expand (up arrow)
        if (expandIcon) expandIcon.style.display = 'none'
        if (collapseIcon) collapseIcon.style.display = 'block'

        // Calculate and set the actual height for smooth animation
        if (contentElement) {
          const contentHeight = contentElement.scrollHeight
          contentElement.style.height = contentHeight + 'px'
        }

        console.log('Controls shown, classes:', controlsContent.className)
      } else {
        // Hide controls
        controlsContent.classList.add('hidden')

        // Toggle icons: show expand (up arrow), hide collapse (down arrow)
        if (expandIcon) expandIcon.style.display = 'block'
        if (collapseIcon) collapseIcon.style.display = 'none'

        // Set height to 0 for smooth animation
        if (contentElement) {
          contentElement.style.height = '0px'
        }

        console.log('Controls hidden, classes:', controlsContent.className)
      }
    })

    // Initial labels and state
    if (toggleBtn) toggleBtn.textContent = 'Disable'
    if (modeBtn) modeBtn.textContent = 'Full' // Start in full mode

    // Set initial icon state (controls visible, so show collapse icon)
    if (slideToggleBtn) {
      const expandIcon = slideToggleBtn.querySelector('.toggle-icon-expand')
      const collapseIcon = slideToggleBtn.querySelector('.toggle-icon-collapse')
      if (expandIcon) expandIcon.style.display = 'none'
      if (collapseIcon) collapseIcon.style.display = 'block'
    }

    // Ensure controls start in visible state and set initial height
    if (controlsContent) {
      controlsContent.classList.remove('hidden')
      const contentElement = controlsContent.querySelector('.controls-content')
      if (contentElement) {
        // Set initial height to auto to get the natural height
        contentElement.style.height = 'auto'
        const contentHeight = contentElement.scrollHeight
        contentElement.style.height = contentHeight + 'px'
      }
      console.log('Initial controls state, classes:', controlsContent.className)
    }
  },
}
