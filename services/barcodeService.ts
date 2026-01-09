
declare const ZXing: any;

export interface BarcodeResult {
  text: string;
  format: string;
  debugImage?: string; 
  charImages?: string[];
  parsedData?: {
    ref: string;
    seq: number;
  };
}

interface CropArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type OCRFilterType = 'high-contrast' | 'inverted' | 'bold' | 'ultra-sharp' | 'clean-bg' | 'raw' | 'grayscale' | 'threshold';

/**
 * Extrae la referencia de Amazon y el bulto del DataMatrix:
 * - Ref: caracteres 2 al 10 (9 caracteres) -> Índices 1 al 10
 * - Seq: caracteres 12 al 14 (Número de bulto actual) -> Índices 11 al 14
 */
export const extractAmazonRefFromBarcode = (text: string): { ref: string; seq: number } | null => {
  if (!text || text.length < 10) return null;
  
  // Ref: caracteres 2 al 10
  const ref = text.substring(1, 10).toUpperCase();
  
  // Seq: caracteres 12 al 14 (indica qué bulto es: 001, 002...)
  let seq = 1;
  if (text.length >= 14) {
    const seqStr = text.substring(11, 14);
    const parsedSeq = parseInt(seqStr, 10);
    if (!isNaN(parsedSeq)) seq = parsedSeq;
  }
  
  return { ref, seq };
};

export async function cropImage(url: string, area: CropArea, rotation: number = 0, filter: OCRFilterType = 'ultra-sharp'): Promise<string | { strip: string, chars: string[] }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const is90Or270 = rotation === 90 || rotation === 270;
      const rotW = is90Or270 ? img.height : img.width;
      const rotH = is90Or270 ? img.width : img.height;
      
      const rotatedCanvas = document.createElement('canvas');
      rotatedCanvas.width = rotW;
      rotatedCanvas.height = rotH;
      const rCtx = rotatedCanvas.getContext('2d');
      if (!rCtx) return resolve(url);

      rCtx.fillStyle = 'white';
      rCtx.fillRect(0, 0, rotW, rotH);

      rCtx.translate(rotW / 2, rotH / 2);
      rCtx.rotate((rotation * Math.PI) / 180);
      rCtx.drawImage(img, -img.width / 2, -img.height / 2);

      const realX = area.x * rotW;
      const realY = area.y * rotH;
      const realW = area.w * rotW;
      const realH = area.h * rotH;

      const scale = 3.0; 
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = realW * scale;
      finalCanvas.height = realH * scale;
      const fCtx = finalCanvas.getContext('2d');
      
      if (fCtx) {
        fCtx.fillStyle = 'white';
        fCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        fCtx.imageSmoothingEnabled = true;
        fCtx.imageSmoothingQuality = 'high';
        fCtx.drawImage(rotatedCanvas, realX, realY, realW, realH, 0, 0, finalCanvas.width, finalCanvas.height);
        
        if (filter === 'grayscale') {
          fCtx.filter = 'grayscale(100%) contrast(150%)';
          fCtx.drawImage(finalCanvas, 0, 0);
          resolve(finalCanvas.toDataURL('image/png'));
        } else if (filter === 'high-contrast') {
          fCtx.filter = 'contrast(300%) grayscale(100%) brightness(110%)';
          fCtx.drawImage(finalCanvas, 0, 0);
          resolve(finalCanvas.toDataURL('image/png'));
        } else if (filter === 'threshold') {
          // Umbral binario puro para códigos difíciles
          const imgData = fCtx.getImageData(0,0, finalCanvas.width, finalCanvas.height);
          const data = imgData.data;
          for(let i=0; i<data.length; i+=4) {
            const avg = (data[i]+data[i+1]+data[i+2])/3;
            const v = avg < 128 ? 0 : 255;
            data[i] = data[i+1] = data[i+2] = v;
          }
          fCtx.putImageData(imgData, 0, 0);
          resolve(finalCanvas.toDataURL('image/png'));
        } else if (filter !== 'raw') {
            const result = expandAndSliceCharacters(fCtx, finalCanvas);
            if (result.chars.length === 0) {
              resolve(finalCanvas.toDataURL('image/png'));
            } else {
              resolve(result);
            }
        } else {
            resolve(finalCanvas.toDataURL('image/png'));
        }
      } else resolve(url);
    };
    img.src = url;
  });
}

