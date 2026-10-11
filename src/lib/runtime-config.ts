import "server-only";

export function isRuntimeConfigured() {
  const databaseUrl = process.env.SAMURA_DATABASE_URL ?? process.env.DATABASE_URL;
  const secret = process.env.BETTER_AUTH_SECRET;
  const productionUrlReady = process.env.NODE_ENV !== "production" || Boolean(process.env.BETTER_AUTH_URL);
  return Boolean(databaseUrl && secret && secret.length >= 32 && productionUrlReady);
}
