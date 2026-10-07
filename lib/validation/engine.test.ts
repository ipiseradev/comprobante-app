import { describe, expect, it, vi } from "vitest";

import { DEFAULT_RULES, todayIn, validateReceipt } from "./engine";
import { VERDICT_DISCLAIMER } from "./score";
import { CBU, NOW, party, receipt } from "./test-fixtures";
import type { DuplicateChecker, ValidationRule } from "./types";

const validate = (data: ReturnType<typeof receipt>, options = {}) =>
  validateReceipt(data, { now: NOW, ...options });

describe("validateReceipt", () => {
  it("un comprobante coherente: Sin inconsistencias detectadas, score 0", async () => {
    const report = await validate(receipt());

    expect(report.verdict).toBe("NO_ISSUES");
    expect(report.verdictLabel).toBe("Sin inconsistencias detectadas");
    expect(report.score).toBe(0);
    expect(report.results.filter((r) => r.status === "fail" || r.status === "warn")).toEqual([]);
  });

  it("siempre incluye el aviso de confirmar el ingreso, incluso sin inconsistencias", async () => {
    const report = await validate(receipt());
    expect(report.disclaimer).toBe(VERDICT_DISCLAIMER);
  });

  it("devuelve un resultado por regla, en orden y con explicación", async () => {
    const report = await validate(receipt());

    expect(report.results.map((r) => r.id)).toEqual(DEFAULT_RULES.map((rule) => rule.id));
    for (const result of report.results) {
      expect(result.explanation.length).toBeGreaterThan(0);
    }
  });

  it("un CBU inventado: Probablemente falso", async () => {
    const fake = CBU.galicia.slice(0, -1) + ((Number(CBU.galicia.at(-1)) + 1) % 10);
    const report = await validate(
      receipt({ receiver: party({ name: "Tomás", cbuCvu: fake, bank: "Banco Galicia" }) })
    );

    expect(report.verdict).toBe("LIKELY_FAKE");
    expect(report.results.find((r) => r.id === "cbu-checksum")).toMatchObject({
      status: "fail",
      riskPoints: 60,
    });
  });

  it("un CVU atribuido a un banco: Probablemente falso", async () => {
    const report = await validate(
      receipt({ receiver: party({ name: "Tomás", cbuCvu: CBU.mercadoPagoCvu, bank: "HSBC" }) })
    );
    expect(report.verdict).toBe("LIKELY_FAKE");
  });

  it("una fecha futura: Sospechoso", async () => {
    const report = await validate(receipt({ date: "2026-10-09" }));
    expect(report.verdict).toBe("SUSPICIOUS");
    expect(report.score).toBe(30);
  });

  it("un comprobante de hace dos semanas sigue sin inconsistencias, pero con advertencia", async () => {
    const report = await validate(receipt({ date: "2026-09-23" }));

    expect(report.verdict).toBe("NO_ISSUES");
    expect(report.score).toBe(15);
    expect(report.results.find((r) => r.id === "date")?.status).toBe("warn");
  });

  it("un comprobante repetido del mismo usuario: Probablemente falso", async () => {
    const duplicates: DuplicateChecker = {
      findPrevious: vi.fn().mockResolvedValue({ receiptId: "r0", verifiedAt: NOW }),
    };

    const report = await validate(receipt(), { userId: "u1", duplicates });

    expect(report.verdict).toBe("LIKELY_FAKE");
  });

  it("las reglas de solo advertencia nunca devuelven fail", async () => {
    const alwaysFails: ValidationRule = {
      id: "operation-number-format",
      title: "Siempre falla",
      weight: 10,
      warningOnly: true,
      evaluate: () => ({ status: "fail", explanation: "x" }),
    };

    const report = await validate(receipt(), { rules: [alwaysFails] });

    expect(report.results[0]).toMatchObject({ status: "warn", riskPoints: 5 });
  });

  it("propaga el error de una regla en lugar de dar un veredicto optimista", async () => {
    const duplicates: DuplicateChecker = {
      findPrevious: vi.fn().mockRejectedValue(new Error("DB caída")),
    };

    await expect(validate(receipt(), { userId: "u1", duplicates })).rejects.toThrow("DB caída");
  });
});

describe("todayIn", () => {
  it("usa la fecha de Argentina, no la de UTC", () => {
    // 01:00 UTC del 8/10 son las 22:00 del 7/10 en Buenos Aires
    const now = new Date("2026-10-08T01:00:00Z");
    expect(todayIn("America/Argentina/Buenos_Aires", now)).toBe("2026-10-07");
    expect(todayIn("UTC", now)).toBe("2026-10-08");
  });
});
