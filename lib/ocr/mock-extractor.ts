import type { ExtractedReceiptData } from "./schema";
import { ReceiptExtractorError } from "./errors";
import type {
  ReceiptExtractor,
  ReceiptExtractionResult,
  ReceiptImageInput,
} from "./types";

/**
 * Fixtures de comprobantes para desarrollo y tests.
 *
 * Los datos son ficticios pero respetan los formatos reales
 * (CBU de 22 dígitos, fecha ISO 8601, monto como número), para que
 * las validaciones posteriores se ejerciten igual que en producción.
 *
 * Se congelan para que ningún consumidor pueda mutarlos por error.
 */
const MOCK_RECEIPTS: Readonly<Record<string, ExtractedReceiptData>> = Object.freeze({
  "001": {
    amount: 25000,
    date: "2025-04-23",
    operationNumber: "12345678",
    senderName: "Ignacio Pisera",
    receiverName: "María Gómez",
    cbuCvu: "0070999030004123456789",
    bank: "Banco Galicia",
  },
});

const DEFAULT_MOCK_ID = "001";

/** Latencia aproximada de un proveedor real de OCR/IA. */
const DEFAULT_LATENCY_MS = 300;

export interface MockReceiptExtractorOptions {
  /** Fixture a usar cuando la imagen no trae un `id` propio. */
  mockId?: string;
  /** Latencia simulada. Usar 0 en tests unitarios para que sean rápidos. */
  latencyMs?: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Implementación simulada de `ReceiptExtractor`.
 *
 * Respeta el mismo contrato que el extractor real, así el resto del
 * pipeline (validación, scoring de fraude, persistencia) se desarrolla
 * y testea sin depender de red, cuotas ni costos por request.
 * Cambiar a producción es solo inyectar otra implementación.
 */
export class MockReceiptExtractor implements ReceiptExtractor {
  readonly provider = "mock";
  readonly model = "mock-v1";

  private readonly mockId: string;
  private readonly latencyMs: number;

  constructor({ mockId = DEFAULT_MOCK_ID, latencyMs = DEFAULT_LATENCY_MS }: MockReceiptExtractorOptions = {}) {
    this.mockId = mockId;
    this.latencyMs = latencyMs;
  }

  async extract(image: ReceiptImageInput): Promise<ReceiptExtractionResult> {
    // La latencia hace visibles los estados de carga y posibles race conditions
    // en la UI, que con una respuesta instantánea pasarían desapercibidos.
    if (this.latencyMs > 0) await sleep(this.latencyMs);

    // El id de la imagen tiene prioridad y permite elegir el fixture por test.
    // Se resuelve una sola vez para que la búsqueda y el error usen el mismo valor.
    const receiptId = image.id ?? this.mockId;
    const fixture = MOCK_RECEIPTS[receiptId];

    if (!fixture) {
      throw new ReceiptExtractorError(`No existe un comprobante mock con id "${receiptId}"`);
    }

    return {
      // Copias independientes: si un consumidor muta `data`,
      // no altera `rawResponse` ni el fixture original.
      data: structuredClone(fixture),
      metadata: {
        provider: this.provider,
        model: this.model,
      },
      rawResponse: structuredClone(fixture),
    };
  }
}