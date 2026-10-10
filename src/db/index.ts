import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDatabase(url: string) {
  return drizzle(neon(url), { schema });
}

type Database = ReturnType<typeof createDatabase>;
let database: Database | undefined;

export function isDatabaseConfigured() {
  return Boolean(process.env.SAMURA_DATABASE_URL ?? process.env.DATABASE_URL);
}

export function getDb() {
  // Keep Next.js build-time module evaluation possible without credentials.
  // Every data API checks configuration before accessing the database; this
  // placeholder fails closed if an unconfigured request somehow reaches here.
  const url = process.env.SAMURA_DATABASE_URL ?? process.env.DATABASE_URL
    ?? "postgres://invalid:invalid@127.0.0.1:5432/samura";
  if (!database) database = createDatabase(url);
  return database;
}
