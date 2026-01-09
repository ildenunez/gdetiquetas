
declare const ZXing: any;

export interface BarcodeResult {
  text: string;
  format: string;
  debugImage?: string; 
  charImages?: string[];
}

interface CropArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type OCRFilterType = 'high-contrast' | 'inverted' | 'bold' | 'ultra-sharp' | 'clean-bg' | 'raw';

/**
 * Intenta extraer una referencia de Amazon (FBA..., X00..., etc) de un texto de código de barras.
 */
export const extractAmazonRefFromBarcode = (text: string): string | null => {
  if (!text) return null;
  
  const fbaMatch = text.match(/FBA[A-Z0-9]+/i);
  if (fbaMatch) return fbaMatch[0];

  const xMatch = text.match(/X00[A-Z0-9]+/i);
  if (xMatch) return xMatch[0];

  return text.trim();
};

export async function cropImage(url: string, area: CropArea, rotation: number = 0, filter: OCRFilterType = 'ultra-sharp'): Promise<string | { strip: string, chars: string[] }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const is90Or270 = rotation === 90 || rotation === 270;
      // El canvas rotado contiene la imagen completa girada
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

      // Mapeo directo de coordenadas relativas (0-1) al canvas rotado
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
        
        if (filter !== 'raw') {
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
  const res = crop ? await cropImage(imageUrl, crop, rotation, 'high-contrast') : imageUrl;
  
  const sourceUrl = typeof res === 'string' ? res : res.strip;
  const charImages = typeof res === 'string' ? undefined : res.chars;

  try {
    const result = await reader.decodeFromImageUrl(sourceUrl);
    if (result && result.text) {
      return { text: result.text, format: result.format.toString(), debugImage: sourceUrl, charImages };
    }
  } catch (e) {}
  return null;
};
