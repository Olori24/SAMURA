import { describe, expect, it } from "vitest";
import { linkAbortSignal } from "./abort-signal";

describe("linkAbortSignal", () => {
  it("forwards an abort that happens after linking", () => {
    const source = new AbortController();
    const target = new AbortController();
    linkAbortSignal(source.signal, target);

    source.abort("client disconnected");

    expect(target.signal.aborted).toBe(true);
    expect(target.signal.reason).toBe("client disconnected");
  });

  it("immediately forwards a signal that was already aborted", () => {
    const source = new AbortController();
    source.abort("request already closed");
    const target = new AbortController();

    linkAbortSignal(source.signal, target);

    expect(target.signal.aborted).toBe(true);
    expect(target.signal.reason).toBe("request already closed");
  });

  it("stops forwarding after cleanup", () => {
    const source = new AbortController();
    const target = new AbortController();
    const unlink = linkAbortSignal(source.signal, target);

    unlink();
    source.abort();

    expect(target.signal.aborted).toBe(false);
  });
});
