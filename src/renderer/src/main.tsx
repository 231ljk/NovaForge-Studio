import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { PRODUCT_NAME } from '../../shared/product'

document.title = PRODUCT_NAME

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
