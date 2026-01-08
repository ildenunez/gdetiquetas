
import { MuelleData, RawToken } from '../types';

export const tokenizeText = (text: string): RawToken[] => {
  const tokens: RawToken[] = [];
  const lines = text.split('\n');
  
  lines.forEach((line, lIdx) => {
    const lineTokens = line.trim().split(/\s+/);
    lineTokens.forEach((t, tIdx) => {
      if (t.length > 2) {
        tokens.push({
          text: t.replace(/[^A-Z0-9\-\/]/gi, ''),
          lineIndex: lIdx,
          tokenIndex: tIdx
        });
      }
    });
  });
  
  return tokens;
};

// Fix: Added missing export parseAmazonLabelLocal to resolve App.tsx import error
export const parseAmazonLabelLocal = (text: string): { amazonRef: string | null; packageInfo: string | null } => {
  if (!text) return { amazonRef: null, packageInfo: null };
  
  // Patterns for Amazon Reference IDs (FBA prefix or long alphanumeric strings)
  const fbaMatch = text.match(/\b(FBA[A-Z0-9]+)\b/i);
  const shipmentMatch = text.match(/\b(SHIPMENT[A-Z0-9]+)\b/i);
  const genericMatch = text.match(/\b([A-Z0-9]{10,})\b/);

  const amazonRef = fbaMatch ? fbaMatch[1] : (shipmentMatch ? shipmentMatch[1] : (genericMatch ? genericMatch[1] : null));
  
  // Package info like 1/2, 2/2, 1 of 1
  const packageMatch = text.match(/\b(\d+)\s*[\/\-]\s*(\d+)\b/) || text.match(/\b(\d+)\s+of\s+(\d+)\b/i);

  return {
    amazonRef: amazonRef ? amazonRef.toUpperCase() : null,
    packageInfo: packageMatch ? packageMatch[0].replace(/\s+of\s+/i, '/') : null
  };
};

export const parseMuelleTextLocal = (text: string): MuelleData[] => {
  const data: MuelleData[] = [];
  if (!text) return data;

  const lines = text.split('\n');
  lines.forEach(line => {
    const cleanLine = line.toUpperCase().replace(/[^A-Z0-9\s\-\/]/g, ' ');
    const orderMatch = cleanLine.match(/\b(\d{6,9})\b/);
    const refMatch = cleanLine.match(/\b(FBA|EBA|F8A|F6A|SHIPMENT|[A-Z0-9]{10,})\b/i);

    if (orderMatch && refMatch) {
      data.push({
        orderNumber: orderMatch[1],
        amazonRef: refMatch[1]
      });
    }
  });
  return data;
};

/**
 * Esta función toma una pista (un par pedido/ref) y busca patrones similares en el resto del texto
 */
export const extractByPattern = (allTokens: RawToken[], orderToken: RawToken, refToken: RawToken): MuelleData[] => {
  const results: MuelleData[] = [];
  const offsetLine = refToken.lineIndex - orderToken.lineIndex;
  const offsetToken = refToken.tokenIndex - orderToken.tokenIndex;

  // Agrupamos tokens por línea para facilitar la búsqueda
  const linesMap: Record<number, RawToken[]> = {};
  allTokens.forEach(t => {
    if (!linesMap[t.lineIndex]) linesMap[t.lineIndex] = [];
    linesMap[t.lineIndex].push(t);
  });

  const processedLines = new Set<number>();

  allTokens.forEach(t => {
    // Si este token se parece a un número de pedido (ej. 6-9 dígitos)
    if (/^\d{6,9}$/.test(t.text) && !processedLines.has(t.lineIndex)) {
      const targetLineIdx = t.lineIndex + offsetLine;
      const targetLine = linesMap[targetLineIdx];
      
      if (targetLine) {
        // Buscamos un token en la línea objetivo que cumpla el patrón de referencia
        const possibleRef = targetLine.find(rt => 
          (rt.text.length >= 8 && rt.text !== t.text)
        );

        if (possibleRef) {
          results.push({
            orderNumber: t.text,
            amazonRef: possibleRef.text
          });
          processedLines.add(t.lineIndex);
        }
      }
    }
  });

  return results;
};
