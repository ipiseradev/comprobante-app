import { CBU_LENGTH, isValidCbuChecksum } from "../cbu";
import type { ValidationRule } from "../types";
import { labeledParties } from "./parties";

/**
 * Los dos dígitos verificadores de un CBU/CVU son una cuenta matemática
 * sobre los demás. Un comprobante real los tiene siempre bien; un número
 * inventado o editado a mano casi nunca. Es la señal más fuerte.
 */
export const cbuChecksumRule: ValidationRule = {
  id: "cbu-checksum",
  title: "CBU/CVU matemáticamente válido",
  weight: 60,
  evaluate({ data }) {
    const present = labeledParties(data).flatMap(({ party, label }) =>
      party.cbuCvu === null ? [] : [{ cbu: party.cbuCvu, label }]
    );

    if (present.length === 0) {
      return {
        status: "skip",
        explanation: "El comprobante no muestra ningún CBU/CVU para verificar.",
      };
    }

    const problems: string[] = [];
    for (const { cbu, label } of present) {
      if (cbu.length !== CBU_LENGTH) {
        problems.push(
          `El CBU/CVU ${label} tiene ${cbu.length} dígitos, y siempre tienen ${CBU_LENGTH}.`
        );
      } else if (!isValidCbuChecksum(cbu)) {
        problems.push(
          `El CBU/CVU ${label} tiene dígitos verificadores incorrectos: ese número no puede existir.`
        );
      }
    }

    if (problems.length > 0) {
      return { status: "fail", explanation: problems.join(" ") };
    }

    return {
      status: "pass",
      explanation:
        present.length === 1
          ? `El CBU/CVU ${present[0].label} es matemáticamente válido.`
          : "Los CBU/CVU de origen y de destino son matemáticamente válidos.",
    };
  },
};
