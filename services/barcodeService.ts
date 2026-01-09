
declare const ZXing: any;

export interface BarcodeResult {
  text: string;
  format: string;
  debugImage?: string; 
}

interface CropArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

type OCRFilterType = 'high-contrast' | 'inverted' | 'bold' | 'ultra-sharp' | 'clean-bg';

/**
 * Detecta el área útil de una imagen (donde hay contenido) ignorando los bordes blancos/vacíos.
 */
export async function detectContentArea(imageUrl: string): Promise<CropArea> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve({ x: 0, y: 0, w: 1, h: 1 });
      
      canvas.width = 200; // Baja resolución para análisis rápido
      canvas.height = Math.round(200 * (img.height / img.width));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      let found = false;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          // Si el píxel no es blanco (o muy cercano al blanco)
          if (data[i] < 240 || data[i+1] < 240 || data[i+2] < 240) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            found = true;
          }
        }
      }

      if (!found) return resolve({ x: 0, y: 0, w: 1, h: 1 });

      // Añadimos un pequeño margen
      const padding = 2;
      resolve({
        x: Math.max(0, (minX - padding) / canvas.width),
        y: Math.max(0, (minY - padding) / canvas.height),
        w: Math.min(1, (maxX - minX + padding * 2) / canvas.width),
        h: Math.min(1, (maxY - minY + padding * 2) / canvas.height)
      });
    };
    img.src = imageUrl;
  });
}

export async function cropImage(url: string, area: CropArea, rotation: number = 0, filter: OCRFilterType = 'high-contrast'): Promise<string> {
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

      rCtx.translate(rotW / 2, rotH / 2);
      rCtx.rotate((rotation * Math.PI) / 180);
      rCtx.drawImage(img, -img.width / 2, -img.height / 2);

      const realX = area.x * rotW;
      const realY = area.y * rotH;
      const realW = area.w * rotW;
      const realH = area.h * rotH;

      const scale = 4.0; 
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = realW * scale;
      finalCanvas.height = realH * scale;
      const fCtx = finalCanvas.getContext('2d');
      
      if (fCtx) {
        fCtx.imageSmoothingEnabled = true;
        fCtx.drawImage(rotatedCanvas, realX, realY, realW, realH, 0, 0, finalCanvas.width, finalCanvas.height);
        applyMorphologicalFilters(fCtx, finalCanvas, filter);
        resolve(finalCanvas.toDataURL('image/png', 1.0));
      } else resolve(url);
    };
    img.src = url;
  });
}

function applyMorphologicalFilters(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, filter: OCRFilterType) {
  const { width, height } = canvas;
  let imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    let gray = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
    if (filter === 'inverted') gray = 255 - gray;
    data[i] = data[i+1] = data[i+2] = gray;
  }

  const contrast = 70;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = factor * (data[i] - 128) + 128;
    data[i+1] = factor * (data[i+1] - 128) + 128;
    data[i+2] = factor * (data[i+2] - 128) + 128;
  }

  const threshold = 170;
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i];
    const color = v < threshold ? 0 : 255;
    data[i] = data[i+1] = data[i+2] = color;
  }
  
  ctx.putImageData(imageData, 0, 0);
}

export const scanDataMatrix = async (imageUrl: string, crop?: CropArea, rotation: number = 0): Promise<BarcodeResult | null> => {
  const reader = new ZXing.BrowserMultiFormatReader();
  const filters: OCRFilterType[] = ['high-contrast', 'ultra-sharp'];
  
  for (const filter of filters) {
    const sourceUrl = crop ? await cropImage(imageUrl, crop, rotation, filter) : imageUrl;
    try {
      const result = await reader.decodeFromImageUrl(sourceUrl);
      if (result && result.text) {
        return { text: result.text, format: result.format.toString(), debugImage: sourceUrl };
      }
    } catch (e) {}
  }
  return null;
};

export const extractAmazonRefFromBarcode = (barcodeText: string): string | null => {
  if (!barcodeText || barcodeText.length < 5) return null;
  return barcodeText.toUpperCase().trim();
};
