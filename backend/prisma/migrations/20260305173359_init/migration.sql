-- CreateTable
CREATE TABLE `Usuari` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `perfil` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Usuari_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Despesa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `proveidor` VARCHAR(191) NOT NULL,
    `cif` VARCHAR(191) NOT NULL,
    `importTotal` DOUBLE NOT NULL,
    `iva` DOUBLE NULL,
    `baseImposable` DOUBLE NULL,
    `data` DATETIME(3) NOT NULL,
    `concepte` VARCHAR(191) NOT NULL,
    `categoria` VARCHAR(191) NOT NULL,
    `urlImatge` VARCHAR(191) NOT NULL,
    `usuariId` INTEGER NOT NULL,
    `estat` VARCHAR(191) NOT NULL DEFAULT 'draft',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Despesa` ADD CONSTRAINT `Despesa_usuariId_fkey` FOREIGN KEY (`usuariId`) REFERENCES `Usuari`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
