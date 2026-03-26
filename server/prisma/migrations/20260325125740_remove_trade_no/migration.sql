/*
  Warnings:

  - You are about to drop the column `tradeNo` on the `Trade` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Trade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tradeDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "symbol" TEXT NOT NULL,
    "tradeType" TEXT NOT NULL DEFAULT 'SPREAD',
    "spreadType" TEXT NOT NULL DEFAULT 'CREDIT',
    "optionType" TEXT,
    "shortStrike" REAL,
    "longStrike" REAL,
    "quantityInitial" INTEGER NOT NULL,
    "quantityRemaining" INTEGER NOT NULL,
    "entryPrice" REAL,
    "entryTime" TEXT
);
INSERT INTO "new_Trade" ("entryPrice", "entryTime", "id", "longStrike", "optionType", "quantityInitial", "quantityRemaining", "shortStrike", "spreadType", "status", "symbol", "tradeDate", "tradeType") SELECT "entryPrice", "entryTime", "id", "longStrike", "optionType", "quantityInitial", "quantityRemaining", "shortStrike", "spreadType", "status", "symbol", "tradeDate", "tradeType" FROM "Trade";
DROP TABLE "Trade";
ALTER TABLE "new_Trade" RENAME TO "Trade";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
