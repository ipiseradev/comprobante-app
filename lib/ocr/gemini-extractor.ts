import {
  ApiError,
  GoogleGenAI,
  createPartFromBase64,
  createUserContent,
} from "@google/genai";

import {
  EmptyResponseError,
  ExtractorAuthError,
  ExtractorHttpError,
  ExtractorTimeoutError,
  InvalidJsonResponseError,
  MissingApiKeyError,
  ResponseValidationError,
} from "./errors";
import { RECEIPT_EXTRACTION_PROMPT } from "./prompt";
import { receiptExtractionJsonSchema, receiptExtractionSchema } from "./schema";
import type {
  ReceiptExtractionResult,
  ReceiptExtractor,
  ReceiptImageInput,
} from "./types";

/**
 * Modelo recomendado por la documentación oficial actual de Gemini
 * (ai.google.dev/gemini-api/docs/models) para tareas multimodales con
 * salida estructurada. Configurable vía GEMINI_MODEL.
 */
export const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";

const REQUEST_TIMEOUT_MS = 30_000;

/** Intentos totales por imagen, incluyendo el primero. */
const MAX_ATTEMPTS = 3;

/** Espera antes del primer reintento; se duplica en cada reintento. */
const RETRY_BASE_DELAY_MS = 2_000;

/** Jitter aleatorio sumado a cada espera, para no reintentar en sincronía. */
const RETRY_MAX_JITTER_MS = 500;

/** Errores transitorios del proveedor: rate limit y fallas del servidor. */
const RETRYABLE_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);

function isRetryable(error: Error): boolean {
  return (
    error instanceof ExtractorHttpError &&
    RETRYABLE_HTTP_STATUSES.has(error.status)
  );
}

/** Espera antes del reintento N (1-based): 2s, 4s, ... más jitter. */
function retryDelayMs(retry: number): number {
  return (
    RETRY_BASE_DELAY_MS * 2 ** (retry - 1) +
    Math.floor(Math.random() * RETRY_MAX_JITTER_MS)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GeminiReceiptExtractorOptions {
  apiKey?: string;
  model?: string;
}

export class GeminiReceiptExtractor implements ReceiptExtractor {
  readonly provider = "gemini";
  readonly model: string;
  private readonly client: GoogleGenAI;

  /**
   * Las opciones permiten inyectar la configuración validada (ver
   * lib/ocr/factory.ts). Sin opciones se lee process.env, para que los
   * scripts standalone sigan funcionando.
   */
  constructor(options: GeminiReceiptExtractorOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new MissingApiKeyError(
        "GEMINI_API_KEY no está definida. Configurala en las variables de entorno antes de usar GeminiReceiptExtractor."
      );
    }

    this.model = options.model || process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
    this.client = new GoogleGenAI({ apiKey });
  }

  async extract(image: ReceiptImageInput): Promise<ReceiptExtractionResult> {
    const response = await this.generate(image);

    const text = response.text;
    if (!text || text.trim().length === 0) {
      throw new EmptyResponseError(
        "Gemini devolvió una respuesta vacía para el comprobante."
      );
    }

    const parsed = this.parseJson(text);
    const result = receiptExtractionSchema.safeParse(parsed);
    if (!result.success) {
      throw new ResponseValidationError(
        "La respuesta de Gemini no cumple con el schema esperado.",
        result.error.issues,
        parsed
      );
    }

    return {
      data: result.data,
      metadata: { provider: this.provider, model: this.model },
      rawResponse: response,
    };
  }

  /**
   * Llama a Gemini reintentando solo errores HTTP transitorios
   * (429, 500, 502, 503, 504). Auth, timeout y cualquier otro error
   * se propagan en el primer intento.
   */
  private async generate(image: ReceiptImageInput) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.generateOnce(image);
      } catch (error) {
        if (!(error instanceof Error) || !isRetryable(error) || attempt >= MAX_ATTEMPTS) {
          throw error;
        }
        await sleep(retryDelayMs(attempt));
      }
    }
  }

  private async generateOnce(image: ReceiptImageInput) {
    try {
      return await this.client.models.generateContent({
        model: this.model,
        contents: createUserContent([
          createPartFromBase64(image.data, image.mimeType),
          RECEIPT_EXTRACTION_PROMPT,
        ]),
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: receiptExtractionJsonSchema,
          httpOptions: { timeout: REQUEST_TIMEOUT_MS },
        },
      });
    } catch (error) {
      throw this.mapRequestError(error);
    }
  }

  private parseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new InvalidJsonResponseError(
        "La respuesta de Gemini no es un JSON válido.",
        text,
        { cause: error }
      );
    }
  }

  private mapRequestError(error: unknown): Error {
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403) {
        return new ExtractorAuthError(
          `Gemini rechazó la autenticación (status ${error.status}). Verificá GEMINI_API_KEY.`,
          error.status,
          { cause: error }
        );
      }
      return new ExtractorHttpError(
        `Gemini devolvió un error HTTP ${error.status}: ${error.message}`,
        error.status,
        { cause: error }
      );
    }

    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      return new ExtractorTimeoutError(
        "La solicitud a Gemini superó el tiempo límite configurado.",
        { cause: error }
      );
    }

    return error instanceof Error ? error : new Error(String(error));
  }
}
