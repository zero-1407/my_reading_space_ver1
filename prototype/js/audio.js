// ════════════════════════════════════════════════════════════════
//  소리 — 오디오 파일 없이 Web Audio 로 전부 합성한다
//   음악 : 네 곡. 화음 진행과 음계만 바꾸면 다른 곡이 된다
//   효과음 : 발소리 · 상호작용 · 문 · 새 · 종이 · 버스 …
// ════════════════════════════════════════════════════════════════

const Audio8 = (() => {
  let ac = null, musicGain, sfxGain, noiseBuf, rainSrc = null;
  let musicOn = false, sfxOn = true, timer = null, bar = 0;
  let trackIdx = 0, vol = 0.5;                 // vol 0 ~ 1

  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const C = (bass, ...notes) => ({ bass, notes });

  // ── 곡 ────────────────────────────────────────────────────
  const TRACKS = [
    { name:'고요한 서재', desc:'느린 A단조. 기본',
      barMs:4000, cut:2400, vel:1,
      chords:[C(45,57,60,64), C(41,53,57,60), C(48,52,55,60), C(43,55,59,62)],
      scale:[69,72,74,76,79,81,84], density:.55 },
    { name:'창가의 오후', desc:'밝은 C장조',
      barMs:3400, cut:3000, vel:1.05,
      chords:[C(48,55,60,64), C(43,55,59,62), C(45,57,60,64), C(41,53,57,60)],
      scale:[72,74,76,79,81,84,86], density:.75 },
    { name:'비 오는 날', desc:'D단조 · 빗소리',
      barMs:4600, cut:1900, vel:.92, rain:true,
      chords:[C(38,50,53,57), C(46,53,58,62), C(41,53,57,60), C(48,52,55,60)],
      scale:[65,67,70,72,74,77,79], density:.4 },
    { name:'별 헤는 밤', desc:'성기고 높은 5음계',
      barMs:5200, cut:3400, vel:.85,
      chords:[C(45,60,64,69), C(40,59,64,67), C(43,59,62,67), C(45,57,64,69)],
      scale:[81,84,86,88,91,93,96], density:.85 },
    // 재즈바 — 걷는 베이스 위에 7화음을 엇박으로 던진다
    { name:'한밤의 재즈바', desc:'ⅱ–Ⅴ–Ⅰ · 브러시 드럼', style:'jazz',
      barMs:2000, cut:3200, vel:1,
      chords:[C(38,53,57,60,64), C(43,52,55,59,62), C(36,52,55,59,64), C(45,52,57,60,63)],
      walk:[[38,41,43,44],[43,45,47,48],[36,40,43,45],[45,47,48,50]],
      scale:[65,67,68,70,72,75,77], density:.9 },
  ];
  const track = () => TRACKS[trackIdx];

  function ensure() {
    if (ac) { if (ac.state !== 'running') ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const kick = () => { if (ac.state !== 'running') ac.resume(); };
    ['pointerdown', 'keydown'].forEach(e => addEventListener(e, kick));

    musicGain = ac.createGain(); musicGain.gain.value = 0;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const dl = ac.createDelay(2); dl.delayTime.value = 0.46;
    const fb = ac.createGain(); fb.gain.value = 0.32;
    const wet = ac.createGain(); wet.gain.value = 0.28;
    musicGain.connect(lp); lp.connect(ac.destination);
    lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(ac.destination);
    musicGain._lp = lp;

    sfxGain = ac.createGain(); sfxGain.gain.value = .55;
    sfxGain.connect(ac.destination);

    const n = ac.sampleRate * 2;
    noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  // 피아노 한 음 — 배음 네 개를 겹친다
  function keyNote(midi, at, dur, v) {
    const f = hz(midi);
    [[1, 1], [2, .34], [3, .13], [4.1, .06]].forEach(([mul, g]) => {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
      const e = ac.createGain(), peak = Math.max(.0003, v * g);
      e.gain.setValueAtTime(.0001, at);
      e.gain.linearRampToValueAtTime(peak, at + .012);
      e.gain.exponentialRampToValueAtTime(peak * .24, at + .32 / mul);
      e.gain.exponentialRampToValueAtTime(.0001, at + dur);
      o.connect(e); e.connect(musicGain);
      o.start(at); o.stop(at + dur + .06);
    });
  }
  // 브러시 드럼 — 스네어를 쓸어내는 소리
  function brush(at, v) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3200;
    const e = ac.createGain();
    e.gain.setValueAtTime(.0001, at);
    e.gain.linearRampToValueAtTime(v, at + .02);
    e.gain.exponentialRampToValueAtTime(.0001, at + .22);
    s.connect(f); f.connect(e); e.connect(musicGain);
    s.start(at); s.stop(at + .26);
  }
  function scheduleBar() {
    const T = track(), t0 = ac.currentTime + .08, i4 = bar % T.chords.length;
    const c = T.chords[i4], s = T.vel;

    if (T.style === 'jazz') {
      const beat = T.barMs / 4000;                       // 한 박(초)
      T.walk[i4].forEach((n, i) => keyNote(n, t0 + i * beat, beat * .95, .26 * s));  // 걷는 베이스
      [0.5, 1.75, 2.5].forEach((b, i) => {               // 엇박 화음
        if (i && Math.random() < .3) return;
        c.notes.forEach(n => keyNote(n, t0 + b * beat, beat * 1.1, .085 * s));
      });
      [1, 3].forEach(b => brush(t0 + b * beat, .045));   // 2 · 4박
      brush(t0 + 3.66 * beat, .022);
      if (Math.random() < .8) {                          // 색소폰처럼 흐르는 한 줄
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++)
          keyNote(pick(T.scale), t0 + (0.5 + i * .5 + Math.random() * .2) * beat, beat * .8, .1 * s);
      }
      bar++; return;
    }

    keyNote(c.bass, t0, T.barMs / 700, .30 * s);
    c.notes.forEach((n, i) => keyNote(n, t0 + .5 + i * (T.barMs / 6500), T.barMs / 1200, .17 * s));
    if (Math.random() < T.density) keyNote(pick(T.scale), t0 + 1.3 + Math.random(), 3.2, .15 * s);
    if (Math.random() < T.density * .7) keyNote(pick(T.scale), t0 + 2.6 + Math.random(), 3.0, .12 * s);
    bar++;
  }
  function startRain() {
    stopRain();
    rainSrc = ac.createBufferSource(); rainSrc.buffer = noiseBuf; rainSrc.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = .5;
    const g = ac.createGain(); g.gain.value = .035;
    rainSrc.connect(f); f.connect(g); g.connect(musicGain);
    rainSrc.start();
  }
  function stopRain() { if (rainSrc) { try { rainSrc.stop(); } catch (e) {} rainSrc = null; } }

  function applyMusic() {
    if (!ac) return;
    musicGain.gain.cancelScheduledValues(ac.currentTime);
    musicGain.gain.setTargetAtTime(musicOn ? .46 * vol : 0, ac.currentTime, .35);
    musicGain._lp.frequency.setTargetAtTime(track().cut, ac.currentTime, .3);
  }
  function restart() {
    clearInterval(timer); timer = null; stopRain(); bar = 0;
    if (!musicOn) return;
    scheduleBar();
    timer = setInterval(scheduleBar, track().barMs);
    if (track().rain) startRain();
  }

  // ── 효과음 부품 ───────────────────────────────────────────
  function tone(freq, at, dur, v, type, slideTo) {
    const o = ac.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    const e = ac.createGain();
    e.gain.setValueAtTime(.0001, at);
    e.gain.linearRampToValueAtTime(v, at + .008);
    e.gain.exponentialRampToValueAtTime(.0001, at + dur);
    o.connect(e); e.connect(sfxGain); o.start(at); o.stop(at + dur + .02);
  }
  function noise(at, dur, v, freq, q, sweepTo) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, at);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
    f.Q.value = q || 1;
    const e = ac.createGain();
    e.gain.setValueAtTime(.0001, at);
    e.gain.linearRampToValueAtTime(v, at + .006);
    e.gain.exponentialRampToValueAtTime(.0001, at + dur);
    s.connect(f); f.connect(e); e.connect(sfxGain); s.start(at); s.stop(at + dur + .02);
  }
  const SFX = {
    step:(t) => noise(t, .07, .05, 340 + Math.random() * 120, 1.6),
    stepGrass:(t) => noise(t, .09, .045, 900 + Math.random() * 400, .9),
    hover:(t) => tone(1180, t, .05, .03, 'sine'),
    select:(t) => { tone(660, t, .07, .075, 'triangle'); tone(990, t + .05, .1, .05, 'sine'); },
    open:(t) => { tone(523, t, .1, .065, 'sine'); tone(784, t + .07, .16, .05, 'sine'); },
    close:(t) => { tone(660, t, .08, .05, 'sine'); tone(440, t + .06, .12, .04, 'sine'); },
    page:(t) => noise(t, .13, .055, 2600, .8, 1200),
    book:(t) => { noise(t, .1, .05, 1400, 1.2); tone(392, t + .03, .12, .05, 'triangle'); },
    door:(t) => { tone(150, t, .12, .1, 'triangle', 90); noise(t + .05, .18, .045, 700, 1.4, 300); },
    talk:(t) => { tone(520, t, .05, .045, 'triangle'); tone(700, t + .04, .06, .035, 'triangle'); },
    wing:(t) => { for (let i = 0; i < 5; i++) noise(t + i * .09, .07, .055 - i * .008, 1500 - i * 180, 1.1); },
    mail:(t) => { tone(880, t, .1, .065, 'sine'); tone(1320, t + .08, .22, .05, 'sine'); },
    pin:(t) => { tone(1500, t, .05, .055, 'square'); noise(t, .05, .03, 3000, 2); },
    right:(t) => [660, 880, 1320].forEach((f, i) => tone(f, t + i * .06, .18, .065, 'sine')),
    wrong:(t) => tone(220, t, .18, .075, 'triangle', 160),
    dex:(t) => [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * .07, .3, .055, 'sine')),
    bus:(t) => { tone(80, t, 1.1, .08, 'sawtooth', 130); noise(t, 1.2, .04, 420, .7, 900);
                 tone(392, t + .05, .12, .055, 'square'); tone(523, t + .18, .16, .055, 'square'); },
    coin:(t) => { tone(1046, t, .07, .065, 'square'); tone(1568, t + .06, .16, .05, 'square'); },
    event:(t) => [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * .09, .34, .06, 'triangle')),
    // 천둥 — 낮게 우르릉거리며 길게 끌린다
    thunder:(t) => {
      noise(t, 2.6, .16, 90, .6, 40);
      noise(t + .05, 1.4, .1, 260, .8, 70);
      tone(48, t, 2.2, .07, 'sine', 28);
    },
    water:(t) => noise(t, .5, .05, 700, .6, 1600),

    // ── 기차 ────────────────────────────────────────────────
    whistle:(t) => {                              // 기적 — 두 음이 겹친 바람 소리
      [[392, .09], [523, .07], [659, .05]].forEach(([f, v]) => {
        const o = ac.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(f * .98, t);
        o.frequency.linearRampToValueAtTime(f, t + .12);
        o.frequency.linearRampToValueAtTime(f * .96, t + 1.1);
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
        const e = ac.createGain();
        e.gain.setValueAtTime(.0001, t);
        e.gain.linearRampToValueAtTime(v, t + .1);
        e.gain.setValueAtTime(v, t + .85);
        e.gain.exponentialRampToValueAtTime(.0001, t + 1.35);
        o.connect(lp); lp.connect(e); e.connect(sfxGain);
        o.start(t); o.stop(t + 1.4);
      });
      noise(t, 1.3, .035, 900, .7, 600);
    },
    clack:(t) => {                                // 덜컹 — 이음매를 넘는 소리
      noise(t, .05, .075, 180, 2.2);
      noise(t + .07, .05, .055, 240, 2.2);
    },
    bell:(t) => {                                 // 역 종소리
      [880, 1174].forEach((f, i) => {
        [1, 2.7, 5.1].forEach((m, j) => {
          const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
          const e = ac.createGain(), v = .05 / (j + 1);
          const at = t + i * .42;
          e.gain.setValueAtTime(.0001, at);
          e.gain.linearRampToValueAtTime(v, at + .006);
          e.gain.exponentialRampToValueAtTime(.0001, at + 1.6 / (j + 1));
          o.connect(e); e.connect(sfxGain); o.start(at); o.stop(at + 1.7);
        });
      });
    },
    brake:(t) => { noise(t, .9, .04, 2600, 6, 1400); tone(140, t, .8, .04, 'sawtooth', 60); },
    flap:(t) => { for (let i = 0; i < 5; i++) noise(t + i * .045, .03, .05, 1600 + i * 200, 3); },
    jet:(t) => {                                  // 비행기
      noise(t, 3.2, .09, 260, .5, 1500);
      tone(70, t, 3.0, .05, 'sawtooth', 190);
    },
  };

  // ── 주변 소리 (빗소리 · 파도 같은 것) ──────────────────────
  let ambSrc = null, ambGain = null;
  function ambience(kind) {
    ensure();
    if (ambSrc) { try { ambSrc.stop(); } catch (e) {} ambSrc = null; }
    if (!kind || kind === 'none') return;
    ambSrc = ac.createBufferSource(); ambSrc.buffer = noiseBuf; ambSrc.loop = true;
    const f = ac.createBiquadFilter();
    ambGain = ac.createGain();
    if (kind === 'rain')  { f.type = 'bandpass'; f.frequency.value = 1600; f.Q.value = .5; ambGain.gain.value = .07; }
    if (kind === 'storm') { f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = .4; ambGain.gain.value = .11; }
    if (kind === 'snow')  { f.type = 'lowpass';  f.frequency.value = 300;  ambGain.gain.value = .02; }
    ambSrc.connect(f); f.connect(ambGain); ambGain.connect(sfxGain);
    ambSrc.start();
  }

  let lastStep = 0;
  return {
    tracks: TRACKS,
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; },
    get trackIdx() { return trackIdx; },
    get volume() { return vol; },
    wake() { ensure(); },
    toggleMusic() {
      ensure(); musicOn = !musicOn; applyMusic(); restart(); return musicOn;
    },
    setTrack(i) {
      ensure(); trackIdx = Math.max(0, Math.min(TRACKS.length - 1, i));
      applyMusic(); restart(); return track();
    },
    setVolume(v) { ensure(); vol = Math.max(0, Math.min(1, v)); applyMusic(); },
    toggleSfx() {
      ensure(); sfxOn = !sfxOn;
      sfxGain.gain.setTargetAtTime(sfxOn ? .55 : 0, ac.currentTime, .05);
      return sfxOn;
    },
    play(name) { if (ac && sfxOn && SFX[name]) SFX[name](ac.currentTime + .002); },
    ambience,
    footstep(outdoor) {
      if (!ac || !sfxOn) return;
      const now = ac.currentTime;
      if (now - lastStep < .29) return;
      lastStep = now;
      (outdoor ? SFX.stepGrass : SFX.step)(now);
    },
  };
})();
