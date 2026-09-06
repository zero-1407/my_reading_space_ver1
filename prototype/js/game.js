// ════════════════════════════════════════════════════════════════
//  도트 서재 — 본체
//
//   마을 = 독서모임 하나. 회원들의 집과 그 모임의 도서관이 서 있다.
//   버스·기차로 다른 마을에, 공항으로 다른 나라 마을에 놀러 간다.
//
//   조작은 하나로 통일 : 어디든 클릭하면 그리로 걸어가서 알아서 한다.
//   방향키로 걸어도 되고, Space 는 눈앞의 것 (없으면 메뉴).
// ════════════════════════════════════════════════════════════════

const W = 256, H = 144;                 // 실내 한 칸의 크기
// 화면 배율 — 마을에서는 2배로 물러나서 건물이 한눈에 들어오게 한다
const VIEW_IN = { w:256, h:144, s:4 }, VIEW_OUT = { w:512, h:288, s:2 };
let VW = VIEW_IN.w, VH = VIEW_IN.h, SCALE = VIEW_IN.s;
const view = document.getElementById('c'), vctx = view.getContext('2d');
// 캔버스는 내부적으로 늘 VW*SCALE 픽셀로 그려지지만, 좁은 화면(휴대폰 등)에서는
// CSS max-width:100% 로 화면에 더 작게 표시된다. 말풍선·이름표·건물 이름표처럼
// HTML 로 얹는 것들은 이 실제 배율을 곱해줘야 화면 크기와 상관없이 제자리에 온다.
function dispScale() {
  const w = view.getBoundingClientRect().width;
  return w ? w / view.width : 1;
}
const buf = document.createElement('canvas'); buf.width = VW; buf.height = VH;
const ctx = buf.getContext('2d');
Art.bind(ctx);
function setView(out) {
  const v = out ? VIEW_OUT : VIEW_IN;
  if (VW === v.w) return;
  VW = v.w; VH = v.h; SCALE = v.s;
  buf.width = VW; buf.height = VH;
}
const { shade, hue, px, blit, sprite, person, BODY, LEG_A, BIRD_PAL, BIRD_FLY, BIRD_SIT } = Art;
const $ = id => document.getElementById(id);
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => a.slice().sort(() => Math.random() - .5);

// ── 전체 마을 목록 (국내 + 해외) ──────────────────────────────
const VIL = [];
VILLAGES.forEach(v => VIL.push(Object.assign({ country:'kr' }, v)));
COUNTRIES.forEach(c => (c.villages || []).forEach(v => VIL.push(Object.assign({ country:c.key }, v))));
const vidx = key => VIL.findIndex(v => v.key === key);
const countryOf = v => COUNTRIES.find(c => c.key === v.country);

// ── 공간 크기 ─────────────────────────────────────────────────
const TOWN = { w: 880, h: 560 };
const RT = 70, RB = 130, PAD = 6;                       // 방 바닥 위/아래
const ROOM_W = 380;                                     // 방을 옆으로 넓혔다 — 문 걸 자리
const DOOR = { x: 214, y: 18, w: 34, h: 52 };           // 밖으로 나가는 문
// 손님 문 — 이 문 하나로 어디든 간다. 친구가 몇이든 벽이 안 무너진다.
const VDOOR = { x: 272, y: 16, w: 38, h: 54 };
const LIB_W = 1040, LIB_DOOR = { x: 14, y: 18, w: 34, h: 52 };
const LIB_DESK  = { x: 62,  y: 88, w: 52, h: 20 };
const LIB_RANK  = { x: 132, y: 16, w: 56, h: 34 };
const LIB_BOARD = { x: 204, y: 14, w: 64, h: 40 };
const LIB_QUIZ  = { x: 290, y: 94, w: 56, h: 22 };
const LIB_NEWS  = { x: 186, y: 92, w: 64, h: 24 };   // 신문대 — 신문 걸이와 읽는 자리
const STACK_X0 = 370, STACK_W = 48, STACK_GAP = 8;
const stackX = i => STACK_X0 + i * (STACK_W + STACK_GAP);
const LIB_STAIRS = { x: 960, y: 14, w: 46, h: 58 };  // 2층으로 — 두 층이 같은 자리에 있다
// 도서관 2층 — 조용한 열람실
const LIB2_NOOK = [{ x:120, y:96 }, { x:180, y:96 }, { x:520, y:96 }, { x:580, y:96 }];
const LIB2_RARE = { x:760, y:14, w:100, h:56 };
let nookSeated = false, nookRead = null;

// 헌책방 안 — 도서관보다 좁고 어수선하다
const USED_W = 490;
const USED_DOOR = { x:10, y:18, w:34, h:52 };
const USED_TRACE = { x:58,  y:10, w:118, h:56 };     // 흔적 있는 책 서가 (벽)
const USED_FLAT  = { x:192, y:14, w:108, h:52 };     // 균일가 서가 (벽)
const USED_DESK  = { x:60,  y:88, w:70,  h:20 };     // 계산대
const STALLS = [
  { x:194, y:94, w:56, h:22, key:'lit',  name:'문학 더미' },
  { x:270, y:94, w:56, h:22, key:'know', name:'지식 더미' },
  { x:346, y:94, w:56, h:22, key:'art',  name:'예술·종교 더미' },
];
const USED_SWAP = { x:418, y:88, w:52, h:20 };       // 교환대
const CAT = { x:352, y:80 };

// 작은 가게들 안 — 우체국 · 가구점 · 찻집 · 꽃집 · 박물관.
// 전부 이 하나의 틀(SHOP_*)을 같이 쓰고, 가게마다 색과 장식(decor)만 다르다.
const SHOP_W = 320;
const SHOP_DOOR = { x:10, y:18, w:34, h:52 };
const SHOP_DESK = { x:150, y:88, w:70, h:20 };
const SHOP_STAIRS = { x:280, y:14, w:32, h:50 };     // 찻집만 여기로 루프탑에 오른다
const ROOF_TABLES = [{ x:80, y:96 }, { x:220, y:96 }];
// 창 하나, 러그 하나는 다섯 가게가 다 같이 쓴다 (drawItem 의 window·rug 와 같은 그림)
function shopWindow(x, y, w, h) {
  // 창으로 볕이 들어와 바닥에 퍼지는 은은한 빛 웅덩이 — 평평한 실내를 살려준다
  const cx = x + w / 2, cy = y + h;
  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, w * 1.15);
  glow.addColorStop(0, 'rgba(255,244,206,.26)'); glow.addColorStop(1, 'rgba(255,244,206,0)');
  ctx.fillStyle = glow; ctx.fillRect(cx - w * 1.15, cy - 6, w * 2.3, H - cy + 6);
  px(x, y, w, h, '#6E5236');
  px(x + 3, y + 3, w - 6, h - 6, '#DCF0FA');
  px(x + 3, y + h * .58, w - 6, h * .5 - 3, '#B2DCF0');
  px(x + 8, y + 8, 8, 4, '#FFFFFF');
  px(x + w / 2 - 1, y + 3, 2, h - 6, '#6E5236');
  px(x + 3, y + h * .48, w - 6, 2, '#6E5236');
}
function shopRug(x, y, w, h, c) {
  px(x, y, w, h, c);
  px(x + 5, y + 4, w - 10, h - 8, shade(c, 1.18));
  px(x + 12, y + 9, w - 24, h - 18, c);
}
// 흐트러진 듯 성글게 찍는 명암 — 깨끗한 flat fill 대신 손으로 대충 찍은 듯한 질감
function dith(x, y, w, h, c1, c2) {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++)
    if ((xx + yy * 2) % 3 !== 2) px(x + xx, y + yy, 1, 1, (xx + yy) % 2 ? c1 : c2);
}
// 진짜 동그란 덩어리 — 사각형을 층층이 쌓은 원은 계단져 보인다.
// 캔버스의 진짜 원(arc)으로 채우면, 낮은 도트 해상도에서도 가장자리가
// 자연스럽게 섞여 계단 대신 부드러운 경계가 생긴다 (최종 화면은 그대로 도트로 확대되어도).
function blob(cx, cy, r, c) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill();
}
// 꽃송이 — 동그라미 하나면 그냥 공이다. 꽃잎 5장을 돌려 붙여야 꽃이 된다
function bloom(cx, cy, r, c) {
  const pr = Math.max(1, Math.round(r * .58)), orbit = r * .62;
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    blob(Math.round(cx + Math.cos(a) * orbit), Math.round(cy + Math.sin(a) * orbit * .9), pr, c);
  }
  blob(Math.round(cx - orbit * .3), Math.round(cy - orbit * .3), Math.max(1, pr - 1), shade(c, 1.35));
  blob(cx, cy, Math.max(1, Math.round(r * .4)), shade(c, .55));
}
// 살짝 좁아지는 화분 — 사다리꼴이라 사각 블록보다 도자기 같다
function potShape(x, y, w, h, c) {
  const taper = w * .16;
  for (let i = 0; i < h; i++) {
    const inset = Math.round(i * taper / h);
    px(x + inset, y + i, Math.max(1, w - inset * 2), 1, i === 0 ? shade(c, 1.3) : i === h - 1 ? shade(c, .7) : c);
  }
}
// 줄무늬 러그 — 매장 바닥에 깔린 텍스타일. 깨끗한 동심원 대신 손짜임 패턴 느낌으로
function textileRug(x, y, w, h, base, accent) {
  px(x, y, w, h, base);
  for (let i = 2; i < w - 2; i += 5) px(x + i, y + 2, 2, h - 4, shade(accent, 1.06));
  px(x + 2, y + 2, w - 4, 1, shade(base, 1.3)); px(x + 2, y + h - 3, w - 4, 1, shade(base, .7));
}
const SHOPS = {
  post: {
    title:'우체국', wall:'#F0E0D4', floor:'#D8B896', wood:'#B4805A', rug:'#C4645C',
    staff:{ h:'#3a2e28', c:'#C4645C' }, deskLabel:'우편함 확인하기',
    action: () => openPost(),
    decor(t) {
      for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {    // 번호 매겨진 우편함 칸
        const bx = 16 + c * 18, by = 18 + r * 20;
        px(bx, by, 15, 17, (r + c) % 2 ? '#E8C46A' : '#F0DFA0');
        px(bx + 11, by + 8, 2, 2, '#8A6444');                      // 놋쇠 손잡이
      }
      px(14, 16, 110, 2, '#8A6444');
      shopWindow(230, 12, 40, 34);
      px(20, 96, 16, 14, '#C4A876'); px(40, 100, 14, 10, '#B4986A');       // 바닥에 쌓인 소포
      px(20, 96, 16, 2, '#8A6444'); px(24, 100, 8, 2, '#6E5238');
      px(58, 98, 3, 4, '#6E5238'); px(56, 90, 7, 8, '#B0A88E');            // 소포 저울
      px(58, 84, 1, 6, '#6E5238'); px(54, 82, 9, 3, '#8A6444');
    },
  },
  furn: {
    title:'가구점', wall:'#F0E8D0', floor:'#C8A876', wood:'#8A6A44', rug:'#B08A5E',
    staff:{ h:'#4a3a2e', c:'#9aa87e' }, deskLabel:'방에 놓을 것 고르기',
    action: () => openFurniture(),
    decor(t) {
      shopWindow(230, 12, 40, 34);
      // 왼쪽 — 작은 침실 진열
      px(14, 78, 30, 20, '#C48A6E'); px(14, 74, 30, 6, '#EFE4D0');        // 침대
      px(14, 74, 6, 10, '#EFE4D0');
      px(48, 66, 4, 32, '#6E5238'); px(44, 58, 12, 10, '#F0DFA0');        // 스탠드 조명
      // 가운데 — 서랍장과 액자
      px(70, 60, 26, 38, '#B4986A'); px(70, 60, 26, 3, '#8A6A44');
      px(75, 68, 5, 5, '#6E5238'); px(84, 68, 5, 5, '#6E5238');
      px(75, 80, 5, 5, '#6E5238'); px(84, 80, 5, 5, '#6E5238');
      px(72, 40, 20, 16, '#6E5236'); px(74, 42, 16, 12, '#D8CDB4');
      // 오른쪽 — 의자 두 개
      [108, 130].forEach(x => {
        px(x, 82, 14, 16, '#8A6A44'); px(x, 78, 14, 4, '#A88A5E');
      });
    },
  },
  cafe: {
    title:'찻집', wall:'#F6E6EE', floor:'#D8A8B8', wood:'#8A5A6E', rug:'#C48AA0',
    staff:{ h:'#5a4030', c:'#B07A9A' }, deskLabel:'차 한 잔 주문하기',
    action: () => say('찻집 주인', ['오늘은 뭘 읽고 계세요?',
      '차 한 잔 드릴게요. 여기 앉아서 읽다 가셔도 돼요.'],
      [{ label:'☕ 한 잔 마시기', fn: () => { Audio8.play('coin'); startEating('tea');
            toast('따뜻한 차를 마셨어요 · 잠깐 쉬었습니다'); } },
       { label:'그냥 지나가기' }]),
    decor(t) {
      shopWindow(230, 12, 40, 34);
      px(90, 16, 3, 24, '#5A7A52'); px(84, 8, 16, 12, '#6E9A6E');          // 매달린 화분
      [[16, 78], [58, 84]].forEach(([x, y]) => {                          // 원탁 두 개 + 의자
        px(x, y, 24, 20, '#6E4E3A'); px(x, y, 24, 3, '#8A6A50');
        px(x + 4, y - 6, 4, 6, '#EFE4D0'); px(x + 14, y - 6, 4, 6, '#D8645C');
        px(x + 27, y + 4, 8, 12, '#5A4030');
      });
    },
  },
  flower: {
    title:'꽃집', wall:'#E6DCC2', floor:'#B99A72', wood:'#7A6248', rug:'#B5764F',
    staff:{ h:'#3d2b28', c:'#93A374' }, deskLabel:'화분 고르기',
    action: () => openFlower(),
    decor(t) {
      shopWindow(232, 10, 42, 36);
      // 벽지 — 흩뿌린 잎사귀 무늬 (깨끗한 단색 대신 손으로 콕콕 찍은 듯)
      [[8,10],[36,6],[74,14],[130,8],[176,16],[20,32],[96,4],[150,26]].forEach(([x,y]) => {
        px(x, y, 3, 5, shade('#93A374', .92)); px(x + 1, y - 1, 1, 2, shade('#93A374', 1.1));
      });
      // 왼쪽 벽 — 화분 줄, 높이도 크기도 제각각으로 (줄 맞춘 진열대가 아니라 그냥 놓인 느낌)
      //  화분은 사다리꼴, 꽃은 둥근 덩어리(bloom) — 사각 블록으로는 절대 꽃이 안 된다
      const pots = [
        { x:8,  y:92, w:17, h:11, pc:'#A85C46', fc:'#D4645C', lh:16, tilt:-1 },
        { x:28, y:86, w:13, h:15, pc:'#8A6A44', fc:null,      lh:22, tilt:1 },
        { x:46, y:96, w:19, h:9,  pc:'#B5764F', fc:'#E0A54C', lh:12, tilt:0 },
        { x:70, y:90, w:14, h:13, pc:'#7A6248', fc:null,      lh:19, tilt:-1 },
        { x:90, y:97, w:16, h:8,  pc:'#A85C46', fc:'#C98A7C', lh:10, tilt:1 },
      ];
      pots.forEach(p => {
        px(p.x - 1, p.y + p.h, p.w + 2, 2, 'rgba(60,42,24,.16)');          // 바닥에 닿는 그림자 — 붕 뜬 느낌 없애기
        potShape(p.x, p.y, p.w, p.h, p.pc);
        const cx = Math.round(p.x + p.w / 2 + p.tilt), top = p.y - p.lh;
        px(cx, top + 2, 2, p.lh - 2, '#5F7A4A');                           // 줄기
        blob(cx - 4, top + 8, 2, '#7C8F5A'); blob(cx + 4, top + 5, 2, '#8A9A6E'); // 둥근 잎 두 덩이
        if (p.fc) bloom(cx, top, 5, p.fc);                                 // 꽃송이 — 꽃잎 5장
      });
      // 유리 진열장 — 꽃다발이 가득, 뒤섞인 채로 (일렬로 꽂아둔 게 아니라 한 아름 안긴 느낌)
      const gx = 118, gy = 40, gw = 96, gh = 46;
      px(gx - 2, gy - 2, gw + 4, gh + 4, '#7A6248');
      px(gx, gy, gw, gh, 'rgba(220,232,224,.6)');
      [0, 1, 2, 3].forEach(i => px(gx + 2, gy + 2 + i * 11, gw - 4, 1, 'rgba(255,255,255,.35)'));
      const bunch = ['#D4645C', '#E0A54C', '#C98A7C', '#8A7AAE', '#D48AAE'];
      for (let i = 0; i < 7; i++) {
        const bx = gx + 8 + i * 13 + (i % 2 ? 3 : -2), by = gy + gh - 10 - (i % 3) * 5;
        px(bx, by, 2, 9, '#6E8557');                                       // 줄기
        bloom(bx, by - 5, 4, bunch[i % bunch.length]);                     // 둥근 꽃송이
      }
      px(gx, gy + gh - 2, gw, 2, '#7A6248');
      // 화분 나무 두 그루 — 문 옆, 둥근 수관으로
      [[232, 92, 8], [254, 96, 6]].forEach(([x, y, r]) => {
        potShape(x - r * .8, y, r * 1.6, r, '#7A6248');
        blob(x, y - r * 1.1, r, '#7C8F5A'); blob(x - r * .5, y - r * 1.7, r * .7, shade('#7C8F5A', 1.35));
      });
      px(65, 4, 2, 15, '#7A6248'); blob(66, 20, 6, '#93A374');             // 매달린 화분
      px(109, 4, 2, 15, '#7A6248'); blob(110, 24, 6, '#8A9A6E');
      // 화분들 앞 — 물뿌리개와 흩어진 꽃잎 (정돈되지 않은 일상의 흔적), 책상 자리는 피해서
      px(20, 114, 9, 7, '#8A8A78'); px(27, 111, 5, 4, '#8A8A78'); px(31, 113, 3, 1, '#8A8A78');
      [[36,120],[42,116],[47,122]].forEach(([x,y]) => px(x, y, 2, 2, '#C98A7C'));
      textileRug(96, 113, 46, 15, '#B5764F', '#8A6A44');
    },
  },
  museum: {
    title:'박물관', wall:'#F0EDE4', floor:'#C8C4B4', wood:'#8A8A96', rug:'#9A96A8',
    staff:{ h:'#2b2b33', c:'#8A8A96' }, deskLabel:'지금 하는 전시 보기',
    action: () => openExpo(),
    decor(t) {
      [[14, '#D4645C'], [52, '#4A6EB0'], [90, '#5FB0B8']].forEach(([ox, c]) => {
        px(ox, 10, 26, 22, '#3A342C'); px(ox + 2, 12, 22, 18, c);
      });
      shopWindow(230, 12, 40, 34);
      px(50, 80, 20, 22, '#B4B0A2'); px(50, 78, 20, 3, '#8A8676');         // 전시대
      px(56, 66, 8, 14, '#8A8A96');                                       // 흉상
      px(58, 62, 4, 5, '#9A96A8');
    },
  },
};

// ── 마을 건물 배치 (모든 마을이 같은 틀) ──────────────────────
//  shape : gable 박공지붕 · flat 평지붕 · tower 종탑 · dome 둥근지붕 · shed 낮은 창고
const BLD = {
  lib:   { x:248, y:34,  w:196, h:104, name:'도서관', shape:'dome',  roof:'#7E8A96', wall:'#EFE8DA' },
  used:  { x:44,  y:70,  w:112, h:78,  name:'헌책방', shape:'gable', roof:'#A8724E', wall:'#EFDCC0' },
  post:  { x:534, y:46,  w:118, h:72,  name:'우체국', shape:'tower', roof:'#C4645C', wall:'#F0E0D4' },
  furn:  { x:566, y:206, w:132, h:88,  name:'가구점', shape:'shed',  roof:'#8A7A4E', wall:'#F0E8D0' },
  cafe:  { x:392, y:214, w:86,  h:62,  name:'찻집',   shape:'gable', roof:'#B07A9A', wall:'#F6E6EE' },
  flower:{ x:196, y:222, w:74,  h:54,  name:'꽃집',   shape:'greenhouse', roof:'#93A9A0', wall:'#E6DCC2' },
  museum:{ x:712, y:52,  w:140, h:94,  name:'박물관', shape:'dome',  roof:'#A87858', wall:'#EDE0CC' },
  jazz:  { x:388, y:300, w:126, h:80,  name:'재즈바 한밤', shape:'bar', roof:'#4A3E52', wall:'#6B5A72' },
  train: { x:246, y:414, w:186, h:88,  name:'기차역', shape:'flat',  roof:'#6E7A96', wall:'#E4E2EE' },
  air:   { x:534, y:420, w:184, h:84,  name:'공항',   shape:'airport', roof:'#4E7A96', wall:'#DCEAF0' },
};
const BUS  = { x:70, y:428, w:64, h:28 };
const POND = { x:58, y:242, w:104, h:66 };
const LM   = { x:790, y:390 };
const HOUSE_SPOTS = [{ x:56, y:356 }, { x:276, y:340 }];
const HOUSE_W = 56, HOUSE_H = 44;              // 집은 상점보다 작고 아기자기하게

// 길 — 곧은 격자 대신 마을을 한 바퀴 도는 굽은 길
const PATHS = [
  { w:20, pts:[[100,196],[168,172],[238,182],[318,158],[400,176],[476,156],[556,166],
               [624,190],[672,238],[688,300],[712,352],[686,414],[624,452],[540,462],
               [456,448],[372,466],[288,452],[204,470],[128,462],[80,420],[92,356],
               [66,300],[74,242],[100,196]] },
  { w:13, pts:[[318,158],[338,138]] },                 // 도서관 앞
  { w:12, pts:[[100,196],[102,150]] },                 // 헌책방 앞
  { w:12, pts:[[556,166],[592,124]] },                 // 우체국 앞
  { w:12, pts:[[672,238],[632,296]] },                 // 가구점 앞
  { w:11, pts:[[400,176],[434,214],[436,276]] },       // 찻집 앞
  { w:11, pts:[[238,182],[232,222],[234,276]] },       // 꽃집 앞
  { w:12, pts:[[128,462],[102,428]] },                 // 버스정류장
  { w:13, pts:[[372,466],[340,502]] },                 // 기차역
  { w:13, pts:[[540,462],[626,504]] },                 // 공항
  { w:12, pts:[[204,470],[310,400]] },                 // 민지네
  { w:12, pts:[[80,420],[88,418]] },
  { w:11, pts:[[92,356],[130,330]] },                  // 내 집
  { w:10, pts:[[688,300],[700,352]] },                 // 랜드마크
];

function townOf(vi) {
  const key = VIL[vi].key;
  const homes = ROOMS.map((r, i) => ({ r, i })).filter(o => o.r.village === key);
  return { vi, houses: homes.slice(0, 2).map((o, k) => ({
    to: o.i, name: o.i === 0 ? '내 집' : o.r.who + '네',
    x: HOUSE_SPOTS[k].x, y: HOUSE_SPOTS[k].y, w: HOUSE_W, h: HOUSE_H,
    roof: o.i === 0 ? '#C4785E' : shade(o.r.wall, 1.02),
    wall: o.i === 0 ? '#EAD6B4' : shade(o.r.wall, 1.35),
  })) };
}
const TOWNS = VIL.map((_, i) => townOf(i));
const doorOf = b => ({ x: b.x + b.w / 2 - 11, y: b.y + b.h - 4, w: 22, h: 14 });
const mailOf = h => ({ x: h.x + h.w + 6, y: h.y + h.h - 8, w: 10, h: 16 });

// ── 상태 ──────────────────────────────────────────────────────
let place = { kind:'room', idx: 0, vi: vidx(ROOMS[0].village) };
let camX = 0, camY = 0;
const player = { x: DOOR.x + 4, y: 108, dir:'down', moving:false, anim:0 };
const keys = {};
const readKdc = new Set(), borrowed = new Set();
let focus = null, openOv = null, edit = false, drag = null, sel = null;
let walkTo = null;                                  // 클릭 이동 목표
const flights = [], flyFx = [];
let npcs = [], activeEvent = null;

// ── 계절 ──────────────────────────────────────────────────────
//  오늘 날짜를 그대로 따라간다. 마을 색 · 나무 · 떨어진 잎 · 명절이 바뀐다.
let SEASON = Season.of();
let clockDate = new Date();
const TREE_SPOTS = [
  [24,196],[176,206],[24,142],[180,120],[236,200],[300,214],[368,206],[430,214],
  [470,140],[672,150],[700,232],[476,318],[684,470],[176,470],[24,486],[430,470],
  [360,300],[236,352],[700,60],[132,354],
];
// 숲 — [중심x, 중심y, 나무 수]
const GROVES = [[712,120,7],[40,120,5],[726,268,6],[36,470,6],[300,530,7],
                [560,540,6],[452,60,5],[150,236,4],[620,470,5]];
const FEST_AT = { x: 340, y: 300 };            // 광장 — 명절 행사가 서는 자리
let drops = [];                                 // 바닥에 떨어진 잎·꽃
const pocket = {};                              // 주머니 { 종류: 개수 }
let petals = [];                                // 흩날리는 것

function scatterDrops() {
  drops = [];
  const n = SEASON.peak ? 16 : 9;
  for (let i = 0; i < n; i++) {
    const kind = pickOne(SEASON.items);
    let x, y, tries = 0;
    do { x = 16 + Math.random() * (TOWN.w - 40); y = 20 + Math.random() * (TOWN.h - 50); }
    while (blockedRect(x, y) && ++tries < 20);
    drops.push({ kind, x: Math.round(x), y: Math.round(y) });
  }
  petals = Array.from({ length: SEASON.fall ? 22 : 0 }, () => ({
    x: Math.random() * TOWN.w, y: Math.random() * TOWN.h,
    sp: .12 + Math.random() * .22, sw: Math.random() * 6.28,
  }));
}
function blockedRect(x, y) {
  for (const s of solids()) if (x > s.x - 4 && x < s.x + s.w + 4 && y > s.y - 4 && y < s.y + s.h + 4) return true;
  return false;
}
function pickUp(i) {
  const d = drops[i]; if (!d) return;
  drops.splice(i, 1);
  pocket[d.kind] = (pocket[d.kind] || 0) + 1;
  Audio8.play('pin'); renderPocket();
  const it = Season.ITEMS[d.kind];
  toast(it.emo + ' ' + it.name + '을(를) 주웠어요 · 책 사이에 끼울 수 있습니다');
}
function pocketCount() { return Object.values(pocket).reduce((a, b) => a + b, 0); }
function renderPocket() {
  const el = $('pocket');
  const n = pocketCount();
  el.textContent = n ? '🍃 주머니 ' + n : '🍃 주머니 비어 있음';
  el.className = 'pill' + (n ? ' on' : '');
}
// ── 날씨 ──────────────────────────────────────────────────────
let WEATHER = Weather.of(SEASON, clockDate);
let weatherLock = null;                       // 사용자가 직접 고른 날씨
let boltFlash = 0;

// 날짜를 옮기면 계절 · 명절 · 날씨 · 마을 풍경이 전부 따라온다
function setDate(d, keepWeather) {
  clockDate = d;
  SEASON = Season.of(d);
  WEATHER = weatherLock ? Object.assign(Weather.of(SEASON, d), lockPatch(weatherLock))
                        : Weather.of(SEASON, d);
  townBg = null;                              // 계절이 바뀌었으니 바탕을 다시 그린다
  scatterDrops(); renderDateTime(); applyAmbience(); refreshUI();
  if (!keepWeather) toast(SEASON.label + ' · ' + SEASON.name +
    (SEASON.festival ? ' · ' + SEASON.festival.emo + ' ' + SEASON.festival.name : '') +
    ' · ' + WEATHER.emo + ' ' + WEATHER.name);
}
function lockPatch(key) {
  const K = { clear:{ name:'맑음', emo:'☀️', sun:.34, rain:0, cloud:.05, snow:false, thunder:false },
              cloudy:{ name:'흐림', emo:'☁️', sun:.04, rain:0, cloud:.55, snow:false, thunder:false },
              rain:{ name:'비', emo:'🌧', sun:0, rain:.7, cloud:.7, snow:false, thunder:false },
              storm:{ name:'천둥번개', emo:'⛈', sun:0, rain:1, cloud:.85, snow:false, thunder:true },
              snow:{ name:'눈', emo:'🌨', sun:.03, rain:0, cloud:.6, snow:true, thunder:false } };
  return Object.assign({ key }, K[key]);
}
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
                 '-' + String(d.getDate()).padStart(2, '0');
// 계절 크게 고르기 — 각 계절의 한복판으로 간다
const SEASONS4 = [
  { key:'spring', ic:'🌸', nm:'봄',   mo:'3 – 5월',  go: y => new Date(y, 3, 8) },
  { key:'summer', ic:'🌿', nm:'여름', mo:'6 – 8월',  go: y => new Date(y, 6, 20) },
  { key:'autumn', ic:'🍁', nm:'가을', mo:'9 – 11월', go: y => new Date(y, 9, 25) },
  { key:'winter', ic:'❄️', nm:'겨울', mo:'12 – 2월', go: y => new Date(y, 11, 24) },
];
const JUMPS = [
  ['오늘', () => new Date()],
  ['🌸 벚꽃', d => new Date(d.getFullYear(), 3, 5)],
  ['🌧 장마', d => new Date(d.getFullYear(), 6, 3)],
  ['🍁 단풍철', d => new Date(d.getFullYear(), 9, 25)],
  ['🌕 추석', () => new Date(2026, 8, 25)],
  ['🎄 크리스마스', d => new Date(d.getFullYear(), 11, 24)],
  ['🎆 새해', d => new Date(d.getFullYear() + 1, 0, 1)],
  ['🎊 설날', () => new Date(2027, 1, 6)],
];
const WEATHERS = [['자동', null], ['☀️ 맑음', 'clear'], ['☁️ 흐림', 'cloudy'],
                  ['🌧 비', 'rain'], ['⛈ 천둥번개', 'storm'], ['🌨 눈', 'snow']];
function openDate() {
  $('dp').value = iso(clockDate);
  const s4 = $('dp-seasons'); s4.innerHTML = '';
  SEASONS4.forEach(s => {
    const b2 = document.createElement('button');
    if (SEASON.key === s.key) b2.classList.add('on');
    b2.innerHTML = '<span class="ic">' + s.ic + '</span><span class="nm3">' + s.nm +
      '</span><span class="mo">' + s.mo + '</span>';
    b2.onclick = () => { setDate(s.go(clockDate.getFullYear())); openDate(); };
    s4.appendChild(b2);
  });
  const j = $('dp-jumps'); j.innerHTML = '';
  JUMPS.forEach(([label, fn]) => {
    const b2 = document.createElement('button'); b2.textContent = label;
    b2.onclick = () => { const d = fn(clockDate); $('dp').value = iso(d); setDate(d); openDate(); };
    j.appendChild(b2);
  });
  const w = $('dp-weather'); w.innerHTML = '';
  WEATHERS.forEach(([label, key]) => {
    const b2 = document.createElement('button'); b2.textContent = label;
    if (weatherLock === key) b2.classList.add('on');
    b2.onclick = () => { weatherLock = key; setDate(clockDate, true); openDate();
                         toast(WEATHER.emo + ' ' + WEATHER.name); };
    w.appendChild(b2);
  });
  showOv('date');
}
$('dp').addEventListener('change', e => {
  const [y, m, d] = e.target.value.split('-').map(Number);
  if (y) setDate(new Date(y, m - 1, d));
});
$('datetime').onclick = () => { Audio8.wake(); openDate(); };
$('dp-toggle').onclick = function () {
  this.classList.toggle('open');
  $('dp-cal').classList.toggle('on');
};
function renderDateTime() {
  const d = new Date();
  const wd = ['일','월','화','수','목','금','토'][d.getDay()];
  $('dt-date').textContent = SEASON.label + ' (' + wd + ') · ' + SEASON.name;
  $('dt-weather').textContent = WEATHER.emo + ' ' + WEATHER.name +
    (WEATHER.night ? ' · 밤' : WEATHER.dusk ? ' · 해질녘' : '');
  $('dt-fest').textContent = SEASON.festival ? SEASON.festival.emo + ' ' + SEASON.festival.name : '';
}
function applyAmbience() {
  const outside = inTown();
  const k = WEATHER.key === 'storm' ? 'storm' : WEATHER.key === 'rain' ? 'rain'
          : WEATHER.snow ? 'snow' : 'none';
  // 실내에서는 창 너머로 들리니까 조금 약하게 — 여기서는 같은 소리를 쓴다
  Audio8.ambience(k === 'none' ? 'none' : (outside || WEATHER.key === 'storm') ? k : k);
}

$('pocket').onclick = () => {
  const n = pocketCount();
  if (!n) {
    say('주머니', ['아직 아무것도 없어요.',
      SEASON.key === 'winter' ? '겨울엔 동백꽃이나 호랑가시잎이 떨어져 있어요.'
        : '마을 길바닥에 떨어진 걸 주워보세요. ' +
          SEASON.items.map(k => Season.ITEMS[k].emo + Season.ITEMS[k].name).join(' · ')],
      [{ label:'알겠어요' }]);
    return;
  }
  say('주머니 · ' + SEASON.label,
    [Object.keys(pocket).map(k => Season.ITEMS[k].emo + ' ' + Season.ITEMS[k].name + ' ' + pocket[k] + '개').join('\n'),
     '책을 펼치고 「책갈피 끼우기」를 누르면 눌러 끼울 수 있어요.'],
    [{ label:'알겠어요' }]);
};

const inTown = () => place.kind === 'town';
const inRoom = () => place.kind === 'room';
const inLib  = () => place.kind === 'library';
const inUsed = () => place.kind === 'used';
const inRide = () => place.kind === 'ride';
const inJazz = () => place.kind === 'jazz';
const inShop = () => place.kind === 'shop';
const isHome = () => inRoom() && place.idx === 0;
const room   = () => ROOMS[place.idx];
const town   = () => TOWNS[place.vi];
const vill   = () => VIL[place.vi];
const world  = () => inTown() ? TOWN : inLib() ? { w: LIB_W, h: H }
                   : inUsed() ? { w: USED_W, h: H } : inRide() ? { w: RIDE_W, h: H }
                   : inJazz() ? { w: JAZZ_W, h: H } : inShop() ? { w: SHOP_W, h: H }
                   : { w: ROOM_W, h: H };

const shelves  = R => R.items.filter(i => i.kind === 'shelf');
const allBooks = R => shelves(R).flatMap(s => s.books);
const owned    = () => new Set(allBooks(ROOMS[0]).map(x => x.t));
const myVillage = () => vidx(ROOMS[0].village);

// 거리 — 같은 나라는 지도 격자로, 다른 나라는 비행시간으로 환산
function kmBetween(a, b) {
  const A = VIL[a], B = VIL[b];
  if (A.country === B.country && A.mx !== undefined && B.mx !== undefined)
    return Math.round(Math.hypot(A.mx - B.mx, A.my - B.my) * 22);
  const ha = countryOf(A).hours || 0, hb = countryOf(B).hours || 0;
  return Math.round(Math.abs(ha - hb) * 850 + (A.country === B.country ? 60 : 900));
}
const BIRD_KMH = 38;
const flightMinutes = km => Math.max(3, Math.round(km / BIRD_KMH * 60));
const fmtMin = m => m < 60 ? m + '분'
  : m < 1440 ? Math.floor(m / 60) + '시간' + (m % 60 ? ' ' + (m % 60) + '분' : '')
  : Math.floor(m / 1440) + '일 ' + Math.floor((m % 1440) / 60) + '시간';
const demoMs = km => Math.min(45000, Math.max(8000, km * 60));

// ── 책장 배치 ─────────────────────────────────────────────────
function boardsOf(s) {
  const rows = Math.max(1, Math.floor((s.h - 4) / 16)), out = [];
  for (let i = 0; i < rows; i++) out.push(s.y + 4 + 16 * (i + 1));
  return out;
}
function layoutShelf(s) {
  s.boards = boardsOf(s);
  let si = 0, cur = s.x + 4;
  for (const bk of s.books) {
    if (cur + bk.w > s.x + s.w - 4) { si++; cur = s.x + 4; }
    if (si >= s.boards.length) { bk.bx = undefined; continue; }
    bk.bx = cur; bk.by = s.boards[si] - bk.h; cur += bk.w + 1;
  }
}
const layoutRoom = R => shelves(R).forEach(layoutShelf);
ROOMS.forEach(layoutRoom);

