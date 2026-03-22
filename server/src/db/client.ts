import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { config } from "../config.js";

const adapter = new PrismaBetterSqlite3({ url: config.databaseUrl });
const prisma = new PrismaClient({ adapter });

export default prisma;
