import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDatabase(url: string) {
  return drizzle(neon(url), { schema });
}

type Database = ReturnType<typeof createDatabase>;
let database: Database | undefined;

export function getDb() {
  const url = process.env.SAMURA_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Database is not configured. Set SAMURA_DATABASE_URL.");
  if (!database) database = createDatabase(url);
  return database;
}
