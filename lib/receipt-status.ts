import type { ReceiptStatus } from "@prisma/client";

// Ciclo de vida de un Receipt:
//
//   UPLOADED → PROCESSING → COMPLETED
//                         → REVIEW
//                         → ERROR → PROCESSING (reintento)
//
// COMPLETED y REVIEW son finales: volver a procesarlos requerirá
// una acción explícita de re-procesamiento (todavía no implementada).
export const RECEIPT_TRANSITIONS: Record<ReceiptStatus, ReceiptStatus[]> = {
  UPLOADED: ["PROCESSING"],
  PROCESSING: ["COMPLETED", "REVIEW", "ERROR"],
  ERROR: ["PROCESSING"],
  COMPLETED: [],
  REVIEW: [],
};

// Estados desde los cuales se puede pasar a `target`
export function statusesAllowedToTransitionTo(
  target: ReceiptStatus
): ReceiptStatus[] {
  return (Object.keys(RECEIPT_TRANSITIONS) as ReceiptStatus[]).filter(
    (status) => RECEIPT_TRANSITIONS[status].includes(target)
  );
}