// ════ 대화 말풍선 ═══════════════════════════════════════════
let dialog = null;
const bubble = $('bubble');
function say(name, lines, choices) {
  dialog = { name, lines: [].concat(lines), i: 0, choices: choices || null };
  Audio8.play('talk');
  renderDialog();
}
function renderDialog() {
  if (!dialog) { bubble.classList.remove('on'); return; }
  $('bb-name').textContent = dialog.name;
  $('bb-text').textContent = dialog.lines[dialog.i];
  const last = dialog.i >= dialog.lines.length - 1;
  const box = $('bb-choices'); box.innerHTML = '';
  if (last && dialog.choices) {
    $('bb-next').style.display = 'none';
    if (dialog.sel === undefined) dialog.sel = 0;
    dialog.choices.forEach((c, i) => {
      const b2 = document.createElement('button');
      b2.textContent = c.label;
      if (i === dialog.sel) b2.classList.add('sel');
      b2.onmouseenter = () => { dialog.sel = i; markSel(); };
      b2.onclick = ev => { ev.stopPropagation(); const f = c.fn; endDialog(); if (f) f(); };
      box.appendChild(b2);
    });
  } else {
    $('bb-next').style.display = 'block';
    $('bb-next').textContent = last ? '눌러서 닫기 ▸' : '눌러서 계속 ▸';
  }
  bubble.classList.add('on');
  placeBubble();
}
function placeBubble() {
  if (!dialog) return;
  const rect = view.getBoundingClientRect(), ds = dispScale();
  const sx = dialog.at ? (dialog.at.x - camX) * SCALE * ds : rect.width / 2;
  const sy = dialog.at ? (dialog.at.y - camY) * SCALE * ds - 16 : rect.height / 2;
  // 말풍선은 아래에서 위로 자란다 — 항목이 많아 길어지면(메뉴 등) 캔버스 위로
  // 잘려나가지 않게, 실제 높이만큼 최소 top 을 밀어준다. 캔버스 자체가 좁은
  // 휴대폰에서는 이 때문에 말풍선이 캔버스 아래로 살짝 걸칠 수 있는데, 그건
  // #stage 가 overflow:visible 이라 그냥 그 위에 겹쳐 보일 뿐 잘리지 않는다.
  const bh = bubble.offsetHeight || 150;
  bubble.style.left = Math.max(160, Math.min(rect.width - 160, sx)) + 'px';
  bubble.style.top  = Math.max(bh + 10, sy) + 'px';
}
function markSel() {
  const box = $('bb-choices');
  [].forEach.call(box.children, (b2, i) => b2.classList.toggle('sel', i === dialog.sel));
}
// 화살표로 항목 옮기기 — 마우스를 안 써도 되게
function moveSel(d) {
  if (!dialog || !dialog.choices) return false;
  const last = dialog.i >= dialog.lines.length - 1;
  if (!last) return false;
  dialog.sel = (dialog.sel + d + dialog.choices.length) % dialog.choices.length;
  markSel(); Audio8.play('hover'); return true;
}
function chooseSel() {
  if (!dialog || !dialog.choices) return false;
  if (dialog.i < dialog.lines.length - 1) return false;
  const c = dialog.choices[dialog.sel || 0];
  endDialog(); if (c && c.fn) c.fn();
  Audio8.play('select'); return true;
}
function advanceDialog() {
  if (!dialog) return false;
  const last = dialog.i >= dialog.lines.length - 1;
  if (!last) { dialog.i++; Audio8.play('talk'); renderDialog(); return true; }
  if (dialog.choices) return chooseSel();          // Space 로 지금 고른 항목 실행
  endDialog(); return true;
}
function endDialog() { dialog = null; bubble.classList.remove('on'); }
bubble.addEventListener('click', () => advanceDialog());

// ════ 언제든 열리는 메뉴 ════════════════════════════════════
// 어디로든 한 번에 — 걸어다니기 귀찮을 때. 화살표로 고르고 Space 로 간다.
function openMenu() {
  const items = [];
  if (!isHome()) items.push({ label:'🏠 내 방으로', fn: () => enterRoom(0) });
  if (!inTown() && !inRide()) items.push({ label:'🚪 밖으로 나가기', fn: goOut });
  if (!inRide()) {
    items.push({ label:'📚 ' + vill().lib, fn: enterLibrary });
    items.push({ label:'📕 헌책방', fn: enterUsed });
    items.push({ label:'🏛 박물관 · 지금 하는 전시', fn: () => enterShop('museum') });
    items.push({ label:'📰 신문 읽기', fn: openNews });
    items.push({ label:'✉️ 우체국 · 편지', fn: () => enterShop('post') });
    items.push({ label:'🪑 가구점', fn: () => enterShop('furn') });
    items.push({ label:'🪴 꽃집', fn: () => enterShop('flower') });
    items.push({ label:'🎷 재즈바 한밤 · 사람들이 모이는 곳', fn: enterJazz });
    items.push({ label:'🚪 손님 문 · 다른 사람 방', fn: openVisit });
    items.push({ label:'🚌 다른 마을로 (버스 · 기차)', fn: openMap });
    items.push({ label:'✈️ 다른 나라로', fn: openWorld });
  }
  items.push({ label:'🔍 책 찾기', fn: openSearch });
  items.push({ label:'✕ 닫기', fn: null });
  dialog = { name:'어디로 갈까요', lines:['↑↓ 로 고르고 Space 로 갑니다.'], i:0, choices: items, at:null };
  Audio8.play('open'); renderDialog();
}

// ── 입력 ──────────────────────────────────────────────────────
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  Audio8.wake();
  if (openOv) {
    const typing = ['gift', 'search', 'lines', 'write'].includes(openOv);
    if (k === 'escape') { closeOv(); e.preventDefault(); }
    else if (!typing && (k === ' ' || k === 'enter')) { closeOv(); e.preventDefault(); }
    return;
  }
  if (dialog) {
    if (k === 'escape') { endDialog(); e.preventDefault(); return; }
    if (k === 'arrowdown' || k === 's' || k === 'arrowright') { moveSel(1); e.preventDefault(); return; }
    if (k === 'arrowup' || k === 'w' || k === 'arrowleft') { moveSel(-1); e.preventDefault(); return; }
    if (k === ' ' || k === 'enter') { advanceDialog(); e.preventDefault(); return; }
    return;
  }
  // 로그인 화면 · 이름 입력칸처럼 게임 오버레이 밖에 있는 글자 입력창에서는
  // e·f·q·m 같은 단축키를 걸지 않는다 — 안 그러면 'e'가 편집모드를 켜버려서 입력이 막힌다.
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
  if (k === 'f') { e.preventDefault(); openSearch(); return; }
  if (k === 'e' && isHome()) { e.preventDefault(); setEdit(!edit); return; }
  if (k === 'q') { e.preventDefault(); goOut(); return; }
  if (k === 'm') { e.preventDefault(); openMenu(); return; }
  keys[k] = true;
  // 방향키가 페이지를 스크롤시키지 않게 막는다
  if (['arrowleft','arrowright','arrowup','arrowdown'].includes(k)) e.preventDefault();
  if (e.key === ' ') {
    e.preventDefault();
    if (skip.on) { skipHeld = true; return; }       // 물수제비 — 누르고 있으면 힘이 찬다
    if (focus) act(focus); else openMenu();
  }
});
let skipHeld = false;
addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
  if (e.key === ' ' && skipHeld) { skipHeld = false; throwStone(); }
});
// 마우스로도 — 누르고 있다가 놓으면 던진다 (손가락 쪽은 꾸미기 모드 손잡기와 한데 묶어 아래에서 처리)
view.addEventListener('mousedown', () => { if (skip.on && !skip.stone) skipHeld = true; });
addEventListener('mouseup', () => { if (skipHeld) { skipHeld = false; throwStone(); } });
const held = (...n) => n.some(x => keys[x]);

