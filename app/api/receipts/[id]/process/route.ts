import { NextResponse } from "next/server";

import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  toErrorResponse,
} from "@/lib/errors";
import { requestLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { statusesAllowedToTransitionTo } from "@/lib/receipt-status";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  context: RouteContext
) {
  const logger = requestLogger("POST /api/receipts/[id]/process");
  let currentStatus: string | undefined;

  try {
    const { id } = await context.params;

    if (!UUID_REGEX.test(id)) {
      throw new BadRequestError("ID de comprobante inválido");
    }

    // Cambio de estado atómico: solo pasa a PROCESSING si el estado
    // actual lo permite (UPLOADED o ERROR). Si dos requests llegan a la
    // vez, solo uno actualiza la fila; el otro obtiene 0 filas.
    const [updatedReceipt] = await prisma.receipt.updateManyAndReturn({
      where: {
        id,
        status: {
          in: statusesAllowedToTransitionTo("PROCESSING"),
        },
      },
      data: {
        status: "PROCESSING",
        processingAttempts: {
          increment: 1,
        },
      },
    });

    if (updatedReceipt) {
      logger.info("receipt_processing_started", {
        receiptId: id,
        attempt: updatedReceipt.processingAttempts,
      });

      return NextResponse.json({
        success: true,
        message: "Procesamiento iniciado",
        receipt: updatedReceipt,
      });
    }

    // No se actualizó: o no existe, o su estado no permite procesarlo
    const receipt = await prisma.receipt.findUnique({
      where: {
        id,
      },
      select: {
        status: true,
      },
    });

    if (!receipt) {
      throw new NotFoundError("Comprobante no encontrado");
    }

    currentStatus = receipt.status;

    throw new ConflictError(
      receipt.status === "PROCESSING"
        ? "El comprobante ya está siendo procesado"
        : "El comprobante ya fue procesado y no puede volver a procesarse"
    );
  } catch (error) {
    // El 409 incluye el estado actual para que el cliente sepa qué mostrar
    return toErrorResponse(
      error,
      logger,
      currentStatus ? { status: currentStatus } : {}
    );
  }
}
