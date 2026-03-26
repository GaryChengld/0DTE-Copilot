/*
  Warnings:

  - You are about to drop the `TradeLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TradeLog";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Trade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tradeDate" TEXT NOT NULL,
    "tradeNo" INTEGER NOT NULL,
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

-- CreateTable
CREATE TABLE "TradeExit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tradeId" INTEGER NOT NULL,
    "tradeDate" TEXT NOT NULL,
    "exitQuantity" INTEGER NOT NULL,
    "exitPrice" REAL NOT NULL,
    "exitTime" TEXT NOT NULL,
    "exitReason" TEXT NOT NULL,
    "pnl" REAL,
    CONSTRAINT "TradeExit_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Trade_tradeDate_tradeNo_key" ON "Trade"("tradeDate", "tradeNo");

-- CreateIndex
CREATE INDEX "TradeExit_tradeDate_idx" ON "TradeExit"("tradeDate");

-- CreateIndex
CREATE INDEX "TradeExit_tradeId_idx" ON "TradeExit"("tradeId");