// ── 대상 목록 ─────────────────────────────────────────────────
//  한 곳에서 만들어 클릭과 Space 가 똑같이 쓴다.
function targets() {
  const out = [];
  const add = (o, x, y, label, r) => out.push(Object.assign(o, { px:x, py:y, label, r: r || 16 }));
  // 벽에 붙은 것 — 가로 위치만 보고, 클릭은 네모 범위로 잡는다
  const addX = (o, cx, half, label, top, hgt) => out.push(Object.assign(o, {
    px: cx, py: (top || 0) + (hgt || 60), label, m:'x', half,
    hx: cx - half, hy: top || 0, hw: half * 2, hh: hgt || 66,
  }));

  if (inTown()) {
    const tw = town();
    tw.houses.forEach(h => {
      const d = doorOf(h), m = mailOf(h);
      add({ type:'enter', to:h.to }, d.x + d.w / 2, d.y + 6, (h.to === 0 ? '우리 집' : h.name) + ' 들어가기', 20);
      add({ type:'mail', to:h.to, name:h.name.replace('네', '') }, m.x + 5, m.y + 10,
          h.to === 0 ? '내 우편함' : h.name.replace('네', '') + '에게 문장 보내기', 14);
    });
    const ld = doorOf(BLD.lib);
    add({ type:'library' }, ld.x + ld.w / 2, ld.y + 6, vill().lib + ' 들어가기', 22);
    const ud = doorOf(BLD.used);
    add({ type:'used' }, ud.x + ud.w / 2, ud.y + 6, '헌책방 들어가기', 22);
    const pd = doorOf(BLD.post);
    add({ type:'post' }, pd.x + pd.w / 2, pd.y + 6, '우체국 · 내 우편함', 22);
    const fd = doorOf(BLD.furn);
    add({ type:'furn' }, fd.x + fd.w / 2, fd.y + 6, '가구점 · 방에 놓을 것 사기', 22);
    const cd = doorOf(BLD.cafe);
    add({ type:'cafe' }, cd.x + cd.w / 2, cd.y + 6, '찻집에서 한숨 돌리기', 20);
    const wd2 = doorOf(BLD.flower);
    add({ type:'flower' }, wd2.x + wd2.w / 2, wd2.y + 6, '꽃집 · 화분 사기', 20);
    const md = doorOf(BLD.museum);
    add({ type:'museum' }, md.x + md.w / 2, md.y + 6, '박물관 · 지금 하는 전시', 24);
    const jd = doorOf(BLD.jazz);
    add({ type:'jazz' }, jd.x + jd.w / 2, jd.y + 6, '재즈바 한밤 · 사람들이 모이는 곳', 24);
    add({ type:'pond' }, POND.x + POND.w / 2, POND.y + POND.h + 6,
        SEASON.key === 'summer' ? '호수에서 물놀이' : SEASON.key === 'winter' ? '언 호수에서 스케이트'
        : '호숫가에 앉기', 40);
    const td = doorOf(BLD.train);
    add({ type:'train' }, td.x + td.w / 2, td.y + 6, '기차 타고 먼 마을로', 22);
    const ad = doorOf(BLD.air);
    add({ type:'air' }, ad.x + ad.w / 2, ad.y + 6, '공항 · 다른 나라로', 22);
    add({ type:'bus' }, BUS.x + BUS.w / 2, BUS.y + BUS.h, '버스 타고 가까운 마을로', 20);
    add({ type:'landmark' }, LM.x, LM.y, vill().lmName, 30);
    if (!solo) npcs.forEach((n, i) => add({ type:'npc', i }, n.x + 5, n.y + 13, n.name + '에게 말 걸기', 16));
    drops.forEach((d, i) => add({ type:'drop', i }, d.x + 3, d.y + 4,
      Season.ITEMS[d.kind].emo + ' ' + Season.ITEMS[d.kind].name + ' 줍기', 12));
    if (SEASON.festival && Season.FEST[SEASON.festival.key])
      add({ type:'festival' }, FEST_AT.x, FEST_AT.y, SEASON.festival.emo + ' ' + SEASON.festival.name, 34);
    if (picnic) add({ type:'picnic' }, picnic.x, picnic.y, '돗자리 접기', 22);
    return out;
  }
  if (inJazz() && jazz) {
    addX({ type:'out' }, JZ.door.x + 17, 22, '재즈바에서 나가기', 8, 66);
    addX({ type:'stage' }, JZ.stage.x + JZ.stage.w / 2, JZ.stage.w / 2, '무대 · 연주 듣기', 10, 66);
    add({ type:'counter' }, JZ.bar.x + 70, JZ.bar.y + 10, '바에서 한 잔', 40);
    jazz.patrons.forEach((p, i) =>
      add({ type:'patron', i }, p.x + 5, p.y + 12, p.name + '에게 말 걸기', 17));
    (jazz.live || []).forEach((p, i) =>
      add({ type:'livep', i }, p.x + 5, p.y + 12, p.who + ' 님 (실시간 접속)', 17));
    return out;
  }
  if (inJazz()) return out;                    // 나가는 중(place는 아직 jazz, jazz 객체는 이미 비움) — 아무 것도 없다
  if (inShop() && place.key === 'cafe' && place.level === 2) {
    addX({ type:'roofdown' }, SHOP_STAIRS.x + SHOP_STAIRS.w / 2, 30, '안으로 내려가기', 10, 56);
    ROOF_TABLES.forEach((tb, i) => add({ type:'rooftable', i }, tb.x + 8, tb.y - 4, '루프탑에서 차 마시기', 22));
    return out;
  }
  if (inShop()) {
    const S = SHOPS[place.key];
    addX({ type:'out' }, SHOP_DOOR.x + 17, 22, S.title + '에서 나가기', 8, 66);
    add({ type:'shopdesk' }, SHOP_DESK.x + 35, SHOP_DESK.y - 10, S.deskLabel, 26);
    if (place.key === 'cafe')
      addX({ type:'roofup' }, SHOP_STAIRS.x + SHOP_STAIRS.w / 2, 30, '루프탑으로 올라가기', 10, 56);
    return out;
  }
  if (inRide() && ride) {
    const R = RIDES[ride.mode];
    addX({ type:'rideout' }, RIDE_W - 23, 22,
         ride.t >= ride.dur ? '내리기' : '아직 달리는 중이에요', 10, 62);
    R.win && (() => {
      for (let i = 0; i < R.win.n; i++) {
        const x = 16 + i * (R.win.w + R.win.gap);
        if (x + R.win.w > RIDE_W - 8) break;
        addX({ type:'ridewin' }, x + R.win.w / 2, R.win.w / 2 + 4, '창밖 보기', R.win.y, R.win.h + 6);
      }
    })();
    R.seats.forEach(([sx, sy], i) =>
      add({ type:'rideseat', i }, sx + 7, sy - 4,
          ride.seated === i ? '일어나기' : '앉아서 책 읽기', 20));
    // 버스는 기사님이 앞자리에 고정, 기차·비행기는 통로를 오가는 승무원
    const crewAt = ride.mode === 'bus' ? { x:26, y:108 } : { x:306, y:106 };
    add({ type:'ridecrew' }, crewAt.x, crewAt.y, R.crew + '에게 말 걸기', 26);
    return out;
  }
  if (inRide()) return out;                    // 도착 직후(place는 아직 ride, ride 객체는 이미 비움) — 아무 것도 없다
  if (inUsed()) {
    addX({ type:'out' }, USED_DOOR.x + 17, 22, '헌책방에서 나가기', 8, 66);
    addX({ type:'trace' }, USED_TRACE.x + 59, 62, '흔적 있는 책 서가', 6, 64);
    addX({ type:'flat' },  USED_FLAT.x + 54,  58, '균일가 서가', 10, 60);
    add({ type:'owner' }, USED_DESK.x + 34, USED_DESK.y + 4, '책방 주인과 이야기하기', 30);
    STALLS.forEach((s, i) => add({ type:'stall', i }, s.x + s.w / 2, s.y + 6, s.name, 30));
    add({ type:'swap' }, USED_SWAP.x + 26, USED_SWAP.y + 6, '교환대 · 책 바꾸기', 28);
    add({ type:'cat' }, CAT.x + 5, CAT.y + 10, '고양이', 16);
    return out;
  }
  if (inLib() && place.floor === 2) {
    addX({ type:'stairdown' }, LIB_STAIRS.x + LIB_STAIRS.w / 2, 30, '1층으로 내려가기', 10, 60);
    LIB2_NOOK.forEach((s, i) => add({ type:'nook', i }, s.x + 7, s.y - 4,
      nookSeated === i ? '일어나기' : '앉아서 책 읽기', 20));
    add({ type:'rare' }, LIB2_RARE.x + LIB2_RARE.w / 2, LIB2_RARE.y + 30, '고서 서가 살펴보기', 30);
    return out;
  }
  if (inLib()) {
    addX({ type:'exit' }, LIB_DOOR.x + 17, 22, '도서관에서 나가기', 8, 66);
    addX({ type:'stairup' }, LIB_STAIRS.x + LIB_STAIRS.w / 2, 30, '2층으로 올라가기', 10, 60);
    addX({ type:'rank' }, LIB_RANK.x + 28, 34, '명예의 전당', 10, 50);
    addX({ type:'board' }, LIB_BOARD.x + 32, 38, '마을 글판 읽기', 8, 52);
    for (let i = 0; i < 10; i++)
      addX({ type:'stack', i }, stackX(i) + STACK_W / 2, STACK_W / 2 + 4,
           KDC[i][0] + ' ' + KDC[i][1] + ' 서가', 4, 66);
    add({ type:'desk' }, LIB_DESK.x + 26, LIB_DESK.y + 6, '책 검색하기', 30);
    add({ type:'news' }, LIB_NEWS.x + 32, LIB_NEWS.y + 8, '신문 읽기', 34);
    add({ type:'quiz' }, LIB_QUIZ.x + 28, LIB_QUIZ.y + 8, '책 퀴즈 참가하기', 32);
    place.people.forEach((p, i) =>
      add({ type:'npc2', i }, p.x + 5, 120, p.name + '에게 말 걸기', 16));
    return out;
  }
  // 실내 — 벽에 걸린 것은 가로 위치만 본다 (아바타는 바닥에 서 있으니까)
  const R = room();
  const wall = (o, it, label, pad) => {
    const p = pad === undefined ? 8 : pad;
    out.push(Object.assign(o, {
      px: it.x + it.w / 2, py: it.y + it.h, label, m:'x', half: it.w / 2 + p,
      hx: it.x - 3, hy: it.y - 4, hw: it.w + 6, hh: it.h + 8,
    }));
  };
  wall({ type:'out' }, DOOR, '밖으로 나가기', 6);
  wall({ type:'visit' }, VDOOR, '손님 문 · 다른 사람 방으로', 8);
  R.items.forEach(it => {
    if (it.kind === 'poster') wall({ type:'poster', it }, it, '포스터 크게 보기');
    if (it.kind === 'frame')  wall({ type:'poster', it }, it, '액자 크게 보기');
    if (it.kind === 'card')   wall({ type:'card' }, it, '대출카드 보기');
    if (it.kind === 'journal') wall({ type:'journal' }, it, '내가 남긴 문장 보기');
    if (it.kind === 'window') wall({ type:'window' }, it, '창밖 보기');
    if (it.kind === 'plant')  wall({ type:'plant', it }, it, '화분 살펴보기', 10);
    if (it.kind === 'perch' && R.letters.length)
      wall({ type:'perch' }, { x:it.x, y:it.y - 10, w:it.w, h:12 }, '도착한 문장 읽기');
  });
  shelves(R).forEach(s => s.books.forEach(bk => {
    if (bk.bx === undefined) return;
    out.push({ type:'book', book:bk, px: bk.bx + bk.w / 2, py: bk.by + bk.h,
      label: (isHome() ? '꺼내 읽기 · ' : '빌려가기 · ') + bk.t, m:'x', half: bk.w / 2 + 3,
      hx: bk.bx - 1, hy: bk.by - 3, hw: bk.w + 2, hh: bk.h + 6 });
  }));
  return out;
}
function hitAt(wx, wy) {
  let best = null, bd = 1e9;
  for (const t of targets()) {
    if (t.hx !== undefined) {                       // 네모 범위로 잡는 것 (실내 물건)
      if (wx >= t.hx && wx <= t.hx + t.hw && wy >= t.hy && wy <= t.hy + t.hh) {
        const d = Math.abs(wx - t.px) + Math.abs(wy - t.py);
        if (d < bd) { bd = d; best = t; }
      }
      continue;
    }
    const d = Math.hypot(wx - t.px, wy - t.py);
    if (d < t.r * 1.4 && d < bd) { bd = d; best = t; }
  }
  return best;
}
function nearest() {
  const cx = player.x + 5, cy = player.y + 13;
  let best = null, bd = 1e9;
  for (const t of targets()) {
    let d;
    if (t.m === 'x') {                              // 벽에 걸린 것 — 가로 위치만 본다
      if (player.y > 106) continue;                 // 벽에서 너무 멀면 손이 안 닿는다
      const dx = Math.abs(cx - t.px);
      if (dx > t.half) continue;
      d = dx;
    } else {
      d = Math.hypot(cx - t.px, cy - t.py);
      if (d >= t.r + 6) continue;
    }
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

const ACTIONS = {
  out:     goOut,
  exit:    goOut,
  enter:   f => enterRoom(f.to),
  library: enterLibrary,
  used:    enterUsed,
  owner:   talkOwner,
  trace:   () => openStall('trace', '흔적 있는 책',
             '누군가 밑줄을 긋고 쪽지를 끼워둔 책들이에요. 데려가면 그 쪽지도 같이 옵니다.'),
  flat:    () => openStall('flat', '균일가 서가', '값이 다 같은 칸. 어차피 헌책이니까요.'),
  stall:   f => openStall(STALLS[f.i].key, STALLS[f.i].name, '쌓아둔 대로 파는 자리예요.'),
  swap:    openSwap,
  drop:    f => pickUp(f.i),
  picnic:  () => { picnic = null; Audio8.play('page'); toast('돗자리를 접었어요'); },
  window:  () => { const w = WEATHER;
             say('창밖', [SEASON.label + ' · ' + w.emo + ' ' + w.name + (w.night ? ' · 밤이에요' : ''),
               w.key === 'storm' ? '멀리서 번개가 칩니다. 조금 있으면 소리가 오겠네요.'
               : w.rain ? '창을 타고 빗물이 흘러내려요.'
               : w.snow ? '눈이 소리 없이 쌓이고 있어요.'
               : w.sun > .2 ? '햇살이 방바닥까지 길게 들어옵니다.' : '구름이 낮게 깔렸어요.'],
               [{ label:'한참 바라본다' }]); },
  plant:   f => { const p = f.it;
             p.grow = (p.grow || 0) + 1;
             Audio8.play('water');
             const stage = p.grow < 3 ? '새 잎이 하나 올라왔어요'
                         : p.grow < 6 ? '제법 잎이 무성해졌어요' : '꽃대가 올라오고 있어요';
             say('화분', ['물을 주었습니다.', stage + ' (' + p.grow + '일째)'],
               [{ label:'잘 자라라' },
                { label:'치우기', fn: () => {
                    const R = ROOMS[0], i = R.items.indexOf(p);
                    if (i >= 0) R.items.splice(i, 1);
                    Audio8.play('page'); toast('화분을 치웠어요');
                  } }]); },
  furn:    () => enterShop('furn'),
  museum:  () => enterShop('museum'),
  shopdesk:() => SHOPS[place.key].action(),
  roofup:   () => shopClimb('up'),
  roofdown: () => shopClimb('down'),
  rooftable:() => SHOPS.cafe.action(),
  news:    openNews,
  visit:   openVisit,
  jazz:    enterJazz,
  patron:  f => talkPatron(f.i),
  livep:   f => talkLive(f.i),
  stage:   () => say('무대', ['넷이 소리를 맞추고 있어요.',
             '피아노가 먼저 물러서고, 색소폰이 한참 혼자 갑니다.',
             '아무도 박수를 치지 않지만 다들 듣고 있어요.'],
             [{ label:'👏 조용히 박수', fn: () => { Audio8.play('right'); toast('연주자가 고개를 끄덕였어요'); } },
              { label:'계속 듣는다' }]),
  counter: () => say('바텐더', ['오늘은 뭘로 하시겠어요?', '읽던 책 있으면 여기 두셔도 돼요.'],
             [{ label:'🥃 한 잔', fn: () => { Audio8.play('coin'); startEating('tea');
                  toast('잔을 받았어요 · 얼음이 천천히 녹습니다'); } },
              { label:'☕ 따뜻한 걸로', fn: () => { Audio8.play('coin'); startEating('tea');
                  toast('따뜻한 잔을 받았어요'); } },
              { label:'괜찮아요' }]),
  rideout: () => ride && ride.t >= ride.dur ? arriveRide()
             : toast('아직 달리는 중이에요 · ' + rideLeft() + '초 남았습니다'),
  ridewin: () => {
    const v = VIL[ride.to], m = ride.mode;
    say('창밖', [
      m === 'plane' ? '구름 위예요. 아래가 하얗게 깔려 있습니다.'
      : WEATHER.rain > 0 ? '빗줄기가 창을 대각선으로 긋고 지나갑니다.'
      : SEASON.key === 'autumn' ? '누렇게 마른 들판이 계속 지나갑니다.'
      : SEASON.key === 'winter' ? '눈 덮인 논이 지나가요. 전봇대만 셀 수 있습니다.'
      : SEASON.key === 'spring' ? '연둣빛 논이 지나갑니다.' : '초록이 아주 짙어요.',
      v.name + ' 까지 ' + rideLeft() + '초 남았습니다.',
    ], [{ label:'계속 본다' }]);
  },
  rideseat: f => {
    if (ride.seated === f.i) { ride.seated = false; ride.read = null; toast('일어났어요'); return; }
    const mine = allBooks(ROOMS[0]);
    if (!mine.length) { ride.seated = f.i; toast('앉았어요 · 읽을 책이 없네요'); return; }
    say('무슨 책을 펼칠까요', ['가방에서 책을 꺼냅니다.'],
      mine.slice(0, 6).map(b2 => ({ label:'📕 ' + b2.t, fn: () => {
        ride.seated = f.i; ride.read = b2; Audio8.play('page');
        toast('『' + b2.t + '』를 펼쳤어요 · 흔들리는 데서 읽으면 더 잘 읽히죠');
      } })).concat([{ label:'그냥 앉기', fn: () => { ride.seated = f.i; } }]));
  },
  ridecrew: () => {
    const R = RIDES[ride.mode];
    say(R.crew, ride.served ? ['맛있게 드셨어요?'] : R.lines,
      ride.served ? [{ label:'네, 고마워요' }]
      : [{ label:'☕ 따뜻한 차 한 잔', fn: () => { ride.served = true; Audio8.play('coin');
            startEating('tea'); toast('차를 받았어요 · 창밖 보기 좋은 온도네요'); } },
         { label:'🍪 과자', fn: () => { ride.served = true; Audio8.play('coin');
            startEating('snack'); toast('과자를 받았어요'); } },
         { label:'괜찮습니다' }]);
  },
  pond:    () => {
    if (SEASON.key === 'summer') {
      say('호수', ['물이 시원해요.', '한참 떠 있다 나왔습니다. 책은 젖지 않게 두고요.'],
        [{ label:'🏊 더 놀다 가기', fn: () => toast('물놀이를 실컷 했어요') }, { label:'나가기' }]);
    } else if (SEASON.key === 'winter') {
      say('언 호수', ['호수가 꽝꽝 얼었어요.', '마을 사람 몇이 벌써 지치고 있습니다.'],
        [{ label:'⛸ 스케이트 타기', fn: startSkate }, { label:'구경만 하기' }]);
    } else if (SEASON.key === 'spring') {
      say('호숫가', ['물가에 개구리 소리가 나요.', '벚꽃 아래가 비어 있습니다. 돗자리 펴기 좋은 날이에요.'],
        [{ label:'🧺 피크닉 펴기', fn: startPicnic },
         { label:'💧 물수제비 던지기', fn: startSkip },
         { label:'그냥 앉아 있기' }]);
    } else {
      say('호숫가', ['물에 낙엽이 떠 있어요.', '여기 앉아 읽으면 잘 읽힙니다.'],
        [{ label:'💧 물수제비 던지기', fn: startSkip },
         { label:'🧺 돗자리 펴기', fn: startPicnic },
         { label:'그냥 앉아 있기' }]);
    }
    dialog.at = { x: POND.x + POND.w / 2, y: POND.y }; placeBubble();
  },
  cafe:    () => enterShop('cafe'),
  flower:  () => enterShop('flower'),
  festival:() => {
    const F = SEASON.festival;
    const cs = [{ label:'좋네요' }];
    if (F.key === 'chuseok') cs.unshift({ label:'🥟 송편 빚기', fn: () => {
      const bk = pickOne(CATALOG.filter(x => !owned().has(x.t)));
      if (bk) { addToMyShelf(Object.assign({}, bk, { from:'추석 마을잔치', done:false }));
                Audio8.play('coin'); toast('이웃이 『' + bk.t + '』를 선물로 주셨어요'); }
      else toast('송편을 나눠 먹었어요');
    } });
    if (F.key === 'christmas') cs.unshift({ label:'🎁 트리에 책 걸기', fn: () =>
      toast('내년에 읽을 책 한 권을 걸어두었어요') });
    if (F.key === 'seollal') cs.unshift({ label:'🎲 윷 던지기', fn: () => {
      const r = pickOne(['도','개','걸','윷','모']);
      Audio8.play(r === '윷' || r === '모' ? 'right' : 'select');
      toast(r + '! ' + (r === '모' ? ' 한 번 더 던지세요' : ''));
    } });
    if (F.key === 'newyear') cs.unshift({ label:'🎆 올해의 책 정하기', fn: () =>
      toast('올해 읽을 책을 마음에 새겼어요') });
    say(F.emo + ' ' + F.name, [F.blurb], cs);
    dialog.at = { x: FEST_AT.x, y: FEST_AT.y - 40 }; placeBubble();
  },
  cat:     () => { Audio8.play('talk');
             say('책방 고양이', [pickOne(['야옹.', '…', '(책 위에서 자리를 옮긴다)',
               '(당신을 한참 본다)'])], [{ label:'쓰다듬기', fn:() => toast('고양이가 눈을 감았어요') },
               { label:'그냥 지나가기' }]);
             dialog.at = { x: CAT.x + 5, y: CAT.y }; placeBubble(); },
  post:    () => enterShop('post'),
  bus:     () => openMap(true),                 // 버스 — 가까운 마을만
  train:   () => openMap(false),                // 기차 — 전국 어디든
  air:     openWorld,                            // 공항 — 해외만
  landmark:openLandmark,
  mail:    f => openMail(f.to, f.name),
  card:    openCard,
  journal: openJournal,
  perch:   openLetter,
  desk:    openSearch,
  rank:    openRank,
  board:   openBoard,
  quiz:    openQuiz,
  stairup:   () => libClimb('up'),
  stairdown: () => libClimb('down'),
  nook:    f => sitNook(f.i),
  rare:    () => say('고서 서가', ['유리 너머로만 보이는 칸이에요.',
             '오래된 판본들이라, 손대지 말고 눈으로만 봐 달래요.',
             '표지 색이 다 바래서 제목이 잘 안 보이는 것도 있어요.'],
             [{ label:'가만히 들여다본다' }]),
  npc:     f => talkNpc(npcs[f.i]),
  npc2:    f => talkNpc(place.people[f.i]),
  stack:   f => openStack(f.i),
  book:    f => openBook(f.book),
  poster:  f => openPoster(f.it),
};
function act(f) { if (f && ACTIONS[f.type]) { Audio8.play('select'); ACTIONS[f.type](f); } }

// 클릭 = 그 자리로 걸어가서, 대상이면 알아서 상호작용
view.addEventListener('click', e => {
  Audio8.wake();
  if (edit || openOv) return;
  if (dialog) { advanceDialog(); return; }
  const r = view.getBoundingClientRect(), ds = dispScale();
  const wx = (e.clientX - r.left) / (SCALE * ds) + camX, wy = (e.clientY - r.top) / (SCALE * ds) + camY;
  const t = hitAt(wx, wy);
  if (t) {
    if (t.m === 'x') {                                 // 벽 물건 — 그 앞으로 걸어간다
      const dx = Math.abs(player.x + 5 - t.px);
      if (dx <= t.half && player.y <= 106) { act(t); walkTo = null; }
      else walkTo = { x: t.px, y: 96, then: t, stuck: 0 };
    } else {
      const d = Math.hypot(player.x + 5 - t.px, player.y + 13 - t.py);
      if (d <= t.r + 6) { act(t); walkTo = null; }
      else walkTo = { x: t.px, y: t.py + (inTown() ? 12 : 0), then: t, stuck: 0 };
    }
  } else {
    walkTo = { x: wx, y: wy, then: null, stuck: 0 };   // 빈 곳을 눌러도 그리로 걸어간다
  }
});

// ── 오버레이 ──────────────────────────────────────────────────
function closeOv() { if (!openOv) return; $('m-' + openOv).classList.remove('show'); openOv = null; Audio8.play('close'); }
function showOv(id) {
  if (openOv) $('m-' + openOv).classList.remove('show');
  endDialog(); $('m-' + id).classList.add('show'); openOv = id; Audio8.play('open');
}
document.querySelectorAll('.ov').forEach(o =>
  o.addEventListener('click', e => { if (e.target === o) closeOv(); }));

// ── 이동 ──────────────────────────────────────────────────────
const fade = $('fade');
function transition(fn, ms) {
  closeOv(); endDialog(); setEdit(false); walkTo = null; fade.classList.add('on');
  setTimeout(() => { fn(); fade.classList.remove('on'); }, ms || 200);
}
function enterRoom(idx) {
  Audio8.play('door');
  transition(() => {
    place = { kind:'room', idx, vi: vidx(ROOMS[idx].village) };
    live = [];                                  // 개인 방은 비동기 — 아무도 없다
    player.x = DOOR.x + 4; player.y = 108; player.dir = 'down';
    camX = camY = 0; refreshUI();
  });
}
function enterLibrary() {
  Audio8.play('door');
  transition(() => {
    const vi = place.vi;
    // 이름 있는 '회원'인 척하는 대신, 방으로 이어지지 않는 익명의 안내형 인물로 둔다 —
    // 진짜 사용자처럼 보이지 않게.
    place = { kind:'library', vi, floor:1, people: [
      { name:'책 읽는 사람', npc:true, x:470, hair:'#3d2b28', shirt:'#d4818f',
        lines:['문학 서가에 계속 서 있게 되네요.','800번대 밖으로 나가야 하는데 발이 안 떨어져요.'] },
      { name:'서가를 살피는 사람', npc:true, x:650, hair:'#2b2b33', shirt:'#5a86a8',
        lines:['400번대는 봐도 봐도 끝이 없어요.','이번 주는 『부분과 전체』를 붙잡고 있습니다.'] },
    ] };
    player.x = LIB_DOOR.x + 8; player.y = 108; player.dir = 'down';
    camX = camY = 0; spawnLive(); refreshUI();
  });
}
// 도서관 층 오르내리기 — 계단 자리는 두 층이 똑같다
function libClimb(dir) {
  Audio8.play('page');
  transition(() => {
    place.floor = dir === 'up' ? 2 : 1;
    player.x = LIB_STAIRS.x + 6; player.y = 108; player.dir = 'down';
    camX = camY = 0; refreshUI();
  });
}
// 2층 열람실 안락의자 — 조용히 앉아 책을 편다
function sitNook(i) {
  if (nookSeated === i) { nookSeated = false; nookRead = null; toast('일어났어요'); return; }
  const mine = allBooks(ROOMS[0]);
  if (!mine.length) { nookSeated = i; toast('앉았어요 · 읽을 책이 없네요'); return; }
  say('무슨 책을 펼칠까요', ['조용한 데라 책장 넘기는 소리만 들려요.'],
    mine.slice(0, 6).map(b2 => ({ label:'📕 ' + b2.t, fn: () => {
      nookSeated = i; nookRead = b2; Audio8.play('page');
      toast('『' + b2.t + '』를 펼쳤어요 · 여기가 제일 조용해요');
    } })).concat([{ label:'그냥 앉기', fn: () => { nookSeated = i; } }]));
}
function goOut() {
  if (inTown()) { openMenu(); return; }
  if (inRide()) { toast('아직 달리는 중이에요'); return; }
  Audio8.play('door');
  const vi = place.vi, from = place.kind === 'room' ? place.idx : null;
  const wasUsed = inUsed(), wasJazz = inJazz(), shopKey = inShop() ? place.key : null;
  if (wasJazz) stopJazzLive();
  transition(() => {
    // place 와 jazz 를 같은 순간에 같이 바꾼다 — 둘이 따로 놀면(전환 애니메이션
    // 도는 동안 place.kind 는 아직 'jazz' 인데 jazz 만 먼저 비면) 그 사이에
    // 화면을 다시 그리다가 jazz.patrons 를 읽어 죽는 순간이 생긴다.
    if (wasJazz) jazz = null;
    place = { kind:'town', vi };
    spawnTown(); scatterDrops(); spawnLive();
    const h = from !== null ? town().houses.find(x => x.to === from) : null;
    const d = h ? doorOf(h) : doorOf(shopKey ? BLD[shopKey] : wasJazz ? BLD.jazz : wasUsed ? BLD.used : BLD.lib);
    player.x = d.x + d.w / 2 - 5; player.y = d.y + 16;
    player.dir = 'down'; refreshUI();
  });
}

// ── 마을 사람과 이벤트 ────────────────────────────────────────
// ════ 기차와 비행기 ═══════════════════════════════════════════
//  시각표대로 온다. 매시 정각·30분에 기차, 15분·45분에 비행기.
//  종이 울리고 기적이 나고 덜컹거리며 지나간다.
const TRAIN_MIN = [0, 30];
const PLANE_MIN = [15, 45];
const RAIL_Y  = () => BLD.train.y + BLD.train.h + 14;
const RUNWAY_Y = () => BLD.air.y + BLD.air.h + 16;

function nextAt(mins) {                       // 다음 차례까지 남은 초와 시각
  const now = new Date();
  let best = null;
  for (let h = 0; h <= 1; h++) for (const m of mins) {
    const d = new Date(now); d.setHours(now.getHours() + h, m, 0, 0);
    if (d > now && (!best || d < best)) best = d;
  }
  return { at: best, left: Math.round((best - now) / 1000) };
}
const hhmm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
const mmss = s => Math.floor(s / 60) + '분 ' + String(s % 60).padStart(2, '0') + '초';

let train = null, plane = null, flapT = 0, lastBoard = '';
function callTrain(demo) {
  if (train) return;
  const dir = Math.random() < .5 ? 1 : -1;
  train = { t: 0, dir, phase:'in', demo,
            x: dir > 0 ? -120 : TOWN.w + 120,
            stopX: BLD.train.x + BLD.train.w / 2 - 46, clackAt: 0 };
  Audio8.play('bell');
  setTimeout(() => Audio8.play('whistle'), 900);
}
function callPlane() {
  if (plane) return;
  plane = { t: 0, x: BLD.air.x - 30, y: RUNWAY_Y(), lift: 0 };
  Audio8.play('jet');
}
function updateTrain(dt) {
  if (train) {
    const T = train; T.t += dt;
    if (T.phase === 'in') {
      const sp = Math.max(.35, 2.4 - Math.abs(T.x - T.stopX) < 90 ? .9 : 2.4);
      T.x += T.dir * sp * (dt / 16);
      T.clackAt += dt;
      if (T.clackAt > 260) { T.clackAt = 0; Audio8.play('clack'); }
      if ((T.dir > 0 && T.x >= T.stopX) || (T.dir < 0 && T.x <= T.stopX)) {
        T.x = T.stopX; T.phase = 'stop'; T.t = 0; Audio8.play('brake');
        toast('🚂 기차가 들어왔어요');
      }
    } else if (T.phase === 'stop') {
      if (T.t > 7000) { T.phase = 'out'; T.clackAt = 0; Audio8.play('whistle'); }
    } else {
      T.x += T.dir * 2.6 * (dt / 16);
      T.clackAt += dt;
      if (T.clackAt > 240) { T.clackAt = 0; Audio8.play('clack'); }
      if (T.x < -180 || T.x > TOWN.w + 180) train = null;
    }
  }
  if (plane) {
    const P = plane; P.t += dt;
    P.x += 1.5 * (dt / 16) * (1 + P.t / 1400);
    if (P.x > BLD.air.x + 120) P.lift = Math.min(1, P.lift + dt / 1600);
    P.y = RUNWAY_Y() - P.lift * 90;
    if (P.x > TOWN.w + 140) plane = null;
  }
  // 시각표대로 부른다
  const tr = nextAt(TRAIN_MIN), pl = nextAt(PLANE_MIN);
  if (!train && tr.left <= 1) callTrain(false);
  if (!plane && pl.left <= 1) callPlane();
}
function drawTrain() {
  if (train) {
    const T = train, y = RAIL_Y() - 13;
    const car = (x, w, body, roof) => {
      px(x, y + 2, w, 11, body);
      px(x, y, w, 3, roof);
      px(x, y + 2, w, 1, 'rgba(255,255,255,.28)');
      for (let i = 4; i < w - 5; i += 9) { px(x + i, y + 4, 6, 5, '#CFE4EE'); px(x + i, y + 4, 6, 1, '#EAF4FA'); }
      px(x + 3, y + 13, 3, 3, '#3A3632'); px(x + w - 7, y + 13, 3, 3, '#3A3632');
      const spin = Math.floor(T.x / 3) % 2;
      px(x + 4, y + 14 + spin, 1, 1, '#8A8A82'); px(x + w - 6, y + 15 - spin, 1, 1, '#8A8A82');
    };
    const f = T.dir > 0;
    const head = T.x + (f ? 74 : 0);
    car(T.x + (f ? 0 : 36), 34, '#5A6E8A', '#3E5068');     // 객차
    car(T.x + (f ? 38 : 0), 34, '#5A6E8A', '#3E5068');
    px(head, y + 1, 30, 12, '#7A4A44');                     // 기관차
    px(head, y - 1, 30, 3, '#5A342E');
    px(head + (f ? 22 : 2), y - 7, 6, 7, '#5A342E');        // 굴뚝
    px(head + (f ? 6 : 8), y + 4, 12, 6, '#E8C46A');        // 창
    px(head + (f ? 27 : 0), y + 4, 3, 5, '#FFE9A8');        // 전조등
    px(head + 2, y + 13, 4, 3, '#3A3632'); px(head + 22, y + 13, 4, 3, '#3A3632');
    if (T.phase !== 'stop') {                                // 연기
      for (let i = 0; i < 5; i++) {
        const k = (T.t / 90 + i * 3) % 15;
        px(head + (f ? 24 : 4) - T.dir * k * 1.6, y - 9 - k * 1.4, 3 + k / 4, 2 + k / 5,
           'rgba(230,226,220,' + (.5 - k / 34).toFixed(2) + ')');
      }
    }
  }
  if (plane) {
    const P = plane, s = 1 + P.lift * .3;
    if (P.lift > 0) px(P.x - 12, RUNWAY_Y() + 2, 26, 3, 'rgba(40,40,40,' + (.22 - P.lift * .16).toFixed(2) + ')');
    px(P.x - 16, P.y - 3, 32, 6, '#EFEFEA');                 // 동체
    px(P.x - 16, P.y - 3, 32, 2, '#FFFFFF');
    px(P.x + 12, P.y - 2, 5, 3, '#4E7A96');                  // 기수
    px(P.x - 14, P.y - 9, 7, 6, '#DCE6EC');                  // 꼬리날개
    px(P.x - 4, P.y - 1, 16, 3 * s, '#C8D6DE');              // 날개
    px(P.x - 2, P.y + 2, 10, 2, '#B4C4CE');
    for (let i = 0; i < 3; i++) px(P.x + 3 + i * 6, P.y - 2, 3, 2, '#8FC8E4');
  }
}
// 역 앞 시각표 — 찰칵찰칵 넘어가는 판
function drawBoard(t) {
  const B = BLD.train, bx = B.x + B.w + 6, by = B.y + 18;
  const tr = nextAt(TRAIN_MIN);
  const txt = hhmm(tr.at);
  if (txt !== lastBoard) { lastBoard = txt; flapT = 420; Audio8.play('flap'); }
  if (flapT > 0) flapT -= 16;
  px(bx - 2, by - 2, 46, 30, '#4A4238');
  px(bx, by, 42, 26, '#2E2A26');
  px(bx, by, 42, 6, '#3E3832');
  ctx.fillStyle = '#E8C46A';
  for (let i = 0; i < 4; i++) ctx.fillRect(bx + 4 + i * 5, by + 2, 3, 2);   // 「다음 열차」
  const digits = txt.replace(':', '');
  for (let i = 0; i < 4; i++) {                                   // 숫자 네 칸
    const dx = bx + 3 + i * 9 + (i > 1 ? 4 : 0);
    px(dx, by + 10, 8, 12, '#151311');
    const shake = flapT > 0 && (Math.floor(t / 60) + i) % 2 ? 1 : 0;
    ctx.fillStyle = flapT > 0 ? '#B8A87A' : '#F0D9A0';
    const d = +digits[i];
    // 아주 작은 7세그먼트
    const seg = [[1,1,1,0,1,1,1],[0,0,1,0,0,1,0],[1,0,1,1,1,0,1],[1,0,1,1,0,1,1],
                 [0,1,1,1,0,1,0],[1,1,0,1,0,1,1],[1,1,0,1,1,1,1],[1,0,1,0,0,1,0],
                 [1,1,1,1,1,1,1],[1,1,1,1,0,1,1]][d];
    if (seg[0]) ctx.fillRect(dx + 2, by + 11 + shake, 4, 1);
    if (seg[1]) ctx.fillRect(dx + 1, by + 12 + shake, 1, 4);
    if (seg[2]) ctx.fillRect(dx + 6, by + 12 + shake, 1, 4);
    if (seg[3]) ctx.fillRect(dx + 2, by + 16 + shake, 4, 1);
    if (seg[4]) ctx.fillRect(dx + 1, by + 17 + shake, 1, 4);
    if (seg[5]) ctx.fillRect(dx + 6, by + 17 + shake, 1, 4);
    if (seg[6]) ctx.fillRect(dx + 2, by + 21 + shake, 4, 1);
  }
  px(bx + 20, by + 14, 1, 1, '#F0D9A0'); px(bx + 20, by + 18, 1, 1, '#F0D9A0');   // 콜론
  px(bx + 18, by + 26, 6, 12, '#5A5248');                                          // 기둥
}
function talkStation() {
  const tr = nextAt(TRAIN_MIN), pl = nextAt(PLANE_MIN);
  say('역무원', [
    '어서 오세요. ' + vill().where + ' 역입니다.',
    '다음 기차는 ' + hhmm(tr.at) + ' — ' + mmss(tr.left) + ' 남았습니다.',
    '비행기는 ' + hhmm(pl.at) + ' 에 뜹니다. 기차는 매시 정각과 30분, 비행기는 15분과 45분이에요.',
  ], [
    { label:'🚆 기차 타고 다른 마을로', fn: () => openMap() },
    { label:'✈️ 다른 나라로', fn: openWorld },
    { label:'🔔 지금 한 대 불러주세요 (데모)', fn: () => {
        callTrain(true); toast('🚂 기차가 들어옵니다'); } },
    { label:'그냥 구경할게요' },
  ]);
  const d = doorOf(BLD.train);
  dialog.at = { x: d.x + d.w / 2, y: d.y - 10 }; placeBubble();
}

// ── 반려동물 ──────────────────────────────────────────────────
//  키우고 싶으면 보호소에서 한 마리 데려온다. 뒤를 따라다닌다.
const BREEDS = {
  dog: [
    { n:'진돗개',     c:'#E8DCC0', c2:'#C8B896' },
    { n:'시바',       c:'#D9A05A', c2:'#B87E3E' },
    { n:'포메라니안', c:'#F0CE96', c2:'#D9AE72' },
    { n:'검은 믹스',  c:'#4A423C', c2:'#6A605A' },
  ],
  cat: [
    { n:'코리안숏헤어', c:'#9A8A78', c2:'#6E6154' },
    { n:'러시안블루',   c:'#8A96A0', c2:'#6A7680' },
    { n:'삼색이',       c:'#E8DCC8', c2:'#C4784E' },
    { n:'턱시도',       c:'#3A3632', c2:'#F0EDE6' },
  ],
};
let pet = null;
function adoptDialog() {
  if (pet) {
    say('보호소', [pet.name + '이(가) 잘 지내고 있나요?', '다른 아이로 바꾸실 수도 있어요.'],
      [{ label:'🐾 다른 아이 만나기', fn: () => { pet = null; adoptDialog(); } },
       { label:'잘 지내요' }]);
    return;
  }
  say('보호소 지기', ['같이 살 친구를 찾고 계세요?', '강아지도 있고 고양이도 있어요.'], [
    { label:'🐶 강아지 보기', fn: () => pickBreed('dog') },
    { label:'🐱 고양이 보기', fn: () => pickBreed('cat') },
    { label:'다음에 올게요' },
  ]);
}
function pickBreed(kind) {
  say(kind === 'dog' ? '강아지들' : '고양이들', ['누가 마음에 드세요?'],
    BREEDS[kind].map(b2 => ({ label:(kind === 'dog' ? '🐶 ' : '🐱 ') + b2.n, fn: () => {
      pet = { kind, breed: b2.n, name: b2.n, c: b2.c, c2: b2.c2,
              x: player.x - 14, y: player.y + 6, dir:'right', anim:0, moving:false };
      Audio8.play('coin');
      toast((kind === 'dog' ? '🐶 ' : '🐱 ') + b2.n + '와(과) 함께 살기로 했어요');
    } })).concat([{ label:'조금 더 볼게요' }]));
}
function updatePet(dt) {
  if (!pet) return;
  const gx = player.x - 13 - pet.x, gy = player.y + 5 - pet.y, d = Math.hypot(gx, gy);
  if (d > 16) {
    const s = Math.min(1.1, d / 22);
    pet.x += gx / d * s; pet.y += gy / d * s;
    pet.dir = gx < 0 ? 'left' : 'right'; pet.moving = true; pet.anim++;
  } else { pet.moving = false; }
}
function drawPet(t) {
  if (!pet) return;
  const x = Math.round(pet.x), y = Math.round(pet.y), f = pet.dir === 'left';
  const step = pet.moving && ((pet.anim / 7 | 0) % 2) ? 1 : 0;
  const S = f ? -1 : 1, ox = f ? 10 : 0;
  const P = (dx, dy, w, h, c) => px(x + ox + S * dx - (f ? w : 0), y + dy, w, h, c);
  px(x + 1, y + 9, 10, 2, 'rgba(60,45,30,.22)');
  P(1, 3, 8, 5, pet.c);                                   // 몸
  P(1, 3, 8, 1, pet.c2);
  P(7, 0, 5, 5, pet.c);                                   // 머리
  if (pet.kind === 'cat') { P(7, -2, 2, 2, pet.c); P(10, -2, 2, 2, pet.c); }   // 귀
  else { P(6, 1, 2, 4, pet.c2); }                                             // 늘어진 귀
  P(10, 2, 1, 1, '#241C1A');                              // 눈
  P(11, 3, 1, 1, '#241C1A');                              // 코
  P(0, 2 - step, pet.kind === 'cat' ? 2 : 3, pet.kind === 'cat' ? 5 : 2, pet.c2);  // 꼬리
  P(2, 8 - step, 2, 2, pet.c2); P(6, 8 - (1 - step), 2, 2, pet.c2);            // 다리
}

const ROLES = [
  { name:'사서',   key:'사서',   x:BLD.lib.x + 30,  y:BLD.lib.y + BLD.lib.h + 18, hair:'#3a3230', shirt:'#7a90b8' },
  { name:'우체부', key:'우체부', x:BLD.post.x + 20, y:BLD.post.y + BLD.post.h + 16, hair:'#2e2a26', shirt:'#c4645c' },
  { name:'책방 주인', key:'헌책방', x:BLD.used.x + 60, y:BLD.used.y + BLD.used.h + 16, hair:'#4a3a2e', shirt:'#8a7a5e' },
  { name:'동네 아이', key:'아이', x:300, y:200, hair:'#3a2e28', shirt:'#e0b45a' },
  { name:'할머니', key:'할머니', x:120, y:322, hair:'#b0aca8', shirt:'#9aa8a0' },
  { name:'보호소 지기', key:'보호소', x:452, y:330, hair:'#4a3a30', shirt:'#8ab08a', adopt:true },
  { name:'역무원', key:'역무원', x:BLD.train.x + BLD.train.w + 20, y:BLD.train.y + BLD.train.h - 6,
    hair:'#2E2A26', shirt:'#3E5068', station:true, cap:true },
];
function spawnTown() {
  npcs = ROLES.map(r => Object.assign({}, r, {
    home: { x: r.x, y: r.y }, dir:'down', anim:0, moving:false,
    t: Math.random() * 6000, lines: NPC_LINES[r.key],
  }));
  activeEvent = null;
  if (Math.random() < .7) {
    const ev = pickOne(EVENTS);
    const ex = FEST_AT.x - 40 + Math.random() * 60, ey = FEST_AT.y - 40;
    activeEvent = Object.assign({}, ev, {
      x: ex, y: ey, home: { x: ex, y: ey },          // 자기 자리가 있어야 서성일 수 있다
      dir:'down', anim:0, moving:false,
      name: ev.who, lines: ev.lines, isEvent:true,
    });
    npcs.push(activeEvent);
    setTimeout(() => { if (activeEvent) { Audio8.play('event'); toast(ev.emoji + ' 마을에 ' + ev.who + '이(가) 왔어요'); } }, 600);
  }
}
// ── 같이 있는 사람들 ──────────────────────────────────────────
//  지금은 흉내다. 실제 서비스에서는 이 배열을 웹소켓이 채운다.
//  개인 방은 비동기라 여기 아무도 오지 않는다 — 마을과 도서관에만 있다.
const LIVE_NAMES = ['하늘','준호','시우','예린','태오','유나','민서','도윤'];
const LIVE_HAIR  = ['#3a2e28','#2b2b33','#4a3550','#5a4030','#7a4f3a','#3d2b28'];
const LIVE_SHIRT = ['#d4818f','#5a86a8','#8a7aa8','#7fa88a','#e0b45a','#c4849e'];
let live = [];
let solo = false;                                   // 혼자 보기 — 다른 사람을 화면에서 지운다
// 밖에서는 친구만 보인다. 모르는 사람은 재즈바에서만 만난다.
function spawnLive() {
  if (!inTown() && !inLib()) { live = []; return; }
  const names = [...friends].map(i => ROOMS[i] && ROOMS[i].who).filter(Boolean);
  live = names.map((name, i) => {
    const p = livePoint();
    return { name, x:p.x, y:p.y, tx:p.x, ty:p.y, dir:'down', anim:0, moving:false, wait: 400 + Math.random() * 2200,
             hair: LIVE_HAIR[i % LIVE_HAIR.length], shirt: LIVE_SHIRT[i % LIVE_SHIRT.length] };
  });
}
// 길 위 아무 지점 — 사람들은 길을 따라 다닌다
function livePoint() {
  if (inLib()) return { x: 60 + Math.random() * (LIB_W - 140), y: 104 + Math.random() * 22 };
  const p = PATHS[0].pts, i = Math.floor(Math.random() * (p.length - 1));
  const k = Math.random();
  return { x: p[i][0] + (p[i + 1][0] - p[i][0]) * k + (Math.random() * 10 - 5),
           y: p[i][1] + (p[i + 1][1] - p[i][1]) * k + (Math.random() * 10 - 5) };
}
function updateLive(dt) {
  live.forEach(p => {
    if (p.wait > 0) { p.wait -= dt; p.moving = false; p.anim = 0; return; }
    const gx = p.tx - p.x, gy = p.ty - p.y, d = Math.hypot(gx, gy);
    if (d < 3) { const n = livePoint(); p.tx = n.x; p.ty = n.y; p.wait = 500 + Math.random() * 2600; return; }
    const s = .55, ux = gx / d, uy = gy / d;
    const nx = p.x + ux * s, ny = p.y + uy * s;
    if (!blocked(nx + 5, p.y + 13)) p.x = nx; else p.tx = p.x;
    if (!blocked(p.x + 5, ny + 13)) p.y = ny; else p.ty = p.y;
    p.dir = Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');
    p.moving = true; p.anim++;
  });
}
function drawLive() {
  live.forEach(p => person(p.x, p.y, p.dir, p.moving, p.anim, { h:p.hair, c:p.shirt }));
}
function renderNames() {
  const box = $('names');
  if (solo || !live.length) { box.innerHTML = ''; $('livebadge').classList.remove('on'); return; }
  if (box.children.length !== live.length)
    box.innerHTML = live.map(p => '<span class="nm2 live"></span>').join('');
  const ds = dispScale();
  live.forEach((p, i) => {
    const el = box.children[i];
    el.textContent = p.name;
    el.style.left = ((p.x + 5 - camX) * SCALE * ds) + 'px';
    el.style.top  = ((p.y - camY) * SCALE * ds) + 'px';
  });
  $('live-n').textContent = live.length;
  $('livebadge').innerHTML = '● 친구 <b id="live-n">' + live.length + '</b>명이 나와 있어요';
  $('livebadge').classList.add('on');
}

function talkNpc(n) {
  if (n.adopt) { adoptDialog(); dialog.at = { x:n.x + 5, y:n.y }; placeBubble(); return; }
  if (n.station) { talkStation(); return; }
  const at = { x: n.x + 5, y: n.y };
  const choices = [];
  if (n.to !== undefined) choices.push({ label:'🏠 ' + n.name + '의 방 구경하기', fn: () => enterRoom(n.to) });
  if (n.isEvent) {
    if (n.kind === 'gift') choices.push({ label:'📚 책 한 권 받기', fn: eventGift });
    if (n.kind === 'quiz') choices.push({ label:'🎲 퀴즈 하러 가기', fn: enterLibrary });
    if (n.kind === 'board') choices.push({ label:'✍️ 글판 보러 가기', fn: enterLibrary });
    if (n.kind === 'letter') choices.push({ label:'🕊 쪽지 읽기', fn: eventLetter });
  }
  choices.push({ label:'대화 끝내기', fn: null });
  const lines = n.lines && n.lines.length ? shuffle(n.lines).slice(0, n.isEvent ? n.lines.length : 2) : ['…'];
  say(n.name, n.isEvent ? n.lines : lines, choices);
  dialog.at = at; placeBubble();
}
function eventGift() {
  const mine = owned();
  const cand = CATALOG.filter(x => !mine.has(x.t));
  if (!cand.length) { toast('이미 다 가지고 있어요'); return; }
  const bk = pickOne(cand);
  addToMyShelf(Object.assign({}, bk, { from:'벼룩시장', done:false }));
  Audio8.play('coin');
  toast('『' + bk.t + '』를 받았어요 · 내 책장에 꽂힘');
}
function eventLetter() {
  const bk = pickOne(CATALOG);
  ROOMS[0].letters.unshift({ from:'이름 없는 사람', book:bk.t, read:false, text:bk.note });
  Audio8.play('mail');
  toast('쪽지를 우편함에 넣어두었어요');
}
// ════ 헌책방 ═══════════════════════════════════════════════
//  이 서비스에서 헌책방은 "전 주인의 흔적이 남은 책"을 만나는 자리다.
//  밑줄과 쪽지가 딸려 오기 때문에, 새 책을 사는 것과 완전히 다른 경험이 된다.
const PREV_OWNERS = ['이름 모를 사람','1998년의 누군가','전 주인','어느 대학생','스무 살의 나',
                     '이사 간 이웃','졸업한 선배','책방에 두고 간 손님'];
const PREV_MEMOS = [
  '여기까지 읽고 한참을 멈춰 있었다.',
  '스물셋. 이 문장 때문에 회사를 그만뒀다.',
  '언니에게 준다. 힘들 때 펴 봐.',
  '세 번째 읽는 중. 매번 다른 데서 멈춘다.',
  '이 부분은 도저히 동의가 안 된다. 그래도 계속 읽는다.',
  '군대에서 읽음. 밖은 눈이 왔다.',
  '아이가 크면 이 책을 줘야지.',
  '다 읽으면 누구에게든 넘기세요. 그게 이 책의 규칙입니다.',
];
let usedStock = null;
function stockUsed() {
  const mine = owned();
  const free = CATALOG.filter(x => !mine.has(x.t));
  const byKdc = ks => shuffle(free.filter(x => ks.includes(x.kdc)));
  const trace = shuffle(free).slice(0, 5).map(bk => Object.assign({}, bk, {
    prevOwner: pickOne(PREV_OWNERS), prevMemo: pickOne(PREV_MEMOS),
  }));
  usedStock = {
    lit:   byKdc(['800','700']).slice(0, 6),
    know:  byKdc(['000','100','300','400','500','900']).slice(0, 7),
    art:   byKdc(['600','200']).slice(0, 5),
    trace,
    flat:  shuffle(free).slice(0, 6),
    swapped: (usedStock && usedStock.swapped) || [],   // 사람들이 내놓고 간 책
  };
}
function enterShop(key) {
  Audio8.play('door');
  transition(() => {
    const vi = place.vi;
    place = { kind:'shop', key, vi, level:1 };
    live = [];
    player.x = SHOP_DOOR.x + 8; player.y = 108; player.dir = 'down';
    camX = camY = 0; refreshUI();
  });
}
// 찻집 루프탑 — 지금은 찻집만 쓰지만, 이름은 가게 공통으로 둔다
function shopClimb(dir) {
  Audio8.play('page');
  transition(() => {
    place.level = dir === 'up' ? 2 : 1;
    player.x = SHOP_STAIRS.x + 4; player.y = 108; player.dir = 'down';
    camX = camY = 0; refreshUI();
  });
}
function enterUsed() {
  Audio8.play('door');
  transition(() => {
    const vi = place.vi;
    place = { kind:'used', vi };
    stockUsed(); live = [];
    player.x = USED_DOOR.x + 8; player.y = 108; player.dir = 'down';
    camX = camY = 0; refreshUI();
  });
}
function takeUsed(bk, where) {
  const copy2 = Object.assign({}, bk, { from: where, done:false });
  delete copy2.prevOwner; delete copy2.prevMemo;
  if (bk.prevMemo) copy2.memos = [{ who: bk.prevOwner, text: bk.prevMemo }];
  addToMyShelf(copy2);
  Audio8.play('coin');
  toast('『' + bk.t + '』를 데려왔어요' + (bk.prevMemo ? ' · 쪽지가 함께 왔습니다' : ''));
}
function openStall(key, title, cap) {
  const stock = usedStock[key].filter(x => !owned().has(x.t));
  $('st-title').textContent = title;
  $('st-cap').textContent = cap;
  const list = $('st-list'); list.innerHTML = '';
  if (!stock.length) { list.innerHTML = '<div class="none">여기 있는 건 다 가져가셨네요</div>'; showOv('stall'); return; }
  stock.forEach(bk => {
    const el = document.createElement('button');
    el.className = 'res' + (bk.prevMemo ? ' col2' : '');
    el.innerHTML = '<span style="display:flex;gap:11px;align-items:center;width:100%">' +
      '<span class="sp" style="background:' + bk.col + '"></span>' +
      '<span><span class="t">' + bk.t + (bk.prevMemo ? '<span class="tr">흔적 있음</span>' : '') +
      '</span><span class="a">' + bk.a + '</span></span>' +
      '<span class="k">' + bk.kdc + ' ' + kdcName(bk.kdc) + '</span></span>' +
      (bk.prevMemo ? '<span class="pv">“' + bk.prevMemo + '” — ' + bk.prevOwner + '</span>' : '');
    el.onclick = () => { takeUsed(bk, '헌책방'); openStall(key, title, cap); };
    list.appendChild(el);
  });
  showOv('stall');
}
// 책 바꾸기 — 내 책을 내놓고 여기 책을 데려간다
let swapMine = null, swapTheirs = null;
function openSwap() {
  const mine = allBooks(ROOMS[0]);
  if (!mine.length) { toast('내놓을 책이 없어요'); return; }
  swapMine = swapTheirs = null;
  const pool = [].concat(usedStock.trace, usedStock.flat, usedStock.swapped)
    .filter(x => !owned().has(x.t));
  const a = $('sw-mine'), b2 = $('sw-theirs');
  a.innerHTML = ''; b2.innerHTML = '';
  mine.forEach(bk => {
    const el = document.createElement('button');
    el.className = 'sw';
    el.innerHTML = '<i style="background:' + bk.col + '"></i><span>' + bk.t +
      '<small>' + bk.a + ((bk.memos && bk.memos.length) ? ' · 쪽지 ' + bk.memos.length + '장' : '') + '</small></span>';
    el.onclick = () => { swapMine = bk; a.querySelectorAll('.sw').forEach(x => x.classList.remove('on')); el.classList.add('on'); };
    a.appendChild(el);
  });
  if (!pool.length) b2.innerHTML = '<div class="none">데려갈 책이 없어요</div>';
  pool.forEach(bk => {
    const el = document.createElement('button');
    el.className = 'sw';
    el.innerHTML = '<i style="background:' + bk.col + '"></i><span>' + bk.t +
      '<small>' + bk.a + (bk.prevMemo ? ' · 흔적 있음' : '') + '</small></span>';
    el.onclick = () => { swapTheirs = bk; b2.querySelectorAll('.sw').forEach(x => x.classList.remove('on')); el.classList.add('on'); };
    b2.appendChild(el);
  });
  showOv('swap');
}
$('sw-go').onclick = () => {
  if (!swapMine || !swapTheirs) { toast('양쪽에서 한 권씩 골라주세요'); return; }
  const s = shelfOf(ROOMS[0], swapMine);
  if (s) s.books.splice(s.books.indexOf(swapMine), 1);
  borrowed.delete(swapMine.t);
  // 내놓은 책은 이 헌책방 재고가 된다 — 쪽지를 달고
  usedStock.swapped.unshift(Object.assign({}, swapMine, {
    prevOwner:'나', prevMemo: (swapMine.memos && swapMine.memos[0] && swapMine.memos[0].text) || '잘 읽었습니다.',
  }));
  takeUsed(swapTheirs, '헌책방 교환');
  layoutRoom(ROOMS[0]); renderStats(); closeOv();
  toast('『' + swapMine.t + '』를 두고 『' + swapTheirs.t + '』를 데려왔어요');
};
// ── 가구점 · 꽃집 ─────────────────────────────────────────────
//  산 것은 바로 내 방 items 에 들어간다. 방에서 E 를 눌러 자리를 잡는다.
const FURNITURE = [
  { kind:'shelf', name:'작은 책장',   d:'책 열 권쯤 들어가요', mk: () => shelf(120, 26, 46, 38, []) },
  { kind:'shelf', name:'큰 책장',     d:'세 칸짜리',           mk: () => shelf(118, 10, 64, 56, []) },
  { kind:'lamp',  name:'스탠드 조명', d:'밤에 켜두면 좋아요',  mk: () => item({ kind:'lamp', x:200, y:52, w:10, h:20 }) },
  { kind:'rug',   name:'러그',        d:'바닥이 따뜻해집니다', mk: () => item({ kind:'rug', x:120, y:100, w:60, h:28 }) },
  { kind:'frame', name:'액자',        d:'벽에 걸어두세요',     mk: () => item({ kind:'frame', x:180, y:16, w:26, h:28 }) },
  { kind:'window',name:'창문 하나 더',d:'햇살이 더 들어와요',  mk: () => item({ kind:'window', x:150, y:14, w:42, h:36 }) },
  { kind:'perch', name:'새 홰',       d:'편지 물고 온 새가 앉아요', mk: () => item({ kind:'perch', x:136, y:30, w:18, h:2 }) },
];
function buyInto(mkfn, name) {
  ROOMS[0].items.push(mkfn());
  layoutRoom(ROOMS[0]); renderStats(); Audio8.play('coin');
  toast(name + '을(를) 샀어요 · 내 방에서 E 를 눌러 자리를 잡으세요');
}
function openFurniture() {
  say('가구점 주인', ['방에 놓을 것들이에요.', '사면 바로 방으로 배달해 드립니다.'],
    FURNITURE.map(f => ({ label:'🪑 ' + f.name + ' — ' + f.d, fn: () => buyInto(f.mk, f.name) }))
      .concat([{ label:'구경만 할게요' }]));
  dialog.at = { x:SHOP_DESK.x + 35, y:SHOP_DESK.y - 20 }; placeBubble();
}
const PLANTS = [
  { name:'몬스테라', d:'잎이 크게 벌어져요' },
  { name:'율마',     d:'향이 좋아요' },
  { name:'다육이',   d:'물을 자주 안 줘도 돼요' },
  { name:'스투키',   d:'키가 쭉 자랍니다' },
];
function openFlower() {
  say('꽃집 주인', ['화분 하나 들이실래요?', '물을 줄수록 자라요. 방에서 눌러보시면 됩니다.'],
    PLANTS.map(p => ({ label:'🪴 ' + p.name + ' — ' + p.d, fn: () => {
      ROOMS[0].items.push(item({ kind:'plant', x:150, y:108, w:10, h:16, grow:0, species:p.name }));
      Audio8.play('coin'); toast(p.name + ' 화분을 샀어요');
    } })).concat([{ label:'다음에 올게요' }]));
  dialog.at = { x:SHOP_DESK.x + 35, y:SHOP_DESK.y - 20 }; placeBubble();
}

// ── 차 · 과자 받았을 때 ──────────────────────────────────────
//  대사만 뜨고 끝나던 걸, 잠깐이라도 실제로 들고 있는 모습을 보여준다.
let eating = null;
function startEating(kind) { eating = { kind, t: 0, dur: 2600 }; }
function updateEating(dt) {
  if (!eating) return;
  eating.t += dt;
  if (eating.t >= eating.dur) eating = null;
}
function drawEating(t) {
  if (!eating) return;
  const bob = Math.sin(t / 160) * 1.5;
  const ox = eating.kind === 'snack' ? -1 : 0;
  const x = player.x + (player.dir === 'left' ? -7 : 11) + ox, y = player.y - 1 + bob;
  if (eating.kind === 'snack') {
    px(x, y, 6, 5, '#D8B888'); px(x + 1, y + 1, 1, 1, '#8A6A44'); px(x + 3, y + 2, 1, 1, '#8A6A44');
  } else {
    px(x, y, 6, 6, '#EFE4D0'); px(x + 1, y + 1, 4, 3, '#8A5A3A'); px(x + 6, y + 2, 2, 2, 'rgba(239,228,208,.9)');
  }
}
// ── 피크닉 ────────────────────────────────────────────────────
//  돗자리를 펴고 앉아 책을 읽는다. 계절에 따라 위에 떨어지는 것이 다르다.
let picnic = null;
function startPicnic() {
  const mine = allBooks(ROOMS[0]);
  const spread = () => {
    picnic = { x: Math.round(player.x + 5), y: Math.round(player.y + 12), book: null, t: 0 };
    Audio8.play('page');
    toast('🧺 돗자리를 폈어요 · 다시 누르면 접습니다');
  };
  if (!mine.length) { spread(); return; }
  say('무엇을 들고 앉을까요', ['가방에서 책을 꺼냅니다.'],
    mine.slice(0, 5).map(b2 => ({ label:'📕 ' + b2.t, fn: () => { spread(); picnic.book = b2; } }))
      .concat([{ label:'책 없이 그냥 눕기', fn: spread }]));
}
function drawPicnic(t) {
  if (!picnic) return;
  const P = picnic, x = P.x - 22, y = P.y - 10;
  px(x, y, 44, 22, '#D4646E');                                  // 돗자리
  ctx.fillStyle = '#EFE4D8';
  for (let i = 0; i < 5; i++) ctx.fillRect(x + 2 + i * 9, y, 4, 22);
  for (let i = 0; i < 3; i++) ctx.fillRect(x, y + 3 + i * 7, 44, 3);
  px(x + 3, y - 5, 11, 7, '#B08A5E');                           // 바구니
  px(x + 3, y - 6, 11, 2, '#C8A374');
  px(x + 5, y - 8, 3, 3, '#EFE4D8'); px(x + 9, y - 8, 3, 2, '#D4645C');
  if (P.book) { px(x + 28, y + 6, 9, 6, P.book.col);            // 펼친 책
                px(x + 32, y + 6, 1, 6, 'rgba(255,255,255,.5)'); }
  else px(x + 28, y + 8, 9, 4, '#EFE4D8');
  // 위로 떨어지는 것
  const col = SEASON.key === 'spring' ? '#F2C0CE' : SEASON.key === 'autumn' ? '#D9642E'
            : SEASON.key === 'winter' ? '#FFFFFF' : '#EAE45A';
  for (let i = 0; i < 5; i++) {
    const fx = x + ((t / 50 + i * 19) % 44);
    const fy = y - 34 + ((t / 32 + i * 27) % 40);
    px(fx, fy, 3, 2, col);
  }
}

// ── 물수제비 ──────────────────────────────────────────────────
//  누르고 있으면 힘이 차고, 놓으면 던진다. 오래 누를수록 멀리.
const skip = { on:false, power:0, up:true, stone:null, best:0 };
let skate = null;                                     // 얼음 호수 위를 도는 동안 — 캐릭터가 실제로 원을 그리며 미끄러진다
function startSkate() {
  const cx = POND.x + POND.w / 2, cy = POND.y + POND.h / 2;
  const r0 = Math.hypot(player.x + 5 - cx, player.y + 13 - cy);
  skate = { cx, cy, r: Math.max(16, Math.min(28, r0 || 20)),
            a: Math.atan2(player.y + 13 - cy, player.x + 5 - cx), t: 0, dur: 3400 };
}
function startSkip() {
  skip.on = true; skip.power = 0; skip.up = true; skip.stone = null; skipHeld = false;
  $('skipbar').classList.add('on');
  $('skiptxt').textContent = '스페이스바나 마우스를 누르고 있다가 놓으세요';
}
function endSkip() { skip.on = false; skipHeld = false; $('skipbar').classList.remove('on'); }
function skipCharge(dt) {
  if (!skip.on || skip.stone) return;
  if (skipHeld) {
    skip.power += (skip.up ? 1 : -1) * dt / 620;
    if (skip.power >= 1) { skip.power = 1; skip.up = false; }
    if (skip.power <= 0) { skip.power = 0; skip.up = true; }
  }
}
function throwStone() {
  if (!skip.on || skip.stone) return;
  const p = skip.power;
  const hops = Math.max(1, Math.round(2 + p * 7));      // 최대 아홉 번
  // 내 캐릭터가 선 자리에서 물 쪽으로 던진다
  const fromX = player.x + 5, fromY = player.y + 8;
  const toX = fromX < POND.x + POND.w / 2 ? POND.x + POND.w + 8 : POND.x - 8;
  const dir = Math.sign(toX - fromX) || 1;
  skip.stone = { from:{ x:fromX, y:fromY }, y: POND.y + POND.h / 2, dir,
                 t: 0, hop: 0, hops, span: Math.abs(toX - fromX) / (hops + 1),
                 startX: fromX, ripples: [] };
  player.dir = dir < 0 ? 'left' : 'right';
  Audio8.play('water');
  skip.power = 0;
  $('skiptxt').textContent = '던졌어요…';
}
function updateSkip(dt) {
  const s = skip.stone; if (!s) return;
  s.t += dt;
  const per = 190;                                      // 한 번 튀는 데 걸리는 시간
  const k = (s.t % per) / per;
  const hop = Math.floor(s.t / per);
  const at = h => s.startX + s.dir * s.span * h;
  if (hop > s.hop) {
    s.hop = hop;
    if (hop <= s.hops) { s.ripples.push({ x: at(hop), y: s.y, r: 0 }); Audio8.play('water'); }
  }
  s.cx = at(s.t / per);
  // 던진 자리에서 물까지 포물선으로 내려오고, 그다음부터 물 위에서 튄다
  const glide = Math.min(1, s.t / per);
  s.cy = (s.from.y + (s.y - s.from.y) * glide) - Math.sin(k * Math.PI) * (10 - s.hop * 0.8);
  s.ripples.forEach(r => r.r += dt / 34);
  if (s.hop > s.hops) {
    const n = s.hops;
    if (n > skip.best) skip.best = n;
    toast('💧 ' + n + '번 튀었어요' + (n >= 7 ? ' — 대단한데요!' : n >= 5 ? ' 잘 던졌어요' : '') +
          (skip.best > n ? ' (최고 ' + skip.best + '번)' : ''));
    Audio8.play(n >= 6 ? 'right' : 'select');
    skip.stone = null; endSkip();
  }
}
function drawSkip() {
  const s = skip.stone;
  if (skip.on && !s) {                                   // 힘 게이지 — 캐릭터 머리 위에
    const bw = 34, bx = player.x + 5 - bw / 2, by = player.y - 12;
    px(bx - 1, by - 1, bw + 2, 7, 'rgba(60,45,30,.4)');
    px(bx, by, bw, 5, '#EFE8DA');
    px(bx, by, bw * skip.power, 5,
       skip.power > .8 ? '#D4645C' : skip.power > .5 ? '#E8B45A' : '#7CBC72');
    px(bx + bw * .8, by, 1, 5, 'rgba(60,45,30,.45)');    // 잘 던지는 지점 표시
  }
  if (!s) return;
  s.ripples.forEach(r => {
    if (r.r > 14) return;
    ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0, .5 - r.r / 28).toFixed(3) + ')';
    for (let a = 0; a < 16; a++)
      ctx.fillRect(Math.round(r.x + Math.cos(a * .4) * r.r),
                   Math.round(r.y + Math.sin(a * .4) * r.r * .45), 1, 1);
  });
  px(s.cx, s.cy, 2, 2, '#6E6459');
}

// ════ 재즈바 「한밤」 ══════════════════════════════════════════
//  마을에서 모르는 사람을 만나는 유일한 곳. 정원 100명.
//  밖에서는 친구만 보이고, 여기서만 낯선 사람이 보이고 말이 통한다.
const JAZZ_W = 440;
const JZ = {
  stage: { x: 26, y: 16, w: 148, h: 54 },
  door:  { x: 200, y: 18, w: 34, h: 52 },
  bar:   { x: 268, y: 84, w: 150, h: 22 },
  tables: [[62, 100], [122, 112], [186, 98], [246, 116], [96, 128], [206, 132], [318, 126], [378, 122]],
};
let jazz = null;
let jazzTimer = null;
const JAZZ_CAP_FALLBACK = 10;                          // 서버가 처음 응답하기 전 표시용
let myChat = null;                                    // 내가 방금 보낸 채팅 — 내 화면에도 바로 보여준다
function pingJazz(say) {
  if (!jazz || !Net.online) return;
  Net.jazzPing(Math.round(player.x), Math.round(player.y), say).then(r => {
    if (!jazz) return;
    if (!r.ok) { toast(r.reason || '재즈바 접속에 문제가 있어요'); return; }
    jazz.cap = r.cap;
    jazz.live = r.people || [];
    refreshUI();
  }).catch(() => {});
}
function sendJazzChat() {
  const el = $('jc-text'), text = el.value.trim();
  if (!text) return;
  el.value = '';
  myChat = { text, at: Date.now() };
  Audio8.play('select');
  pingJazz(text);
  refreshUI();
}
$('jc-send').onclick = sendJazzChat;
$('jc-text').addEventListener('keydown', e => { if (e.key === 'Enter') sendJazzChat(); });
function stopJazzLive() {
  if (jazzTimer) { clearInterval(jazzTimer); jazzTimer = null; }
  Net.jazzLeave();
}
function enterJazz() {
  Audio8.play('door');
  transition(() => {
    const vi = place.vi;
    const n = 9 + Math.floor(Math.random() * 6);
    const names = shuffle(PATRON_NAMES).slice(0, n);
    place = { kind:'jazz', vi };
    jazz = {
      crowd: 24 + Math.floor(Math.random() * 52),          // 지금 이 방에 있는 사람 수 (오프라인용 예시)
      seated: null,
      live: [], cap: JAZZ_CAP_FALLBACK,                    // 실제 접속 중인 회원 — 서버가 채운다
      patrons: names.map((name, i) => {
        const T = JZ.tables[i % JZ.tables.length];
        return { name, x: T[0] + (i < JZ.tables.length ? -14 : 16), y: T[1] - 4,
                 hair: pickOne(['#3a2e28','#2b2b33','#4a3550','#5a4030','#7a4f3a','#b0aca8']),
                 shirt: pickOne(['#d4818f','#5a86a8','#8a7aa8','#7fa88a','#e0b45a','#c4849e','#9aa8a0']),
                 lines: pickOne(PATRON_LINES), topic: pickOne(PATRON_TOPICS),
                 t: Math.random() * 3000 };
      }),
    };
    if (Net.online) {
      pingJazz();
      jazzTimer = setInterval(pingJazz, 3000);
    }
    live = []; setView(false);
    player.x = JZ.door.x + 6; player.y = 108; player.dir = 'down';
    camX = camY = 0; refreshUI();
    toast(Net.online ? '🎷 실시간 접속 정원 ' + JAZZ_CAP_FALLBACK + '명 중 한 자리 — 실제 회원은 이름표로 보여요'
                      : '🎷 지금 ' + jazz.crowd + ' / ' + BAR_CAP + '명이 와 있어요 (혼자 모드 예시)');
  });
}
function jazzSeatOf(i) { const T = JZ.tables[i]; return { x: T[0] + 6, y: T[1] - 2 }; }
function drawJazz(t) {
  // 어두운 방 — 촛불과 무대 조명만
  px(0, 0, JAZZ_W, RT, '#3E3448');
  px(0, 0, JAZZ_W, 2, '#4E4258');
  for (let x = 0; x < JAZZ_W; x += 10) px(x, 0, 1, RT, '#453A50');
  px(0, RT - 5, JAZZ_W, 5, '#2E2638');
  px(0, RT, JAZZ_W, H - RT, '#4A3E44');
  for (let y = RT; y < H; y += 8) px(0, y, JAZZ_W, 1, '#413640');

  // 무대
  const S = JZ.stage;
  px(S.x - 3, S.y - 3, S.w + 6, S.h + 8, '#33293C');
  px(S.x, S.y, S.w, S.h, '#5A3A4A');                      // 벨벳 커튼
  for (let i = 0; i < S.w; i += 7) px(S.x + i, S.y, 3, S.h, '#6B4658');
  px(S.x - 6, S.y + S.h, S.w + 12, 5, '#7A5A44');          // 무대 바닥
  const spot = .5 + Math.sin(t / 900) * .12;
  ctx.fillStyle = 'rgba(255,232,168,' + (spot * .18).toFixed(3) + ')';
  ctx.fillRect(S.x - 8, S.y, S.w + 16, S.h + 42);
  // 연주자 넷 — 피아노 · 베이스 · 드럼 · 색소폰
  const sway = i => Math.sin(t / (420 + i * 90)) > 0 ? 0 : 1;
  px(S.x + 8, S.y + 32, 34, 16, '#2E2A33');                // 피아노
  px(S.x + 8, S.y + 30, 34, 3, '#43404A');
  ctx.fillStyle = '#EFE9DC';
  for (let i = 0; i < 11; i++) ctx.fillRect(S.x + 10 + i * 3, S.y + 33, 2, 4);
  sprite(BODY.up.concat(LEG_A), S.x + 20, S.y + 12 - sway(0), false, { h:'#2b2b33', c:'#8A7AA8' });
  px(S.x + 60, S.y + 22 - sway(1), 7, 26, '#8A5A38');      // 더블베이스
  px(S.x + 62, S.y + 18 - sway(1), 3, 6, '#6E4630');
  sprite(BODY.down.concat(LEG_A), S.x + 68, S.y + 20 - sway(1), false, { h:'#3a2e28', c:'#5a86a8' });
  px(S.x + 96, S.y + 36, 14, 10, '#B8AC96');               // 드럼
  px(S.x + 96, S.y + 34, 14, 3, '#D4C8B0');
  px(S.x + 112, S.y + 30 - sway(2), 10, 1, '#E8C46A');     // 심벌
  sprite(BODY.down.concat(LEG_A), S.x + 98, S.y + 18 - sway(2), false, { h:'#4a3550', c:'#d4818f' });
  sprite(BODY.side.concat(LEG_A), S.x + 128, S.y + 20 - sway(3), true, { h:'#7a4f3a', c:'#e0b45a' });
  px(S.x + 124, S.y + 24 - sway(3), 4, 10, '#E8C46A');     // 색소폰
  px(S.x + 122, S.y + 33 - sway(3), 6, 3, '#E8C46A');
  // 음표
  for (let i = 0; i < 4; i++) {
    const k = (t / 22 + i * 40) % 160;
    if (k > 120) continue;
    const nx = S.x + S.w - 6 + k * .5, ny = S.y + 14 - k * .18 + Math.sin(k / 9) * 3;
    px(nx, ny, 3, 2, 'rgba(255,232,168,.65)'); px(nx + 2, ny - 4, 1, 4, 'rgba(255,232,168,.65)');
  }
  // 네온 간판
  const blink = Math.sin(t / 700) > -.6;
  px(248, 22, 46, 16, '#2A2233');
  ctx.fillStyle = blink ? '#F26E9A' : '#7A4458';
  for (let i = 0; i < 4; i++) ctx.fillRect(253 + i * 10, 27, 6, 6);
  ctx.fillStyle = blink ? 'rgba(242,110,154,.16)' : 'rgba(0,0,0,0)';
  ctx.fillRect(240, 14, 62, 32);

  // 바 카운터
  const B = JZ.bar;
  px(B.x, B.y, B.w, B.h, '#5A4030');
  px(B.x, B.y, B.w, 4, '#7A5A44');
  px(B.x, B.y + B.h - 3, B.w, 3, '#43301F');
  for (let i = 0; i < 6; i++) {                            // 스툴
    px(B.x + 12 + i * 24, B.y + B.h + 4, 8, 3, '#6E5236');
    px(B.x + 15 + i * 24, B.y + B.h + 7, 2, 7, '#57402A');
  }
  px(B.x + 8, B.y - 22, B.w - 16, 20, '#3A2F3E');          // 뒤쪽 선반
  ['#C4785E','#7A9E8A','#B08A5E','#8A7AA8','#D4A05A','#6E8AA8'].forEach((c, i) =>
    px(B.x + 14 + i * 22, B.y - 18, 5, 14, c));
  sprite(BODY.up.concat(LEG_A), B.x + 66, B.y - 16, false, { h:'#2E2A26', c:'#EFE9DC' });  // 바텐더

  // 테이블과 촛불
  JZ.tables.forEach(([tx, ty], i) => {
    px(tx - 9, ty - 4, 18, 9, '#5A4030');
    px(tx - 9, ty - 6, 18, 3, '#7A5A44');
    px(tx - 2, ty + 5, 4, 6, '#43301F');
    const fl = Math.sin(t / 180 + i * 2) > 0 ? 0 : 1;
    px(tx - 1, ty - 10, 2, 4, '#EFE4C8');                  // 초
    px(tx - 1, ty - 13 - fl, 2, 3, '#FFD98A');
    ctx.fillStyle = 'rgba(255,214,120,.13)';
    ctx.fillRect(tx - 14, ty - 18, 28, 24);
  });

  // 손님들 — 여기서만 보인다
  jazz.patrons.forEach((p, i) => {
    const on = isF('patron', 'i', i);
    if (on) { ctx.fillStyle = GLOW; ctx.fillRect(p.x - 4, p.y - 6, 18, 24); }
    const bob = Math.sin(t / 640 + i * 1.7) > .75 ? 1 : 0;
    person(p.x, p.y - bob, 'down', false, 0, { h:p.hair, c:p.shirt });
    if (on) arrow(p.x + 4, p.y - 12, t);
  });
  // 실시간으로 접속해 있는 진짜 회원 — 이름표(🟢)가 항상 보이고, 초록 점으로 한 번 더 표시한다
  (jazz.live || []).forEach((p, i) => {
    const on = isF('livep', 'i', i);
    if (on) { ctx.fillStyle = GLOW; ctx.fillRect(p.x - 4, p.y - 6, 18, 24); }
    person(p.x, p.y, 'down', false, Math.floor(t / 160), { h:'#4A3A2E', c:'#5A9E7A' });
    px(p.x + 11, p.y - 2, 3, 3, '#3FBF6A');
    if (on) arrow(p.x + 4, p.y - 12, t);
  });

  drawDoorIndoor('#7A5A44', JZ.door, isF('out'), t);
}
// 실제 접속 중인 회원 — 지어낸 대사를 붙이지 않는다. 아직 채팅 기능이 없다는 것만 정직하게 알려준다.
function talkLive(i) {
  const p = jazz.live && jazz.live[i];
  if (!p) return;
  say(p.who + ' 님', ['🟢 지금 실시간으로 이 바에 와 있는 회원이에요.', '아직 대화 기능은 없어요 — 서로 있다는 것만 보여요.'],
    [{ label:'손 흔들기', fn: () => Audio8.play('select') }]);
  dialog.at = { x: p.x + 5, y: p.y }; placeBubble();
}
function talkPatron(i) {
  const p = jazz.patrons[i];
  const already = friends.has(-1);                        // 데모에선 방이 없는 손님
  say(p.name, p.lines.concat(['요즘은 ' + p.topic + ' 쪽을 보고 있어요.']), [
    { label:'📕 무슨 책 읽는지 물어보기', fn: () => {
        const bk = pickOne(CATALOG);
        say(p.name, ['『' + bk.t + '』요. ' + bk.note], [
          { label:'📗 나도 한 권 적어두기', fn: () => {
              if (owned().has(bk.t)) { toast('이미 책장에 있어요'); return; }
              addToMyShelf(Object.assign({}, bk, { from: p.name + '이(가) 말해준 책', done:false }));
              Audio8.play('coin'); toast('『' + bk.t + '』를 책장에 꽂았어요');
            } },
          { label:'고마워요' }]);
        dialog.at = { x:p.x + 5, y:p.y }; placeBubble();
      } },
    { label:'🤝 친구 하자고 하기', fn: () => {
        toast('🤝 ' + p.name + '와(과) 인사를 나눴어요 · 손님 문 목록에 올려두었습니다');
        Audio8.play('dex');
      } },
    { label:'그냥 음악 듣기' },
  ]);
  dialog.at = { x:p.x + 5, y:p.y }; placeBubble();
}

// ════ 탈것 안 ═════════════════════════════════════════════════
//  버스 · 기차 · 비행기를 타면 그 안으로 들어간다.
//  창밖이 흘러가고, 좌석에 앉아 책을 읽고, 승무원이 차를 준다.
//  기다리기 싫으면 언제든 눈을 붙여 바로 도착할 수 있다.
const RIDE_W = 360;
const RIDES = {
  bus:   { name:'버스', dur:22000, wall:'#8A94A0', floor:'#5A6068', seat:'#3E5A78', trim:'#C4CAD2',
           crew:'기사님', win:{ y:16, w:30, h:22, gap:12, n:7 },
           seats:[[46,96],[86,96],[136,96],[176,96],[226,96],[266,96]],
           lines:['안전벨트 매셨죠?','창밖 좀 보세요. 이맘때가 제일 좋아요.'] },
  train: { name:'기차', dur:28000, wall:'#A8A090', floor:'#6E6458', seat:'#7A5A44', trim:'#DCD4C4',
           crew:'승무원', win:{ y:14, w:44, h:28, gap:14, n:5 },
           seats:[[40,94],[92,94],[164,94],[216,94],[280,94]],
           lines:['차 한 잔 하시겠어요?','다음 역까지 한참 갑니다. 편히 계세요.'] },
  plane: { name:'비행기', dur:40000, wall:'#C4CCD4', floor:'#4E5A66', seat:'#3A4A5A', trim:'#E8EEF2',
           crew:'승무원', win:{ y:18, w:16, h:18, gap:20, n:8 },
           seats:[[44,92],[76,92],[124,92],[156,92],[212,92],[244,92],[292,92]],
           lines:['곧 순항 고도에 오릅니다.','음료 드릴까요? 오늘은 하늘이 맑네요.'] },
};
let ride = null;
function startRide(mode, gi) {
  const R = RIDES[mode];
  ride = { mode, to: gi, t: 0, dur: R.dur, served: false, seated: false, read: null };
  place = { kind:'ride', vi: place.vi, mode, to: gi };
  live = []; setView(false);
  player.x = 30; player.y = 112; player.dir = 'right';
  camX = camY = 0;
  $('ridebar').classList.add('on');
  refreshUI();
}
function rideLeft() { return Math.max(0, Math.ceil((ride.dur - ride.t) / 1000)); }
function arriveRide() {
  const gi = ride.to;
  $('ridebar').classList.remove('on');
  transition(() => {
    // place 와 ride 를 같은 순간에 같이 바꾼다 (재즈바와 같은 이유의 버그를 막는다) —
    // 따로 놀면 전환 애니메이션 도는 동안 place.kind 는 아직 'ride' 인데 ride 만
    // 먼저 비어서, 그 사이에 화면을 다시 그리다가 ride.mode 를 읽어 죽는다.
    ride = null;
    place = { kind:'town', vi: gi }; spawnTown(); scatterDrops(); spawnLive();
    const b = place.kind === 'town' ? BUS : BUS;
    player.x = b.x + b.w / 2 - 5; player.y = b.y + b.h + 14; player.dir = 'down';
    setView(true); refreshUI();
    toast(VIL[gi].name + ' 에 도착했어요 · ' + VIL[gi].intro);
  });
}
function updateRide(dt) {
  if (!ride) return;
  ride.t += dt;
  const left = rideLeft();
  $('ride-to').textContent = VIL[ride.to].name;
  $('ride-mode').textContent = RIDES[ride.mode].name;
  $('ride-left').textContent = left > 0 ? left + '초 뒤 도착' : '도착했습니다';
  $('ride-bar').style.width = Math.min(100, ride.t / ride.dur * 100).toFixed(1) + '%';
  if (ride.t >= ride.dur + 1200) arriveRide();
}
$('ride-skip').onclick = () => { if (ride) { ride.t = ride.dur; arriveRide(); } };

// 창밖 — 계절 색으로 흘러간다
function scenery(x, y, w, h, t, mode) {
  const v = VIL[ride ? ride.to : place.vi];
  const sky = mode === 'plane' ? '#7FB8E4' : SEASON.sky;
  px(x, y, w, h, sky);
  if (mode === 'plane') {
    for (let i = 0; i < 4; i++) {
      const cx = ((t / 26 + i * 61) % (w + 30)) - 30;
      px(x + cx, y + 3 + (i % 3) * 5, 14, 4, '#FFFFFF');
      px(x + cx + 4, y + 1 + (i % 3) * 5, 8, 3, '#FFFFFF');
    }
    px(x, y + h - 5, w, 5, '#9AC4DC');
    return;
  }
  const gy = y + h - 7;
  px(x, gy, w, 7, shade(SEASON.grass, .95));           // 들판
  for (let i = 0; i < 7; i++) {                        // 지나가는 나무
    const cx = ((t / 9 + i * 47) % (w + 24)) - 24;
    px(x + cx + 3, gy - 3, 2, 4, '#8A6440');
    px(x + cx, gy - 9, 8, 7, SEASON.key === 'winter' ? '#B8C4B8' : SEASON.leaf);
  }
  for (let i = 0; i < 3; i++) {                        // 전봇대
    const cx = ((t / 5.5 + i * 96) % (w + 20)) - 20;
    px(x + cx, y + 4, 1, h - 11, '#7E7466');
    px(x + cx - 3, y + 6, 7, 1, '#7E7466');
  }
  for (let i = 0; i < 3; i++) {                        // 먼 산
    const cx = ((t / 34 + i * 74) % (w + 40)) - 40;
    for (let k = 0; k < 8; k++) px(x + cx + k, gy - 8 - k, 18 - k * 2, 1, '#A8B4BC');
  }
  if (WEATHER.rain > 0) for (let i = 0; i < 12; i++)
    px(x + ((i * 17 + t / 2) % w), y + ((i * 23 + t / 1.4) % h), 1, 4, 'rgba(200,225,240,.55)');
}
function drawRide(t) {
  const R = RIDES[ride.mode];
  px(0, 0, RIDE_W, RT, R.wall);
  px(0, RT - 5, RIDE_W, 5, shade(R.wall, .8));
  px(0, RT, RIDE_W, H - RT, R.floor);
  for (let y = RT; y < H; y += 7) px(0, y, RIDE_W, 1, shade(R.floor, .88));
  // 통로 바닥 — 기차는 카펫, 비행기는 파란 통로매트, 버스는 미끄럼방지 고무판
  const aisle = ride.mode === 'plane' ? '#5A7AA0' : ride.mode === 'bus' ? shade(R.floor, .65) : shade(R.floor, 1.25);
  px(0, RT + 2, RIDE_W, 3, aisle);
  px(0, H - 12, RIDE_W, 3, shade(R.floor, 1.15));
  if (ride.mode === 'plane') {                          // 안전벨트 표시등 — 깜빡인다
    px(12, 3, 12, 7, shade(R.wall, .7));
    px(14, 5, 8, 3, Math.sin(t / 550) > 0 ? '#E8C46A' : shade(R.wall, .55));
  }

  const w = R.win;
  for (let i = 0; i < w.n; i++) {
    const x = 16 + i * (w.w + w.gap);
    if (x + w.w > RIDE_W - 8) break;
    px(x - 2, w.y - 2, w.w + 4, w.h + 4, R.trim);
    if (ride.mode === 'plane') {                        // 둥근 창
      px(x, w.y + 2, w.w, w.h - 4, '#000');
      scenery(x, w.y + 2, w.w, w.h - 4, t, ride.mode);
      px(x, w.y + 2, w.w, 1, R.trim); px(x, w.y + w.h - 3, w.w, 1, R.trim);
    } else {
      scenery(x, w.y, w.w, w.h, t, ride.mode);
      px(x + w.w / 2 - 1, w.y, 1, w.h, 'rgba(255,255,255,.25)');
    }
    px(x, w.y + w.h, w.w, 2, shade(R.trim, .8));
  }
  if (ride.mode === 'plane') {                            // 머리 위 짐칸 — 비행기만
    px(0, w.y - 8, RIDE_W, 6, shade(R.trim, .82));
    px(0, w.y - 8, RIDE_W, 1, shade(R.trim, 1.2));
  }
  if (ride.mode === 'bus') {                              // 손잡이 — 버스만
    for (let i = 0; i < 5; i++) {
      const hx = 40 + i * 56;
      px(hx, RT, 1, 14, shade(R.trim, .7));
      px(hx - 2, RT + 13, 5, 2, shade(R.trim, .6));
    }
  }
  // 좌석
  R.seats.forEach(([sx, sy], i) => {
    const mine = ride.seated === i;
    px(sx, sy - 18, 14, 20, R.seat);
    px(sx, sy - 18, 14, 3, shade(R.seat, 1.3));
    px(sx + 2, sy - 15, 10, 12, shade(R.seat, 1.15));
    px(sx, sy + 2, 14, 3, shade(R.seat, .7));
    if (ride.mode === 'plane') px(sx - 3, sy - 4, 3, 2, shade(R.trim, .9));  // 트레이 테이블
    if (mine) {                                          // 내가 앉아 책 읽는 중
      sprite(BODY.down.slice(0, 9), sx + 2, sy - 26, false);
      px(sx + 3, sy - 14, 8, 5, ride.read ? ride.read.col : '#D4645C');
      px(sx + 6, sy - 14, 1, 5, 'rgba(255,255,255,.4)');
    }
  });
  // 기사 · 승무원 — 버스는 앞자리에 고정된 기사님, 기차 · 비행기는 통로를 오가는 승무원
  if (ride.mode === 'bus') {
    sprite(BODY.down, 26, 100, false, { h:'#3a3230', c:'#5A6A8A' });
    px(20, 108, 12, 10, shade(R.trim, .75));              // 운전대
    px(23, 110, 6, 6, shade(R.trim, .5));
  } else {
    const cx2 = 300 + Math.sin(t / 1400) * 22;
    sprite(BODY.down.concat(LEG_A), cx2, 100, false, { h:'#3A3230', c:'#B85A5A' });
    px(cx2 - 6, 112, 10, 5, '#C4B8A8');                    // 카트
    px(cx2 - 6, 112, 10, 1, '#E0D6C8');
  }
  // 출입문
  const dOn = isF('rideout'), open = ride.t >= ride.dur;
  px(RIDE_W - 40, 14, 34, 54, shade(R.trim, .7));
  px(RIDE_W - 37, 17, 28, 48, open ? '#DCEAF2' : R.wall);
  if (open) { px(RIDE_W - 37, 17, 13, 48, R.trim); px(RIDE_W - 21, 17, 12, 48, R.trim); }
  px(RIDE_W - 24, 40, 3, 3, '#E8C46A');
  if (dOn) { ctx.fillStyle = GLOW; ctx.fillRect(RIDE_W - 44, 10, 42, 62);
             arrow(RIDE_W - 24, 4, t); }
}

// ════ 손님 문 ═════════════════════════════════════════════════
//  마이스페이스처럼 방은 누구에게나 열려 있다.
//  친구를 맺으면 목록 위쪽에 뜨고, 아니어도 들어가 볼 수 있다.
//  방문 자체는 아무 흔적도 남기지 않는다 — 남길지는 온 사람이 정한다.
const friends = new Set();                          // 이미 맺은 사이 (오프라인 데모용 — 가짜 이웃을 없애서 비어 있다)
const myCode = 'SEOJAE-4821';
let visitOrder = ROOMS.map((_, i) => i).filter(i => i !== 0);   // 내가 정한 순서
const codeOf = i => ['—','MINJI-1102','DOHYUN-0417','SEOYUN-2930','JUNHO-7715','HANEUL-3388'][i] || '';

// ── 서버와 주고받기 ───────────────────────────────────────────
//  방을 통째로 올려두면, 친구가 코드로 찾아와 그대로 구경한다.
function snapshot() {
  const R = ROOMS[0];
  const item2 = it => {
    const o = { kind:it.kind, x:it.x, y:it.y, w:it.w, h:it.h };
    if (it.kind === 'shelf') o.books = it.books.map(b2 => ({
      t:b2.t, a:b2.a, kdc:b2.kdc, col:b2.col, h:b2.h, w:b2.w, note:b2.note,
      from:b2.from, done:!!b2.done, memos:b2.memos || [], pressed:b2.pressed || [] }));
    if (it.kind === 'poster') { o.art = it.art; o.title = it.title; o.desc = it.desc;
      if (it.src && it.src.length < 260000) o.src = it.src; }   // 너무 큰 사진은 빼고 도트만
    if (it.kind === 'plant') { o.grow = it.grow || 0; o.species = it.species; }
    return o;
  };
  return { who:R.who, bio:R.bio, village:R.village,
           wall:R.wall, floor:R.floor, wood:R.wood, rug:R.rug, hair:R.hair, shirt:R.shirt,
           items:R.items.map(item2), visitors:R.visitors.slice(0, 12),
           freeNotes: (R.freeNotes || []).slice(-50) };
}
let syncT = null;
function syncRoom() {
  if (!Net.online) return;
  clearTimeout(syncT);
  syncT = setTimeout(() => Net.push(snapshot()), 400);
}
function roomFromSnapshot(s) {
  const R = Object.assign({ type:'private', visitors:s.visitors || [], letters:[], items:[] }, {
    who:s.who || '이름 없는 사람', bio:s.bio || '', village:s.village || 'seongsu',
    wall:s.wall || '#8E80AE', floor:s.floor || '#C4A57E', wood:s.wood || '#B08A5E',
    rug:s.rug || '#C4808E', hair:s.hair || '#7a4f3a', shirt:s.shirt || '#7fa88a',
    remote:true, code:s.code,
  });
  R.items = (s.items || []).map(it => Object.assign({ id: uid++ }, it));
  if (!vidx(R.village)) R.village = VIL[0].key;
  layoutRoom(R);
  return R;
}
async function visitCode(code) {
  try {
    toast('🚪 ' + code + ' 방을 여는 중…');
    const s = await Net.room(code);
    const idx = ROOMS.push(roomFromSnapshot(s)) - 1;
    enterRoom(idx);
  } catch (e) { Audio8.play('wrong'); toast('열지 못했어요 — ' + e.message); }
}

// ── 손님 문 ───────────────────────────────────────────────────
let netFriends = [], netPeople = [], visitTab = 'friend';
function openVisit() { renderVisit(); showOv('visit'); refreshVisit(); }
async function refreshVisit() {
  if (!Net.online) return;
  try { netFriends = await Net.friends(); } catch (e) {}
  try { netPeople = await Net.people(); } catch (e) {}
  if (openOv === 'visit') renderVisit();
}
function renderVisit() {
  $('vs-code').textContent = Net.online ? Net.code : myCode + ' (혼자 모드)';
  $('vs-net').textContent = Net.online ? '● 연결됨' : '○ ' + Net.reason;
  $('vs-net').className = Net.online ? 'netok' : 'netoff';
  const box = $('vs-list'); box.innerHTML = '';

  const rows = [];
  if (Net.online) {
    const fset = new Set(netFriends.map(f => f.code));
    netFriends.forEach(f => rows.push({ ...f, fr:true }));
    netPeople.forEach(p => { if (p.code !== Net.code && !fset.has(p.code)) rows.push({ ...p, fr:false }); });
  } else {
    visitOrder.forEach(idx => {
      const r = ROOMS[idx];
      if (!r || r.remote) return;
      const reading = allBooks(r).find(b2 => !b2.done) || allBooks(r)[0];
      rows.push({ local:idx, who:r.who, code:codeOf(idx), fr:friends.has(idx),
                  village:r.village, books:allBooks(r).length, reading: reading && reading.t });
    });
  }
  if (!rows.length) {
    box.innerHTML = '<div class="none">' + (Net.online
      ? '아직 아무도 방을 만들지 않았어요.<br>친구에게 내 코드를 알려주세요.'
      : '서버를 켜면 진짜 친구와 연결됩니다.') + '</div>';
    return;
  }
  rows.forEach((r, pos) => {
    const vi2 = r.village ? vidx(r.village) : -1;
    const v = vi2 >= 0 ? VIL[vi2] : null;
    const el = document.createElement('div');
    el.className = 'vrow' + (r.fr ? ' fr' : '');
    el.innerHTML =
      '<span class="ord">' + (pos + 1) + '</span>' +
      '<span class="vmain"><span class="vn">' + esc(r.who) +
        (r.fr ? '<i class="badge">친구</i>' : '') + '</span>' +
        '<span class="vw">' + (v ? esc(v.name) + ' · ' : '') +
        '<code>' + esc(r.code || '') + '</code>' +
        (r.books ? ' · 책 ' + r.books + '권' : '') + '</span>' +
        (r.reading ? '<span class="vb">📖 ' + esc(r.reading) + '</span>' : '') + '</span>' +
      '<span class="vact">' +
        (r.local !== undefined ? '<button class="mv" data-d="-1">▲</button>' +
                                 '<button class="mv" data-d="1">▼</button>' : '') +
        '<button class="go2">놀러가기</button></span>';
    el.querySelector('.go2').onclick = () =>
      r.local !== undefined ? enterRoom(r.local) : visitCode(r.code);
    el.querySelectorAll('.mv').forEach(b2 => b2.onclick = () => {
      const d = +b2.dataset.d, from = visitOrder.indexOf(r.local), to = from + d;
      if (to < 0 || to >= visitOrder.length) return;
      const tmp = visitOrder[from]; visitOrder[from] = visitOrder[to]; visitOrder[to] = tmp;
      Audio8.play('select'); renderVisit();
    });
    box.appendChild(el);
  });
}
$('vs-add').onclick = async () => {
  const c = $('vs-input').value.trim().toUpperCase();
  if (!c) { toast('친구 코드를 넣어주세요'); return; }
  if (Net.online) {
    try {
      netFriends = await Net.addFriend(c);
      $('vs-input').value = ''; Audio8.play('dex'); renderVisit();
      toast('🚪 친구가 됐어요 · 서로의 손님 문에 이름이 걸립니다');
    } catch (e) { Audio8.play('wrong'); toast(e.message); }
    return;
  }
  const idx = ROOMS.findIndex((_, i) => i !== 0 && codeOf(i) === c);
  if (idx < 0) { toast('그런 코드는 없어요'); Audio8.play('wrong'); return; }
  if (friends.has(idx)) { toast('이미 친구예요'); return; }
  friends.add(idx);
  visitOrder = [idx].concat(visitOrder.filter(i => i !== idx));
  $('vs-input').value = ''; Audio8.play('dex'); renderVisit();
  toast('🚪 ' + ROOMS[idx].who + '와(과) 친구가 됐어요');
};
$('vs-copy').onclick = async () => {
  const c = Net.online ? Net.code : myCode;
  try { await navigator.clipboard.writeText(c); toast('내 코드를 복사했어요 — ' + c); }
  catch (e) { toast('내 코드는 ' + c + ' 입니다'); }
};

// ── 신문 ──────────────────────────────────────────────────────
//  문화면 RSS 를 그대로 건다. 제목·요약까지만 보여주고 본문은 신문사로 보낸다.
//  분야는 원문에 없어서 제목·요약의 낱말로 짐작해 나눈다 (news.js 의 newsCatOf).
let newsFilter = null;
function openNews() { renderNews(); showOv('news'); News.refresh(); }
News.onChange(() => { if (openOv === 'news') renderNews(); });
function renderNews() {
  const cnt = News.counts();
  const chips = $('nw-chips'); chips.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'chip' + (newsFilter ? '' : ' on'); allBtn.textContent = '전체';
  allBtn.onclick = () => { newsFilter = null; renderNews(); };
  chips.appendChild(allBtn);
  NEWS_CATS.forEach(c => {
    if (!cnt[c.key]) return;
    const el = document.createElement('button');
    el.className = 'chip' + (newsFilter === c.key ? ' on' : '');
    el.textContent = c.label + ' ' + cnt[c.key];
    el.onclick = () => { newsFilter = c.key; renderNews(); };
    chips.appendChild(el);
  });
  if (cnt.etc) {
    const el = document.createElement('button');
    el.className = 'chip' + (newsFilter === 'etc' ? ' on' : '');
    el.textContent = '기타 ' + cnt.etc;
    el.onclick = () => { newsFilter = 'etc'; renderNews(); };
    chips.appendChild(el);
  }

  const list = News.list(newsFilter);
  $('nw-cap').innerHTML = SEASON.label + ' · <span class="src ' + News.state + '">' +
    esc(News.note) + '</span>';
  const box = $('nw-list'); box.innerHTML = '';
  if (!list.length) { box.innerHTML = '<div class="none">오늘 신문이 없어요</div>'; return; }
  list.forEach(a => {
    const el = document.createElement('div');
    el.className = 'paper';
    const when = a.date ? new Date(a.date) : null;
    el.innerHTML =
      '<div class="nt">' + (a.link
        ? '<a href="' + esc(a.link) + '" target="_blank" rel="noopener">' + esc(a.title) + '</a>'
        : esc(a.title)) + '</div>' +
      (a.summary ? '<div class="ns">' + esc(a.summary) + '</div>' : '') +
      '<div class="nm4"><b>' + esc(a.source) + '</b>' +
      (when && !isNaN(when) ? '<span>' + when.toLocaleDateString('ko-KR') + '</span>' : '') + '</div>';
    box.appendChild(el);
  });
}

// ── 박물관 ────────────────────────────────────────────────────
//  문화포털 「전시정보(통합)」 API 로 지금 열려 있는 전시를 받아 건다.
//  서버(node server.js)가 대신 호출해 주고, 없으면 예비 자료로 돈다.
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
function openExpo() {
  renderExpo(); showOv('expo');
  Expo.refresh();                                     // 열 때마다 신선한지 확인
}
Expo.onChange(() => { if (openOv === 'expo') renderExpo(); });
function renderExpo() {
  const list = Expo.list(clockDate, vill().where);
  const live = list.filter(e => e.on).length;
  $('ex-title').textContent = vill().where + ' 박물관';
  $('ex-cap').innerHTML = SEASON.label + ' 기준 · 전시 중 <b>' + live + '</b>건 · ' +
    '<span class="src ' + Expo.state + '">' + esc(Expo.note) + '</span>';
  const box = $('ex-list'); box.innerHTML = '';
  if (!list.length) { box.innerHTML = '<div class="none">전시 정보를 받아오지 못했어요</div>'; return; }
  list.forEach(e => {
    const el = document.createElement('div');
    el.className = 'expo' + (e.on ? ' now' : '');
    el.innerHTML = '<div class="et">' + esc(e.title) + '</div>' +
      '<div class="em"><span class="tag">' + esc(e.tag) + '</span>' +
      (e.on ? '<span class="now-b">전시 중</span>' : '<span>종료 · 예정</span>') +
      (e.local ? '<span class="now-b">우리 동네</span>' : '') +
      (e.where ? '<span>' + esc(e.where) + '</span>' : '') +
      (e.from ? '<span>' + esc(e.from) + ' – ' + esc(e.to) + '</span>' : '') +
      (e.charge ? '<span>' + esc(e.charge) + '</span>' : '') + '</div>' +
      (e.desc ? '<div class="ed">' + esc(e.desc) + '</div>' : '') +
      '<div class="eb">📕 함께 읽으면 좋은 책 — 『' + esc(e.book) + '』' +
      (e.url ? ' · <a href="' + esc(e.url) + '" target="_blank" rel="noopener">전시 정보</a>' : '') +
      '</div>';
    box.appendChild(el);
  });
}

function talkOwner() {
  const n = usedStock.trace.length;
  say('책방 주인', [
    pickOne(NPC_LINES.헌책방),
    '왼쪽 벽이 흔적 있는 책이에요. 지금 ' + n + '권 있고요.',
    '읽고 나면 여기 두고 가셔도 됩니다. 교환대에서 바꾸면 되고요.',
  ], [
    { label:'📖 흔적 있는 책 보기', fn: () => openStall('trace', '흔적 있는 책',
        '누군가 밑줄을 긋고 쪽지를 끼워둔 책들이에요. 데려가면 그 쪽지도 같이 옵니다.') },
    { label:'🔄 책 바꾸기', fn: openSwap },
    { label:'대화 끝내기' },
  ]);
  dialog.at = { x: USED_DESK.x + 34, y: USED_DESK.y - 14 }; placeBubble();
}

// ── 지도 · 버스 · 공항 ────────────────────────────────────────
const MAP_CELL = 9;
const mapCv = $('mapcv'), mapG = mapCv.getContext('2d');
let mapHover = -1;
(function () {
  const s = Art.koreaSize(MAP_CELL);
  mapCv.width = s.w; mapCv.height = s.h;
  mapCv.style.width = s.w + 'px'; mapCv.style.height = s.h + 'px';
})();
// 버스는 가까운 마을만, 기차는 전국 다 — 그래서 버스랑 기차가 갈 수 있는 곳이 다르다
let mapNearOnly = false;
const BUS_RANGE_KM = 150;
const krVillages = () => VIL.map((v, i) => ({ v, i })).filter(o => o.v.country === 'kr')
  .filter(o => !mapNearOnly || o.i === place.vi || kmBetween(place.vi, o.i) <= BUS_RANGE_KM);
function drawMap() {
  const list = krVillages().map(o => o.v);
  const cur = krVillages().findIndex(o => o.i === place.vi);
  Art.drawKorea(mapG, MAP_CELL, list, cur, mapHover);
}
function openMap(near) { mapNearOnly = !!near; mapHover = -1; drawMap(); renderVillageList(); showOv('map'); }
mapCv.addEventListener('mousemove', e => {
  const r = mapCv.getBoundingClientRect();
  const i = Art.regionAt(e.clientX - r.left, e.clientY - r.top, MAP_CELL, krVillages().map(o => o.v));
  if (i !== mapHover) { mapHover = i; drawMap(); renderVillageList(); if (i >= 0) Audio8.play('hover'); }
});
mapCv.addEventListener('click', e => {
  const r = mapCv.getBoundingClientRect();
  const i = Art.regionAt(e.clientX - r.left, e.clientY - r.top, MAP_CELL, krVillages().map(o => o.v));
  if (i >= 0) { const gi = krVillages()[i].i; if (gi !== place.vi) travelTo(gi); }
});
function renderVillageList() {
  const list = $('map-list'); list.innerHTML = '';
  krVillages().forEach((o, k) => {
    const here = o.i === place.vi, km = kmBetween(place.vi, o.i);
    const el = document.createElement('button');
    el.className = 'rgn' + (here ? ' here' : '') + (k === mapHover ? ' hot' : '');
    el.innerHTML = '<span class="rn">' + o.v.name + '</span>' +
      '<span class="rl">' + o.v.where + ' · ' + o.v.theme + ' · 회원 ' + o.v.members + '명</span>' +
      '<span class="rk2">' + (here ? '지금 여기' : km + 'km') + '</span>';
    el.onmouseenter = () => { mapHover = k; drawMap(); };
    if (!here) el.onclick = () => travelTo(o.i);
    list.appendChild(el);
  });
  const v = mapHover >= 0 ? krVillages()[mapHover].v : vill();
  $('map-info').innerHTML = '<b>' + v.name + '</b><br>' + v.intro;
}
function openWorld() {
  const list = $('wl-list'); list.innerHTML = '';
  COUNTRIES.filter(c => !c.home).forEach(c => {           // 공항은 국제선만 — 국내는 버스·기차로
    const vs = c.villages || [];
    const head = document.createElement('div');
    head.className = 'cty';
    head.innerHTML = '<span class="fl">' + c.flag + '</span><span class="cn">' + c.name + '</span>' +
      '<span class="ch">' + (c.home ? '국내' : '비행 ' + c.hours + '시간') + '</span>';
    list.appendChild(head);
    vs.forEach(v => {
      const gi = vidx(v.key), here = gi === place.vi;
      const el = document.createElement('button');
      el.className = 'rgn' + (here ? ' here' : '');
      el.innerHTML = '<span class="rn">' + v.name + '</span>' +
        '<span class="rl">' + v.where + ' · ' + v.theme + ' · 회원 ' + v.members + '명</span>' +
        '<span class="rk2">' + (here ? '지금 여기' : '가기') + '</span>';
      if (!here) el.onclick = () => travelTo(gi);
      list.appendChild(el);
    });
  });
  showOv('world');
}
function travelTo(gi) {
  const from = vill(), to = VIL[gi];
  const abroad = from.country !== to.country;
  const km = kmBetween(place.vi, gi);
  const mins = abroad ? Math.round((countryOf(to).hours || 1) * 60)
             : Math.max(20, Math.round(km / (km > 150 ? 120 : 55) * 60));
  Audio8.play('bus'); closeOv();
  $('bus-ill').textContent = abroad ? '✈️' : km > 150 ? '🚄' : '🚌';
  $('bus-mode').textContent = abroad ? '국제선' : km > 150 ? '기차' : '버스';
  $('bus-from').textContent = from.name;
  $('bus-to').textContent   = to.name;
  $('bus-km').textContent   = (abroad ? to.where : km + 'km') + ' · ' + fmtMin(mins);
  showOv('bus');
  const ms = Math.min(4600, 1500 + km * 4);
  const bar = $('bus-bar');
  bar.style.transition = 'none'; bar.style.width = '0%';
  requestAnimationFrame(() => {
    bar.style.transition = 'width ' + ms + 'ms linear'; bar.style.width = '100%';
  });
  // 잠깐 타는 장면을 보여주고, 탈것 안으로 들어간다
  setTimeout(() => transition(() => {
    startRide(abroad ? 'plane' : km > 150 ? 'train' : 'bus', gi);
  }), 1400);
}
function openLandmark() {
  const v = vill();
  $('lm-name').textContent  = v.lmName;
  $('lm-where').textContent = v.where + ' · ' + v.name;
  $('lm-lib').textContent   = v.lib + ' · 장서 ' + v.books;
  const cv = $('lm-cv'), g = cv.getContext('2d');
  cv.width = 160; cv.height = 100; g.imageSmoothingEnabled = false;
  Art.bind(g);
  g.fillStyle = v.sky;   g.fillRect(0, 0, 160, 100);
  g.fillStyle = v.grass; g.fillRect(0, 84, 160, 16);
  Art.LANDMARK[v.lm](80, 88);
  Art.bind(ctx);
  showOv('landmark');
}

// ── 책 ────────────────────────────────────────────────────────
let activeBook = null;
function openBook(bk) {
  activeBook = bk; Audio8.play('book');
  $('b-kdc').textContent    = bk.kdc + ' ' + kdcName(bk.kdc);
  $('b-title').textContent  = bk.t;
  $('b-author').textContent = bk.a;
  $('b-note').textContent   = bk.note;
  const fr = $('b-from');
  fr.textContent = bk.from ? '『' + bk.from + '』에서 온 책' : '';
  fr.style.display = bk.from ? 'block' : 'none';
  // 끼워둔 책갈피
  const pp = $('b-pressed'); pp.innerHTML = '';
  (bk.pressed || []).forEach(p => {
    const it = Season.ITEMS[p.kind];
    const el = document.createElement('span');
    el.className = 'press';
    el.innerHTML = it.emo + ' <b>' + it.name + '</b> <small>' + p.when + '</small>';
    pp.appendChild(el);
  });
  // 누군가 끼워둔 쪽지
  const mm = $('b-memos'); mm.innerHTML = '';
  (bk.memos || []).forEach(m => {
    const el = document.createElement('div');
    el.className = 'memo';
    el.innerHTML = '<button class="flag">🚩 신고</button>' +
      m.text.replace(/</g, '&lt;') + '<span class="mw">— ' + m.who + '</span>';
    el.querySelector('.flag').onclick = ev => {
      ev.stopPropagation();
      openReport('책 사이 쪽지', m.text, m.who, () => {
        bk.memos.splice(bk.memos.indexOf(m), 1);
      });
    };
    mm.appendChild(el);
  });
  const btn = $('b-act'); btn.className = 'btn';
  if (isHome()) {
    if (bk.done) { btn.textContent = '읽음 · 도감에 등록됨'; btn.classList.add('done'); }
    else btn.textContent = '다 읽었어요 → 도감에 등록';
  } else if (owned().has(bk.t)) { btn.textContent = '이미 내 책장에 있어요'; btn.classList.add('done'); }
  else btn.textContent = '빌려가기 → 내 책장에 꽂기';
  $('b-drop').style.display = isHome() ? 'block' : 'none';
  $('b-memo').textContent = isHome() ? '📎 이 책에 메모 남겨두기' : '📎 책 사이에 메모 끼워두기';
  showOv('book');
}
// 책 사이 메모 — 남의 책장에 꽂힌 책을 펼치면 나오는 쪽지
// 책갈피 — 주운 잎이나 꽃을 책 사이에 눌러 끼운다
$('b-press').onclick = () => {
  const have = Object.keys(pocket).filter(k => pocket[k] > 0);
  if (!have.length) {
    say('책갈피', ['주머니가 비어 있어요.', '마을 길에 떨어진 잎이나 꽃을 주워 오세요.'],
      [{ label:'알겠어요' }]);
    return;
  }
  const bk = activeBook;
  say('책갈피 끼우기', ['『' + bk.t + '』 사이에 무엇을 끼울까요?'],
    have.map(k => {
      const it = Season.ITEMS[k];
      return { label: it.emo + ' ' + it.name + ' (' + pocket[k] + '개)', fn: () => {
        pocket[k]--; if (!pocket[k]) delete pocket[k];
        const entry = { kind:k, when: SEASON.label };
        (bk.pressed = bk.pressed || []).push(entry);
        renderPocket(); Audio8.play('page');
        if (isHome()) syncRoom();
        else if (Net.online && room().remote) {
          const si = shelves(room()).indexOf(shelfOf(room(), bk));
          Net.leaveTrace(room().code, si, bk.t, 'pressed', entry)
            .catch(err => toast('저장 못 했어요 — ' + err.message));
        }
        toast(it.emo + ' ' + it.name + '을(를) 눌러 끼웠어요 — ' +
          (isHome() ? '내 책이에요' : room().who + '의 책에 남았어요'));
        openBook(bk);
      } };
    }).concat([{ label:'그만두기' }]));
};
$('b-memo').onclick = () => {
  if (!guard()) return;
  $('mm-book').textContent = '『' + activeBook.t + '』' +
    (isHome() ? ' · 내 책이에요' : ' · ' + room().who + '의 책이에요');
  $('mm-text').value = ''; $('mm-verdict').className = 'verdict';
  showOv('memo'); setTimeout(() => $('mm-text').focus(), 30);
};
let blockedTries = 0;
$('mm-send').onclick = () => {
  const t = $('mm-text').value.trim(), v = $('mm-verdict');
  if (!t) { toast('쪽지에 쓸 말을 적어주세요'); return; }
  checking(v, '쪽지도 똑같이 검토합니다');
  setTimeout(() => {
    const r = scan(t);
    verdict(v, r);
    if (r.ok) {
      blockedTries = 0;
      (activeBook.memos = activeBook.memos || []).push({ who:'나', text:t });
      Audio8.play('pin');
      if (isHome()) syncRoom();
      else if (Net.online && room().remote) {
        const si = shelves(room()).indexOf(shelfOf(room(), activeBook));
        Net.leaveTrace(room().code, si, activeBook.t, 'memo', { text:t })
          .catch(err => toast('저장 못 했어요 — ' + err.message));
      }
      setTimeout(() => { closeOv(); toast('『' + activeBook.t + '』 사이에 쪽지를 끼워두었어요'); }, 700);
    } else if (++blockedTries >= 3) {
      blockedTries = 0;
      warn('나', '검열에 걸리는 글을 반복해서 쓰려고 함');
    }
  }, 1100);
};
const shelfOf = (R, bk) => shelves(R).find(s => s.books.includes(bk));
function addToMyShelf(bk) {
  const ss = shelves(ROOMS[0]);
  if (!ss.length) { toast('책장이 없어요. 내 방에서 E 를 눌러 책장을 놓아주세요'); return; }
  const t = ss.reduce((a, s) => {
    const cap = boardsOf(s).length * (s.w - 8);
    const used = s.books.reduce((n, x) => n + x.w + 1, 0);
    return (cap - used) > (a.cap - a.used) ? { s, cap, used } : a;
  }, { s: ss[0], cap: 0, used: 1e9 }).s;
  t.books.push(bk); layoutRoom(ROOMS[0]); renderStats();
}
$('b-act').onclick = () => {
  const bk = activeBook;
  if (isHome()) {
    if (bk.done) return;
    bk.done = true; readKdc.add(bk.kdc); renderDex(); Audio8.play('dex');
    toast('도감 ' + bk.kdc + ' ' + kdcName(bk.kdc) + ' 칸이 열렸어요');
  } else {
    if (owned().has(bk.t)) return;
    borrowed.add(bk.t); Audio8.play('coin');
    addToMyShelf(Object.assign({}, bk, { from: room().who + '의 방', done:false }));
    room().visitors.unshift({ n:'나', b:bk.t });
    toast('『' + bk.t + '』를 빌려왔어요 · 내 책장에 꽂힘');
  }
  closeOv();
};
$('b-drop').onclick = () => {
  const s = shelfOf(ROOMS[0], activeBook); if (!s) return;
  s.books.splice(s.books.indexOf(activeBook), 1);
  borrowed.delete(activeBook.t);
  layoutRoom(ROOMS[0]); renderStats(); closeOv();
  toast('『' + activeBook.t + '』를 책장에서 뺐어요');
};
$('b-lines').onclick = () => openLines(activeBook);

// ── 문장 선물 ─────────────────────────────────────────────────
//  참새(편지)는 이제 실제 친구에게 간다 — 그 친구의 서버 우편함에 진짜로 쌓인다.
let giftTo = null, giftFromMail = false, giftFriends = [];
$('b-gift').onclick = () => { giftFromMail = false; letterMode = false; openGift(activeBook); };
async function openGift(bk) {
  activeBook = bk;
  const pk = $('g-pick');
  $('g-book').textContent = letterMode ? '✉️ 책 없이 보내는 편지예요'
    : giftFromMail ? '내 책장에서 책을 고르세요' : '『' + bk.t + '』 · ' + bk.a;
  if (letterMode) {
    pk.style.display = 'none';
  } else if (giftFromMail) {
    pk.style.display = 'block'; pk.innerHTML = '';
    const mine = allBooks(ROOMS[0]);
    if (!mine.length) { toast('내 책장이 비어 있어요'); return; }
    mine.forEach((x, i) => {
      const o = document.createElement('option'); o.value = i; o.textContent = x.t + ' · ' + x.a;
      pk.appendChild(o);
    });
    pk.value = Math.max(0, mine.indexOf(bk));
    pk.onchange = () => { activeBook = mine[+pk.value]; $('g-text').value = activeBook.note; };
    activeBook = mine[+pk.value];
  } else pk.style.display = 'none';

  $('g-text').value = activeBook.note;
  const fl = $('g-friends'); fl.innerHTML = '<div class="none">불러오는 중…</div>';
  showOv('gift');
  try { giftFriends = Net.online ? await Net.friends() : []; }
  catch (e) { giftFriends = []; }
  if (!giftFriends.some(f => f.code === giftTo)) giftTo = giftFriends[0] ? giftFriends[0].code : null;
  fl.innerHTML = '';
  if (!giftFriends.length) {
    fl.innerHTML = '<div class="none">' + (Net.online
      ? '아직 친구가 없어요 · 손님 문에서 코드를 주고받아 친구를 맺어보세요'
      : '로그인해야 친구에게 보낼 수 있어요') + '</div>';
  }
  giftFriends.forEach(f => {
    const el = document.createElement('button');
    el.className = 'fr' + (f.code === giftTo ? ' sel' : '');
    const vi2 = f.village ? vidx(f.village) : -1, v = vi2 >= 0 ? VIL[vi2] : null;
    el.innerHTML = '<div class="n">' + esc(f.who) + '</div><div class="d">' +
      (v ? v.where + ' · ' + kmBetween(place.vi, vi2) + 'km' : f.code) + '</div>';
    el.onclick = () => { giftTo = f.code; openGift(activeBook); };
    fl.appendChild(el);
  });
  sparrowHint();
}
function currentGiftFriend() { return giftFriends.find(f => f.code === giftTo) || null; }
function updateEta() {
  const f = currentGiftFriend();
  if (!f) { $('g-eta').innerHTML = ''; return; }
  const vi2 = f.village ? vidx(f.village) : -1;
  const km = vi2 >= 0 ? kmBetween(place.vi, vi2) : 300;
  const c = carrierFor(($('g-text').value || '').trim().length);
  const min = Math.round(flightMinutes(km) * c.mult);
  $('g-eta').innerHTML = c.emo + ' <b>' + c.name + '</b>이(가) 시속 ' +
    Math.round(BIRD_KMH / c.mult) + 'km 로 날아갑니다.<br>' + esc(f.who) + '님까지 <b>' + km + 'km</b>' +
    ' — 도착까지 <b>' + fmtMin(min) + '</b>' +
    '<div class="demo">데모에서는 ' + Math.round(demoMs(km) * c.mult / 1000) + '초로 압축됩니다</div>';
}
// 배달부 — 편지가 길어지면 더 큰 새가 대신 물고 간다. 막지는 않는다.
const CARRIERS = [
  { min:0,    key:'sparrow', emo:'🐦', name:'참새',   mult:1,
    hint:'참새가 발밑에서 폴짝거려요' },
  { min:120,  key:'sparrow', emo:'🐦', name:'참새',   mult:1.1,
    hint:'참새가 부리로 종이를 고쳐 뭅니다' },
  { min:280,  key:'sparrow', emo:'🐦', name:'참새',   mult:1.25,
    hint:'참새가 살짝 뒤뚱거려요… 그래도 가겠대요' },
  { min:520,  key:'magpie',  emo:'🐤', name:'까치',   mult:1.4,
    hint:'참새가 힘들어하자 까치가 대신 물어줍니다' },
  { min:1100, key:'pigeon',  emo:'🕊', name:'전서구', mult:1.6,
    hint:'전서구가 나섰어요. 먼 길 긴 편지는 얘가 전문입니다' },
  { min:2400, key:'goose',   emo:'🦆', name:'기러기', mult:1.9,
    hint:'기러기가 편지 뭉치를 지고 갑니다. 아주 긴 편지네요' },
];
function carrierFor(n) {
  let c = CARRIERS[0];
  for (const x of CARRIERS) if (n >= x.min) c = x;
  return c;
}
function sparrowHint() {
  const n = $('g-text').value.trim().length;
  const c = carrierFor(n), el = $('g-hint');
  el.textContent = n ? c.emo + ' ' + c.hint + '  (' + n + '자' +
    (c.mult > 1 ? ' · 도착 ' + Math.round((c.mult - 1) * 100) + '% 더 걸림' : '') + ')'
    : '🐦 참새가 기다리고 있어요';
  el.className = c.mult >= 1.4 ? 'heavy' : '';
  updateEta();
}
$('g-text').addEventListener('input', sparrowHint);
$('g-send').onclick = async () => {
  const text = $('g-text').value.trim();
  if (!text) { toast('보낼 문장을 적어주세요'); return; }
  const f = currentGiftFriend();
  if (!f) { toast('보낼 친구를 골라주세요'); return; }
  const vi2 = f.village ? vidx(f.village) : -1;
  const km = vi2 >= 0 ? kmBetween(place.vi, vi2) : 300, now = performance.now();
  const c = carrierFor(text.length), min = Math.round(flightMinutes(km) * c.mult);
  const book = letterMode ? null : activeBook.t;
  try {
    await Net.sendMail(f.code, book, text);
  } catch (e) { toast('보내지 못했어요 — ' + e.message); return; }
  flights.push({ toWho: f.who, book, text, sentAt: now,
                 arriveAt: now + demoMs(km) * c.mult, km, min, carrier: c });
  flyFx.push({ x: player.x, y: player.y - 4, t: 0, big: c.mult >= 1.4 });
  Audio8.play('wing'); closeOv();
  toast(c.emo + ' ' + c.name + '이(가) ' + f.who + '에게 떠났어요 · ' + fmtMin(min) + ' 걸립니다');
};

// ── 우체국 ────────────────────────────────────────────────────
//  책에 딸린 문장 말고, 그냥 편지도 부칠 수 있다.
let letterMode = false;
function openPost() {
  say('우체국', ['어서 오세요.', '편지를 부치실 수도 있고, 우편함을 확인하실 수도 있어요.'], [
    { label:'✉️ 편지 부치기', fn: () => {
        letterMode = true; giftFromMail = false;
        activeBook = { t:'편지', a:'', note:'' };
        openGift(activeBook);
      } },
    { label:'📮 내 우편함 열기', fn: () => openMail(0) },
    { label:'그냥 나가기' },
  ]);
  dialog.at = { x:SHOP_DESK.x + 35, y:SHOP_DESK.y - 20 }; placeBubble();
}

// ── 우편함 · 편지 ─────────────────────────────────────────────
function openMail(to, name) {
  if (to !== 0) {
    giftTo = to; giftFromMail = true;
    const mine = allBooks(ROOMS[0]);
    if (!mine.length) { toast('보낼 책이 없어요. 먼저 책장을 채워보세요'); return; }
    openGift(mine[0]); return;
  }
  Audio8.play('mail');
  const L = ROOMS[0].letters;
  $('mb-title').textContent = '내 우편함';
  $('mb-cap').textContent = L.length
    ? L.filter(x => !x.read).length + '통이 아직 안 읽은 편지예요' : '아직 아무 편지도 오지 않았어요';
  const list = $('mb-list'); list.innerHTML = '';
  if (!L.length) list.innerHTML = '<div class="none">새가 오면 여기에 쌓입니다</div>';
  L.forEach(x => {
    const el = document.createElement('button');
    el.className = 'mail' + (x.read ? '' : ' unread');
    el.innerHTML = '<div class="h"><b>' + x.from + '</b><span>' +
      (x.read ? (x.book ? '『' + x.book + '』' : '✉️ 편지') : '<span class="new">새 편지</span>') + '</span></div>' +
      '<div class="q">“' + x.text + '”</div>';
    el.onclick = () => { x.read = true; showLetter(x); };
    list.appendChild(el);
  });
  showOv('mail');
}
function showLetter(x) {
  $('l-from').textContent  = x.from + (x.book ? ' 이(가) 보낸 문장' : ' 이(가) 보낸 편지');
  $('l-book').textContent  = x.book ? '『' + x.book + '』 에서' : '';
  $('l-quote').textContent = '“' + x.text + '”';
  $('l-meta').textContent  = '— ' + x.from;
  showOv('letter');
}
function openLetter() {
  const L = room().letters.find(x => !x.read) || room().letters[0];
  if (!L) return; L.read = true; showLetter(L);
}
function openCard() {
  $('c-title').textContent = room().who + '의 대출카드';
  const ul = $('c-log'); ul.innerHTML = '';
  const v = room().visitors;
  if (!v.length) ul.innerHTML = '<li class="empty">아직 아무도 빌려가지 않았어요</li>';
  else v.slice(0, 8).forEach(x => {
    const li = document.createElement('li');
    li.innerHTML = '<span class="nm">' + x.n + '</span><span class="bk">' + x.b + '</span>';
    ul.appendChild(li);
  });
  showOv('card');
}
// 내가 여러 책에 남긴 쪽지를 한자리에 모아 보여준다 — 필사 노트처럼
function openJournal() {
  $('jn-text').value = ''; $('jn-verdict').className = 'verdict';
  renderJournal();
  showOv('journal');
  setTimeout(() => $('jn-text').focus(), 30);
}
function renderJournal() {
  ROOMS[0].freeNotes = ROOMS[0].freeNotes || [];
  const rows = ROOMS[0].freeNotes.slice().reverse().map(n => ({ text: n.text, book: null }));
  shelves(ROOMS[0]).forEach(s => s.books.forEach(bk => {
    (bk.memos || []).forEach(m => { if (m.who === '나') rows.push({ book: bk.t, text: m.text }); });
  }));
  const box = $('jn-list'); box.innerHTML = '';
  if (!rows.length) {
    box.innerHTML = '<div class="none">아직 남긴 문장이 없어요 — 위에 바로 적거나, 책을 펼쳐서 남겨보세요</div>';
  } else {
    rows.forEach(r => {
      const el = document.createElement('div');
      el.className = 'memo';
      el.innerHTML = r.text.replace(/</g, '&lt;') + (r.book ? '<span class="mw">— 『' + r.book + '』</span>' : '');
      box.appendChild(el);
    });
  }
}
let jnBusy = false;
$('jn-save').onclick = () => {
  if (jnBusy) return;
  const text = $('jn-text').value.trim(), v = $('jn-verdict');
  if (!text) { toast('적을 문장을 써주세요'); return; }
  jnBusy = true;
  checking(v);
  setTimeout(() => {
    jnBusy = false;
    const r = scan(text);
    verdict(v, r);
    if (r.ok) {
      (ROOMS[0].freeNotes = ROOMS[0].freeNotes || []).push({ text, at: Date.now() });
      $('jn-text').value = ''; syncRoom(); renderJournal();
      toast('✏️ 적어두었어요');
    }
  }, 900);
};
function openPoster(it) {
  const hold = $('ps-holder'); hold.innerHTML = '';
  if (it.src) { const img = new Image(); img.className = 'shot'; img.src = it.src; hold.appendChild(img); }
  else {
    const cv = document.createElement('canvas');
    cv.className = 'shot'; cv.width = it.art.w * 12; cv.height = it.art.h * 12;
    const g = cv.getContext('2d');
    for (let y = 0; y < it.art.h; y++) for (let x = 0; x < it.art.w; x++) {
      const c = it.art.px[y * it.art.w + x]; if (!c) continue;
      g.fillStyle = c; g.fillRect(x * 12, y * 12, 12, 12);
    }
    hold.appendChild(cv);
  }
  $('ps-title').textContent = it.title;
  $('ps-desc').textContent  = it.desc;
  showOv('poster');
}

// ── 검색 · 밑줄 · 전당 · 퀴즈 · 글판 ─────────────────────────
let kdcFilter = null;
const qEl = $('q'), resEl = $('results');
function openSearch() {
  showOv('search');
  const ch = $('chips'); ch.innerHTML = '';
  const all = document.createElement('button');
  all.className = 'chip' + (kdcFilter ? '' : ' on'); all.textContent = '전체';
  all.onclick = () => { kdcFilter = null; openSearch(); }; ch.appendChild(all);
  for (const [n, name] of KDC) {
    const el = document.createElement('button');
    el.className = 'chip' + (kdcFilter === n ? ' on' : '');
    el.textContent = n + ' ' + name;
    el.onclick = () => { kdcFilter = n; openSearch(); };
    ch.appendChild(el);
  }
  runSearch(); setTimeout(() => qEl.focus(), 30);
  renderRealBooks(); Books.refresh();
}
Books.onChange(() => { autoBindAllVillages(); if (openOv === 'search') renderRealBooks(); });
// 마을 도서관 이름은 지어낸 것이라 실제 기관과 우연히 같을 일이 거의 없다.
// 그래서 위치(성동·연수·춘천…)에 맞는 진짜 도서관을 전국에 자동으로 연결해준다 —
// 사람이 고를 필요 없이, 실제 데이터에 그 지역 이름의 기관이 있으면 바로 붙는다.
// 연결 정보는 서버에 다 같이 보이게 저장해서, 같은 실제 이름을 가진 마을은 똑같은 장서를 보게 된다.
let libBindings = {}, autoBinding = false;
async function loadLibBindings() {
  if (!Net.canConnect) return;
  try { libBindings = await Net.libBindings() || {}; if (openOv === 'search') renderRealBooks(); }
  catch (e) {}
}
async function autoBindAllVillages() {
  if (!Net.online || autoBinding || !Books.institutions(1).length) return;
  autoBinding = true;
  try {
    for (const v of VIL) {
      if (v.country !== 'kr' || libBindings[v.key]) continue;
      const m = Books.matchRegion(v.where);
      if (!m) continue;
      try { libBindings = await Net.setLibBind(v.key, m); } catch (e) {}
    }
  } finally { autoBinding = false; }
  if (openOv === 'search') renderRealBooks();
}
loadLibBindings().then(autoBindAllVillages);
Net.onChange(() => autoBindAllVillages());
Books.refresh();                                        // 검색창을 열기 전에도 미리 받아둔다

function renderRealBooks() {
  const cap = $('real-cap'), box = $('results-real'), v = vill();
  const bound = libBindings[v.key] || '';
  const hits = bound ? Books.forLibrary(bound) : [];
  box.innerHTML = '';
  if (bound) {
    cap.innerHTML = '“' + esc(bound) + '”과 연결됨 · ' +
      '<span class="src ' + Books.state + '">' + esc(Books.note) + '</span>' +
      (Net.online ? ' · <a href="#" id="real-unlink">연결 풀기</a>' : '');
    const un = document.getElementById('real-unlink');
    if (un) un.onclick = async e => {
      e.preventDefault();
      try { libBindings = await Net.setLibBind(v.key, ''); renderRealBooks(); } catch (err) { toast(err.message); }
    };
    if (!hits.length) { box.innerHTML = '<div class="none">이 이름의 실제 장서 기록이 아직 없어요</div>'; return; }
    hits.slice(0, 30).forEach(x => {
      const el = document.createElement('div');
      el.className = 'res';
      el.innerHTML = '<span><span class="t">' + esc(x.title) + '</span>' +
        '<span class="a">' + esc(x.author || '') + (x.pub ? ' · ' + esc(x.pub) : '') + '</span></span>' +
        (x.url ? '<a class="k" href="' + esc(x.url) + '" target="_blank" rel="noopener">보기</a>' : '');
      box.appendChild(el);
    });
    return;
  }
  const hint = Books.institutions(6);
  cap.innerHTML = '아직 실제 도서관과 연결 안 함 · ' + '<span class="src ' + Books.state + '">' + esc(Books.note) + '</span>';
  if (!Net.online) { box.innerHTML = '<div class="none">로그인하면 실제 도서관과 연결할 수 있어요</div>'; return; }
  if (!hint.length) { box.innerHTML = '<div class="none">받아온 실제 장서가 없어요</div>'; return; }
  box.innerHTML = '<div class="none">아래 실제 기관 중 하나를 골라 이 마을과 연결해보세요 — 같은 이름을 고른 다른 마을도 똑같은 장서를 보게 됩니다.</div>';
  hint.forEach(name => {
    const el = document.createElement('div');
    el.className = 'res';
    el.innerHTML = '<span class="t">' + esc(name) + '</span><span class="k">연결하기</span>';
    el.onclick = async () => {
      try { libBindings = await Net.setLibBind(v.key, name); renderRealBooks(); } catch (err) { toast(err.message); }
    };
    box.appendChild(el);
  });
}
qEl.addEventListener('input', runSearch);
function runSearch() {
  const q = qEl.value.trim().toLowerCase(), mine = owned();
  const hits = CATALOG.filter(x => (!kdcFilter || x.kdc === kdcFilter) &&
    (!q || x.t.toLowerCase().includes(q) || x.a.toLowerCase().includes(q)));
  resEl.innerHTML = '';
  if (!hits.length) { resEl.innerHTML = '<div class="none">찾는 책이 없어요</div>'; return; }
  for (const x of hits) {
    const have = mine.has(x.t);
    const el = document.createElement('button');
    el.className = 'res' + (have ? ' have' : '');
    el.innerHTML = '<span class="sp" style="background:' + x.col + '"></span>' +
      '<span><span class="t">' + x.t + '</span><span class="a">' + x.a + '</span></span>' +
      '<span class="k">' + (have ? '꽂혀 있음' : x.kdc + ' ' + kdcName(x.kdc)) + '</span>';
    if (!have) el.onclick = () => {
      addToMyShelf(Object.assign({}, x, { done:false }));
      Audio8.play('coin'); runSearch(); toast('『' + x.t + '』를 책장에 꽂았어요');
    };
    resEl.appendChild(el);
  }
}
function openStack(i) { kdcFilter = KDC[i][0]; qEl.value = ''; openSearch(); }

let linesBook = null;
function openLines(bk) {
  linesBook = bk;
  $('w-sp').style.background = bk.col;
  $('w-title').textContent  = bk.t;
  $('w-author').textContent = bk.a;
  renderWall(); $('u-text').value = ''; showOv('lines');
}
function renderWall() {
  const wall = $('w-wall');
  const list = (UNDERLINES[linesBook.t] || []).slice().sort((a, b) => b.v - a.v);
  wall.innerHTML = '';
  if (!list.length) { wall.innerHTML = '<div class="none">아직 아무도 밑줄을 긋지 않았어요<br>첫 문장을 남겨보세요</div>'; return; }
  list.forEach((u, i) => {
    const el = document.createElement('div');
    el.className = 'ul' + (i === 0 ? ' top1' : '');
    el.innerHTML = '<div class="q">“' + u.text + '”</div>' +
      '<div class="by"><b>' + u.who + (u.npc ? '<i class="npctag">안내</i>' : '') +
      '</b><span><button class="flag">🚩 신고</button>같이 그은 사람 ' + u.v + '명</span></div>';
    el.querySelector('.flag').onclick = ev => {
      ev.stopPropagation();
      openReport('밑줄', u.text, u.who, () => {
        const arr = UNDERLINES[linesBook.t];
        arr.splice(arr.indexOf(u), 1); renderWall();
      });
    };
    wall.appendChild(el);
  });
}
$('u-add').onclick = () => {
  if (!guard()) return;
  const t = $('u-text').value.trim();
  if (!t) { toast('문장을 적어주세요'); return; }
  const r = scan(t);
  if (!r.ok) { toast('✕ ' + r.tag + ' — ' + r.why); Audio8.play('wrong'); return; }
  (UNDERLINES[linesBook.t] = UNDERLINES[linesBook.t] || []).push({ who:'나', text:t, v:1 });
  $('u-text').value = ''; renderWall(); Audio8.play('pin'); toast('벽에 붙였어요');
};

let rankTab = 'loans';
document.querySelectorAll('#m-rank .tab').forEach(t => t.onclick = () => {
  rankTab = t.dataset.rank;
  document.querySelectorAll('#m-rank .tab').forEach(x => x.classList.toggle('on', x === t));
  renderRank();
});
function openRank() { $('rk-head').textContent = '이 달의 ' + vill().lib; renderRank(); showOv('rank'); }
function renderRank() {
  const me = { n:'나', loans: borrowed.size, explore: readKdc.size, bio:'이제 막 시작', me:true };
  const rows = NEIGHBORS.concat([me]).sort((a, b) => b[rankTab] - a[rankTab]);
  const list = $('rk-list'); list.innerHTML = '';
  rows.forEach((r, i) => {
    const el = document.createElement('div');
    el.className = 'rk' + (r.me ? ' me' : '') + (i === 0 ? ' gold' : '');
    el.innerHTML = '<span class="p">' + (i + 1) + '</span>' +
      '<span><span class="n">' + r.n + '</span><span class="sub2">' + r.bio + '</span></span>' +
      '<span class="v">' + r[rankTab] + '<small>' + (rankTab === 'loans' ? '권' : ' / 10칸') + '</small></span>';
    list.appendChild(el);
  });
  $('rk-note').innerHTML = rankTab === 'loans'
    ? '<b>권수 순위는 조심해서 써야 합니다.</b> 얇은 책만 골라 빠르게 읽는 쪽이 유리해져서, 많이 읽는 사람이 아니라 빨리 넘기는 사람이 1등이 되기 쉬워요.'
    : '<b>이쪽이 더 건강한 순위입니다.</b> 열 개 서가를 얼마나 넓게 다녔는지를 봅니다. 한 칸을 채우려면 안 가본 서가로 발이 가야 해서, 권수 경쟁이 아니라 탐험이 됩니다.';
}

const QUIZ_N = 5;
let quiz = null;
function makeQuestion() {
  const withLines = CATALOG.filter(x => UNDERLINES[x.t] && UNDERLINES[x.t].length);
  const kinds = ['author', 'kdc'];
  if (withLines.length >= 4) kinds.push('line');
  const kind = pickOne(kinds);
  if (kind === 'line') {
    const bk = pickOne(withLines), u = pickOne(UNDERLINES[bk.t]);
    const wrong = shuffle(CATALOG.filter(x => x.t !== bk.t)).slice(0, 3);
    return { q:'이 문장은 어느 책에서 나왔을까요?', quote:u.text, answer:bk.t,
             choices: shuffle([bk.t, ...wrong.map(x => x.t)]) };
  }
  const bk = pickOne(CATALOG);
  if (kind === 'author') {
    const wrong = shuffle(CATALOG.filter(x => x.a !== bk.a)).slice(0, 3);
    return { q:'『' + bk.t + '』를 쓴 사람은?', answer:bk.a, choices: shuffle([bk.a, ...wrong.map(x => x.a)]) };
  }
  const right = bk.kdc + ' ' + kdcName(bk.kdc);
  const wrong = shuffle(KDC.filter(k => k[0] !== bk.kdc)).slice(0, 3).map(k => k[0] + ' ' + k[1]);
  return { q:'『' + bk.t + '』는 어느 서가에 꽂혀 있을까요?', answer:right, choices: shuffle([right, ...wrong]) };
}
function openQuiz() {
  quiz = { i:0, score:0, qs: Array.from({ length: QUIZ_N }, makeQuestion),
           others:[{ n:'참가자1', s:0 }, { n:'참가자2', s:0 }, { n:'참가자3', s:0 }] };
  $('qz-title').textContent = vill().lib + ' 오늘의 퀴즈';
  renderQuiz(); showOv('quiz');
}
window.openQuiz = openQuiz;
function renderQuiz() {
  const body = $('qz-body');
  $('qz-players').innerHTML = '<span class="pl me">나 <b>' + quiz.score + '</b></span>' +
    quiz.others.map(o => '<span class="pl">' + o.n + ' <b>' + o.s + '</b></span>').join('');
  if (quiz.i >= QUIZ_N) {
    $('qz-prog').textContent = '끝';
    const all = quiz.others.concat([{ n:'나', s:quiz.score }]).sort((a, b) => b.s - a.s);
    body.innerHTML = '<div class="qend"><div class="big">' + quiz.score + ' / ' + QUIZ_N + '</div>' +
      '<div class="lbl">' + (all[0].n === '나' ? '오늘 이 자리 1등이에요' : all[0].n + '이(가) 1등이네요') +
      '</div></div><button class="btn" onclick="openQuiz()">한 판 더</button>';
    return;
  }
  const q = quiz.qs[quiz.i];
  $('qz-prog').textContent = (quiz.i + 1) + ' / ' + QUIZ_N;
  body.innerHTML = '<div class="qtext">' + (q.quote ? '<span class="quo">“' + q.quote + '”</span>' : '') +
    q.q + '</div><div class="choices">' + q.choices.map(c => '<button class="ch">' + c + '</button>').join('') + '</div>';
  body.querySelectorAll('.ch').forEach(btn => btn.onclick = () => {
    const right = btn.textContent === q.answer;
    body.querySelectorAll('.ch').forEach(x => {
      x.disabled = true;
      if (x.textContent === q.answer) x.classList.add('right');
      else if (x === btn) x.classList.add('wrong');
    });
    if (right) quiz.score++;
    Audio8.play(right ? 'right' : 'wrong');
    quiz.others.forEach(o => { if (Math.random() < .62) o.s++; });
    setTimeout(() => { quiz.i++; renderQuiz(); }, 950);
  });
}

function openBoard() {
  const list = $('bd-list'); list.innerHTML = '';
  POSTS.forEach(p => {
    const el = document.createElement('button');
    el.className = 'post';
    el.innerHTML = '<div class="pt">' + p.title + '</div>' +
      '<div class="pm"><span>' + p.who + (p.npc ? '<i class="npctag">안내</i>' : '') + '</span><span>' + p.when + '</span>' +
      '<span>공감 ' + p.likes + '</span>' +
      '<button class="flag">🚩 신고</button></div>' +
      '<div class="pp">' + p.body.split('\n')[0] + '</div>';
    el.querySelector('.flag').onclick = ev => {
      ev.stopPropagation();
      openReport('마을 글판', p.body.slice(0, 200), p.who, () => {
        POSTS.splice(POSTS.indexOf(p), 1);
      });
    };
    el.onclick = () => {
      Audio8.play('page');
      $('rd-title').textContent = p.title;
      $('rd-meta').textContent  = p.who + ' · ' + p.when + ' · 공감 ' + p.likes;
      $('rd-body').textContent  = p.body;
      showOv('read');
    };
    list.appendChild(el);
  });
  showOv('board');
}
$('bd-write').onclick = () => {
  if (!guard()) return;
  $('w-title-in').value = ''; $('w-body').value = ''; $('w-count').textContent = '0자';
  $('w-verdict').className = 'verdict';
  showOv('write'); setTimeout(() => $('w-title-in').focus(), 30);
};
$('w-body').addEventListener('input', e => { $('w-count').textContent = e.target.value.trim().length + '자'; });
// ════ 검열 · 신고 · 경고 ════════════════════════════════════
//  실제 서비스에서는 Claude API 가 판정한다. 여기서는 흐름만 흉내낸다.
//  글판 · 책 사이 쪽지 · 밑줄이 모두 같은 검사를 통과해야 한다.
const BLOCK = ['시발','씨발','병신','좆','ㅄ','ㅂㅅ','새끼','꺼져','죽어라','걸레',
               '한남','김치녀','틀딱','급식충','미친놈','미친년','쓰레기같','역겹'];
const MAX_WARN = 3;
const account = { warns: 0, suspended: false, log: [] };
const strikes = {};                                  // 다른 사람들의 누적 경고

function scan(text) {
  const t = (text || '');
  const w = BLOCK.find(x => t.includes(x));
  if (w) return { ok:false, tag:'비방·혐오', why:'남을 깎아내리는 표현이 들어 있어요.',
    how:'그 부분만 다듬어 주세요. 생각이 강한 것과 표현이 거친 것은 다릅니다.' };
  if (/(.)\1{5,}/.test(t)) return { ok:false, tag:'도배', why:'같은 글자가 계속 반복돼요.',
    how:'문장으로 풀어써 주세요.' };
  if (/https?:\/\//.test(t) && t.length < 300) return { ok:false, tag:'광고', why:'짧은 글에 링크가 들어 있어요.',
    how:'광고로 보일 수 있어요. 링크를 왜 붙이는지 설명해주세요.' };
  if (/(계좌|입금|송금|코인|투자문의|카톡\s*아이디)/.test(t)) return { ok:false, tag:'광고·사기',
    why:'금전 거래를 유도하는 표현이 있어요.', how:'이 서비스에서는 허용되지 않습니다.' };
  return { ok:true };
}
function moderate(title, body) {
  const s = scan(title + ' ' + body);
  if (!s.ok) return s;
  if (!title.trim()) return { ok:false, why:'제목이 비어 있어요.', how:'무엇에 대한 글인지 한 줄로 붙여주세요.' };
  if (body.trim().length < 200) return { ok:false, why:'글이 너무 짧아요 (' + body.trim().length + '자).',
    how:'짧은 감상은 책의 밑줄로 남기는 게 더 잘 어울려요. 글판은 200자 이상 긴 글의 자리예요.' };
  return { ok:true, why:'괜찮은 글이에요.', how:'비방이나 광고로 볼 만한 부분이 없고, 생각이 충분히 전개돼 있습니다.' };
}
// AI 가 읽는 연출
function checking(el, msg) {
  el.className = 'verdict show checking';
  el.innerHTML = '<b>AI가 읽는 중<span class="dots"><i></i><i></i><i></i></span></b>' +
    (msg || '비방 · 혐오 · 도배 · 광고를 살펴봅니다');
}
function verdict(el, r) {
  el.className = 'verdict show ' + (r.ok ? 'pass' : 'fail');
  el.innerHTML = '<b>' + (r.ok ? '✓ 통과' : '✕ 올릴 수 없어요' + (r.tag ? ' — ' + r.tag : '')) + '</b>' +
    (r.ok ? (r.how || '문제될 만한 표현이 없습니다.') : r.why + ' ' + r.how);
  Audio8.play(r.ok ? 'right' : 'wrong');
}
// 경고 누적
function warn(who, reason) {
  if (who === '나') {
    account.warns++;
    account.log.unshift(reason);
    renderAcct();
    if (account.warns >= MAX_WARN) suspend();
    else toast('⚠ 경고 ' + account.warns + '/' + MAX_WARN + ' — ' + reason);
  } else {
    strikes[who] = (strikes[who] || 0) + 1;
    toast('신고가 반영됐어요 · ' + who + ' 경고 ' + strikes[who] + '/' + MAX_WARN +
          (strikes[who] >= MAX_WARN ? ' · 이용 정지' : ''));
  }
}
function suspend() {
  account.suspended = true; renderAcct();
  $('sp-why').textContent = '경고가 ' + MAX_WARN + '회 쌓였습니다. 글쓰기 · 쪽지 · 밑줄이 잠깁니다.';
  $('sp-log').innerHTML = account.log.map((r, i) => '경고 ' + (account.log.length - i) + ' · ' + r).join('<br>');
  showOv('suspend');
}
$('sp-appeal').onclick = () => {
  account.suspended = false; account.warns = 0; account.log = [];
  renderAcct(); closeOv(); toast('이의 신청이 받아들여졌어요 · 경고가 지워졌습니다');
};
function renderAcct() {
  const el = $('acct');
  el.textContent = account.suspended ? '🚫 이용 정지' : '🛡 경고 ' + account.warns + ' / ' + MAX_WARN;
  el.className = 'pill more' + (account.suspended || account.warns >= 2 ? ' w2' : account.warns ? ' w1' : '');
}
$('acct').onclick = () => {
  if (account.suspended) { suspend(); return; }
  say('안전 안내', [
    '이 마을에 올라오는 글 · 쪽지 · 밑줄은 모두 AI가 먼저 읽습니다.',
    '누군가 신고하면 다시 검토해서, 위반이면 지우고 쓴 사람에게 경고를 줍니다.',
    '경고가 ' + MAX_WARN + '번 쌓이면 글쓰기가 잠깁니다. 지금 내 경고는 ' + account.warns + '번이에요.',
  ], [{ label:'알겠어요' }]);
};
function guard() {
  if (account.suspended) { suspend(); return false; }
  return true;
}

// 신고 흐름
const REASONS = ['비방 · 욕설', '혐오 표현', '광고 · 홍보', '도배 · 스팸', '책과 무관한 글', '기타'];
let reportCtx = null;
function openReport(kind, text, who, remove) {
  reportCtx = { kind, text, who, remove };
  $('rp-target').textContent = kind + ' · ' + who + '이(가) 쓴 글';
  $('rp-quote').textContent = text;
  $('rp-verdict').className = 'verdict';
  const box = $('rp-reasons'); box.innerHTML = '';
  REASONS.forEach(r => {
    const b2 = document.createElement('button');
    b2.textContent = r;
    b2.onclick = () => submitReport(r);
    box.appendChild(b2);
  });
  showOv('report');
}
function submitReport(reason) {
  const v = $('rp-verdict');
  $('rp-reasons').innerHTML = '';
  checking(v, '신고 사유 “' + reason + '” 로 다시 살펴봅니다');
  setTimeout(() => {
    const r = scan(reportCtx.text);
    if (!r.ok) {
      v.className = 'verdict show fail';
      v.innerHTML = '<b>✕ 위반 확인 — ' + r.tag + '</b>' + r.why +
        ' 해당 내용을 지우고 <b>' + reportCtx.who + '</b> 님에게 경고 1회를 부여했습니다.';
      Audio8.play('wrong');
      if (reportCtx.remove) reportCtx.remove();
      warn(reportCtx.who, reason);
    } else {
      v.className = 'verdict show pass';
      v.innerHTML = '<b>✓ 위반 아님</b>이 내용에서는 신고 사유에 해당하는 표현을 찾지 못했어요. ' +
        '신고해 주셔서 고맙습니다 — 기록은 남겨둡니다.';
      Audio8.play('right');
    }
  }, 1400);
}
$('w-submit').onclick = () => {
  const title = $('w-title-in').value, body = $('w-body').value, v = $('w-verdict');
  checking(v);
  setTimeout(() => {
    const r = moderate(title, body);
    verdict(v, r);
    if (r.ok) {
      blockedTries = 0;
      POSTS.unshift({ title: title.trim(), who:'나', when:'방금', likes:0, body: body.trim() });
      setTimeout(() => { openBoard(); toast('글판에 올렸어요'); }, 900);
    } else if (r.tag && ++blockedTries >= 3) {
      blockedTries = 0; warn('나', '검열에 걸리는 글을 반복해서 쓰려고 함');
    }
  }, 1300);
};

// ── 꾸미기 ────────────────────────────────────────────────────
const editbar = $('editbar');
function setEdit(on) {
  edit = on && isHome();
  editbar.classList.toggle('on', edit);
  view.classList.toggle('edit', edit);
  if (!edit) { drag = null; sel = null; }
  $('e-del').disabled = true;
}
$('e-done').onclick = () => setEdit(false);
// 방 색 — 벽 · 바닥 · 가구 · 러그를 직접 고른다
const ROOM_DEFAULT = { wall:ROOMS[0].wall, floor:ROOMS[0].floor, wood:ROOMS[0].wood, rug:ROOMS[0].rug };
[['col-wall','wall'], ['col-floor','floor'], ['col-wood','wood'], ['col-rug','rug']]
  .forEach(([id, key]) => {
    const el = $(id);
    el.value = ROOMS[0][key];
    el.addEventListener('input', e => { ROOMS[0][key] = e.target.value; });
  });
$('col-reset').onclick = () => {
  Object.assign(ROOMS[0], ROOM_DEFAULT);
  $('col-wall').value = ROOM_DEFAULT.wall; $('col-floor').value = ROOM_DEFAULT.floor;
  $('col-wood').value = ROOM_DEFAULT.wood; $('col-rug').value = ROOM_DEFAULT.rug;
  toast('방 색을 처음으로 되돌렸어요');
};
$('e-shelf').onclick = () => { ROOMS[0].items.push(shelf(120, 12, 52, 52, [])); layoutRoom(ROOMS[0]);
  Audio8.play('select'); toast('책장을 놓았어요 · 끌어서 자리를 잡으세요'); };
$('e-plant').onclick = () => { ROOMS[0].items.push(item({ kind:'plant', x:140, y:108, w:10, h:16 }));
  Audio8.play('select'); toast('화분을 놓았어요'); };
$('e-poster').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      ROOMS[0].items.push(poster(150, 12, Art.pixelateImage(img, 20, 26),
        f.name.replace(/\.[^.]+$/, ''), '올린 사진을 20×26 도트로 바꿨어요 · 원본이 뜹니다', rd.result));
      Audio8.play('pin'); toast('포스터를 붙였어요 · 끌어서 자리를 잡으세요');
    };
    img.src = rd.result;
  };
  rd.readAsDataURL(f); e.target.value = '';
};
$('e-del').onclick = () => {
  if (!sel) return;
  if (sel.kind === 'shelf' && sel.books.length) { toast('책이 꽂혀 있어요. 책을 먼저 빼주세요'); return; }
  ROOMS[0].items.splice(ROOMS[0].items.indexOf(sel), 1);
  sel = null; $('e-del').disabled = true; toast('치웠어요');
};
editbar.querySelectorAll('[data-sort]').forEach(btn => btn.onclick = () => {
  const s = btn.dataset.sort;
  for (const sh of shelves(ROOMS[0])) {
    if (s === 'color')  sh.books.sort((a, b) => hue(a.col) - hue(b.col));
    if (s === 'kdc')    sh.books.sort((a, b) => a.kdc.localeCompare(b.kdc) || a.t.localeCompare(b.t, 'ko'));
    if (s === 'title')  sh.books.sort((a, b) => a.t.localeCompare(b.t, 'ko'));
    if (s === 'height') sh.books.sort((a, b) => b.h - a.h);
  }
  layoutRoom(ROOMS[0]); Audio8.play('page'); toast(btn.textContent + '으로 정리했어요');
});
const toWorld = e => {
  const r = view.getBoundingClientRect(), ds = dispScale();
  return { x:(e.clientX - r.left) / (SCALE * ds) + camX, y:(e.clientY - r.top) / (SCALE * ds) + camY };
};
// 마우스로 끌 때 · 손가락으로 끌 때가 같은 자리를 짚게 — 하나로 합쳐서 쓴다
function editDragStart(p) {
  const R = ROOMS[0];
  for (const s of shelves(R)) for (const bk of s.books) {
    if (bk.bx === undefined) continue;
    if (p.x >= bk.bx - 1 && p.x <= bk.bx + bk.w + 1 && p.y >= bk.by - 2 && p.y <= bk.by + bk.h + 2) {
      drag = { what:'book', bk, s, x:p.x, y:p.y }; view.classList.add('dragging'); return;
    }
  }
  for (let i = R.items.length - 1; i >= 0; i--) {
    const it = R.items[i];
    if (p.x >= it.x - 2 && p.x <= it.x + it.w + 2 && p.y >= it.y - 2 && p.y <= it.y + it.h + 2) {
      sel = it; $('e-del').disabled = false;
      drag = { what:'item', it, dx:p.x - it.x, dy:p.y - it.y };
      view.classList.add('dragging'); return;
    }
  }
  sel = null; $('e-del').disabled = true;
}
function editDragMove(p) {
  if (!drag) return;
  if (drag.what === 'book') { drag.x = p.x; drag.y = p.y; return; }
  const it = drag.it;
  it.x = Math.round(Math.max(2, Math.min(ROOM_W - it.w - 2, p.x - drag.dx)));
  const onFloor = ['rug', 'plant'].includes(it.kind);
  it.y = Math.round(Math.max(onFloor ? RT : 2, Math.min(onFloor ? H - it.h - 4 : RT - it.h - 6, p.y - drag.dy)));
  if (it.kind === 'shelf') layoutShelf(it);
}
function editDragEnd() {
  if (drag && drag.what === 'book') {
    const R = ROOMS[0];
    let tgt = null, best = 1e9;
    for (const s of shelves(R)) {
      const cx = Math.max(s.x, Math.min(s.x + s.w, drag.x)), cy = Math.max(s.y, Math.min(s.y + s.h, drag.y));
      const d = Math.hypot(drag.x - cx, drag.y - cy);
      if (d < best) { best = d; tgt = s; }
    }
    if (tgt && best < 30) {
      drag.s.books.splice(drag.s.books.indexOf(drag.bk), 1);
      let to = tgt.books.length;
      for (let i = 0; i < tgt.books.length; i++) {
        const o = tgt.books[i]; if (o.bx === undefined) continue;
        if (Math.abs((o.by + o.h) - nearestBoard(tgt, drag.y)) < 3 && drag.x < o.bx + o.w / 2) { to = i; break; }
      }
      tgt.books.splice(to, 0, drag.bk);
      layoutRoom(R); renderStats(); Audio8.play('book');
    }
  }
  drag = null; view.classList.remove('dragging');
}
view.addEventListener('mousedown', e => { if (!edit || openOv) return; editDragStart(toWorld(e)); });
addEventListener('mousemove', e => editDragMove(toWorld(e)));
addEventListener('mouseup', editDragEnd);
// 손가락으로도 — 꾸미기 모드에서 물건을 짚고 옮기거나, 짚어서 고른 뒤 치우기 버튼을 누른다
const toWorldTouch = t => {
  const r = view.getBoundingClientRect(), ds = dispScale();
  return { x:(t.clientX - r.left) / (SCALE * ds) + camX, y:(t.clientY - r.top) / (SCALE * ds) + camY };
};
view.addEventListener('touchstart', e => {
  if (edit && !openOv && e.touches.length === 1) { editDragStart(toWorldTouch(e.touches[0])); e.preventDefault(); return; }
  if (skip.on && !skip.stone) { skipHeld = true; e.preventDefault(); }
}, { passive:false });
addEventListener('touchmove', e => {
  if (drag && e.touches.length === 1) { editDragMove(toWorldTouch(e.touches[0])); e.preventDefault(); }
}, { passive:false });
addEventListener('touchend', () => {
  if (skipHeld) { skipHeld = false; throwStone(); }
  if (drag) editDragEnd();
});
const nearestBoard = (s, y) => (s.boards || boardsOf(s)).reduce((a, b2) => Math.abs(b2 - y) < Math.abs(a - y) ? b2 : a);

