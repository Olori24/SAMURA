const CACHE = "samura-shell-v2";
const SHELL = new Set([
  "/",
  "/manifest.webmanifest",
  "/icons/samura-192.svg",
  "/icons/samura-512.svg",
]);

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll([...SHELL]).catch(() => undefined)
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("samura-shell-") && key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Only cache an explicit allowlist of public shell assets. Never cache API,
  // authenticated pages, Next.js RSC/navigation payloads, or arbitrary GETs.
  if (!SHELL.has(url.pathname) || url.search) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: false });
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
      }
      return response;
    } catch {
      return request.mode === "navigate"
        ? (await caches.match("/")) ?? Response.error()
        : Response.error();
    }
  })());
});
