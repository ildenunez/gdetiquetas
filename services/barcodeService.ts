
declare const ZXing: any;

export interface BarcodeResult {
  text: string;
  format: string;
  debugImage?: string; 
  charImages?: string[];
  parsedData?: {
    ref: string;
    seq: number;
    totalFromBarcode?: number;
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
 * Extrae la referencia de Amazon y bultos del contenido del DataMatrix.
 * Formato específico solicitado:
 * - Si empieza por S: Ref = caracteres en posiciones 1 a 9 (omitiendo la S en pos 0).
 * - Bultos = caracteres en posiciones 12, 13 y 14.
 */
export const extractAmazonRefFromBarcode = (text: string): { ref: string; seq: number; totalFromBarcode?: number } | null => {
  if (!text) return null;
  
  // Limpiamos caracteres de control GS (0x1D) y otros habituales en DataMatrix
  const cleanedText = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

  // Lógica específica para Seur/Ontime con prefijo 'S'
  if (cleanedText.startsWith('S') && cleanedText.length >= 15) {
    const ref = cleanedText.substring(1, 10).toUpperCase(); // Posiciones 1 a 10 (9 caracteres)
    const bultosStr = cleanedText.substring(12, 15); // Posiciones 12 a 15 (caracteres 12, 13, 14)
    const total = parseInt(bultosStr, 10);
    
    return { 
      ref, 
      seq: 1, 
      totalFromBarcode: !isNaN(total) ? total : undefined 
    };
  }

  // Fallback para otros formatos (FBA/X00)
  const fbaMatch = cleanedText.match(/(FBA[A-Z0-9]{6,10})|(X00[A-Z0-9]{6,10})/i);
  if (fbaMatch) {
    return { ref: fbaMatch[0].toUpperCase(), seq: 1 };
  }

  // Fallback genérico de 9 caracteres alfanuméricos
  const words = cleanedText.split(/[^A-Za-z0-9]/);
  for (const word of words) {
    if (word.length === 9 && /[A-Za-z]/.test(word) && /[0-9]/.test(word)) {
      return { ref: word.toUpperCase(), seq: 1 };
    }
  }

  return null;
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
          fCtx.filter = 'contrast(350%) grayscale(100%) brightness(110%)';
          fCtx.drawImage(finalCanvas, 0, 0);
          resolve(finalCanvas.toDataURL('image/png'));
        } else if (filter === 'threshold') {
          const imgData = fCtx.getImageData(0,0, finalCanvas.width, finalCanvas.height);
          const data = imgData.data;
          for(let i=0; i<data.length; i+=4) {
            const avg = (data[i]+data[i+1]+data[i+2])/3;
            const v = avg < 120 ? 0 : 255;
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
  const filters: OCRFilterType[] = ['raw', 'high-contrast', 'grayscale', 'threshold'];

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
    } catch (e) { }
  }
  return null;
};
