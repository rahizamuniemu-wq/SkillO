import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ToastContainer from './components/Toast'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <ToastContainer />
  </React.StrictMode>,
)
