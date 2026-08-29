import { createRoot } from 'react-dom/client'
import OverlayApp from './overlay/OverlayApp'
import SettingsApp from './settings/SettingsApp'
import WelcomeApp from './settings/WelcomeApp'

const route = window.location.hash.replace(/^#/, '')
const App = route.startsWith('/overlay') ? OverlayApp : route.startsWith('/welcome') ? WelcomeApp : SettingsApp

createRoot(document.getElementById('root')!).render(<App />)
