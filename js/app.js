import '../styles/app.css'

import {
  invisibilityComponent,
  invisibilityCloakComponent,
} from './components/invisibility'
AFRAME.registerComponent('invisibility', invisibilityComponent)
AFRAME.registerComponent('invisibility-cloak', invisibilityCloakComponent)

import { uiManagerComponent } from './components/ui'
AFRAME.registerComponent('ui-manager', uiManagerComponent)
