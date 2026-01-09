
export interface MuelleData {
  amazonRef: string;
  orderNumber: string;
}

export interface LabelRules {
  pkgArea: { x: number; y: number; w: number; h: number };
  barcodeArea: { x: number; y: number; w: number; h: number };
  ocrArea?: { x: number; y: number; w: number; h: number };
  useOcr?: boolean;
  imageRotation?: number; // 0, 90, 180, 270
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
  x: number; 
  y: number;
  fontSize: number;
  rotation: number;
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
  width: number;  // Dimensión real en puntos PDF
  height: number; // Dimensión real en puntos PDF
}
