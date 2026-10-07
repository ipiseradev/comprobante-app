import { ApiError } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EmptyResponseError,
  ExtractorAuthError,
  ExtractorHttpError,
  ExtractorTimeoutError,
  InvalidJsonResponseError,
  ResponseValidationError,
} from "./errors";
import { GeminiReceiptExtractor } from "./gemini-extractor";

// Cliente falso de Gemini: los tests nunca hacen llamadas de red.
// ApiError se toma del módulo real para que `instanceof` funcione.
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return {
    ...actual,
    GoogleGenAI: class {
      models = { generateContent };
    },
  };
});

const VALID_DATA = {
  amount: 1500,
  date: "2025-03-14",
  operationNumber: "908172635411",
  senderName: "Laura Martina Gómez",
  receiverName: "Tomás Ezequiel Ferreyra",
  cbuCvu: "0070999030004123456789",
  bank: "Banco Galicia",
};

const IMAGE = { data: "aGVsbG8=", mimeType: "image/jpeg" as const };

const okResponse = (data: unknown = VALID_DATA) => ({ text: JSON.stringify(data) });
const apiError = (status: number) => new ApiError({ message: `HTTP ${status}`, status });

function newExtractor() {
  return new GeminiReceiptExtractor({ apiKey: "fake-key", model: "gemini-test" });
}

/** Ejecuta extract() avanzando los timers falsos hasta que termine. */
async function extractWithTimers(extractor = newExtractor()) {
  const promise = extractor.extract(IMAGE);
  // Evita "unhandled rejection" mientras se avanzan los timers
  promise.catch(() => {});
  await vi.runAllTimersAsync();
  return promise;
}

beforeEach(() => {
  vi.useFakeTimers();
  generateContent.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GeminiReceiptExtractor", () => {
  it("devuelve los datos validados y la metadata", async () => {
    generateContent.mockResolvedValueOnce(okResponse());

    const result = await extractWithTimers();

    expect(result.data).toEqual(VALID_DATA);
    expect(result.metadata).toEqual({ provider: "gemini", model: "gemini-test" });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  describe("reintentos", () => {
    it.each([429, 500, 502, 503, 504])("reintenta un HTTP %i y se recupera", async (status) => {
      generateContent
        .mockRejectedValueOnce(apiError(status))
        .mockResolvedValueOnce(okResponse());

      const result = await extractWithTimers();

      expect(result.data).toEqual(VALID_DATA);
      expect(generateContent).toHaveBeenCalledTimes(2);
    });

    it("hace como máximo 3 intentos y propaga el último error", async () => {
      generateContent.mockRejectedValue(apiError(503));

      await expect(extractWithTimers()).rejects.toMatchObject({
        name: "ExtractorHttpError",
        status: 503,
      });
      expect(generateContent).toHaveBeenCalledTimes(3);
    });

    it("espera ~2s antes del 2º intento y ~4s antes del 3º", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0); // sin jitter
      generateContent.mockRejectedValue(apiError(503));

      const promise = newExtractor().extract(IMAGE);
      promise.catch(() => {});

      await vi.advanceTimersByTimeAsync(0);
      expect(generateContent).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1_999);
      expect(generateContent).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(generateContent).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(3_999);
      expect(generateContent).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(generateContent).toHaveBeenCalledTimes(3);

      await expect(promise).rejects.toThrow(ExtractorHttpError);
      vi.mocked(Math.random).mockRestore();
    });

    it.each([400, 404])("no reintenta un HTTP %i", async (status) => {
      generateContent.mockRejectedValue(apiError(status));

      await expect(extractWithTimers()).rejects.toThrow(ExtractorHttpError);
      expect(generateContent).toHaveBeenCalledTimes(1);
    });

    it.each([401, 403])("no reintenta un error de autenticación (%i)", async (status) => {
      generateContent.mockRejectedValue(apiError(status));

      await expect(extractWithTimers()).rejects.toThrow(ExtractorAuthError);
      expect(generateContent).toHaveBeenCalledTimes(1);
    });

    it("no reintenta un timeout", async () => {
      const timeout = new Error("timeout");
      timeout.name = "TimeoutError";
      generateContent.mockRejectedValue(timeout);

      await expect(extractWithTimers()).rejects.toThrow(ExtractorTimeoutError);
      expect(generateContent).toHaveBeenCalledTimes(1);
    });
  });

  describe("respuestas inválidas (sin reintento)", () => {
    it("respuesta vacía", async () => {
      generateContent.mockResolvedValue({ text: "" });

      await expect(extractWithTimers()).rejects.toThrow(EmptyResponseError);
      expect(generateContent).toHaveBeenCalledTimes(1);
    });

    it("JSON inválido", async () => {
      generateContent.mockResolvedValue({ text: "no es json" });

      await expect(extractWithTimers()).rejects.toThrow(InvalidJsonResponseError);
      expect(generateContent).toHaveBeenCalledTimes(1);
    });

    it("JSON que no cumple el schema", async () => {
      generateContent.mockResolvedValue(okResponse({ ...VALID_DATA, amount: "1500" }));

      await expect(extractWithTimers()).rejects.toThrow(ResponseValidationError);
      expect(generateContent).toHaveBeenCalledTimes(1);
    });
  });
});
