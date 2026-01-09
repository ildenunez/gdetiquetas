
declare const Tesseract: any;

export interface OCRToken {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

let sharedWorker: any = null;

async function getWorker() {
  if (sharedWorker) return sharedWorker;

  // Cargamos el worker con el motor más simple posible
  const worker = await Tesseract.createWorker('eng', 1, {
    workerPath: 'https://unpkg.com/tesseract.js@v5.0.5/dist/worker.min.js',
    corePath: 'https://unpkg.com/tesseract.js-core@v5.0.0/tesseract-core.wasm.js',
  });
  
  await worker.setParameters({
    // Lista blanca estricta de caracteres de Amazon
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-',
    // Desactivamos diccionarios para que no intente "corregir" palabras
    load_system_dawg: '0',
    load_freq_dawg: '0',
    load_unambig_dawg: '0',
    load_punc_dawg: '0',
    load_number_dawg: '0',
    load_fixed_length_dawgs: '0',
    load_bigram_dawg: '0',
    wordrec_enable_assoc: '0',
    // Parámetros de nitidez
    textord_heavy_nr: '1',
    tessedit_pageseg_mode: '7', // Tratar como una línea de texto
  });
  
  sharedWorker = worker;
  return worker;
}

// Fix: added missing performLocalOCR export
/**
 * Realiza OCR sobre una imagen completa o recorte devolviendo el texto bruto.
 */
export const performLocalOCR = async (imageUrl: string): Promise<string> => {
  try {
    const worker = await getWorker();
    const { data: { text } } = await worker.recognize(imageUrl);
    return text;
  } catch (error) {
    console.error("Error en local OCR:", error);
    return "";
  }
};

// Fix: added missing performFullPageOCR export
/**
 * Realiza OCR sobre una página completa devolviendo una lista de tokens con posición.
 */
export const performFullPageOCR = async (imageUrl: string): Promise<OCRToken[]> => {
  try {
    const worker = await getWorker();
    // Para página completa usamos segmentación automática
    await worker.setParameters({
      tessedit_pageseg_mode: '1', 
    });
    const { data: { words } } = await worker.recognize(imageUrl);
    return words.map((w: any) => ({
      text: w.text,
      x: w.bbox.x0,
      y: w.bbox.y0,
      width: w.bbox.x1 - w.bbox.x0,
      height: w.bbox.y1 - w.bbox.y0
    }));
  } catch (error) {
    console.error("Error en full page OCR:", error);
    return [];
  }
};

/**
 * Realiza múltiples lecturas con diferentes configuraciones para maximizar éxito
 */
export const performMultiPassOCR = async (imageUrl: string): Promise<string[]> => {
  try {
    const worker = await getWorker();
    const results: string[] = [];
    
    // Pase 1: Modo línea (estándar)
    await worker.setParameters({ tessedit_pageseg_mode: '7' });
    const res1 = await worker.recognize(imageUrl);
    results.push(res1.data.text.replace(/\s+/g, '').trim());

    // Pase 2: Modo palabra única (a veces detecta mejor caracteres pegados)
    await worker.setParameters({ tessedit_pageseg_mode: '8' });
    const res2 = await worker.recognize(imageUrl);
    results.push(res2.data.text.replace(/\s+/g, '').trim());

    return results.filter(r => r.length > 3);
  } catch (error) {
    console.error("Error en OCR:", error);
    return [];
  }
};

export const performCharacterOCR = async (charImages: string[]): Promise<string> => {
  try {
    const worker = await getWorker();
    let finalString = "";
    
    await worker.setParameters({
      tessedit_pageseg_mode: '10', // Modo carácter único
    });

    for (const img of charImages) {
      const { data: { text } } = await worker.recognize(img);
      finalString += text.trim();
    }
    
    return finalString;
  } catch (error) {
    console.error("Error en OCR por caracteres:", error);
    return "";
  }
};

export const terminateOCR = async () => {
  if (sharedWorker) {
    await sharedWorker.terminate();
    sharedWorker = null;
  }
};
