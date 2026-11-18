// news-image-20261117-c — editorial infographic, drawn entirely from code.
// Node 22, standard library only, no network. Writes one deterministic
// 1024x1024 PNG to $MAKEFUN_OUTPUT_DIR/entry.png.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

// ---------- canvas ----------
const W = 1024;
const H = 1024;
const PAPER: [number, number, number] = [247, 243, 232];
const INK: [number, number, number] = [20, 33, 61];
const RED: [number, number, number] = [192, 57, 43];
const BLUE: [number, number, number] = [29, 111, 184];
const GOLD: [number, number, number] = [217, 164, 65];
type RGB = [number, number, number];

const buf = new Uint8Array(W * H * 3);
function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
}
function fill(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    buf[i * 3] = c[0]; buf[i * 3 + 1] = c[1]; buf[i * 3 + 2] = c[2];
  }
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, c);
}
function hline(x: number, y: number, len: number, t: number, c: RGB): void {
  for (let k = 0; k < t; k++) rect(x, y + k, len, 1, c);
}
function vline(x: number, y: number, len: number, t: number, c: RGB): void {
  for (let k = 0; k < t; k++) rect(x + k, y, 1, len, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    setPixel(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function thickLine(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const half = Math.floor(t / 2);
  for (let a = -half; a <= half; a++)
    for (let b = -half; b <= half; b++) line(x0 + a, y0 + b, x1 + a, y1 + b, c);
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let yy = cy - r; yy <= cy + r; yy++)
    for (let xx = cx - r; xx <= cx + r; xx++)
      if ((xx - cx) * (xx - cx) + (yy - cy) * (yy - cy) <= r * r) setPixel(xx, yy, c);
}
function ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
  for (let k = 0; k < t; k++) {
    const rr = r - k;
    for (let a = 0; a < 360; a++) {
      const rad = (a * Math.PI) / 180;
      setPixel(Math.round(cx + rr * Math.cos(rad)), Math.round(cy + rr * Math.sin(rad)), c);
    }
  }
}
function circleOutline(cx: number, cy: number, r: number, c: RGB): void {
  ring(cx, cy, r, 1, c);
}

// ---------- PNG encoder (IHDR / IDAT / IEND, CRC32, zlib level 9) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function encodePng(): Buffer {
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, RGB
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", new Uint8Array(0))];
  return Buffer.concat(parts.map((p) => Buffer.from(p)));
}

// ---------- 5x7 bitmap font (7 rows per glyph, bit 4 = leftmost pixel) ----------
const CHAR_W = 6; // includes 1px spacing
const CHAR_H = 7;
const GLYPHS: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14], "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 2, 4, 8, 31], "3": [31, 2, 4, 2, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2], "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14], "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14], "9": [14, 17, 17, 15, 1, 2, 12],
  ".": [0, 0, 0, 0, 0, 12, 12], ",": [0, 0, 0, 0, 12, 4, 8],
  ";": [0, 12, 12, 0, 12, 4, 8], ":": [0, 12, 12, 0, 12, 12, 0],
  "'": [4, 4, 8, 0, 0, 0, 0], "-": [0, 0, 0, 14, 0, 0, 0],
  "+": [0, 4, 4, 31, 4, 4, 0], "%": [25, 25, 2, 4, 8, 19, 19],
  "$": [4, 15, 20, 14, 5, 30, 4], "&": [12, 18, 20, 8, 21, 18, 13],
  "·": [0, 0, 0, 12, 12, 0, 0], "/": [1, 1, 2, 4, 8, 16, 16],
  "(": [2, 4, 8, 8, 8, 4, 2], ")": [8, 4, 2, 2, 2, 4, 8],
  "!": [4, 4, 4, 4, 4, 0, 4], "?": [14, 17, 1, 2, 4, 0, 4],
  " ": [0, 0, 0, 0, 0, 0, 0],
};
function drawGlyph(x: number, y: number, ch: string, scale: number, c: RGB): void {
  const g = GLYPHS[ch] ?? GLYPHS[" "];
  for (let r = 0; r < 7; r++)
    for (let col = 0; col < 5; col++)
      if (g[r] & (1 << (4 - col)))
        for (let sy = 0; sy < scale; sy++)
          for (let sx = 0; sx < scale; sx++)
            setPixel(x + col * scale + sx, y + r * scale + sy, c);
}
function textWidth(s: string, scale: number): number {
  return s.length * CHAR_W * scale - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) drawGlyph(x + i * CHAR_W * scale, y, up[i], scale, c);
}
function drawTextCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}
// Word-wrap into at most maxLines lines, each no wider than maxW px.
function wrapText(s: string, scale: number, maxW: number, maxLines: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, scale) <= maxW || !cur) cur = trial;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

