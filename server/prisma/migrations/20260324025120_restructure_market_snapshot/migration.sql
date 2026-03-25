/*
  Warnings:

  - You are about to drop the column `snapshotId` on the `AiAdvice` table. All the data in the column will be lost.
  - You are about to drop the column `spxClose` on the `MarketSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `spxVwap` on the `MarketSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `spyClose` on the `MarketSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `spyVwap` on the `MarketSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `vix` on the `MarketSnapshot` table. All the data in the column will be lost.
  - Added the required column `marketData` to the `MarketSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ticker` to the `MarketSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiAdvice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marketVibe" TEXT NOT NULL,
    "winProbability" REAL NOT NULL,
    "action" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL
);
INSERT INTO "new_AiAdvice" ("action", "id", "marketVibe", "reasoning", "timestamp", "winProbability") SELECT "action", "id", "marketVibe", "reasoning", "timestamp", "winProbability" FROM "AiAdvice";
DROP TABLE "AiAdvice";
ALTER TABLE "new_AiAdvice" RENAME TO "AiAdvice";
CREATE TABLE "new_MarketSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticker" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "marketData" JSONB NOT NULL
);
INSERT INTO "new_MarketSnapshot" ("id", "timestamp") SELECT "id", "timestamp" FROM "MarketSnapshot";
DROP TABLE "MarketSnapshot";
ALTER TABLE "new_MarketSnapshot" RENAME TO "MarketSnapshot";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
