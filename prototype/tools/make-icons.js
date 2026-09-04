// 앱 아이콘을 코드로 그린다 — 도트라서 그림 파일을 따로 둘 필요가 없다
//   node tools/make-icons.js  →  icons/icon-192.png, icon-512.png, icon-maskable-512.png
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── 아주 작은 PNG 인코더 ─────────────────────────────────────
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;                       // 필터 없음
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── 도트 그림판 ──────────────────────────────────────────────
function canvas(n) {
  const buf = Buffer.alloc(n * n * 4);
  const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  return {
    buf,
    rect(x, y, w, h, c) {
      const [r, g, b] = hex(c);
      for (let yy = Math.max(0, y | 0); yy < Math.min(n, (y + h) | 0); yy++)
        for (let xx = Math.max(0, x | 0); xx < Math.min(n, (x + w) | 0); xx++) {
          const i = (yy * n + xx) * 4;
          buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
        }
    },
  };
}

// 16 × 16 그리드로 그린 뒤 배수로 키운다 — 도트가 또렷하게 남는다
const G = 16;
const SPINES = ['#D4645C', '#EAB45A', '#4A6EB0', '#5FB0B8', '#6E9A78', '#D89A66'];
function paint(size, maskable) {
  const cv = canvas(size);
  const u = size / G;                                 // 한 칸 크기
  const px = (gx, gy, gw, gh, c) => cv.rect(gx * u, gy * u, gw * u, gh * u, c);

  px(0, 0, G, G, maskable ? '#8E80AE' : '#EFE8DA');   // 바탕 — 마스커블은 여백을 더 준다
  const o = maskable ? 2 : 0;                         // 안전 여백
  const s = G - o * 2;

  px(o, o, s, s, '#8E80AE');                          // 방 벽
  px(o, o + 1, s, 0.6, '#A497C4');
  px(o, o + s - 5, s, 5, '#C4A57E');                  // 바닥
  px(o, o + s - 5, s, 0.6, '#A98A66');

  // 책장 — 두 칸
  const bx = o + 1.5, bw = s - 3;
  px(bx, o + 2.5, bw, 8, '#6E5236');
  px(bx + 0.8, o + 3.3, bw - 1.6, 6.4, '#4E3A28');
  const cell = (bw - 1.6) / SPINES.length;
  SPINES.forEach((c, i) => {
    [0, 1].forEach(row => {
      const h = 2.4 + ((i + row) % 2) * 0.6;
      px(bx + 0.9 + i * cell, o + 6.4 + row * 3.2 - h + 0.2, cell - 0.25, h, c);
    });
  });
  px(bx + 0.8, o + 6.5, bw - 1.6, 0.6, '#8A6644');    // 선반
  px(bx + 0.8, o + 9.7, bw - 1.6, 0.6, '#8A6644');

  // 아바타 — 책장 앞에 서 있다
  const ax = o + s / 2 - 2;
  px(ax, o + 11.2, 4, 2.2, '#7a4f3a');                // 머리
  px(ax + 0.6, o + 12, 2.8, 0.8, '#F7D6B0');          // 얼굴
  px(ax, o + 13.4, 4, 2.6, '#7fa88a');                // 몸
  px(ax + 0.2, o + s - 1.2, 1.5, 1.2, '#3A2E28');     // 다리
  px(ax + 2.3, o + s - 1.2, 1.5, 1.2, '#3A2E28');
  return png(size, size, cv.buf);
}

const dir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(dir, { recursive: true });
const out = [
  ['icon-192.png', paint(192, false)],
  ['icon-512.png', paint(512, false)],
  ['icon-maskable-512.png', paint(512, true)],
  ['apple-touch-icon.png', paint(180, false)],
];
out.forEach(([name, buf]) => {
  fs.writeFileSync(path.join(dir, name), buf);
  console.log('  ' + name + '  ' + (buf.length / 1024).toFixed(1) + ' KB');
});
console.log('아이콘 ' + out.length + '개 만들었습니다 → icons/');
