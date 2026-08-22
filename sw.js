// Mister Fab 3.0.4 — cache aggiornata
const CACHE_NAME = "mister-fab-cache-3.0.4";
const ASSETS = [
  "./", "./index.html", "./style.css", "./app.js", "./manifest.webmanifest",
  "./assets/icon-192.png", "./assets/icon-512.png", "./assets/sacile-logo.jpg", "./assets/campo.png",
  "./assets/jersey-red.png", "./assets/jersey-yellow.png",
  "./assets/pitch_3d.png", "./assets/pitch_custom.png",
  "./assets/bg/pitch.png", "./assets/bg/goal_net.svg",
  "./assets/bg/honeycomb_bg.png", "./assets/bg/honeycomb_bg_soft.png", "./assets/bg/logo_bg.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).then(response => {
      const copy = response.clone();
      if(new URL(event.request.url).origin === self.location.origin){
        caches.open(CACHE_NAME).then(cache=>cache.put(event.request, copy)).catch(()=>{});
      }
      return response;
    }).catch(async ()=>{
      return (await caches.match(event.request)) || (await caches.match("./index.html"));
    })
  );
});
