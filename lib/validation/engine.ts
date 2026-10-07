import type { ExtractedReceiptData } from "../ocr/schema";
import { amountFormatRule, amountValueRule } from "./rules/amount";
import { cbuChecksumRule } from "./rules/cbu-checksum";
import { cbuEntityCoherenceRule } from "./rules/cbu-entity-coherence";
import { dateRule } from "./rules/date";
import { duplicateRule } from "./rules/duplicate";
import { operationNumberRule } from "./rules/operation-number";
import { requiredFieldsRule } from "./rules/required-fields";
import {
  computeScore,
  computeVerdict,
  riskPoints,
  VERDICT_DISCLAIMER,
  VERDICT_LABELS,
} from "./score";
import type {
  DuplicateChecker,
  RuleResult,
  ValidationConfig,
  ValidationReport,
  ValidationRule,
} from "./types";

/** Orden de las reglas = orden en que se muestran: de más a menos concluyente. */
export const DEFAULT_RULES: readonly ValidationRule[] = [
  cbuChecksumRule,
  cbuEntityCoherenceRule,
  duplicateRule,
  amountValueRule,
  dateRule,
  requiredFieldsRule,
  amountFormatRule,
  operationNumberRule,
];

export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  timeZone: "America/Argentina/Buenos_Aires",
  recentDays: 7,
  maxAgeDays: 90,
};

export interface ValidateOptions {
  /** Inyectable para tests deterministas. Default: ahora. */
  now?: Date;
  userId?: string | null;
  receiptId?: string | null;
  duplicates?: DuplicateChecker | null;
  config?: Partial<ValidationConfig>;
  rules?: readonly ValidationRule[];
}

/** "Hoy" como AAAA-MM-DD en la zona horaria dada (en-CA formatea así). */
export function todayIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Corre todas las reglas sobre los datos extraídos y arma el veredicto.
 *
 * Si una regla lanza un error (ej. la base no responde al buscar
 * duplicados) se propaga: preferimos fallar a devolver un veredicto
 * optimista con una comprobación que no se hizo.
 */
export async function validateReceipt(
  data: ExtractedReceiptData,
  options: ValidateOptions = {}
): Promise<ValidationReport> {
  const config = { ...DEFAULT_VALIDATION_CONFIG, ...options.config };
  const context = {
    data,
    config,
    today: todayIn(config.timeZone, options.now ?? new Date()),
    userId: options.userId ?? null,
    receiptId: options.receiptId ?? null,
    duplicates: options.duplicates ?? null,
  };

  const rules = options.rules ?? DEFAULT_RULES;

  const results: RuleResult[] = await Promise.all(
    rules.map(async (rule) => {
      const outcome = await rule.evaluate(context);
      // Las reglas de baja confianza nunca pasan de advertencia
      const status =
        rule.warningOnly && outcome.status === "fail" ? "warn" : outcome.status;

      return {
        id: rule.id,
        title: rule.title,
        weight: rule.weight,
        status,
        explanation: outcome.explanation,
        riskPoints: riskPoints(status, rule.weight),
      };
    })
  );

  const score = computeScore(results);
  const verdict = computeVerdict(score, results);

  return {
    verdict,
    verdictLabel: VERDICT_LABELS[verdict],
    disclaimer: VERDICT_DISCLAIMER,
    score,
    results,
  };
}
