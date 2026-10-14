import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { transaction, execute } = vi.hoisted(() => ({
  transaction: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: [...strings],
    values,
  }),
}));
vi.mock("@/db", () => ({
  getDb: () => ({ transaction }),
}));

import { withUserTransaction } from "./user-transaction";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SAMURA_RLS_ENABLED", "false");
  execute.mockResolvedValue([]);
  transaction.mockImplementation(async (operation: (tx: { execute: typeof execute }) => Promise<unknown>) =>
    operation({ execute }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("withUserTransaction", () => {
  it("sets the verified user identity transaction-locally", async () => {
    await expect(withUserTransaction("user-a", async () => "done")).resolves.toBe("done");

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
    const query = execute.mock.calls[0][0] as { strings: string[]; values: unknown[] };
    expect(query.strings.join("?")).toContain("set_config('app.user_id', ?");
    expect(query.values).toEqual(["user-a"]);
  });

  it("activates the restricted role before setting identity when RLS is enabled", async () => {
    vi.stubEnv("SAMURA_RLS_ENABLED", "true");

    await withUserTransaction("user-a", async () => undefined);

    expect(execute).toHaveBeenCalledTimes(2);
    const roleQuery = execute.mock.calls[0][0] as { strings: string[] };
    expect(roleQuery.strings.join("")).toContain("SET LOCAL ROLE samura_runtime");
    const identityQuery = execute.mock.calls[1][0] as { strings: string[]; values: unknown[] };
    expect(identityQuery.strings.join("?")).toContain("set_config('app.user_id', ?");
    expect(identityQuery.values).toEqual(["user-a"]);
  });

  it("rejects missing or whitespace-padded identities before opening a transaction", async () => {
    await expect(withUserTransaction("", async () => undefined)).rejects.toThrow("verified user identity");
    await expect(withUserTransaction(" user-a", async () => undefined)).rejects.toThrow("verified user identity");
    expect(transaction).not.toHaveBeenCalled();
  });
});
