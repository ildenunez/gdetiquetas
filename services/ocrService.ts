
declare const Tesseract: any;

export const performLocalOCR = async (imageUrl: string): Promise<string> => {
  try {
    const result = await Tesseract.recognize(
      imageUrl,
      'eng', // Amazon usa mayoritariamente caracteres alfanuméricos estándar
      { 
        logger: (m: any) => console.log(m) 
      }
    );
    return result.data.text;
  } catch (error) {
    console.error("OCR Local Error:", error);
    return "";
  }
};
