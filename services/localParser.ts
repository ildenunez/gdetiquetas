
import { MuelleData, RawToken } from '../types';

export const isSeurOrOntime = (text: string): boolean => {
  if (!text) return false;
  const t = text.toUpperCase();
  return t.includes('SEUR') || t.includes('ONTIME') || t.includes('REDUR');
};

export const normalizeForMatch = (str: string): string => {
  if (!str) return "";
  return str.trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
};

export const cleanAmazonRef = (text: string): string | null => {
  if (!text) return null;
  let cleanStr = text.replace(/[^A-Za-z0-9]/g, ' ').trim();
  const words = cleanStr.split(/\s+/).filter(w => w.length >= 4);

  // 1. Patrón exacto de 9 caracteres (ej: TCX1SXxy9)
  for (const word of words) {
    if (word.length === 9 && /[A-Za-z]/.test(word) && /[0-9]/.test(word)) {
      return word;
    }
  }

  // 2. Patrones FBA/X00
  for (const word of words) {
    const w = word.toUpperCase();
    if (w.startsWith('FBA') || w.startsWith('X00')) return word;
  }
  
  return null;
};

export const parsePackageQty = (text: string): [number, number] | null => {
  if (!text) return null;
  const normalized = text.toUpperCase().replace(/\s+/g, ' ');
  const match = normalized.match(/(\d+)\s*(?:OF|DE|\/)\s*(\d+)/);
  if (match) {
    const current = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    if (!isNaN(current) && !isNaN(total)) return [current, total];
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
  const tolerance = 40; // Aumentado para mayor flexibilidad
  const orderX = orderSample.x;
  const refX = refSample.x;
  const bultosX = bultosSample ? bultosSample.x : null;
  
  const lines: Record<number, RawToken[]> = {};
  allTokens.forEach(t => {
    const ly = Math.round(t.y / 10) * 10; // Agrupamiento por líneas más permisivo
    if (!lines[ly]) lines[ly] = [];
    lines[ly].push(t);
  });

  Object.values(lines).forEach(lineTokens => {
    const findClosest = (targetX: number) => {
      let closest = null;
      let minDiff = tolerance;
      for (const t of lineTokens) {
        const diff = Math.abs(t.x - targetX);
        if (diff < minDiff) {
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
      // Limpiamos el pedido de bultos o sufijos raros
      const orderNum = oToken.text.replace(/[^0-9]/g, '');
      const refVal = rToken.text.trim();
      let bultosVal = 1;

      if (bToken) {
        const bMatch = bToken.text.match(/\d+/);
        if (bMatch) bultosVal = parseInt(bMatch[0], 10);
      }
      
      if (orderNum.length >= 4 && refVal.length >= 4) {
        results.push({ 
          orderNumber: orderNum, 
          amazonRef: refVal,
          totalBultos: bultosVal
        });
      }
    }
  });
  return results;
};
