import { z } from "zod";

const optionalSecret = z.string().min(1).optional();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SAMURA_DEFAULT_PROVIDER: z.enum(["mock", "openai", "anthropic"]).default("mock"),
  SAMURA_MAX_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().max(1000).default(30),
  SAMURA_DATABASE_URL: optionalSecret,
  OPENAI_API_KEY: optionalSecret,
  ANTHROPIC_API_KEY: optionalSecret,
});

export function getServerEnv() {
  return envSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    SAMURA_DEFAULT_PROVIDER: process.env.SAMURA_DEFAULT_PROVIDER,
    SAMURA_MAX_REQUESTS_PER_MINUTE: process.env.SAMURA_MAX_REQUESTS_PER_MINUTE,
    SAMURA_DATABASE_URL: process.env.SAMURA_DATABASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  });
}
