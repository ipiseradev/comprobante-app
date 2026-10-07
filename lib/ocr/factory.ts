import type { Env } from "../env";
import { GeminiReceiptExtractor } from "./gemini-extractor";
import { MockReceiptExtractor } from "./mock-extractor";
import type { ReceiptExtractor } from "./types";

type ExtractorConfig = Pick<Env, "EXTRACTOR" | "GEMINI_API_KEY" | "GEMINI_MODEL">;

/**
 * Crea el extractor indicado por EXTRACTOR.
 *
 * Es el único lugar que conoce las implementaciones concretas: el resto
 * del sistema depende de la interfaz ReceiptExtractor. Activar Gemini en
 * producción es solo cambiar variables de entorno, sin tocar código.
 */
export function createReceiptExtractor(config: ExtractorConfig): ReceiptExtractor {
  switch (config.EXTRACTOR) {
    case "mock":
      return new MockReceiptExtractor();
    case "gemini":
      return new GeminiReceiptExtractor({
        apiKey: config.GEMINI_API_KEY,
        model: config.GEMINI_MODEL,
      });
  }
}
