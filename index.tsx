
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Error al iniciar la aplicación:", error);
    rootElement.innerHTML = `<div style="padding: 2rem; color: #ef4444; font-family: sans-serif;">
      <h1 style="font-size: 1.5rem; font-weight: 900;">ERROR DE CARGA</h1>
      <p>La aplicación no pudo iniciarse. Detalles en la consola (F12).</p>
    </div>`;
  }
}
