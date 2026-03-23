/*
  Warnings:

  - You are about to drop the column `add` on the `MarketSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `spxPrice` on the `MarketSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `tick` on the `MarketSnapshot` table. All the data in the column will be lost.
  - Added the required column `spxClose` to the `MarketSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `spyClose` to the `MarketSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `spyVwap` to the `MarketSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MarketSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spxClose" REAL NOT NULL,
    "spxVwap" REAL NOT NULL,
    "spyClose" REAL NOT NULL,
    "spyVwap" REAL NOT NULL,
    "vix" REAL NOT NULL
);
INSERT INTO "new_MarketSnapshot" ("id", "spxVwap", "timestamp", "vix") SELECT "id", "spxVwap", "timestamp", "vix" FROM "MarketSnapshot";
DROP TABLE "MarketSnapshot";
ALTER TABLE "new_MarketSnapshot" RENAME TO "MarketSnapshot";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
