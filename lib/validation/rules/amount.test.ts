import { describe, expect, it } from "vitest";

import { context, receipt } from "../test-fixtures";
import { amountFormatRule, amountValueRule } from "./amount";

describe("amountValueRule", () => {
  const evaluate = (amount: number | null) => amountValueRule.evaluate(context(receipt({ amount })));

  it.each([1, 25000, 45990.5, 45990.55, 0.01])("pasa con un monto válido: %s", (amount) => {
    expect(evaluate(amount)).toMatchObject({ status: "pass" });
  });

  it.each([0, -1, -25000])("falla con un monto cero o negativo: %s", (amount) => {
    expect(evaluate(amount)).toMatchObject({ status: "fail" });
  });

  it("falla con más de dos decimales", () => {
    expect(evaluate(100.123)).toMatchObject({
      status: "fail",
      explanation: expect.stringContaining("más de dos decimales"),
    });
  });

  it("se omite si no hay monto", () => {
    expect(evaluate(null)).toMatchObject({ status: "skip" });
  });
});

describe("amountFormatRule", () => {
  const evaluate = (amount: number | null, rawText: string | null) =>
    amountFormatRule.evaluate(context(receipt({ amount, rawText })));

  it.each([
    [300000, "Monto\n$ 300.000"],
    [300000, "$ 300.000,00"],
    [45990.5, "Importe: $ 45.990,50"],
    [95000, "Importe debitado $ 95.000,00"],
    [500, "$ 500,00"],
    [38000, "$38.000,00"],
  ])("pasa con formato argentino: %s en %j", (amount, rawText) => {
    expect(evaluate(amount, rawText)).toMatchObject({ status: "pass" });
  });

  it("pasa con el monto sin separador de miles (ambiguo, no se penaliza)", () => {
    expect(evaluate(25000, "Total 25000")).toMatchObject({ status: "pass" });
  });

  it.each([
    [10000, "Importe\n$ 10,000.00"],
    [45990.5, "$ 45,990.50"],
    [500, "$ 500.00"],
  ])("advierte con formato de EE.UU./México: %s en %j", (amount, rawText) => {
    expect(evaluate(amount, rawText)).toMatchObject({
      status: "warn",
      explanation: expect.stringContaining("EE.UU. o México"),
    });
  });

  it("no confunde el monto con otro número más largo que lo contiene", () => {
    // 10.000 aparece dentro de 110.000: no es el monto
    expect(evaluate(10000, "Saldo $ 110.000,50")).toMatchObject({ status: "skip" });
  });

  it("se omite si el monto no aparece en el texto", () => {
    expect(evaluate(25000, "Comprobante de transferencia")).toMatchObject({ status: "skip" });
  });

  it("se omite sin texto o sin monto", () => {
    expect(evaluate(25000, null)).toMatchObject({ status: "skip" });
    expect(evaluate(null, "$ 25.000")).toMatchObject({ status: "skip" });
  });

  it("es una regla de solo advertencia", () => {
    expect(amountFormatRule.warningOnly).toBe(true);
  });
});
