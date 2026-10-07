import { describe, expect, it } from "vitest";

import { context, receipt } from "../test-fixtures";
import { operationNumberRule } from "./operation-number";

const evaluate = (operationNumber: string | null, issuer: string | null = null) =>
  operationNumberRule.evaluate(context(receipt({ operationNumber, issuer })));

describe("operationNumberRule", () => {
  it("es una regla de solo advertencia y peso bajo", () => {
    expect(operationNumberRule.warningOnly).toBe(true);
    expect(operationNumberRule.weight).toBeLessThanOrEqual(10);
  });

  it.each(["61728974", "8426749134", "TRX-2026-0001", "A1B2C3D4"])(
    "pasa con un formato habitual: %s",
    (operationNumber) => {
      expect(evaluate(operationNumber, "Banco Galicia")).toMatchObject({ status: "pass" });
    }
  );

  it.each(["12", "1234 5678", "ABC#123", "x".repeat(41)])(
    "advierte con caracteres o largo inusual: %s",
    (operationNumber) => {
      expect(evaluate(operationNumber)).toMatchObject({ status: "warn" });
    }
  );

  it("pasa con el formato conocido de Mercado Pago", () => {
    expect(evaluate("908172635411", "Mercado Pago")).toMatchObject({
      status: "pass",
      explanation: expect.stringContaining("Mercado Pago"),
    });
  });

  it("advierte si no coincide con el formato conocido del emisor", () => {
    expect(evaluate("ABC-123", "Mercado Pago")).toMatchObject({
      status: "warn",
      explanation: expect.stringContaining("suelen tener entre 9 y 13 dígitos"),
    });
  });

  it("se omite si no hay número de operación", () => {
    expect(evaluate(null)).toMatchObject({ status: "skip" });
  });
});
