// Gestione Squadra — demo_1
// Nota: non cambia la logica dell'app; migliora solo la cache per risorse con querystring (?v=...)

const CACHE_NAME = 'gs-cache-demo_1';
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/campo.png",
  "./assets/jersey-red.png",
  "./assets/jersey-yellow.png",
  "./assets/pitch_3d.png",
  "./assets/pitch_custom.png",
  "./assets/bg/pitch.png",
  "./assets/bg/goal_net.svg",
  "./assets/bg/honeycomb_bg.png",
  "./assets/bg/honeycomb_bg_soft.png",
  "./assets/bg/logo_bg.png",
  "./assets/players/1.png",
  "./assets/players/2.png",
  "./assets/players/3.png",
  "./assets/players/4.png",
  "./assets/players/5.png",
  "./assets/players/6.png",
  "./assets/players/7.png",
  "./assets/players/8.png",
  "./assets/players/9.png",
  "./assets/players/10.png",
  "./assets/players/11.png",
  "./assets/players/12.png",
  "./assets/players/13.png"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c=>c.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.map(k=>k!==CACHE_NAME ? caches.delete(k) : null)))
      .then(()=>self.clients.claim())
  );
});

function normalizeRequest(request){
  try{
    const url = new URL(request.url);
    // Ignora querystring per risorse locali (es: style.css?v=demo_3"";
      return new Request(url.toString(), {
        method: request.method,
        headers: request.headers,
        mode: request.mode,
        credentials: request.credentials,
        redirect: request.redirect,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy,
        integrity: request.integrity,
        cache: request.cache
      });
    }
  }catch(_){ /* noop */ }
  return request;
}

self.addEventListener("fetch", (e)=>{
  const req = normalizeRequest(e.request);
  e.respondWith(
    caches.match(req).then(res=>{
      return res || fetch(e.request).catch(()=>caches.match("./index.html"));
    })
  );
});
