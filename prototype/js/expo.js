// ════════════════════════════════════════════════════════════════
//  전시 — 박물관에 걸리는 실제 전시 정보
//
//   서버(/api/expo)가 공공데이터 전시 API 를 대신 불러 준다.
//   · 받아오면 localStorage 에 저장해 두고 6시간마다 다시 받는다
//   · 서버가 없거나(파일로 직접 열었을 때) 키가 없으면 예비 자료로 돈다
// ════════════════════════════════════════════════════════════════

const Expo = (() => {
  const KEY = 'dotseojae.expo.v1';
  const TTL = 1000 * 60 * 60 * 6;
  let items = null, state = 'idle', note = '';
  const subs = [];

  function cached() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o || !Array.isArray(o.items) || !o.items.length) return null;
      return o;
    } catch (e) { return null; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), items: list })); } catch (e) {}
  }
  const emit = () => subs.forEach(f => { try { f(); } catch (e) {} });

  async function refresh(force) {
    const c = cached();
    if (c && !force && Date.now() - c.at < TTL) {
      items = c.items; state = 'cache';
      note = '저장해 둔 목록 (' + new Date(c.at).toLocaleString('ko-KR') + ' 기준)';
      emit(); return items;
    }
    state = 'loading'; note = '전시 정보를 받아오는 중…'; emit();
    try {
      const r = await fetch('/api/expo', { cache:'no-store' });
      const j = await r.json();
      if (j.ok && j.items.length) {
        items = j.items; save(items);
        state = 'live'; note = '방금 받아온 실제 전시 ' + items.length + '건';
      } else {
        throw new Error(j.reason || '받아온 전시가 없습니다');
      }
    } catch (e) {
      if (c) { items = c.items; state = 'cache'; note = '연결 실패 · 저장해 둔 목록을 씁니다'; }
      else {
        items = FALLBACK; state = 'fallback';
        note = '예비 자료 — 실제 전시를 보려면 서버를 켜세요 (node server.js)';
      }
    }
    emit(); return items;
  }

  // 서버도 키도 없을 때 쓰는 예비 자료
  const FALLBACK = [
    { title:'활자, 손에서 기계로', where:'국립중앙박물관 기획전시실',
      from:'2026.08.12', to:'2026.11.30', tag:'인쇄',
      desc:'목판에서 금속활자, 납활자를 거쳐 오늘의 폰트까지. 한 글자가 만들어지는 방식이 바뀔 때마다 읽는 방식도 바뀌었다.',
      book:'코드' },
    { title:'책을 지킨 사람들', where:'국립중앙도서관 상설전시실',
      from:'2026.03.01', to:'2027.02.28', tag:'도서관사',
      desc:'전쟁과 화재, 검열 속에서 장서를 옮기고 숨긴 사서들의 기록. 피난길에 실려 간 상자 목록이 남아 있다.',
      book:'책은 도끼다' },
    { title:'별을 적는 일', where:'국립과천과학관 특별전시관',
      from:'2026.09.01', to:'2026.12.14', tag:'천문',
      desc:'첨성대에서 보이저까지, 하늘을 기록해 온 도구들. 천상열차분야지도 탁본과 20세기 성도를 나란히 걸었다.',
      book:'코스모스' },
    { title:'집의 안쪽', where:'서울생활사박물관',
      from:'2026.09.20', to:'2026.10.20', tag:'생활사',
      desc:'백 년 동안 방이 어떻게 바뀌었는가. 문갑과 반닫이, 삐삐와 브라운관, 그리고 지금의 책상.',
      book:'디자인의 디자인' },
  ];

  // 전시 주제에서 함께 읽을 책을 골라 붙인다 (서비스의 본체는 결국 책이니까)
  const HINTS = [
    [/활자|인쇄|출판|책|문헌|고서/, '책은 도끼다'],
    [/천문|우주|별|과학|자연/,      '코스모스'],
    [/역사|고고|유물|왕|조선|고려/, '사피엔스'],
    [/미술|회화|그림|조각|사진/,    '방구석 미술관'],
    [/디자인|공예|건축|생활/,       '디자인의 디자인'],
    [/음악|공연|무용/,              '다시, 그림이다'],
    [/자연|생태|환경|식물|동물/,    '침묵의 봄'],
    [/문학|시|소설|작가/,           '데미안'],
  ];
  function withBook(e) {
    if (e.book) return e;
    const hay = (e.title + ' ' + e.tag + ' ' + e.desc);
    for (const [re, b] of HINTS) if (re.test(hay)) return Object.assign({}, e, { book: b });
    return Object.assign({}, e, { book: '지적 대화를 위한 넓고 얕은 지식' });
  }

  const parse = s => {
    const m = (s || '').match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };

  return {
    get state() { return state; },
    get note() { return note; },
    onChange(f) { subs.push(f); },
    refresh,
    // 그날 기준으로 열려 있는 것을 앞에 놓고, 지역 이름이 겹치면 더 앞에 놓는다
    list(today, where) {
      const src = (items || FALLBACK).map(withBook);
      const scored = src.map(e => {
        const a = parse(e.from), b = parse(e.to);
        const on = a && b ? (today >= a && today <= b) : true;
        const local = where && e.where && e.where.includes(where.split(' ')[0]);
        return Object.assign({}, e, { on, local });
      });
      scored.sort((x, y) => (y.on - x.on) || (y.local - x.local));
      return scored.slice(0, 24);
    },
  };
})();
