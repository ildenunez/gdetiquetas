
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
 * Motor de limpieza de bultos: Optimizado para procesar resultados de OCR localizado (números puros)
 */
export const cleanPackageInfo = (text: string): string | null => {
  if (!text) return null;
  
  // Limpiamos todo lo que no sea número o barra
  let t = text.trim().replace(/[^0-9\/]/g, ' ').replace(/\s+/g, ' ').trim();

  // Si el OCR leyó algo como "1 2" en lugar de "1/2"
  const parts = t.split(/[\s\/]/).filter(p => p.length > 0);
  
  if (parts.length >= 2) {
    const current = parseInt(parts[0]);
    const total = parseInt(parts[1]);
    if (current <= total && total < 1000 && current > 0) {
      return `${current}/${total}`;
    }
  }

  // Intento de regex estándar
  const match = t.match(/(\d+)\/(\d+)/);
  if (match) {
    const c = parseInt(match[1]);
    const tot = parseInt(match[2]);
    if (c <= tot && tot < 1000) return `${c}/${tot}`;
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

  if (!rules.pkgArea || rules.pkgArea.w < 0.01) return { packageInfo: null };

  const pkgZone = {
    x: rules.pkgArea.x * PAGE_W,
    y: (1 - rules.pkgArea.y - rules.pkgArea.h) * PAGE_H,
    w: rules.pkgArea.w * PAGE_W,
    h: rules.pkgArea.h * PAGE_H
  };

  const tol = 15; 
  const pkgTokens = tokens.filter(t => 
    t.x >= pkgZone.x - tol && 
    t.x <= pkgZone.x + pkgZone.w + tol &&
    t.y >= pkgZone.y - tol && 
    t.y <= pkgZone.y + pkgZone.h + tol
  );

  if (pkgTokens.length === 0) return { packageInfo: null };

  const reconstructedText = [...pkgTokens]
    .sort((a, b) => {
      if (Math.abs(a.y - b.y) < 5) return a.x - b.x;
      return b.y - a.y;
    })
    .map(t => t.text)
    .join("/");

  return { packageInfo: cleanPackageInfo(reconstructedText) };
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
