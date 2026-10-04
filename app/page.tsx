"use client";

import { ChangeEvent, DragEvent, useState } from "react";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  function validateFile(selectedFile: File) {
    setError("");
    setUploadSuccess("");

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setError("Formato no permitido. Usá JPG, PNG o WEBP.");
      return false;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("El archivo es demasiado grande. Máximo permitido: 10 MB.");
      return false;
    }

    return true;
  }

  function handleFile(selectedFile: File) {
    if (!validateFile(selectedFile)) {
      return;
    }

    // Liberar preview anterior si existe
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setFile(selectedFile);

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreview(objectUrl);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    handleFile(selectedFile);

    // Permite volver a seleccionar el mismo archivo
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const droppedFile = event.dataTransfer.files?.[0];

    if (!droppedFile) {
      return;
    }

    handleFile(droppedFile);
  }

  function removeFile() {
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setFile(null);
    setPreview(null);
    setError("");
    setUploadSuccess("");
  }

  async function handleUpload() {
    if (!file) {
      setError("Primero seleccioná un comprobante.");
      return;
    }

    try {
      setIsUploading(true);
      setError("");
      setUploadSuccess("");

      const formData = new FormData();

      formData.append("file", file);

      const response = await fetch("/api/receipts", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No se pudo subir el comprobante."
        );
      }

      console.log("Receipt creado:", data);

      setUploadSuccess(
        `Comprobante creado correctamente. ID: ${data.receipt.id}`
      );
    } catch (error) {
      console.error("Error subiendo comprobante:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al subir el comprobante."
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        {/* HEADER */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Verificar comprobante
          </h1>

          <p className="mt-3 text-slate-600">
            Subí una imagen del comprobante para comenzar el análisis.
          </p>
        </div>

        {/* CARD PRINCIPAL */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {!file ? (
            /* =========================
               ESTADO: SIN ARCHIVO
               ========================= */
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => {
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-10 text-center transition ${
                isDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-300 bg-slate-50"
              }`}
            >
              {/* ICONO */}
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl">
                📄
              </div>

              {/* TITULO */}
              <h2 className="mt-5 text-lg font-semibold text-slate-900">
                Subí tu comprobante
              </h2>

              {/* DESCRIPCION */}
              <p className="mt-2 text-sm text-slate-500">
                Arrastrá una imagen acá o seleccioná un archivo.
              </p>

              {/* INPUT */}
              <label className="mt-6 inline-flex cursor-pointer items-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
                Seleccionar comprobante

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={handleInputChange}
                  className="hidden"
                />
              </label>

              {/* FORMATOS */}
              <p className="mt-4 text-xs text-slate-400">
                JPG, PNG o WEBP · Máximo 10 MB
              </p>
            </div>
          ) : (
            /* =========================
               ESTADO: ARCHIVO SELECCIONADO
               ========================= */
            <div>
              {/* INFORMACION DEL ARCHIVO */}
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-900">
                    Comprobante seleccionado
                  </h2>

                  <p className="mt-1 truncate text-sm text-slate-500">
                    {file.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                <button
                  type="button"
                  onClick={removeFile}
                  disabled={isUploading}
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cambiar
                </button>
              </div>

              {/* PREVIEW */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {preview && (
                  <img
                    src={preview}
                    alt="Vista previa del comprobante"
                    className="max-h-[600px] w-full object-contain"
                  />
                )}
              </div>

              {/* BOTON ANALIZAR */}
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
                className="mt-6 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploading
                  ? "Subiendo comprobante..."
                  : "Analizar comprobante"}
              </button>

              {/* ESTADO EXITOSO */}
              {uploadSuccess && (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {uploadSuccess}
                </div>
              )}
            </div>
          )}

          {/* ERROR */}
          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* INFORMACION */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400">
            Tus comprobantes serán procesados de forma segura.
          </p>
        </div>
      </div>
    </main>
  );
}