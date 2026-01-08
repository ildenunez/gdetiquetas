
import { PdfPageResult } from '../types.ts';

declare const pdfjsLib: any;

export const convertPdfToImages = async (file: File): Promise<PdfPageResult[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const results: PdfPageResult[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    
    const textContentObj = await page.getTextContent();
    const items = textContentObj.items as any[];
    
    const processedItems = items.map((item, idx) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.transform[0]
    }));

    // Escala 5.0: Esto genera una imagen de alta densidad necesaria para DataMatrix pequeños
    const viewport = page.getViewport({ scale: 5.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Optimizaciones de renderizado para nitidez técnica
      context.imageSmoothingEnabled = false;
      await page.render({ canvasContext: context, viewport }).promise;
      
      results.push({
        imageUrl: canvas.toDataURL('image/jpeg', 1.0),
        pageNumber: i,
        textContent: processedItems
      });
    }
  }

  return results;
};
