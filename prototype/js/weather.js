// ════════════════════════════════════════════════════════════════
//  날씨 — 날짜를 씨앗으로 삼아 그날의 하늘이 정해진다
//   맑음이면 창으로 햇살이 들어오고, 비가 오면 빗소리가 나고
//   가끔 천둥이 치면 방이 번쩍한다.
// ════════════════════════════════════════════════════════════════

const Weather = (() => {
  // 같은 날이면 누가 접속해도 같은 날씨가 되도록 날짜로 씨앗을 만든다
  function seed(d) {
    const s = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    let x = Math.sin(s) * 43758.5453;
    return () => { x = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  }
  const KINDS = {
    clear:  { name:'맑음',   emo:'☀️', sun:.34, rain:0,  cloud:.05 },
    sunny:  { name:'화창함', emo:'🌤', sun:.26, rain:0,  cloud:.18 },
    cloudy: { name:'흐림',   emo:'☁️', sun:.04, rain:0,  cloud:.55 },
    rain:   { name:'비',     emo:'🌧', sun:0,   rain:.7, cloud:.7 },
    storm:  { name:'천둥번개', emo:'⛈', sun:0,  rain:1,  cloud:.85, thunder:true },
    snow:   { name:'눈',     emo:'🌨', sun:.03, rain:0,  cloud:.6, snow:true },
  };

  function pickKind(season, r) {
    const v = r();
    if (season.key === 'winter') return v < .5 ? 'clear' : v < .68 ? 'cloudy' : v < .9 ? 'snow' : 'sunny';
    if (season.key === 'summer') return v < .34 ? 'clear' : v < .52 ? 'sunny'
                                      : v < .68 ? 'cloudy' : v < .88 ? 'rain' : 'storm';
    if (season.key === 'spring') return v < .4 ? 'sunny' : v < .62 ? 'clear' : v < .82 ? 'cloudy' : 'rain';
    return v < .42 ? 'clear' : v < .64 ? 'sunny' : v < .84 ? 'cloudy' : 'rain';   // 가을
  }

  function of(season, date) {
    const d = date || new Date();
    const r = seed(d);
    const key = pickKind(season, r);
    const hour = d.getHours();
    const night = hour >= 19 || hour < 6;
    const dusk = hour >= 17 && hour < 19;
    return Object.assign({ key, night, dusk, hour }, KINDS[key]);
  }

  // ── 실내 : 창으로 들어오는 빛과 비 ────────────────────────
  //  win 은 창문 아이템, floorTop 은 바닥이 시작하는 y
  function indoor(w, win, floorTop, H, t, px) {
    if (!win) return;
    if (w.sun > 0) {
      // 창틀 모양대로 바닥에 떨어지는 햇살
      const sway = Math.sin(t / 3000) * 2;
      const a = w.sun * (w.night ? .15 : 1);
      px(win.x - 4 + sway, floorTop, win.w + 8, H - floorTop, 'rgba(255,244,190,' + (a * .34).toFixed(3) + ')');
      px(win.x + 2 + sway, floorTop + 6, win.w - 4, H - floorTop - 10, 'rgba(255,246,205,' + (a * .3).toFixed(3) + ')');
      px(win.x + 3 + sway, floorTop + 10, 16, H - floorTop - 18, 'rgba(255,250,220,' + (a * .26).toFixed(3) + ')');
      px(win.x + 23 + sway, floorTop + 10, 16, H - floorTop - 18, 'rgba(255,250,220,' + (a * .26).toFixed(3) + ')');
    }
    if (w.rain > 0) {
      px(win.x + 3, win.y + 3, win.w - 6, win.h - 6, 'rgba(90,110,130,.3)');   // 흐린 창
      for (let i = 0; i < 14; i++) {                                            // 창에 흐르는 빗줄기
        const x = win.x + 4 + ((i * 7 + 3) % (win.w - 8));
        const y = win.y + 4 + ((t / (3 + i % 4) + i * 13) % (win.h - 10));
        px(x, y, 1, 3, 'rgba(220,240,250,.5)');
      }
    }
    if (w.snow) {
      for (let i = 0; i < 10; i++) {
        const x = win.x + 4 + ((i * 9 + 2) % (win.w - 8));
        const y = win.y + 4 + ((t / 26 + i * 17) % (win.h - 10));
        px(x, y, 1, 1, 'rgba(255,255,255,.85)');
      }
    }
  }

  // ── 실외 : 비 · 눈 · 구름 그림자 ─────────────────────────
  function outdoor(w, camX, camY, VW, VH, t, px) {
    if (w.cloud > .3) px(camX, camY, VW, VH, 'rgba(70,80,100,' + (w.cloud * .12).toFixed(3) + ')');
    if (w.night) px(camX, camY, VW, VH, 'rgba(30,40,80,.30)');
    else if (w.dusk) px(camX, camY, VW, VH, 'rgba(255,170,90,.13)');
    if (w.rain > 0) {
      const n = Math.round(w.rain * 90);
      for (let i = 0; i < n; i++) {
        const x = camX + ((i * 37 + t * .55) % VW);
        const y = camY + ((i * 71 + t * 1.5) % VH);
        px(x, y, 1, 5, 'rgba(190,215,235,.5)');
      }
      // 바닥에 튀는 물방울
      for (let i = 0; i < 12; i++) {
        const x = camX + ((i * 53 + Math.floor(t / 220) * 17) % VW);
        const y = camY + ((i * 97 + Math.floor(t / 220) * 31) % VH);
        px(x, y, 3, 1, 'rgba(220,240,250,.35)');
      }
    }
    if (w.snow) {
      for (let i = 0; i < 46; i++) {
        const x = camX + ((i * 41 + t * .12 + Math.sin(t / 900 + i) * 8) % VW);
        const y = camY + ((i * 83 + t * .28) % VH);
        px(x, y, 2, 2, 'rgba(255,255,255,.9)');
      }
    }
  }

  // ── 번개 ────────────────────────────────────────────────
  //  친 순간 화면이 하얘지고, 잠시 뒤 천둥이 울린다.
  let nextBolt = 4000 + Math.random() * 9000, flash = 0;
  function thunderTick(w, dt, onBoom) {
    if (!w.thunder) { flash = 0; return 0; }
    nextBolt -= dt;
    if (nextBolt <= 0) {
      nextBolt = 7000 + Math.random() * 14000;
      flash = 260;
      setTimeout(onBoom, 400 + Math.random() * 900);       // 빛보다 소리가 늦게 온다
    }
    if (flash > 0) flash -= dt;
    return Math.max(0, flash);
  }
  function flashAlpha(f) {
    if (f <= 0) return 0;
    const k = f / 260;
    return k > .75 ? .55 : k > .5 ? .12 : k > .3 ? .38 : k * .2;   // 두 번 번쩍
  }
  return { of, indoor, outdoor, thunderTick, flashAlpha };
})();
