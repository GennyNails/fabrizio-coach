const CACHE_NAME = "gestione-squadra-v1.2.09";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/bg/pitch.png"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", (e)=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE_NAME ? caches.delete(k) : null))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", (e)=>{
  e.respondWith(
    caches.match(e.request).then(res=>res || fetch(e.request).catch(()=>caches.match("./index.html")))
  );
});
