import { describe, expect, it } from "vitest";
import { parseBoundedJson } from "./parse-bounded-json";

describe("parseBoundedJson", () => {
  it("parses valid JSON within the byte limit", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Hello" }),
    });
    await expect(parseBoundedJson(request, 100)).resolves.toEqual({
      ok: true,
      value: { title: "Hello" },
    });
  });

  it("rejects oversized content using the actual body bytes", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ title: "x".repeat(256) }));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      // Do not provide Content-Length: the body itself must still be bounded.
      // Node's Request implementation requires streaming bodies to be duplex.
      duplex: "half",
    } as RequestInit);
    await expect(parseBoundedJson(request, 100)).resolves.toEqual({
      ok: false,
      tooLarge: true,
    });
  });

  it("rejects malformed JSON", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    await expect(parseBoundedJson(request, 100)).resolves.toEqual({
      ok: false,
      tooLarge: false,
    });
  });
});
