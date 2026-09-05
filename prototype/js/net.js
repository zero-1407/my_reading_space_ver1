// ════════════════════════════════════════════════════════════════
//  연결 — 계정, 그리고 친구와 방을 주고받는 일
//
//   · 아이디와 비밀번호로 가입하면 어느 기기에서도 내 방으로 돌아온다
//   · 로그인하면 열쇠(token)를 받아 브라우저에 둔다
//   · 방을 손볼 때마다 조용히 서버에 올린다
//   · 친구 코드를 넣으면 양쪽에 동시에 친구가 된다
//
//   서버가 없으면(파일로 직접 열었을 때) 조용히 혼자 모드로 돈다.
// ════════════════════════════════════════════════════════════════

const Net = (() => {
  const KEY = 'dotseojae.id.v2';
  let me = null;                    // { code, token, who, id }
  let online = false, reason = '서버 없음 (혼자 모드)';
  const subs = [];
  const emit = () => subs.forEach(f => { try { f(); } catch (e) {} });

  const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const keep = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) {} };

  async function call(path, opt) {
    const r = await fetch(path, Object.assign({ headers:{ 'Content-Type':'application/json' } }, opt));
    let j;
    try { j = await r.json(); } catch (e) { throw new Error('서버가 이상한 답을 했어요'); }
    if (!j.ok) throw new Error(j.reason || '요청이 되지 않았어요');
    return j;
  }
  const post = (path, obj) => call(path, { method:'POST', body: JSON.stringify(obj) });
  const usable = () => location.protocol.startsWith('http');

  function adopt(j) {
    me = { code:j.code, token:j.token, who:j.who, id:j.id || null, guest:!!j.guest };
    keep(me); online = true; reason = '연결됨'; emit();
    return me;
  }

  return {
    get me() { return me; },
    get code() { return me ? me.code : null; },
    get who()  { return me ? me.who : null; },
    get isGuest() { return !!(me && me.guest); },
    get online() { return online; },
    get reason() { return reason; },
    get canConnect() { return usable(); },
    onChange(f) { subs.push(f); },

    // 저장된 열쇠가 아직 쓸모 있는지 확인한다. 없으면 null 을 준다.
    async resume() {
      if (!usable()) { reason = '파일로 열면 연결이 안 돼요 · node server.js 로 켜주세요'; emit(); return null; }
      const s = saved();
      if (!s || !s.code || !s.token) { online = false; reason = '로그인이 필요해요'; emit(); return null; }
      try { return adopt(await post('/api/me', { code:s.code, token:s.token })); }
      catch (e) { keep(null); online = false; reason = '다시 로그인해 주세요'; emit(); return null; }
    },
    async signup(id, pw, who) { return adopt(await post('/api/signup', { id, pw, who })); },
    async login(id, pw)       { return adopt(await post('/api/login',  { id, pw })); },
    async guest(who)          { return adopt(await post('/api/me', { guest:true, who })); },
    logout() { keep(null); me = null; online = false; reason = '로그아웃했어요'; emit(); },
    async rename(who) {
      if (!me) return;
      const j = await post('/api/rename', { code:me.code, token:me.token, who });
      me.who = j.who; keep(me); emit();
    },

    // 방을 통째로 올린다. 너무 잦지 않게 묶어서 보낸다.
    push(room) {
      if (!online || !me) return;
      this._pending = room;
      if (this._timer) return;
      this._timer = setTimeout(async () => {
        this._timer = null;
        const r = this._pending; this._pending = null;
        try { await call('/api/room', { method:'PUT',
          body: JSON.stringify({ code:me.code, token:me.token, room:r }) }); }
        catch (e) { reason = '저장 실패 — ' + e.message; emit(); }
      }, 1500);
    },
    // 기다리지 않고 지금 바로 올린다 — 책갈피를 끼우자마자 탭을 닫아도
    // (keepalive 라서) 페이지가 닫힌 뒤에도 요청이 살아남는다.
    flush() {
      if (!online || !me || !this._pending) return;
      clearTimeout(this._timer); this._timer = null;
      const r = this._pending; this._pending = null;
      try { fetch('/api/room', { method:'PUT', keepalive:true,
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ code:me.code, token:me.token, room:r }) }); } catch (e) {}
    },
    async room(code) { return (await call('/api/room/' + encodeURIComponent(code))).room; },
    async friends() {
      if (!me) return [];
      return (await call('/api/friends/' + encodeURIComponent(me.code))).friends;
    },
    async addFriend(code) {
      const c = String(code || '').trim().toUpperCase();
      if (!c) throw new Error('코드를 넣어주세요');
      if (me && c === me.code) throw new Error('내 코드예요');
      return (await post('/api/friend', { code:me.code, token:me.token, friend:c })).friends;
    },
    async people() { return (await call('/api/people')).people; },

    // 남의 책에 진짜로 흔적을 남긴다 — 그 방 주인의 서버 데이터가 직접 바뀐다
    async leaveTrace(target, shelfIndex, bookTitle, kind, extra) {
      if (!me) throw new Error('로그인해야 흔적을 남길 수 있어요');
      return post('/api/trace', Object.assign(
        { code:me.code, token:me.token, target, shelfIndex, bookTitle, kind }, extra));
    },

    // 마을 도서관 ↔ 실제 기관 연결 — 다 같이 보는 값이라 서버가 갖고 있다
    async libBindings() { return (await call('/api/libbind')).bindings; },
    async setLibBind(key, libName) {
      if (!me) throw new Error('로그인해야 연결할 수 있어요');
      return (await post('/api/libbind', { code:me.code, token:me.token, key, libName })).bindings;
    },

    // 재즈바 실시간 동시접속 — 정원이 차면 서버가 거절한다 (reason 에 담겨 온다)
    async jazzPing(x, y) {
      if (!me) return { people:[], cap:10 };
      return post('/api/jazz/ping', { code:me.code, token:me.token, x, y });
    },
    jazzLeave() {
      if (!me) return;
      // 페이지를 벗어날 때도 보낼 수 있게 fetch + keepalive — await 안 한다
      try { fetch('/api/jazz/leave', { method:'POST', keepalive:true,
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ code:me.code, token:me.token }) }); } catch (e) {}
    },
  };
})();
