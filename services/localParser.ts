
import { MuelleData, RawToken, LabelRules } from '../types';

const BLACKLIST_REFS = ['AMAZON', 'HTTPS', 'HTTP', 'SHIPMENT', 'PACKAGE', 'LABEL', 'CHECK', 'WEIGHT', 'BILLING', 'AMAZONHTTPS', 'VENDORCENTRAL'];

const cleanOrderNumber = (text: string): string | null => {
  if (!text) return null;
  const match = text.match(/2\d{7}/);
  return match ? match[0] : null;
};

const cleanAmazonRef = (text: string): string | null => {
  if (!text) return null;
  let t = text.toUpperCase().replace(/[\n\r]/g, ' ');
  const fbaMatch = t.match(/FBA[A-Z0-9]{8,16}/);
  if (fbaMatch) return fbaMatch[0];

  const matches = t.match(/[A-Z0-9]{8,30}/g);
  if (matches) {
    const complexMatch = matches.find(m => m.includes('VENDORCENTRAL'));
    if (complexMatch) {
       const parts = complexMatch.split('VENDORCENTRAL');
       const candidate = parts.find(p => p.length >= 8);
       if (candidate) return candidate;
    }
    const validMatches = matches.filter(m => !BLACKLIST_REFS.some(b => m === b));
    if (validMatches.length > 0) {
      const mixed = validMatches.find(m => /[A-Z]/.test(m) && /\d/.test(m));
      return mixed || validMatches[0];
    }
  }
  return null;
};

/**
 * Motor de limpieza de bultos mejorado para rotación.
 */
const cleanPackageInfo = (text: string): string | null => {
  if (!text) return null;
  let t = text.toUpperCase().replace(/\s+/g, ' ').trim();

  // Patrones comunes con cualquier separador
  const patterns = [
    /(\d+)\s*[\/\-\|]\s*(\d+)/,           // 1/2, 1-2, 1|2
    /(\d+)\s+(?:OF|DE|OUT OF)\s+(\d+)/,   // 1 OF 2, 1 DE 2
    /PKG:?\s*(\d+)\s*(\d+)/,              // PKG 1 1
    /\b(\d+)\s+(\d+)\b/                   // 1 2 (espacio simple)
  ];

  for (const pattern of patterns) {
    const match = t.match(pattern);
    if (match) {
      const current = parseInt(match[1]);
      const total = parseInt(match[2]);
      // Validación lógica: el bulto actual no puede ser mayor que el total + margen error OCR
      // Y los números suelen ser pequeños (< 500)
      if (current <= total && total < 1000 && current > 0) {
        return `${current}/${total}`;
      }
    }
  }

  // Fallback: Si hay exactamente dos números pequeños en el texto, asumimos que es el bulto
  const numbers = t.match(/\b\d+\b/g);
  if (numbers && numbers.length >= 2) {
    const n1 = parseInt(numbers[0]);
    const n2 = parseInt(numbers[1]);
    if (n1 <= n2 && n2 < 1000) return `${n1}/${n2}`;
  }

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
  return { 
    amazonRef: cleanAmazonRef(text), 
    packageInfo: cleanPackageInfo(text) 
  };
};

export const extractLabelBySpatialRules = (tokens: RawToken[], rules: LabelRules): { packageInfo: string | null } => {
  const PAGE_W = 595;
  const PAGE_H = 842;

  // Si el área es nula o demasiado pequeña, ignoramos
  if (!rules.pkgArea || rules.pkgArea.w < 0.01) return { packageInfo: null };

  const pkgZone = {
    x: rules.pkgArea.x * PAGE_W,
    y: (1 - rules.pkgArea.y - rules.pkgArea.h) * PAGE_H,
    w: rules.pkgArea.w * PAGE_W,
    h: rules.pkgArea.h * PAGE_H
  };

  const tol = 30; // Margen generoso para textos rotados que bailan en el PDF

  const pkgTokens = tokens.filter(t => 
    t.x >= pkgZone.x - tol && 
    t.x <= pkgZone.x + pkgZone.w + tol &&
    t.y >= pkgZone.y - tol && 
    t.y <= pkgZone.y + pkgZone.h + tol
  );

  if (pkgTokens.length === 0) return { packageInfo: null };

  // Intentamos reconstruir el texto probando dos órdenes (por si está rotado 90º o es normal)
  // 1. Orden normal (X luego Y)
  const normalText = [...pkgTokens].sort((a, b) => a.x - b.x || b.y - a.y).map(t => t.text).join(" ");
  const resultNormal = cleanPackageInfo(normalText);
  if (resultNormal) return { packageInfo: resultNormal };

  // 2. Orden vertical (Y luego X) - Típico de etiquetas rotadas
  const verticalText = [...pkgTokens].sort((a, b) => b.y - a.y || a.x - b.x).map(t => t.text).join(" ");
  const resultVertical = cleanPackageInfo(verticalText);
  
  return { packageInfo: resultVertical };
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
