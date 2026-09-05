// ════════════════════════════════════════════════════════════════
//  신문 — 도서관 신문대에 걸리는 오늘의 기사
//
//   서버(/api/news)가 문화면 RSS 네 곳을 모아 준다.
//   제목·요약·링크만 보여주고 본문은 원문으로 보낸다 (저작권).
//   책·출판·문학 기사가 위로 올라온다 — 여기는 도서관이니까.
// ════════════════════════════════════════════════════════════════

// 분야별로 나눠 보기 — RSS 원문엔 분류가 없어서, 제목·요약의 낱말로 짐작한다
const NEWS_CATS = [
  { key:'book',  label:'책 · 출판', re:/책|출판|소설|시집|작가|서점|도서관|문학|에세이/ },
  { key:'show',  label:'전시 · 공연', re:/전시|공연|연극|무용|축제|박물관|미술관|갤러리/ },
  { key:'film',  label:'영화 · 방송', re:/영화|드라마|방송|다큐|넷플릭스|OTT/ },
  { key:'music', label:'음악', re:/음악|콘서트|앨범|가수|밴드|오케스트라|공연장/ },
];
function newsCatOf(a) {
  const hay = (a.title || '') + ' ' + (a.summary || '');
  for (const c of NEWS_CATS) if (c.re.test(hay)) return c.key;
  return 'etc';
}

const News = (() => {
  const KEY = 'dotseojae.news.v1';
  const TTL = 1000 * 60 * 30;                 // 30분
  let items = null, state = 'idle', note = '';
  const subs = [];

  function cached() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      return o && Array.isArray(o.items) && o.items.length ? o : null;
    } catch (e) { return null; }
  }
  const emit = () => subs.forEach(f => { try { f(); } catch (e) {} });

  const FALLBACK = [
    { title:'[신간] 출판인의 편지', summary:'한 편집자가 작가에게 보낸 편지를 묶었다. 원고가 책이 되기까지 오가는 말들.',
      source:'예비 자료', link:'', date:'' },
    { title:'동네서점, 다시 늘어난다', summary:'대형 서점이 줄어든 자리에 작은 책방이 들어선다. 주인이 고른 책만 두는 곳들.',
      source:'예비 자료', link:'', date:'' },
    { title:'도서관 대출 1위는 여전히 소설', summary:'지난해 공공도서관 대출 통계. 800번대가 절반을 넘겼다.',
      source:'예비 자료', link:'', date:'' },
  ];

  async function refresh(force) {
    const c = cached();
    if (c && !force && Date.now() - c.at < TTL) {
      items = c.items; state = 'cache';
      note = '받아둔 기사 (' + new Date(c.at).toLocaleTimeString('ko-KR') + ')';
      emit(); return items;
    }
    state = 'loading'; note = '오늘 신문을 가져오는 중…'; emit();
    try {
      const j = await (await fetch('/api/news', { cache:'no-store' })).json();
      if (!j.ok || !j.items.length) throw new Error(j.reason || '기사가 없습니다');
      items = j.items.map(a => Object.assign({ cat: newsCatOf(a) }, a));
      try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), items })); } catch (e) {}
      state = 'live'; note = '오늘 문화면 ' + items.length + '건';
    } catch (e) {
      if (c) { items = c.items; state = 'cache'; note = '연결 실패 · 받아둔 기사를 봅니다'; }
      else { items = FALLBACK.map(a => Object.assign({ cat: newsCatOf(a) }, a)); state = 'fallback';
             note = '예비 자료 — 실제 기사를 보려면 서버를 켜세요 (node server.js)'; }
    }
    emit(); return items;
  }

  return {
    get state() { return state; },
    get note() { return note; },
    onChange(f) { subs.push(f); },
    refresh,
    list(cat) {                                // 온 순서 그대로 — 최신순. cat 을 주면 그 분야만
      const all = items || FALLBACK;
      return cat ? all.filter(a => a.cat === cat) : all;
    },
    counts() {                                 // 분야별 개수 — 칩에 몇 건인지 보여주려고
      const all = items || FALLBACK, out = {};
      all.forEach(a => { out[a.cat] = (out[a.cat] || 0) + 1; });
      return out;
    },
  };
})();
