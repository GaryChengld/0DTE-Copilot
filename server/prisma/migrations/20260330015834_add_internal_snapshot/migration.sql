-- CreateTable
CREATE TABLE "InternalSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tradeDate" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "vix" REAL,
    "add" REAL,
    "tick" REAL
);

-- CreateIndex
CREATE INDEX "InternalSnapshot_tradeDate_idx" ON "InternalSnapshot"("tradeDate");
