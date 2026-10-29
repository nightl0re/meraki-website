-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'AWAITING_CONFIRMATION';
ALTER TYPE "BookingStatus" ADD VALUE 'AWAITING_PAYMENT';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "paymentApprovedAt" TIMESTAMP(3),
ADD COLUMN     "paymentApprovedById" TEXT,
ADD COLUMN     "sitterDoneAt" TIMESTAMP(3);

