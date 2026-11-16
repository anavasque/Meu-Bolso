const CACHE = 'bolso-shell-v22';
const SHELL = ['./motion.css?v=22', './style.css?v=22', './appearance.css?v=22', './app.js?v=22', './manifest.webmanifest?v=22', './logo-bolso.png', './favicon-bolso.png', './icon-bolso-192.png', './icon-bolso-512.png', './apple-touch-icon-bolso.png', './fonts/vt323.ttf', './fonts/pixelify.ttf', './fonts/inter.ttf', './fonts/ibmplexsans.ttf', './fonts/manrope.ttf', './fonts/publicsans.ttf'];

/* OFFLINE_SHELL_START */
const OFFLINE_HTML = "<!doctype html>\n<html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"bolso-build\" content=\"22\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\"><meta name=\"theme-color\" content=\"#d8c4f4\"><meta name=\"apple-mobile-web-app-capable\" content=\"yes\"><meta name=\"apple-mobile-web-app-status-bar-style\" content=\"default\"><meta name=\"description\" content=\"Suas finanças, com leveza. Um aplicativo pessoal que funciona offline.\"><link rel=\"icon\" type=\"image/png\" href=\"favicon-bolso.png\"><link rel=\"manifest\" href=\"manifest.webmanifest?v=22\"><link rel=\"apple-touch-icon\" href=\"apple-touch-icon-bolso.png\"><link rel=\"stylesheet\" href=\"style.css?v=22\"><link rel=\"stylesheet\" href=\"appearance.css?v=22\"><link rel=\"stylesheet\" href=\"motion.css?v=22\"><title>Bolso — suas finanças</title></head><body><div id=\"splash\" aria-hidden=\"true\"><span class=\"splash-scene\"><span id=\"splash-coin\"></span><span class=\"splash-star star-one\">✦</span><span class=\"splash-star star-two\">✦</span><span id=\"splash-icon\"></span></span><span>Bolso</span></div><div class=\"shell\"><header><a class=\"brand\" href=\"#inicio\" aria-label=\"Bolso, início\"><span id=\"brand-icon\"></span><span>Bolso</span></a><span class=\"local-badge\"><span></span>No seu aparelho</span></header><main id=\"main\"></main><nav id=\"nav\" aria-label=\"Navegação principal\"></nav></div><dialog id=\"dialog\"><div id=\"dialog-content\"></div></dialog><div id=\"toast\" role=\"status\" aria-live=\"polite\"></div><script src=\"app.js?v=22\"></script></body></html>\n";
/* OFFLINE_SHELL_END */

















self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const requests = SHELL.map(path => new Request(new URL(path, self.location.href), {cache:'reload'}));
    await cache.addAll(requests);
    // Offline HTML comes from our source, not a captured CDN verification page.
    await cache.put('./index.html', new Response(OFFLINE_HTML, {headers:{'Content-Type':'text/html; charset=utf-8'}}));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('bolso-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
async function navigate(request) {
  try {
    // Online navigation receives the host's current document and security checks.
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(CACHE);
    const offline = await cache.match('./index.html');
    if (offline) return offline;
    throw error;
  }
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(navigate(event.request));
    return;
  }
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(cached => cached || fetch(event.request)));
});
