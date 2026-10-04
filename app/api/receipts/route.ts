import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "No se recibió ningún archivo",
        },
        { status: 400 }
      );
    }

    // VALIDAR TIPO

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Formato de imagen no permitido",
        },
        { status: 400 }
      );
    }

    // VALIDAR TAMAÑO

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: "El archivo supera el límite de 10 MB",
        },
        { status: 400 }
      );
    }

    // BUSCAR USUARIO

    const user = await prisma.user.findFirst();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "No existe ningún usuario",
        },
        { status: 400 }
      );
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
    
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error subiendo imagen:", uploadError);

      return NextResponse.json(
        {
          success: false,
          error: "No se pudo guardar la imagen",
        },
        { status: 500 }
      );
    }

    // OBTENER PATH DEL ARCHIVO

    const imageUrl = filePath;

    // CREAR RECEIPT
    

    const receipt = await prisma.receipt.create({
      data: {
        userId: user.id,
        imageUrl,
        status: "UPLOADED",
      },
    });

    // RESPUESTA
  
    return NextResponse.json({
      success: true,
      receipt,
    });
  } catch (error) {
    console.error("Error creando receipt:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error interno creando el comprobante",
      },
      { status: 500 }
    );
  }
}