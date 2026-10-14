import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

function createDatabase(url: string) {
  // The neon-http driver does not support transactions. SAMURA's RLS boundary
  // depends on SET LOCAL ROLE and transaction-local app.user_id, so use the
  // serverless Pool driver to keep these statements and the data query on the
  // same PostgreSQL transaction/connection.
  const pool = new Pool({ connectionString: url });
  return drizzle({ client: pool, schema });
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
