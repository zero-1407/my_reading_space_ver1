// ════════════════════════════════════════════════════════════════
//  계절과 절기 — 실제 오늘 날짜를 따라간다
//
//   봄  벚꽃 · 민들레      여름 짙은 초록 · 소나기
//   가을 단풍 · 은행 · 추석 겨울 눈 · 크리스마스 · 설날
//
//   주운 것은 주머니에 들어가고, 책 사이에 눌러 끼울 수 있다.
// ════════════════════════════════════════════════════════════════

const Season = (() => {
  // 음력 명절을 양력으로 옮겨 적은 표 (2025 ~ 2030)
  const SEOLLAL = ['2025-01-29','2026-02-17','2027-02-06','2028-01-26','2029-02-13','2030-02-03'];
  const CHUSEOK = ['2025-10-06','2026-09-25','2027-09-15','2028-10-03','2029-09-22','2030-09-12'];

  const iso = d => d.toISOString().slice(0, 10);
  const mk = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const days = (a, b) => Math.round((b - a) / 86400000);

  // 잎·꽃 — 계절마다 주울 수 있는 것이 다르다
  const ITEMS = {
    maple:    { name:'단풍잎',     emo:'🍁', col:['#C4462E','#D9642E','#B03A2E'] },
    ginkgo:   { name:'은행잎',     emo:'🌿', col:['#E0B43A','#D4A22E','#EAC65A'] },
    pine:     { name:'솔잎',       emo:'🌲', col:['#3F6B3A','#4E7A44'] },
    acorn:    { name:'도토리',     emo:'🌰', col:['#8A6440','#6E4E30'] },
    cherry:   { name:'벚꽃잎',     emo:'🌸', col:['#F2C0CE','#E8A8BC','#FBD8E2'] },
    dandelion:{ name:'민들레',     emo:'🌼', col:['#F0D45A','#E8C43A'] },
    clover:   { name:'네잎클로버', emo:'🍀', col:['#4E9A4E','#5FAE5F'] },
    shell:    { name:'조개껍데기', emo:'🐚', col:['#F0E2D0','#E0CCB4'] },
    camellia: { name:'동백꽃',     emo:'🌺', col:['#C4304A','#D9445E'] },
    holly:    { name:'호랑가시잎', emo:'🌿', col:['#2E6B3A','#3F7A4A'] },
  };

  // 축제 — 그날에만 마을에 생기는 것들
  function festivalOf(d) {
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    const seol = SEOLLAL.find(s => s.startsWith(y)), chu = CHUSEOK.find(s => s.startsWith(y));
    if (chu) { const k = days(mk(chu), d); if (k >= -1 && k <= 1) return {
      key:'chuseok', name:'추석', emo:'🌕',
      blurb:'보름달이 떴어요. 평상에서 송편을 빚고, 마당에서 연을 날립니다.' }; }
    if (seol) { const k = days(mk(seol), d); if (k >= -1 && k <= 1) return {
      key:'seollal', name:'설날', emo:'🎊',
      blurb:'마을 어귀에 윷판이 깔렸어요. 떡국 한 그릇 하고 가세요.' }; }
    if (m === 12 && day >= 20 && day <= 26) return {
      key:'christmas', name:'크리스마스', emo:'🎄',
      blurb:'광장에 트리가 섰습니다. 책 한 권씩 걸어두는 게 이 마을 방식이에요.' };
    if ((m === 12 && day >= 30) || (m === 1 && day <= 3)) return {
      key:'newyear', name:'새해', emo:'🎆',
      blurb:'해가 바뀝니다. 올해 읽을 책 한 권을 정해두는 자리예요.' };
    if (m === 4 && day <= 15) return {
      key:'cherry', name:'벚꽃', emo:'🌸',
      blurb:'벚꽃이 한창이에요. 떨어지는 꽃잎을 주워 책에 끼울 수 있습니다.' };
    if ((m === 10 && day >= 15) || (m === 11 && day <= 10)) return {
      key:'foliage', name:'단풍철', emo:'🍁',
      blurb:'단풍이 절정이에요. 잎이 제일 곱게 물드는 열흘입니다.' };
    return null;
  }

  function of(date) {
    const d = date || new Date();
    const m = d.getMonth() + 1, day = d.getDate();
    const key = m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer'
              : m >= 9 && m <= 11 ? 'autumn' : 'winter';
    const S = {
      spring: { name:'봄', grass:'#8FC878', sky:'#BCE2F4', leaf:'#7CC26E',
                blossom:'#F2C0CE', items:['cherry','dandelion','clover'], fall:'cherry' },
      summer: { name:'여름', grass:'#6FB05E', sky:'#9ED4F2', leaf:'#3F8A44',
                blossom:'#E8E45A', items:['clover','shell','pine'], fall:null },
      autumn: { name:'가을', grass:'#A8B46A', sky:'#BEDCEE', leaf:'#C4762E',
                blossom:'#D9642E', items:['maple','ginkgo','acorn','pine'], fall:'maple' },
      winter: { name:'겨울', grass:'#CFD6CE', sky:'#CFE2EE', leaf:'#8A9A8E',
                blossom:'#C4304A', items:['camellia','holly','pine'], fall:'snow' },
    }[key];
    // 절정기에는 색이 더 진해진다
    const peak = (key === 'autumn' && ((m === 10 && day >= 15) || (m === 11 && day <= 10)))
              || (key === 'spring' && m === 4 && day <= 15);
    return Object.assign({ key, month:m, day, peak, festival: festivalOf(d),
                           label: (d.getMonth() + 1) + '월 ' + day + '일' }, S);
  }

  // ── 계절 나무 ────────────────────────────────────────────────
  function tree(x, y, s, i) {
    const px = Art.px;
    px(x + 5, y + 12, 4, 10, '#8A6440');
    if (s.key === 'winter') {                                  // 앙상한 가지 + 눈
      px(x + 2, y + 6, 3, 7, '#8A6440'); px(x + 9, y + 5, 3, 8, '#8A6440');
      px(x + 4, y + 2, 6, 5, '#9A7450');
      px(x + 1, y + 4, 12, 3, '#F2F6F8'); px(x + 4, y, 7, 3, '#F2F6F8');
      return;
    }
    const c = s.leaf, c2 = Art.shade(c, 1.16);
    px(x - 2, y, 18, 14, c); px(x + 2, y - 5, 10, 7, c); px(x - 4, y + 4, 20, 7, c);
    px(x + 1, y - 3, 6, 5, c2); px(x + 10 + (i % 2), y + 4, 5, 5, c2);
    if (s.key === 'spring') {                                  // 벚꽃
      px(x, y - 4, 4, 3, s.blossom); px(x + 11, y + 1, 4, 3, s.blossom);
      px(x + 5, y + 8, 3, 3, s.blossom); px(x - 3, y + 3, 3, 3, s.blossom);
    }
    if (s.key === 'autumn') {                                  // 물든 잎
      px(x + 3, y - 4, 5, 4, '#D9642E'); px(x + 12, y + 2, 4, 4, '#C4462E');
      px(x - 3, y + 7, 4, 4, '#E0B43A');
      if (s.peak) { px(x + 6, y + 1, 5, 4, '#C4462E'); px(x, y + 9, 4, 3, '#E0B43A'); }
    }
  }

  // ── 바닥에 떨어진 것 ─────────────────────────────────────────
  function drop(kind, x, y, t) {
    const px = Art.px, it = ITEMS[kind]; if (!it) return;
    const c = it.col, bob = Math.sin(t / 700 + x) > .6 ? 1 : 0;
    y -= bob;
    if (kind === 'maple') {
      px(x + 2, y, 3, 1, c[0]); px(x + 1, y + 1, 5, 1, c[0]);
      px(x, y + 2, 7, 2, c[1]); px(x + 2, y + 4, 3, 1, c[0]); px(x + 3, y + 5, 1, 2, '#8A5A32');
    } else if (kind === 'ginkgo') {
      px(x + 1, y, 5, 1, c[0]); px(x, y + 1, 7, 2, c[2] || c[0]);
      px(x + 2, y + 3, 3, 1, c[1]); px(x + 3, y + 4, 1, 2, '#9A7A32');
    } else if (kind === 'acorn') {
      px(x + 1, y, 5, 2, c[1]); px(x + 1, y + 2, 5, 3, c[0]); px(x + 2, y + 5, 3, 1, c[1]);
    } else if (kind === 'pine') {
      px(x, y + 2, 7, 1, c[0]); px(x + 1, y + 1, 5, 1, c[1] || c[0]); px(x + 1, y + 3, 5, 1, c[1] || c[0]);
    } else if (kind === 'cherry') {
      px(x + 1, y, 4, 2, c[2] || c[0]); px(x, y + 2, 6, 2, c[0]); px(x + 2, y + 4, 2, 1, c[1]);
    } else if (kind === 'clover') {
      px(x + 1, y, 2, 2, c[0]); px(x + 4, y, 2, 2, c[0]);
      px(x + 1, y + 3, 2, 2, c[1] || c[0]); px(x + 4, y + 3, 2, 2, c[1] || c[0]);
      px(x + 3, y + 2, 1, 4, '#3F7A3A');
    } else if (kind === 'shell') {
      px(x + 1, y + 1, 5, 3, c[0]); px(x, y + 3, 7, 2, c[1]); px(x + 3, y, 1, 2, c[1]);
    } else {                                                    // 꽃 종류
      px(x + 2, y, 3, 3, c[0]); px(x, y + 2, 7, 3, c[0]);
      px(x + 3, y + 2, 1, 1, '#FBE9A8'); px(x + 3, y + 5, 1, 2, '#4E7A44');
    }
  }

  // ── 축제 오브젝트 ────────────────────────────────────────────
  const FEST = {
    // 크리스마스 트리
    christmas(x, y, t) {
      const px = Art.px;
      px(x - 3, y - 6, 6, 6, '#7A5A38');
      for (let i = 0; i < 7; i++) {
        const w = 26 - i * 3;
        px(x - w / 2, y - 12 - i * 5, w, 6, i % 2 ? '#2E6B3A' : '#3F7A4A');
      }
      const blink = Math.sin(t / 400) > 0;
      [[-8, -18], [6, -24], [-5, -30], [7, -36], [-3, -42], [4, -48]].forEach(([ox, oy], i) => {
        px(x + ox, y + oy, 2, 2, (i % 2 === 0) === blink ? '#FFE08A' : '#D4645C');
      });
      px(x - 3, y - 56, 6, 6, blink ? '#FFF0BC' : '#F0D45A');
      px(x - 1, y - 58, 2, 10, '#FFE08A'); px(x - 5, y - 54, 10, 2, '#FFE08A');
      // 트리에 걸어둔 책들
      ['#D4645C', '#4A6EB0', '#EAB45A'].forEach((c, i) => px(x - 9 + i * 9, y - 22 + (i % 2) * 8, 5, 7, c));
    },
    // 추석 — 보름달과 방아 찧는 토끼, 평상
    chuseok(x, y, t) {
      const px = Art.px, mx = x + 4, my = y - 74;
      px(mx - 20, my - 20, 40, 40, 'rgba(255,246,200,.16)');    // 달무리
      for (let r = 18; r > 0; r--) {                            // 보름달
        const w = Math.round(Math.sqrt(18 * 18 - (18 - r) * (18 - r)) * 2);
        px(mx - w / 2, my - 18 + (18 - r), w, 1, r > 15 ? '#FFF6D4' : '#FBEEB8');
      }
      px(mx - 8, my - 6, 5, 4, '#F0DFA0'); px(mx + 4, my + 2, 4, 3, '#F0DFA0');
      const pound = Math.sin(t / 260) > 0 ? 0 : 2;              // 절구 찧는 토끼
      px(mx - 5, my - 3, 5, 6, '#FFFFFF');
      px(mx - 5, my - 8, 2, 5, '#FFFFFF'); px(mx - 2, my - 8, 2, 5, '#FFFFFF');
      px(mx - 4, my - 4, 1, 1, '#C48A9A');
      px(mx, my - 6 + pound, 4, 2, '#C4A484');
      px(mx + 2, my + 1, 6, 4, '#8A7A5E'); px(mx + 3, my + 2, 4, 2, '#EFE4C8');
      // 평상
      px(x - 22, y - 10, 44, 4, '#B08A5E'); px(x - 22, y - 10, 44, 1, '#C8A374');
      ctxLine(x - 20, y - 6, 4, 8); ctxLine(x + 16, y - 6, 4, 8);
      function ctxLine(a, b, c, d) { px(a, b, c, d, '#8A6440'); }
      ['#EFE9D8', '#F2ECDC', '#EDE6D2'].forEach((c, i) => {     // 송편
        px(x - 14 + i * 11, y - 14, 7, 4, c);
        px(x - 13 + i * 11, y - 15, 5, 1, Art.shade(c, .92));
      });
      // 연
      const kx = x + 58 + Math.sin(t / 900) * 10, ky = y - 96 + Math.cos(t / 700) * 8;
      px(kx - 5, ky, 10, 10, '#F2F2EA'); px(kx - 1, ky, 2, 10, '#C4304A');
      px(kx - 5, ky + 4, 10, 2, '#C4304A'); px(kx - 2, ky + 3, 4, 4, '#2E4E8A');
      for (let i = 1; i < 12; i++) px(kx + i * 2, ky + 10 + i * 3 + Math.sin(t / 300 + i) * 2, 1, 1, '#EFE4C8');
    },
    // 설날 — 윷판과 복주머니
    seollal(x, y, t) {
      const px = Art.px;
      px(x - 20, y - 12, 40, 12, '#C4A87E'); px(x - 20, y - 12, 40, 2, '#D9C098');
      ctxDot();
      function ctxDot() {
        for (let i = 0; i < 5; i++) { px(x - 16 + i * 8, y - 9, 3, 3, '#7A5A38'); px(x - 16 + i * 8, y - 4, 3, 3, '#7A5A38'); }
      }
      const roll = Math.sin(t / 380) > 0 ? 0 : 1;
      for (let i = 0; i < 4; i++) px(x - 8 + i * 5, y - 22 - roll * 3, 3, 8, '#D9C098');
      px(x + 26, y - 14, 12, 12, '#C4304A'); px(x + 26, y - 16, 12, 3, '#E8C46A');
      px(x + 30, y - 10, 4, 4, '#E8C46A');
    },
    // 새해 — 해돋이와 폭죽
    newyear(x, y, t) {
      const px = Art.px;
      for (let r = 16; r > 0; r--) {
        const w = Math.round(Math.sqrt(16 * 16 - (16 - r) * (16 - r)) * 2);
        px(x - w / 2 + 4, y - 40 + (16 - r), w, 1, r > 12 ? '#FFE8A8' : '#F2A85A');
      }
      const b = (t / 500) % 4;
      [[-30, -70], [26, -78], [-6, -88]].forEach(([ox, oy], i) => {
        if (((b | 0) + i) % 3) return;
        const c = ['#FFE08A', '#F2A0C0', '#A0D8F2'][i];
        for (let a = 0; a < 8; a++) {
          const rr = 4 + (b % 1) * 8;
          px(x + ox + Math.cos(a) * rr, y + oy + Math.sin(a) * rr, 2, 2, c);
        }
      });
    },
    cherry(x, y, t) {                                          // 벚꽃 놀이 — 돗자리
      const px = Art.px;
      px(x - 22, y - 8, 44, 10, '#E8A8BC'); px(x - 22, y - 8, 44, 2, '#F2C0CE');
      ['#FBF3E2', '#EFE4C8'].forEach((c, i) => px(x - 12 + i * 16, y - 12, 9, 5, c));
      for (let i = 0; i < 5; i++) {
        const fx = x - 26 + ((t / 40 + i * 33) % 56);
        const fy = y - 60 + ((t / 26 + i * 41) % 56);
        px(fx, fy, 3, 2, '#F2C0CE');
      }
    },
    foliage(x, y, t) {                                         // 단풍철 — 낙엽 무더기
      const px = Art.px;
      ['#C4462E', '#D9642E', '#E0B43A'].forEach((c, i) => {
        for (let n = 0; n < 9; n++) px(x - 20 + i * 6 + n * 3, y - 2 - (n % 3), 4, 2, c);
      });
      for (let i = 0; i < 4; i++) {
        const fx = x - 20 + ((t / 50 + i * 27) % 44);
        const fy = y - 50 + ((t / 30 + i * 37) % 48);
        px(fx, fy, 4, 2, ['#C4462E', '#E0B43A'][i % 2]);
      }
    },
  };

  return { of, ITEMS, tree, drop, FEST };
})();
