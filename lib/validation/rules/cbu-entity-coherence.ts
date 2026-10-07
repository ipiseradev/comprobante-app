import { entityCode, hasCbuShape, isCvu } from "../cbu";
import { findBankByCode, findEntityByName } from "../entities";
import type { RuleOutcome, ValidationRule } from "../types";
import { labeledParties, type LabeledParty } from "./parties";

type PartyCheck =
  | { kind: "ok"; message: string }
  | { kind: "mismatch"; message: string }
  | { kind: "unverifiable" };

function describeCode(code: string): string {
  return findBankByCode(code)?.name ?? `la entidad ${code}`;
}

/**
 * Compara el CBU/CVU de una parte con el banco que dice el comprobante PARA
 * ESA MISMA PARTE. No se usa el emisor: un comprobante de Mercado Pago
 * puede mostrar un CBU de destino del Banco Provincia y ser legítimo.
 */
function checkParty({ party, label }: LabeledParty): PartyCheck {
  const { cbuCvu, bank } = party;
  if (!cbuCvu || !bank || !hasCbuShape(cbuCvu)) return { kind: "unverifiable" };

  const entity = findEntityByName(bank);
  if (!entity) return { kind: "unverifiable" };

  if (isCvu(cbuCvu)) {
    if (entity.kind === "bank") {
      return {
        kind: "mismatch",
        message: `La cuenta ${label} es un CVU (de billetera virtual), pero el comprobante dice que es de ${entity.name}, que es un banco.`,
      };
    }
    if (entity.cvuPrefix && !cbuCvu.startsWith(entity.cvuPrefix)) {
      return {
        kind: "mismatch",
        message: `El CVU ${label} no corresponde a ${entity.name}.`,
      };
    }
    return { kind: "ok", message: `El CVU ${label} coincide con ${entity.name}.` };
  }

  const code = entityCode(cbuCvu);

  if (entity.kind === "wallet") {
    return {
      kind: "mismatch",
      message: `La cuenta ${label} es un CBU de ${describeCode(code)}, pero el comprobante dice que es de ${entity.name}, que usa CVU.`,
    };
  }

  if (entity.code !== code) {
    return {
      kind: "mismatch",
      message: `El CBU ${label} pertenece a ${describeCode(code)}, pero el comprobante dice ${entity.name}.`,
    };
  }

  return { kind: "ok", message: `El CBU ${label} coincide con ${entity.name}.` };
}

export const cbuEntityCoherenceRule: ValidationRule = {
  id: "cbu-entity-coherence",
  title: "CBU/CVU coherente con el banco",
  weight: 50,
  evaluate({ data }): RuleOutcome {
    const checks = labeledParties(data).map(checkParty);

    const mismatches = checks.filter((check) => check.kind === "mismatch");
    if (mismatches.length > 0) {
      return {
        status: "fail",
        explanation: mismatches.map((check) => check.message).join(" "),
      };
    }

    const oks = checks.filter((check) => check.kind === "ok");
    if (oks.length > 0) {
      return { status: "pass", explanation: oks.map((check) => check.message).join(" ") };
    }

    return {
      status: "skip",
      explanation:
        "No se puede verificar: el comprobante no muestra el banco junto al CBU/CVU, o no reconocemos la entidad.",
    };
  },
};
