
import { readFile } from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";

import { GeminiReceiptExtractor } from "../lib/ocr/gemini-extractor";
import { RECEIPT_EXTRACTION_PROMPT } from "../lib/ocr/prompt";
import type { ExtractedReceiptData } from "../lib/ocr/schema";
import type { ReceiptImageMimeType } from "../lib/ocr/types";

dotenv.config();

const BENCHMARK_DIR = path.join(process.cwd(), "ocr-benchmark");
const requestedImage = process.argv[2];

const IMAGE_IDS = requestedImage
? [requestedImage]
: ["001", "002", "003" , "004"];
const FIELDS = [
  "amount",
  "date",
  "operationNumber",
  "senderName",
  "receiverName",
  "cbuCvu",
  "bank",
] as const satisfies readonly (keyof ExtractedReceiptData)[];

type Field = (typeof FIELDS)[number];

type ExpectedReceipt = ExtractedReceiptData & {
  sourceType: string;
  quality: string;
};

type FieldResult = {
  field: Field;
  expected: unknown;
  obtained: unknown;
  match: boolean;
  /** No coincide exacto, pero sí ignorando mayúsculas, espacios y puntuación */
  nearMatch: boolean;
};

type ImageResult = {
  id: string;
  expected: ExpectedReceipt;
  durationMs: number;
  fields: FieldResult[];
  error?: string;
};

