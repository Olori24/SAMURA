import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/db";
import { accounts, sessions, users, verifications } from "@/db/schema";

// A build-only fallback prevents Next.js static compilation from requiring live
// secrets. All auth handlers reject requests unless real runtime configuration
// is present; this value must never be used for an authenticated request.
const secret = process.env.BETTER_AUTH_SECRET ?? "build-only-placeholder-secret-never-use-at-runtime";
const canonicalAuthUrl = process.env.BETTER_AUTH_URL;

export const auth = betterAuth({
  appName: "SAMURA AI",
  baseURL: canonicalAuthUrl ?? "http://localhost:3000",
  // Vercel creates a unique hostname for each deployment. Trust only SAMURA's
  // project-specific Vercel deployment pattern, plus the explicitly configured
  // canonical URL. Do not trust every *.vercel.app origin.
  trustedOrigins: [
    ...(canonicalAuthUrl ? [canonicalAuthUrl] : []),
    "https://samura-*-bakande11-2779s-projects.vercel.app",
  ],
  secret,
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: { user: users, session: sessions, account: accounts, verification: verifications },
  }),
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  },
});
