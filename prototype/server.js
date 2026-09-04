// ════════════════════════════════════════════════════════════════
//  도트 서재 — 개발용 서버 겸 API 프록시
//
//   1) prototype 폴더를 정적으로 서빙한다
//   2) 공공데이터 API 를 대신 호출해 준다
//        /api/expo   전시정보(통합)      API_CCA_145
//        /api/books  기관별 도서정보     API_LIB_051
//
//   왜 서버가 필요한가
//    · file:// 에서는 브라우저가 fetch 를 막는다
//    · 공공 API 는 CORS 헤더를 주지 않아 브라우저가 직접 못 부른다
//    · API 키가 브라우저에 노출되면 안 된다
//   이 셋을 한 번에 푸는 게 프록시다. 실서비스에서도 같은 모양이다.
//
//   실행 (PowerShell)
//     $env:KCISA_KEY = "발급받은 인증키"
//     node server.js
//     → http://localhost:5173
//
//   키 발급
//     https://www.culture.go.kr/data  →  오픈API  →  아래 두 개 활용신청
//       · 한국문화정보원 외_전시정보(통합)      id=598
//       · 한국문화정보원 외_기관별 도서정보      id=672
//     둘 다 같은 인증키를 씁니다.
// ════════════════════════════════════════════════════════════════

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const store = require('./store');

const PORT = process.env.PORT || 5173;
const ROOT = __dirname;

// 활용신청을 따로 하면 키도 따로 나온다. 하나만 있으면 그걸 둘 다 쓴다.
const KEYS = {
  expo:  process.env.KCISA_EXPO_KEY  || process.env.KCISA_KEY || '',
  books: process.env.KCISA_BOOKS_KEY || process.env.KCISA_KEY || '',
};
const API = {
  expo:  'https://api.kcisa.kr/openapi/API_CCA_145/request',   // 전시정보(통합)
  books: 'https://api.kcisa.kr/openapi/API_LIB_051/request',   // 기관별 도서정보
};

// 도서관 신문대 — 문화면 RSS. 키가 필요 없다.
// 제목·요약·링크만 보여주고 본문은 원문으로 보낸다 (저작권)
const FEEDS = [
  { name:'연합뉴스', url:'https://www.yna.co.kr/rss/culture.xml' },
  { name:'경향신문', url:'https://www.khan.co.kr/rss/rssdata/culture_news.xml' },
  { name:'동아일보', url:'https://rss.donga.com/culture.xml' },
  { name:'매일경제', url:'https://www.mk.co.kr/rss/30000023/' },
];

const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',   '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon',
};

// ── 요청 ─────────────────────────────────────────────────────
function get(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      timeout: 12000,
      headers: { 'Accept':'application/json', 'User-Agent':'dot-seojae/0.1' },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return get(new URL(res.headers.location, url).toString()).then(resolve, reject);
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => res.statusCode === 200
        ? resolve(body) : reject(new Error('HTTP ' + res.statusCode + ' — ' + body.slice(0, 160))));
    });
    req.on('timeout', () => req.destroy(new Error('시간 초과')));
    req.on('error', e => {
      // Render 같은 해외 서버에서는 국내 공공기관 도메인이 안 잡히는 일이 있다
      if (e.code === 'ENOTFOUND') return reject(new Error('주소를 못 찾았습니다 (' + e.hostname + ')'));
      reject(e);
    });
  });
}

// JSON 으로 오면 그대로, XML 로 오면 <item> 덩어리를 훑어 객체로 만든다
function toItems(text) {
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    const j = JSON.parse(t);
    const it = j?.response?.body?.items?.item ?? j?.response?.body?.items ??
               j?.body?.items?.item ?? j?.items ?? [];
    return Array.isArray(it) ? it : [it];
  }
  const out = [];
  const blocks = t.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const b of blocks) {
    const o = {};
    const re = /<([A-Za-z_][\w.]*)>([\s\S]*?)<\/\1>/g;
    let m;
    while ((m = re.exec(b))) {
      o[m[1]] = m[2].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    }
    out.push(o);
  }
  if (!out.length) {
    const msg = (t.match(/<returnAuthMsg>([\s\S]*?)<\/returnAuthMsg>/) ||
                 t.match(/<resultMsg>([\s\S]*?)<\/resultMsg>/) || [])[1];
    throw new Error(msg ? msg.trim() : '응답에 item 이 없습니다 (키를 확인하세요)');
  }
  return out;
}

const pick = (o, ...keys) => {
  for (const k of keys) if (o && o[k] != null && String(o[k]).trim()) return String(o[k]).trim();
  return '';
};
const clean = s => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

