
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
 * Extrae la referencia de Amazon y el índice de bulto del código leído.
 * Se ha mejorado para detectar referencias en etiquetas UPS (que a veces usan el Nº Pedido en el código).
 */
export const extractAmazonRefFromBarcode = (text: string): { ref: string; seq: number; totalFromBarcode?: number } | null => {
  if (!text) return null;
  
  const cleanedText = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();

  // 1. Formato Amazon (DataMatrix que empieza por S)
  if (cleanedText.startsWith('S') && cleanedText.length >= 15) {
    const ref = cleanedText.substring(1, 10).toUpperCase(); 
    const seqStr = cleanedText.substring(12, 15); 
    const seq = parseInt(seqStr, 10);
    
    return { 
      ref, 
      seq: !isNaN(seq) ? seq : 1
    };
  }

  // 2. Formato FBA / X00 directo
  const fbaMatch = cleanedText.match(/(FBA[A-Z0-9]{6,12})|(X00[A-Z0-9]{6,12})/i);
  if (fbaMatch) return { ref: fbaMatch[0].toUpperCase(), seq: 1 };

  // 3. Búsqueda de palabras de 8 o 9 caracteres (Ref. Cliente o Nº Pedido)
  // Esto ayuda en etiquetas UPS/SEUR donde el código contiene el pedido.
  const words = cleanedText.split(/[^A-Za-z0-9]/);
  for (const word of words) {
    // Si es longitud 9 y mezcla letras/números (Ref Cliente)
    if (word.length === 9 && /[A-Za-z]/.test(word) && /[0-9]/.test(word)) {
      return { ref: word.toUpperCase(), seq: 1 };
    }
    // Si es longitud 8 y son solo números (Nº Pedido habitual)
    if (word.length === 8 && /^\d+$/.test(word)) {
      return { ref: word, seq: 1 };
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
        fCtx.drawImage(rotatedCanvas, realX, realY, realW, realH, 0, 0, finalCanvas.width, finalCanvas.height);
        
        if (filter === 'grayscale') {
          fCtx.filter = 'grayscale(100%) contrast(150%)';
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
            resolve(result.chars.length === 0 ? finalCanvas.toDataURL('image/png') : result);
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
  ctx.filter = 'contrast(300%) grayscale(100%)';
  ctx.drawImage(canvas, 0, 0);
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
    if (hasColInk[x] && !inGlyph) { inGlyph = true; startX = x; }
    else if (!hasColInk[x] && inGlyph) {
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
  const charImages: string[] = [];
  if (glyphs.length === 0) return { strip: canvas.toDataURL(), chars: [] };
  const outCanvas = document.createElement('canvas');
  outCanvas.width = width; outCanvas.height = targetH + 40;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return { strip: canvas.toDataURL(), chars: [] };
  outCtx.fillStyle = 'white'; outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
  glyphs.forEach(g => {
    const charCanvas = document.createElement('canvas');
    charCanvas.width = g.w + 20; charCanvas.height = targetH + 20;
    const cCtx = charCanvas.getContext('2d');
    if (cCtx) {
        cCtx.fillStyle = 'white'; cCtx.fillRect(0, 0, charCanvas.width, charCanvas.height);
        cCtx.drawImage(canvas, g.x, g.y, g.w, g.h, 10, 10, g.w, targetH);
        charImages.push(charCanvas.toDataURL('image/png'));
    }
  });
  return { strip: canvas.toDataURL('image/png'), chars: charImages };
}

export const scanDataMatrix = async (imageUrl: string, crop?: CropArea, rotation: number = 0): Promise<BarcodeResult | null> => {
  const reader = new ZXing.BrowserMultiFormatReader();
  const filters: OCRFilterType[] = ['raw', 'high-contrast', 'threshold'];
  for (const filter of filters) {
    const res = crop ? await cropImage(imageUrl, { x: crop.x, y: crop.y, w: crop.w, h: crop.h }, rotation, filter) : imageUrl;
    const sourceUrl = typeof res === 'string' ? res : res.strip;
    try {
      const result = await reader.decodeFromImageUrl(sourceUrl);
      if (result && result.text) {
        const parsed = extractAmazonRefFromBarcode(result.text);
        return { text: result.text, format: result.format.toString(), debugImage: sourceUrl, parsedData: parsed || undefined };
      }
    } catch (e) { }
  }
  return null;
};
