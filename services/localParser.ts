
import { MuelleData } from '../types';

const cleanText = (t: string) => t.toUpperCase().replace(/[^A-Z0-9\s\-\/]/g, ' ');

export const parseAmazonLabelLocal = (text: string): { amazonRef: string | null; packageInfo: string | null } => {
  if (!text) return { amazonRef: null, packageInfo: null };
  const t = cleanText(text);

  // Amazon Ref: FBA... o una cadena larga alfanumérica
  const refMatch = t.match(/\b(FBA|EBA|F8A|F6A|SHIPMENT)[A-Z0-9]{5,}\b/i) || t.match(/\b[A-Z0-9]{12,}\b/);
  const pkgMatch = t.match(/(\d+)\s*[\/\-DEOF]+\s*(\d+)/i);
  
  let ref = refMatch ? refMatch[0] : null;
  if (ref) {
    // Normalizar errores comunes de OCR en FBA
    if (ref.startsWith('EBA') || ref.startsWith('F8A')) ref = 'FBA' + ref.substring(3);
  }

  return {
    amazonRef: ref,
    packageInfo: pkgMatch ? `${pkgMatch[1]}/${pkgMatch[2]}` : null
  };
};

export const parseMuelleTextLocal = (text: string): MuelleData[] => {
  const data: MuelleData[] = [];
  if (!text) return data;

  const lines = text.split('\n');
  lines.forEach(line => {
    const cleanLine = cleanText(line);
    // Buscamos un número de 6-8 dígitos y una referencia de al menos 10 caracteres
    const orderMatch = cleanLine.match(/\b(\d{6,8})\b/);
    const refMatch = cleanLine.match(/\b(FBA|EBA|SHIPMENT|[A-Z0-9]{10,})\b/i);

    if (orderMatch && refMatch) {
      data.push({
        orderNumber: orderMatch[1],
        amazonRef: refMatch[1]
      });
    }
  });

  // Si no hay nada por líneas, buscamos de forma global en todo el texto (más lento pero más seguro)
  if (data.length === 0) {
    const allOrders = text.match(/\b\d{6,8}\b/g) || [];
    const allRefs = text.match(/\b(FBA[A-Z0-9]+|[A-Z0-9]{12,})\b/gi) || [];
    
    // Si el número de órdenes y referencias coincide, intentamos emparejar por orden de aparición
    if (allOrders.length > 0 && allOrders.length === allRefs.length) {
      allOrders.forEach((order, idx) => {
        data.push({ orderNumber: order, amazonRef: allRefs[idx] });
      });
    }
  }

  return data;
};
