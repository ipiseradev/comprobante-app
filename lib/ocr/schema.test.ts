import { describe, expect, it } from "vitest";

import { receiptExtractionJsonSchema, receiptExtractionSchema } from "./schema";

const VALID = {
  amount: 18750.5,
  date: "2025-03-14",
  operationNumber: "908172635411",
  issuer: "Billetera Andina",
  sender: { name: "Laura Martina Gómez", cbuCvu: "0000999070001234567891", bank: null },
  receiver: { name: "Tomás Ezequiel Ferreyra", cbuCvu: "0070999030004123456789", bank: null },
  rawText: "Billetera Andina\nComprobante",
};

const parse = (data: unknown) => receiptExtractionSchema.safeParse(data);

describe("receiptExtractionSchema", () => {
  it("acepta una extracción completa", () => {
    expect(parse(VALID).success).toBe(true);
  });

  it("acepta todos los campos en null (comprobante ilegible)", () => {
    const empty = { name: null, cbuCvu: null, bank: null };
    expect(
      parse({
        amount: null,
        date: null,
        operationNumber: null,
        issuer: null,
        sender: empty,
        receiver: empty,
        rawText: null,
      }).success
    ).toBe(true);
  });

  it.each(["14/03/2025", "2025-3-14", "2025-03-14T10:00:00"])(
    "rechaza la fecha mal formateada %s",
    (date) => {
      expect(parse({ ...VALID, date }).success).toBe(false);
    }
  );

  it.each(["0070-9990-3000", "007099903000412345678A", "CBU 0070999030004123456789"])(
    "rechaza un CBU/CVU con caracteres que no son dígitos: %s",
    (cbuCvu) => {
      expect(parse({ ...VALID, receiver: { ...VALID.receiver, cbuCvu } }).success).toBe(false);
    }
  );

  // El schema valida forma, no validez: estas son señales de fraude que
  // tienen que llegar al motor de reglas, no fallar como error de extracción.
  it("deja pasar un CBU de largo incorrecto (lo juzgan las reglas)", () => {
    const shortCbu = { ...VALID.receiver, cbuCvu: "007099903000412345678" };
    expect(parse({ ...VALID, receiver: shortCbu }).success).toBe(true);
  });

  it("deja pasar un monto negativo (lo juzgan las reglas)", () => {
    expect(parse({ ...VALID, amount: -100 }).success).toBe(true);
  });

  it("rechaza el monto como string", () => {
    expect(parse({ ...VALID, amount: "18750.5" }).success).toBe(false);
  });

  it("rechaza campos desconocidos", () => {
    expect(parse({ ...VALID, isFake: true }).success).toBe(false);
    expect(parse({ ...VALID, sender: { ...VALID.sender, cuit: "20-1" } }).success).toBe(false);
  });
});

describe("receiptExtractionJsonSchema (lo que se envía a Gemini)", () => {
  // Propiedades de JSON Schema que soporta responseJsonSchema según la
  // documentación del SDK (@google/genai, GenerationConfig.responseJsonSchema).
  // Una propiedad no soportada puede romper todas las requests.
  const SUPPORTED_KEYWORDS = new Set([
    "$id", "$defs", "$ref", "$anchor", "type", "format", "title", "description",
    "enum", "items", "prefixItems", "minItems", "maxItems", "minimum", "maximum",
    "anyOf", "oneOf", "properties", "additionalProperties", "required",
    "propertyOrdering",
  ]);

  function collectKeywords(node: unknown, found = new Set<string>()): Set<string> {
    if (Array.isArray(node)) {
      node.forEach((child) => collectKeywords(child, found));
    } else if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        found.add(key);
        // Las claves dentro de "properties" son nombres de campos, no keywords
        const children = key === "properties" ? Object.values(value as object) : [value];
        children.forEach((child) => collectKeywords(child, found));
      }
    }
    return found;
  }

  it("solo usa propiedades soportadas por Gemini", () => {
    const unsupported = [...collectKeywords(receiptExtractionJsonSchema)].filter(
      (keyword) => !SUPPORTED_KEYWORDS.has(keyword)
    );
    expect(unsupported).toEqual([]);
  });

  it("marca todos los campos como obligatorios (null explícito, nunca omitido)", () => {
    expect(receiptExtractionJsonSchema.required).toEqual([
      "amount", "date", "operationNumber", "issuer", "sender", "receiver", "rawText",
    ]);
  });
});
