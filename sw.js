const CACHE_NAME = "gestione-squadra-v4.5";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/pitch_3d.png",
  "./assets/pitch_custom.png",
  "./assets/bg/pitch.png",
  "./assets/bg/goal_net.svg",
  "./assets/bg/honeycomb_bg.png",
  "./assets/bg/logo_bg.png"
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
