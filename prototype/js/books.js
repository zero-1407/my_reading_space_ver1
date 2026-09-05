// ════════════════════════════════════════════════════════════════
//  실제 도서관 장서 — 공공데이터 「기관별 도서정보」
//
//   서버(/api/books)가 실제 도서관들이 보유한 책 목록을 대신 받아 온다.
//   기관 이름(instt)으로 걸러내면 "그 도서관이 실제로 갖고 있는 책"이 된다.
//   이름이 완전히 같은 도서관이면 어느 마을에서 봐도 똑같은 결과가 나온다 —
//   전부 이 서버가 가진 하나의 데이터에서 나오기 때문이다.
//
//   · 받아오면 localStorage 에 저장해 두고 6시간마다 다시 받는다
//   · 서버가 없거나 KCISA_KEY 가 없으면 빈 목록으로 돈다 (지어내지 않는다)
// ════════════════════════════════════════════════════════════════

const Books = (() => {
  const KEY = 'dotseojae.books.v1';
  const TTL = 1000 * 60 * 60 * 6;
  let items = [], state = 'idle', note = '실제 장서를 아직 안 받아왔어요';
  const subs = [];
  const emit = () => subs.forEach(f => { try { f(); } catch (e) {} });

  function cached() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o || !Array.isArray(o.items)) return null;
      return o;
    } catch (e) { return null; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), items: list })); } catch (e) {}
  }

  async function refresh(force) {
    const c = cached();
    if (c && !force && Date.now() - c.at < TTL) {
      items = c.items; state = 'cache';
      note = '저장해 둔 실제 장서 (' + new Date(c.at).toLocaleString('ko-KR') + ' 기준)';
      emit(); return items;
    }
    state = 'loading'; note = '실제 장서 정보를 받아오는 중…'; emit();
    try {
      const r = await fetch('/api/books', { cache:'no-store' });
      const j = await r.json();
      if (j.ok && j.items.length) {
        items = j.items; save(items);
        state = 'live'; note = '방금 받아온 실제 장서 ' + items.length + '건';
      } else {
        throw new Error(j.reason || '받아온 장서가 없습니다');
      }
    } catch (e) {
      if (c) { items = c.items; state = 'cache'; note = '연결 실패 · 저장해 둔 목록을 씁니다'; }
      else { items = []; state = 'empty'; note = '아직 실제 장서가 없어요 — 서버에 KCISA_KEY 를 넣으면 보여요'; }
    }
    emit(); return items;
  }

  const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();

  return {
    get state() { return state; },
    get note() { return note; },
    onChange(f) { subs.push(f); },
    refresh,
    // 이름이 완전히 같은(공백만 무시) 기관의 장서만 돌려준다 —
    // 얼추 비슷한 이름을 억지로 매칭하지 않는다. 같은 이름이면 결과도 같아진다.
    forLibrary(name) {
      const n = norm(name);
      if (!n) return [];
      return items.filter(x => x.instt && norm(x.instt) === n);
    },
    // 지역 이름으로 실제 기관을 찾는다 — '서울 성동' 이면 '성동'을 먼저,
    // 안 걸리면 '서울'로 넓혀서. 지어내지 않고, 진짜 있는 이름만 돌려준다.
    matchRegion(where) {
      if (!items.length || !where) return null;
      const tokens = String(where).trim().split(/\s+/).filter(Boolean).reverse();
      const names = this.institutions(9999);
      for (const tok of tokens) {
        const hit = names.find(n => n.includes(tok));
        if (hit) return hit;
      }
      return null;
    },
    // 실제로 존재하는 기관 이름들 — 매칭이 안 될 때 "이런 이름은 있어요" 힌트용
    institutions(limit) {
      const count = new Map();
      items.forEach(x => { if (x.instt) count.set(x.instt, (count.get(x.instt) || 0) + 1); });
      return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit || 6).map(x => x[0]);
    },
  };
})();
