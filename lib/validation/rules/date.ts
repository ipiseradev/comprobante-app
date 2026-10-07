import type { ValidationRule } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Días UTC desde epoch, o null si la fecha no existe en el calendario. */
function toDayNumber(isoDate: string): number | null {
  const [year, month, day] = isoDate.split("-").map(Number);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  // Date.UTC "corrige" fechas imposibles (31/02 → 03/03): se detecta así
  const exists =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return exists ? time / DAY_MS : null;
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * La fecha tiene que existir, no ser futura y ser reciente: quien muestra
 * un comprobante como "ya te transferí" lo hace en los días siguientes.
 * Un comprobante viejo puede ser real pero de otro pago (reutilizado).
 */
export const dateRule: ValidationRule = {
  id: "date",
  title: "Fecha válida y reciente",
  weight: 30,
  evaluate({ data, today, config }) {
    if (data.date === null) {
      return { status: "skip", explanation: "No encontramos la fecha del comprobante." };
    }

    const operationDay = toDayNumber(data.date);
    if (operationDay === null) {
      return {
        status: "fail",
        explanation: `La fecha ${formatDate(data.date)} no existe en el calendario.`,
      };
    }

    const todayDay = toDayNumber(today);
    if (todayDay === null) {
      throw new Error(`Fecha de referencia inválida: ${today}`);
    }

    const ageDays = todayDay - operationDay;

    if (ageDays < 0) {
      return {
        status: "fail",
        explanation: `La fecha del comprobante (${formatDate(data.date)}) es posterior a hoy.`,
      };
    }

    if (ageDays > config.maxAgeDays) {
      return {
        status: "fail",
        explanation: `El comprobante es de hace ${ageDays} días (${formatDate(data.date)}). Puede ser un comprobante real de otro pago, reutilizado.`,
      };
    }

    if (ageDays > config.recentDays) {
      return {
        status: "warn",
        explanation: `El comprobante es de hace ${ageDays} días (${formatDate(data.date)}). Fijate que corresponda al pago que estás esperando.`,
      };
    }

    return {
      status: "pass",
      explanation:
        ageDays === 0
          ? "La fecha es de hoy."
          : `La fecha es reciente (hace ${ageDays} ${ageDays === 1 ? "día" : "días"}).`,
    };
  },
};
