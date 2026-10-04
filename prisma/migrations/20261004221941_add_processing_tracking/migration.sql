-- AlterTable
ALTER TABLE "OcrData" ADD COLUMN     "fieldChecks" JSONB,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "rawResponse" JSONB;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "imageHash" TEXT,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "processingAttempts" INTEGER NOT NULL DEFAULT 0;
