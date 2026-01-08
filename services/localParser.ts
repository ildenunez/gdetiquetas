
import { MuelleData, RawToken, LabelRules } from '../types';

// Lista de palabras que NO pueden ser una referencia de Amazon (añadido VENDORCENTRAL)
const BLACKLIST_REFS = ['AMAZON', 'HTTPS', 'HTTP', 'SHIPMENT', 'PACKAGE', 'LABEL', 'CHECK', 'WEIGHT', 'BILLING', 'AMAZONHTTPS', 'VENDORCENTRAL'];

const cleanOrderNumber = (text: string): string | null => {
  if (!text) return null;
  const match = text.match(/2\d{7}/);
  return match ? match[0] : null;
};

const cleanAmazonRef = (text: string): string | null => {
  if (!text) return null;
  
  let t = text.toUpperCase().replace(/[\n\r]/g, ' ');

  // 1. Prioridad: FBA directo
  const fbaMatch = t.match(/FBA[A-Z0-9]{8,16}/);
  if (fbaMatch) return fbaMatch[0];

  // 2. Buscar bloques largos (ampliamos a 30 caracteres por si vienen pegados)
  const matches = t.match(/[A-Z0-9]{8,30}/g);
  if (matches) {
    // Si el bloque contiene VENDORCENTRAL, intentamos separar lo que hay antes o después
    const complexMatch = matches.find(m => m.includes('VENDORCENTRAL'));
    if (complexMatch) {
       // Si es algo como 71261120VENDORCENTRAL, queremos el 71261120
       const parts = complexMatch.split('VENDORCENTRAL');
       const candidate = parts.find(p => p.length >= 8);
       if (candidate) return candidate;
    }

    const validMatches = matches.filter(m => !BLACKLIST_REFS.some(b => m === b));
    if (validMatches.length > 0) {
      // Preferimos el que tenga letras y números
      const mixed = validMatches.find(m => /[A-Z]/.test(m) && /\d/.test(m));
      return mixed || validMatches[0];
    }
  }
  
  return null;
};

const cleanPackageInfo = (text: string): string | null => {
  if (!text) return null;
  // Buscamos patrones como "1 / 2", "1-2", "1 OF 2", "Bulto 1 de 2"
  const match = text.match(/\b(\d+)\s*[\/\-]\s*(\d+)\b/) || text.match(/\b(\d+)\s+OF\s+(\d+)\b/i);
  if (match) return match[0].replace(/\s+OF\s+/i, '/').replace(/\s+/g, '');
  
  // Caso de respaldo: solo números seguidos
  const fallback = text.match(/(\d+)\s*de\s*(\d+)/i);
  if (fallback) return `${fallback[1]}/${fallback[2]}`;

  return null;
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
          height: item.height
        });
      }
    });
  });
  return tokens;
};

export const parseAmazonLabelLocal = (text: string): { amazonRef: string | null; packageInfo: string | null } => {
  if (!text) return { amazonRef: null, packageInfo: null };
  const t = text.toUpperCase();
  const amazonRef = cleanAmazonRef(t);
  const pkg = cleanPackageInfo(t);
  return { amazonRef, packageInfo: pkg };
};

export const extractLabelBySpatialRules = (tokens: RawToken[], rules: LabelRules): { packageInfo: string | null } => {
  const PAGE_W = 595;
  const PAGE_H = 842;

  const pkgZone = {
    x: rules.pkgArea.x * PAGE_W,
    y: (1 - rules.pkgArea.y - rules.pkgArea.h) * PAGE_H,
    w: rules.pkgArea.w * PAGE_W,
    h: rules.pkgArea.h * PAGE_H
  };

  const tol = 10; 

  const pkgTokens = tokens.filter(t => 
    t.x >= pkgZone.x - tol && 
    t.x <= pkgZone.x + pkgZone.w + tol &&
    t.y >= pkgZone.y - tol && 
    t.y <= pkgZone.y + pkgZone.h + tol
  );

  return {
    packageInfo: cleanPackageInfo(pkgTokens.map(t => t.text).join(" "))
  };
};

export const extractBySpatialRange = (allTokens: RawToken[], orderSample: RawToken, refSample: RawToken): MuelleData[] => {
  const results: MuelleData[] = [];
  const tolerance = 15; 
  const orderRange = { min: orderSample.x - tolerance, max: orderSample.x + orderSample.width + tolerance };
  const refRange = { min: refSample.x - tolerance, max: refSample.x + refSample.width + tolerance };

  const linesMap: Record<number, RawToken[]> = {};
  allTokens.forEach(t => {
    if (!linesMap[t.lineIndex]) linesMap[t.lineIndex] = [];
    linesMap[t.lineIndex].push(t);
  });

  Object.values(linesMap).forEach(lineTokens => {
    const orderTokensInLine = lineTokens.filter(t => 
      (t.x >= orderRange.min && t.x <= orderRange.max) || 
      (t.x + t.width >= orderRange.min && t.x + t.width <= orderRange.max)
    );
    const orderClean = cleanOrderNumber(orderTokensInLine.map(t => t.text).join(" "));

    const refTokensInLine = lineTokens.filter(t => 
      (t.x >= refRange.min && t.x <= refRange.max) ||
      (t.x + t.width >= refRange.min && t.x + t.width <= refRange.max)
    );
    const refClean = cleanAmazonRef(refTokensInLine.map(t => t.text).join(" "));

    if (orderClean && refClean) {
      if (!results.some(r => r.orderNumber === orderClean && r.amazonRef === refClean)) {
        results.push({ orderNumber: orderClean, amazonRef: refClean });
      }
    }
  });

  return results;
};
