-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH_OUT', 'SEND_MONEY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'RECEIVED', 'PROCESSED', 'FAILED');

-- AlterTable (backfill existing rows with a deterministic value)
ALTER TABLE "payments" ADD COLUMN     "merchantInvoiceNumber" TEXT;
ALTER TABLE "payments" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "payments" ADD COLUMN     "webhookStatus" "WebhookStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill merchantInvoiceNumber for existing rows
UPDATE "payments" SET "merchantInvoiceNumber" = CONCAT('PM-', "id") WHERE "merchantInvoiceNumber" IS NULL;

-- Add NOT NULL and unique constraint
ALTER TABLE "payments" ALTER COLUMN "merchantInvoiceNumber" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payments_merchantInvoiceNumber_key" ON "payments"("merchantInvoiceNumber");

-- CreateIndex
CREATE INDEX "payments_webhookStatus_idx" ON "payments"("webhookStatus");
