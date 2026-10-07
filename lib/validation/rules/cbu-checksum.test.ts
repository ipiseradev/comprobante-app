import { describe, expect, it } from "vitest";

import { CBU, context, party, receipt } from "../test-fixtures";
import { cbuChecksumRule } from "./cbu-checksum";

const evaluate = (data: ReturnType<typeof receipt>) => cbuChecksumRule.evaluate(context(data));

/** Cambia el último dígito: rompe el verificador del bloque 2. */
const corrupt = (cbu: string) => cbu.slice(0, -1) + ((Number(cbu.at(-1)) + 1) % 10);

describe("cbuChecksumRule", () => {
  it("pasa cuando los CBU/CVU de ambas partes son válidos", () => {
    expect(evaluate(receipt())).toMatchObject({ status: "pass" });
  });

  it("pasa con un solo CBU/CVU presente", () => {
    expect(evaluate(receipt({ sender: party() }))).toMatchObject({
      status: "pass",
      explanation: expect.stringContaining("de destino"),
    });
  });

  it("falla si el verificador del CBU de destino es incorrecto", () => {
    const data = receipt({ receiver: party({ cbuCvu: corrupt(CBU.galicia) }) });
    expect(evaluate(data)).toMatchObject({
      status: "fail",
      explanation: expect.stringContaining("de destino tiene dígitos verificadores incorrectos"),
    });
  });

  it("falla si el CVU de origen es incorrecto", () => {
    const data = receipt({ sender: party({ cbuCvu: corrupt(CBU.mercadoPagoCvu) }) });
    expect(evaluate(data)).toMatchObject({
      status: "fail",
      explanation: expect.stringContaining("de origen"),
    });
  });

  it("falla con un mensaje claro si no tiene 22 dígitos", () => {
    const data = receipt({ receiver: party({ cbuCvu: CBU.galicia.slice(1) }) });
    expect(evaluate(data)).toMatchObject({
      status: "fail",
      explanation: expect.stringContaining("tiene 21 dígitos"),
    });
  });

  it("se omite si no hay ningún CBU/CVU", () => {
    const data = receipt({ sender: party(), receiver: party({ name: "Tomás" }) });
    expect(evaluate(data)).toMatchObject({ status: "skip" });
  });
});
