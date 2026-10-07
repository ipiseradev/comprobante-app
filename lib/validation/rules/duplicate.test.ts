import { describe, expect, it, vi } from "vitest";

import { context, receipt } from "../test-fixtures";
import type { DuplicateChecker } from "../types";
import { duplicateRule } from "./duplicate";

function checker(result: Awaited<ReturnType<DuplicateChecker["findPrevious"]>>) {
  return { findPrevious: vi.fn().mockResolvedValue(result) } satisfies DuplicateChecker;
}

describe("duplicateRule", () => {
  it("se omite sin usuario (modo demo) y no consulta la base", async () => {
    const duplicates = checker(null);

    const outcome = await duplicateRule.evaluate(context(receipt(), { duplicates }));

    expect(outcome.status).toBe("skip");
    expect(duplicates.findPrevious).not.toHaveBeenCalled();
  });

  it("se omite sin número de operación", async () => {
    const outcome = await duplicateRule.evaluate(
      context(receipt({ operationNumber: null }), { userId: "u1", duplicates: checker(null) })
    );
    expect(outcome.status).toBe("skip");
  });

  it("pasa si el usuario no verificó antes ese número de operación", async () => {
    const outcome = await duplicateRule.evaluate(
      context(receipt(), { userId: "u1", duplicates: checker(null) })
    );
    expect(outcome.status).toBe("pass");
  });

  it("falla si ya lo verificó, con la fecha de la verificación anterior", async () => {
    const duplicates = checker({
      receiptId: "r-anterior",
      verifiedAt: new Date("2026-10-01T12:00:00-03:00"),
    });

    const outcome = await duplicateRule.evaluate(
      context(receipt(), { userId: "u1", receiptId: "r-actual", duplicates })
    );

    expect(outcome).toMatchObject({
      status: "fail",
      explanation: expect.stringContaining("el 01/10/2026"),
    });
  });

  it("busca dentro del usuario actual y excluye el comprobante que se está validando", async () => {
    const duplicates = checker(null);

    await duplicateRule.evaluate(
      context(receipt({ operationNumber: "123456", issuer: "Mercado Pago" }), {
        userId: "u1",
        receiptId: "r-actual",
        duplicates,
      })
    );

    expect(duplicates.findPrevious).toHaveBeenCalledWith({
      userId: "u1",
      operationNumber: "123456",
      issuer: "Mercado Pago",
      excludeReceiptId: "r-actual",
    });
  });
});
