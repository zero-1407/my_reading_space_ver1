// ════════════════════════════════════════════════════════════════
//  저장소 — Supabase(Postgres)를 REST로 두드린다
//
//   Render 무료 플랜은 디스크가 임시라서 파일로 저장하면 서버가
//   잠들었다 깰 때마다(15분 유휴) 계정·친구·방이 통째로 사라졌다.
//   그래서 파일 대신 진짜 데이터베이스(Supabase 무료 Postgres)에 쓴다.
//
//   npm 패키지는 하나도 추가하지 않는다 — Node 18 내장 fetch 로
//   Supabase의 REST(PostgREST) 엔드포인트를 직접 호출한다.
//
//   필요한 환경변수 (Render 대시보드에서 넣는다)
//     SUPABASE_URL          예: https://xxxxx.supabase.co
//     SUPABASE_SERVICE_KEY  프로젝트 설정 → API → service_role 키
//                            (anon 키 아님 — 서버에서만 쓰고 절대 브라우저로 보내지 않는다)
//
//   Supabase SQL 에디터에서 미리 만들어둘 테이블 — README 참고
// ════════════════════════════════════════════════════════════════

const crypto = require('crypto');

const BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '') + '/rest/v1';
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
if (!process.env.SUPABASE_URL || !KEY)
  console.log('[store] SUPABASE_URL / SUPABASE_SERVICE_KEY 가 비어 있습니다 — 계정을 저장할 수 없습니다');

const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function sb(path, opt) {
  const r = await fetch(BASE + path, Object.assign({ headers: H }, opt));
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error('DB 오류 ' + r.status + ' — ' + body.slice(0, 200));
  }
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}
async function count(table) {
  const r = await fetch(BASE + '/' + table + '?select=code', {
    method: 'HEAD', headers: Object.assign({}, H, { Prefer: 'count=exact' }),
  });
  const cr = r.headers.get('content-range');           // "*/42" 형태
  return cr ? (parseInt(cr.split('/')[1], 10) || 0) : 0;
}
const one = rows => (Array.isArray(rows) && rows[0]) || null;
const enc = s => encodeURIComponent(s);

const rnd = n => crypto.randomBytes(n).toString('hex');
// 사람이 불러줄 수 있는 코드 — 헷갈리는 글자(0/O, 1/I)는 뺀다
const WORDS = ['BOOK','ROOM','LAMP','DESK','MOON','TREE','BIRD','NOTE','LEAF','DOOR',
               'RAIN','SNOW','STAR','WIND','PAGE','INK'];
const DIGITS = '23456789';
async function newCode() {
  for (let i = 0; i < 200; i++) {
    let n = '';
    for (let k = 0; k < 4; k++) n += DIGITS[Math.floor(Math.random() * DIGITS.length)];
    const code = WORDS[Math.floor(Math.random() * WORDS.length)] + '-' + n;
    const hit = one(await sb('/su_users?code=eq.' + code + '&select=code'));
    if (!hit) return code;
  }
  return 'ROOM-' + rnd(3).toUpperCase();
}

// 비밀번호는 절대 그대로 두지 않는다. 소금을 치고 scrypt 로 굳힌다.
function hash(pw, salt) { return crypto.scryptSync(pw, salt, 32).toString('hex'); }
const norm = s => String(s || '').trim().toLowerCase();

