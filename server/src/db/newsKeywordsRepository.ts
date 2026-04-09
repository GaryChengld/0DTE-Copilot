import prisma from "./client.js";

export async function getAllKeywords(): Promise<string[]> {
  const rows = await prisma.newsKeyword.findMany({ orderBy: { keyword: "asc" } });
  return rows.map((r) => r.keyword);
}

export async function saveKeywords(keywords: string[]): Promise<void> {
  await prisma.$transaction([
    prisma.newsKeyword.deleteMany(),
    prisma.newsKeyword.createMany({
      data: keywords.map((keyword) => ({ keyword })),
    }),
  ]);
}
