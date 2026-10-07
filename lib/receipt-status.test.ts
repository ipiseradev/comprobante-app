import { describe, expect, it } from "vitest";

import { RECEIPT_TRANSITIONS, statusesAllowedToTransitionTo } from "./receipt-status";

describe("ciclo de vida del Receipt", () => {
  it("solo UPLOADED y ERROR pueden iniciar un procesamiento", () => {
    expect(statusesAllowedToTransitionTo("PROCESSING").sort()).toEqual([
      "ERROR",
      "UPLOADED",
    ]);
  });

  it("COMPLETED, REVIEW y ERROR solo se alcanzan desde PROCESSING", () => {
    for (const target of ["COMPLETED", "REVIEW", "ERROR"] as const) {
      expect(statusesAllowedToTransitionTo(target)).toEqual(["PROCESSING"]);
    }
  });

  it("COMPLETED y REVIEW son finales", () => {
    expect(RECEIPT_TRANSITIONS.COMPLETED).toEqual([]);
    expect(RECEIPT_TRANSITIONS.REVIEW).toEqual([]);
  });
});
