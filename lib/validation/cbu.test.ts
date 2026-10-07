import { describe, expect, it } from "vitest";

import { buildCbu, entityCode, hasCbuShape, isCvu, isValidCbuChecksum } from "./cbu";

// CBU de ejemplo de la documentación pública (Clave Bancaria Uniforme,
// Wikipedia). Ancla independiente: no lo genera nuestro propio código.
const PUBLIC_EXAMPLE = "2850590940090418135201";

describe("isValidCbuChecksum", () => {
  it("valida el CBU de ejemplo público", () => {
    expect(isValidCbuChecksum(PUBLIC_EXAMPLE)).toBe(true);
  });

  it("detecta un error en el dígito verificador del bloque 1", () => {
    expect(isValidCbuChecksum("2850590840090418135201")).toBe(false);
  });

  it("detecta un error en el dígito verificador del bloque 2", () => {
    expect(isValidCbuChecksum("2850590940090418135202")).toBe(false);
  });

  it("detecta un dígito de cuenta cambiado (el caso típico de un número editado)", () => {
    expect(isValidCbuChecksum("2850590940090418136201")).toBe(false);
  });

  it.each(["", "285059094009041813520", "28505909400904181352011", "2850590940090418135A01"])(
    "rechaza lo que no tiene forma de CBU: %s",
    (value) => {
      expect(isValidCbuChecksum(value)).toBe(false);
    }
  );
});

describe("buildCbu", () => {
  it("reconstruye el ejemplo público a partir de sus bloques sin verificadores", () => {
    expect(buildCbu("2850590", "4009041813520")).toBe(PUBLIC_EXAMPLE);
  });

  it("siempre genera CBU válidos", () => {
    for (const block1 of ["0070001", "0000003", "1500999"]) {
      expect(isValidCbuChecksum(buildCbu(block1, "1234567890123"))).toBe(true);
    }
  });

  it("rechaza bloques de largo incorrecto", () => {
    expect(() => buildCbu("007", "1")).toThrow();
  });
});

describe("estructura", () => {
  it("lee el código de entidad y distingue CVU de CBU", () => {
    expect(entityCode(PUBLIC_EXAMPLE)).toBe("285");
    expect(isCvu(PUBLIC_EXAMPLE)).toBe(false);
    expect(isCvu(buildCbu("0000003", "1000000000001"))).toBe(true);
  });

  it("hasCbuShape exige 22 dígitos exactos", () => {
    expect(hasCbuShape(PUBLIC_EXAMPLE)).toBe(true);
    expect(hasCbuShape(PUBLIC_EXAMPLE.slice(1))).toBe(false);
  });
});
