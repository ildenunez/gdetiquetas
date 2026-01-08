
declare const Tesseract: any;

export interface OCRProgress {
  status: string;
  progress: number;
}

let sharedWorker: any = null;
let initializationPromise: Promise<any> | null = null;

async function getWorker() {
  if (sharedWorker) return sharedWorker;
  
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    const worker = await Tesseract.createWorker('eng', 1);
    // Configuración para velocidad máxima: solo números y barra
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789/',
      tessedit_pageseg_mode: '7', // Tratar como una sola línea de texto
    });
    sharedWorker = worker;
    return worker;
  })();

  return initializationPromise;
}

export const performLocalOCR = async (
  imageUrl: string, 
  onProgress?: (p: OCRProgress) => void
): Promise<string> => {
  try {
    const worker = await getWorker();
    const { data: { text } } = await worker.recognize(imageUrl);
    return text || "";
  } catch (error) {
    console.error("Error crítico en el motor OCR:", error);
    return "";
  }
};

export const terminateOCR = async () => {
  if (sharedWorker) {
    await sharedWorker.terminate();
    sharedWorker = null;
    initializationPromise = null;
  }
};