function expandAndSliceCharacters(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): { strip: string, chars: string[] } {
  const { width, height } = canvas;
  ctx.filter = 'contrast(300%) grayscale(100%) brightness(105%)';
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i+1] + data[i+2]) / 3;
    const v = avg < 140 ? 0 : 255;
    data[i] = data[i+1] = data[i+2] = v;
    data[i+3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  const glyphs: { x: number, y: number, w: number, h: number }[] = [];
  let inGlyph = false;
  let startX = 0;

  const hasColInk = new Array(width).fill(false);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (data[(y * width + x) * 4] === 0) {
        hasColInk[x] = true;
        break;
      }
    }
  }

  for (let x = 0; x < width; x++) {
    if (hasColInk[x] && !inGlyph) {
      inGlyph = true; startX = x;
    } else if (!hasColInk[x] && inGlyph) {
      inGlyph = false;
      const w = x - startX;
      if (w > 1) {
        let minY = height, maxY = 0;
        for (let ix = startX; ix < x; ix++) {
          for (let iy = 0; iy < height; iy++) {
            if (data[(iy * width + ix) * 4] === 0) {
              if (iy < minY) minY = iy;
              if (iy > maxY) maxY = iy;
            }
          }
        }
        if (maxY > minY) glyphs.push({ x: startX, y: minY, w: w, h: maxY - minY + 1 });
      }
    }
  }

  const targetH = 64; 
  const padding = 20;
  const margin = 32;
  const charImages: string[] = [];
  
  if (glyphs.length === 0) return { strip: canvas.toDataURL(), chars: [] };

  const totalW = glyphs.reduce((acc, g) => acc + (g.w * (targetH / g.h)), 0) + (glyphs.length * padding) + (margin * 2);
  const outCanvas = document.createElement('canvas');
  outCanvas.width = Math.max(100, totalW);
  outCanvas.height = targetH + (margin * 2);
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return { strip: canvas.toDataURL(), chars: [] };

  outCtx.fillStyle = 'white';
  outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);

  let curX = margin;
  glyphs.forEach(g => {
    const drawW = Math.max(12, g.w * (targetH / g.h));
    const charCanvas = document.createElement('canvas');
    charCanvas.width = drawW + 40;
    charCanvas.height = targetH + 40;
    const cCtx = charCanvas.getContext('2d');
    if (cCtx) {
        cCtx.fillStyle = 'white';
        cCtx.fillRect(0, 0, charCanvas.width, charCanvas.height);
        cCtx.drawImage(canvas, g.x, g.y, g.w, g.h, 20, 20, drawW, targetH);
        charImages.push(charCanvas.toDataURL('image/png'));
    }
    outCtx.drawImage(canvas, g.x, g.y, g.w, g.h, curX, margin, drawW, targetH);
    curX += drawW + padding;
  });

  return { strip: outCanvas.toDataURL('image/png'), chars: charImages };
}

export const scanDataMatrix = async (imageUrl: string, crop?: CropArea, rotation: number = 0): Promise<BarcodeResult | null> => {
  const reader = new ZXing.BrowserMultiFormatReader();
  
  // Lista exhaustiva de filtros para asegurar lectura
  const filters: OCRFilterType[] = ['grayscale', 'high-contrast', 'threshold', 'raw'];

  for (const filter of filters) {
    const res = crop ? await cropImage(imageUrl, { x: crop.x, y: crop.y, w: crop.w, h: crop.h }, rotation, filter) : imageUrl;
    const sourceUrl = typeof res === 'string' ? res : res.strip;
    
    try {
      const result = await reader.decodeFromImageUrl(sourceUrl);
      if (result && result.text) {
        const parsed = extractAmazonRefFromBarcode(result.text);
        return { 
          text: result.text, 
          format: result.format.toString(), 
          debugImage: sourceUrl, 
          parsedData: parsed || undefined
        };
      }
    } catch (e) {
      continue;
    }
  }
  return null;
};
