
export interface MuelleData {
  amazonRef: string;
  orderNumber: string;
}

export interface LabelRules {
  pkgArea: { x: number; y: number; w: number; h: number };
  barcodeArea: { x: number; y: number; w: number; h: number };
}

export interface ProcessedLabel {
  id: string;
  originalFileName: string;
  pageNumber: number;
  extractedAmazonRef: string | null;
  rawBarcodeText?: string | null; 
  rawOcrText?: string | null;     
  packageInfo: string | null;
  matchedOrderNumber: string | null;
  imageUrl: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  _debugBarcodeImg?: string; // Para inspección técnica
}

export interface OverlayConfig {
  // Posición del texto del pedido
  x: number; 
  y: number;
  fontSize: number;
  rotation: number;
  
  // Configuración de la "Cámara" sobre la etiqueta
  zoom: number;
  panX: number;
  panY: number;
  imageRotation: number;
  
  color: string;
}

export interface RawToken {
  text: string;
  lineIndex: number;
  tokenIndex: number;
  x: number;
  y: number;
  width: number;
  height?: number;
}

export interface PdfPageResult {
  imageUrl: string;
  pageNumber: number;
  textContent: any[]; 
}