// ── 화면 갱신 ─────────────────────────────────────────────────
function refreshUI() {
  setView(inTown());
  const v = vill();
  const t = inRide() ? RIDES[ride.mode].name + ' 안'
          : inJazz() ? '재즈바 한밤'
          : inShop() ? SHOPS[place.key].title + (place.key === 'cafe' && place.level === 2 ? ' · 루프탑' : '')
          : inTown() ? v.name : inLib() ? v.lib + (place.floor === 2 ? ' · 2층' : '') : inUsed() ? '헌책방'
          : isHome() ? '내 방' : room().who + '의 방';
  const s = inJazz() ? (Net.online
            ? '실시간 ' + ((jazz.live ? jazz.live.length : 0) + 1) + ' / ' + (jazz.cap || JAZZ_CAP_FALLBACK) + '명 · 🟢 이름표가 진짜 회원이에요'
            : '지금 ' + jazz.crowd + ' / ' + BAR_CAP + '명 · 혼자 모드 예시 손님입니다')
          : inShop() && place.key === 'cafe' && place.level === 2 ? '하늘 아래서 차 한 잔 · 마을이 내려다보여요'
          : inShop()  ? v.name + ' · ' + SHOPS[place.key].deskLabel
          : inRide() ? VIL[ride.to].name + ' 로 가는 중'
          : inTown() ? v.where + ' · ' + v.theme + ' · 회원 ' + v.members + '명'
          : inLib()  ? (place.floor === 2 ? '조용한 열람실 · 고서 서가가 있어요' : '장서 ' + v.books + ' · 서가 열 칸')
          : inUsed() ? v.name + ' · 흔적 있는 책 ' + (usedStock ? usedStock.trace.length : 0) + '권'
          : v.name + ' · ' + room().bio;
  $('p-who').textContent = t; $('p-bio').textContent = s;
  $('btn-out').innerHTML = inTown() ? '🗺 어디로 갈까<span class="kbd"> (M)</span>' : '🚪 밖으로 나가기<span class="kbd"> (Q)</span>';
  $('btn-edit').style.display = isHome() ? 'inline-block' : 'none';
  $('jazzchat').classList.toggle('on', inJazz() && Net.online);
  buildLabels(); renderStats();
}
function renderDex() {
  const dexEl = $('dex');
  dexEl.querySelectorAll('.cell').forEach(n => n.remove());
  for (const [n, name] of KDC) {
    const d = document.createElement('div');
    d.className = 'cell' + (readKdc.has(n) ? ' on' : '');
    d.innerHTML = '<b>' + n[0] + '</b>' + name;
    dexEl.appendChild(d);
  }
}
function renderStats() {
  $('s-books').textContent  = allBooks(ROOMS[0]).length;
  $('s-borrow').textContent = borrowed.size;
  syncRoom();                       // 방이 바뀌면 조용히 서버에 올린다
}
function renderFlights(now) {
  const el = $('flights'); el.innerHTML = '';
  for (const f of flights) {
    const p = Math.min(1, (now - f.sentAt) / (f.arriveAt - f.sentAt));
    const d = document.createElement('div'); d.className = 'flight';
    d.innerHTML = (f.carrier ? f.carrier.emo : '🕊') + ' <span class="to">' + esc(f.toWho) + '</span>' +
      '<span class="bar"><i style="width:' + (p * 100).toFixed(0) + '%"></i></span>' +
      '<span class="eta">' + fmtMin(Math.max(0, Math.round(f.min * (1 - p)))) + ' 남음</span>';
    el.appendChild(d);
  }
}
let toastT;
function toast(m) {
  const el = $('toast'); el.textContent = m; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600);
}

