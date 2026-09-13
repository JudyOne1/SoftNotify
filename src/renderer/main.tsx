import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import OverlayApp from './overlay/OverlayApp'
import SettingsApp from './settings/SettingsApp'
import WelcomeApp from './settings/WelcomeApp'
import TrayPanelApp from './tray/TrayPanelApp'

const route = window.location.hash.replace(/^#/, '')
const isOverlay = route.startsWith('/overlay')
document.documentElement.classList.toggle('overlay-document', isOverlay)

const App = isOverlay
  ? OverlayApp
  : route.startsWith('/welcome')
    ? WelcomeApp
    : route.startsWith('/tray')
      ? TrayPanelApp
      : SettingsApp

createRoot(document.getElementById('root')!).render(<App />)
