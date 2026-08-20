/* 블록포장 품질검측 서비스워커 — 오프라인 캐시 */
var CACHE = "blkqc-v1.2.1";
var FILES = ["./", "./index.html", "./manifest.json",
             "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png"];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(FILES); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.map(function(k){ if(k!==CACHE) return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
/* 네트워크 우선 + 실패 시 캐시 (현장에서 신호가 없어도 열린다) */
self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(function(res){
      var copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(m){
        return m || caches.match("./index.html");
      });
    })
  );
});
