-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(100) NOT NULL,
    `role` ENUM('PARENT', 'SITTER', 'ADMIN') NOT NULL,
    `status` ENUM('ACTIVE', 'PENDING_REVIEW', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `firstName` VARCHAR(60) NOT NULL,
    `lastName` VARCHAR(60) NOT NULL,
    `phone` VARCHAR(30) NOT NULL DEFAULT '',
    `city` VARCHAR(80) NOT NULL DEFAULT '',
    `avatarUrl` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_role_status_idx`(`role`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userAgent` VARCHAR(255) NOT NULL DEFAULT '',

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SitterProfile` (
    `userId` VARCHAR(191) NOT NULL,
    `headline` VARCHAR(120) NOT NULL DEFAULT '',
    `bio` VARCHAR(2000) NOT NULL DEFAULT '',
    `hourlyRateCents` INTEGER NOT NULL DEFAULT 1800,
    `experienceYears` INTEGER NOT NULL DEFAULT 0,
    `maxChildren` INTEGER NOT NULL DEFAULT 3,
    `acceptingBookings` BOOLEAN NOT NULL DEFAULT true,
    `verifiedAt` DATETIME(3) NULL,
    `ratingAvg` DOUBLE NOT NULL DEFAULT 0,
    `ratingCount` INTEGER NOT NULL DEFAULT 0,
    `completedJobs` INTEGER NOT NULL DEFAULT 0,

    INDEX `SitterProfile_hourlyRateCents_idx`(`hourlyRateCents`),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ParentProfile` (
    `userId` VARCHAR(191) NOT NULL,
    `about` VARCHAR(2000) NOT NULL DEFAULT '',
    `childrenCount` INTEGER NOT NULL DEFAULT 1,
    `address` VARCHAR(200) NOT NULL DEFAULT '',
    `ratingAvg` DOUBLE NOT NULL DEFAULT 0,
    `ratingCount` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Skill` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(60) NOT NULL,
    `name` VARCHAR(60) NOT NULL,

    UNIQUE INDEX `Skill_slug_key`(`slug`),
    UNIQUE INDEX `Skill_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SitterSkill` (
    `sitterId` VARCHAR(191) NOT NULL,
    `skillId` INTEGER NOT NULL,

    INDEX `SitterSkill_skillId_idx`(`skillId`),
    PRIMARY KEY (`sitterId`, `skillId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Availability` (
    `id` VARCHAR(191) NOT NULL,
    `sitterId` VARCHAR(191) NOT NULL,
    `weekday` INTEGER NOT NULL,
    `startMinute` INTEGER NOT NULL,
    `endMinute` INTEGER NOT NULL,

    INDEX `Availability_sitterId_weekday_idx`(`sitterId`, `weekday`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Booking` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(12) NOT NULL,
    `parentId` VARCHAR(191) NOT NULL,
    `sitterId` VARCHAR(191) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `childrenCount` INTEGER NOT NULL,
    `address` VARCHAR(200) NOT NULL,
    `notes` VARCHAR(2000) NOT NULL DEFAULT '',
    `status` ENUM('REQUESTED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'COMPLETED', 'DISPUTED') NOT NULL DEFAULT 'REQUESTED',
    `hourlyRateCents` INTEGER NOT NULL,
    `hours` DECIMAL(4, 2) NOT NULL,
    `subtotalCents` INTEGER NOT NULL,
    `serviceFeeCents` INTEGER NOT NULL,
    `totalCents` INTEGER NOT NULL,
    `respondBy` DATETIME(3) NOT NULL,
    `respondedAt` DATETIME(3) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledById` VARCHAR(191) NULL,
    `cancelReason` VARCHAR(300) NOT NULL DEFAULT '',
    `disputeReason` VARCHAR(2000) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Booking_code_key`(`code`),
    INDEX `Booking_sitterId_startsAt_idx`(`sitterId`, `startsAt`),
    INDEX `Booking_parentId_startsAt_idx`(`parentId`, `startsAt`),
    INDEX `Booking_status_endsAt_idx`(`status`, `endsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentMethod` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `providerRef` VARCHAR(64) NOT NULL,
    `brand` VARCHAR(20) NOT NULL,
    `last4` CHAR(4) NOT NULL,
    `expMonth` INTEGER NOT NULL,
    `expYear` INTEGER NOT NULL,
    `holderName` VARCHAR(100) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `removedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PaymentMethod_providerRef_key`(`providerRef`),
    INDEX `PaymentMethod_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `paymentMethodId` VARCHAR(191) NOT NULL,
    `providerRef` VARCHAR(64) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `capturedCents` INTEGER NOT NULL DEFAULT 0,
    `refundedCents` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('AUTHORIZED', 'CAPTURED', 'VOIDED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED') NOT NULL,
    `failureReason` VARCHAR(200) NOT NULL DEFAULT '',
    `authorizedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `capturedAt` DATETIME(3) NULL,
    `voidedAt` DATETIME(3) NULL,
    `refundedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Payment_bookingId_key`(`bookingId`),
    UNIQUE INDEX `Payment_providerRef_key`(`providerRef`),
    INDEX `Payment_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payout` (
    `id` VARCHAR(191) NOT NULL,
    `sitterId` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paidAt` DATETIME(3) NULL,

    UNIQUE INDEX `Payout_bookingId_key`(`bookingId`),
    INDEX `Payout_sitterId_status_idx`(`sitterId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Review` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `direction` ENUM('PARENT_TO_SITTER', 'SITTER_TO_PARENT') NOT NULL,
    `rating` INTEGER NOT NULL,
    `comment` VARCHAR(2000) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Review_subjectId_createdAt_idx`(`subjectId`, `createdAt`),
    UNIQUE INDEX `Review_bookingId_direction_key`(`bookingId`, `direction`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Favorite` (
    `parentId` VARCHAR(191) NOT NULL,
    `sitterId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Favorite_sitterId_idx`(`sitterId`),
    PRIMARY KEY (`parentId`, `sitterId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Message_bookingId_createdAt_idx`(`bookingId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `body` VARCHAR(300) NOT NULL DEFAULT '',
    `href` VARCHAR(200) NOT NULL DEFAULT '',
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_readAt_idx`(`userId`, `readAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(60) NOT NULL,
    `targetType` VARCHAR(30) NOT NULL,
    `targetId` VARCHAR(40) NOT NULL,
    `detail` VARCHAR(500) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_targetType_targetId_idx`(`targetType`, `targetId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SitterProfile` ADD CONSTRAINT `SitterProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParentProfile` ADD CONSTRAINT `ParentProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SitterSkill` ADD CONSTRAINT `SitterSkill_sitterId_fkey` FOREIGN KEY (`sitterId`) REFERENCES `SitterProfile`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SitterSkill` ADD CONSTRAINT `SitterSkill_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `Skill`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Availability` ADD CONSTRAINT `Availability_sitterId_fkey` FOREIGN KEY (`sitterId`) REFERENCES `SitterProfile`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_sitterId_fkey` FOREIGN KEY (`sitterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentMethod` ADD CONSTRAINT `PaymentMethod_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `PaymentMethod`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payout` ADD CONSTRAINT `Payout_sitterId_fkey` FOREIGN KEY (`sitterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payout` ADD CONSTRAINT `Payout_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Favorite` ADD CONSTRAINT `Favorite_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Favorite` ADD CONSTRAINT `Favorite_sitterId_fkey` FOREIGN KEY (`sitterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
