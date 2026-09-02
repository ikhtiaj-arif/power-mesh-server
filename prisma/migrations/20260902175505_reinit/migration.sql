/*
  Warnings:

  - You are about to drop the column `zoneId` on the `capacity_offers` table. All the data in the column will be lost.
  - You are about to drop the column `zoneId` on the `capacity_requests` table. All the data in the column will be lost.
  - You are about to drop the column `zoneId` on the `consumers` table. All the data in the column will be lost.
  - The `status` column on the `incidents` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `zoneId` on the `operators` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedDurationMins` on the `outage_events` table. All the data in the column will be lost.
  - You are about to drop the column `zoneId` on the `outage_events` table. All the data in the column will be lost.
  - You are about to drop the column `paymentMethod` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `webhookStatus` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `zoneId` on the `providers` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `refunds` table. All the data in the column will be lost.
  - You are about to drop the `service_zones` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[reservationId]` on the table `ratings` will be added. If there are existing duplicate values, this will fail.
  - Made the column `eventId` on table `capacity_offers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `eventId` on table `capacity_requests` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `survivalQuotaKw` to the `outage_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalCapacityKw` to the `outage_events` table without a default value. This is not possible if the table is not empty.
  - Made the column `reservationId` on table `ratings` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- DropForeignKey
ALTER TABLE "capacity_offers" DROP CONSTRAINT "capacity_offers_eventId_fkey";

-- DropForeignKey
ALTER TABLE "capacity_offers" DROP CONSTRAINT "capacity_offers_zoneId_fkey";

-- DropForeignKey
ALTER TABLE "capacity_requests" DROP CONSTRAINT "capacity_requests_eventId_fkey";

-- DropForeignKey
ALTER TABLE "capacity_requests" DROP CONSTRAINT "capacity_requests_zoneId_fkey";

-- DropForeignKey
ALTER TABLE "consumers" DROP CONSTRAINT "consumers_zoneId_fkey";

-- DropForeignKey
ALTER TABLE "operators" DROP CONSTRAINT "operators_zoneId_fkey";

-- DropForeignKey
ALTER TABLE "outage_events" DROP CONSTRAINT "outage_events_zoneId_fkey";

-- DropForeignKey
ALTER TABLE "providers" DROP CONSTRAINT "providers_zoneId_fkey";

-- DropForeignKey
ALTER TABLE "ratings" DROP CONSTRAINT "ratings_reservationId_fkey";

-- DropIndex
DROP INDEX "capacity_offers_zoneId_status_idx";

-- DropIndex
DROP INDEX "capacity_requests_eventId_priorityTier_idx";

-- DropIndex
DROP INDEX "capacity_requests_zoneId_status_idx";

-- DropIndex
DROP INDEX "consumers_userId_zoneId_key";

-- DropIndex
DROP INDEX "consumers_zoneId_idx";

-- DropIndex
DROP INDEX "incidents_createdAt_idx";

-- DropIndex
DROP INDEX "operators_userId_zoneId_key";

-- DropIndex
DROP INDEX "operators_zoneId_idx";

-- DropIndex
DROP INDEX "outage_events_createdAt_idx";

-- DropIndex
DROP INDEX "outage_events_zoneId_status_idx";

-- DropIndex
DROP INDEX "payments_webhookStatus_idx";

-- DropIndex
DROP INDEX "providers_userId_zoneId_key";

-- DropIndex
DROP INDEX "providers_zoneId_idx";

-- DropIndex
DROP INDEX "ratings_createdAt_idx";

-- DropIndex
DROP INDEX "ratings_providerId_idx";

-- DropIndex
DROP INDEX "refunds_reason_idx";

-- DropIndex
DROP INDEX "refunds_status_idx";

-- AlterTable
ALTER TABLE "capacity_offers" DROP COLUMN "zoneId",
ALTER COLUMN "eventId" SET NOT NULL;

-- AlterTable
ALTER TABLE "capacity_requests" DROP COLUMN "zoneId",
ALTER COLUMN "eventId" SET NOT NULL;

-- AlterTable
ALTER TABLE "consumers" DROP COLUMN "zoneId";

-- AlterTable
ALTER TABLE "incidents" DROP COLUMN "status",
ADD COLUMN     "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "operators" DROP COLUMN "zoneId",
ALTER COLUMN "roleLevel" SET DEFAULT 'operator';

-- AlterTable
ALTER TABLE "outage_events" DROP COLUMN "estimatedDurationMins",
DROP COLUMN "zoneId",
ADD COLUMN     "allocatedKw" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "survivalQuotaKw" INTEGER NOT NULL,
ADD COLUMN     "totalCapacityKw" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "paymentMethod",
DROP COLUMN "webhookStatus",
ALTER COLUMN "gatewayId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "providers" DROP COLUMN "zoneId";

-- AlterTable
ALTER TABLE "ratings" ALTER COLUMN "reservationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "refunds" DROP COLUMN "status";

-- DropTable
DROP TABLE "service_zones";

-- CreateIndex
CREATE INDEX "capacity_offers_providerId_status_idx" ON "capacity_offers"("providerId", "status");

-- CreateIndex
CREATE INDEX "capacity_requests_eventId_status_priorityTier_idx" ON "capacity_requests"("eventId", "status", "priorityTier");

-- CreateIndex
CREATE INDEX "capacity_requests_consumerId_status_idx" ON "capacity_requests"("consumerId", "status");

-- CreateIndex
CREATE INDEX "consumers_deletedAt_idx" ON "consumers"("deletedAt");

-- CreateIndex
CREATE INDEX "incidents_providerId_status_idx" ON "incidents"("providerId", "status");

-- CreateIndex
CREATE INDEX "incidents_occurredAt_idx" ON "incidents"("occurredAt");

-- CreateIndex
CREATE INDEX "operators_createdAt_idx" ON "operators"("createdAt");

-- CreateIndex
CREATE INDEX "outage_events_status_scheduledStart_idx" ON "outage_events"("status", "scheduledStart");

-- CreateIndex
CREATE INDEX "outage_events_operatorId_idx" ON "outage_events"("operatorId");

-- CreateIndex
CREATE INDEX "providers_deletedAt_idx" ON "providers"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_reservationId_key" ON "ratings"("reservationId");

-- CreateIndex
CREATE INDEX "ratings_providerId_createdAt_idx" ON "ratings"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "ratings_consumerId_createdAt_idx" ON "ratings"("consumerId", "createdAt");

-- AddForeignKey
ALTER TABLE "capacity_offers" ADD CONSTRAINT "capacity_offers_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "outage_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_requests" ADD CONSTRAINT "capacity_requests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "outage_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
