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

export class GeminiReceiptExtractor implements ReceiptExtractor {
  readonly provider = "gemini";
  readonly model: string;
  private readonly client: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new MissingApiKeyError(
        "GEMINI_API_KEY no está definida. Configurala en las variables de entorno antes de usar GeminiReceiptExtractor."
      );
    }

    this.model = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
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

  private async generate(image: ReceiptImageInput) {
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