// 건물·서가 이름표 — 캔버스가 아니라 HTML 로 얹어야 한글이 읽힌다
let LABELS = [];
function buildLabels() {
  LABELS = [];
  if (inTown()) {
    const v = vill();
    LABELS.push({ t: v.lib, x: BLD.lib.x + BLD.lib.w / 2, y: BLD.lib.y - 4, c:'big' });
    LABELS.push({ t:'헌책방', x: BLD.used.x + BLD.used.w / 2, y: BLD.used.y - 4 });
    LABELS.push({ t:'우체국', x: BLD.post.x + BLD.post.w / 2, y: BLD.post.y - 4 });
    LABELS.push({ t:'기차역', x: BLD.train.x + BLD.train.w / 2, y: BLD.train.y - 4 });
    LABELS.push({ t:'공항', x: BLD.air.x + BLD.air.w / 2, y: BLD.air.y - 4 });
    LABELS.push({ t:'버스정류장', x: BUS.x + BUS.w / 2, y: BUS.y - 22 });
    LABELS.push({ t: v.lmName, x: LM.x, y: LM.y - 74, c:'soft' });
    town().houses.forEach(h => LABELS.push({ t: h.name, x: h.x + h.w / 2, y: h.y - 18, c: h.to === 0 ? 'mine' : '' }));
  } else if (inLib() && place.floor === 2) {
    LABELS.push({ t:'1층으로', x: LIB_STAIRS.x + LIB_STAIRS.w / 2, y: LIB_STAIRS.y - 4 });
    LABELS.push({ t:'고서 서가', x: LIB2_RARE.x + LIB2_RARE.w / 2, y: LIB2_RARE.y - 4, c:'shelf' });
    LABELS.push({ t:'열람실', x: LIB2_NOOK[0].x, y: 78, c:'soft' });
  } else if (inLib()) {
    for (let i = 0; i < 10; i++)
      LABELS.push({ t: KDC[i][1], x: stackX(i) + STACK_W / 2, y: 72, c:'shelf' });
    LABELS.push({ t:'안내 데스크', x: LIB_DESK.x + 26, y: 20 });
    LABELS.push({ t:'명예의 전당', x: LIB_RANK.x + 28, y: 12 });
    LABELS.push({ t:'마을 글판', x: LIB_BOARD.x + 32, y: 10 });
    LABELS.push({ t:'신문대', x: LIB_NEWS.x + 32, y: 84 });
    LABELS.push({ t:'퀴즈 자리', x: LIB_QUIZ.x + 28, y: 88 });
    LABELS.push({ t:'2층으로', x: LIB_STAIRS.x + LIB_STAIRS.w / 2, y: LIB_STAIRS.y - 4 });
  } else if (inUsed()) {
    LABELS.push({ t:'흔적 있는 책', x: USED_TRACE.x + 59, y: USED_TRACE.y + 68, c:'shelf' });
    LABELS.push({ t:'균일가', x: USED_FLAT.x + 54, y: USED_FLAT.y + 64, c:'shelf' });
    LABELS.push({ t:'계산대', x: USED_DESK.x + 34, y: USED_DESK.y - 26 });
    STALLS.forEach(s => LABELS.push({ t: s.name, x: s.x + s.w / 2, y: s.y - 34 }));
    LABELS.push({ t:'교환대', x: USED_SWAP.x + 26, y: USED_SWAP.y - 30 });
  } else if (inJazz()) {
    // 실시간으로 와 있는 진짜 회원만 이름표를 띄운다 — 나머지 손님은 배경 손님이다.
    // 최근 6초 안에 뭔가 말했으면 이름 옆에 그대로 보여준다 (실시간 채팅).
    (jazz.live || []).forEach(p => LABELS.push({
      t: '🟢 ' + p.who + (p.say ? ' : ' + p.say : ''), x: p.x + 5, y: p.y - 16, c:'mine' }));
    if (myChat && Date.now() - myChat.at < 6000)
      LABELS.push({ t: '💬 ' + myChat.text, x: player.x + 5, y: player.y - 16, c:'mine' });
  } else if (inShop() && place.key === 'cafe' && place.level === 2) {
    LABELS.push({ t:'안으로', x: SHOP_STAIRS.x + SHOP_STAIRS.w / 2, y: SHOP_STAIRS.y - 4 });
  } else if (inShop()) {
    LABELS.push({ t: SHOPS[place.key].deskLabel, x: SHOP_DESK.x + 35, y: SHOP_DESK.y - 26 });
    if (place.key === 'cafe') LABELS.push({ t:'루프탑으로', x: SHOP_STAIRS.x + SHOP_STAIRS.w / 2, y: SHOP_STAIRS.y - 4 });
  }
  const box = $('labels');
  box.innerHTML = LABELS.map((l, i) =>
    '<span class="lab ' + (l.c || '') + '" data-i="' + i + '">' + l.t + '</span>').join('');
}
function placeLabels() {
  const box = $('labels'), rect = view.getBoundingClientRect(), ds = dispScale();
  box.querySelectorAll('.lab').forEach(el => {
    const l = LABELS[+el.dataset.i];
    const sx = (l.x - camX) * SCALE * ds, sy = (l.y - camY) * SCALE * ds;
    const vis = sx > -60 && sx < rect.width + 60 && sy > -20 && sy < rect.height + 20;
    el.style.display = vis ? 'block' : 'none';
    el.style.left = sx + 'px'; el.style.top = sy + 'px';
  });
}
// 미니맵
const mini = $('mini'), mg = mini.getContext('2d');
function drawMini() {
  if (!inTown()) { mini.style.display = 'none'; return; }
  mini.style.display = 'block';
  const s = mini.width / TOWN.w;
  mg.clearRect(0, 0, mini.width, mini.height);
  mg.imageSmoothingEnabled = false;
  if (townBg) mg.drawImage(townBg, 0, 0, mini.width, mini.height);
  Object.values(BLD).forEach(b => {
    mg.fillStyle = b.roof; mg.fillRect(b.x * s, b.y * s, b.w * s, b.h * s);
  });
  town().houses.forEach(h => { mg.fillStyle = h.roof; mg.fillRect(h.x * s, h.y * s, h.w * s, h.h * s); });
  mg.fillStyle = '#6EB0D4'; mg.fillRect(POND.x * s, POND.y * s, POND.w * s, POND.h * s);
  mg.fillStyle = '#E8C46A'; mg.fillRect(BUS.x * s, BUS.y * s, BUS.w * s, BUS.h * s);
  npcs.forEach(n => { mg.fillStyle = 'rgba(60,45,30,.5)'; mg.fillRect(n.x * s - 1, n.y * s - 1, 3, 3); });
  mg.fillStyle = '#B8823A';
  mg.fillRect(player.x * s - 2, player.y * s - 2, 5, 5);
  mg.strokeStyle = 'rgba(255,255,255,.9)'; mg.lineWidth = 1;
  mg.strokeRect(camX * s, camY * s, VW * s, VH * s);
}

