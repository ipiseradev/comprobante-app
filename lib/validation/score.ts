import type { RuleResult, RuleStatus, Verdict } from "./types";

/** Una advertencia suma la mitad del peso de la regla. */
export const WARNING_FACTOR = 0.5;

/** Desde este puntaje el comprobante es "Sospechoso". */
export const SUSPICIOUS_THRESHOLD = 20;

/** Desde este puntaje es "Probablemente falso". */
export const LIKELY_FAKE_THRESHOLD = 50;

export const VERDICT_LABELS: Record<Verdict, string> = {
  NO_ISSUES: "Sin inconsistencias detectadas",
  SUSPICIOUS: "Sospechoso",
  LIKELY_FAKE: "Probablemente falso",
};

/**
 * Ninguna regla sobre la imagen prueba que el dinero llegó: la falsificación
 * mejor hecha es justamente la que pasa todas. Por eso este aviso acompaña
 * a TODOS los veredictos, incluido el mejor.
 */
export const VERDICT_DISCLAIMER = "Confirmá el ingreso en tu cuenta antes de entregar.";

export function riskPoints(status: RuleStatus, weight: number): number {
  if (status === "fail") return weight;
  if (status === "warn") return Math.round(weight * WARNING_FACTOR);
  return 0;
}

/** Suma de puntos de riesgo, de 0 a 100. */
export function computeScore(results: Pick<RuleResult, "riskPoints">[]): number {
  const total = results.reduce((sum, result) => sum + result.riskPoints, 0);
  return Math.min(100, total);
}

/**
 * Cualquier inconsistencia concreta (fail) hace al comprobante al menos
 * "Sospechoso", aunque su peso sea bajo: "Sin inconsistencias detectadas"
 * tiene que significar exactamente eso.
 */
export function computeVerdict(score: number, results: Pick<RuleResult, "status">[]): Verdict {
  if (score >= LIKELY_FAKE_THRESHOLD) return "LIKELY_FAKE";
  const hasFailure = results.some((result) => result.status === "fail");
  if (score >= SUSPICIOUS_THRESHOLD || hasFailure) return "SUSPICIOUS";
  return "NO_ISSUES";
}
