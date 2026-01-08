
export interface MuelleData {
  amazonRef: string;
  orderNumber: string;
}

export interface ProcessedLabel {
  id: string;
  originalFileName: string;
  pageNumber: number;
  extractedAmazonRef: string | null;
  packageInfo: string | null;
  matchedOrderNumber: string | null;
  imageUrl: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

export interface OverlayConfig {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  cropTop: number;
  cropBottom: number;
  cropLeft: number;
  cropRight: number;
  rotation: number;
}

export interface RawToken {
  text: string;
  lineIndex: number;
  tokenIndex: number;
}
