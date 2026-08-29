import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import OverlayApp from './overlay/OverlayApp'
import SettingsApp from './settings/SettingsApp'
import WelcomeApp from './settings/WelcomeApp'
import HistoryApp from './settings/HistoryApp'
import StatsApp from './settings/StatsApp'

const route = window.location.hash.replace(/^#/, '')
const App = route.startsWith('/overlay')
  ? OverlayApp
  : route.startsWith('/welcome')
    ? WelcomeApp
    : route.startsWith('/history')
      ? HistoryApp
      : route.startsWith('/stats')
        ? StatsApp
        : SettingsApp

createRoot(document.getElementById('root')!).render(<App />)
