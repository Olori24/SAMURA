import "server-only";

import { sql } from "drizzle-orm";
import { getDb } from "@/db";

type Database = ReturnType<typeof getDb>;
type TransactionCallback = Parameters<Database["transaction"]>[0];
type UserTransaction = TransactionCallback extends (tx: infer Tx, ...args: never[]) => unknown ? Tx : never;

/**
 * Runs user-owned data operations with a transaction-local identity for
 * PostgreSQL RLS policies. Never accept a user ID from request data: callers
 * must pass the ID from a verified Better Auth session.
 */
export async function withUserTransaction<T>(
  authenticatedUserId: string,
  operation: (tx: UserTransaction) => Promise<T>,
): Promise<T> {
  if (!authenticatedUserId || authenticatedUserId.trim() !== authenticatedUserId) {
    throw new Error("A verified user identity is required for this transaction.");
  }

  return getDb().transaction(async (tx) => {
    if (process.env.SAMURA_RLS_ENABLED === "true") {
      await tx.execute(sql`SET LOCAL ROLE samura_runtime`);
    }
    await tx.execute(sql`select set_config('app.user_id', ${authenticatedUserId}, true)`);
    return operation(tx as UserTransaction);
  });
}
