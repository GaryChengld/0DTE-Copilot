-- CreateTable
CREATE TABLE "NewsKeyword" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keyword" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsKeyword_keyword_key" ON "NewsKeyword"("keyword");

-- Seed initial keywords
INSERT INTO "NewsKeyword" ("keyword") VALUES
('fed'),
('federal reserve'),
('fomc'),
('powell'),
('rate cut'),
('rate hike'),
('interest rate'),
('cpi'),
('inflation'),
('gdp'),
('jobs'),
('nonfarm'),
('nfp'),
('unemployment'),
('payroll'),
('treasury'),
('yield'),
('recession'),
('economic'),
('economy'),
('fiscal'),
('monetary'),
('debt ceiling'),
('tariff'),
('trade war'),
('stimulus'),
('quantitative'),
('war'),
('ceasefire'),
('sanction'),
('iran'),
('china'),
('russia'),
('trump'),
('opec'),
('oil price'),
('geopolit'),
('congress'),
('senate'),
('white house'),
('executive order');
