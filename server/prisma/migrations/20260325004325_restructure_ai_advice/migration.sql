/*
  Warnings:

  - You are about to drop the column `action` on the `AiAdvice` table. All the data in the column will be lost.
  - You are about to drop the column `marketVibe` on the `AiAdvice` table. All the data in the column will be lost.
  - You are about to drop the column `reasoning` on the `AiAdvice` table. All the data in the column will be lost.
  - You are about to drop the column `winProbability` on the `AiAdvice` table. All the data in the column will be lost.
  - Added the required column `provider` to the `AiAdvice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `response` to the `AiAdvice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source` to the `AiAdvice` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiAdvice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "prompt" TEXT,
    "response" TEXT NOT NULL,
    "provider" TEXT NOT NULL
);
INSERT INTO "new_AiAdvice" ("id", "timestamp") SELECT "id", "timestamp" FROM "AiAdvice";
DROP TABLE "AiAdvice";
ALTER TABLE "new_AiAdvice" RENAME TO "AiAdvice";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
