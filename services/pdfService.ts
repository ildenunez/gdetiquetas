
declare const pdfjsLib: any;

export interface PdfPageResult {
  imageUrl: string;
  pageNumber: number;
  textContent: string;
}

export const convertPdfToImages = async (file: File): Promise<PdfPageResult[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const results: PdfPageResult[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    
    // Extraer texto (Gratis y Local)
    const textContentObj = await page.getTextContent();
    const textContent = textContentObj.items.map((item: any) => item.str).join(' ');

    // Renderizar imagen para previsualización
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    
    results.push({
      imageUrl: canvas.toDataURL('image/jpeg', 0.8),
      pageNumber: i,
      textContent: textContent
    });
  }

  return results;
};
