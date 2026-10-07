import type { ExtractedReceiptData } from "./schema";

export type ReceiptImageMimeType = "image/jpeg" | "image/png" | "image/webp";

export interface ReceiptImageInput {
  /** Bytes de la imagen codificados en base64. */
  data: string;
  mimeType: ReceiptImageMimeType;
}

/** Metadata de trazabilidad: quién generó la extracción y con qué modelo. */
export interface ExtractorMetadata {
  provider: string;
  model: string;
}

export interface ReceiptExtractionResult {
  data: ExtractedReceiptData;
  metadata: ExtractorMetadata;
  /** Respuesta cruda del proveedor, para persistir luego en OcrData.rawResponse. */
  rawResponse: unknown;
}

/**
 * Contrato común para cualquier proveedor de OCR/extracción estructurada
 * de comprobantes (Gemini, Google Cloud Vision, Claude, etc.). El resto del
 * sistema debe depender solo de esta interfaz, nunca de un proveedor concreto.
 */
export interface ReceiptExtractor {
  readonly provider: string;
  readonly model: string;
  extract(image: ReceiptImageInput): Promise<ReceiptExtractionResult>;
}
