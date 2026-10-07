import type { ValidationRule } from "../types";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

/**
 * Reenviar el mismo comprobante real para "pagar" dos veces es un fraude
 * común. Se busca solo dentro de los comprobantes del mismo usuario: no se
 * revela a nadie qué verificaron otros.
 */
export const duplicateRule: ValidationRule = {
  id: "duplicate",
  title: "Comprobante no repetido",
  weight: 70,
  async evaluate({ data, userId, receiptId, duplicates }) {
    if (!userId || !duplicates) {
      return {
        status: "skip",
        explanation: "La búsqueda de comprobantes repetidos requiere iniciar sesión.",
      };
    }

    if (data.operationNumber === null) {
      return {
        status: "skip",
        explanation: "Sin número de operación no se puede buscar si el comprobante está repetido.",
      };
    }

    const previous = await duplicates.findPrevious({
      userId,
      operationNumber: data.operationNumber,
      issuer: data.issuer,
      excludeReceiptId: receiptId,
    });

    if (previous) {
      return {
        status: "fail",
        explanation: `Ya verificaste un comprobante con este mismo número de operación el ${dateFormatter.format(previous.verifiedAt)}. Puede ser el mismo pago enviado dos veces.`,
      };
    }

    return {
      status: "pass",
      explanation: "No verificaste antes ningún comprobante con este número de operación.",
    };
  },
};
