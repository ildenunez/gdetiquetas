
declare const Tesseract: any;

export interface OCRProgress {
  status: string;
  progress: number;
}

export const performLocalOCR = async (
  imageUrl: string, 
  onProgress?: (p: OCRProgress) => void
): Promise<string> => {
  try {
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m: any) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress({ status: 'Escaneando...', progress: Math.round(m.progress * 100) });
        }
      }
    });

    // Eliminamos la whitelist restrictiva, dejamos que detecte todo y limpiamos nosotros
    // Esto evita que si detecta un caracter especial por error, descarte la palabra entera
    const { data: { text } } = await worker.recognize(imageUrl);
    await worker.terminate();
    
    return text;
  } catch (error) {
    console.error("Error OCR:", error);
    return "";
  }
};
