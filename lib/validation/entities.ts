/**
 * Bancos y billeteras reconocibles, para comparar el banco que dice el
 * comprobante con el prefijo de su CBU/CVU.
 *
 * Criterio: solo se incluyen códigos confirmados en más de una fuente
 * (listados del BCRA y relevamientos públicos). Un código ausente hace que
 * la regla quede "no verificable"; un código equivocado generaría falsos
 * positivos sobre comprobantes legítimos, que es mucho peor.
 */

export interface BankEntity {
  kind: "bank";
  /** Código de entidad BCRA: primeros 3 dígitos del CBU. */
  code: string;
  name: string;
  aliases: string[];
}

export interface WalletEntity {
  kind: "wallet";
  name: string;
  /**
   * Prefijo de sus CVU, si está confirmado. Sin prefijo solo se puede
   * verificar que use un CVU (código 000), no que sea de esta billetera.
   */
  cvuPrefix: string | null;
  aliases: string[];
}

export type FinancialEntity = BankEntity | WalletEntity;

const bank = (code: string, name: string, aliases: string[] = []): BankEntity => ({
  kind: "bank",
  code,
  name,
  aliases,
});

export const BANKS: readonly BankEntity[] = [
  bank("007", "Banco Galicia", ["galicia"]),
  bank("011", "Banco de la Nación Argentina", ["nacion", "bna"]),
  bank("014", "Banco de la Provincia de Buenos Aires", [
    "provincia buenos aires",
    "provincia bs as",
    "bapro",
  ]),
  bank("015", "ICBC", ["icbc", "industrial commercial china"]),
  bank("017", "BBVA Argentina", ["bbva", "frances"]),
  bank("020", "Banco de la Provincia de Córdoba", ["provincia cordoba", "bancor"]),
  bank("027", "Banco Supervielle", ["supervielle"]),
  bank("029", "Banco Ciudad", ["ciudad buenos aires", "ciudad"]),
  bank("034", "Banco Patagonia", ["patagonia"]),
  bank("044", "Banco Hipotecario", ["hipotecario"]),
  bank("045", "Banco de San Juan", ["san juan"]),
  bank("065", "Banco Municipal de Rosario", ["municipal rosario"]),
  bank("072", "Banco Santander Argentina", ["santander"]),
  bank("083", "Banco del Chubut", ["chubut"]),
  bank("086", "Banco de Santa Cruz", ["santa cruz"]),
  bank("093", "Banco de La Pampa", ["pampa"]),
  bank("094", "Banco de Corrientes", ["corrientes"]),
  bank("097", "Banco Provincia del Neuquén", ["neuquen"]),
  bank("143", "Brubank", ["brubank"]),
  bank("147", "Banco Interfinanzas", ["interfinanzas"]),
  bank("150", "HSBC", ["hsbc"]),
  bank("165", "JPMorgan Chase", ["jpmorgan", "jp morgan"]),
  bank("191", "Banco Credicoop", ["credicoop"]),
  bank("198", "Banco de Valores", ["valores"]),
  bank("247", "Banco Roela", ["roela"]),
  bank("254", "Banco Mariva", ["mariva"]),
  bank("259", "Banco Itaú", ["itau"]),
  bank("266", "BNP Paribas", ["bnp paribas"]),
  bank("268", "Banco Provincia de Tierra del Fuego", ["tierra fuego"]),
  bank("269", "Banco de la República Oriental del Uruguay", ["brou", "republica oriental uruguay"]),
  bank("277", "Banco Sáenz", ["saenz"]),
  bank("281", "Banco Meridian", ["meridian"]),
  bank("285", "Banco Macro", ["macro"]),
  bank("299", "Banco Comafi", ["comafi"]),
  bank("300", "BICE", ["bice", "inversion comercio exterior"]),
  bank("301", "Banco Piano", ["piano"]),
  bank("330", "Nuevo Banco de Santa Fe", ["santa fe"]),
  bank("331", "Banco Cetelem", ["cetelem"]),
  bank("332", "Banco de Servicios Financieros", ["servicios financieros"]),
  bank("336", "Banco Bradesco", ["bradesco"]),
  bank("338", "Banco de Servicios y Transacciones", ["servicios transacciones"]),
  bank("340", "BACS", ["bacs"]),
  bank("341", "Banco Masventas", ["masventas"]),
  bank("386", "Nuevo Banco de Entre Ríos", ["entre rios"]),
  bank("389", "Banco Columbia", ["columbia"]),
  bank("431", "Banco Coinag", ["coinag"]),
  bank("432", "Banco de Comercio", ["banco comercio"]),
];

export const WALLETS: readonly WalletEntity[] = [
  {
    kind: "wallet",
    name: "Mercado Pago",
    // Confirmado en fuentes públicas y en comprobantes reales del benchmark
    cvuPrefix: "0000003",
    aliases: ["mercado pago", "mercadopago"],
  },
];

const ALL_ENTITIES: readonly FinancialEntity[] = [...BANKS, ...WALLETS];

/** Palabras que no distinguen a una entidad de otra. */
const STOPWORDS = new Set([
  "banco", "bank", "de", "del", "la", "las", "los", "el", "y", "e",
  "s", "a", "sa", "sau", "argentina", "argentino", "arg", "the", "nuevo",
]);

/** "Banco de la Provincia de Bs. As. S.A." → "provincia bs as" */
export function normalizeEntityName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word && !STOPWORDS.has(word))
    .join(" ");
}

/** true si `alias` aparece como secuencia completa de palabras en `text`. */
function containsPhrase(text: string, alias: string): boolean {
  return ` ${text} `.includes(` ${alias} `);
}

/**
 * Identifica el banco o billetera a partir del texto del comprobante.
 * Devuelve null si no se reconoce o si es ambiguo (coincide con varias).
 */
export function findEntityByName(name: string): FinancialEntity | null {
  const normalized = normalizeEntityName(name);
  if (!normalized) return null;

  const matches = ALL_ENTITIES.filter((entity) =>
    [entity.name, ...entity.aliases].some((alias) =>
      containsPhrase(normalized, normalizeEntityName(alias))
    )
  );

  return matches.length === 1 ? matches[0] : null;
}

export function findBankByCode(code: string): BankEntity | null {
  return BANKS.find((entity) => entity.code === code) ?? null;
}
