// ════════════════════════════════════════════════════════════════
//  연결 — 친구와 실제로 방을 주고받는다
//
//   · 처음 들어오면 서버가 코드와 비밀키를 준다
//       코드   남에게 알려주는 것 (BOOK-4821 같은 모양)
//       비밀키 이 브라우저에만 둔다. 내 방을 고칠 권한
//   · 방을 손볼 때마다 조용히 서버에 올린다
//   · 친구 코드를 넣으면 양쪽에 동시에 친구가 된다
//
//   서버가 없으면(파일로 직접 열었을 때) 조용히 혼자 모드로 돈다.
// ════════════════════════════════════════════════════════════════

const Net = (() => {
  const KEY = 'dotseojae.id.v1';
  let me = null;                       // { code, secret }
  let online = false, reason = '서버 없음 (혼자 모드)';
  const subs = [];
  const emit = () => subs.forEach(f => { try { f(); } catch (e) {} });

  const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const keep = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };

  async function call(path, opt) {
    const r = await fetch(path, Object.assign({ headers:{ 'Content-Type':'application/json' } }, opt));
    const j = await r.json();
    if (!j.ok) throw new Error(j.reason || '요청 실패');
    return j;
  }

  async function connect(who) {
    if (!location.protocol.startsWith('http')) {
      reason = '파일로 열면 연결이 안 돼요 · node server.js 로 켜주세요'; emit(); return false;
    }
    try {
      const prev = saved() || {};
      const j = await call('/api/me', { method:'POST',
        body: JSON.stringify({ code: prev.code, secret: prev.secret, who }) });
      me = { code: j.code, secret: j.secret };
      keep(me);
      online = true; reason = '연결됨';
      emit();
      return true;
    } catch (e) {
      online = false; reason = '연결 실패 — ' + e.message; emit(); return false;
    }
  }

  // 방을 통째로 올린다. 너무 잦지 않게 묶어서 보낸다.
  let pending = null, timer = null;
  function push(room) {
    if (!online || !me) return;
    pending = room;
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null;
      const room2 = pending; pending = null;
      try { await call('/api/room', { method:'PUT',
        body: JSON.stringify({ code: me.code, secret: me.secret, room: room2 }) }); }
      catch (e) { online = false; reason = '저장 실패 — ' + e.message; emit(); }
    }, 1500);
  }

  return {
    get me() { return me; },
    get code() { return me ? me.code : null; },
    get online() { return online; },
    get reason() { return reason; },
    onChange(f) { subs.push(f); },
    connect, push,
    async room(code) { return (await call('/api/room/' + encodeURIComponent(code))).room; },
    async friends() {
      if (!me) return [];
      return (await call('/api/friends/' + encodeURIComponent(me.code))).friends;
    },
    async addFriend(code) {
      const c = String(code || '').trim().toUpperCase();
      if (!c) throw new Error('코드를 넣어주세요');
      if (me && c === me.code) throw new Error('내 코드예요');
      return (await call('/api/friend', { method:'POST',
        body: JSON.stringify({ code: me.code, secret: me.secret, friend: c }) })).friends;
    },
    async people() { return (await call('/api/people')).people; },
  };
})();
