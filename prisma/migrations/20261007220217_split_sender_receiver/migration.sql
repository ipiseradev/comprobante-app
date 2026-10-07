-- Separa los datos de origen y destino del comprobante.
-- Se usa RENAME (y no DROP + ADD, que es lo que genera Prisma) para
-- conservar los datos existentes: "bank" pasa a ser el emisor del
-- comprobante y "cbuCvu" siempre guardó el CBU/CVU del destinatario.

ALTER TABLE "OcrData" RENAME COLUMN "bank" TO "issuer";
ALTER TABLE "OcrData" RENAME COLUMN "cbuCvu" TO "receiverCbuCvu";

ALTER TABLE "OcrData"
ADD COLUMN "senderCbuCvu" TEXT,
ADD COLUMN "senderBank" TEXT,
ADD COLUMN "receiverBank" TEXT;
