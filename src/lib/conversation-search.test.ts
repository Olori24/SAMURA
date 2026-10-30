import { describe, expect, it } from "vitest";
import { escapeLikeSearchTerm } from "./conversation-search";

describe("escapeLikeSearchTerm", () => {
  it("escapes SQL LIKE wildcard characters and backslashes", () => {
    expect(escapeLikeSearchTerm("50%_off\\sale")).toBe("50\\%\\_off\\\\sale");
  });

  it("leaves ordinary text unchanged", () => {
    expect(escapeLikeSearchTerm("school fees Lagos")).toBe("school fees Lagos");
  });
});
