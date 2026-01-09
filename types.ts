
export interface MuelleData {
  amazonRef: string;
  orderNumber: string;
}

export interface LabelRules {
  pkgArea: { x: number; y: number; w: number; h: number };
  barcodeArea: { x: number; y: number; w: number; h: number };
  ocrArea?: { x: number; y: number; w: number; h: number };
  pkgQtyArea?: { x: number; y: number; w: number; h: number }; // Nueva zona para "1 of X"
  useOcr?: boolean;
  imageRotation?: number; // 0, 90, 180, 270
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
  rawBarcodeText?: string | null; 
  rawOcrText?: string | null;     
  packageInfo: string | null;
  matchedOrderNumber: string | null;
  matchConfidence?: number; // % de efectividad
  matchCandidates?: MatchCandidate[]; // Para resolución manual
  imageUrl: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'ambiguous';
  error?: string;
  _debugBarcodeImg?: string; 
  _debugOcrImg?: string;     
  _debugQtyImg?: string; // Debug para la zona de bultos
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
