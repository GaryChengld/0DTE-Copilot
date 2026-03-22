-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spxPrice" REAL NOT NULL,
    "spxVwap" REAL NOT NULL,
    "vix" REAL NOT NULL,
    "add" REAL NOT NULL,
    "tick" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "AiAdvice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marketVibe" TEXT NOT NULL,
    "winProbability" REAL NOT NULL,
    "action" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "snapshotId" INTEGER NOT NULL,
    CONSTRAINT "AiAdvice_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "MarketSnapshot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TradeLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pnl" REAL
);

-- CreateIndex
CREATE UNIQUE INDEX "AiAdvice_snapshotId_key" ON "AiAdvice"("snapshotId");
