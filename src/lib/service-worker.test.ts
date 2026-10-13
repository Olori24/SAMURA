import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const workerSource = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

type WorkerEvent = {
  request?: { url: string; method: string; mode: string };
  respondWith?: (promise: Promise<unknown>) => void;
  waitUntil?: (promise: Promise<unknown>) => void;
};

function createWorkerHarness() {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const cache = {
    addAll: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
    match: vi.fn().mockResolvedValue(undefined),
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue(["samura-shell-v1", "samura-shell-v2", "unrelated-cache"]),
    delete: vi.fn().mockResolvedValue(true),
    match: vi.fn().mockResolvedValue(undefined),
  };
  const self = {
    addEventListener: vi.fn((type: string, callback: (event: WorkerEvent) => void) => listeners.set(type, callback)),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
    location: { origin: "https://samura.test" },
  };
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    type: "basic",
    clone: () => ({ body: "public shell" }),
  });

  runInNewContext(workerSource, { self, caches, fetch, URL, Promise, Response });
  return { listeners, cache, caches, self, fetch };
}

function dispatchFetch(
  listeners: Map<string, (event: WorkerEvent) => void>,
  url: string,
  method = "GET",
) {
  let responsePromise: Promise<unknown> | undefined;
  const event = {
    request: { url, method, mode: "cors" },
    respondWith: (promise: Promise<unknown>) => { responsePromise = promise; },
    waitUntil: vi.fn(),
  };
  listeners.get("fetch")?.(event);
  return { event, responsePromise };
}

describe("service worker cache boundaries", () => {
  it("does not intercept or cache authenticated/private routes", () => {
    const { listeners, caches, fetch } = createWorkerHarness();

    const { responsePromise } = dispatchFetch(listeners, "https://samura.test/dashboard");

    expect(responsePromise).toBeUndefined();
    expect(caches.match).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not intercept Next.js RSC requests or query-string shell URLs", () => {
    const { listeners, caches, fetch } = createWorkerHarness();

    const rsc = dispatchFetch(listeners, "https://samura.test/?_rsc=abc123");
    const queryShell = dispatchFetch(listeners, "https://samura.test/manifest.webmanifest?v=1");

    expect(rsc.responsePromise).toBeUndefined();
    expect(queryShell.responsePromise).toBeUndefined();
    expect(caches.match).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not intercept API requests or non-GET requests", () => {
    const { listeners, caches, fetch } = createWorkerHarness();

    const api = dispatchFetch(listeners, "https://samura.test/api/conversations");
    const post = dispatchFetch(listeners, "https://samura.test/manifest.webmanifest", "POST");

    expect(api.responsePromise).toBeUndefined();
    expect(post.responsePromise).toBeUndefined();
    expect(caches.match).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("handles an allowlisted public shell asset", async () => {
    const { listeners, caches, fetch } = createWorkerHarness();

    const { event, responsePromise } = dispatchFetch(listeners, "https://samura.test/manifest.webmanifest");

    expect(responsePromise).toBeDefined();
    await responsePromise;
    expect(caches.match).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(event.waitUntil).toHaveBeenCalledTimes(1);
  });

  it("removes the previous SAMURA shell cache during activation", async () => {
    const { listeners, caches } = createWorkerHarness();
    let activation: Promise<unknown> | undefined;
    const event: WorkerEvent = { waitUntil: (promise: Promise<unknown>) => { activation = promise; } };

    listeners.get("activate")?.(event);
    await activation;

    expect(caches.delete).toHaveBeenCalledWith("samura-shell-v1");
    expect(caches.delete).not.toHaveBeenCalledWith("samura-shell-v2");
    expect(caches.delete).not.toHaveBeenCalledWith("unrelated-cache");
  });
});
