/**
 * Estructura y dígitos verificadores de CBU/CVU (Argentina).
 *
 * 22 dígitos en dos bloques:
 *   Bloque 1 (8): entidad (3) + sucursal (4) + verificador (1)
 *   Bloque 2 (14): cuenta (13) + verificador (1)
 *
 * Cada verificador es (10 - (Σ dígito × peso) mod 10) mod 10, con los pesos
 * 7-1-3-9 repetidos. El CVU (cuentas de billeteras virtuales) usa la misma
 * estructura y algoritmo, con el código de entidad "000".
 */

export const CBU_LENGTH = 22;

/** Código de entidad reservado para CVU: ningún banco usa "000". */
export const CVU_ENTITY_CODE = "000";

const BLOCK_1_WEIGHTS = [7, 1, 3, 9, 7, 1, 3];
const BLOCK_2_WEIGHTS = [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3];

function checkDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((acc, weight, i) => acc + weight * Number(digits[i]), 0);
  return (10 - (sum % 10)) % 10;
}

export function hasCbuShape(value: string): boolean {
  return value.length === CBU_LENGTH && /^\d+$/.test(value);
}

/** true si tiene 22 dígitos y ambos verificadores son correctos. */
export function isValidCbuChecksum(value: string): boolean {
  if (!hasCbuShape(value)) return false;
  return (
    checkDigit(value.slice(0, 7), BLOCK_1_WEIGHTS) === Number(value[7]) &&
    checkDigit(value.slice(8, 21), BLOCK_2_WEIGHTS) === Number(value[21])
  );
}

export function entityCode(cbu: string): string {
  return cbu.slice(0, 3);
}

export function isCvu(cbu: string): boolean {
  return entityCode(cbu) === CVU_ENTITY_CODE;
}

/**
 * Arma un CBU/CVU válido a partir de los 7 dígitos del bloque 1 (sin
 * verificador) y los 13 del bloque 2. Se usa para generar datos de prueba
 * y comprobantes sintéticos de la demo.
 */
export function buildCbu(block1: string, account: string): string {
  if (!/^\d{7}$/.test(block1) || !/^\d{13}$/.test(account)) {
    throw new Error("buildCbu espera 7 dígitos de bloque 1 y 13 de cuenta");
  }
  return (
    block1 +
    checkDigit(block1, BLOCK_1_WEIGHTS) +
    account +
    checkDigit(account, BLOCK_2_WEIGHTS)
  );
}
