/**
 * Script de prueba aislado para GeminiReceiptExtractor.
 *
 * No toca PostgreSQL ni Supabase, no crea Receipt/OcrData/Validation.
 * Solo ejecuta el extractor contra una imagen local y muestra el resultado.
 *
 * Uso: npm run test:gemini
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";

import { GeminiReceiptExtractor } from "../lib/ocr/gemini-extractor";
import type { ReceiptImageMimeType } from "../lib/ocr/types";

dotenv.config();

const IMAGE_PATH = path.join(process.cwd(), "ocr-benchmark", "images", "001.jpg");

function mimeTypeFromExtension(filePath: string): ReceiptImageMimeType {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function main() {
  const imageBuffer = await readFile(IMAGE_PATH);
  const extractor = new GeminiReceiptExtractor();

  console.log(`Proveedor: ${extractor.provider}`);
  console.log(`Modelo: ${extractor.model}`);
  console.log(`Imagen: ${IMAGE_PATH}`);

  const result = await extractor.extract({
    data: imageBuffer.toString("base64"),
    mimeType: mimeTypeFromExtension(IMAGE_PATH),
  });

  console.log("\nResultado estructurado:");
  console.log(JSON.stringify(result.data, null, 2));
}

main().catch((error: unknown) => {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n${name}: ${message}`);
  process.exitCode = 1;
});
