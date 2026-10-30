import { z } from "zod";

const optionalSecret = z.string().min(1).optional();
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SAMURA_DATABASE_URL: optionalSecret,
  DATABASE_URL: optionalSecret,
  BETTER_AUTH_SECRET: optionalSecret,
  BETTER_AUTH_URL: z.string().url().optional(),
  // Hosted OpenRouter is an OpenAI-compatible alternative to Gemini.
  SAMURA_AI_PROVIDER: z.enum(["ollama", "openai", "gemini", "openrouter"]).default("ollama"),
  SAMURA_OLLAMA_BASE_URL: z.string().url().default("http://127.0.0.1:11434/v1"),
  SAMURA_OLLAMA_MODEL: z.string().min(1).default("qwen3:8b"),
  OPENAI_API_KEY: optionalSecret,
  SAMURA_OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  SAMURA_IMAGE_API_KEY: optionalSecret,
  SAMURA_IMAGE_BASE_URL: z.string().url().refine((value) => {
    const endpoint = new URL(value);
    return endpoint.protocol === "https:" || (endpoint.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname));
  }, "Image provider endpoints must use HTTPS unless they target loopback.").optional(),
  SAMURA_IMAGE_MODEL: z.string().min(1).default("gpt-image-1"),
  SAMURA_GEMINI_IMAGE_MODEL: z.string().min(1).default("gemini-nano-banana-2.1"),
  SAMURA_WEB_SEARCH_API_KEY: optionalSecret,
  // Gemini Search grounding can incur per-query charges; keep disabled until an admin opts in.
  SAMURA_GEMINI_GROUNDING_ENABLED: z.enum(["true", "false"]).default("false").transform(value => value === "true"),
  OPENROUTER_API_KEY: optionalSecret,
  SAMURA_OPENROUTER_MODEL: z.string().min(1).default("openrouter/free"),
  GEMINI_API_KEY: optionalSecret,
  SAMURA_GEMINI_MODEL: z.string().min(1).default("gemini-3.8-flash"),
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
    SAMURA_AI_PROVIDER: process.env.SAMURA_AI_PROVIDER,
    SAMURA_OLLAMA_BASE_URL: process.env.SAMURA_OLLAMA_BASE_URL,
    SAMURA_OLLAMA_MODEL: process.env.SAMURA_OLLAMA_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SAMURA_OPENAI_MODEL: process.env.SAMURA_OPENAI_MODEL,
    SAMURA_IMAGE_API_KEY: process.env.SAMURA_IMAGE_API_KEY,
    SAMURA_IMAGE_BASE_URL: process.env.SAMURA_IMAGE_BASE_URL,
    SAMURA_IMAGE_MODEL: process.env.SAMURA_IMAGE_MODEL,
    SAMURA_GEMINI_IMAGE_MODEL: process.env.SAMURA_GEMINI_IMAGE_MODEL,
    SAMURA_WEB_SEARCH_API_KEY: process.env.SAMURA_WEB_SEARCH_API_KEY,
    SAMURA_GEMINI_GROUNDING_ENABLED: process.env.SAMURA_GEMINI_GROUNDING_ENABLED,
    // Support the existing Vercel secret name while standardizing on OPENROUTER_API_KEY.
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? process.env.Openrouter,
    SAMURA_OPENROUTER_MODEL: process.env.SAMURA_OPENROUTER_MODEL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    SAMURA_GEMINI_MODEL: process.env.SAMURA_GEMINI_MODEL,
    SAMURA_MAX_REQUESTS_PER_MINUTE: process.env.SAMURA_MAX_REQUESTS_PER_MINUTE,
    SAMURA_MAX_INPUT_CHARS: process.env.SAMURA_MAX_INPUT_CHARS,
    SAMURA_MAX_OUTPUT_TOKENS: process.env.SAMURA_MAX_OUTPUT_TOKENS,
  });
}
