
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
    // Usamos el worker de Tesseract para tener más control y evitar bloqueos
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m: any) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress({ status: 'Escaneando...', progress: Math.round(m.progress * 100) });
        }
      }
    });

    // Parámetros para mejorar la lectura de códigos alfanuméricos (Amazon)
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/-. ',
    });

    const { data: { text } } = await worker.recognize(imageUrl);
    await worker.terminate();
    
    console.log("OCR Result Raw:", text);
    return text;
  } catch (error) {
    console.error("Error crítico en OCR Local:", error);
    return "";
  }
};