function splitPeriod(s) {
  const all = (s || '').match(/(\d{4})[.\-/]\s?(\d{1,2})[.\-/]\s?(\d{1,2})/g) || [];
  const fmt = x => {
    const p = x.match(/(\d{4})[.\-/]\s?(\d{1,2})[.\-/]\s?(\d{1,2})/);
    return p[1] + '.' + p[2].padStart(2, '0') + '.' + p[3].padStart(2, '0');
  };
  if (!all.length) return ['', ''];
  return [fmt(all[0]), fmt(all[all.length - 1])];
}

// ── 정리 ─────────────────────────────────────────────────────
function normExpo(items) {
  return items.map(it => {
    const [from, to] = splitPeriod(pick(it, 'PERIOD', 'EVENT_PERIOD', 'DURATION'));
    return {
      title: clean(pick(it, 'TITLE')),
      where: clean(pick(it, 'EVENT_SITE', 'SPATIAL_COVERAGE', 'CNTC_INSTT_NM')),
      from, to,
      tag:   clean(pick(it, 'GENRE')) || '전시',
      desc:  clean(pick(it, 'DESCRIPTION', 'SUB_DESCRIPTION')).slice(0, 420),
      charge: clean(pick(it, 'CHARGE')),
      url:   pick(it, 'URL'),
      image: pick(it, 'IMAGE_OBJECT'),
      instt: clean(pick(it, 'CNTC_INSTT_NM')),
    };
  }).filter(e => e.title);
}
function normBooks(items) {
  return items.map(it => ({
    title:  clean(pick(it, 'TITLE')),
    author: clean(pick(it, 'AUTHOR')),
    isbn:   pick(it, 'ISBN').replace(/[^0-9Xx]/g, ''),
    pub:    clean(pick(it, 'PUBLISHER')),
    desc:   clean(pick(it, 'DESCRIPTION')).slice(0, 300),
    cat:    clean(pick(it, 'BOOK_CATEGORY')),
    instt:  clean(pick(it, 'CNTC_INSTT_NM')),
    image:  pick(it, 'IMAGE_OBJECT'),
    url:    pick(it, 'URL'),
    issued: pick(it, 'ISSUED_DATE'),
  })).filter(b => b.title);
}

// ── 신문 (RSS) ───────────────────────────────────────────────
const tag = (block, name) => {
  const m = block.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>', 'i'));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
};
function parseRss(xml, source) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  return blocks.map(b => {
    const desc = clean(tag(b, 'description'));
    return {
      title: clean(tag(b, 'title')),
      summary: desc.slice(0, 220),
      link: tag(b, 'link') || (b.match(/<link[^>]*>([^<]+)/i) || [, ''])[1].trim(),
      date: tag(b, 'pubDate') || tag(b, 'dc:date'),
      source,
    };
  }).filter(x => x.title && x.link);
}
async function loadNews() {
  const hit = cache.news;
  if (hit && Date.now() - hit.at < 1000 * 60 * 30) return hit.data;   // 30분
  const got = await Promise.allSettled(FEEDS.map(async f =>
    parseRss(await get(f.url), f.name)));
  let all = [];
  got.forEach(r => { if (r.status === 'fulfilled') all = all.concat(r.value); });
  if (!all.length) throw new Error('신문을 받아오지 못했습니다');
  const seen = new Set();
  all = all.filter(a => !seen.has(a.title) && seen.add(a.title));
  all.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));   // 그냥 최신순
  const data = all.slice(0, 60);
  cache.news = { at: Date.now(), data };
  console.log('[news] ' + data.length + '건 (' + FEEDS.length + '개 신문)');
  return data;
}

// ── 캐시 ─────────────────────────────────────────────────────
const cache = {};
const TTL = 1000 * 60 * 60 * 6;
async function load(kind, rows) {
  const hit = cache[kind];
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const key = KEYS[kind];
  if (!key) throw new Error((kind === 'expo' ? 'KCISA_EXPO_KEY' : 'KCISA_BOOKS_KEY') + ' 가 비어 있습니다');
  const qs = new URLSearchParams({ serviceKey: key, numOfRows: String(rows), pageNo: '1' });
  const raw = await get(API[kind] + '?' + qs);
  const data = (kind === 'expo' ? normExpo : normBooks)(toItems(raw));
  cache[kind] = { at: Date.now(), data };
  console.log('[' + kind + '] ' + data.length + '건 받아옴');
  return data;
}

