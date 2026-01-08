
import { MuelleData } from '../types';

/**
 * Intenta extraer el número de referencia de Amazon (FBA...) del texto
 */
export const parseAmazonLabelLocal = (text: string): { amazonRef: string | null; packageInfo: string | null } => {
  if (!text) return { amazonRef: null, packageInfo: null };

  // Buscar FBA o referencias largas (Amazon suele usar FBA... o números de 10+ caracteres)
  // El OCR a veces confunde letras, usamos un regex más permisivo
  const fbaMatch = text.match(/FBA[A-Z0-9]+/i) || text.match(/[A-Z0-9]{12,30}/);
  
  // Buscar información de bulto
  const packageMatch = text.match(/(\d+)\s*(?:de|of|out\s+of|\/)\s*(\d+)/i);
  
  return {
    amazonRef: fbaMatch ? fbaMatch[0].toUpperCase() : null,
    packageInfo: packageMatch ? `${packageMatch[1]}/${packageMatch[2]}` : null
  };
};

/**
 * Analiza el texto del muelle buscando pares de Pedido - Referencia
 */
export const parseMuelleTextLocal = (text: string): MuelleData[] => {
  const data: MuelleData[] = [];
  if (!text) return data;

  // Limpiar el texto para el OCR
  const lines = text.split(/[\n\r]+/);
  
  lines.forEach(line => {
    // Buscar un número de pedido (6-8 dígitos) y una referencia FBA en la misma línea
    const orderMatch = line.match(/\b(\d{6,8})\b/);
    const refMatch = line.match(/(FBA[A-Z0-9]+|[A-Z0-9]{12,})/i);

    if (orderMatch && refMatch) {
      data.push({
        orderNumber: orderMatch[1],
        amazonRef: refMatch[0].toUpperCase()
      });
    }
  });

  // Si no encontró nada por líneas, buscar por proximidad
  if (data.length === 0) {
    const tokens = text.split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
      if (/^\d{6,8}$/.test(tokens[i])) {
        for (let j = 1; j < 10; j++) {
          if (i + j >= tokens.length) break;
          if (/^FBA|^[A-Z0-9]{12,}$/i.test(tokens[i + j])) {
            data.push({
              orderNumber: tokens[i],
              amazonRef: tokens[i + j].toUpperCase()
            });
            break;
          }
        }
      }
    }
  }
  
  return data;
};
