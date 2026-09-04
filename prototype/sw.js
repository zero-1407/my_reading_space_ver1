// 도트 서재 — 서비스 워커
//  앱처럼 설치되고, 지하철에서도 열리게 한다.
//  · 화면을 이루는 파일은 미리 받아두고(먼저 캐시, 뒤에서 갱신)
//  · /api/* 는 네트워크 먼저, 실패하면 마지막으로 받은 것

const VER = 'dot-seojae-v1';
const SHELL = [
  './', './room.html', './manifest.webmanifest',
  './js/audio.js', './js/art.js', './js/season.js', './js/expo.js',
  './js/weather.js', './js/data.js', './js/game.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VER)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // 전시·도서 API — 새 것이 우선, 끊기면 마지막으로 받은 것
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VER).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || new Response(
          JSON.stringify({ ok: false, reason: '오프라인', items: [] }),
          { headers: { 'Content-Type': 'application/json' } })))
    );
    return;
  }

  // 나머지 — 캐시 먼저 주고, 뒤에서 조용히 갱신
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(VER).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
