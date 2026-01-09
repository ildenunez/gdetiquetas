
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

    const viewportBase = page.getViewport({ scale: 1.0 });
    // ESCALA 4.0: Óptima para PDF vectorial sin generar ruido excesivo
    const viewport = page.getViewport({ scale: 4.0 }); 
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      
      await page.render({ canvasContext: context, viewport }).promise;
      
      results.push({
        imageUrl: canvas.toDataURL('image/jpeg', 0.95),
        pageNumber: i,
        textContent: processedItems,
        width: viewportBase.width,
        height: viewportBase.height
      });
    }
  }

  return results;
};