module.exports = {
  // 가입 — 아이디와 비밀번호로 계정을 만든다
  async signup(loginId, pw, who) {
    const id = norm(loginId);
    if (!/^[a-z0-9_.-]{3,20}$/.test(id)) throw new Error('아이디는 영문·숫자 3~20자로 지어주세요');
    if (String(pw || '').length < 6) throw new Error('비밀번호는 여섯 자 이상으로 해주세요');
    const dup = one(await sb('/su_users?id=eq.' + enc(id) + '&select=code'));
    if (dup) throw new Error('이미 있는 아이디예요');
    const code = await newCode(), salt = rnd(16), token = rnd(24);
    const w = (who || '').trim() || id;
    await sb('/su_users', { method: 'POST',
      body: JSON.stringify({ code, id, salt, pw: hash(pw, salt), token, who: w, created_at: Date.now() }) });
    return { code, token, who: w, id };
  },
  // 로그인 — 어느 기기에서도 내 방으로 돌아올 수 있게
  async login(loginId, pw) {
    const u = one(await sb('/su_users?id=eq.' + enc(norm(loginId)) + '&select=*'));
    if (!u || u.pw !== hash(pw, u.salt)) throw new Error('아이디나 비밀번호가 맞지 않아요');
    const token = rnd(24);                       // 로그인할 때마다 새 열쇠
    await sb('/su_users?code=eq.' + enc(u.code), { method: 'PATCH', body: JSON.stringify({ token }) });
    return { code: u.code, token, who: u.who, id: u.id };
  },
  // 예전 방식(익명 코드)도 그대로 받아준다
  async create(who) {
    const code = await newCode(), token = rnd(24);
    const w = who || '이름 없는 사람';
    await sb('/su_users', { method: 'POST',
      body: JSON.stringify({ code, token, who: w, created_at: Date.now() }) });
    return { code, token };
  },
  async auth(code, token) {
    if (!code || !token) return false;
    const u = one(await sb('/su_users?code=eq.' + enc(code) + '&select=token'));
    return !!(u && u.token === token);
  },
  async whoAmI(code) {
    const u = one(await sb('/su_users?code=eq.' + enc(code) + '&select=code,who,id'));
    return u ? { code: u.code, who: u.who, id: u.id || null } : null;
  },
  async rename(code, who) {
    const w = String(who || '').trim().slice(0, 16);
    if (!w) return false;
    await sb('/su_users?code=eq.' + enc(code), { method: 'PATCH', body: JSON.stringify({ who: w }) });
    return true;
  },
  async exists(code) {
    return !!one(await sb('/su_users?code=eq.' + enc(code) + '&select=code'));
  },

  // 방 저장 — 통째로 덮어쓰되, letters 는 클라이언트가 아예 안 보내는 값이라
  // 그대로 두면 그 사이 도착한 편지가 지워진다. 있던 걸 다시 끼워 넣는다.
  async putRoom(code, room) {
    const prev = one(await sb('/su_rooms?code=eq.' + enc(code) + '&select=room'));
    const saved = Object.assign({}, room, { code, at: Date.now() });
    if (prev && prev.room && prev.room.letters) saved.letters = prev.room.letters;
    await sb('/su_rooms?on_conflict=code', {
      method: 'POST', headers: Object.assign({}, H, { Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ code, room: saved, updated_at: Date.now() }),
    });
    if (room.who) await sb('/su_users?code=eq.' + enc(code), { method: 'PATCH', body: JSON.stringify({ who: room.who }) });
  },
  async getRoom(code) {
    const r = one(await sb('/su_rooms?code=eq.' + enc(code) + '&select=room'));
    return r ? r.room : null;
  },

  // 편지 보내기 — 방을 통째로 받아 letters 만 고쳐서 다시 쓴다 (leaveTrace 와 같은 방식)
  async sendLetter(code, letter) {
    const row = one(await sb('/su_rooms?code=eq.' + enc(code) + '&select=room'));
    const room = (row && row.room) || {};
    room.letters = room.letters || [];
    room.letters.unshift(letter);
    if (room.letters.length > 30) room.letters.length = 30;
    await sb('/su_rooms?on_conflict=code', {
      method: 'POST', headers: Object.assign({}, H, { Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ code, room, updated_at: Date.now() }),
    });
  },

  // 남의 책에 흔적(쪽지·책갈피) 남기기 — 방을 통째로 받아 그 책만 고쳐서 다시 쓴다.
  // 동시에 두 사람이 같은 방에 흔적을 남기면 나중에 쓴 쪽이 이길 수 있다 — 이 규모에선 괜찮다.
  async leaveTrace(code, shelfIndex, bookTitle, kind, entry) {
    const row = one(await sb('/su_rooms?code=eq.' + enc(code) + '&select=room'));
    if (!row || !row.room) throw new Error('그런 방이 없어요');
    const room = row.room;
    const shelf = (room.items || []).filter(it => it.kind === 'shelf')[shelfIndex];
    if (!shelf) throw new Error('그 책장을 찾을 수 없어요');
    const bk = (shelf.books || []).find(b => b.t === bookTitle);
    if (!bk) throw new Error('그 책을 찾을 수 없어요 — 이미 자리가 바뀐 것 같아요');
    if (kind === 'pressed') {
      bk.pressed = bk.pressed || [];
      if (bk.pressed.length >= 30) throw new Error('이 책엔 이미 너무 많이 끼워져 있어요');
      bk.pressed.push(entry);
    } else {
      bk.memos = bk.memos || [];
      if (bk.memos.length >= 30) throw new Error('이 책엔 쪽지가 너무 많이 붙어 있어요');
      bk.memos.push(entry);
    }
    await sb('/su_rooms?on_conflict=code', {
      method: 'POST', headers: Object.assign({}, H, { Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ code, room, updated_at: Date.now() }),
    });
    return bk;
  },

  // 친구 — 한쪽이 맺으면 양쪽에 생긴다
  async addFriend(a, b) {
    if (a === b) return false;
    if (!(await this.exists(b))) return false;
    await sb('/su_friends?on_conflict=code,friend', {
      method: 'POST', headers: Object.assign({}, H, { Prefer: 'resolution=ignore-duplicates' }),
      body: JSON.stringify([{ code: a, friend: b }, { code: b, friend: a }]),
    });
    return true;
  },
  async friendsOf(code) {
    const rows = (await sb('/su_friends?code=eq.' + enc(code) + '&select=friend')) || [];
    const cards = await Promise.all(rows.map(r => this.card(r.friend)));
    return cards.filter(Boolean);
  },

  // 목록에 보여줄 짧은 정보만
  async card(code) {
    const u = one(await sb('/su_users?code=eq.' + enc(code) + '&select=code,who,created_at'));
    if (!u) return null;
    const r = one(await sb('/su_rooms?code=eq.' + enc(code) + '&select=room,updated_at'));
    const room = r ? r.room : null;
    const shelves = room && room.items ? room.items.filter(i => i.kind === 'shelf') : [];
    const books = shelves.reduce((n, s) => n + ((s.books || []).length), 0);
    const reading = (shelves.flatMap(s => s.books || []).find(b => !b.done) || {}).t || null;
    return { code, who: (room && room.who) ? room.who : u.who, village: room ? room.village : null,
             books, reading, at: r ? r.updated_at : u.created_at };
  },
  // 최근에 방을 손본 사람들 — 아무나 구경할 수 있다 (마이스페이스처럼 열려 있다)
  async recent(limit) {
    const rows = (await sb('/su_rooms?select=code&order=updated_at.desc&limit=' + (limit || 40))) || [];
    const cards = await Promise.all(rows.map(r => this.card(r.code)));
    return cards.filter(Boolean);
  },
  async stats() {
    const [users, rooms] = await Promise.all([count('su_users'), count('su_rooms')]);
    return { users, rooms };
  },

  // 마을 도서관 ↔ 실제 기관 연결 — 다 같이 보는 값이라 브라우저가 아니라 여기 저장한다.
  // 누가 연결해도 같은 이름을 고른 다른 마을엔 똑같은 실제 장서가 보인다.
  async libBindings() {
    const rows = (await sb('/su_libbind?select=key,lib_name')) || [];
    const out = {};
    rows.forEach(r => { out[r.key] = r.lib_name; });
    return out;
  },
  async setLibBind(key, libName) {
    if (!libName) { await sb('/su_libbind?key=eq.' + enc(key), { method: 'DELETE' }); return; }
    await sb('/su_libbind?on_conflict=key', {
      method: 'POST', headers: Object.assign({}, H, { Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ key, lib_name: libName, at: Date.now() }),
    });
  },
};