// ---------- dotted world map ----------
// Land grid: 64 columns (lon -180..180) x 32 rows (lat 84..-56).
const MAP_SPANS: Record<number, [number, number][]> = {
  0: [[17, 19], [22, 24]], 1: [[15, 20], [21, 26]],
  2: [[3, 16], [21, 26], [28, 29], [33, 62]], 3: [[4, 16], [21, 25], [32, 61]],
  4: [[5, 15], [29, 37], [36, 60]], 5: [[6, 14], [29, 37], [40, 59]],
  6: [[7, 15], [29, 37], [40, 56]], 7: [[7, 16], [29, 36], [40, 54]],
  8: [[8, 20], [29, 36], [37, 39], [44, 52], [56, 58]],
  9: [[8, 19], [29, 32], [37, 39], [44, 50], [55, 57]],
  10: [[9, 19], [29, 39], [37, 38], [44, 48], [55, 56]],
  11: [[10, 14], [29, 39], [37, 39], [45, 48]], 12: [[11, 14], [29, 39], [37, 40], [45, 47]],
  13: [[13, 24], [30, 39], [37, 41], [47, 49]], 14: [[17, 25], [31, 39], [37, 39], [48, 50]],
  15: [[18, 25], [31, 38], [49, 56]], 16: [[18, 24], [31, 38], [50, 55]],
  17: [[18, 23], [32, 37], [49, 57]], 18: [[19, 22], [31, 37], [50, 57]],
  19: [[19, 22], [32, 38], [52, 57]], 20: [[19, 21], [32, 38], [51, 58]],
  21: [[20, 21], [32, 37], [52, 58]], 22: [[20, 21], [33, 36], [51, 59]],
  23: [[20, 20], [33, 36], [51, 59]], 24: [[20, 20], [34, 35], [52, 58]],
  25: [[20, 21], [34, 35], [53, 56]], 26: [[20, 21], [34, 35]],
  27: [[20, 20], [35, 35], [61, 62]], 28: [[20, 20], [35, 35], [61, 63]],
  29: [[55, 56], [61, 62]], 30: [[20, 20]],
};
const MAP = { x: 40, y: 102, w: 944, h: 296 };
function project(lon: number, lat: number): [number, number] {
  const x = Math.round(MAP.x + ((lon + 180) / 360) * MAP.w);
  const y = Math.round(MAP.y + ((84 - lat) / 140) * MAP.h);
  return [x, y];
}
function isLand(lon: number, lat: number): boolean {
  const col = Math.floor(((lon + 180) / 360) * 64);
  const row = Math.floor(((84 - lat) / 140) * 32);
  const spans = MAP_SPANS[row];
  if (!spans) return false;
  return spans.some(([a, b]) => col >= a && col <= b);
}
function drawMap(): void {
  // Dotted gold graticule every 30 degrees.
  for (let lon = -180; lon <= 180; lon += 30) {
    const [gx] = project(lon, 84);
    for (let y = MAP.y; y <= MAP.y + MAP.h; y += 2) setPixel(gx, y, GOLD);
  }
  for (let lat = 60; lat >= -60; lat -= 30) {
    const [, gy] = project(-180, lat);
    for (let x = MAP.x; x <= MAP.x + MAP.w; x += 2) setPixel(x, gy, GOLD);
  }
  // Land dots, one disc per land cell.
  const cw = MAP.w / 64, ch = MAP.h / 32;
  const r = Math.max(2, Math.floor(Math.min(cw, ch) * 0.42));
  for (let row = 0; row < 32; row++) {
    for (const [a, b] of MAP_SPANS[row] ?? []) {
      for (let col = a; col <= b; col++) {
        const cx = Math.round(MAP.x + (col + 0.5) * cw);
        const cy = Math.round(MAP.y + (row + 0.5) * ch);
        disc(cx, cy, r, BLUE);
      }
    }
  }
  // INK frame, thickness 3, offset 3 outwards.
  const fx = MAP.x - 3, fy = MAP.y - 3, fw = MAP.w + 6, fh = MAP.h + 6;
  hline(fx, fy, fw, 3, INK); hline(fx, fy + fh - 3, fw, 3, INK);
  vline(fx, fy, fh, 3, INK); vline(fx + fw - 3, fy, fh, 3, INK);
}
function drawPin(lat: number, lon: number, dx: number, dy: number, n: number): void {
  const [tx, ty] = project(lon, lat);
  const cx = tx + dx, cy = ty + dy;
  if (dx !== 0 || dy !== 0) {
    line(tx, ty, cx, cy, RED);
    disc(tx, ty, 4, RED);
  }
  disc(cx, cy, 13, RED);
  ring(cx, cy, 13, 2, PAPER);
  drawText(cx - 5, cy - 7, String(n), 2, PAPER);
}

