
declare const Tesseract: any;

export interface OCRProgress {
  status: string;
  progress: number;
}

export interface OCRToken {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

let sharedWorker: any = null;
let initializationPromise: Promise<any> | null = null;

async function getWorker(mode: 'line' | 'page' = 'line') {
  if (sharedWorker) {
    // Si cambiamos de modo, reseteamos el worker para aplicar nuevos parámetros
    await sharedWorker.terminate();
    sharedWorker = null;
  }

  const worker = await Tesseract.createWorker('eng');
  await worker.setParameters({
    tessedit_pageseg_mode: mode === 'line' ? '7' : '3', // 7 para una línea, 3 para página completa
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._/ ',
  });
  sharedWorker = worker;
  return worker;
}

export const performLocalOCR = async (imageUrl: string): Promise<string> => {
  try {
    const worker = await getWorker('line');
    const { data: { text } } = await worker.recognize(imageUrl);
    return text.replace(/[\n\r]/g, ' ').trim().toUpperCase() || "";
  } catch (error) {
    console.error("Error en OCR:", error);
    return "";
  }
};

/**
 * Escanea una página entera y devuelve tokens con coordenadas.
 * Útil para PDFs que son solo imágenes.
 */
export const performFullPageOCR = async (imageUrl: string): Promise<OCRToken[]> => {
  try {
    const worker = await getWorker('page');
    const { data } = await worker.recognize(imageUrl);
    
    return data.words.map((word: any) => ({
      text: word.text.toUpperCase(),
      x: word.bbox.x0,
      y: word.bbox.y0,
      width: word.bbox.x1 - word.bbox.x0,
      height: word.bbox.y1 - word.bbox.y0
    }));
  } catch (error) {
    console.error("Error en Full OCR:", error);
    return [];
  }
};

export const terminateOCR = async () => {
  if (sharedWorker) {
    await sharedWorker.terminate();
    sharedWorker = null;
    initializationPromise = null;
  }
};
