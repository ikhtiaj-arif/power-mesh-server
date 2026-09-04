-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('PENDING_EMAIL_VERIFICATION', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "status" "ProviderStatus" NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3);
