import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { StoreProvider } from './store/store.tsx'
import { PricesProvider } from './store/prices.tsx'
import { ToastProvider } from './components/ui/Toast.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <StoreProvider>
          <PricesProvider>
            <App />
          </PricesProvider>
        </StoreProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
