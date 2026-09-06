-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "bkashTrxId" TEXT,
ADD COLUMN     "gatewayResponse" JSONB,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "payerReference" TEXT;
