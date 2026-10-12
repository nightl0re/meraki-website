-- AlterTable
ALTER TABLE `sitterprofile` ADD COLUMN `serviceRadiusKm` INTEGER NOT NULL DEFAULT 8;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `area` VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL;

-- CreateTable
CREATE TABLE `GeocodeCache` (
    `query` VARCHAR(191) NOT NULL,
    `label` VARCHAR(300) NOT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`query`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `User_latitude_longitude_idx` ON `User`(`latitude`, `longitude`);
