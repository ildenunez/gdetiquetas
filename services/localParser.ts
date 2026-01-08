
import { MuelleData } from '../types';

/**
 * Limpia el texto de ruidos comunes del OCR
 */
const cleanOCRText = (text: string) => {
  return text.replace(/\s+/g, ' ').toUpperCase();
};

export const parseAmazonLabelLocal = (text: string): { amazonRef: string | null; packageInfo: string | null } => {
  if (!text) return { amazonRef: null, packageInfo: null };
  const clean = cleanOCRText(text);

  // 1. Buscar Referencia Amazon (FBA... o cadenas largas de 10-15 caracteres)
  // Somos flexibles con la primera letra porque el OCR a veces lee 'EBA' o 'F8A'
  const fbaMatch = clean.match(/(?:FBA|EBA|F8A|F6A)[A-Z0-9]+/i) || clean.match(/[A-Z0-9]{10,20}/);
  
  // 2. Buscar Bultos (ej: "1 / 2", "1 DE 2", "PAGE 1")
  const packageMatch = clean.match(/(\d+)\s*(?:\/|DE|OF|OUT OF)\s*(\d+)/i);
  
  let ref = fbaMatch ? fbaMatch[0] : null;
  // Normalizar errores comunes de FBA
  if (ref && (ref.startsWith('EBA') || ref.startsWith('F8A'))) {
    ref = 'FBA' + ref.substring(3);
  }

  return {
    amazonRef: ref,
    packageInfo: packageMatch ? `${packageMatch[1]}/${packageMatch[2]}` : null
  };
};

export const parseMuelleTextLocal = (text: string): MuelleData[] => {
  const data: MuelleData[] = [];
  if (!text) return data;

  const clean = cleanOCRText(text);
  // Buscamos números de 6 a 8 dígitos que estén cerca de algo que parezca una FBA
  const tokens = clean.split(' ');
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    // Si el token parece un número de pedido (6-8 dígitos)
    if (/^\d{6,8}$/.test(token)) {
      // Buscamos en los siguientes 15 tokens una referencia de Amazon
      for (let j = 1; j < 15; j++) {
        if (i + j >= tokens.length) break;
        const next = tokens[i + j];
        if (next.length >= 10 && (next.includes('FBA') || /^[A-Z0-9]{10,}$/.test(next))) {
          data.push({
            orderNumber: token,
            amazonRef: next
          });
          break;
        }
      }
    }
  }
  
  return data;
};