// ---------- 30px story icons (drawn with primitives, u = size/24) ----------
function drawIcon(kind: string, x: number, y: number, size: number): void {
  const u = size / 24;
  const px = (a: number) => Math.round(x + a * u);
  const py = (b: number) => Math.round(y + b * u);
  const L = (x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1) =>
    thickLine(px(x0), py(y0), px(x1), py(y1), Math.max(1, Math.round(t * u)), c);
  if (kind === "bridge") {
    L(2, 18, 22, 18, INK, 3);            // deck
    L(2, 18, 12, 6, INK, 2); L(22, 18, 12, 6, INK, 2); // arch
    L(6, 18, 6, 10, INK, 2); L(18, 18, 18, 10, INK, 2); // pillars
    rect(px(10), py(4), Math.max(2, Math.round(4 * u)), Math.max(2, Math.round(4 * u)), RED); // broken arch mark
  } else if (kind === "drone") {
    rect(px(9), py(10), Math.round(6 * u), Math.round(4 * u), INK);
    L(2, 8, 22, 8, INK, 2);
    L(2, 6, 6, 6, INK, 2); L(18, 6, 22, 6, INK, 2);
    L(2, 18, 6, 18, INK, 2); L(18, 18, 22, 18, INK, 2);
    disc(px(10), py(20), Math.max(1, Math.round(2 * u)), RED);
    disc(px(14), py(20), Math.max(1, Math.round(2 * u)), RED);
  } else if (kind === "flag") {
    L(4, 2, 4, 22, INK, 2);
    rect(px(6), py(3), Math.round(14 * u), Math.round(8 * u), RED);
    rect(px(6), py(6), Math.round(14 * u), Math.round(2 * u), PAPER);
    L(6, 3, 20, 11, INK, 1);
  } else if (kind === "plane") {
    L(2, 12, 22, 12, INK, 3);           // fuselage
    L(8, 12, 13, 4, INK, 2); L(8, 12, 13, 20, INK, 2); // wings
    L(20, 12, 22, 8, INK, 2);           // tail
    disc(px(3), py(12), Math.max(1, Math.round(2 * u)), RED);
  } else if (kind === "mountain") {
    L(2, 20, 9, 6, INK, 2); L(9, 6, 16, 20, INK, 2);
    L(11, 20, 17, 10, INK, 2); L(17, 10, 22, 20, INK, 2);
    L(2, 20, 22, 20, INK, 2);
    disc(px(9), py(7), Math.max(1, Math.round(2 * u)), PAPER);
  } else if (kind === "medical") {
    circleOutline(px(12), py(12), Math.round(10 * u), INK);
    rect(px(10), py(6), Math.round(4 * u), Math.round(12 * u), RED);
    rect(px(6), py(10), Math.round(12 * u), Math.round(4 * u), RED);
  } else if (kind === "chart") {
    L(3, 3, 3, 21, INK, 2); L(3, 21, 21, 21, INK, 2); // axes
    rect(px(6), py(14), Math.round(3 * u), Math.round(7 * u), BLUE);
    rect(px(11), py(10), Math.round(3 * u), Math.round(11 * u), BLUE);
    rect(px(16), py(16), Math.round(3 * u), Math.round(5 * u), RED);
    L(6, 12, 12, 8, RED, 2); L(12, 8, 18, 14, RED, 2); // jagged trend
  }
}