function mimeTypeFromExtension(filePath: string): ReceiptImageMimeType {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

// null es un valor válido: null esperado y null obtenido coinciden.
// Un valor obtenido cuando se esperaba null cuenta como error (dato inventado).
function valuesMatch(expected: unknown, obtained: unknown): boolean {
  if (expected === null || obtained === null) {
    return expected === obtained;
  }
  if (typeof expected === "number" && typeof obtained === "number") {
    return Math.abs(expected - obtained) < 0.005;
  }
  return expected === obtained;
}

function normalize(value: unknown): string {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function compare(expected: ExpectedReceipt, obtained: ExtractedReceiptData | null): FieldResult[] {
  return FIELDS.map((field) => {
    const expectedValue = expected[field];
    const obtainedValue = obtained ? obtained[field] : undefined;
    const match = obtained !== null && valuesMatch(expectedValue, obtainedValue);
    const nearMatch =
      !match &&
      expectedValue !== null &&
      obtainedValue !== null &&
      obtainedValue !== undefined &&
      normalize(expectedValue) === normalize(obtainedValue);

    return { field, expected: expectedValue, obtained: obtainedValue, match, nearMatch };
  });
}

function display(value: unknown): string {
  if (value === undefined) return "—";
  return JSON.stringify(value);
}

function printImageResult(result: ImageResult) {
  const { id, expected, durationMs, fields, error } = result;

  console.log(`\n${"=".repeat(78)}`);
  console.log(
    `Imagen ${id}.jpg  |  sourceType: ${expected.sourceType}  |  quality: ${expected.quality}  |  ${durationMs} ms`
  );
  console.log("=".repeat(78));

  if (error) {
    console.log(`ERROR: ${error}`);
    return;
  }

  console.log("\nResultado estructurado:");
  console.log(
    JSON.stringify(Object.fromEntries(fields.map((f) => [f.field, f.obtained])), null, 2)
  );

  console.log("\nComparación:");
  console.table(
    fields.map((f) => ({
      campo: f.field,
      esperado: display(f.expected),
      obtenido: display(f.obtained),
      coincide: f.match ? "✅" : f.nearMatch ? "≈ (formato)" : "❌",
    }))
  );
}

function printSummary(results: ImageResult[]) {
  console.log(`\n${"=".repeat(78)}`);
  console.log("RESUMEN POR IMAGEN");
  console.log("=".repeat(78));

  console.table(
    results.map((r) => {
      const correct = r.fields.filter((f) => f.match).length;
      return {
        imagen: `${r.id}.jpg`,
        sourceType: r.expected.sourceType,
        quality: r.expected.quality,
        correctos: r.error ? "—" : `${correct}/${FIELDS.length}`,
        fallidos: r.error
          ? "ERROR"
          : r.fields.filter((f) => !f.match).map((f) => f.field).join(", ") || "—",
        ms: r.durationMs,
      };
    })
  );

  // Las imágenes que fallaron por error del proveedor (HTTP, timeout, etc.)
  // no miden la precisión del extractor: se reportan aparte.
  const processed = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);

  console.log("\nRESUMEN POR CAMPO (solo imágenes procesadas)");
  console.table(
    FIELDS.map((field) => {
      const all = processed.map((r) => r.fields.find((f) => f.field === field)!);
      return {
        campo: field,
        correctos: `${all.filter((f) => f.match).length}/${processed.length}`,
      };
    })
  );

  const allFields = processed.flatMap((r) => r.fields);
  const correct = allFields.filter((f) => f.match).length;
  const nearMatches = allFields.filter((f) => f.nearMatch).length;
  const incorrect = allFields.length - correct;
  const accuracy =
    allFields.length > 0 ? `${((correct / allFields.length) * 100).toFixed(1)}%` : "—";

  console.log("\nRESUMEN GLOBAL");
  console.log(`  Imágenes procesadas: ${processed.length}/${results.length}`);
  console.log(`  Campos correctos:    ${correct}/${allFields.length} (${accuracy})`);
  console.log(`  Campos incorrectos:  ${incorrect}`);
  if (nearMatches > 0) {
    console.log(`    de los cuales difieren solo en formato (≈): ${nearMatches}`);
  }
  if (failed.length > 0) {
    console.log(
      `  Imágenes con error (excluidas de la precisión): ${failed
        .map((r) => `${r.id}.jpg`)
        .join(", ")}`
    );
  }

  const leaked = results.filter((r) =>
    FIELDS.some((field) => {
      const value = r.expected[field];
      return typeof value === "string" && RECEIPT_EXTRACTION_PROMPT.includes(value);
    })
  );
  if (leaked.length > 0) {
    console.log(
      `\n⚠️  El prompt contiene valores del ground truth de: ${leaked
        .map((r) => `${r.id}.jpg`)
        .join(", ")}. El resultado de esas imágenes no es una medición válida.`
    );
  }
}

async function runImage(extractor: GeminiReceiptExtractor, id: string): Promise<ImageResult> {
  const imagePath = path.join(BENCHMARK_DIR, "images", `${id}.jpg`);
  const expectedPath = path.join(BENCHMARK_DIR, "expected", `${id}.json`);

  const expected = JSON.parse(await readFile(expectedPath, "utf8")) as ExpectedReceipt;
  const imageBuffer = await readFile(imagePath);

  const startedAt = Date.now();
  try {
    const result = await extractor.extract({
      data: imageBuffer.toString("base64"),
      mimeType: mimeTypeFromExtension(imagePath),
    });
    return {
      id,
      expected,
      durationMs: Date.now() - startedAt,
      fields: compare(expected, result.data),
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    const message = error instanceof Error ? error.message : String(error);
    return {
      id,
      expected,
      durationMs: Date.now() - startedAt,
      fields: compare(expected, null),
      error: `${name}: ${message}`,
    };
  }
}

async function main() {
  const extractor = new GeminiReceiptExtractor();

  console.log(`Proveedor: ${extractor.provider}`);
  console.log(`Modelo: ${extractor.model}`);
  console.log(`Imágenes: ${IMAGE_IDS.map((id) => `${id}.jpg`).join(", ")}`);

  const results: ImageResult[] = [];
  for (const id of IMAGE_IDS) {
    const result = await runImage(extractor, id);
    printImageResult(result);
    results.push(result);
  }

  printSummary(results);
}

main().catch((error: unknown) => {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n${name}: ${message}`);
  process.exitCode = 1;
});
