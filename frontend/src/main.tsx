import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import './index.css'
import './styles/lifestyle.css'
import './styles/tasks.css'
import './styles/wow.css'
import './styles/modal-wow.css'
import './styles/tailwind-apply.module.css'
import './styles/responsive.css'
import './styles/grid-fallback.css'
import './i18n/config' // Initialize i18n

// In dev, force-remove old service workers/caches to prevent stale UI from previous builds.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      void registration.unregister();
    });
  });
  if ('caches' in window) {
    void caches.keys().then((keys) => {
      keys.forEach((key) => {
        void caches.delete(key);
      });
    });
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

// Register service worker after DOM is ready (only in production)
// In development, Vite handles this automatically
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(() => console.log('ServiceWorker registered'))
      .catch((err) => {
        // Silent fail - service worker is optional
        console.warn('ServiceWorker registration failed:', err);
      });
  });
}
