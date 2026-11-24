const CACHE = 'studyroom-phone-b161338-2026-11-24';
const PRECACHE = ["./", "./index.html", "./app.js", "./engine.js", "./style.css", "./marks.css", "./manifest.webmanifest", "./icon.svg", "./icon-180.png", "./icon-512.png", "./content/english.json", "./content/logic.json", "./content/finalcut.json", "./content/color.json", "./content/img/c01-guide.svg", "./content/img/c02-guide.svg", "./content/img/c03-guide.svg", "./content/img/c04-guide.svg", "./content/img/c05-guide.svg", "./content/img/c06-guide.svg", "./content/img/c07-guide.svg", "./content/img/c08-guide.svg", "./content/img/cp01-guide.svg", "./content/img/cp02-guide.svg", "./content/img/cp03-guide.svg", "./content/img/e01-greet.svg", "./content/img/e02-be.svg", "./content/img/e03-pron.svg", "./content/img/e04-aan.svg", "./content/img/e05-num.svg", "./content/img/e06-beq.svg", "./content/img/e07-s.svg", "./content/img/e08-do.svg", "./content/img/e09-time.svg", "./content/img/e10-there.svg", "./content/img/e11-ing.svg", "./content/img/e12-can.svg", "./content/img/e13-prep.svg", "./content/img/e14-was.svg", "./content/img/e15-past.svg", "./content/img/e16-future.svg", "./content/img/e17-wh.svg", "./content/img/e18-freq.svg", "./content/img/e19-want.svg", "./content/img/e20-comp.svg", "./content/img/fc01-guide.svg", "./content/img/fc02-guide.svg", "./content/img/fc03-guide.svg", "./content/img/fc04-guide.svg", "./content/img/fc05-guide.svg", "./content/img/fc06-guide.svg", "./content/img/fc07-guide.svg", "./content/img/fc08-guide.svg", "./content/img/g01-mix.svg", "./content/img/g02-strip.svg", "./content/img/g03-meter.svg", "./content/img/g04-pan.svg", "./content/img/g05-eq.svg", "./content/img/g06-comp.svg", "./content/img/g07-send.svg", "./content/img/g08-steps.svg", "./content/img/g09-reference.svg", "./content/img/g10-balance.svg", "./content/img/g11-overlap.svg", "./content/img/g12-automation.svg", "./content/img/l-comp.jpg", "./content/img/l-eq.jpg", "./content/img/l-inspector.jpg", "./content/img/l-main.jpg", "./content/img/l-mixer.jpg", "./content/img/l-plugins.jpg", "./content/img/l-region.jpg", "./content/img/l-send.jpg", "./content/img/l-verb.jpg", "./content/img/p01-guide.svg", "./content/img/p02-guide.svg", "./content/img/p03-guide.svg", "./content/img/p04-guide.svg", "./content/img/p05-guide.svg"];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      const isContent = url.pathname.includes('/content/');
      const isImage = url.pathname.endsWith('.svg') || url.pathname.endsWith('.jpg');
      if (response.ok && (isContent || isImage)) {
        (await caches.open(CACHE)).put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      throw error;
    }
  })());
});
