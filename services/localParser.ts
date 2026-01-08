
import { MuelleData } from '../types';

/**
 * Intenta extraer el número de referencia de Amazon (FBA...) del texto de una etiqueta
 */
export const parseAmazonLabelLocal = (text: string): { amazonRef: string | null; packageInfo: string | null } => {
  // Buscar FBA o referencias largas comunes de Amazon
  const fbaMatch = text.match(/FBA[A-Z0-9]+/i) || text.match(/\b[A-Z0-9]{10,}\b/);
  
  // Buscar información de bulto (ej. "1 de 2", "Page 1 of 1", "1/2")
  const packageMatch = text.match(/(\d+)\s+(?:de|of|out\s+of)\s+(\d+)/i) || text.match(/(\d+)\/(\d+)/);
  
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
  
  // Dividir por palabras para encontrar números de pedido (ej. 1045234)
  const tokens = text.split(/\s+/);
  
  // Buscamos patrones comunes: Un número de 7-10 dígitos seguido cerca de una referencia FBA
  // Este es un parser simple, se puede mejorar según el formato exacto del PDF
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    // Si parece un número de pedido (ej. 7 dígitos)
    if (/^\d{6,8}$/.test(token)) {
      // Mirar en los siguientes tokens si hay algo que parezca una referencia FBA
      for (let j = 1; j < 15; j++) {
        if (i + j >= tokens.length) break;
        const nextToken = tokens[i + j];
        if (nextToken.startsWith('FBA') || nextToken.length > 8) {
          data.push({
            orderNumber: token,
            amazonRef: nextToken.toUpperCase()
          });
          break;
        }
      }
    }
  }
  
  return data;
};
