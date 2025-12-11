import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Activar actualización automática del PWA
import { enableAutoUpdate } from './pwa-update';
enableAutoUpdate();

// IMPORTANTE:
// No registrar manualmente el service worker aquí.
// VitePWA lo maneja automáticamente gracias a:
// registerType: "autoUpdate"

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
