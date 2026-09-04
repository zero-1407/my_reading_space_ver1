// ════════════════════════════════════════════════════════════════
//  아주 작은 저장소 — JSON 파일 하나
//
//   친구 몇 명이 서로 방을 오가는 데는 이걸로 충분하다.
//   사람이 늘면 이 파일만 Postgres 로 갈아끼우면 된다 (인터페이스 동일).
//
//   ⚠️ Render 무료 플랜은 디스크가 임시라서, 다시 배포하면 지워진다.
//      오래 남겨야 할 때가 오면 DATA_DIR 을 영구 디스크로 잡거나
//      Supabase 로 옮긴다.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DIR, 'store.json');

let db = { users: {}, rooms: {}, friends: {} };
let dirty = false;

function load() {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    if (fs.existsSync(FILE)) db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) { console.log('[store] 읽기 실패, 새로 시작합니다 — ' + e.message); }
}
function save() {
  if (!dirty) return;
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);              // 중간에 끊겨도 파일이 깨지지 않게
    dirty = false;
  } catch (e) { console.log('[store] 저장 실패 — ' + e.message); }
}

// 바뀌면 곧바로 (몰아서) 적는다. 서버가 갑자기 죽어도 잃는 게 없게.
let soon = null;
function touch() {
  dirty = true;
  if (soon) return;
  soon = setTimeout(() => { soon = null; save(); }, 600);
  if (soon.unref) soon.unref();
}

load();
const beat = setInterval(save, 5000);
if (beat.unref) beat.unref();
// Render 는 재배포할 때 SIGTERM 을 보낸다. 그때 반드시 적고 나간다.
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig =>
  process.on(sig, () => { save(); process.exit(0); }));
process.on('exit', save);
process.on('uncaughtException', e => { save(); console.error(e); process.exit(1); });

const rnd = n => crypto.randomBytes(n).toString('hex');
// 사람이 불러줄 수 있는 코드 — 헷갈리는 글자(0/O, 1/I)는 뺀다
const WORDS = ['BOOK','ROOM','LAMP','DESK','MOON','TREE','BIRD','NOTE','LEAF','DOOR',
               'RAIN','SNOW','STAR','WIND','PAGE','INK'];
const DIGITS = '23456789';
function newCode() {
  for (let i = 0; i < 200; i++) {
    let n = '';
    for (let k = 0; k < 4; k++) n += DIGITS[Math.floor(Math.random() * DIGITS.length)];
    const code = WORDS[Math.floor(Math.random() * WORDS.length)] + '-' + n;
    if (!db.users[code]) return code;
  }
  return 'ROOM-' + rnd(3).toUpperCase();
}

module.exports = {
  // 처음 들어온 사람에게 코드와 비밀키를 발급한다.
  // 코드는 남에게 알려주는 것, 비밀키는 그 브라우저에만 둔다.
  create(who) {
    const code = newCode(), secret = rnd(24);
    db.users[code] = { code, secret, who: who || '이름 없는 사람', at: Date.now() };
    db.friends[code] = [];
    touch();
    return { code, secret };
  },
  auth(code, secret) {
    const u = db.users[code];
    return !!(u && secret && u.secret === secret);
  },
  exists(code) { return !!db.users[code]; },

  // 방 저장 — 통째로 덮어쓴다
  putRoom(code, room) {
    db.rooms[code] = Object.assign({}, room, { code, at: Date.now() });
    if (db.users[code] && room.who) db.users[code].who = room.who;
    touch();
  },
  getRoom(code) { return db.rooms[code] || null; },

  // 친구 — 한쪽이 맺으면 양쪽에 생긴다
  addFriend(a, b) {
    if (a === b || !db.users[b]) return false;
    db.friends[a] = db.friends[a] || [];
    db.friends[b] = db.friends[b] || [];
    if (!db.friends[a].includes(b)) db.friends[a].push(b);
    if (!db.friends[b].includes(a)) db.friends[b].push(a);
    touch();
    return true;
  },
  friendsOf(code) {
    return (db.friends[code] || []).map(c => this.card(c)).filter(Boolean);
  },

  // 목록에 보여줄 짧은 정보만
  card(code) {
    const u = db.users[code], r = db.rooms[code];
    if (!u) return null;
    const shelves = r && r.items ? r.items.filter(i => i.kind === 'shelf') : [];
    const books = shelves.reduce((n, s) => n + ((s.books || []).length), 0);
    const reading = (shelves.flatMap(s => s.books || []).find(b => !b.done) || {}).t || null;
    return { code, who: (r && r.who) ? r.who : u.who, village: r ? r.village : null,
             books, reading, at: r ? r.at : u.at };
  },
  // 최근에 방을 손본 사람들 — 아무나 구경할 수 있다 (마이스페이스처럼 열려 있다)
  recent(limit) {
    return Object.keys(db.rooms)
      .map(c => this.card(c)).filter(Boolean)
      .sort((a, b) => b.at - a.at)
      .slice(0, limit || 40);
  },
  stats() {
    return { users: Object.keys(db.users).length, rooms: Object.keys(db.rooms).length };
  },
};
