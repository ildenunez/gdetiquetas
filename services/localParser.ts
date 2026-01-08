
import { MuelleData, RawToken } from '../types';

export const tokenizeText = (text: string): RawToken[] => {
  const tokens: RawToken[] = [];
  if (!text) return tokens;
  
  const lines = text.split('\n');
  lines.forEach((line, lIdx) => {
    // Dividimos por espacios pero mantenemos información de posición
    const lineTokens = line.trim().split(/\s+/);
    lineTokens.forEach((t, tIdx) => {
      // Limpiamos solo caracteres muy extraños, mantenemos alfanuméricos y separadores comunes
      const cleanT = t.trim().replace(/[^a-zA-Z0-9\-\/\.]/g, '');
      if (cleanT.length >= 3) {
        tokens.push({
          text: cleanT.toUpperCase(),
          lineIndex: lIdx,
          tokenIndex: tIdx
        });
      }
    });
  });
  
  return tokens;
};

export const parseAmazonLabelLocal = (text: string): { amazonRef: string | null; packageInfo: string | null } => {
  if (!text) return { amazonRef: null, packageInfo: null };
  const t = text.toUpperCase();
  
  const fbaMatch = t.match(/\b(FBA[A-Z0-9]+)\b/);
  const shipmentMatch = t.match(/\b(SHIPMENT[A-Z0-9]+)\b/);
  const genericMatch = t.match(/\b([A-Z0-9]{12,})\b/);

  const amazonRef = fbaMatch ? fbaMatch[1] : (shipmentMatch ? shipmentMatch[1] : (genericMatch ? genericMatch[1] : null));
  const packageMatch = t.match(/\b(\d+)\s*[\/\-]\s*(\d+)\b/) || t.match(/\b(\d+)\s+OF\s+(\d+)\b/);

  return {
    amazonRef: amazonRef,
    packageInfo: packageMatch ? packageMatch[0].replace(/\s+OF\s+/i, '/') : null
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

export const extractByPattern = (allTokens: RawToken[], orderToken: RawToken, refToken: RawToken): MuelleData[] => {
  const results: MuelleData[] = [];
  const offsetLine = refToken.lineIndex - orderToken.lineIndex;
  const offsetToken = refToken.tokenIndex - orderToken.tokenIndex;

  const linesMap: Record<number, RawToken[]> = {};
  allTokens.forEach(t => {
    if (!linesMap[t.lineIndex]) linesMap[t.lineIndex] = [];
    linesMap[t.lineIndex].push(t);
  });

  const processedLines = new Set<number>();
  allTokens.forEach(t => {
    // Si el token parece un número de pedido (6-9 dígitos)
    if (/^\d{6,9}$/.test(t.text) && !processedLines.has(t.lineIndex)) {
      const targetLineIdx = t.lineIndex + offsetLine;
      const targetLine = linesMap[targetLineIdx];
      
      if (targetLine) {
        // Buscamos un token que no sea el mismo pedido y tenga longitud de referencia
        const possibleRef = targetLine.find(rt => 
          rt.text.length >= 8 && rt.text !== t.text
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
