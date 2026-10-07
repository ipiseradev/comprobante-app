import { getEnv, type LogLevel } from "./env";

/**
 * Logger estructurado: una línea JSON por evento.
 *
 * JSON en lugar de texto libre para que los logs de Vercel se puedan
 * filtrar por campo (requestId, level, event). Sin dependencias: el
 * volumen del MVP no justifica pino/winston.
 *
 * Regla: nunca loguear secrets, imágenes ni datos personales completos
 * (nombres, CUIT, CBU). Loguear IDs y metadatos.
 */

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

type LogFields = Record<string, unknown>;

export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  /** Logger hijo que agrega `bindings` a cada línea (ej. requestId). */
  child(bindings: LogFields): Logger;
}

type LogWriter = (level: LogLevel, line: string) => void;

const defaultWriter: LogWriter = (level, line) => {
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
};

/** Los Error no se serializan con JSON.stringify: se convierten a mano. */
function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(value.cause !== undefined && { cause: serializeValue(value.cause) }),
    };
  }
  return value;
}

export function createLogger(options: {
  level: LogLevel;
  bindings?: LogFields;
  writer?: LogWriter;
}): Logger {
  const { level: minLevel, bindings = {}, writer = defaultWriter } = options;

  function log(level: LogLevel, event: string, fields: LogFields = {}) {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

    const entry: LogFields = {
      time: new Date().toISOString(),
      level,
      event,
      ...bindings,
    };
    for (const [key, value] of Object.entries(fields)) {
      entry[key] = serializeValue(value);
    }
    writer(level, JSON.stringify(entry));
  }

  return {
    debug: (event, fields) => log("debug", event, fields),
    info: (event, fields) => log("info", event, fields),
    warn: (event, fields) => log("warn", event, fields),
    error: (event, fields) => log("error", event, fields),
    child: (childBindings) =>
      createLogger({
        level: minLevel,
        bindings: { ...bindings, ...childBindings },
        writer,
      }),
  };
}

let rootLogger: Logger | undefined;

/** Logger raíz de la app, con el nivel de LOG_LEVEL. */
export function getLogger(): Logger {
  rootLogger ??= createLogger({ level: getEnv().LOG_LEVEL });
  return rootLogger;
}

/** Logger con un requestId propio, para correlacionar todas las líneas de un request. */
export function requestLogger(route: string): Logger {
  return getLogger().child({ requestId: crypto.randomUUID(), route });
}
