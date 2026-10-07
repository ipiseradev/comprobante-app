import { describe, expect, it } from "vitest";

import { context, receipt } from "../test-fixtures";
import { dateRule } from "./date";

// "Hoy" en los fixtures es 2026-10-07; recentDays 7, maxAgeDays 90
const evaluate = (date: string | null) => dateRule.evaluate(context(receipt({ date })));

describe("dateRule", () => {
  it.each([
    ["2026-10-07", "La fecha es de hoy."],
    ["2026-10-06", "La fecha es reciente (hace 1 día)."],
    ["2026-09-30", "La fecha es reciente (hace 7 días)."],
  ])("pasa con una fecha reciente: %s", (date, explanation) => {
    expect(evaluate(date)).toEqual({ status: "pass", explanation });
  });

  it("advierte entre 8 y 90 días de antigüedad", () => {
    expect(evaluate("2026-09-29")).toMatchObject({ status: "warn" });
    expect(evaluate("2026-07-09")).toMatchObject({
      status: "warn",
      explanation: expect.stringContaining("hace 90 días"),
    });
  });

  it("falla con más de 90 días (posible comprobante reutilizado)", () => {
    expect(evaluate("2026-07-08")).toMatchObject({
      status: "fail",
      explanation: expect.stringContaining("reutilizado"),
    });
  });

  it("falla si la fecha es futura", () => {
    expect(evaluate("2026-10-08")).toMatchObject({
      status: "fail",
      explanation: "La fecha del comprobante (08/10/2026) es posterior a hoy.",
    });
  });

  it.each(["2026-02-30", "2026-13-01", "2025-02-29"])(
    "falla si la fecha no existe: %s",
    (date) => {
      expect(evaluate(date)).toMatchObject({
        status: "fail",
        explanation: expect.stringContaining("no existe en el calendario"),
      });
    }
  );

  it("acepta el 29 de febrero de un año bisiesto", () => {
    expect(dateRule.evaluate(context(receipt({ date: "2028-02-29" }), { today: "2028-03-01" }))).toMatchObject({
      status: "pass",
    });
  });

  it("se omite si no hay fecha", () => {
    expect(evaluate(null)).toMatchObject({ status: "skip" });
  });

  it("respeta umbrales configurados", () => {
    const config = { timeZone: "America/Argentina/Buenos_Aires", recentDays: 1, maxAgeDays: 3 };
    expect(dateRule.evaluate(context(receipt({ date: "2026-10-03" }), { config }))).toMatchObject({
      status: "fail",
    });
  });
});
