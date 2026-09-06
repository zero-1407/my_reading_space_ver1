// ════════════════════════════════════════════════════════════════
//  신문 — 도서관 신문대에 걸리는 오늘의 기사
//
//   서버(/api/news)가 문화면 RSS 네 곳을 모아 준다.
//   제목·요약·링크만 보여주고 본문은 원문으로 보낸다 (저작권).
//   책·출판·문학 기사가 위로 올라온다 — 여기는 도서관이니까.
// ════════════════════════════════════════════════════════════════

// 분야별로 나눠 보기 — 사설·칼럼은 서버가 어느 RSS에서 왔는지 알아서 opinion 표시를
// 붙여주고, 나머지는 원문에 분류가 없어서 제목·요약의 낱말로 짐작한다
const NEWS_CATS = [
  { key:'book',  label:'책 · 출판', re:/책|출판|소설|시집|작가|서점|도서관|문학|에세이|북페어|신간|평론가?|시인/ },
  { key:'show',  label:'전시 · 공연', re:/전시|공연|연극|무용|축제|박물관|미술관|갤러리|비엔날레|퍼포먼스|뮤지컬|전람회/ },
  { key:'film',  label:'영화 · 방송', re:/영화|드라마|방송|다큐|넷플릭스|OTT|시리즈|박스오피스|감독|배우|예능|천만 관객/ },
  { key:'music', label:'음악', re:/음악|콘서트|앨범|가수|밴드|오케스트라|공연장|트롯|아이돌|케이팝|K-?[Pp]op|싱어송라이터/ },
  { key:'sci',   label:'과학 · 공학', re:/과학|공학|기술|연구진|로봇|인공지능|[Aa][Ii]\b|반도체|우주|나사|NASA|백신|바이러스|양자|배터리|자율주행|스타트업|특허|발사체|위성/ },
  { key:'stock', label:'경제 · 증시', re:/증시|코스피|코스닥|주가|금리|환율|경기|투자|부동산|물가|수출|GDP|증권|채권|급등|급락|상장|배당|시가총액/ },
  { key:'editorial', label:'사설 · 칼럼', re:null },
];
function newsCatOf(a) {
  if (a.opinion) return 'editorial';
  const hay = (a.title || '') + ' ' + (a.summary || '');
  for (const c of NEWS_CATS) if (c.re && c.re.test(hay)) return c.key;
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
             note = '예비 자료 — 지금은 신문 서버에 연결할 수 없어요'; }
    }
    emit(); return items;
  }

  return {
    get state() { return state; },
    get note() { return note; },
    onChange(f) { subs.push(f); },
    refresh,
    list(cat, source) {                        // 온 순서 그대로 — 최신순. cat·source 를 주면 그것만
      const all = items || FALLBACK;
      return all.filter(a => (!cat || a.cat === cat) && (!source || a.source === source));
    },
    counts() {                                 // 분야별 개수 — 칩에 몇 건인지 보여주려고
      const all = items || FALLBACK, out = {};
      all.forEach(a => { out[a.cat] = (out[a.cat] || 0) + 1; });
      return out;
    },
    sources() {                                // 신문사별 개수 — 출처 칩에 쓴다
      const all = items || FALLBACK, out = {};
      all.forEach(a => { out[a.source] = (out[a.source] || 0) + 1; });
      return out;
    },
  };
})();
