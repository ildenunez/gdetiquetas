
import { MuelleData, RawToken } from '../types';

export const isSeurOrOntime = (text: string): boolean => {
  if (!text) return false;
  const t = text.toUpperCase();
  return t.includes('SEUR') || t.includes('ONTIME') || t.includes('REDUR') || t.includes('UPS');
};

export const normalizeForMatch = (str: string): string => {
  if (!str) return "";
  return str.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
};

/**
 * Limpia y extrae posibles referencias. 
 * Ahora es más flexible para capturar tanto la REF. CLIENTE (9 chars) como el Nº PEDIDO (8+ dígitos).
 */
export const cleanAmazonRef = (text: string): string | null => {
  if (!text) return null;
  // Reemplazar caracteres no alfanuméricos por espacios
  let cleanStr = text.replace(/[^A-Za-z0-9]/g, ' ').trim();
  const words = cleanStr.split(/\s+/).filter(w => w.length >= 4);
  
  // 1. Prioridad: Referencias tipo FBA o X00
  for (const word of words) {
    const w = word.toUpperCase();
    if (w.startsWith('FBA') || w.startsWith('X00')) return w;
  }

  // 2. Referencia estándar de 9 caracteres (mezcla letras y números)
  for (const word of words) {
    if (word.length === 9 && /[A-Za-z]/.test(word) && /[0-9]/.test(word)) return word.toUpperCase();
  }

  // 3. Fallback: Número de pedido (8 a 10 dígitos puros) - Común en etiquetas UPS/Agencias
  for (const word of words) {
    if (/^\d{8,10}$/.test(word)) return word;
  }

  return null;
};

/**
 * Optimizado para leer bultos tipo "1 OF 32", "1 / 32", etc.
 * Maneja errores comunes de OCR transformando caracteres visualmente similares.
 */
export const parsePackageQty = (text: string): [number, number] | null => {
  if (!text) return null;
  
  // Normalización agresiva de errores OCR
  let clean = text.toUpperCase()
    .replace(/I|L|l|\|/g, '1') // Errores comunes: I, L o | por el número 1
    .replace(/O/g, '0')        // Errores comunes: O por el número 0
    .replace(/\s+/g, ' ')      // Colapsar espacios
    .trim();

  // 1. Intentar patrón complejo: "1 OF 5", "1/5", "1 DE 5", "1-5", "10F5"
  const patternMatch = clean.match(/(\d+)\s*(?:OF|0F|DE|\/|\||-)\s*(\d+)/);
  if (patternMatch) {
    const current = parseInt(patternMatch[1], 10);
    const total = parseInt(patternMatch[2], 10);
    if (!isNaN(current) && !isNaN(total)) return [current, total];
  }

  // 2. Fallback: Simplemente buscar los dos primeros números en la cadena
  const numbers = clean.match(/\d+/g);
  if (numbers && numbers.length >= 2) {
    const current = parseInt(numbers[0], 10);
    const total = parseInt(numbers[1], 10);
    // Validación mínima de cordura: el bulto actual no puede ser mayor al total
    if (current <= total) return [current, total];
  }

  return null;
};

export const parseAmazonLabelLocal = (text: string): { amazonRef: string | null } => {
  return { amazonRef: cleanAmazonRef(text) };
};

export const tokenizeText = (rawItems: any[]): RawToken[] => {
  if (!rawItems || rawItems.length === 0) return [];
  const thresholdY = 3; 
  const lines: Record<number, any[]> = {};
  rawItems.forEach(item => {
    const y = Math.round(item.y / thresholdY) * thresholdY;
    if (!lines[y]) lines[y] = [];
    lines[y].push(item);
  });
  const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);
  const tokens: RawToken[] = [];
  sortedY.forEach((y, lIdx) => {
    const lineItems = lines[y].sort((a, b) => a.x - b.x);
    lineItems.forEach((item, tIdx) => {
      const text = item.str.trim();
      if (text.length > 0) {
        tokens.push({
          text: text,
          lineIndex: lIdx,
          tokenIndex: tIdx,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height || 10
        });
      }
    });
  });
  return tokens;
};

export const extractBySpatialRange = (
  allTokens: RawToken[], 
  orderSample: RawToken, 
  refSample: RawToken,
  bultosSample?: RawToken | null
): MuelleData[] => {
  const results: MuelleData[] = [];
  const toleranceX = 35; 
  const orderX = orderSample.x;
  const refX = refSample.x;
  const bultosX = bultosSample ? bultosSample.x : null;
  
  const lines: Record<number, RawToken[]> = {};
  allTokens.forEach(t => {
    const ly = Math.round(t.y / 8) * 8; 
    if (!lines[ly]) lines[ly] = [];
    lines[ly].push(t);
  });

  // CRÍTICO: Ordenar las líneas por Y descendente (de arriba a abajo)
  // En PDF.js el 0 suele ser la parte inferior, por lo que valores altos están arriba.
  // El sorting (b - a) asegura que procesamos de la parte superior a la inferior de la página.
  const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);

  sortedY.forEach(y => {
    const lineTokens = lines[y];
    const findClosest = (targetX: number) => {
      let closest = null;
      let minDiff = Infinity;
      for (const t of lineTokens) {
        const diff = Math.abs(t.x - targetX);
        if (diff < toleranceX && diff < minDiff) {
          minDiff = diff;
          closest = t;
        }
      }
      return closest;
    };

    const oToken = findClosest(orderX);
    const rToken = findClosest(refX);
    const bToken = bultosX !== null ? findClosest(bultosX) : null;

    if (oToken && rToken) {
      const orderNum = oToken.text.replace(/[^0-9]/g, '');
      const refVal = rToken.text.trim();
      let totalBultos = 1;
      
      if (bToken) {
        const val = parseInt(bToken.text.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(val)) totalBultos = val;
      }
      
      if (orderNum.length >= 4 && refVal.length >= 4) {
        results.push({ 
          orderNumber: orderNum, 
          amazonRef: refVal,
          totalBultos: totalBultos
        });
      }
    }
  });
  return results;
};
