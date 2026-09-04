// ════════════════════════════════════════════════════════════════
//  그림 — 스프라이트 · 도트 변환 · 지역 랜드마크 · 전국 지도
//  Art.bind(ctx) 로 그릴 캔버스를 먼저 물린다.
// ════════════════════════════════════════════════════════════════

const Art = (() => {
  let ctx = null;
  const bind = c => { ctx = c; };

  // ── 색 도우미 ─────────────────────────────────────────────
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16), cl = v => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + ((1 << 24) | (cl(((n >> 16) & 255) * f) << 16) |
      (cl(((n >> 8) & 255) * f) << 8) | cl((n & 255) * f)).toString(16).slice(1);
  }
  function hue(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return -1;
    let h;
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  }
  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w, h); };

  // ── 아바타 (10 × 14) ──────────────────────────────────────
  const SPR = { '.': null, 'k': '#3A2E28', 'h': '#7a4f3a', 's': '#F7D6B0', 'c': '#7fa88a', 'p': '#5A6E96' };
  const LEG_A = ['..pppppp..', '..pp..pp..', '..kk..kk..'];
  const LEG_B = ['..pppppp..', '..pppppp..', '...kkkk...'];
  const BODY = {
    down: ['...hhhh...', '..hhhhhh..', '.hhhhhhhh.', '.hssssssh.', '.hskssksh.',
           '.hssssssh.', '..ssssss..', '..cccccc..', '.sccccccs.', '.sccccccs.', '..cccccc..'],
    up:   ['...hhhh...', '..hhhhhh..', '.hhhhhhhh.', '.hhhhhhhh.', '.hhhhhhhh.',
           '.hhhhhhhh.', '..ssssss..', '..cccccc..', '.sccccccs.', '.sccccccs.', '..cccccc..'],
    side: ['..hhhh....', '.hhhhhh...', '.hhhhhhs..', '.hhsssss..', '.hhsksss..',
           '.hhsssss..', '..ssssss..', '..cccccc..', '..ccccccs.', '..cccccc..', '..cccccc..'],
  };
  // ── 새 (9 × 7) ────────────────────────────────────────────
  const BIRD_PAL = { '.': null, 'b': '#B08A5E', 'w': '#8A6A44', 'k': '#3A2E28', 'o': '#E8B45A', 't': '#6E5236' };
  const BIRD_FLY = [
    ['...ww....', '..wwww...', '.bbbbbb..', 'tbbbbbbko', '.tbbbbb..', '..b..b...', '.........'],
    ['.........', '.bbbbbb..', 'tbbbbbbko', '.twwwwb..', '..wwww...', '...ww....', '.........'],
  ];
  const BIRD_SIT = ['.........', '..bbbb...', '.bbbbbbko', '.bwwwwb..', '.tbbbbb..', '..k..k...', '.........'];

  function blit(rows, x, y, pal, flip) {
    x = Math.round(x); y = Math.round(y);
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < rows[r].length; c++) {
        const hex = pal[rows[r][c]]; if (!hex) continue;
        ctx.fillStyle = hex;
        ctx.fillRect(x + (flip ? rows[r].length - 1 - c : c), y + r, 1, 1);
      }
  }
  const sprite = (rows, x, y, flip, over) =>
    blit(rows, x, y, over ? Object.assign({}, SPR, over) : SPR, flip);

  function person(x, y, dir, walking, anim, over) {
    px(x + 1, y + 13, 8, 2, 'rgba(60,45,30,.26)');
    const legs = walking && (((anim / 9) | 0) % 2) ? LEG_B : LEG_A;
    const body = dir === 'up' ? BODY.up : dir === 'down' ? BODY.down : BODY.side;
    sprite(body.concat(legs), x, y, dir === 'left', over);
  }

  // ── 도트 변환 ─────────────────────────────────────────────
  function pixelateImage(img, tw, th) {
    const cv = document.createElement('canvas'); cv.width = tw; cv.height = th;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = true;
    const s = Math.max(tw / img.width, th / img.height);
    const dw = img.width * s, dh = img.height * s;
    g.drawImage(img, (tw - dw) / 2, (th - dh) / 2, dw, dh);
    const d = g.getImageData(0, 0, tw, th).data, out = [];
    const q = v => Math.min(255, Math.round(v / 36) * 36);
    for (let i = 0; i < tw * th; i++)
      out.push('#' + ((1 << 24) | (q(d[i * 4]) << 16) | (q(d[i * 4 + 1]) << 8) | q(d[i * 4 + 2]))
        .toString(16).slice(1));
    return { w: tw, h: th, px: out };
  }
  function makeArt(w, h, fn) {
    const out = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push(fn(x, y));
    return { w, h, px: out };
  }
  function drawArt(art, x, y) {
    for (let r = 0; r < art.h; r++) for (let c = 0; c < art.w; c++) {
      const col = art.px[r * art.w + c]; if (!col) continue;
      ctx.fillStyle = col; ctx.fillRect(x + c, y + r, 1, 1);
    }
  }
  const ART_HILL = makeArt(20, 26, (x, y) => {
    if (y > 19) return ['#7FA86A', '#74A05F', '#6A9656'][(x + y) % 3];
    const m = 20 - Math.round(4 * Math.sin(x / 3) + (x < 10 ? x * .6 : (19 - x) * .5));
    if (y >= m) return y === m ? '#A8BCC8' : '#8298B0';
    if (x === 14 && y === 4) return '#FFF3C4';
    if ((x === 13 || x === 15) && y === 4) return '#F0E0A0';
    if (x === 14 && (y === 3 || y === 5)) return '#F0E0A0';
    return ['#BEE0F0', '#CFE9F5', '#E2F1F8'][Math.floor(y / 9)];
  });
  const ART_WAVE = makeArt(20, 26, (x, y) => {
    const w1 = 13 + Math.round(3 * Math.sin(x / 2.4)), w2 = 18 + Math.round(2 * Math.cos(x / 3.1));
    if (y >= w2) return '#3A7AA0';
    if (y >= w1) return (x + y) % 4 === 0 ? '#F4FAFD' : '#5E9EC4';
    if (y === w1 - 1) return '#F4FAFD';
    return ['#FBF0DA', '#F7E8CC', '#F2DDB8'][Math.floor(y / 5) % 3];
  });

  // ══ 지역 랜드마크 ═══════════════════════════════════════
  //  각 함수는 (x, y) 를 밑변 가운데로 삼아 위로 그린다.
  const LANDMARK = {
    // N서울타워
    seoul(x, y) {
      px(x - 14, y - 8, 28, 8, '#6E8A5E'); px(x - 10, y - 11, 20, 3, '#7FA06E');
      px(x - 3, y - 40, 6, 32, '#C8C0B4'); px(x - 2, y - 40, 2, 32, '#E0DAD0');
      px(x - 9, y - 50, 18, 10, '#9AA6B0'); px(x - 9, y - 50, 18, 2, '#B8C2CC');
      px(x - 7, y - 47, 14, 4, '#7FC4E0');
      px(x - 5, y - 55, 10, 5, '#8A96A2');
      px(x - 1, y - 68, 2, 13, '#B0B8C0'); px(x - 1, y - 70, 2, 2, '#D4645C');
    },
    // 인천대교
    incheon(x, y) {
      px(x - 30, y - 6, 60, 6, '#7FB8D8'); px(x - 30, y - 3, 60, 1, '#A8D4EC');
      px(x - 30, y - 12, 60, 4, '#D8D2C4'); px(x - 30, y - 12, 60, 1, '#EFEAE0');
      [-14, 14].forEach(o => {
        px(x + o - 2, y - 44, 4, 32, '#C4BCAE');
        px(x + o - 5, y - 30, 10, 3, '#B0A89A');
        for (let i = 1; i < 13; i++) {
          px(x + o - 1 - i, y - 44 + i * 2.4, 1, 1, '#98A4AE');
          px(x + o + 1 + i, y - 44 + i * 2.4, 1, 1, '#98A4AE');
        }
      });
    },
    // 소양강 스카이워크와 배
    chuncheon(x, y) {
      px(x - 30, y - 10, 60, 10, '#6EA8CC'); px(x - 30, y - 10, 60, 1, '#9CCCE4');
      for (let i = 0; i < 6; i++) px(x - 26 + i * 10, y - 6, 5, 1, '#B0DCF0');
      px(x - 22, y - 20, 44, 3, '#E4DCCC'); px(x - 22, y - 17, 44, 1, '#C0B6A4');
      [-18, 0, 18].forEach(o => px(x + o - 1, y - 17, 2, 8, '#B0A694'));
      px(x + 8, y - 16, 16, 4, '#F0EAD8');
      px(x - 20, y - 8, 12, 4, '#C4785E'); px(x - 20, y - 11, 3, 3, '#EFE4D0');
    },
    // 경포 바다와 등대
    gangneung(x, y) {
      px(x - 30, y - 12, 60, 12, '#5EA0C8'); px(x - 30, y - 12, 60, 1, '#8FC8E4');
      for (let i = 0; i < 7; i++) px(x - 28 + i * 9, y - 8 + (i % 2), 6, 1, '#BCE0F0');
      px(x - 30, y - 4, 60, 4, '#E8DCC0');
      px(x + 12, y - 34, 8, 22, '#F2F2F2');
      px(x + 12, y - 30, 8, 3, '#D4645C'); px(x + 12, y - 22, 8, 3, '#D4645C');
      px(x + 11, y - 40, 10, 6, '#B8C4CC'); px(x + 13, y - 39, 6, 4, '#FFE9A8');
      px(x + 14, y - 43, 4, 3, '#8A96A2');
    },
    // 대전 한빛탑
    daejeon(x, y) {
      px(x - 16, y - 6, 32, 6, '#8AB07E');
      px(x - 4, y - 40, 8, 34, '#D8D2C4'); px(x - 3, y - 40, 3, 34, '#EFEAE0');
      px(x - 11, y - 46, 22, 7, '#9AA6B0'); px(x - 9, y - 44, 18, 3, '#7FC4E0');
      px(x - 7, y - 52, 14, 6, '#B0B8C0');
      px(x - 1, y - 62, 2, 10, '#C4BCAE'); px(x - 3, y - 64, 6, 3, '#E8C46A');
    },
    // 전주 한옥마을
    jeonju(x, y) {
      [[-24, 0], [0, -6], [24, 2]].forEach(([o, dy]) => {
        const b = y + dy;
        px(x + o - 14, b - 12, 28, 12, '#EFE6D2');
        px(x + o - 14, b - 14, 28, 3, '#6E5E4E');
        for (let i = 0; i < 9; i++) px(x + o - 16 + i * 4, b - 18 + Math.abs(i - 4), 4, 5, '#4A4238');
        px(x + o - 18, b - 15, 36, 3, '#5A5044');
        px(x + o - 4, b - 9, 8, 9, '#A87A4E');
        px(x + o - 11, b - 9, 5, 5, '#D8CDB4'); px(x + o + 6, b - 9, 5, 5, '#D8CDB4');
      });
    },
    // 광주 무등산
    gwangju(x, y) {
      px(x - 34, y - 4, 68, 4, '#7FA86A');
      const peaks = [[-20, 26], [2, 34], [20, 24]];
      peaks.forEach(([o, h]) => {
        for (let i = 0; i < h; i++) {
          const w = Math.round((h - i) * 1.15);
          px(x + o - w, y - 4 - i, w * 2, 1, i < 4 ? '#B8C4CC' : i < h * .5 ? '#7A8A72' : '#5F7A5A');
        }
      });
      px(x - 4, y - 38, 3, 8, '#C8CED4'); px(x + 1, y - 36, 3, 6, '#C8CED4');
      px(x + 6, y - 34, 3, 5, '#C8CED4');
    },
    // 대구 83타워
    daegu(x, y) {
      px(x - 18, y - 6, 36, 6, '#8AB07E');
      px(x - 5, y - 36, 10, 30, '#D0CABC');
      px(x - 3, y - 36, 3, 30, '#EAE4D8');
      px(x - 10, y - 44, 20, 9, '#A8B0BA'); px(x - 8, y - 42, 16, 4, '#7FC4E0');
      px(x - 6, y - 50, 12, 6, '#BCC4CC');
      px(x - 1, y - 62, 2, 12, '#C4BCAE');
      px(x - 2, y - 64, 4, 3, '#E8C46A');
    },
    // 경주 첨성대와 능
    gyeongju(x, y) {
      px(x - 34, y - 4, 68, 4, '#8AB07E');
      [[-24, 14], [-2, 10]].forEach(([o, h]) => {                    // 능
        for (let i = 0; i < h; i++) {
          const w = Math.round(Math.sqrt(1 - (i / h) ** 2) * h * 1.5);
          px(x + o - w, y - 4 - i, w * 2, 1, i < 3 ? '#96BE84' : '#7FA86A');
        }
      });
      const cx = x + 22;                                             // 첨성대
      for (let i = 0; i < 22; i++) {
        const w = 9 - Math.round(Math.abs(i - 15) * .18) - (i > 17 ? 1 : 0);
        px(cx - w, y - 5 - i, w * 2, 1, i % 3 === 0 ? '#B0A490' : '#C4B8A2');
      }
      px(cx - 4, y - 18, 8, 5, '#6E6454');
      px(cx - 10, y - 27, 20, 3, '#A89C88'); px(cx - 8, y - 30, 16, 3, '#B8AC98');
    },
    // 부산 광안대교와 바다
    busan(x, y) {
      px(x - 34, y - 10, 68, 10, '#4A90BE'); px(x - 34, y - 10, 68, 1, '#7FBCDC');
      for (let i = 0; i < 8; i++) px(x - 30 + i * 9, y - 6 + (i % 2), 5, 1, '#A8D4EC');
      px(x - 34, y - 16, 68, 4, '#DED8CA'); px(x - 34, y - 16, 68, 1, '#F2ECE0');
      [-16, 16].forEach(o => {
        px(x + o - 2, y - 46, 4, 30, '#C8C0B0');
        px(x + o - 6, y - 40, 12, 3, '#B4AC9C');
      });
      for (let i = 0; i <= 32; i++) {                                // 현수 케이블
        const t = i / 32, cy = y - 46 + Math.sin(t * Math.PI) * 22;
        px(x - 16 + i, cy, 1, 1, '#98A4AE');
      }
      [-10, -4, 4, 10].forEach(o => px(x + o, y - 40, 1, 8, '#A8B0B8'));
      px(x + 22, y - 22, 5, 6, '#E8E2D4'); px(x + 28, y - 26, 5, 10, '#E8E2D4');
    },
    // 제주 성산일출봉과 돌하르방
    jeju(x, y) {
      px(x - 34, y - 8, 68, 8, '#5EA0C8'); px(x - 34, y - 8, 68, 1, '#8FC8E4');
      px(x - 34, y - 3, 68, 3, '#C8C0AE');
      const bx = x - 6;
      for (let i = 0; i < 26; i++) {                                 // 분화구 능선
        const w = Math.round(20 - i * .45);
        const notch = i < 4 ? Math.round(Math.sin(i * 1.6) * 2) : 0;
        px(bx - w + notch, y - 8 - i, w * 2, 1,
           i < 3 ? '#8A9E7A' : i < 14 ? '#6E8A5E' : '#5A7A52');
      }
      px(bx - 14, y - 34, 4, 3, '#7A8E6A'); px(bx + 4, y - 33, 5, 3, '#7A8E6A');
      const hx = x + 26;                                             // 돌하르방
      px(hx - 4, y - 12, 8, 12, '#8A8A82'); px(hx - 5, y - 22, 10, 10, '#96968E');
      px(hx - 3, y - 19, 2, 2, '#4A4A44'); px(hx + 1, y - 19, 2, 2, '#4A4A44');
      px(hx - 2, y - 15, 4, 1, '#4A4A44');
      px(hx - 6, y - 25, 12, 4, '#82827A');
    },
  };

  // ══ 전국 지도 ═══════════════════════════════════════════
  //  남한 윤곽을 24 × 33 격자로 대략 잡았다.
  const KOREA = [
    '........######..........',
    '......##########........',
    '....##############......',
    '...################.....',
    '..#################.....',
    '..##################....',
    '.###################....',
    '.###################....',
    '.####################...',
    '..###################...',
    '..###################...',
    '..###################...',
    '...##################...',
    '...##################...',
    '..###################...',
    '..###################...',
    '..###################...',
    '..###################...',
    '...##################...',
    '...#################....',
    '...#################....',
    '..##################....',
    '..#################.....',
    '..################......',
    '..###############.......',
    '...#############........',
    '...###########..........',
    '....########............',
    '.....#####..............',
    '........................',
    '..###...................',
    '.#####..................',
    '..###...................',
  ];
  // 지도 캔버스에 한반도와 지역 표시를 그린다
  function drawKorea(g, cell, regions, curIdx, hoverIdx) {
    const W = KOREA[0].length * cell, H = KOREA.length * cell;
    g.clearRect(0, 0, W, H);
    for (let r = 0; r < KOREA.length; r++)
      for (let c = 0; c < KOREA[r].length; c++) {
        if (KOREA[r][c] !== '#') continue;
        const edge = ['#', undefined].indexOf(KOREA[r - 1]?.[c]) < 0 ||
                     KOREA[r][c - 1] !== '#' || KOREA[r][c + 1] !== '#' ||
                     KOREA[r + 1]?.[c] !== '#';
        g.fillStyle = edge ? '#B4CBA0' : '#CFE0BC';
        g.fillRect(c * cell, r * cell, cell, cell);
      }
    regions.forEach((rg, i) => {
      const x = rg.mx * cell + cell / 2, y = rg.my * cell + cell / 2;
      const here = i === curIdx, hot = i === hoverIdx;
      if (here || hot) {
        g.fillStyle = here ? 'rgba(184,130,58,.28)' : 'rgba(122,95,168,.22)';
        g.beginPath(); g.arc(x, y, cell * 2.2, 0, 7); g.fill();
      }
      g.fillStyle = here ? '#B8823A' : '#5A6E52';
      g.beginPath(); g.arc(x, y, cell * .62, 0, 7); g.fill();
      g.fillStyle = '#FBF7EF';
      g.beginPath(); g.arc(x, y, cell * .26, 0, 7); g.fill();
    });
  }
  const koreaSize = cell => ({ w: KOREA[0].length * cell, h: KOREA.length * cell });
  function regionAt(mx, my, cell, regions) {
    let best = -1, bd = cell * 2.6;
    regions.forEach((rg, i) => {
      const d = Math.hypot(mx - (rg.mx * cell + cell / 2), my - (rg.my * cell + cell / 2));
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  return { bind, shade, hue, px, blit, sprite, person, BODY, LEG_A, LEG_B, SPR,
           BIRD_PAL, BIRD_FLY, BIRD_SIT, pixelateImage, makeArt, drawArt,
           ART_HILL, ART_WAVE, LANDMARK, drawKorea, koreaSize, regionAt };
})();