// ── 친구와 방 ────────────────────────────────────────────────
//  코드는 남에게 알려주는 것, 비밀키는 그 사람 브라우저에만 있다.
//  방을 고치려면 비밀키가 필요하고, 구경은 코드만 있으면 된다.
function body(req) {
  return new Promise((resolve, reject) => {
    let s = '', n = 0;
    req.on('data', c => {
      n += c.length;
      if (n > 2 * 1024 * 1024) { reject(new Error('너무 큽니다 (2MB 넘음)')); req.destroy(); return; }
      s += c;
    });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(new Error('JSON 아님')); } });
    req.on('error', reject);
  });
}
async function api(req, res, u) {
  const p = u.pathname, send = o => res.end(JSON.stringify(o));

  if (p === '/api/signup' && req.method === 'POST') {      // 가입
    const b = await body(req);
    try {
      const u = store.signup(b.id, b.pw, b.who);
      console.log('[계정] 가입 ' + u.id + ' → ' + u.code);
      return send({ ok:true, ...u });
    } catch (e) { res.statusCode = 400; return send({ ok:false, reason:e.message }); }
  }
  if (p === '/api/login' && req.method === 'POST') {       // 로그인
    const b = await body(req);
    try { return send({ ok:true, ...store.login(b.id, b.pw) }); }
    catch (e) { res.statusCode = 401; return send({ ok:false, reason:e.message }); }
  }
  if (p === '/api/me' && req.method === 'POST') {          // 열쇠가 아직 쓸모 있나
    const b = await body(req);
    if (b.code && b.token && store.auth(b.code, b.token))
      return send({ ok:true, ...store.whoAmI(b.code), token:b.token, known:true });
    if (b.guest) {                                        // 로그인 없이 둘러보기
      const u = store.create(b.who);
      return send({ ok:true, ...u, guest:true, known:false });
    }
    res.statusCode = 401; return send({ ok:false, reason:'다시 로그인해 주세요' });
  }
  if (p === '/api/rename' && req.method === 'POST') {
    const b = await body(req);
    if (!store.auth(b.code, b.token)) { res.statusCode = 403; return send({ ok:false, reason:'권한 없음' }); }
    store.rename(b.code, b.who);
    return send({ ok:true, ...store.whoAmI(b.code) });
  }
  if (p === '/api/room' && req.method === 'PUT') {         // 내 방 저장
    const b = await body(req);
    if (!store.auth(b.code, b.token)) { res.statusCode = 403; return send({ ok:false, reason:'권한 없음' }); }
    store.putRoom(b.code, b.room || {});
    return send({ ok:true });
  }
  let m = p.match(/^\/api\/room\/([\w-]+)$/);              // 남의 방 구경
  if (m && req.method === 'GET') {
    const r = store.getRoom(m[1]);
    if (!r) { res.statusCode = 404; return send({ ok:false, reason:'그런 방이 없어요' }); }
    const { code, ...rest } = r;
    return send({ ok:true, room:{ ...rest, code } });
  }
  if (p === '/api/friend' && req.method === 'POST') {      // 친구 맺기
    const b = await body(req);
    if (!store.auth(b.code, b.token)) { res.statusCode = 403; return send({ ok:false, reason:'권한 없음' }); }
    if (!store.exists(b.friend)) { res.statusCode = 404; return send({ ok:false, reason:'그런 코드는 없어요' }); }
    store.addFriend(b.code, b.friend);
    return send({ ok:true, friends: store.friendsOf(b.code) });
  }
  m = p.match(/^\/api\/friends\/([\w-]+)$/);
  if (m && req.method === 'GET') return send({ ok:true, friends: store.friendsOf(m[1]) });

  if (p === '/api/people' && req.method === 'GET')         // 열려 있는 방들
    return send({ ok:true, people: store.recent(40), stats: store.stats() });

  res.statusCode = 404; send({ ok:false, reason:'없는 주소' });
}

// ── 서버 ─────────────────────────────────────────────────────
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');

  if (/^\/api\/(me|signup|login|rename|room|friend|friends|people)(\/|$)/.test(u.pathname)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    try { await api(req, res, u); }
    catch (e) { res.statusCode = 400; res.end(JSON.stringify({ ok:false, reason:e.message })); }
    return;
  }

  const m = u.pathname.match(/^\/api\/(expo|books|news)$/);

  if (m) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const data = m[1] === 'news' ? await loadNews()
                 : await load(m[1], m[1] === 'expo' ? 100 : 200);
      res.end(JSON.stringify({ ok:true, source:'api', count:data.length, items:data }));
    } catch (e) {
      // 키가 없거나 API 가 죽어도 화면은 돌아가야 한다 — 클라이언트가 예비 자료를 쓴다
      console.log('[' + m[1] + '] 실패: ' + e.message);
      res.end(JSON.stringify({ ok:false, reason:e.message, items:[] }));
    }
    return;
  }

  const p = u.pathname === '/' ? '/room.html' : u.pathname;
  const file = path.join(ROOT, path.normalize(decodeURIComponent(p)).replace(/^([/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end('nope'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end('404'); }
    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log('도트 서재 → http://localhost:' + PORT);
  console.log('  전시 API : ' + (KEYS.expo  ? '키 있음' : '키 없음 (예비 자료)'));
  console.log('  도서 API : ' + (KEYS.books ? '키 있음' : '키 없음 (예비 자료)'));
  console.log('  신문     : 키 불필요');
});
