import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { PatientErrorBoundary, installGlobalErrorMonitoring } from './monitoring.jsx'

installGlobalErrorMonitoring()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PatientErrorBoundary>
      <App />
    </PatientErrorBoundary>
  </StrictMode>,
)
