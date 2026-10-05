import type { ZodIssue } from "zod";

export class ReceiptExtractorError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;
  }
}

/** GEMINI_API_KEY (u otra credencial del proveedor) no está configurada. */
export class MissingApiKeyError extends ReceiptExtractorError {}

/** El proveedor rechazó las credenciales (401/403). */
export class ExtractorAuthError extends ReceiptExtractorError {
  constructor(
    message: string,
    public readonly status: number,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}

/** El proveedor respondió con un error HTTP no relacionado a autenticación. */
export class ExtractorHttpError extends ReceiptExtractorError {
  constructor(
    message: string,
    public readonly status: number,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}

/** La request al proveedor superó el tiempo límite configurado. */
export class ExtractorTimeoutError extends ReceiptExtractorError {}

/** El proveedor respondió sin contenido de texto utilizable. */
export class EmptyResponseError extends ReceiptExtractorError {}

/** El texto devuelto por el proveedor no es JSON parseable. */
export class InvalidJsonResponseError extends ReceiptExtractorError {
  constructor(
    message: string,
    public readonly rawText: string,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}

/** El JSON devuelto no cumple con el schema de ExtractedReceiptData. */
export class ResponseValidationError extends ReceiptExtractorError {
  constructor(
    message: string,
    public readonly issues: ZodIssue[],
    public readonly rawData: unknown
  ) {
    super(message);
  }
}
