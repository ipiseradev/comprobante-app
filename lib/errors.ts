import { NextResponse } from "next/server";

import type { Logger } from "./logger";

export const GENERIC_ERROR_MESSAGE =
  "Ocurrió un error inesperado. Intentá de nuevo en unos minutos.";

/**
 * Errores de aplicación con un mensaje pensado para el cliente.
 *
 * `publicMessage` es lo único que llega al usuario; el `message` interno,
 * el stack y la causa solo van a los logs. Así ningún detalle de
 * infraestructura (SQL, rutas, proveedores) se filtra en una respuesta.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    public readonly publicMessage: string,
    options?: ErrorOptions & { internalMessage?: string }
  ) {
    super(options?.internalMessage ?? publicMessage, options);
    this.name = this.constructor.name;
  }
}

export class BadRequestError extends AppError {
  constructor(publicMessage: string, options?: ErrorOptions) {
    super("BAD_REQUEST", 400, publicMessage, options);
  }
}

export class ForbiddenError extends AppError {
  constructor(publicMessage: string, options?: ErrorOptions) {
    super("FORBIDDEN", 403, publicMessage, options);
  }
}

export class NotFoundError extends AppError {
  constructor(publicMessage: string, options?: ErrorOptions) {
    super("NOT_FOUND", 404, publicMessage, options);
  }
}

export class ConflictError extends AppError {
  constructor(publicMessage: string, options?: ErrorOptions) {
    super("CONFLICT", 409, publicMessage, options);
  }
}

export class RateLimitError extends AppError {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      "RATE_LIMITED",
      429,
      "Hiciste demasiadas solicitudes. Esperá un momento y volvé a intentar."
    );
  }
}

/** Error de infraestructura o de un proveedor externo: el detalle queda en logs. */
export class InternalError extends AppError {
  constructor(internalMessage: string, options?: ErrorOptions) {
    super("INTERNAL_ERROR", 500, GENERIC_ERROR_MESSAGE, {
      ...options,
      internalMessage,
    });
  }
}

/** Forma de toda respuesta de error de la API. */
export interface ErrorResponseBody {
  success: false;
  /** Mensaje para mostrar al usuario. */
  error: string;
  /** Código estable para que el cliente distinga casos sin parsear texto. */
  code: string;
}

/**
 * Convierte cualquier error en una respuesta HTTP segura y lo loguea.
 * Errores que no son AppError se tratan como 500 genérico.
 */
export function toErrorResponse(
  error: unknown,
  logger: Logger,
  extraBody: Record<string, unknown> = {}
): NextResponse<ErrorResponseBody> {
  const appError =
    error instanceof AppError
      ? error
      : new InternalError("Error no controlado", { cause: error });

  // Los 4xx son esperables (input inválido, conflictos): warn.
  // Los 5xx indican un problema nuestro o de un proveedor: error.
  const logLevel = appError.httpStatus >= 500 ? "error" : "warn";
  logger[logLevel]("request_failed", {
    code: appError.code,
    status: appError.httpStatus,
    error: appError,
  });

  const headers: HeadersInit = {};
  if (appError instanceof RateLimitError) {
    headers["Retry-After"] = String(appError.retryAfterSeconds);
  }

  return NextResponse.json(
    {
      ...extraBody,
      success: false,
      error: appError.publicMessage,
      code: appError.code,
    },
    { status: appError.httpStatus, headers }
  );
}
