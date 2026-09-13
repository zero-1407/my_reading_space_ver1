// ════════════════════════════════════════════════════════════════
//  책 검색 — 카카오 책 검색 API로 CATALOG에 없는 책도 찾는다
//
//   서버(/api/booksearch)가 카카오 책 검색 API를 대신 불러 준다.
//   (알라딘 OpenAPI가 2026-10-30 종료되어 이쪽으로 옮겼다)
//   · 서버가 없거나 KAKAO_REST_KEY 가 없으면 빈 목록으로 돈다 (지어내지 않는다)
// ════════════════════════════════════════════════════════════════

const BookSearch = (() => {
  let lastNote = '';
  return {
    get lastNote() { return lastNote; },
    async search(q) {
      try {
        const r = await fetch('/api/booksearch?q=' + encodeURIComponent(q), { cache:'no-store' });
        const j = await r.json();
        lastNote = j.ok ? '' : (j.reason || '검색 서버에 연결할 수 없어요');
        return j.ok ? j.items : [];
      } catch (e) {
        lastNote = '검색 서버에 연결할 수 없어요';
        return [];
      }
    },
  };
})();
