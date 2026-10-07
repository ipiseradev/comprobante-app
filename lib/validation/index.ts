export {
  DEFAULT_RULES,
  DEFAULT_VALIDATION_CONFIG,
  validateReceipt,
  type ValidateOptions,
} from "./engine";

export {
  LIKELY_FAKE_THRESHOLD,
  SUSPICIOUS_THRESHOLD,
  VERDICT_DISCLAIMER,
  VERDICT_LABELS,
} from "./score";

export { buildCbu, isCvu, isValidCbuChecksum } from "./cbu";
export { findEntityByName } from "./entities";

export type {
  DuplicateChecker,
  RuleId,
  RuleResult,
  RuleStatus,
  ValidationConfig,
  ValidationReport,
  ValidationRule,
  Verdict,
} from "./types";
