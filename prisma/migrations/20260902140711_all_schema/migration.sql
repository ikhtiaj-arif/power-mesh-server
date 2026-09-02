/*
  Warnings:

  - You are about to drop the column `name` on the `users` table. All the data in the column will be lost.
  - Added the required column `firstName` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PROVIDER', 'CONSUMER', 'OPERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('GENERATOR', 'SOLAR_BESS', 'BATTERY', 'MICROGRID', 'OTHER');

-- CreateEnum
CREATE TYPE "PriorityTier" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ALLOCATED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'DELIVERY_PENDING', 'DELIVERY_CONFIRMED', 'DELIVERY_PARTIAL', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING_CHECKIN', 'CONFIRMED', 'DISPUTED', 'RESOLVED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('NO_SHOW', 'PARTIAL_DELIVERY', 'GRID_STAYED_ON', 'TECHNICAL_FAILURE', 'OTHER');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('AVAILABLE', 'PARTIALLY_AVAILABLE', 'FULLY_ALLOCATED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'ALLOCATED', 'REJECTED', 'CANCELLED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "OutageEventStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'RESERVE', 'ALLOCATE', 'PAY', 'REFUND', 'CONFIRM_DELIVERY', 'DISPUTE', 'RESOLVE');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "name",
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastName" TEXT NOT NULL,
ADD COLUMN     "role" "UserRole" NOT NULL;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacity_offers" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "eventId" TEXT,
    "capacityKw" INTEGER NOT NULL,
    "pricePerKwh" DECIMAL(10,4) NOT NULL,
    "deliveryStart" TIMESTAMP(3) NOT NULL,
    "deliveryEnd" TIMESTAMP(3) NOT NULL,
    "reservedKw" INTEGER NOT NULL DEFAULT 0,
    "status" "OfferStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "capacity_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacity_requests" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "eventId" TEXT,
    "requestedKw" INTEGER NOT NULL,
    "maxPricePerKwh" DECIMAL(10,4) NOT NULL,
    "priorityTier" "PriorityTier" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "capacity_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "criticalLoadKw" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "consumers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "confirmedByProvider" TEXT,
    "confirmedByConsumer" TEXT,
    "providerConfirmedAt" TIMESTAMP(3),
    "consumerConfirmedAt" TIMESTAMP(3),
    "actualDeliveredKw" INTEGER,
    "partialRefundAmount" DECIMAL(14,2),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING_CHECKIN',
    "disputeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "reservationId" TEXT,
    "incidentType" "IncidentType" NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operators" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "roleLevel" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outage_events" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "status" "OutageEventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "estimatedDurationMins" INTEGER NOT NULL,
    "notes" TEXT,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "outage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "gatewayStatus" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "paymentMethod" TEXT NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "webhookStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "webhookReceivedAt" TIMESTAMP(3),
    "webhookProcessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "capacityKw" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "bankAccountNumber" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "reservationId" TEXT,
    "rating" SMALLINT NOT NULL,
    "reviewText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "gatewayRefundId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "allocatedKw" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,4) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ALLOCATED',
    "deliveryStart" TIMESTAMP(3) NOT NULL,
    "deliveryEnd" TIMESTAMP(3) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "idempotencyKey" TEXT NOT NULL,
    "providerCheckinAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "gridOperator" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "coverageAreaSqKm" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "service_zones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "capacity_offers_zoneId_status_idx" ON "capacity_offers"("zoneId", "status");

-- CreateIndex
CREATE INDEX "capacity_offers_eventId_status_idx" ON "capacity_offers"("eventId", "status");

-- CreateIndex
CREATE INDEX "capacity_offers_deliveryStart_deliveryEnd_idx" ON "capacity_offers"("deliveryStart", "deliveryEnd");

-- CreateIndex
CREATE UNIQUE INDEX "capacity_offers_providerId_eventId_deliveryStart_deliveryEn_key" ON "capacity_offers"("providerId", "eventId", "deliveryStart", "deliveryEnd");

-- CreateIndex
CREATE INDEX "capacity_requests_zoneId_status_idx" ON "capacity_requests"("zoneId", "status");

-- CreateIndex
CREATE INDEX "capacity_requests_eventId_priorityTier_idx" ON "capacity_requests"("eventId", "priorityTier");

-- CreateIndex
CREATE INDEX "capacity_requests_createdAt_idx" ON "capacity_requests"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "capacity_requests_consumerId_eventId_key" ON "capacity_requests"("consumerId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "consumers_userId_key" ON "consumers"("userId");

-- CreateIndex
CREATE INDEX "consumers_zoneId_idx" ON "consumers"("zoneId");

-- CreateIndex
CREATE INDEX "consumers_createdAt_idx" ON "consumers"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "consumers_userId_zoneId_key" ON "consumers"("userId", "zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_reservationId_key" ON "deliveries"("reservationId");

-- CreateIndex
CREATE INDEX "deliveries_status_idx" ON "deliveries"("status");

-- CreateIndex
CREATE INDEX "deliveries_createdAt_idx" ON "deliveries"("createdAt");

-- CreateIndex
CREATE INDEX "incidents_providerId_status_idx" ON "incidents"("providerId", "status");

-- CreateIndex
CREATE INDEX "incidents_incidentType_idx" ON "incidents"("incidentType");

-- CreateIndex
CREATE INDEX "incidents_createdAt_idx" ON "incidents"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "operators_userId_key" ON "operators"("userId");

-- CreateIndex
CREATE INDEX "operators_zoneId_idx" ON "operators"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "operators_userId_zoneId_key" ON "operators"("userId", "zoneId");

-- CreateIndex
CREATE INDEX "outage_events_zoneId_status_idx" ON "outage_events"("zoneId", "status");

-- CreateIndex
CREATE INDEX "outage_events_scheduledStart_scheduledEnd_idx" ON "outage_events"("scheduledStart", "scheduledEnd");

-- CreateIndex
CREATE INDEX "outage_events_createdAt_idx" ON "outage_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reservationId_key" ON "payments"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayId_key" ON "payments"("gatewayId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_gatewayStatus_idx" ON "payments"("gatewayStatus");

-- CreateIndex
CREATE INDEX "payments_webhookStatus_idx" ON "payments"("webhookStatus");

-- CreateIndex
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "providers_userId_key" ON "providers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "providers_licenseNumber_key" ON "providers"("licenseNumber");

-- CreateIndex
CREATE INDEX "providers_zoneId_idx" ON "providers"("zoneId");

-- CreateIndex
CREATE INDEX "providers_verified_idx" ON "providers"("verified");

-- CreateIndex
CREATE INDEX "providers_createdAt_idx" ON "providers"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "providers_userId_zoneId_key" ON "providers"("userId", "zoneId");

-- CreateIndex
CREATE INDEX "ratings_providerId_idx" ON "ratings"("providerId");

-- CreateIndex
CREATE INDEX "ratings_createdAt_idx" ON "ratings"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_gatewayRefundId_key" ON "refunds"("gatewayRefundId");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE INDEX "refunds_reason_idx" ON "refunds"("reason");

-- CreateIndex
CREATE INDEX "refunds_createdAt_idx" ON "refunds"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_idempotencyKey_key" ON "reservations"("idempotencyKey");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "reservations_paymentStatus_idx" ON "reservations"("paymentStatus");

-- CreateIndex
CREATE INDEX "reservations_consumerId_status_idx" ON "reservations"("consumerId", "status");

-- CreateIndex
CREATE INDEX "reservations_providerId_status_idx" ON "reservations"("providerId", "status");

-- CreateIndex
CREATE INDEX "reservations_deliveryStart_deliveryEnd_idx" ON "reservations"("deliveryStart", "deliveryEnd");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_offerId_requestId_key" ON "reservations"("offerId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "service_zones_name_key" ON "service_zones"("name");

-- CreateIndex
CREATE INDEX "service_zones_gridOperator_idx" ON "service_zones"("gridOperator");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_offers" ADD CONSTRAINT "capacity_offers_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_offers" ADD CONSTRAINT "capacity_offers_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "service_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_offers" ADD CONSTRAINT "capacity_offers_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "outage_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_requests" ADD CONSTRAINT "capacity_requests_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "consumers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_requests" ADD CONSTRAINT "capacity_requests_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "service_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_requests" ADD CONSTRAINT "capacity_requests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "outage_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumers" ADD CONSTRAINT "consumers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumers" ADD CONSTRAINT "consumers_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "service_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operators" ADD CONSTRAINT "operators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operators" ADD CONSTRAINT "operators_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "service_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outage_events" ADD CONSTRAINT "outage_events_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "service_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outage_events" ADD CONSTRAINT "outage_events_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "service_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "consumers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "capacity_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "capacity_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "consumers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
