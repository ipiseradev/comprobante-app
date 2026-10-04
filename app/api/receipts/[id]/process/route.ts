import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    // Buscar el comprobante
    const receipt = await prisma.receipt.findUnique({
      where: {
        id,
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

    // Evitar procesar dos veces el mismo comprobante
    if (receipt.status === "PROCESSING") {
      return NextResponse.json(
        {
          success: false,
          error: "El comprobante ya está siendo procesado",
        },
        { status: 409 }
      );
    }

    // Cambiar estado a PROCESSING
    const updatedReceipt = await prisma.receipt.update({
      where: {
        id: receipt.id,
      },
      data: {
        status: "PROCESSING",
      },
    }); 

    return NextResponse.json({
      success: true,
      message: "Procesamiento iniciado",
      receipt: updatedReceipt,
    });
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