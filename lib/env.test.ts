import { describe, expect, it } from "vitest";

import { EnvValidationError, parseEnv } from "./env";

const BASE = { DATABASE_URL: "postgresql://u:p@localhost:5434/db" };
const SUPABASE = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "secret",
};

describe("parseEnv", () => {
  it("aplica defaults seguros", () => {
    const env = parseEnv({ ...BASE, NODE_ENV: "test", ALLOW_REAL_UPLOADS: "false" });

    expect(env.EXTRACTOR).toBe("mock");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("exige DATABASE_URL", () => {
    expect(() => parseEnv({ NODE_ENV: "test" })).toThrow(EnvValidationError);
  });

  it("trata las variables vacías como no definidas", () => {
    expect(() => parseEnv({ ...BASE, NODE_ENV: "production", EXTRACTOR: "" })).not.toThrow();
  });

  describe("ALLOW_REAL_UPLOADS", () => {
    it("está deshabilitado por defecto en producción", () => {
      const env = parseEnv({ ...BASE, NODE_ENV: "production" });
      expect(env.ALLOW_REAL_UPLOADS).toBe(false);
    });

    it("está habilitado por defecto fuera de producción", () => {
      const env = parseEnv({ ...BASE, ...SUPABASE, NODE_ENV: "development" });
      expect(env.ALLOW_REAL_UPLOADS).toBe(true);
    });

    it("respeta el valor explícito por sobre el default", () => {
      const env = parseEnv({
        ...BASE,
        ...SUPABASE,
        NODE_ENV: "production",
        ALLOW_REAL_UPLOADS: "true",
      });
      expect(env.ALLOW_REAL_UPLOADS).toBe(true);
    });

    it("rechaza valores que no son true/false", () => {
      expect(() =>
        parseEnv({ ...BASE, NODE_ENV: "production", ALLOW_REAL_UPLOADS: "yes" })
      ).toThrow(EnvValidationError);
    });

    it("exige las credenciales de Supabase si está habilitado", () => {
      expect(() =>
        parseEnv({ ...BASE, NODE_ENV: "production", ALLOW_REAL_UPLOADS: "true" })
      ).toThrow(/SUPABASE_URL/);
    });
  });

  describe("EXTRACTOR", () => {
    it('exige GEMINI_API_KEY con EXTRACTOR="gemini"', () => {
      expect(() =>
        parseEnv({ ...BASE, NODE_ENV: "production", EXTRACTOR: "gemini" })
      ).toThrow(/GEMINI_API_KEY/);
    });

    it("acepta gemini con su API key", () => {
      const env = parseEnv({
        ...BASE,
        NODE_ENV: "production",
        EXTRACTOR: "gemini",
        GEMINI_API_KEY: "key",
      });
      expect(env.EXTRACTOR).toBe("gemini");
    });

    it("rechaza un proveedor desconocido", () => {
      expect(() =>
        parseEnv({ ...BASE, NODE_ENV: "production", EXTRACTOR: "tesseract" })
      ).toThrow(EnvValidationError);
    });
  });

  it("reporta todos los problemas juntos, no solo el primero", () => {
    try {
      parseEnv({ NODE_ENV: "production", EXTRACTOR: "gemini" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const { problems } = error as EnvValidationError;
      expect(problems.some((p) => p.startsWith("DATABASE_URL"))).toBe(true);
    }
  });
});
