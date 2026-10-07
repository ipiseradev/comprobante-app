/**
 * Datos de prueba para los tests del motor de validación.
 * Todos los CBU/CVU se generan con buildCbu: son ficticios pero válidos.
 */
import type { ExtractedParty, ExtractedReceiptData } from "../ocr/schema";
import { buildCbu } from "./cbu";
import { DEFAULT_VALIDATION_CONFIG } from "./engine";
import type { RuleContext } from "./types";

export const CBU = {
  /** Banco Galicia (007) */
  galicia: buildCbu("0070123", "0000012345678"),
  /** Banco Provincia (014) */
  provincia: buildCbu("0140456", "0000098765432"),
  /** CVU de Mercado Pago (prefijo 0000003) */
  mercadoPagoCvu: buildCbu("0000003", "1000123456789"),
  /** CVU de otra billetera */
  otherCvu: buildCbu("0000079", "0000000000001"),
  /** Código de entidad que no está en la tabla */
  unknownBank: buildCbu("9990001", "0000000000001"),
};

/** Fecha de referencia de los tests: "hoy" es 2026-10-07 en Argentina. */
export const TODAY = "2026-10-07";
export const NOW = new Date("2026-10-07T15:00:00-03:00");

const emptyParty: ExtractedParty = { name: null, cbuCvu: null, bank: null };

/** Un comprobante sin inconsistencias, para modificar en cada test. */
export function receipt(overrides: Partial<ExtractedReceiptData> = {}): ExtractedReceiptData {
  return {
    amount: 25000,
    date: TODAY,
    operationNumber: "908172635411",
    issuer: "Mercado Pago",
    sender: { name: "Laura Gómez", cbuCvu: CBU.mercadoPagoCvu, bank: "Mercado Pago" },
    receiver: { name: "Tomás Ferreyra", cbuCvu: CBU.galicia, bank: "Banco Galicia" },
    rawText: "Mercado Pago\nComprobante de transferencia\n$ 25.000\nDe Laura Gómez\nPara Tomás Ferreyra",
    ...overrides,
  };
}

export function party(overrides: Partial<ExtractedParty> = {}): ExtractedParty {
  return { ...emptyParty, ...overrides };
}

export function context(
  data: ExtractedReceiptData,
  overrides: Partial<RuleContext> = {}
): RuleContext {
  return {
    data,
    today: TODAY,
    config: DEFAULT_VALIDATION_CONFIG,
    userId: null,
    receiptId: null,
    duplicates: null,
    ...overrides,
  };
}
