import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root-Element #root wurde nicht gefunden.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service Worker für PWA-Installierbarkeit (kein Offline-Cache, nur Hibernation-freundlich).
// Registrierung nur in secure contexts (https / localhost).
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silently ignore – App funktioniert auch ohne SW; Install-Prompt bleibt
      // auf modernen Browsern ohnehin auch ohne SW möglich.
    });
  });
}
