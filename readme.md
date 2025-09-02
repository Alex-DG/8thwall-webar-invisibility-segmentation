# 8th Wall AR Invisibility Effects - SETUP

- This project implements two different invisibility effects for AR applications using 8th Wall and A-Frame, each utilizing different computer vision techniques to achieve the "invisibility" effect.

## 🎥 Demo

_Watch the invisibility effects in action!_

https://github.com/user-attachments/assets/2441bfdf-db47-44a8-8d41-bf90a84aa2dd

Test it live on your mobile phone.

## Development Commands

```bash
# Install dependencies
yarn install

# Start development server (with HTTPS for camera access)
yarn dev

# Build for production
yarn build

# Preview production build
yarn preview
```

## Environment Setup

Create `.env.local` file in the project root with your 8th Wall app key:

```
VITE_8THWALL_APP_KEY=your_8thwall_app_key_here
```

## Architecture

### Core Components

- **invisibility.js** (`js/components/invisibility.js`): Contains two invisibility components

  - **invisibilityComponent**: Full body invisibility using MediaPipe SelfieSegmentation

    - Real-time person detection and segmentation
    - Background capture and replacement
    - Edge blurring (0-24px) with multi-pass processing
    - Canvas overlay system with DPR scaling
    - API methods: `enable()`, `disable()`, `toggleCloak()`, `captureBackground()`, `setBlur()`, `setMirror()`

  - **invisibilityCloakComponent**: White cloth (or other white object) invisibility using color-based detection
    - Multi-pathway white cloth detection algorithm
    - Configurable white threshold (0-255) and sensitivity
    - Edge blurring (0-12px) for smooth effects
    - Same API interface as invisibilityComponent

- **ui.js** (`js/components/ui.js`): UI management with mode switching

  - **uiManagerComponent**: Main UI controller with dual-mode support
    - Dynamic switching between 'full' (person segmentation) and 'cloak' (white cloth) modes
    - Automatic component management (enable/disable based on active mode)
    - Unified controls for both invisibility types
    - Collapsible UI panel with smooth animations
    - Mode-specific button states and labels

- **app.js** (`js/app.js`): Application entry point
  - Registers all A-Frame components
  - Imports CSS styles

### Tech Stack

- **8th Wall**: AR platform for camera access and tracking
- **A-Frame**: WebXR framework for 3D/AR scenes
- **MediaPipe**: Google's ML framework for person segmentation
- **Vite**: Build tool with HTTPS development server
- **Canvas API**: Real-time image compositing and overlay system

### Key Features

- **Dual Invisibility Modes**:

  - Full body invisibility (ML-based person segmentation)
  - White cloth invisibility (color-based detection)
  - Seamless mode switching without scene reloading

- **Advanced Processing**:

  - Real-time person segmentation using MediaPipe
  - Sophisticated white cloth detection with morphological operations
  - Background capture and replacement
  - Configurable edge blur (0-24px for person, 0-12px for cloth)
  - Mirror mode toggle
  - Device pixel ratio (DPR) scaling for high-density displays

- **User Experience**:
  - Collapsible control panel with smooth animations
  - Mode-specific UI states and button management
  - Responsive design for mobile devices
  - Real-time feedback and status updates

### Component Architecture

```
Single A-Frame Scene (ui-manager)
├── invisibilityComponent (person segmentation)
├── invisibilityCloakComponent (white cloth detection)
└── Dynamic Mode Switching
    ├── Full Mode: invisibilityComponent active
    └── Cloak Mode: invisibilityCloakComponent active
```

## File Structure

```
js/
├── app.js                    # Main entry point, component registration
├── components/
│   ├── invisibility.js      # Both invisibility components
│   │   ├── invisibilityComponent (person segmentation)
│   │   └── invisibilityCloakComponent (white cloth detection)
│   └── ui.js                # UI management with mode switching
│       └── uiManagerComponent (main controller)
styles/
└── app.css                  # UI styling with smooth animations
index.html                   # Main HTML with A-Frame scene
demo/
└── demo_video.mp4          # Demo video
```

## Development Notes

- The app requires HTTPS for camera access (handled by Vite dev server)
- MediaPipe assets are loaded from CDN
- Canvas overlay is positioned above AR scene but below UI controls
- Background capture should be done when user steps out of frame for best results
- Edge blur helps blend the invisibility effect naturally
