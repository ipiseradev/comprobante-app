import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // 1. Buscar el Receipt más reciente
    const receipt = await prisma.receipt.findFirst({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        ocrData: true,
      },
    });

    if (!receipt) {
      return NextResponse.json(
        {
          success: false,
          error: "No existe ningún receipt para realizar la prueba",
        },
        { status: 404 }
      );
    }

    if (!receipt.ocrData) {
      return NextResponse.json(
        {
          success: false,
          error: "El receipt no tiene datos OCR",
        },
        { status: 400 }
      );
    }

    // 2. Simular las validaciones del sistema
    const checks = {
      amount: receipt.ocrData.amount !== null,
      date: receipt.ocrData.date !== null,
      operationNumber:
        receipt.ocrData.operationNumber !== null &&
        receipt.ocrData.operationNumber.trim() !== "",
      senderName:
        receipt.ocrData.senderName !== null &&
        receipt.ocrData.senderName.trim() !== "",
      receiverName:
        receipt.ocrData.receiverName !== null &&
        receipt.ocrData.receiverName.trim() !== "",
      bank:
        receipt.ocrData.bank !== null &&
        receipt.ocrData.bank.trim() !== "",
      cbuCvu:
        receipt.ocrData.cbuCvu !== null &&
        receipt.ocrData.cbuCvu.trim() !== "",
    };

    // 3. Contar validaciones correctas
    const totalChecks = Object.keys(checks).length;

    const passedChecks = Object.values(checks).filter(Boolean).length;

    // 4. Calcular un riesgo inicial
    const failedChecks = totalChecks - passedChecks;

    const riskScore = Math.round(
      (failedChecks / totalChecks) * 100
    );

    // 5. Determinar el estado
    let status: "CONSISTENT" | "REVIEW" | "INCONSISTENT";

    if (riskScore === 0) {
      status = "CONSISTENT";
    } else if (riskScore <= 40) {
      status = "REVIEW";
    } else {
      status = "INCONSISTENT";
    }

    // 6. Guardar la validación
    const validation = await prisma.validation.create({
      data: {
        receiptId: receipt.id,
        status,
        riskScore,
        checks,
      },
    });

    // 7. Recuperar la validación junto con el Receipt
    const validationWithReceipt =
      await prisma.validation.findUnique({
        where: {
          id: validation.id,
        },
        include: {
          receipt: true,
        },
      });

    return NextResponse.json({
      success: true,
      validation: validationWithReceipt,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Error creando la validación",
      },
      { status: 500 }
    );
  }
}