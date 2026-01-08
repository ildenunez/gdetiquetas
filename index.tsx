
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
    rootElement.innerHTML = `<div style="padding: 20px; color: red;">Error al cargar la aplicación. Revisa la consola (F12).</div>`;
  }
}
