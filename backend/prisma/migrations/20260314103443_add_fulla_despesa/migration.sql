-- AlterTable
ALTER TABLE `despesa` ADD COLUMN `fullaId` INTEGER NULL;

-- CreateTable
CREATE TABLE `FullaDespesa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titol` VARCHAR(191) NOT NULL,
    `mes` VARCHAR(191) NOT NULL,
    `any` INTEGER NOT NULL,
    `estat` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `usuariId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FullaDespesa_usuariId_idx`(`usuariId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `despesa_fullaId_idx` ON `despesa`(`fullaId`);

-- AddForeignKey
ALTER TABLE `despesa` ADD CONSTRAINT `despesa_fullaId_fkey` FOREIGN KEY (`fullaId`) REFERENCES `FullaDespesa`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FullaDespesa` ADD CONSTRAINT `FullaDespesa_usuariId_fkey` FOREIGN KEY (`usuariId`) REFERENCES `usuari`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
