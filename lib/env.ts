import { z } from "zod";

/**
 * Variables de entorno del servidor, validadas con Zod.
 *
 * Se leen de forma perezosa (getEnv) y no al importar el módulo: así
 * `next build` y los tests no fallan por variables que solo se usan en
 * runtime, y cada error de configuración aparece con un mensaje claro
 * la primera vez que se necesita.
 */

const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const EXTRACTOR_KINDS = ["mock", "gemini"] as const;
export type ExtractorKind = (typeof EXTRACTOR_KINDS)[number];

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    DATABASE_URL: z.string().min(1),

    // Solo obligatorias si el upload real está habilitado
    SUPABASE_URL: z.url().optional(),
    SUPABASE_SECRET_KEY: z.string().min(1).optional(),

    // Proveedor de extracción. "mock" no hace llamadas externas.
    EXTRACTOR: z.enum(EXTRACTOR_KINDS).default("mock"),
    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().min(1).optional(),

    // Sin valor explícito: habilitado fuera de producción, deshabilitado
    // en producción (se resuelve abajo según NODE_ENV).
    ALLOW_REAL_UPLOADS: booleanString.optional(),

    LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  })
  .transform((env) => ({
    ...env,
    ALLOW_REAL_UPLOADS:
      env.ALLOW_REAL_UPLOADS ?? env.NODE_ENV !== "production",
  }))
  .superRefine((env, ctx) => {
    if (env.EXTRACTOR === "gemini" && !env.GEMINI_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["GEMINI_API_KEY"],
        message: 'es obligatoria cuando EXTRACTOR="gemini"',
      });
    }

    if (env.ALLOW_REAL_UPLOADS) {
      for (const key of ["SUPABASE_URL", "SUPABASE_SECRET_KEY"] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "es obligatoria cuando el upload real está habilitado",
          });
        }
      }
    }
  });

export type Env = z.output<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Configuración de entorno inválida:\n- ${problems.join("\n- ")}`);
    this.name = "EnvValidationError";
  }
}

type EnvSource = Record<string, string | undefined>;

/** Valida un objeto de variables de entorno. Función pura: testeable. */
export function parseEnv(source: EnvSource): Env {
  // Las variables vacías ("FOO=") se tratan como no definidas
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== "")
  );

  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    );
  }
  return result.data;
}

let cachedEnv: Env | undefined;

/** Variables de entorno validadas. Se parsean una sola vez por proceso. */
export function getEnv(): Env {
  cachedEnv ??= parseEnv(process.env);
  return cachedEnv;
}

/** Solo para tests: descarta la configuración cacheada. */
export function resetEnvCache(): void {
  cachedEnv = undefined;
}
