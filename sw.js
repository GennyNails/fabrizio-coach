const CACHE_NAME = "gestione-squadra-v1.2.06";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/bg/pitch.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE_NAME ? caches.delete(k) : null))).then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch", (e)=>{
  const req = e.request;
  e.respondWith(
    caches.match(req).then(res=> res || fetch(req).then(net=>{
      // cache-first for same-origin GET
      try{
        if(req.method==="GET" && new URL(req.url).origin===self.location.origin){
          const copy = net.clone();
          caches.open(CACHE_NAME).then(c=>c.put(req, copy));
        }
      }catch(_){}
      return net;
    }).catch(()=>caches.match("./index.html")))
  );
});