// 소리 조절판
$('music').onclick = () => {
  const on = Audio8.toggleMusic();
  $('music').classList.toggle('on', on);
  $('music').textContent = on ? '♪ ' + Audio8.tracks[Audio8.trackIdx].name : '♪ 음악 켜기';
  $('musicbox').classList.toggle('on', on);
  buildTrackList();
};
$('sfx').onclick = () => {
  const on = Audio8.toggleSfx();
  $('sfx').classList.toggle('on', on);
  $('sfx').textContent = on ? '🔊 효과음 켬' : '🔇 효과음 끔';
};
function buildTrackList() {
  const box = $('tracklist'); box.innerHTML = '';
  Audio8.tracks.forEach((tr, i) => {
    const el = document.createElement('button');
    el.className = 'trk' + (i === Audio8.trackIdx ? ' on' : '');
    el.innerHTML = '<b>' + tr.name + '</b><span>' + tr.desc + '</span>';
    el.onclick = () => {
      Audio8.setTrack(i); buildTrackList();
      $('music').textContent = '♪ ' + tr.name;
      toast('♪ ' + tr.name);
    };
    box.appendChild(el);
  });
}
$('vol').addEventListener('input', e => Audio8.setVolume(e.target.value / 100));
$('btn-out').onclick = () => { Audio8.wake(); inTown() ? openMenu() : goOut(); };
$('btn-edit').onclick = () => { Audio8.wake(); setEdit(!edit); };
$('btn-search').onclick = () => { Audio8.wake(); openSearch(); };
$('btn-menu').onclick = () => { Audio8.wake(); openMenu(); };
$('tools-more').onclick = function () {
  const on = $('tools').classList.toggle('more-open');
  this.textContent = on ? '⋯ 접기' : '⋯ 더보기';
};
$('hudBtn').onclick = function () {
  const on = document.getElementById('stage').classList.toggle('lean');
  this.classList.toggle('on', !on);
  this.textContent = on ? '🕰 상단 표시 끔' : '🕰 상단 표시 켬';
};
$('soloBtn').onclick = function () {
  solo = !solo;
  this.classList.toggle('on', solo);
  this.textContent = solo ? '🙈 혼자 보기' : '👥 다른 사람 보임';
  toast(solo ? '다른 사람들을 화면에서 지웠어요' : '다시 사람들이 보입니다');
};

// ════ 그리기 ═══════════════════════════════════════════════════
const GLOW = 'rgba(255,214,120,.34)';
function arrow(x, y, t) {
  const bob = Math.sin(t / 180) > 0 ? 0 : 1;
  px(x, y - bob, 3, 2, '#FFD98A'); px(x + 1, y + 2 - bob, 1, 2, '#FFD98A');
  px(x, y + 4 - bob, 3, 1, '#8A6A2A');
}
function selBox(it) {
  ctx.fillStyle = 'rgba(122,95,168,.6)';
  const x = it.x - 2, y = it.y - 2, w = it.w + 4, h = it.h + 4;
  for (let i = 0; i < w; i += 2) { ctx.fillRect(x + i, y, 1, 1); ctx.fillRect(x + i, y + h - 1, 1, 1); }
  for (let i = 0; i < h; i += 2) { ctx.fillRect(x, y + i, 1, 1); ctx.fillRect(x + w - 1, y + i, 1, 1); }
}
const isF = (type, key, val) => focus && focus.type === type && (key === undefined || focus[key] === val);

// ── 건물 ──────────────────────────────────────────────────────
//  같은 상자를 색만 바꿔 찍으면 공장처럼 보인다.
//  지붕 모양 · 창 모양 · 문 모양을 종류마다 다르게 그린다.
const lit = () => WEATHER.night || WEATHER.key === 'storm' ? '#FFE9A8'
                : WEATHER.sun > .2 ? '#CFE6F2' : '#E2ECF2';       // 창에 비치는 것

function roofGable(b, h) {                                        // 박공 — 삼각 지붕
  const dark = shade(b.roof, .8), lite = shade(b.roof, 1.14);
  for (let i = 0; i < h; i++) {
    const w = Math.round(b.w + 12 - (i / h) * (b.w + 4));
    px(b.x + (b.w - w) / 2, b.y - i, w, 1, i % 3 === 0 ? dark : b.roof);
  }
  px(b.x - 6, b.y, b.w + 12, 3, dark);                            // 처마
  px(b.x + b.w / 2 - 1, b.y - h, 2, 3, lite);                     // 용마루
}
function roofHip(b, h) {                                          // 모임지붕 — 사다리꼴
  const dark = shade(b.roof, .8);
  for (let i = 0; i < h; i++) {
    const w = Math.round(b.w + 10 - (i / h) * (b.w * .5));
    px(b.x + (b.w - w) / 2, b.y - i, w, 1, i % 3 === 0 ? dark : b.roof);
  }
  px(b.x - 5, b.y, b.w + 10, 3, dark);
}
function chimney(x, y, c) {
  px(x, y - 12, 7, 13, c); px(x - 1, y - 14, 9, 3, shade(c, 1.15));
}
function windowRow(b, y, hgt, gap, style) {
  for (let x = b.x + 9; x < b.x + b.w - 12; x += gap) {
    px(x, y, 12, hgt, '#6E5236');
    px(x + 1, y + 1, 10, hgt - 2, lit());
    if (style === 'arch') { px(x + 1, y, 10, 1, '#6E5236'); px(x + 2, y - 1, 8, 1, '#6E5236');
                            px(x + 4, y - 2, 4, 1, '#6E5236'); }
    if (style === 'cross') { px(x + 5, y + 1, 2, hgt - 2, '#6E5236');
                             px(x + 1, y + hgt / 2 - 1, 10, 2, '#6E5236'); }
  }
}
function frontDoor(b, on, t, kind) {
  const d = doorOf(b), h = kind === 'grand' ? 30 : 22;
  px(d.x - 2, d.y - h - 2, d.w + 4, h + 4, shade(b.roof, .7));     // 문틀
  px(d.x, d.y - h, d.w, h + 2, '#A87A4E');
  px(d.x + d.w / 2 - 1, d.y - h, 2, h + 2, '#8A6440');
  if (kind === 'grand') {                                          // 아치 문
    px(d.x + 1, d.y - h - 2, d.w - 2, 2, '#A87A4E');
    px(d.x + 3, d.y - h - 4, d.w - 6, 2, '#A87A4E');
  }
  px(d.x + 3, d.y - 9, 2, 2, '#E8C46A');
  px(d.x + d.w - 5, d.y - 9, 2, 2, '#E8C46A');
  if (on) arrow(d.x + d.w / 2 - 1, b.y - (kind === 'grand' ? 44 : 30), t);
}

