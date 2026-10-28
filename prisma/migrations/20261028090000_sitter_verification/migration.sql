-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('AVATAR', 'ID_PHOTO');

-- AlterTable
ALTER TABLE "SitterProfile" ADD COLUMN     "idPhotoId" TEXT,
ADD COLUMN     "reviewNote" VARCHAR(500) NOT NULL DEFAULT '',
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" "FileKind" NOT NULL,
    "contentType" VARCHAR(40) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoredFile_ownerId_kind_idx" ON "StoredFile"("ownerId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "SitterProfile_idPhotoId_key" ON "SitterProfile"("idPhotoId");

-- AddForeignKey
ALTER TABLE "SitterProfile" ADD CONSTRAINT "SitterProfile_idPhotoId_fkey" FOREIGN KEY ("idPhotoId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

