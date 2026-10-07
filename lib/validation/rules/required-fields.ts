import type { ValidationRule } from "../types";

/**
 * Un comprobante de transferencia siempre muestra monto, fecha, número de
 * operación y a quién se pagó. Si faltan, o el OCR no pudo leerlos, o la
 * imagen no es un comprobante de transferencia.
 */
export const requiredFieldsRule: ValidationRule = {
  id: "required-fields",
  title: "Datos esenciales del comprobante",
  weight: 20,
  evaluate({ data }) {
    const missing = [
      data.amount === null && "el monto",
      data.date === null && "la fecha",
      data.operationNumber === null && "el número de operación",
      data.receiver.name === null && data.receiver.cbuCvu === null && "el destinatario",
    ].filter((item): item is string => item !== false);

    if (missing.length === 0) {
      return {
        status: "pass",
        explanation: "El comprobante tiene monto, fecha, número de operación y destinatario.",
      };
    }

    const list = missing.join(", ");

    if (missing.length >= 3) {
      return {
        status: "fail",
        explanation: `No encontramos ${list}. No parece un comprobante de transferencia completo.`,
      };
    }

    return {
      status: "warn",
      explanation: `No encontramos ${list}. Puede que la imagen esté cortada o borrosa.`,
    };
  },
};
