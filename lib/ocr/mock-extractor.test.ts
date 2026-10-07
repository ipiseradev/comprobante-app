import { describe, expect, it } from "vitest";

import { ReceiptExtractorError } from "./errors";
import { MockReceiptExtractor } from "./mock-extractor";
import { receiptExtractionSchema } from "./schema";

describe("MockReceiptExtractor", () => {
  it("devuelve un fixture que cumple el schema de extracción", async () => {
    const result = await new MockReceiptExtractor({ latencyMs: 0 }).extract();

    expect(receiptExtractionSchema.safeParse(result.data).success).toBe(true);
    expect(result.metadata).toEqual({ provider: "mock", model: "mock-v1" });
  });

  it("falla con un error tipado si el fixture no existe", async () => {
    const extractor = new MockReceiptExtractor({ mockId: "999", latencyMs: 0 });

    await expect(extractor.extract()).rejects.toThrow(ReceiptExtractorError);
  });

  it("devuelve copias: mutar el resultado no altera el fixture", async () => {
    const extractor = new MockReceiptExtractor({ latencyMs: 0 });

    const first = await extractor.extract();
    first.data.amount = -1;
    const second = await extractor.extract();

    expect(second.data.amount).not.toBe(-1);
    expect(second.rawResponse).not.toBe(second.data);
  });
});
