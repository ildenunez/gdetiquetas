
import { MuelleData, RawToken } from '../types';

const BLACKLIST_REFS = [
  'AMAZON', 'HTTPS', 'HTTP', 'SHIPMENT', 'PACKAGE', 'LABEL', 'CHECK', 'WEIGHT', 
  'BILLING', 'VENDORCENTRAL', 'REF', 'REFERENCE', 'UPS', 'TRACKING',
  'NO.1', 'NO.2', 'NUMBER', 'SHIPTO', 'FROM', 'CUSTOMER', 'XOL', 'BILLING', 'DATE', 'EDI',
  'CLIENTE', 'PEDIDOCLIENTE', 'Nº.', 'S.A.', 'GINER', 'SANCHEZ', 'OF', 'PKG', 'REFERENCIA',
  'SÁNCHEZ', 'GINER I S.A.', 'S.L.', 'RUTAS', 'PEDIDO', 'TRACKING#'
];

export const isUpsLabel = (text: string): boolean => {
  if (!text) return false;
  const t = text.toUpperCase();
  return (
    t.includes('UPS') || 
    t.includes('UNITED PARCEL') || 
    t.includes('UNITEDPARCEL') ||
    /\b1Z[A-Z0-9]{16}\b/.test(t) ||
    t.includes('WORLDSHIP')
  );
};

export const isSeurOrOntime = (text: string): boolean => {
  if (!text) return false;
  const t = text.toUpperCase();
  return t.includes('SEUR') || t.includes('ONTIME');
};

export const parsePackageQty = (text: string): [number, number] | null => {
  if (!text) return null;
  let clean = text.toUpperCase()
    .replace(/(\d)0F(\d)/g, '$1 OF $2')
    .replace(/(\d)DF(\d)/g, '$1 OF $2')
    .replace(/[^0-9/OF]/g, ' ')
    .trim();
    
  const match = clean.match(/(\d+)\s*(?:OF|\/)\s*(\d+)/);
  if (match) return [parseInt(match[1]), parseInt(match[2])];
  
  const partialMatch = clean.match(/(\d+)\s*(?:OF|\/)/);
  if (partialMatch) return [parseInt(partialMatch[1]), 0];
  
  return null;
};

export const normalizeForMatch = (str: string): string => {
  if (!str) return "";
  return str.trim()
    .replace(/\s+/g, '')
    .replace(/[oOQDG]/g, '0')   
    .replace(/[iILJT|]/g, '1') 
    .replace(/[sS]/g, '5')     
    .replace(/[zZ]/g, '2')     
    .replace(/[eEGB]/g, '6') 
    .replace(/[g]/g, 'q')
    .replace(/[yY]/g, '9')
    .toUpperCase(); 
};

export const cleanAmazonRef = (text: string, isFromDedicatedArea: boolean = false): string | null => {
  if (!text) return null;
  let cleanStr = text.replace(/[^A-Za-z0-9]/g, ' ').trim();
  const words = cleanStr.split(/\s+/).filter(w => w.length >= (isFromDedicatedArea ? 2 : 4));

  for (const word of words) {
    const w = word.toUpperCase();
    if (w.startsWith('FBA') && w.length >= 7) return w;
    if (w.startsWith('X00') && w.length >= 7) return w;
  }

  for (const word of words) {
    if (/[a-zA-Z]/.test(word) && /[0-9]/.test(word)) {
       if (!BLACKLIST_REFS.some(b => word.toUpperCase().includes(b))) return word;
    }
  }

  if (isFromDedicatedArea && words.length > 0) {
    const sorted = words
      .filter(w => !BLACKLIST_REFS.some(b => w.toUpperCase().includes(b)))
      .sort((a,b) => b.length - a.length);
    return sorted.length > 0 ? sorted[0] : null;
  }
  
  return null;
};

export const parseAmazonLabelLocal = (text: string): { amazonRef: string | null } => {
  return {
    amazonRef: cleanAmazonRef(text)
  };
};

export const tokenizeText = (rawItems: any[]): RawToken[] => {
  if (!rawItems || rawItems.length === 0) return [];
  
  const thresholdY = 10; 
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

export const extractBySpatialRange = (allTokens: RawToken[], orderSample: RawToken, refSample: RawToken): MuelleData[] => {
  const results: MuelleData[] = [];
  const tolerance = 40; 
  const orderX = orderSample.x;
  const refX = refSample.x;
  
  const lines: Record<number, RawToken[]> = {};
  allTokens.forEach(t => {
    const ly = Math.round(t.y / 10) * 10;
    if (!lines[ly]) lines[ly] = [];
    lines[ly].push(t);
  });

  Object.values(lines).forEach(lineTokens => {
    const orderToken = lineTokens.find(t => Math.abs(t.x - orderX) < tolerance);
    const refToken = lineTokens.find(t => Math.abs(t.x - refX) < tolerance);

    if (orderToken && refToken) {
      const orderNumMatch = orderToken.text.replace(/\s+/g, '').match(/\d{4,}/);
      const refClean = cleanAmazonRef(refToken.text, true);

      if (orderNumMatch && refClean && !BLACKLIST_REFS.some(b => orderToken.text.toUpperCase().includes(b))) {
        results.push({
          orderNumber: orderNumMatch[0],
          amazonRef: refClean
        });
      }
    }
  });

  return results;
};
