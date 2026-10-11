import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.SAMURA_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgres://placeholder:placeholder@localhost:5432/samura",
  },
  strict: true,
  verbose: true,
});
