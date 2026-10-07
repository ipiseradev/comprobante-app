import { describe, expect, it } from "vitest";

import { MissingApiKeyError } from "./errors";
import { createReceiptExtractor } from "./factory";
import { GEMINI_DEFAULT_MODEL, GeminiReceiptExtractor } from "./gemini-extractor";
import { MockReceiptExtractor } from "./mock-extractor";

describe("createReceiptExtractor", () => {
  it('crea el mock con EXTRACTOR="mock"', () => {
    const extractor = createReceiptExtractor({ EXTRACTOR: "mock" });

    expect(extractor).toBeInstanceOf(MockReceiptExtractor);
    expect(extractor.provider).toBe("mock");
  });

  it('crea Gemini con EXTRACTOR="gemini" y la configuración recibida', () => {
    const extractor = createReceiptExtractor({
      EXTRACTOR: "gemini",
      GEMINI_API_KEY: "fake-key",
      GEMINI_MODEL: "gemini-test-model",
    });

    expect(extractor).toBeInstanceOf(GeminiReceiptExtractor);
    expect(extractor.model).toBe("gemini-test-model");
  });

  it("usa el modelo por defecto si GEMINI_MODEL no está definido", () => {
    const extractor = createReceiptExtractor({
      EXTRACTOR: "gemini",
      GEMINI_API_KEY: "fake-key",
    });

    expect(extractor.model).toBe(GEMINI_DEFAULT_MODEL);
  });

  it("falla con un error claro si Gemini no tiene API key", () => {
    const previous = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      expect(() => createReceiptExtractor({ EXTRACTOR: "gemini" })).toThrow(
        MissingApiKeyError
      );
    } finally {
      if (previous !== undefined) process.env.GEMINI_API_KEY = previous;
    }
  });
});
