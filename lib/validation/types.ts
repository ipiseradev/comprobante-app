import type { ExtractedReceiptData } from "../ocr/schema";

/**
 * pass: la comprobación salió bien.
 * warn: algo para revisar, no concluyente.
 * fail: inconsistencia concreta.
 * skip: no se pudo verificar (faltan datos o no aplica). No suma riesgo.
 */
export type RuleStatus = "pass" | "warn" | "fail" | "skip";

export type RuleId =
  | "required-fields"
  | "cbu-checksum"
  | "cbu-entity-coherence"
  | "date"
  | "amount-value"
  | "amount-format"
  | "operation-number-format"
  | "duplicate";

export interface RuleOutcome {
  status: RuleStatus;
  /** Explicación en lenguaje simple, para mostrar al usuario. */
  explanation: string;
}

/** Busca si el mismo comprobante ya se verificó antes (dentro del mismo usuario). */
export interface DuplicateChecker {
  findPrevious(query: {
    userId: string;
    operationNumber: string;
    issuer: string | null;
    excludeReceiptId: string | null;
  }): Promise<{ receiptId: string; verifiedAt: Date } | null>;
}

export interface ValidationConfig {
  /** Zona horaria para decidir qué día es "hoy". */
  timeZone: string;
  /** Hasta cuántos días de antigüedad la fecha se considera normal. */
  recentDays: number;
  /** A partir de cuántos días de antigüedad la fecha es una inconsistencia. */
  maxAgeDays: number;
}

export interface RuleContext {
  data: ExtractedReceiptData;
  /** Fecha de hoy (AAAA-MM-DD) en la zona horaria configurada. */
  today: string;
  config: ValidationConfig;
  /** Sin usuario (modo demo) no se buscan duplicados. */
  userId: string | null;
  receiptId: string | null;
  duplicates: DuplicateChecker | null;
}

export interface ValidationRule {
  id: RuleId;
  /** Título corto para la UI. */
  title: string;
  /** Puntos de riesgo que suma si falla (la mitad si es advertencia). */
  weight: number;
  /** Reglas poco confiables: nunca pasan de advertencia. */
  warningOnly?: boolean;
  evaluate(context: RuleContext): RuleOutcome | Promise<RuleOutcome>;
}

export interface RuleResult extends RuleOutcome {
  id: RuleId;
  title: string;
  weight: number;
  riskPoints: number;
}

export type Verdict = "NO_ISSUES" | "SUSPICIOUS" | "LIKELY_FAKE";

export interface ValidationReport {
  verdict: Verdict;
  verdictLabel: string;
  /** Siempre presente: ninguna regla prueba que el dinero llegó. */
  disclaimer: string;
  /** Riesgo de 0 (sin señales) a 100. */
  score: number;
  results: RuleResult[];
}