function building(b, t, on) {
  const S = b.shape || 'gable';
  if (on) { ctx.fillStyle = GLOW; ctx.fillRect(b.x - 10, b.y - 44, b.w + 20, b.h + 54); }

  if (S === 'dome') {
    // 도서관 — 계단 · 기둥 · 페디먼트 · 돔
    const cy = b.y + 10;
    px(b.x + 2, cy, b.w - 4, b.h - 10, b.wall);                    // 본채
    px(b.x + 2, cy, b.w - 4, 2, shade(b.wall, 1.1));
    const mid = b.x + b.w / 2;
    for (let i = 0; i < 22; i++) {                                 // 돔
      const w = Math.round(Math.sqrt(Math.max(0, 22 * 22 - (22 - i) * (22 - i))) * 1.7);
      px(mid - w / 2, b.y - 34 + i, w, 1, i < 5 ? shade(b.roof, 1.2) : b.roof);
    }
    px(mid - 1, b.y - 42, 2, 8, '#C8C0B0'); px(mid - 3, b.y - 44, 6, 3, '#E8C46A');
    px(mid - 26, b.y - 12, 52, 4, shade(b.roof, .8));
    for (let i = 0; i < 13; i++)                                   // 페디먼트
      px(mid - 26 + i * 2, b.y - 12 - i, 52 - i * 4, 2, shade(b.roof, .9));
    for (let i = 0; i < 6; i++) {                                  // 기둥
      const x = b.x + 12 + i * ((b.w - 32) / 5);
      px(x, cy + 6, 7, b.h - 24, '#E4DED0');
      px(x, cy + 6, 2, b.h - 24, '#F4EFE4');
      px(x - 2, cy + 4, 11, 3, '#D8D0C0'); px(x - 2, cy + b.h - 20, 11, 3, '#D8D0C0');
    }
    windowRow(b, cy + 12, 14, 34, 'arch');
    for (let i = 0; i < 4; i++)                                    // 계단
      px(b.x + 14 + i * 2, b.y + b.h - 6 + i * 2, b.w - 28 - i * 4, 2, '#D4CCBC');
    px(mid - 30, b.y + 6, 60, 12, '#5A6470');                      // 현판
    ctx.fillStyle = '#FFE08A';
    for (let i = 0; i < 7; i++) ctx.fillRect(mid - 25 + i * 7, b.y + 10, 4, 5);
    frontDoor(b, on, t, 'grand');
    return;
  }

  if (S === 'tower') {
    // 우체국 — 옆에 시계탑
    px(b.x + 2, b.y, b.w - 4, b.h, b.wall);
    roofHip({ x:b.x + 2, y:b.y, w:b.w - 4, roof:b.roof }, 13);
    windowRow(b, b.y + 18, 13, 24, 'cross');
    const tx = b.x + b.w - 20;
    px(tx, b.y - 40, 18, 44, shade(b.wall, .95));
    px(tx, b.y - 40, 18, 2, shade(b.wall, 1.1));
    for (let i = 0; i < 10; i++) px(tx - 3 + i, b.y - 50 + i, 24 - i * 2, 1, b.roof);
    px(tx + 3, b.y - 34, 12, 12, '#F4EFE4');                       // 시계
    px(tx + 8, b.y - 32, 2, 6, '#4A4238'); px(tx + 9, b.y - 29, 5, 2, '#4A4238');
    px(b.x + 6, b.y + b.h - 22, 12, 16, '#C4645C');                // 빨간 우체통
    px(b.x + 6, b.y + b.h - 24, 12, 3, '#D9756D');
    px(b.x + 9, b.y + b.h - 18, 6, 2, '#4A3F32');
    frontDoor(b, on, t);
    return;
  }

  if (S === 'shed') {
    // 가구점 — 낮은 지붕에 줄무늬 차양과 큰 쇼윈도
    px(b.x + 2, b.y + 6, b.w - 4, b.h - 6, b.wall);
    px(b.x - 4, b.y, b.w + 8, 9, shade(b.roof, .85));
    px(b.x - 4, b.y, b.w + 8, 3, b.roof);
    px(b.x + 8, b.y + 20, b.w - 40, 22, '#6E5236');                // 쇼윈도
    px(b.x + 10, b.y + 22, b.w - 44, 18, lit());
    px(b.x + 22, b.y + 26, 10, 12, '#A87A4E');                     // 안에 놓인 가구
    px(b.x + 36, b.y + 30, 14, 8, '#8A7A5E');
    for (let i = 0; i < (b.w - 16) / 8; i++)                       // 차양
      px(b.x + 6 + i * 8, b.y + 12, 8, 6, i % 2 ? '#F4EFE4' : '#C48A5E');
    px(b.x + 6, b.y + 18, b.w - 12, 2, '#8A7A5E');
    frontDoor(b, on, t);
    return;
  }

  if (S === 'bar') {
    // 재즈바 — 낮은 벽돌집에 차양과 네온 간판, 창으로 새어나오는 불빛
    px(b.x + 2, b.y + 6, b.w - 4, b.h - 6, b.wall);
    ctx.fillStyle = shade(b.wall, .88);                          // 벽돌
    for (let y = b.y + 10; y < b.y + b.h - 6; y += 5)
      for (let x = b.x + 3; x < b.x + b.w - 5; x += 11)
        ctx.fillRect(x + ((y / 5) % 2) * 5, y, 9, 3);
    px(b.x - 4, b.y - 2, b.w + 8, 10, shade(b.roof, .9));
    px(b.x - 4, b.y - 2, b.w + 8, 3, b.roof);
    for (let i = 0; i < (b.w + 8) / 9; i++)                      // 차양
      px(b.x - 3 + i * 9, b.y + 8, 9, 6, i % 2 ? '#EFE4D8' : '#8A4458');
    px(b.x - 3, b.y + 14, b.w + 6, 2, '#5A3A4A');
    px(b.x + 10, b.y + 22, b.w - 44, 20, '#2E2638');             // 큰 창
    px(b.x + 12, b.y + 24, b.w - 48, 16, '#E8A85A');             // 새어나오는 불빛
    px(b.x + 18, b.y + 28, 5, 9, '#3A2F3E'); px(b.x + 30, b.y + 30, 5, 7, '#3A2F3E');
    const neon = Math.sin(Date.now() / 700) > -.6;
    px(b.x + b.w - 30, b.y + 20, 26, 12, '#2A2233');             // 네온 간판
    ctx.fillStyle = neon ? '#F26E9A' : '#7A4458';
    for (let i = 0; i < 3; i++) ctx.fillRect(b.x + b.w - 26 + i * 7, b.y + 24, 4, 5);
    if (neon) { ctx.fillStyle = 'rgba(242,110,154,.14)';
                ctx.fillRect(b.x + b.w - 40, b.y + 12, 46, 28); }
    frontDoor(b, on, t);
    return;
  }

  if (S === 'flat') {
    // 기차역 — 평지붕에 통유리
    px(b.x, b.y + 4, b.w, b.h - 4, b.wall);
    px(b.x - 4, b.y - 6, b.w + 8, 11, shade(b.roof, .86));
    px(b.x - 4, b.y - 6, b.w + 8, 3, b.roof);
    px(b.x + 8, b.y + 16, b.w - 16, 26, '#6E7A86');                // 통유리
    for (let i = 0; i < (b.w - 16) / 14; i++)
      px(b.x + 10 + i * 14, b.y + 18, 11, 22, lit());
    px(b.x + 8, b.y + 44, b.w - 16, 2, shade(b.wall, .8));
    px(b.x + b.w / 2 - 22, b.y - 2, 44, 9, '#3A4450');             // 간판
    ctx.fillStyle = '#FFE08A';
    for (let i = 0; i < 5; i++) ctx.fillRect(b.x + b.w / 2 - 17 + i * 7, b.y + 1, 4, 4);
    frontDoor(b, on, t);
    return;
  }

  if (S === 'airport') {
    // 공항 — 관제탑, 활주로 + 주기된 비행기, 넓은 유리 터미널
    px(b.x, b.y + 8, b.w, b.h - 8, b.wall);
    px(b.x - 6, b.y - 2, b.w + 12, 12, shade(b.roof, .86));         // 완만한 지붕
    px(b.x - 6, b.y - 2, b.w + 12, 3, b.roof);
    px(b.x + 6, b.y + 20, b.w - 60, 24, '#6E8696');                 // 통유리 터미널 (오른쪽은 비행기 자리로 비워둠)
    for (let i = 0; i < (b.w - 60) / 12; i++)
      px(b.x + 8 + i * 12, b.y + 22, 9, 20, lit());
    px(b.x + 6, b.y + 46, b.w - 12, 2, shade(b.wall, .8));
    const tx = b.x + 16;                                            // 관제탑 — 비행기와 안 겹치게 왼쪽에
    px(tx, b.y - 56, 20, 60, shade(b.wall, .92));
    px(tx - 3, b.y - 60, 26, 6, '#4A5866');
    px(tx + 2, b.y - 54, 16, 12, '#8FC4E0');
    px(tx + 8, b.y - 72, 3, 18, '#B0B8C0'); px(tx + 6, b.y - 75, 7, 4, '#D4645C');
    px(b.x - 4, b.y + b.h - 10, b.w + 46, 6, '#7A8088');            // 활주로
    for (let i = 0; i < (b.w + 46) / 12; i++) px(b.x - 2 + i * 12, b.y + b.h - 8, 6, 2, '#F0EAD8');
    // 주기장 비행기 — 몸통 · 날개 · 꼬리날개가 다 있어야 비행기로 읽힌다
    const ax = b.x + b.w - 50, ay = b.y + b.h - 30;
    px(ax - 8, ay + 3, 66, 11, '#EFEFEA');                          // 동체
    px(ax + 54, ay + 4, 10, 9, '#DCDCD4');                          // 뭉툭한 기수
    px(ax - 8, ay + 4, 3, 8, '#C8C8C0');                            // 꼬리 쪽 좁아짐
    px(ax + 40, ay - 15, 5, 16, '#E4E4DC'); px(ax + 40, ay - 16, 13, 4, '#E4E4DC'); // 수직꼬리
    px(ax + 8, ay + 12, 30, 4, '#C4C4BC');                          // 주날개(그림자처럼 아래로)
    px(ax - 2, ay + 6, 3, 5, '#5A7AA8');                            // 조종석 창
    px(ax + 6, ay + 6, 34, 3, '#4A6EB0');                           // 창문 줄
    if (Math.sin(t / 500) > 0) px(ax + 46, ay + 7, 2, 2, '#E8C46A');// 깜빡이는 항법등
    px(b.x + b.w / 2 - 20, b.y + 4, 40, 9, '#3A4450');              // 간판
    ctx.fillStyle = '#FFE08A';
    for (let i = 0; i < 4; i++) ctx.fillRect(b.x + b.w / 2 - 15 + i * 8, b.y + 7, 5, 4);
    frontDoor(b, on, t);
    return;
  }

  if (S === 'greenhouse') {
    // 꽃집 — 유리 온실 지붕과 화단
    px(b.x + 2, b.y + 14, b.w - 4, b.h - 14, b.wall);
    for (let i = 0; i < 14; i++) {                                  // 삼각 유리 지붕
      const w = Math.round(b.w - (i / 14) * b.w * .7);
      px(b.x + (b.w - w) / 2, b.y - i, w, 1, i % 3 === 0 ? shade(b.roof, 1.3) : '#BFE4EA');
    }
    px(b.x - 2, b.y + 12, b.w + 4, 3, b.roof);
    px(b.x + 6, b.y + 20, b.w - 12, 18, '#DCEEE0');                 // 큰 창
    px(b.x + 8, b.y + 22, b.w - 16, 14, '#BFE4EA');
    for (let i = 0; i < (b.w - 16) / 9; i++) {                      // 화단 상자
      const fx = b.x + 6 + i * 9;
      px(fx, b.y + b.h - 12, 7, 8, '#8A6A44');
      px(fx + 1, b.y + b.h - 16, 5, 5, ['#D4645C', '#E8B45A', '#8A7AAE'][i % 3]);
    }
    frontDoor(b, on, t);
    return;
  }

  // gable — 박공지붕 집·가게
  px(b.x + 2, b.y + 4, b.w - 4, b.h - 4, b.wall);
  px(b.x + 2, b.y + 4, b.w - 4, 2, shade(b.wall, 1.1));
  px(b.x + 2, b.y + b.h - 4, b.w - 4, 4, shade(b.wall, .84));
  roofGable(b, Math.max(14, Math.round(b.w * .28)));
  chimney(b.x + b.w - 22, b.y - 6, shade(b.roof, .72));
  windowRow(b, b.y + 18, 12, 24, 'cross');
  frontDoor(b, on, t);
}

// 집 — 건물보다 작고 아기자기하게
function drawHouse(h, t, on) {
  if (on) { ctx.fillStyle = GLOW; ctx.fillRect(h.x - 8, h.y - 34, h.w + 16, h.h + 44); }
  px(h.x + 2, h.y + 4, h.w - 4, h.h - 4, h.wall);
  px(h.x + 2, h.y + 4, h.w - 4, 2, shade(h.wall, 1.12));
  px(h.x + 2, h.y + h.h - 4, h.w - 4, 4, shade(h.wall, .82));
  roofGable({ x:h.x, y:h.y + 4, w:h.w, roof:h.roof }, 16);
  chimney(h.x + h.w - 16, h.y - 4, shade(h.roof, .74));
  px(h.x + 7, h.y + 18, 11, 10, '#6E5236');                        // 창 하나
  px(h.x + 8, h.y + 19, 9, 8, lit());
  px(h.x + 12, h.y + 19, 1, 8, '#6E5236');
  const d = doorOf(h);
  px(d.x - 1, d.y - 19, d.w + 2, 20, '#7A5A38');
  px(d.x, d.y - 18, d.w, 19, '#A87A4E');
  px(d.x + d.w - 5, d.y - 8, 2, 2, '#E8C46A');
  px(h.x + h.w / 2 - 11, h.y - 20, 22, 7, '#FBF3E2');              // 문패
  ctx.fillStyle = shade(h.roof, .7);
  for (let i = 0; i < Math.min(3, h.name.length); i++) ctx.fillRect(h.x + h.w / 2 - 8 + i * 5, h.y - 18, 3, 3);
  if (on) arrow(h.x + h.w / 2 - 1, h.y - 26, t);
}
// ── 마을 바탕 — 한 번 그려서 캐시한다 ────────────────────────
let townBg = null, townBgKey = '';
function pathStroke(g, pts, w, col) {
  g.fillStyle = col;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
    for (let k = 0; k <= n; k++) {
      const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
      g.fillRect(Math.round(x - w / 2), Math.round(y - w / 2), w, w);
    }
  }
}
function buildTownBg() {
  const v = vill();
  const key = v.key + SEASON.key + SEASON.peak;
  if (townBg && townBgKey === key) return;
  townBgKey = key;
  const cv = document.createElement('canvas'); cv.width = TOWN.w; cv.height = TOWN.h;
  const g = cv.getContext('2d');
  const prev = ctx; Art.bind(g);

  const grass = SEASON.key === 'winter' ? shade(SEASON.grass, .99)
              : shade(v.grass, SEASON.key === 'autumn' ? 1.06 : SEASON.key === 'summer' ? .94 : 1.02);
  g.fillStyle = grass; g.fillRect(0, 0, TOWN.w, TOWN.h);
  // 풀결 — 규칙적인 격자가 아니라 흩뿌린다
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * TOWN.w, y = Math.random() * TOWN.h;
    g.fillStyle = shade(grass, .89 + Math.random() * .16);
    g.fillRect(x | 0, y | 0, 2 + (Math.random() < .3 ? 1 : 0), 1);
  }
  // 잔디 결이 진한 덤불 자리
  [[130,150,54,30],[300,120,70,26],[600,320,60,34],[190,520,80,26],[430,340,64,24],
   [660,110,54,30],[70,180,40,22],[500,120,44,22]].forEach(([x, y, w, h]) => {
    for (let i = 0; i < w * h / 7; i++) {
      const bx = x + Math.random() * w, by = y + Math.random() * h;
      g.fillStyle = shade(SEASON.key === 'winter' ? '#9AA89A' : '#5F9A5A', .85 + Math.random() * .4);
      g.fillRect(bx | 0, by | 0, 2, 2);
    }
  });

  // 개울 — 마을을 가로지른다
  pathStroke(g, [[0,116],[70,128],[140,112],[196,132],[210,178],[188,236],[204,300],
                 [176,352],[196,418],[168,486],[186,560]], 9, '#6EB0D4');
  pathStroke(g, [[0,116],[70,128],[140,112],[196,132],[210,178],[188,236],[204,300],
                 [176,352],[196,418],[168,486],[186,560]], 5, '#93CDE6');

  // 길
  PATHS.forEach(p => pathStroke(g, p.pts, p.w + 2, '#C2AC86'));
  PATHS.forEach(p => pathStroke(g, p.pts, p.w, '#D8C4A0'));
  for (let i = 0; i < 900; i++) {                                  // 길 위 자갈
    const x = Math.random() * TOWN.w, y = Math.random() * TOWN.h;
    if (g.getImageData) { /* 성능상 검사 대신 흩뿌리기만 한다 */ }
    g.fillStyle = 'rgba(180,158,120,.35)'; g.fillRect(x | 0, y | 0, 1, 1);
  }

  // 연못
  const P = POND;
  for (let y = 0; y < P.h; y++) {
    const k = y / P.h, w = Math.round(P.w * (0.72 + 0.28 * Math.sin(Math.PI * k)));
    g.fillStyle = '#5FA6CC'; g.fillRect(P.x + (P.w - w) / 2, P.y + y, w, 1);
    g.fillStyle = '#8ACCE8'; g.fillRect(P.x + (P.w - w) / 2 + 3, P.y + y, Math.max(0, w - 6), 1);
  }
  g.fillStyle = '#B4E4F4'; g.fillRect(P.x + 14, P.y + 12, 16, 3); g.fillRect(P.x + 44, P.y + 30, 11, 2);
  [[P.x - 4, P.y + 10], [P.x + P.w - 6, P.y + 36], [P.x + 20, P.y + P.h - 4]].forEach(([x, y]) => {
    g.fillStyle = '#8A9A6A'; for (let i = 0; i < 5; i++) g.fillRect(x + i, y - (i % 3) * 3, 1, 6);
  });

  // 꽃밭 — 계절 색으로
  const FB = [[236,120,44,20],[452,140,40,18],[604,140,36,18],[120,470,52,20],
              [402,494,44,18],[624,340,40,18],[302,240,34,16]];
  FB.forEach(([x, y, w, h]) => {
    for (let i = 0; i < 26; i++) {
      const fx = x + Math.random() * w, fy = y + Math.random() * h;
      g.fillStyle = shade('#4E8A44', .9 + Math.random() * .3);
      g.fillRect(fx | 0, (fy + 2) | 0, 1, 3);
      g.fillStyle = SEASON.key === 'winter' ? '#C8D8DC'
        : [SEASON.blossom, shade(SEASON.blossom, 1.16), '#FBF0C8'][i % 3];
      g.fillRect(fx | 0, fy | 0, 2, 2);
    }
  });
  // 바위
  [[172,96],[520,178],[86,318],[644,470],[298,486],[712,196]].forEach(([x, y], i) => {
    g.fillStyle = '#9A968E'; g.fillRect(x, y, 9 + i % 3, 6);
    g.fillStyle = '#B0ACA2'; g.fillRect(x + 1, y, 6, 2);
    g.fillStyle = '#7E7A72'; g.fillRect(x, y + 5, 9 + i % 3, 1);
  });
  // 나무 — 숲처럼 무리지어
  TREE_SPOTS.forEach(([x, y], i) => Season.tree(x, y, SEASON, i));
  GROVES.forEach(([cx, cy, n], gi) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + gi, r = 12 + (i % 3) * 11;
      Season.tree(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * .6), SEASON, i + gi);
    }
  });

  Art.bind(prev);
  townBg = cv;
}

function drawTown(t) {
  const v = vill(), tw = town();
  buildTownBg();
  ctx.drawImage(townBg, 0, 0);

  // 명절 자리
  if (SEASON.festival && Season.FEST[SEASON.festival.key]) {
    const on = isF('festival');
    if (on) { ctx.fillStyle = GLOW; ctx.fillRect(FEST_AT.x - 40, FEST_AT.y - 100, 80, 108); }
    Season.FEST[SEASON.festival.key](FEST_AT.x, FEST_AT.y, t);
    if (on) arrow(FEST_AT.x - 1, FEST_AT.y - 102, t);
  }
  // 떨어진 잎과 꽃
  drops.forEach((d, i) => {
    const on = isF('drop', 'i', i);
    if (on) { ctx.fillStyle = GLOW; ctx.fillRect(d.x - 4, d.y - 5, 15, 15); }
    Season.drop(d.kind, d.x, d.y, t);
    if (on) arrow(d.x + 3, d.y - 9, t);
  });

  // 건물들 — 뒤에 있는 것부터
  building(BLD.used, t, isF('used'));
  building(BLD.post, t, isF('post'));
  building(BLD.lib, t, isF('library'));
  building(BLD.flower, t, isF('flower'));
  building(BLD.cafe, t, isF('cafe'));
  building(BLD.museum, t, isF('museum'));
  building(BLD.jazz, t, isF('jazz'));
  building(BLD.furn, t, isF('furn'));
  building(BLD.train, t, isF('train'));
  building(BLD.air, t, isF('air'));
  // 호수 — 계절마다 노는 법이 다르다
  const pOn = isF('pond');
  if (pOn) { ctx.fillStyle = GLOW; ctx.fillRect(POND.x - 6, POND.y - 6, POND.w + 12, POND.h + 16); }
  if (SEASON.key === 'winter') {
    px(POND.x + 4, POND.y + 4, POND.w - 8, POND.h - 8, '#DCEAF2');
    ctx.fillStyle = '#F4FAFD';
    for (let i = 0; i < 7; i++) ctx.fillRect(POND.x + 10 + i * 12, POND.y + 12 + (i % 3) * 14, 14, 1);
    const sk = Math.sin(t / 700), sx = POND.x + POND.w / 2 + sk * 26;
    sprite(BODY.side.concat(LEG_A), sx, POND.y + 24, sk < 0, { h:'#3a2e28', c:'#c4849e' });
  } else if (SEASON.key === 'summer') {
    const bob = Math.sin(t / 500) > 0 ? 0 : 1;
    px(POND.x + 34, POND.y + 22 + bob, 8, 5, '#F7D6B0');           // 물에 뜬 사람
    px(POND.x + 36, POND.y + 18 + bob, 5, 5, '#3a2e28');
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillRect(POND.x + 28, POND.y + 27 + bob, 20, 1);
    px(POND.x + 62, POND.y + 34, 12, 6, '#E8B45A');                // 튜브
  }
  if (pOn) arrow(POND.x + POND.w / 2 - 1, POND.y - 10, t);
  drawPicnic(t); drawSkip();
  // 도서관 현판
  px(BLD.lib.x + BLD.lib.w / 2 - 30, BLD.lib.y + 14, 60, 13, '#5A6470');
  ctx.fillStyle = '#FFE08A';
  for (let i = 0; i < 7; i++) ctx.fillRect(BLD.lib.x + BLD.lib.w / 2 - 25 + i * 7, BLD.lib.y + 18, 4, 5);
  // 기차역 선로
  px(0, BLD.train.y + BLD.train.h + 14, TOWN.w, 6, '#9A9088');
  ctx.fillStyle = '#6E645C';
  for (let x = 0; x < TOWN.w; x += 7) ctx.fillRect(x, BLD.train.y + BLD.train.h + 13, 3, 8);
  px(0, BLD.train.y + BLD.train.h + 15, TOWN.w, 1, '#C8C0B4');
  px(0, BLD.train.y + BLD.train.h + 18, TOWN.w, 1, '#C8C0B4');
  // 공항 활주로
  px(BLD.air.x - 10, BLD.air.y + BLD.air.h + 12, 150, 10, '#8A8A90');
  ctx.fillStyle = '#EFEFE8';
  for (let x = BLD.air.x - 4; x < BLD.air.x + 132; x += 16) ctx.fillRect(x, BLD.air.y + BLD.air.h + 16, 8, 2);

  // 랜드마크
  const lmOn = isF('landmark');
  if (lmOn) { ctx.fillStyle = GLOW; ctx.fillRect(LM.x - 44, LM.y - 78, 88, 86); }
  Art.LANDMARK[v.lm](LM.x, LM.y);
  px(LM.x - 22, LM.y + 2, 44, 3, shade(v.grass, .86));
  if (lmOn) arrow(LM.x - 1, LM.y - 80, t);

  // 버스정류장
  const bOn = isF('bus');
  if (bOn) { ctx.fillStyle = GLOW; ctx.fillRect(BUS.x - 5, BUS.y - 24, BUS.w + 10, BUS.h + 28); }
  px(BUS.x, BUS.y - 18, BUS.w, 5, '#6E8A9E'); px(BUS.x, BUS.y - 18, BUS.w, 2, '#8AA6BA');
  px(BUS.x + 2, BUS.y - 13, 3, 30, '#8A96A2'); px(BUS.x + BUS.w - 5, BUS.y - 13, 3, 30, '#8A96A2');
  px(BUS.x + 8, BUS.y - 10, BUS.w - 16, 14, '#FBF3E2');
  px(BUS.x + 11, BUS.y - 7, BUS.w - 22, 2, '#8A7A5E');
  px(BUS.x + 11, BUS.y - 3, BUS.w - 26, 2, '#8A7A5E');
  px(BUS.x + 6, BUS.y + 6, BUS.w - 12, 8, '#C4785E'); px(BUS.x + 6, BUS.y + 6, BUS.w - 12, 2, '#D89A76');
  if (bOn) arrow(BUS.x + BUS.w / 2 - 1, BUS.y - 26, t);

  // 집과 우편함
  tw.houses.forEach(h => {
    drawHouse(h, t, isF('enter', 'to', h.to));
    const m = mailOf(h), mOn = isF('mail', 'to', h.to);
    const unread = h.to === 0 && ROOMS[0].letters.some(l => !l.read);
    if (mOn) { ctx.fillStyle = GLOW; ctx.fillRect(m.x - 4, m.y - 10, m.w + 8, m.h + 12); }
    px(m.x + 4, m.y + 6, 2, 10, '#7A5A38');
    px(m.x, m.y - 2, 10, 9, shade(h.roof, .9)); px(m.x, m.y - 2, 10, 2, h.roof);
    px(m.x + 2, m.y + 2, 6, 3, '#4A3F32');
    px(m.x + 10, unread ? m.y - 6 : m.y + 2, 1, 7, unread ? '#D4645C' : '#9A8A72');
    px(m.x + 11, unread ? m.y - 6 : m.y + 2, 3, 3, unread ? '#D4645C' : '#9A8A72');
    if (unread) px(m.x + 3, m.y - 4, 5, 3, '#FBF3E2');
    if (mOn) arrow(m.x + 4, m.y - 12, t);
  });

  drawBoard(t);                                   // 역 앞 시각표
  drawTrain();                                    // 기차 · 비행기

  // 사람들
  if (!solo) npcs.forEach((n, i) => {
    const on = isF('npc', 'i', i);
    if (on) { ctx.fillStyle = GLOW; ctx.fillRect(n.x - 4, n.y - 6, 18, 24); }
    person(n.x, n.y, n.dir, n.moving, n.anim, { h:n.hair || '#4a3a30', c:n.shirt || '#a8a08e' });
    if (n.isEvent) {                                  // 이벤트 표시
      const bob = Math.sin(t / 260) > 0 ? 0 : 1;
      px(n.x + 3, n.y - 10 - bob, 5, 5, '#FFE08A');
      px(n.x + 4, n.y - 9 - bob, 3, 1, '#8A6A2A');
      px(n.x + 5, n.y - 8 - bob, 1, 2, '#8A6A2A');
    }
    if (on) arrow(n.x + 4, n.y - 16, t);
  });
}

