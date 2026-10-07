import { z } from "zod";

/**
 * Datos estructurados que extrae un proveedor de OCR/IA de un comprobante.
 *
 * Origen (sender) y destino (receiver) van separados porque las reglas de
 * validación comparan cada CBU/CVU con el banco de SU titular: el banco que
 * emite el comprobante (issuer) suele no coincidir con el del destinatario.
 *
 * Criterio de estrictez: el schema valida FORMA (tipos, fecha AAAA-MM-DD,
 * CBU/CVU solo dígitos), no VALIDEZ. Un CBU de 21 dígitos o un monto
 * negativo son señales de fraude que deben llegar al motor de reglas; si
 * el schema los rechazara, se perderían como "error de extracción".
 *
 * Las comprobaciones de forma usan .refine() y no .regex(): Gemini no
 * soporta `pattern` en responseJsonSchema, y los refinamientos no se
 * exportan al JSON Schema.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DIGITS_ONLY = /^\d+$/;

const nullableText = (description: string) =>
  z.string().nullable().describe(description);

const partySchema = z
  .object({
    name: nullableText(
      "Nombre del titular tal como aparece en la imagen, o null si no aparece."
    ),
    cbuCvu: nullableText(
      "CBU o CVU del titular: solo los dígitos, como string. Null si no aparece. No usar números de cuenta, tarjeta ni alias."
    ).refine((value) => value === null || DIGITS_ONLY.test(value), {
      message: "debe contener solo dígitos",
    }),
    bank: nullableText(
      "Banco o billetera de ESTE titular, solo si aparece explícitamente junto a sus datos. No copiar el emisor del comprobante."
    ),
  })
  .strict();

export const receiptExtractionSchema = z
  .object({
    amount: z
      .number()
      .nullable()
      .describe("Monto de la operación como número, sin símbolo ni separadores de miles."),
    date: nullableText("Fecha de la operación en formato AAAA-MM-DD.").refine(
      (value) => value === null || ISO_DATE.test(value),
      { message: "debe tener formato AAAA-MM-DD" }
    ),
    operationNumber: nullableText(
      "Número de operación o comprobante, exactamente como aparece."
    ),
    issuer: nullableText(
      "Banco o billetera que emitió el comprobante (logo o encabezado)."
    ),
    sender: partySchema.describe("Quien envía el dinero (ordenante)."),
    receiver: partySchema.describe("Quien recibe el dinero (destinatario)."),
    rawText: nullableText(
      "Transcripción literal de todo el texto visible, con saltos de línea."
    ),
  })
  .strict();

export type ExtractedReceiptData = z.infer<typeof receiptExtractionSchema>;
export type ExtractedParty = z.infer<typeof partySchema>;

/**
 * JSON Schema equivalente, derivado del schema de Zod (misma fuente de verdad)
 * para pasarlo como `responseJsonSchema` en la request a Gemini.
 */
export const receiptExtractionJsonSchema: Record<string, unknown> = z.toJSONSchema(
  receiptExtractionSchema
);
delete receiptExtractionJsonSchema.$schema;
