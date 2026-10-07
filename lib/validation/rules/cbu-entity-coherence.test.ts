import { describe, expect, it } from "vitest";

import { CBU, context, party, receipt } from "../test-fixtures";
import { cbuEntityCoherenceRule } from "./cbu-entity-coherence";

const evaluate = (data: ReturnType<typeof receipt>) =>
  cbuEntityCoherenceRule.evaluate(context(data));

const onlyReceiver = (cbuCvu: string, bank: string | null) =>
  receipt({ sender: party(), receiver: party({ name: "Tomás", cbuCvu, bank }) });

describe("cbuEntityCoherenceRule", () => {
  it("pasa cuando cada CBU/CVU coincide con el banco de su titular", () => {
    expect(evaluate(receipt())).toMatchObject({ status: "pass" });
  });

  it("compara cada parte con SU banco, no con el emisor", () => {
    // Emitido por Mercado Pago, destino en Banco Provincia: legítimo
    const data = receipt({
      issuer: "Mercado Pago",
      receiver: party({ cbuCvu: CBU.provincia, bank: "Banco de la Provincia de Buenos Aires" }),
    });
    expect(evaluate(data)).toMatchObject({ status: "pass" });
  });

  it("falla si un CVU se atribuye a un banco tradicional", () => {
    expect(evaluate(onlyReceiver(CBU.mercadoPagoCvu, "Banco Galicia"))).toMatchObject({
      status: "fail",
      explanation: expect.stringContaining("es un CVU (de billetera virtual)"),
    });
  });

  it("falla si un CBU bancario se atribuye a una billetera", () => {
    expect(evaluate(onlyReceiver(CBU.galicia, "Mercado Pago"))).toMatchObject({
      status: "fail",
      explanation: expect.stringContaining("Banco Galicia"),
    });
  });

  it("falla si el código del CBU es de otro banco", () => {
    expect(evaluate(onlyReceiver(CBU.galicia, "Santander"))).toMatchObject({
      status: "fail",
      explanation:
        "El CBU de destino pertenece a Banco Galicia, pero el comprobante dice Banco Santander Argentina.",
    });
  });

  it("falla si el CVU no tiene el prefijo de la billetera que dice", () => {
    expect(evaluate(onlyReceiver(CBU.otherCvu, "Mercado Pago"))).toMatchObject({
      status: "fail",
      explanation: "El CVU de destino no corresponde a Mercado Pago.",
    });
  });

  it("no inventa el nombre de un código desconocido", () => {
    expect(evaluate(onlyReceiver(CBU.unknownBank, "Banco Galicia"))).toMatchObject({
      status: "fail",
      explanation: expect.stringContaining("la entidad 999"),
    });
  });

  it.each([
    ["sin banco junto al CBU", onlyReceiver(CBU.galicia, null)],
    ["banco no reconocido", onlyReceiver(CBU.galicia, "Billetera Andina")],
    ["banco ambiguo", onlyReceiver(CBU.provincia, "Banco Provincia")],
    ["CBU de largo inválido", onlyReceiver(CBU.galicia.slice(2), "Banco Galicia")],
  ])("se omite (no verificable): %s", (_case, data) => {
    expect(evaluate(data)).toMatchObject({ status: "skip" });
  });

  it("si una parte coincide y la otra no, falla", () => {
    const data = receipt({
      receiver: party({ cbuCvu: CBU.galicia, bank: "HSBC" }),
    });
    const outcome = evaluate(data);
    expect(outcome).toMatchObject({ status: "fail" });
  });
});
