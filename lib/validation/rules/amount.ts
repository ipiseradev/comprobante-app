import type { ValidationRule } from "../types";

function hasAtMostTwoDecimals(amount: number): boolean {
  return Math.abs(Math.round(amount * 100) - amount * 100) < 1e-6;
}

/** Un monto de transferencia es positivo y tiene como máximo centavos. */
export const amountValueRule: ValidationRule = {
  id: "amount-value",
  title: "Monto válido",
  weight: 50,
  evaluate({ data }) {
    const { amount } = data;

    if (amount === null) {
      return { status: "skip", explanation: "No encontramos el monto." };
    }

    if (amount <= 0) {
      return {
        status: "fail",
        explanation: "El monto es cero o negativo: una transferencia siempre tiene un monto positivo.",
      };
    }

    if (!hasAtMostTwoDecimals(amount)) {
      return {
        status: "fail",
        explanation: "El monto tiene más de dos decimales: los pesos solo tienen centavos.",
      };
    }

    return { status: "pass", explanation: "El monto es positivo y tiene un formato válido." };
  },
};

function groupThousands(integer: number, separator: string): string {
  return String(integer).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/** Formas en que el monto puede aparecer escrito. */
function writtenForms(amount: number) {
  const integer = Math.trunc(amount);
  const cents = Math.round((amount - integer) * 100);
  const hasCents = cents !== 0;
  const centsText = String(cents).padStart(2, "0");

  const ar = groupThousands(integer, ".");
  const us = groupThousands(integer, ",");

  return {
    // "45.990,50" — formato argentino
    argentine: hasCents ? [`${ar},${centsText}`] : [ar, `${ar},00`],
    // "45,990.50" — formato de EE.UU./México
    foreign: hasCents ? [`${us}.${centsText}`] : [`${us}.00`, ...(integer >= 1000 ? [us] : [])],
    // "45990,50" sin separador de miles: ambiguo, no se penaliza
    plain: hasCents ? [`${integer},${centsText}`, `${integer}.${centsText}`] : [String(integer)],
  };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Busca el número completo: "10.000" no debe coincidir dentro de "110.000,5". */
function appearsIn(text: string, form: string): boolean {
  return new RegExp(`(?<![\\d.,])${escapeRegExp(form)}(?![\\d]|[.,]\\d)`).test(text);
}

/**
 * Los comprobantes argentinos escriben "$ 45.990,50" (punto para miles,
 * coma para decimales). Un monto escrito "45,990.50" sugiere una plantilla
 * de otro país o un comprobante armado a mano.
 *
 * Es solo advertencia: depende de la transcripción del OCR (rawText).
 */
export const amountFormatRule: ValidationRule = {
  id: "amount-format",
  title: "Formato del monto",
  weight: 30,
  warningOnly: true,
  evaluate({ data }) {
    const { amount, rawText } = data;

    if (amount === null || !rawText || amount <= 0) {
      return { status: "skip", explanation: "No se pudo verificar cómo está escrito el monto." };
    }

    const forms = writtenForms(amount);
    const found = (list: string[]) => list.some((form) => appearsIn(rawText, form));

    if (found(forms.argentine) || found(forms.plain)) {
      return { status: "pass", explanation: "El monto está escrito en formato argentino." };
    }

    if (found(forms.foreign)) {
      return {
        status: "warn",
        explanation:
          "El monto está escrito con coma para los miles y punto para los decimales (formato de EE.UU. o México). Los comprobantes argentinos usan punto para los miles y coma para los decimales.",
      };
    }

    return {
      status: "skip",
      explanation: "No encontramos el monto escrito en el texto del comprobante para verificar su formato.",
    };
  },
};
