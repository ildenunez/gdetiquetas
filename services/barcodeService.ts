
declare const ZXing: any;

export interface BarcodeResult {
  text: string;
  format: string;
  debugImage?: string; 
}

interface CropArea {
  x: number; // 0-1
  y: number; // 0-1
  w: number; // 0-1
  h: number; // 0-1
}

/**
 * Recorta un área de la imagen basada en porcentajes 0-1
 */
export async function cropImage(url: string, area: CropArea): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Añadimos un pequeño margen de seguridad
      const margin = 0.02;
      const x = Math.max(0, area.x - margin) * img.width;
      const y = Math.max(0, area.y - margin) * img.height;
      const w = Math.min(1, area.w + margin * 2) * img.width;
      const h = Math.min(1, area.h + margin * 2) * img.height;

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      } else resolve(url);
    };
    img.src = url;
  });
}

/**
 * Escanea un DataMatrix, permitiendo recortar un área específica de la imagen original
 */
export const scanDataMatrix = async (imageUrl: string, crop?: CropArea): Promise<BarcodeResult | null> => {
  const reader = new ZXing.BrowserDatamatrixCodeReader();
  
  const sourceUrl = crop ? await cropImage(imageUrl, crop) : imageUrl;
  
  const strategies = [
    { name: 'Original/Recorte', filter: null },
    { name: 'Nitidez Extrema', filter: sharpenAndContrast },
    { name: 'Binarización ISO', filter: aggressiveBinarization },
    { name: 'Inversión Táctica', filter: invertColors }
  ];

  for (const strategy of strategies) {
    try {
      const processedUrl = strategy.filter 
        ? await applyFilter(sourceUrl, strategy.filter)
        : sourceUrl;
        
      const result = await reader.decodeFromImageUrl(processedUrl);
      if (result && result.text) {
        return { 
          text: result.text, 
          format: 'DATA_MATRIX',
          debugImage: processedUrl 
        };
      }
    } catch (e) {
    }
  }

  return null;
};

async function applyFilter(url: string, filterFn: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        filterFn(ctx, canvas);
        resolve(canvas.toDataURL('image/png'));
      } else resolve(url);
    };
    img.src = url;
  });
}

function sharpenAndContrast(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const weights = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const side = 3;
  const halfSide = 1;
  const output = ctx.createImageData(canvas.width, canvas.height);
  const dst = output.data;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const dstOff = (y * canvas.width + x) * 4;
      let r = 0, g = 0, b = 0;
      for (let cy = 0; cy < side; cy++) {
        for (let cx = 0; cx < side; cx++) {
          const scy = y + cy - halfSide;
          const scx = x + cx - halfSide;
          if (scy >= 0 && scy < canvas.height && scx >= 0 && scx < canvas.width) {
            const srcOff = (scy * canvas.width + scx) * 4;
            const wt = weights[cy * side + cx];
            r += data[srcOff] * wt;
            g += data[srcOff + 1] * wt;
            b += data[srcOff + 2] * wt;
          }
        }
      }
      const gray = (r + g + b) / 3;
      const val = gray > 120 ? 255 : 0;
      dst[dstOff] = dst[dstOff+1] = dst[dstOff+2] = val;
      dst[dstOff+3] = 255;
    }
  }
  ctx.putImageData(output, 0, 0);
}

function aggressiveBinarization(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = data[i+1] = data[i+2] = avg > 110 ? 255 : 0;
  }
  ctx.putImageData(imgData, 0, 0);
}

function invertColors(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i+1] = 255 - data[i+1];
    data[i+2] = 255 - data[i+2];
  }
  ctx.putImageData(imgData, 0, 0);
}

export const extractAmazonRefFromBarcode = (barcodeText: string): string | null => {
  if (!barcodeText || barcodeText.length < 10) return null;
  const cleanStart = barcodeText.trim();
  const result = cleanStart.substring(1, 10);
  return result.toUpperCase();
};
