import { z } from "zod";

/**
 * Campos estructurados que puede extraer un OCR de comprobante de pago.
 * Cada campo es nullable: el proveedor debe devolver null cuando el dato
 * no está visible en la imagen, nunca inventarlo ni usar strings placeholder.
 */
export const receiptExtractionSchema = z
  .object({
    amount: z.number().nullable(),
    date: z.string().nullable(),
    operationNumber: z.string().nullable(),
    senderName: z.string().nullable(),
    receiverName: z.string().nullable(),
    cbuCvu: z.string().nullable(),
    bank: z.string().nullable(),
  })
  .strict();

export type ExtractedReceiptData = z.infer<typeof receiptExtractionSchema>;

/**
 * JSON Schema equivalente, derivado del schema de Zod (misma fuente de verdad)
 * para pasarlo como `responseJsonSchema` en la request a Gemini.
 */
export const receiptExtractionJsonSchema: Record<string, unknown> = z.toJSONSchema(
  receiptExtractionSchema
);
delete receiptExtractionJsonSchema.$schema;
