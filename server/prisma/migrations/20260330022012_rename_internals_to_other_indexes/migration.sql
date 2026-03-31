/*
  Warnings:

  - You are about to drop the `InternalSnapshot` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "InternalSnapshot";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "OtherIndexSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tradeDate" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "vix" REAL,
    "add" REAL,
    "tick" REAL
);

-- CreateIndex
CREATE INDEX "OtherIndexSnapshot_tradeDate_idx" ON "OtherIndexSnapshot"("tradeDate");
