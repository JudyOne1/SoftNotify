import { createRoot } from 'react-dom/client'
import OverlayApp from './overlay/OverlayApp'
import SettingsApp from './settings/SettingsApp'

const route = window.location.hash.replace(/^#/, '')
const App = route.startsWith('/overlay') ? OverlayApp : SettingsApp

createRoot(document.getElementById('root')!).render(<App />)