// ---------- stories (version C) ----------
type Story = { n: number; lat: number; lon: number; dx: number; dy: number; icon: string; title: string; fact: string };
const STORIES: Story[] = [
  { n: 1, lat: 45.3, lon: 36.5, dx: 0, dy: 0, icon: "bridge",
    title: "UKRAINE STRIKE COLLAPSES KERCH BRIDGE ROAD SPAN",
    fact: "Missiles and drones drop the road arch of the 19 km Russia-Crimea bridge; rail partly damaged, two killed in Crimea." },
  { n: 2, lat: 26.2, lon: 50.6, dx: 0, dy: 0, icon: "drone",
    title: "BAHRAIN BLOCKS 3RD IRANIAN DRONE ATTACK",
    fact: "Air defences intercept drones aimed at a US radar base; third attack in five days, no casualties." },
  { n: 3, lat: 14.6, lon: 121.0, dx: -34, dy: -30, icon: "flag",
    title: "TRUMP MEETS QUAD LEADERS IN MANILA",
    fact: "Asia trip opens with Japan, India and Australia before Xi-Putin talks in Shenzhen." },
  { n: 4, lat: -1.9, lon: 30.1, dx: 0, dy: 0, icon: "plane",
    title: "FIVE EU STATES PLAN RWANDA HUB",
    fact: "Austria, Denmark, Germany, Greece and the Netherlands plan a return hub for rejected asylum seekers, from 2027." },
  { n: 5, lat: 28.0, lon: 85.0, dx: 0, dy: 0, icon: "mountain",
    title: "NEPAL SEEKS BILLIONS AT COP31",
    fact: "Flood recovery needs billions after August floods killed over 1,500; the UN fund has pledged $20M." },
  { n: 6, lat: 38.9, lon: -77.0, dx: -16, dy: 14, icon: "medical",
    title: "US LOSES MEASLES ELIMINATION STATUS",
    fact: "PAHO ends the status held since 2000 after 5,400+ cases and 10 deaths in 2026." },
  { n: 7, lat: 40.7, lon: -74.0, dx: 16, dy: -14, icon: "chart",
    title: "STOCKS SLIDE, NVIDIA BEATS EARNINGS",
    fact: "S&P 500 falls about 1% in a fourth straight decline; Nvidia guides revenue to about $130B." },
];
const SOURCES = "SOURCES: REUTERS, AP, BBC, AL JAZEERA, NPR AND OTHERS";

// ---------- layout ----------
function drawHeader(): void {
  hline(40, 14, 944, 4, RED);
  drawTextCentered(512, 28, "WORLD NEWS \u00b7 17 NOVEMBER 2026", 4, INK);
  drawTextCentered(512, 68, "7 STORIES FROM AROUND THE WORLD", 2, BLUE);
}
function drawStoryRow(s: Story, y: number): void {
  rect(40, y, 944, 74, PAPER);
  hline(40, y, 944, 2, GOLD);
  disc(70, y + 37, 15, RED);
  ring(70, y + 37, 15, 2, PAPER);
  drawText(65, y + 30, String(s.n), 2, PAPER);
  drawIcon(s.icon, 100, y + 22, 30);
  drawText(146, y + 10, s.title, 2, INK);
  const lines = wrapText(s.fact, 2, 778, 2);
  lines.forEach((ln, i) => drawText(146, y + 34 + i * 15, ln, 2, BLUE));
}
function main(): void {
  fill(PAPER);
  drawHeader();
  drawMap();
  for (const s of STORIES) drawPin(s.lat, s.lon, s.dx, s.dy, s.n);
  let y = 420;
  for (const s of STORIES) { drawStoryRow(s, y); y += 80; }
  drawTextCentered(512, y + 2, SOURCES, 2, INK);
  const out = process.env.MAKEFUN_OUTPUT_DIR;
  if (!out) throw new Error("MAKEFUN_OUTPUT_DIR not set");
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/entry.png`, encodePng());
}
main();



