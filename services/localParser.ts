
import { MuelleData, RawToken } from '../types';

const BLACKLIST_REFS = [
  'AMAZON', 'HTTPS', 'HTTP', 'SHIPMENT', 'PACKAGE', 'LABEL', 'CHECK', 'WEIGHT', 
  'BILLING', 'VENDORCENTRAL', 'REF', 'REFERENCE', 'UPS', 'TRACKING',
  'NO.1', 'NO.2', 'NUMBER', 'SHIPTO', 'FROM', 'CUSTOMER', 'XOL', 'BILLING', 'DATE', 'EDI',
  'CLIENTE', 'PEDIDOCLIENTE', 'Nº.', 'S.A.', 'Giner', 'Sánchez'
];

/**
 * Normalización ULTRA-ROBUSTA para cruces.
 * Convierte caracteres similares para evitar fallos por mala calidad de impresión.
 */
export const normalizeForMatch = (str: string): string => {
  if (!str) return "";
  return str.toUpperCase()
    .trim()
    .replace(/\s+/g, '')       
    // Corregimos confusiones visuales típicas del OCR
    .replace(/[OQD]/g, '0')   
    .replace(/[ILJT|]/g, '1') 
    .replace(/[S]/g, '5')     
    .replace(/[B]/g, '8')     
    .replace(/[Z]/g, '2')     
    .replace(/[G]/g, '6')     
    .replace(/[UV]/g, 'U')     
    .replace(/[^A-Z0-9]/g, ''); 
};

/**
 * Limpieza de referencia con lógica de Amazon.
 */
export const cleanAmazonRef = (text: string, isFromDedicatedArea: boolean = false): string | null => {
  if (!text) return null;

  // Eliminamos ruidos comunes de etiquetas de envío
  const cleanStr = text.replace(/^(REF\s*1|REFERENCE\s*1|REF|:)\s*/i, '').trim();
  const words = cleanStr.split(/[\s,;:]+/).filter(w => w.length >= 4);

  // 1. Patrón FBA (El más común y seguro)
  for (const word of words) {
    if (word.toUpperCase().startsWith('FBA') && word.length >= 7) return word.toUpperCase();
  }

  // 2. Patrón Alfanumérico Amazon
  const amazonPattern = /^[A-Z0-9]{8,14}$/;
  for (const word of words) {
    const uWord = word.toUpperCase();
    if (amazonPattern.test(uWord) && /[A-Z]/.test(uWord) && /[0-9]/.test(uWord)) {
      if (!BLACKLIST_REFS.includes(uWord)) return uWord;
    }
  }

  return isFromDedicatedArea && words.length > 0 ? words[0].toUpperCase() : null;
};

export const tokenizeText = (rawItems: any[]): RawToken[] => {
  if (!rawItems || rawItems.length === 0) return [];
  const thresholdY = 5;
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
          text: text.toUpperCase(),
          lineIndex: lIdx,
          tokenIndex: tIdx,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height || item.fontSize || 10
        });
      }
    });
  });
  return tokens;
};

export const parseAmazonLabelLocal = (text: string): { amazonRef: string | null; packageInfo: string | null } => {
  if (!text) return { amazonRef: null, packageInfo: null };
  return { amazonRef: cleanAmazonRef(text), packageInfo: null };
};

export const extractBySpatialRange = (allTokens: RawToken[], orderSample: RawToken, refSample: RawToken): MuelleData[] => {
  const results: MuelleData[] = [];
  const tolerance = 25;
  const orderRange = { min: orderSample.x - tolerance, max: orderSample.x + orderSample.width + tolerance };
  const refRange = { min: refSample.x - tolerance, max: refSample.x + refSample.width + tolerance };
  const linesMap: Record<number, RawToken[]> = {};
  allTokens.forEach(t => {
    if (!linesMap[t.lineIndex]) linesMap[t.lineIndex] = [];
    linesMap[t.lineIndex].push(t);
  });
  Object.values(linesMap).forEach(lineTokens => {
    const orderTokensInLine = lineTokens.filter(t => (t.x >= orderRange.min && t.x <= orderRange.max));
    const orderFullText = orderTokensInLine.map(t => t.text).join("").trim();
    const orderMatch = orderFullText.match(/(24|25|26|27|28|29)\d+/);
    const orderClean = orderMatch ? orderMatch[0] : (orderFullText.length >= 5 && !BLACKLIST_REFS.some(b => orderFullText.includes(b)) ? orderFullText : null);
    const refTokensInLine = lineTokens.filter(t => (t.x >= refRange.min && t.x <= refRange.max));
    const refRaw = refTokensInLine.map(t => t.text).join(" ").trim();
    const refClean = cleanAmazonRef(refRaw, true);
    if (orderClean && refClean && !BLACKLIST_REFS.includes(orderClean)) {
      results.push({ orderNumber: orderClean, amazonRef: refClean });
    }
  });
  return results;
};
