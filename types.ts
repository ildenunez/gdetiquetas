
export interface MuelleData {
  amazonRef: string;
  orderNumber: string;
  totalBultos: number;
}

export interface LabelRules {
  pkgArea: { x: number; y: number; w: number; h: number };
  barcodeArea: { x: number; y: number; w: number; h: number };
  ocrArea?: { x: number; y: number; w: number; h: number };
  pkgQtyArea?: { x: number; y: number; w: number; h: number }; 
  useOcr?: boolean;
  imageRotation?: number; 
}

export interface MatchCandidate {
  orderNumber: string;
  amazonRef: string;
  confidence: number;
}

export interface ProcessedLabel {
  id: string;
  originalFileName: string;
  pageNumber: number;
  extractedAmazonRef: string | null;
  matchedAmazonRef?: string | null;
  rawBarcodeText?: string | null; 
  rawOcrText?: string | null;     
  packageInfo: string | null; // Guardará "1 de 32", etc.
  packageQty?: [number, number] | null; // [actual, total] leídos por OCR
  matchedOrderNumber: string | null;
  matchConfidence?: number; 
  matchCandidates?: MatchCandidate[]; 
  imageUrl: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'ambiguous';
  error?: string;
  _debugBarcodeImg?: string; 
  _debugOcrImg?: string;     
  _debugQtyImg?: string; 
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
  width: number;  
  height: number; 
}