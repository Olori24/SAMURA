import { describe, expect, it } from "vitest";
import { getSafeProviderImageUrl } from "./image-provider-image";

describe("getSafeProviderImageUrl", () => {
  it("accepts valid HTTPS provider URLs", () => {
    expect(getSafeProviderImageUrl("https://images.example.test/output.png?token=abc"))
      .toBe("https://images.example.test/output.png?token=abc");
  });

  it("rejects non-HTTPS URLs", () => {
    expect(getSafeProviderImageUrl("http://images.example.test/output.png")).toBeNull();
  });

  it("rejects URLs containing embedded credentials", () => {
    expect(getSafeProviderImageUrl("https://user:password@images.example.test/output.png")).toBeNull();
  });

  it("rejects malformed URLs", () => {
    expect(getSafeProviderImageUrl("not a URL")).toBeNull();
  });
});
