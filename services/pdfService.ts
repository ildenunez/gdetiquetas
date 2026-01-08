
declare const pdfjsLib: any;

export const convertPdfToImages = async (file: File): Promise<{ imageUrl: string; pageNumber: number }[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: { imageUrl: string; pageNumber: number }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR/Barcode reading
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    images.push({
      imageUrl: canvas.toDataURL('image/jpeg', 0.9),
      pageNumber: i
    });
  }

  return images;
};
