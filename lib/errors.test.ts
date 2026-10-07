import { describe, expect, it } from "vitest";

import {
  BadRequestError,
  ConflictError,
  GENERIC_ERROR_MESSAGE,
  InternalError,
  RateLimitError,
  toErrorResponse,
} from "./errors";
import { createLogger } from "./logger";

function captureLogger() {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger({
    level: "debug",
    writer: (_level, line) => lines.push(JSON.parse(line)),
  });
  return { logger, lines };
}

describe("toErrorResponse", () => {
  it("devuelve el status y el mensaje público de un AppError", async () => {
    const { logger } = captureLogger();

    const response = toErrorResponse(new BadRequestError("Archivo inválido"), logger);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: "Archivo inválido",
      code: "BAD_REQUEST",
    });
  });

  it("no filtra el mensaje de un error desconocido al cliente", async () => {
    const { logger, lines } = captureLogger();

    const response = toErrorResponse(
      new Error('relation "Receipt" does not exist'),
      logger
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe(GENERIC_ERROR_MESSAGE);
    expect(JSON.stringify(body)).not.toContain("Receipt");
    // ...pero el detalle sí queda en los logs
    expect(JSON.stringify(lines)).toContain('relation \\"Receipt\\" does not exist');
  });

  it("no filtra el mensaje interno de un InternalError", async () => {
    const { logger } = captureLogger();

    const response = toErrorResponse(
      new InternalError("Supabase devolvió 500 en el bucket receipts"),
      logger
    );

    expect(JSON.stringify(await response.json())).not.toContain("Supabase");
  });

  it("loguea los 4xx como warn y los 5xx como error", () => {
    const { logger, lines } = captureLogger();

    toErrorResponse(new ConflictError("Ya procesado"), logger);
    toErrorResponse(new Error("boom"), logger);

    expect(lines.map((l) => l.level)).toEqual(["warn", "error"]);
  });

  it("agrega Retry-After en los errores de rate limit", () => {
    const { logger } = captureLogger();

    const response = toErrorResponse(new RateLimitError(30), logger);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
  });

  it("incluye campos extra sin pisar los campos de error", async () => {
    const { logger } = captureLogger();

    const response = toErrorResponse(new ConflictError("Ya procesado"), logger, {
      status: "COMPLETED",
      success: true,
    });

    expect(await response.json()).toEqual({
      status: "COMPLETED",
      success: false,
      error: "Ya procesado",
      code: "CONFLICT",
    });
  });
});
