
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("No se encontró el elemento root");
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Error crítico al renderizar React:", error);
    if (rootElement) {
      rootElement.innerHTML = `<div style="padding: 40px; color: #ef4444; font-family: sans-serif;">
        <h1 style="font-weight: bold;">Error de Carga</h1>
        <p>No se pudo iniciar React. Detalles: ${error instanceof Error ? error.message : 'Error desconocido'}</p>
      </div>`;
    }
  }
}
