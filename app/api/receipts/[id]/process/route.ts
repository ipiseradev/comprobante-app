import { NextResponse } from "next/server";
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
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        {
          success: false,
          error: "ID de comprobante inválido",
        },
        { status: 400 }
      );
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
      return NextResponse.json(
        {
          success: false,
          error: "Comprobante no encontrado",
        },
        { status: 404 }
      );
    }

    const error =
      receipt.status === "PROCESSING"
        ? "El comprobante ya está siendo procesado"
        : "El comprobante ya fue procesado y no puede volver a procesarse";

    return NextResponse.json(
      {
        success: false,
        error,
        status: receipt.status,
      },
      { status: 409 }
    );
  } catch (error) {
    console.error("Error procesando comprobante:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error interno procesando el comprobante",
      },
      { status: 500 }
    );
  }
}
