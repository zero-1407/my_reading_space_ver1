// 도트 서재 — 서비스 워커
//
//  앱처럼 설치되고, 지하철에서도 열리게 한다.
//  다만 **새 버전이 나오면 반드시 새 것을 먼저 본다.**
//  (예전에는 캐시를 먼저 줘서, 배포해도 옛날 화면이 계속 나왔다)
//
//   화면 파일(html·js)  네트워크 먼저 → 실패하면 캐시
//   그림·아이콘         캐시 먼저 → 뒤에서 갱신
//   /api/*              네트워크 먼저 → 실패하면 마지막으로 받은 것

const VER = 'dot-seojae-v3';
const SHELL = [
  './', './room.html', './manifest.webmanifest',
  './js/audio.js', './js/art.js', './js/season.js', './js/expo.js', './js/books.js', './js/news.js',
  './js/net.js', './js/gate.js', './js/weather.js', './js/data.js', './js/game.js',
  './icons/icon-192.png', './icons/icon-512.png',
];
const isShell = url =>
  url.pathname.endsWith('.html') || url.pathname.endsWith('.js') ||
  url.pathname.endsWith('/') || url.pathname.endsWith('.webmanifest');

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

// 페이지에서 "지금 당장 갱신해" 하고 부를 수 있게
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

function networkFirst(req) {
  return fetch(req)
    .then(res => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(VER).then(c => c.put(req, copy));
      }
      return res;
    })
    .catch(() => caches.match(req).then(hit => hit || Promise.reject(new Error('오프라인'))));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // API — 새 것이 우선, 끊기면 마지막으로 받은 것
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      networkFirst(req).catch(() => new Response(
        JSON.stringify({ ok: false, reason: '오프라인', items: [] }),
        { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // 화면을 이루는 파일 — 언제나 새 것을 먼저 본다
  if (isShell(url) || req.mode === 'navigate') {
    e.respondWith(networkFirst(req));
    return;
  }

  // 그림 같은 것 — 캐시 먼저 주고 뒤에서 갱신
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
