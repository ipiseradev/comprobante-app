import { findEntityByName } from "../entities";
import type { ValidationRule } from "../types";

interface KnownFormat {
  pattern: RegExp;
  description: string;
}

/**
 * Formatos conocidos por emisor. Evidencia escasa (pocas muestras reales),
 * por eso la regla es solo advertencia y de peso bajo. Ampliar a medida
 * que haya más comprobantes verificados de cada entidad.
 */
const KNOWN_FORMATS: Record<string, KnownFormat> = {
  "Mercado Pago": { pattern: /^\d{9,13}$/, description: "entre 9 y 13 dígitos" },
};

/** Cualquier número de operación: letras, dígitos y guiones, de largo razonable. */
const GENERIC_FORMAT = /^[A-Za-z0-9-]{4,40}$/;

export const operationNumberRule: ValidationRule = {
  id: "operation-number-format",
  title: "Formato del número de operación",
  weight: 10,
  warningOnly: true,
  evaluate({ data }) {
    const { operationNumber, issuer } = data;

    if (operationNumber === null) {
      return { status: "skip", explanation: "No encontramos el número de operación." };
    }

    if (!GENERIC_FORMAT.test(operationNumber)) {
      return {
        status: "warn",
        explanation: "El número de operación tiene caracteres o un largo poco habituales.",
      };
    }

    const entity = issuer ? findEntityByName(issuer) : null;
    const known = entity ? KNOWN_FORMATS[entity.name] : undefined;

    if (!entity || !known) {
      return {
        status: "pass",
        explanation: "El número de operación tiene un formato habitual.",
      };
    }

    if (!known.pattern.test(operationNumber)) {
      return {
        status: "warn",
        explanation: `Los números de operación de ${entity.name} suelen tener ${known.description}, y este no.`,
      };
    }

    return {
      status: "pass",
      explanation: `El número de operación tiene el formato habitual de ${entity.name}.`,
    };
  },
};
