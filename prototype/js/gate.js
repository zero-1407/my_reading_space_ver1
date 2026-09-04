// ════════════════════════════════════════════════════════════════
//  시작 화면 — 로그인 · 가입 · 둘러보기
//
//   계정이 있으면 어느 기기에서도 내 방으로 돌아온다.
//   서버가 없거나(파일로 열었을 때) 그냥 보고 싶으면 둘러보기로 들어간다.
// ════════════════════════════════════════════════════════════════

const Gate = (() => {
  const $g = id => document.getElementById(id);
  let tab = 'login', busy = false, done = null;

  // 표지 그림 — 아이콘과 같은 방을 작게 그린다
  function drawCover() {
    const cv = $g('gate-cv'), g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const U = 12, px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * U, y * U, w * U, h * U); };
    px(0, 0, 16, 16, '#8E80AE');
    px(0, 1, 16, .5, '#A497C4');
    px(0, 11, 16, 5, '#C4A57E');
    px(0, 11, 16, .5, '#A98A66');
    px(1.5, 2.5, 13, 8, '#6E5236');
    px(2.3, 3.3, 11.4, 6.4, '#4E3A28');
    ['#D4645C','#EAB45A','#4A6EB0','#5FB0B8','#6E9A78','#D89A66'].forEach((c, i) => {
      [0, 1].forEach(r => {
        const h = 2.4 + ((i + r) % 2) * .6;
        px(2.4 + i * 1.86, 6.4 + r * 3.2 - h + .2, 1.6, h, c);
      });
    });
    px(2.3, 6.5, 11.4, .6, '#8A6644');
    px(2.3, 9.7, 11.4, .6, '#8A6644');
    px(6, 11.2, 4, 2.2, '#7a4f3a');
    px(6.6, 12, 2.8, .8, '#F7D6B0');
    px(6, 13.4, 4, 2.6, '#7fa88a');
    px(6.2, 14.8, 1.5, 1.2, '#3A2E28');
    px(8.3, 14.8, 1.5, 1.2, '#3A2E28');
  }

  function msg(text, ok) {
    const el = $g('g-msg');
    el.textContent = text || '';
    el.className = 'gate-msg' + (ok ? ' ok' : '');
  }
  function setTab(t) {
    tab = t;
    document.querySelectorAll('.gt').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    $g('g-who').style.display = t === 'signup' ? 'block' : 'none';
    $g('g-pw').setAttribute('autocomplete', t === 'signup' ? 'new-password' : 'current-password');
    $g('g-go').textContent = t === 'signup' ? '마을에 들어가기' : '들어가기';
    msg('');
  }
  function close() {
    $g('gate').classList.add('gone');
    if (done) done();
  }

  async function submit() {
    if (busy) return;
    const id = $g('g-id').value.trim();
    const pw = $g('g-pw').value;
    const who = $g('g-who').value.trim();
    if (!id || !pw) { msg('아이디와 비밀번호를 넣어주세요'); return; }
    busy = true; $g('g-go').disabled = true; msg(tab === 'signup' ? '계정을 만드는 중…' : '들어가는 중…', true);
    try {
      if (tab === 'signup') await Net.signup(id, pw, who || id);
      else await Net.login(id, pw);
      msg('환영합니다', true);
      setTimeout(close, 350);
    } catch (e) {
      msg(e.message);
    } finally { busy = false; $g('g-go').disabled = false; }
  }

  async function guest() {
    if (busy) return;
    busy = true;
    try { if (Net.canConnect) await Net.guest($g('g-who').value.trim() || '손님'); }
    catch (e) { /* 서버가 없어도 그냥 들어간다 */ }
    busy = false;
    close();
  }

  return {
    // 이미 로그인돼 있으면 시작 화면을 건너뛴다
    async open(onDone) {
      done = onDone;
      drawCover();
      document.querySelectorAll('.gt').forEach(b => b.onclick = () => setTab(b.dataset.tab));
      $g('g-go').onclick = submit;
      $g('g-guest').onclick = guest;
      ['g-id', 'g-pw', 'g-who'].forEach(k =>
        $g(k).addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
      setTab('login');

      if (!Net.canConnect) {
        $g('g-note').textContent =
          '지금은 파일로 연 상태라 계정을 만들 수 없어요. 둘러보기로 들어가면 혼자 놀 수 있습니다. ' +
          '친구와 함께하려면 node server.js 로 켜주세요.';
        $g('g-go').disabled = true;
        return;
      }
      $g('g-note').innerHTML =
        '계정을 만들면 어느 기기에서도 내 방으로 돌아올 수 있어요.<br>' +
        '둘러보기로 들어가면 이 브라우저에만 남습니다.';
      const me = await Net.resume();
      if (me && !me.guest) close();          // 이미 로그인돼 있으면 바로 들어간다
    },
    close,
  };
})();
