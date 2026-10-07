import { describe, expect, it } from "vitest";

import { context, party, receipt } from "../test-fixtures";
import { requiredFieldsRule } from "./required-fields";

const evaluate = (data: ReturnType<typeof receipt>) =>
  requiredFieldsRule.evaluate(context(data));

describe("requiredFieldsRule", () => {
  it("pasa con monto, fecha, operación y destinatario", () => {
    expect(evaluate(receipt())).toMatchObject({ status: "pass" });
  });

  it("el destinatario puede identificarse solo por nombre o solo por CBU/CVU", () => {
    expect(evaluate(receipt({ receiver: party({ name: "Tomás" }) }))).toMatchObject({ status: "pass" });
    expect(evaluate(receipt({ receiver: party({ cbuCvu: "123" }) }))).toMatchObject({ status: "pass" });
  });

  it("no exige el ordenante (muchos comprobantes no lo muestran)", () => {
    expect(evaluate(receipt({ sender: party() }))).toMatchObject({ status: "pass" });
  });

  it("advierte si falta uno o dos datos esenciales", () => {
    expect(evaluate(receipt({ receiver: party() }))).toMatchObject({
      status: "warn",
      explanation: "No encontramos el destinatario. Puede que la imagen esté cortada o borrosa.",
    });
    expect(evaluate(receipt({ amount: null, date: null }))).toMatchObject({ status: "warn" });
  });

  it("falla si faltan tres o más (no parece un comprobante de transferencia)", () => {
    expect(
      evaluate(receipt({ amount: null, date: null, operationNumber: null }))
    ).toMatchObject({
      status: "fail",
      explanation: expect.stringContaining("No parece un comprobante de transferencia"),
    });
  });
});
