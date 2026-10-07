import { describe, expect, it } from "vitest";

import { BANKS, findBankByCode, findEntityByName, normalizeEntityName } from "./entities";

describe("normalizeEntityName", () => {
  it("quita mayúsculas, tildes, puntuación y palabras genéricas", () => {
    expect(normalizeEntityName("Banco de la Provincia de Bs. As. S.A.")).toBe("provincia bs as");
    expect(normalizeEntityName("Banco de la Nación Argentina")).toBe("nacion");
  });
});

describe("findEntityByName", () => {
  it.each([
    ["Banco de la Provincia de Buenos Aires", "014"],
    ["Banco Galicia", "007"],
    ["Santander", "072"],
    ["Banco Santander Argentina S.A.", "072"],
    ["HSBC Bank Argentina", "150"],
    ["BBVA", "017"],
    ["Banco de la Nación Argentina", "011"],
    ["Brubank", "143"],
  ])("reconoce %s como el banco %s", (name, code) => {
    const entity = findEntityByName(name);
    expect(entity?.kind).toBe("bank");
    expect(entity?.kind === "bank" && entity.code).toBe(code);
  });

  it("reconoce Mercado Pago como billetera", () => {
    expect(findEntityByName("Mercado Pago")).toMatchObject({ kind: "wallet", name: "Mercado Pago" });
    expect(findEntityByName("MercadoPago")).toMatchObject({ kind: "wallet" });
  });

  it("no confunde el Banco Provincia de Buenos Aires con el de Neuquén", () => {
    expect(findEntityByName("Banco Provincia del Neuquén")).toMatchObject({ code: "097" });
  });

  it.each(["Banco Provincia", "Billetera Andina", "", "Banco"])(
    "devuelve null si no reconoce o es ambiguo: %s",
    (name) => {
      expect(findEntityByName(name)).toBeNull();
    }
  );
});

describe("tabla de bancos", () => {
  it("no tiene códigos repetidos ni el código reservado para CVU", () => {
    const codes = BANKS.map((entity) => entity.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).not.toContain("000");
    expect(codes.every((code) => /^\d{3}$/.test(code))).toBe(true);
  });

  it("findBankByCode encuentra por código", () => {
    expect(findBankByCode("014")?.name).toBe("Banco de la Provincia de Buenos Aires");
    expect(findBankByCode("999")).toBeNull();
  });
});
