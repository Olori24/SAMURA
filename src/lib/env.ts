import { z } from "zod";

const optionalSecret = z.string().min(1).optional();
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SAMURA_DATABASE_URL: optionalSecret,
  DATABASE_URL: optionalSecret,
  BETTER_AUTH_SECRET: optionalSecret,
  BETTER_AUTH_URL: z.string().url().optional(),
  OPENAI_API_KEY: optionalSecret,
  SAMURA_OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  SAMURA_MAX_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().max(1000).default(20),
  SAMURA_MAX_INPUT_CHARS: z.coerce.number().int().positive().max(50000).default(12000),
  SAMURA_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().max(4000).default(1200),
});

export function getServerEnv() {
  return envSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    SAMURA_DATABASE_URL: process.env.SAMURA_DATABASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SAMURA_OPENAI_MODEL: process.env.SAMURA_OPENAI_MODEL,
    SAMURA_MAX_REQUESTS_PER_MINUTE: process.env.SAMURA_MAX_REQUESTS_PER_MINUTE,
    SAMURA_MAX_INPUT_CHARS: process.env.SAMURA_MAX_INPUT_CHARS,
    SAMURA_MAX_OUTPUT_TOKENS: process.env.SAMURA_MAX_OUTPUT_TOKENS,
  });
}
