import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export async function withUserDb<T>(userId: string, operation: (tx: any) => Promise<T>): Promise<T> {
  const identity = userId.trim();
  if (!identity || identity.length > 255) throw new Error("A valid authenticated user ID is required.");
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.user_id', ${identity}, true)`);
    return operation(tx);
  });
}
