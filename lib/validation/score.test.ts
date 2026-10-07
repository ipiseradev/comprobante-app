import { describe, expect, it } from "vitest";

import {
  computeScore,
  computeVerdict,
  LIKELY_FAKE_THRESHOLD,
  riskPoints,
  SUSPICIOUS_THRESHOLD,
} from "./score";
import type { RuleStatus } from "./types";

describe("riskPoints", () => {
  it("fail suma el peso completo, warn la mitad, pass y skip nada", () => {
    expect(riskPoints("fail", 60)).toBe(60);
    expect(riskPoints("warn", 30)).toBe(15);
    expect(riskPoints("pass", 60)).toBe(0);
    expect(riskPoints("skip", 60)).toBe(0);
  });
});

describe("computeScore", () => {
  it("suma los puntos de riesgo", () => {
    expect(computeScore([{ riskPoints: 15 }, { riskPoints: 5 }])).toBe(20);
  });

  it("nunca supera 100", () => {
    expect(computeScore([{ riskPoints: 60 }, { riskPoints: 70 }])).toBe(100);
  });

  it("es 0 sin señales", () => {
    expect(computeScore([])).toBe(0);
  });
});

describe("computeVerdict", () => {
  const statuses = (...list: RuleStatus[]) => list.map((status) => ({ status }));

  it("sin señales: Sin inconsistencias detectadas", () => {
    expect(computeVerdict(0, statuses("pass", "skip"))).toBe("NO_ISSUES");
  });

  it("advertencias leves no cambian el veredicto", () => {
    expect(computeVerdict(SUSPICIOUS_THRESHOLD - 1, statuses("warn", "pass"))).toBe("NO_ISSUES");
  });

  it("desde el umbral de sospecha: Sospechoso", () => {
    expect(computeVerdict(SUSPICIOUS_THRESHOLD, statuses("warn", "warn"))).toBe("SUSPICIOUS");
  });

  it("cualquier inconsistencia concreta es al menos Sospechoso, aunque sume poco", () => {
    expect(computeVerdict(5, statuses("fail"))).toBe("SUSPICIOUS");
  });

  it("desde el umbral alto: Probablemente falso", () => {
    expect(computeVerdict(LIKELY_FAKE_THRESHOLD, statuses("fail"))).toBe("LIKELY_FAKE");
    expect(computeVerdict(100, statuses("fail", "fail"))).toBe("LIKELY_FAKE");
  });
});