// ── 개인 방 · 도서관 ──────────────────────────────────────────
function shellRoom(R, wide) {
  const ww = wide || ROOM_W;
  const wallLine = shade(R.wall, 1.08), wallDark = shade(R.wall, .82);
  const floorAlt = shade(R.floor, .93), floorLine = shade(R.floor, .8);
  // 벽 — 평평한 단색 대신 그라데이션으로 공간감을 준다 (천장 쪽 살짝 어둡게, 가운데 살짝 밝게)
  const wg = ctx.createLinearGradient(0, 0, 0, RT);
  wg.addColorStop(0, shade(R.wall, .88)); wg.addColorStop(.5, shade(R.wall, 1.05)); wg.addColorStop(1, shade(R.wall, .9));
  ctx.fillStyle = wg; ctx.fillRect(0, 0, ww, RT);
  ctx.fillStyle = wallLine;
  for (let x = 0; x < ww; x += 8) ctx.fillRect(x, 0, 1, RT);
  px(0, RT - 4, ww, 4, wallDark);
  for (let y = RT; y < H; y += 6) {
    px(0, y, ww, 6, ((y / 6) | 0) % 2 ? floorAlt : R.floor);
    px(0, y, ww, 1, floorLine);
  }
  // 바닥에도 은은한 명암 — 문 쪽(위)은 살짝 그늘지고 안쪽(아래)은 따뜻하게 뜬다
  const fg = ctx.createLinearGradient(0, RT, 0, H);
  fg.addColorStop(0, 'rgba(40,30,20,.1)'); fg.addColorStop(.55, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(255,240,210,.07)');
  ctx.fillStyle = fg; ctx.fillRect(0, RT, ww, H - RT);
}
function drawBookSpine(bk) {
  px(bk.bx, bk.by, bk.w, bk.h, bk.col);
  px(bk.bx, bk.by, 1, bk.h, 'rgba(255,255,255,.26)');
  px(bk.bx, bk.by + 3, bk.w, 1, 'rgba(0,0,0,.24)');
  px(bk.bx, bk.by + bk.h - 4, bk.w, 1, 'rgba(0,0,0,.24)');
  if (bk.from) px(bk.bx, bk.by + bk.h - 2, bk.w, 1, '#8FD4E8');
  if (bk.done) px(bk.bx + 1, bk.by + 1, bk.w - 2, 1, '#FFE08A');
}
function drawItem(R, it, t) {
  const wood = R.wood, woodDark = shade(wood, .68);
  switch (it.kind) {
    case 'rug':
      px(it.x, it.y, it.w, it.h, R.rug);
      px(it.x + 5, it.y + 4, it.w - 10, it.h - 8, shade(R.rug, 1.18));
      px(it.x + 14, it.y + 10, it.w - 28, it.h - 20, R.rug); break;
    case 'window': {
      px(it.x, it.y, it.w, it.h, '#6E5236');
      const gx = it.x + 3, gy = it.y + 3, gw = it.w - 6, gh = it.h - 6;
      const night = WEATHER.night, dusk = WEATHER.dusk;
      ctx.save(); ctx.beginPath(); ctx.rect(gx, gy, gw, gh); ctx.clip();
      // 하늘 — 계절 하늘색을 바탕으로, 밤/노을이면 그쪽 색으로
      const sky = ctx.createLinearGradient(0, gy, 0, gy + gh);
      if (night) { sky.addColorStop(0, '#1C2148'); sky.addColorStop(1, '#3E3E68'); }
      else if (dusk) { sky.addColorStop(0, shade(SEASON.sky, .82)); sky.addColorStop(1, '#F0AE80'); }
      else { sky.addColorStop(0, shade(SEASON.sky, 1.05)); sky.addColorStop(1, shade(SEASON.sky, .88)); }
      ctx.fillStyle = sky; ctx.fillRect(gx, gy, gw, gh);
      if (night) [[.12,.2],[.35,.45],[.6,.15],[.78,.5],[.9,.28]].forEach(([fx,fy]) =>
        px(gx + gw * fx, gy + gh * fy, 1, 1, 'rgba(255,255,255,.85)'));
      blob(gx + gw * (night ? .78 : .8), gy + gh * .22, night ? 3 : 4, night ? '#F2EBD6' : '#FFE9A0');
      // 땅 — 계절 풀색, 나무 한 그루가 서 있다 (도트 하나짜리 마을 나무 대신 작은 blob 나무)
      px(gx, gy + gh * .68, gw, gh * .32, shade(SEASON.grass, night ? .5 : 1));
      const tx = gx + gw * .58, ty = gy + gh * .68;
      px(tx - 1, ty - 8, 2, 8, '#8A6440');
      blob(tx, ty - 11, Math.max(3, Math.round(gw * .09)), night ? shade(SEASON.leaf, .6) : SEASON.leaf);
      if (SEASON.key === 'spring') blob(tx - 3, ty - 13, 2, SEASON.blossom);
      if (SEASON.key === 'autumn') blob(tx + 3, ty - 9, 2, '#D9642E');
      if (SEASON.key === 'winter') px(tx - 4, ty - 15, 8, 2, 'rgba(255,255,255,.85)');
      if (WEATHER.rain > 0) for (let i = 0; i < 5; i++)
        px(gx + 2 + ((i * 7 + 3) % (gw - 4)), gy + ((i * 11) % gh), 1, 3, 'rgba(210,225,240,.5)');
      if (WEATHER.snow) for (let i = 0; i < 5; i++)
        px(gx + 2 + ((i * 8 + 2) % (gw - 4)), gy + ((i * 13) % gh), 1, 1, 'rgba(255,255,255,.9)');
      ctx.restore();
      px(gx + 2, gy, 1, gh, 'rgba(255,255,255,.14)');
      px(it.x + Math.round(it.w / 2) - 1, it.y + 3, 2, it.h - 6, '#6E5236');
      px(it.x + 3, it.y + Math.round(it.h / 2) - 1, it.w - 6, 2, '#6E5236');
      px(it.x - 6, RT, it.w + 12, H - RT, 'rgba(255,246,200,.13)'); break;
    }
    case 'frame':
      px(it.x, it.y, it.w, it.h, '#6E5236');
      px(it.x + 3, it.y + 3, it.w - 6, it.h - 6, shade(R.wall, 1.28));
      sprite(BODY.down.slice(0, 8), it.x + 8, it.y + 6, false, { h:R.hair, c:R.shirt }); break;
    case 'lamp':
      px(it.x + 4, it.y + 6, 2, 12, '#6E5236');
      px(it.x, it.y, 10, 6, '#FFF0BC');
      px(it.x - 8, it.y + 6, 26, 22, 'rgba(255,240,180,.16)'); break;
    case 'plant':
      px(it.x + 2, it.y + 10, 6, 6, '#B07A50'); px(it.x + 2, it.y + 10, 6, 1, '#8A5C38');
      px(it.x + 4, it.y + 4, 2, 7, '#5F9A5A');
      px(it.x + 1, it.y + 2, 3, 4, '#5F9A5A'); px(it.x + 6, it.y + 3, 3, 4, '#5F9A5A');
      px(it.x + 3, it.y, 4, 3, '#7CBC72'); break;
    case 'poster': {
      const on = isF('poster', 'it', it);
      if (on) { ctx.fillStyle = GLOW; ctx.fillRect(it.x - 3, it.y - 3, it.w + 6, it.h + 6); }
      px(it.x - 1, it.y - 1, it.w + 2, it.h + 2, '#5A4A38');
      Art.drawArt(it.art, it.x, it.y);
      px(it.x, it.y, it.w, 1, 'rgba(255,255,255,.14)');
      px(it.x + 2, it.y - 2, 1, 1, '#C4564E'); px(it.x + it.w - 3, it.y - 2, 1, 1, '#C4564E');
      if (on) arrow(it.x + (it.w >> 1) - 1, it.y - 8, t); break;
    }
    case 'card': {
      const on = isF('card');
      px(it.x - 1, it.y - 1, it.w + 2, it.h + 2, woodDark);
      px(it.x, it.y, it.w, it.h, '#FBF3E2');
      ctx.fillStyle = '#C4B394';
      for (let i = 0; i < 6; i++) ctx.fillRect(it.x + 3, it.y + 5 + i * 3, it.w - 6, 1);
      px(it.x + 3, it.y + 2, it.w - 6, 1, '#9A8A68');
      if (on) { ctx.fillStyle = GLOW; ctx.fillRect(it.x - 3, it.y - 3, it.w + 6, it.h + 6);
                arrow(it.x + it.w / 2 - 1, it.y - 8, t); }
      break;
    }
    case 'journal': {                                     // 내가 남긴 문장을 모아보는 필사대
      const on = isF('journal');
      px(it.x - 1, it.y - 1, it.w + 2, it.h + 2, woodDark);
      px(it.x, it.y, it.w, it.h, '#D8CDB4');
      ['#D4645C', '#E8B45A', '#7CA8D4'].forEach((c, i) => {
        const ny = it.y + 4 + i * 8;
        px(it.x + 3, ny, it.w - 6, 6, '#FBF3E2');
        px(it.x + 3, ny, 3, 3, c);
        px(it.x + 5, ny + 2, it.w - 10, 1, '#C4B394');
      });
      if (on) { ctx.fillStyle = GLOW; ctx.fillRect(it.x - 3, it.y - 3, it.w + 6, it.h + 6);
                arrow(it.x + it.w / 2 - 1, it.y - 8, t); }
      break;
    }
    case 'perch': {
      const on = isF('perch');
      px(it.x, it.y, it.w, 2, woodDark); px(it.x + it.w - 2, it.y - 8, 2, 8, woodDark);
      if (!R.letters.length) break;
      if (R.letters.some(l => !l.read)) {
        if (on) { ctx.fillStyle = GLOW; ctx.fillRect(it.x + 2, it.y - 11, 13, 12); }
        blit(BIRD_SIT, it.x + 4, it.y - 7, BIRD_PAL, false);
        px(it.x + 13, it.y - 5, 4, 3, '#FBF3E2');
        if (on) arrow(it.x + 9, it.y - 15, t);
      } else {
        R.letters.slice(0, 3).forEach((l, i) => {
          const bx = it.x + 1 + i * 6, by = it.y - 20;
          px(bx, by, 5, 7, '#FBF3E2');
          px(bx + 1, by + 2, 3, 1, '#C4B394'); px(bx + 1, by + 4, 3, 1, '#C4B394');
          px(bx + 2, by - 1, 1, 1, '#C4564E');
        });
        if (on) arrow(it.x + 6, it.y - 27, t);
      }
      break;
    }
    case 'shelf': {
      px(it.x - 2, it.y - 2, it.w + 4, it.h + 4, woodDark);
      px(it.x, it.y, it.w, it.h, shade(R.wall, .72));
      if (edit) { ctx.fillStyle = 'rgba(122,95,168,.12)';
                  (it.boards || boardsOf(it)).forEach(by => ctx.fillRect(it.x, by - 16, it.w, 16)); }
      for (const bk of it.books) {
        if (bk.bx === undefined || (drag && drag.what === 'book' && drag.bk === bk)) continue;
        const on = !edit && focus && focus.type === 'book' && focus.book === bk;
        if (on) { ctx.fillStyle = GLOW; ctx.fillRect(bk.bx - 3, bk.by - 3, bk.w + 6, bk.h + 5); }
        drawBookSpine(bk);
        if (on) { px(bk.bx, bk.by - 2, bk.w, 2, 'rgba(255,255,255,.4)'); arrow(bk.bx + (bk.w >> 1) - 1, bk.by - 7, t); }
      }
      ctx.fillStyle = wood;
      (it.boards || boardsOf(it)).forEach(by => ctx.fillRect(it.x, by, it.w, 2));
      px(it.x - 2, it.y - 2, 2, it.h + 4, woodDark);
      px(it.x + it.w, it.y - 2, 2, it.h + 4, woodDark);
      break;
    }
  }
  if (edit && sel === it) selBox(it);
}
function drawDoorIndoor(wood, D, on, t) {
  const dark = shade(wood, .68);
  px(D.x - 2, D.y - 2, D.w + 4, D.h + 2, dark);
  px(D.x, D.y, D.w, D.h, wood);
  px(D.x + 4, D.y + 5, D.w - 8, 18, shade(wood, .86));
  px(D.x + 4, D.y + 28, D.w - 8, 18, shade(wood, .86));
  px(D.x + D.w - 7, D.y + 30, 3, 3, '#E8C46A');
  px(D.x + 3, D.y - 11, D.w - 6, 8, '#5F8A5F');
  ctx.fillStyle = '#F2FBEF';
  for (let i = 0; i < 4; i++) ctx.fillRect(D.x + 7 + i * 6, D.y - 8, 4, 2);
  if (on) { ctx.fillStyle = GLOW; ctx.fillRect(D.x - 4, D.y - 14, D.w + 8, D.h + 16);
            arrow(D.x + D.w / 2 - 1, D.y - 19, t); }
}
// 손님 문 — 나가는 문과 생김새를 다르게. 아치에 놋쇠 문패와 초인종.
function drawVisitDoor(R, on, t) {
  const D = VDOOR, wood = R.wood, dark = shade(wood, .62);
  if (on) { ctx.fillStyle = GLOW; ctx.fillRect(D.x - 6, D.y - 12, D.w + 12, D.h + 16); }
  for (let i = 0; i < 7; i++)                                  // 아치
    px(D.x + 2 + i, D.y - 7 + i, D.w - 4 - i * 2, 2, dark);
  px(D.x - 3, D.y, D.w + 6, D.h + 2, dark);
  px(D.x, D.y, D.w, D.h, wood);
  px(D.x + 3, D.y + 4, D.w - 6, D.h - 8, shade(wood, .88));
  px(D.x + D.w / 2 - 1, D.y + 4, 2, D.h - 8, dark);            // 두 짝
  for (let i = 0; i < 4; i++) {                                 // 격자 유리
    px(D.x + 5 + (i % 2) * (D.w / 2 - 2), D.y + 8 + Math.floor(i / 2) * 14, 11, 11, '#DCEAF2');
    px(D.x + 5 + (i % 2) * (D.w / 2 - 2), D.y + 8 + Math.floor(i / 2) * 14, 11, 1, '#F2F8FC');
  }
  px(D.x + D.w / 2 - 4, D.y + D.h - 14, 3, 3, '#E8C46A');       // 손잡이 둘
  px(D.x + D.w / 2 + 2, D.y + D.h - 14, 3, 3, '#E8C46A');
  px(D.x + D.w - 6, D.y + 22, 3, 3, '#C8A85A');                 // 초인종
  px(D.x + 4, D.y - 14, D.w - 8, 8, '#B89A5E');                 // 놋쇠 문패
  px(D.x + 4, D.y - 14, D.w - 8, 2, '#D4BA7E');
  ctx.fillStyle = '#6E5A32';
  for (let i = 0; i < 4; i++) ctx.fillRect(D.x + 7 + i * 6, D.y - 11, 4, 3);
  if (on) arrow(D.x + D.w / 2 - 1, D.y - 22, t);
}

function drawRoom(R, t) {
  shellRoom(R);
  const order = { rug:0, window:1, frame:1, poster:1, card:1, perch:1, shelf:2, lamp:3, plant:4 };
  R.items.slice().sort((a, b) => (order[a.kind] ?? 2) - (order[b.kind] ?? 2)).forEach(it => drawItem(R, it, t));
  drawDoorIndoor(R.wood, DOOR, isF('out'), t);
  drawVisitDoor(R, isF('visit'), t);
  if (drag && drag.what === 'book') {
    const bk = drag.bk, sx = bk.bx, sy = bk.by;
    bk.bx = Math.round(drag.x - bk.w / 2); bk.by = Math.round(drag.y - bk.h / 2);
    px(bk.bx, bk.by + bk.h + 2, bk.w, 2, 'rgba(60,45,30,.3)');
    drawBookSpine(bk);
    px(bk.bx, bk.by - 2, bk.w, 2, 'rgba(255,255,255,.45)');
    bk.bx = sx; bk.by = sy;
  }
}
// ── 헌책방 안 ─────────────────────────────────────────────────
const USED_SKIN = { wall:'#B49A78', floor:'#9A7E5E', wood:'#8A6A44' };
function bookPile(x, y, w, n, seed) {                 // 눕혀 쌓은 책더미
  let cy = y;
  for (let i = 0; i < n; i++) {
    const bw = w - ((i * 7 + seed) % 5), h = 3 + ((i * 3 + seed) % 2);
    const off = ((i * 5 + seed) % 3) - 1;
    const c = CATALOG[(i * 7 + seed * 3) % CATALOG.length].col;
    px(x + off, cy - h, bw, h, c);
    px(x + off, cy - h, bw, 1, 'rgba(255,255,255,.22)');
    px(x + off, cy - 1, bw, 1, 'rgba(0,0,0,.2)');
    cy -= h + 1;
  }
  return cy;
}
function drawUsed(t) {
  const R = USED_SKIN, woodDark = shade(R.wood, .66);
  shellRoom(R, USED_W);
  drawDoorIndoor(R.wood, USED_DOOR, isF('out'), t);

  // 벽 서가 두 개
  [[USED_TRACE, isF('trace'), true], [USED_FLAT, isF('flat'), false]].forEach(([S, on, traced]) => {
    if (on) { ctx.fillStyle = GLOW; ctx.fillRect(S.x - 4, S.y - 4, S.w + 8, S.h + 10); }
    px(S.x - 2, S.y - 2, S.w + 4, S.h + 4, woodDark);
    px(S.x, S.y, S.w, S.h, shade(R.wall, .68));
    const rows = [];
    for (let i = 1; i * 16 + 4 <= S.h; i++) rows.push(S.y + 4 + i * 16);
    let si = 0, cur = S.x + 3;
    for (let n = 0; n < 40; n++) {
      const bk = CATALOG[(n * 5 + S.x) % CATALOG.length];
      const w = 2 + ((n * 3) % 3), h = 10 + ((n * 5 + S.x) % 6);
      if (cur + w > S.x + S.w - 3) { si++; cur = S.x + 3; }
      if (si >= rows.length) break;
      const by = rows[si] - h;
      px(cur, by, w, h, bk.col);
      px(cur, by, 1, h, 'rgba(255,255,255,.2)');
      if (traced && n % 3 === 0) px(cur, by - 2, w, 2, '#FFF0BC');   // 삐져나온 쪽지
      cur += w + 1;
    }
    ctx.fillStyle = R.wood; rows.forEach(y => ctx.fillRect(S.x, y, S.w, 2));
    px(S.x + S.w / 2 - 14, S.y + S.h + 2, 28, 6, '#FBF3E2');
    px(S.x + S.w / 2 - 14, S.y + S.h + 2, 28, 1, '#C4B394');
    if (on) arrow(S.x + S.w / 2 - 1, S.y - 9, t);
  });

  // 계산대와 주인
  const oOn = isF('owner');
  if (oOn) { ctx.fillStyle = GLOW; ctx.fillRect(USED_DESK.x - 5, USED_DESK.y - 24, USED_DESK.w + 10, USED_DESK.h + 28); }
  px(USED_DESK.x, USED_DESK.y, USED_DESK.w, USED_DESK.h, woodDark);
  px(USED_DESK.x, USED_DESK.y, USED_DESK.w, 4, R.wood);
  ctx.fillStyle = shade(R.wood, .8);
  for (let x = USED_DESK.x + 4; x < USED_DESK.x + USED_DESK.w - 2; x += 8) ctx.fillRect(x, USED_DESK.y + 7, 3, USED_DESK.h - 10);
  bookPile(USED_DESK.x + 6, USED_DESK.y, 12, 4, 2);
  px(USED_DESK.x + USED_DESK.w - 18, USED_DESK.y - 7, 13, 7, '#C4B08A');   // 낡은 계산기
  px(USED_DESK.x + USED_DESK.w - 16, USED_DESK.y - 5, 9, 3, '#6E6454');
  sprite(BODY.down.concat(LEG_A), USED_DESK.x + 30, USED_DESK.y - 22, false,
         { h:'#4A3A2E', c:'#8A7A5E' });
  if (oOn) arrow(USED_DESK.x + 34, USED_DESK.y - 28, t);

  // 매대 세 개
  STALLS.forEach((s, i) => {
    const on = isF('stall', 'i', i);
    if (on) { ctx.fillStyle = GLOW; ctx.fillRect(s.x - 5, s.y - 30, s.w + 10, s.h + 34); }
    px(s.x, s.y + 4, s.w, s.h - 4, woodDark);
    px(s.x - 2, s.y, s.w + 4, 5, R.wood);
    px(s.x + 3, s.y + 5, 3, s.h - 5, woodDark);
    px(s.x + s.w - 6, s.y + 5, 3, s.h - 5, woodDark);
    bookPile(s.x + 6,  s.y, 16, 5, i + 1);
    bookPile(s.x + 26, s.y, 14, 7, i + 4);
    bookPile(s.x + 42, s.y, 11, 3, i + 6);
    if (on) arrow(s.x + s.w / 2 - 1, s.y - 32, t);
  });

  // 고양이 — 매대 위에서 존다
  const cOn = isF('cat');
  if (cOn) { ctx.fillStyle = GLOW; ctx.fillRect(CAT.x - 4, CAT.y - 4, 20, 16); }
  const tail = Math.sin(t / 500) > 0 ? 0 : 1;
  px(CAT.x + 1, CAT.y + 4, 11, 6, '#8A7A6A');
  px(CAT.x + 9, CAT.y, 6, 6, '#8A7A6A');
  px(CAT.x + 9, CAT.y - 1, 2, 2, '#8A7A6A'); px(CAT.x + 13, CAT.y - 1, 2, 2, '#8A7A6A');
  px(CAT.x + 11, CAT.y + 2, 1, 1, '#3A2E28'); px(CAT.x + 14, CAT.y + 2, 1, 1, '#3A2E28');
  px(CAT.x - 2 - tail, CAT.y + 2, 4, 2, '#8A7A6A');
  px(CAT.x + 1, CAT.y + 9, 11, 1, 'rgba(0,0,0,.18)');
  if (cOn) arrow(CAT.x + 5, CAT.y - 8, t);

  // 교환대
  const sOn = isF('swap');
  if (sOn) { ctx.fillStyle = GLOW; ctx.fillRect(USED_SWAP.x - 5, USED_SWAP.y - 26, USED_SWAP.w + 10, USED_SWAP.h + 30); }
  px(USED_SWAP.x, USED_SWAP.y + 4, USED_SWAP.w, USED_SWAP.h - 4, woodDark);
  px(USED_SWAP.x - 2, USED_SWAP.y, USED_SWAP.w + 4, 5, '#6E8A6A');
  bookPile(USED_SWAP.x + 8,  USED_SWAP.y, 13, 3, 8);
  bookPile(USED_SWAP.x + 28, USED_SWAP.y, 13, 3, 11);
  px(USED_SWAP.x + 22, USED_SWAP.y - 14, 8, 2, '#5F8A5F');        // 화살표 두 개
  px(USED_SWAP.x + 22, USED_SWAP.y - 16, 2, 2, '#5F8A5F');
  px(USED_SWAP.x + 22, USED_SWAP.y - 9, 8, 2, '#5F8A5F');
  px(USED_SWAP.x + 28, USED_SWAP.y - 7, 2, 2, '#5F8A5F');
  if (sOn) arrow(USED_SWAP.x + 26, USED_SWAP.y - 28, t);

  // 천장까지 쌓인 책탑 (장식)
  [[178, 130], [312, 132], [412, 128], [468, 130]].forEach(([x, y], i) => bookPile(x, y, 13, 9 + i, i * 3));
}

// 작은 가게들 — 우체국 · 가구점 · 찻집 · 꽃집 · 박물관이 같은 틀을 쓴다
// 찻집 루프탑 — 하늘 아래 파라솔 탁자
function drawCafeRoof(t) {
  px(0, 0, SHOP_W, RT, '#8FC4E4');
  for (let i = 0; i < 3; i++) px(30 + i * 110, RT - 20 - (i % 2) * 10, 26, 20 + (i % 2) * 10, '#B8C4D0');
  px(0, RT, SHOP_W, H - RT, '#B0A88E');
  for (let y = RT; y < H; y += 6) px(0, y, SHOP_W, 1, shade('#B0A88E', .9));
  px(0, RT - 3, SHOP_W, 3, '#8A8266');
  for (let x = 6; x < SHOP_W; x += 16) px(x, RT - 9, 3, 9, '#8A8266');
  ROOF_TABLES.forEach((tb, i) => {
    const on = isF('rooftable', 'i', i);
    if (on) { ctx.fillStyle = GLOW; ctx.fillRect(tb.x - 6, tb.y - 44, 40, 60); }
    px(tb.x + 4, tb.y - 30, 3, 26, '#6E4E3A');
    px(tb.x - 10, tb.y - 44, 30, 5, '#C48AA0'); px(tb.x - 10, tb.y - 44, 30, 2, shade('#C48AA0', 1.2));
    px(tb.x, tb.y, 24, 18, '#6E4E3A'); px(tb.x, tb.y, 24, 3, '#8A6A50');
    px(tb.x + 4, tb.y - 6, 4, 6, '#EFE4D0');
    if (on) arrow(tb.x + 12, tb.y - 48, t);
  });
}
function drawShop(t) {
  if (place.key === 'cafe' && place.level === 2) { drawCafeRoof(t); return; }
  const S = SHOPS[place.key], woodDark = shade(S.wood, .66);
  shellRoom(S, SHOP_W);
  drawDoorIndoor(S.wood, SHOP_DOOR, isF('out'), t);
  S.decor(t);
  const dOn = isF('shopdesk');
  if (dOn) { ctx.fillStyle = GLOW; ctx.fillRect(SHOP_DESK.x - 5, SHOP_DESK.y - 24, SHOP_DESK.w + 10, SHOP_DESK.h + 28); }
  px(SHOP_DESK.x, SHOP_DESK.y, SHOP_DESK.w, SHOP_DESK.h, woodDark);
  px(SHOP_DESK.x, SHOP_DESK.y, SHOP_DESK.w, 4, S.wood);
  sprite(BODY.down.concat(LEG_A), SHOP_DESK.x + 30, SHOP_DESK.y - 22, false, S.staff);
  if (dOn) arrow(SHOP_DESK.x + 34, SHOP_DESK.y - 28, t);
  if (place.key === 'cafe') {
    px(SHOP_STAIRS.x - 2, SHOP_STAIRS.y - 2, SHOP_STAIRS.w + 4, SHOP_STAIRS.h + 4, shade(S.wood, .6));
    px(SHOP_STAIRS.x, SHOP_STAIRS.y, SHOP_STAIRS.w, SHOP_STAIRS.h, '#EFE0B8');
    for (let i = 0; i < 5; i++) px(SHOP_STAIRS.x + 3, SHOP_STAIRS.y + 5 + i * 8, SHOP_STAIRS.w - 6, 3, shade(S.wood, 1.1));
    const on = isF('roofup');
    if (on) { ctx.fillStyle = GLOW; ctx.fillRect(SHOP_STAIRS.x - 5, SHOP_STAIRS.y - 5, SHOP_STAIRS.w + 10, SHOP_STAIRS.h + 12);
              arrow(SHOP_STAIRS.x + SHOP_STAIRS.w / 2 - 1, SHOP_STAIRS.y - 8, t); }
  }
}

const LIB_SKIN = { wall:'#AEAEBE', floor:'#C6B08C', wood:'#BFA478' };
function plaque(x, y, w, h, base, on, t, rows) {
  if (on) { ctx.fillStyle = GLOW; ctx.fillRect(x - 4, y - 4, w + 8, h + 8); }
  px(x - 2, y - 2, w + 4, h + 4, shade(base, .6));
  px(x, y, w, h, base); px(x + 2, y + 2, w - 4, h - 4, shade(base, 1.3));
  rows(x, y, w, h);
  if (on) arrow(x + w / 2 - 1, y - 9, t);
}
function drawStairs(R, up, t) {
  // up: 1층에서 위로 올라가는 계단(어두운 통로) / false면 2층에서 아래로 내려가는 계단(빛이 샘)
  const S = LIB_STAIRS, on = isF(up ? 'stairup' : 'stairdown');
  if (on) { ctx.fillStyle = GLOW; ctx.fillRect(S.x - 5, S.y - 5, S.w + 10, S.h + 14); }
  px(S.x - 2, S.y - 2, S.w + 4, S.h + 4, shade(R.wood, .6));
  px(S.x, S.y, S.w, S.h, up ? '#2E2638' : '#EFE0B8');
  for (let i = 0; i < 6; i++) px(S.x + 3, S.y + 6 + i * 8, S.w - 6, 3, shade(R.wood, up ? .5 : 1.15));
  px(S.x + S.w / 2 - 10, S.y + S.h + 2, 20, 6, '#FBF3E2');
  if (on) arrow(S.x + S.w / 2 - 1, S.y - 8, t);
}
function drawLibrary(t) {
  if (place.floor === 2) { drawLibrary2(t); return; }
  const R = LIB_SKIN, woodDark = shade(R.wood, .66);
  shellRoom(R, LIB_W);
  drawDoorIndoor(R.wood, LIB_DOOR, isF('exit'), t);
  drawStairs(R, true, t);

  const dOn = isF('desk');
  if (dOn) { ctx.fillStyle = GLOW; ctx.fillRect(LIB_DESK.x - 4, LIB_DESK.y - 16, LIB_DESK.w + 8, LIB_DESK.h + 18); }
  px(LIB_DESK.x, LIB_DESK.y, LIB_DESK.w, LIB_DESK.h, woodDark);
  px(LIB_DESK.x, LIB_DESK.y, LIB_DESK.w, 4, R.wood);
  ctx.fillStyle = shade(R.wood, .8);
  for (let x = LIB_DESK.x + 4; x < LIB_DESK.x + LIB_DESK.w - 2; x += 7) ctx.fillRect(x, LIB_DESK.y + 7, 3, LIB_DESK.h - 10);
  px(LIB_DESK.x + 18, LIB_DESK.y - 8, 16, 8, '#FBF3E2');
  px(LIB_DESK.x + 20, LIB_DESK.y - 6, 12, 1, '#9A8A68');
  px(LIB_DESK.x + 20, LIB_DESK.y - 4, 8, 1, '#9A8A68');
  if (dOn) arrow(LIB_DESK.x + LIB_DESK.w / 2 - 1, LIB_DESK.y - 16, t);

  plaque(LIB_RANK.x, LIB_RANK.y, LIB_RANK.w, LIB_RANK.h, '#8A6A3A', isF('rank'), t, (x, y, w) => {
    px(x + 6, y + 5, w - 12, 2, '#B8823A');
    [12, 9, 7].forEach((v, i) => {
      px(x + 7, y + 11 + i * 7, v * 2, 4, i === 0 ? '#E8C46A' : '#C4B08A');
      px(x + 5, y + 11 + i * 7, 1, 4, '#6E5236');
    });
    px(x + w - 12, y + 10, 6, 6, '#FFE08A'); px(x + w - 11, y + 16, 4, 2, '#FFE08A');
  });
  plaque(LIB_BOARD.x, LIB_BOARD.y, LIB_BOARD.w, LIB_BOARD.h, '#6E5236', isF('board'), t, (x, y, w, h) => {
    for (let i = 0; i < 3; i++) {
      const bx = x + 5 + i * 19, by = y + 4 + (i % 2) * 3;
      px(bx, by, 16, h - 9, '#FBF3E2');
      ctx.fillStyle = '#C4B394';
      for (let r = 0; r < 5; r++) ctx.fillRect(bx + 2, by + 3 + r * 4, 12, 1);
      px(bx + 7, by - 1, 2, 2, '#C4564E');
    }
  });

  // 신문대 — 걸이에 신문이 매달려 있고 옆에 읽는 자리
  const nOn = isF('news'), N = LIB_NEWS;
  if (nOn) { ctx.fillStyle = GLOW; ctx.fillRect(N.x - 5, N.y - 30, N.w + 10, N.h + 34); }
  px(N.x + 2, N.y - 26, 2, 28, woodDark);                     // 신문 걸이 기둥
  px(N.x + N.w - 4, N.y - 26, 2, 28, woodDark);
  px(N.x, N.y - 27, N.w, 3, R.wood);                          // 가로대
  ['#FBF3E2', '#F4ECD8', '#FBF3E2'].forEach((c, i) => {       // 매달린 신문 세 부
    const nx = N.x + 5 + i * 19, sag = i === 1 ? 1 : 0;
    px(nx, N.y - 24 + sag, 15, 20, c);
    px(nx, N.y - 24 + sag, 15, 3, '#D9CDAE');                 // 제호
    ctx.fillStyle = '#B0A184';
    for (let r = 0; r < 5; r++) ctx.fillRect(nx + 2, N.y - 19 + sag + r * 3, 11, 1);
    px(nx + 7, N.y - 24 + sag, 1, 20, '#DDD2B8');             // 접힌 자국
  });
  px(N.x + 6, N.y + 2, N.w - 12, 4, R.wood);                  // 읽는 탁자
  px(N.x + 8, N.y + 6, 3, N.h - 6, woodDark);
  px(N.x + N.w - 11, N.y + 6, 3, N.h - 6, woodDark);
  if (nOn) arrow(N.x + N.w / 2 - 1, N.y - 34, t);

  const qOn = isF('quiz');
  if (qOn) { ctx.fillStyle = GLOW; ctx.fillRect(LIB_QUIZ.x - 5, LIB_QUIZ.y - 20, LIB_QUIZ.w + 10, LIB_QUIZ.h + 24); }
  px(LIB_QUIZ.x, LIB_QUIZ.y + 4, LIB_QUIZ.w, LIB_QUIZ.h - 4, woodDark);
  px(LIB_QUIZ.x - 2, LIB_QUIZ.y, LIB_QUIZ.w + 4, 5, R.wood);
  px(LIB_QUIZ.x + 3, LIB_QUIZ.y + 5, 3, LIB_QUIZ.h - 5, woodDark);
  px(LIB_QUIZ.x + LIB_QUIZ.w - 6, LIB_QUIZ.y + 5, 3, LIB_QUIZ.h - 5, woodDark);
  ['#D4645C', '#4A6EB0', '#6E9A78'].forEach((c, i) => {
    px(LIB_QUIZ.x + 10 + i * 13, LIB_QUIZ.y - 4, 9, 4, c);
    px(LIB_QUIZ.x + 10 + i * 13, LIB_QUIZ.y - 4, 9, 1, 'rgba(255,255,255,.3)');
  });
  [[LIB_QUIZ.x - 11, '#3d2b28', '#d4818f'], [LIB_QUIZ.x + LIB_QUIZ.w + 2, '#2b2b33', '#5a86a8']]
    .forEach(([x, hr, sh], i) => {
      const bob = Math.sin(t / 620 + i * 3) > .7 ? 1 : 0;
      sprite(BODY.side.concat(LEG_A), x, 106 - bob, i === 1, { h:hr, c:sh });
    });
  if (qOn) arrow(LIB_QUIZ.x + LIB_QUIZ.w / 2 - 1, LIB_QUIZ.y - 14, t);

  for (let i = 0; i < 10; i++) {
    const x = stackX(i), on = isF('stack', 'i', i);
    if (on) { ctx.fillStyle = GLOW; ctx.fillRect(x - 4, 4, STACK_W + 8, 66); }
    px(x - 2, 6, STACK_W + 4, 58, woodDark);
    px(x, 8, STACK_W, 54, shade(R.wall, .7));
    const pool = CATALOG.filter(bk => bk.kdc === KDC[i][0]);
    const rows = [24, 40, 56];
    let si = 0, cur = x + 3;
    for (let n = 0; n < 26 && pool.length; n++) {
      const bk = pool[n % pool.length];
      const w = 2 + ((n * 3 + i) % 3), h = 11 + ((n * 5 + i) % 5);
      if (cur + w > x + STACK_W - 3) { si++; cur = x + 3; }
      if (si > 2) break;
      const by = rows[si] - h;
      px(cur, by, w, h, bk.col);
      px(cur, by, 1, h, 'rgba(255,255,255,.24)');
      px(cur, by + 2, w, 1, 'rgba(0,0,0,.22)');
      cur += w + 1;
    }
    ctx.fillStyle = R.wood; rows.forEach(y => ctx.fillRect(x, y, STACK_W, 2));
    px(x + STACK_W / 2 - 12, 63, 24, 6, '#FBF3E2');   // 이름표 바탕 (글자는 HTML)
    px(x + STACK_W / 2 - 12, 63, 24, 1, '#C4B394');
    if (on) arrow(x + STACK_W / 2 - 1, 54, t);
  }
  place.people.forEach((p, i) => {
    const on = isF('npc2', 'i', i);
    if (on) { ctx.fillStyle = GLOW; ctx.fillRect(p.x - 4, 107, 18, 22); }
    px(p.x + 1, 126, 8, 2, 'rgba(60,45,30,.22)');
    const bob = Math.sin(t / 700 + i * 2) > .6 ? 1 : 0;
    sprite(BODY.up.concat(LEG_A), p.x, 113 - bob, false, { h:p.hair, c:p.shirt });
    if (on) arrow(p.x + 4, 104, t);
  });
}
// 도서관 2층 — 조용한 열람실
function drawLibrary2(t) {
  const R = LIB_SKIN, woodDark = shade(R.wood, .66);
  shellRoom(R, LIB_W);
  drawStairs(R, false, t);

  shopWindow(90, 12, 44, 36);
  shopWindow(500, 12, 44, 36);

  // 고서 서가 — 유리 진열장
  const rOn = isF('rare'), RR = LIB2_RARE;
  if (rOn) { ctx.fillStyle = GLOW; ctx.fillRect(RR.x - 5, RR.y - 4, RR.w + 10, RR.h + 12); }
  px(RR.x - 2, RR.y - 2, RR.w + 4, RR.h + 4, woodDark);
  px(RR.x, RR.y, RR.w, RR.h, '#DCEEF2');
  for (let n = 0; n < 22; n++) {
    const w = 3 + (n % 3), h = 24 + (n * 5 % 14);
    const x2 = RR.x + 5 + n * 4.3;
    if (x2 + w > RR.x + RR.w - 5) break;
    px(x2, RR.y + RR.h - 8 - h, w, h, ['#7A5A44', '#8A6A44', '#6E5236', '#9A7A54'][n % 4]);
  }
  px(RR.x, RR.y + RR.h - 8, RR.w, 2, woodDark);
  if (rOn) arrow(RR.x + RR.w / 2 - 1, RR.y - 8, t);

  // 안락의자 — 앉으면 책을 편다
  LIB2_NOOK.forEach((s, i) => {
    const on = isF('nook', 'i', i), mine = nookSeated === i;
    if (on) { ctx.fillStyle = GLOW; ctx.fillRect(s.x - 6, s.y - 24, 24, 32); }
    px(s.x, s.y - 16, 16, 18, '#8A5A44');
    px(s.x, s.y - 16, 16, 3, shade('#8A5A44', 1.25));
    px(s.x - 3, s.y - 14, 3, 16, shade('#8A5A44', .85));
    px(s.x + 16, s.y - 14, 3, 16, shade('#8A5A44', .85));
    if (mine) {
      sprite(BODY.down.slice(0, 9), s.x + 3, s.y - 24, false);
      px(s.x + 4, s.y - 12, 8, 5, nookRead ? nookRead.col : '#D4645C');
    }
    if (on) arrow(s.x + 8, s.y - 30, t);
  });
}
function drawFlyFx(dt) {
  for (let i = flyFx.length - 1; i >= 0; i--) {
    const f = flyFx[i]; f.t += dt;
    const p = f.t / 1700;
    if (p >= 1) { flyFx.splice(i, 1); continue; }
    blit(BIRD_FLY[((f.t / 110) | 0) % 2], f.x + (world().w + 14 - f.x) * p,
         f.y - 46 * Math.sin(p * Math.PI * .62) - p * 14, BIRD_PAL, false);
  }
}

// ── 충돌 ──────────────────────────────────────────────────────
function solids() {
  if (!inTown()) return [];
  const out = [POND, { x:BUS.x + 6, y:BUS.y + 2, w:BUS.w - 12, h:10 }];
  [BLD.lib, BLD.used, BLD.post, BLD.train, BLD.air].forEach(b =>
    out.push({ x:b.x - 4, y:b.y - 14, w:b.w + 8, h:b.h + 12 }));
  town().houses.forEach(h => out.push({ x:h.x - 4, y:h.y - 14, w:h.w + 8, h:h.h + 12 }));
  return out;
}
function blocked(fx, fy) {
  for (const s of solids())
    if (fx > s.x && fx < s.x + s.w && fy > s.y && fy < s.y + s.h) return true;
  return false;
}

// ── 루프 ──────────────────────────────────────────────────────
let last = 0, frames = 0, loopBroken = false;
function loop(t) {
  // 한 프레임이 터져도 화면이 통째로 멈추지 않게 감싼다
  try { frame(t); }
  catch (e) {
    if (!loopBroken) {
      loopBroken = true;
      const where = (e.stack || '').split('\n')[1] || '';
      if (window.__crash) window.__crash('그리는 중 오류 : ' + e.message + '\n' + where.trim());
      else console.error(e);
    }
  }
  requestAnimationFrame(loop);
}
function frame(t) {
  frames++;
  const dt = Math.min(50, t - last); last = t;
  const wd = world();

  // 걷기 — 키보드와 클릭 목표를 같은 길로 처리한다
  let dx = 0, dy = 0;
  const frozen = openOv || drag || dialog;
  if (skate) {
    // 얼음 위를 도는 동안은 입력을 안 받고, 원을 그리며 미끄러진다
    skate.t += dt; skate.a += dt / 260;
    player.x = skate.cx + Math.cos(skate.a) * skate.r - 5;
    player.y = skate.cy + Math.sin(skate.a) * skate.r * .55 - 13;
    const vx = -Math.sin(skate.a), vy = Math.cos(skate.a) * .55;
    player.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
    player.moving = true; player.anim++;
    if (skate.t >= skate.dur) {
      skate = null;
      Audio8.play('right');
      toast('⛸ 한 바퀴 크게 돌았어요 · 넘어지지 않았습니다');
    }
  } else {
    if (!frozen) {
      if (held('arrowleft', 'a'))  { dx--; walkTo = null; }
      if (held('arrowright', 'd')) { dx++; walkTo = null; }
      if (held('arrowup', 'w'))    { dy--; walkTo = null; }
      if (held('arrowdown', 's'))  { dy++; walkTo = null; }
      if (!dx && !dy && walkTo) {
        const gx = walkTo.x - (player.x + 5), gy = walkTo.y - (player.y + 13);
        const arrived = walkTo.then && walkTo.then.m === 'x'
          ? Math.abs(gx) < 4 : Math.hypot(gx, gy) < 6;
        if (arrived) {
          const th = walkTo.then; walkTo = null;
          if (th) act(th);
        } else { dx = gx; dy = gy; }
        // 벽에 막혀 더 못 가면 포기한다
        if (walkTo && ++walkTo.stuck > 900) walkTo = null;
      }
    }
    player.moving = !!(dx || dy);
    if (player.moving) {
      const L = Math.hypot(dx, dy), sp = inTown() ? 1.05 : .85;
      const ux = dx / L, uy = dy / L;
      player.dir = Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');
      const nx = player.x + ux * sp, ny = player.y + uy * sp;
      if (!blocked(nx + 5, player.y + 13)) player.x = nx;
      if (!blocked(player.x + 5, ny + 13)) player.y = ny;
      player.anim++;
      Audio8.footstep(inTown());
    } else player.anim = 0;
  }

  player.x = Math.max(PAD, Math.min(wd.w - 10 - PAD, player.x));
  player.y = inTown() ? Math.max(8, Math.min(TOWN.h - 16, player.y))
           : inRide() ? Math.max(RT + 22, Math.min(H - 16, player.y))
           : Math.max(RT - 8, Math.min(RB, player.y));
  camX = Math.round(Math.max(0, Math.min(Math.max(0, wd.w - VW), player.x + 5 - VW / 2)));
  camY = Math.round(Math.max(0, Math.min(Math.max(0, wd.h - VH), player.y + 7 - VH / 2)));

  // 마을 사람들 — 자기 자리 근처를 천천히 오간다
  if (inTown()) npcs.forEach(n => {
    if (!n.home) n.home = { x: n.x, y: n.y };        // 자리가 없으면 지금 자리를 자기 자리로
    if (n.wait === undefined) { n.wait = Math.random() * 3000; n.tx = n.x; n.ty = n.y; }
    if (n.wait > 0) { n.wait -= dt; n.moving = false; n.anim = 0; n.dir = 'down'; return; }
    const gx = n.tx - n.x, gy = n.ty - n.y, d = Math.hypot(gx, gy);
    if (d < 2) {
      n.tx = n.home.x + (Math.random() * 44 - 22);
      n.ty = n.home.y + (Math.random() * 26 - 13);
      n.wait = 1200 + Math.random() * 3600;
      n.moving = false; n.anim = 0; return;
    }
    const ux = gx / d, uy = gy / d, sp = .32;
    const nx = n.x + ux * sp, ny = n.y + uy * sp;
    if (!blocked(nx + 5, n.y + 13)) n.x = nx; else n.tx = n.x;
    if (!blocked(n.x + 5, ny + 13)) n.y = ny; else n.ty = n.y;
    n.dir = Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');
    n.moving = true; n.anim++;
  });

  for (let i = flights.length - 1; i >= 0; i--) {
    if (t >= flights[i].arriveAt) {
      const f = flights.splice(i, 1)[0];
      // 실제 배달은 보낼 때 이미 서버로 끝났다 — 여기서는 내 화면에서만 도착 연출을 마무리한다
      Audio8.play('mail');
      toast('🕊 ' + f.toWho + '에게 문장이 도착했어요');
    }
  }
  renderFlights(t);

  const key0 = focus && focus.type + (focus.book ? focus.book.t : '') + (focus.to ?? focus.i ?? '');
  focus = (edit || openOv || dialog) ? null : nearest();
  const key1 = focus && focus.type + (focus.book ? focus.book.t : '') + (focus.to ?? focus.i ?? '');
  if (key1 && key1 !== key0) Audio8.play('hover');

  // 초점 말풍선
  const tip = $('tip');
  if (focus && !edit && !openOv && !dialog) {
    const ds = dispScale();
    tip.textContent = focus.label;
    tip.style.left = ((focus.px - camX) * SCALE * ds) + 'px';
    tip.style.top  = ((focus.py - camY) * SCALE * ds - 24) + 'px';
    tip.classList.add('on');
  } else tip.classList.remove('on');
  updateLive(dt); renderNames();
  if (inTown()) updateTrain(dt);
  if (inRide()) updateRide(dt);
  skipCharge(dt); updateSkip(dt);
  placeBubble(); placeLabels();

  ctx.clearRect(0, 0, VW, VH);
  ctx.save(); ctx.translate(-camX, -camY);
  if (inTown()) drawTown(t);
  else if (inLib()) drawLibrary(t);
  else if (inUsed()) drawUsed(t);
  else if (inRide()) drawRide(t);
  else if (inJazz()) drawJazz(t);
  else if (inShop()) drawShop(t);
  else drawRoom(room(), t);
  if (!solo) drawLive();
  updatePet(dt); drawPet(t);
  person(player.x, player.y, player.dir, player.moving, player.anim);
  updateEating(dt); drawEating(t);
  drawFlyFx(dt);

  // 날씨 — 실외는 비·눈·구름, 실내는 창으로 들어오는 햇살
  if (inTown()) {
    if (SEASON.fall && SEASON.fall !== 'snow' && petals.length) {
      const c = SEASON.key === 'spring' ? '#F2C0CE' : '#D9642E';
      petals.forEach(p => {
        p.y += p.sp; p.x += Math.sin(t / 800 + p.sw) * .35;
        if (p.y > TOWN.h) { p.y = -6; p.x = Math.random() * TOWN.w; }
        px(p.x, p.y, 3, 2, c);
      });
    }
    Weather.outdoor(WEATHER, camX, camY, VW, VH, t, px);
  } else if (inRoom()) {
    const win = room().items.find(i => i.kind === 'window');
    Weather.indoor(WEATHER, win, RT, H, t, px);
  }
  ctx.restore();

  // 번개 — 화면 전체가 번쩍인다
  boltFlash = Weather.thunderTick(WEATHER, dt, () => Audio8.play('thunder'));
  const fa = Weather.flashAlpha(boltFlash);
  if (fa > 0) { ctx.fillStyle = 'rgba(240,246,255,' + fa.toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH); }

  vctx.imageSmoothingEnabled = false;
  vctx.drawImage(buf, 0, 0, VW, VH, 0, 0, VW * SCALE, VH * SCALE);
  drawMini();
}

spawnTown(); scatterDrops(); spawnLive();
renderDex(); refreshUI(); buildTrackList(); renderAcct();
renderPocket(); renderDateTime(); applyAmbience();

// 시작 화면 — 로그인하거나 둘러보기로 들어온 뒤에 마을이 열린다
Net.onChange(() => { if (openOv === 'visit') renderVisit(); });
Gate.open(async () => {
  Audio8.startMusic();
  $('music').classList.add('on');
  $('music').textContent = '♪ ' + Audio8.tracks[Audio8.trackIdx].name;
  buildTrackList();
  if (Net.online) {
    if (Net.who) ROOMS[0].who = Net.who;
    // 서버에 저장된 내 방을 먼저 받아온다 — 안 그러면 로컬 기본 방(예시 책 4권)을
    // 그대로 밀어써서, 다른 기기에서 로그인하거나 새로고침할 때마다 실제로
    // 꾸며둔 책장이 초기 상태로 지워지는 심각한 버그가 된다.
    if (!Net.isGuest) {
      try {
        const s = await Net.room(Net.code);
        if (s) {
          Object.assign(ROOMS[0], {
            who: s.who || ROOMS[0].who, bio: s.bio ?? ROOMS[0].bio,
            village: s.village || ROOMS[0].village,
            wall: s.wall || ROOMS[0].wall, floor: s.floor || ROOMS[0].floor,
            wood: s.wood || ROOMS[0].wood, rug: s.rug || ROOMS[0].rug,
            hair: s.hair || ROOMS[0].hair, shirt: s.shirt || ROOMS[0].shirt,
          });
          if (s.items && s.items.length) ROOMS[0].items = s.items.map(it => Object.assign({ id: uid++ }, it));
          // 친구가 보낸 편지 — snapshot()/syncRoom() 은 letters 를 건드리지 않는다.
          // 같이 왕복시키면, 내가 온라인인 동안 딴 데서 온 편지를 내 예전 상태로 덮어써 지울 수 있어서다.
          if (s.letters && s.letters.length) ROOMS[0].letters = s.letters;
          ROOMS[0].freeNotes = s.freeNotes || [];
          // 필사대(journal)는 나중에 추가된 기본 가구라, 예전에 저장해둔 방에는 없다 — 없으면 넣어준다
          if (!ROOMS[0].items.some(it => it.kind === 'journal'))
            ROOMS[0].items.push({ id: uid++, kind:'journal', x:326, y:18, w:26, h:32 });
          // 창문도 마찬가지 — 원래 방엔 없었다. 계절·날씨가 비치는 창을 기본으로 하나 넣어준다
          if (!ROOMS[0].items.some(it => it.kind === 'window'))
            ROOMS[0].items.push({ id: uid++, kind:'window', x:354, y:14, w:24, h:34 });
          if (!vidx(ROOMS[0].village)) ROOMS[0].village = VIL[0].key;
          layoutRoom(ROOMS[0]);
          // 도감(readKdc)·빌려온 책(borrowed)은 따로 저장되지 않으니, 불러온
          // 책 상태에서 다시 계산한다 — 안 그러면 새로고침마다 도감이 비어 보인다.
          readKdc.clear(); borrowed.clear();
          shelves(ROOMS[0]).forEach(sh => sh.books.forEach(bk => {
            if (bk.done) readKdc.add(bk.kdc);
            if (bk.from) borrowed.add(bk.t);
          }));
          renderDex(); renderStats();
        }
      } catch (e) { /* 아직 저장된 방이 없는 새 계정 — 기본 방 그대로 둔다 */ }
    }
    refreshUI();
    syncRoom();
    toast('🚪 ' + (Net.who || '') + ' 님, 내 코드는 ' + Net.code + ' 입니다');
  } else {
    toast('혼자 모드로 들어왔어요 · 친구와 함께하려면 서버를 켜주세요');
  }
});
setInterval(() => { if (Net.online) syncRoom(); }, 30000);   // 놓친 변경 대비
addEventListener('beforeunload', () => {
  if (Net.online) { Net.push(snapshot()); Net.flush(); }
  if (Net.online && inJazz()) Net.jazzLeave();
});
requestAnimationFrame(loop);
