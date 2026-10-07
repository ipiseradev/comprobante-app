import { NextRequest, NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  toErrorResponse,
} from "@/lib/errors";
import { requestLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getSupabase } from "@/lib/supabase";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const logger = requestLogger("POST /api/receipts");

  try {
    // En producción el upload real está deshabilitado (modo demo):
    // evita procesar comprobantes reales sin facturación ni auth.
    if (!getEnv().ALLOW_REAL_UPLOADS) {
      throw new ForbiddenError(
        "La carga de comprobantes reales no está habilitada en este entorno."
      );
    }

    const formData = await request.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new BadRequestError("No se recibió ningún archivo");
    }

    // VALIDAR TIPO

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new BadRequestError("Formato de imagen no permitido");
    }

    // VALIDAR TAMAÑO

    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestError("El archivo supera el límite de 10 MB");
    }

    // BUSCAR USUARIO

    const user = await prisma.user.findFirst();

    if (!user) {
      throw new InternalError("No existe ningún usuario en la base");
    }

    // GENERAR NOMBRE ÚNICO

    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const fileName = `${crypto.randomUUID()}.${extension}`;

    const filePath = `${user.id}/${fileName}`;

    // CONVERTIR FILE → BUFFER

    const fileBuffer = Buffer.from(
      await file.arrayBuffer()
    );

    // SUBIR A SUPABASE

    const { error: uploadError } = await getSupabase()
      .storage.from("receipts")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new InternalError("Error subiendo imagen a Supabase Storage", {
        cause: uploadError,
      });
    }

    // OBTENER PATH DEL ARCHIVO
    // imageUrl guarda el path privado dentro del bucket, no una URL pública

    const imageUrl = filePath;

    // CREAR RECEIPT

    const receipt = await prisma.receipt.create({
      data: {
        userId: user.id,
        imageUrl,
        status: "UPLOADED",
      },
    });

    logger.info("receipt_uploaded", {
      receiptId: receipt.id,
      mimeType: file.type,
      sizeBytes: file.size,
    });

    return NextResponse.json({
      success: true,
      receipt,
    });
  } catch (error) {
    return toErrorResponse(error, logger);
  }
}
