/**
 * Procedural 16×16 block textures. Pure functions (no DOM), deterministic, written for this project.
 * Pixel rows are generated top-to-bottom in "image space" and stored bottom-up (row 0 = v 0) so that
 * the texture is upright on side faces.
 */
import type { TexDef, TexPattern } from "@kladka/voxel-core";

export const TEX = 16;

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function seedOf(def: TexDef): number {
  let s = 17;
  const str = def.pattern + def.color.toString(16);
  for (let i = 0; i < str.length; i++) s = (s * 31 + str.charCodeAt(i)) | 0;
  return s;
}

type RGB = [number, number, number];
const rgb = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

class Canvas16 {
  readonly data = new Uint8Array(TEX * TEX * 4);
  set(x: number, y: number, c: RGB, a = 255): void {
    if (x < 0 || y < 0 || x >= TEX || y >= TEX) return;
    const row = TEX - 1 - y; // store bottom-up
    const o = (row * TEX + x) * 4;
    this.data[o] = Math.max(0, Math.min(255, Math.round(c[0])));
    this.data[o + 1] = Math.max(0, Math.min(255, Math.round(c[1])));
    this.data[o + 2] = Math.max(0, Math.min(255, Math.round(c[2])));
    this.data[o + 3] = a;
  }
  fill(fn: (x: number, y: number) => [RGB, number?]): void {
    for (let y = 0; y < TEX; y++)
      for (let x = 0; x < TEX; x++) {
        const [c, a] = fn(x, y);
        this.set(x, y, c, a ?? 255);
      }
  }
}

export function generateTexture(def: TexDef): Uint8Array {
  const c = new Canvas16();
  const base = rgb(def.color);
  const acc = rgb(def.accent ?? def.color);
  const seed = seedOf(def);
  const n = (x: number, y: number, s = 0) => hash(x, y, seed + s);
  const noisy = (col: RGB, amt: number, x: number, y: number) => mul(col, 1 + (n(x, y) - 0.5) * amt);
  const gen = GENERATORS[def.pattern] ?? GENERATORS.noise;
  gen(c, { base, acc, n, noisy });
  return c.data;
}

interface Ctx {
  base: RGB;
  acc: RGB;
  n: (x: number, y: number, s?: number) => number;
  noisy: (col: RGB, amt: number, x: number, y: number) => RGB;
}

const border = (x: number, y: number, w = 1) => x < w || y < w || x >= TEX - w || y >= TEX - w;

const GENERATORS: Record<TexPattern, (c: Canvas16, k: Ctx) => void> = {
  plain: (c, { base, noisy }) => c.fill((x, y) => [noisy(base, 0.05, x, y)]),
  noise: (c, { base, acc, n, noisy }) => c.fill((x, y) => [noisy(n(x, y, 3) > 0.8 ? acc : base, 0.16, x, y)]),
  concrete: (c, { base, noisy }) => c.fill((x, y) => [noisy(base, 0.04, x, y)]),
  terracotta: (c, { base, acc, n, noisy }) =>
    c.fill((x, y) => [noisy(n(x, y, 5) > 0.85 ? acc : base, 0.07, x, y)]),
  stone: (c, { base, acc, n, noisy }) =>
    c.fill((x, y) => {
      const blob = n(x >> 1, y >> 1, 7) > 0.72 || n(x, y, 9) > 0.9;
      return [noisy(blob ? acc : base, 0.12, x, y)];
    }),
  smooth: (c, { base, acc, noisy }) => c.fill((x, y) => [border(x, y) ? acc : noisy(base, 0.04, x, y)]),
  polished: (c, { base, acc, noisy }) =>
    c.fill((x, y) => {
      if (x === 0 || y === 0) return [mix(base, [255, 255, 255], 0.15)];
      if (x === TEX - 1 || y === TEX - 1) return [acc];
      return [noisy(base, 0.06, x, y)];
    }),
  cobble: (c, { base, acc, n }) => {
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i < 9; i++) pts.push([n(i, 0, 11) * 16, n(i, 1, 11) * 16, 0.8 + n(i, 2, 11) * 0.4]);
    c.fill((x, y) => {
      let d1 = 1e9,
        d2 = 1e9,
        bi = 0;
      for (let i = 0; i < pts.length; i++) {
        for (const [ox, oy] of [
          [0, 0],
          [16, 0],
          [-16, 0],
          [0, 16],
          [0, -16],
        ]) {
          const dx = x + 0.5 - (pts[i]![0] + ox!),
            dy = y + 0.5 - (pts[i]![1] + oy!);
          const d = dx * dx + dy * dy;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            bi = i;
          } else if (d < d2) d2 = d;
        }
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1) < 1.1;
      return [edge ? acc : mul(base, pts[bi]![2] * (0.92 + n(x, y) * 0.16))];
    });
  },
  planks: (c, { base, acc, n }) =>
    c.fill((x, y) => {
      const board = y >> 2;
      const seam = (y & 3) === 3;
      const cut = Math.floor(n(board, 0, 21) * 16);
      const vseam = x === cut;
      if (seam || vseam) return [acc];
      const grain =
        0.94 + 0.12 * Math.sin((x + n(board, 1, 22) * 10) * 0.9 + y * 0.3) * 0.5 + (n(x, y) - 0.5) * 0.06;
      return [mul(base, grain * (0.95 + n(board, 3, 23) * 0.1))];
    }),
  log: (c, { base, acc, n }) =>
    c.fill((x, y) => {
      const stripe = n(x, 0, 31);
      const crack = stripe > 0.75 && n(x, y >> 2, 32) > 0.3;
      return [crack ? acc : mul(base, 0.88 + stripe * 0.2 + (n(x, y) - 0.5) * 0.08)];
    }),
  log_top: (c, { base, acc }) =>
    c.fill((x, y) => {
      if (border(x, y)) return [acc];
      const d = Math.hypot(x - 7.5, y - 7.5);
      const ring = Math.floor(d) % 3 === 0;
      return [ring ? mul(base, 0.82) : base];
    }),
  pillar: (c, { base, acc, noisy }) => c.fill((x, y) => [x % 4 === 0 ? acc : noisy(base, 0.05, x, y)]),
  pillar_top: (c, { base, acc, noisy }) =>
    c.fill((x, y) => {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      return [d > 6.5 || Math.round(d) === 4 ? acc : noisy(base, 0.05, x, y)];
    }),
  bricks: (c, { base, acc, n }) =>
    c.fill((x, y) => {
      const row = y >> 2;
      const off = row % 2 ? 4 : 0;
      if ((y & 3) === 3 || ((x + off) & 7) === 7) return [acc];
      const brick = ((x + off) >> 3) + row * 3;
      return [mul(base, 0.88 + n(brick, row, 41) * 0.22 + (n(x, y) - 0.5) * 0.06)];
    }),
  stone_bricks: (c, { base, acc, n }) =>
    c.fill((x, y) => {
      const row = y >> 3;
      const off = row % 2 ? 8 : 0;
      if ((y & 7) === 7 || ((x + off) & 15) === 15) return [acc];
      if ((y & 7) === 0) return [mix(base, [255, 255, 255], 0.08)];
      return [mul(base, 0.92 + (n(x, y) - 0.5) * 0.14)];
    }),
  tiles: (c, { base, acc, n }) =>
    c.fill((x, y) => {
      if ((x & 7) === 7 || (y & 7) === 7) return [acc];
      return [mul(base, 0.92 + n(x >> 3, y >> 3, 51) * 0.12 + (n(x, y) - 0.5) * 0.05)];
    }),
  chiseled: (c, { base, acc, noisy }) =>
    c.fill((x, y) => {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      return [d > 6.5 || (d > 3 && d < 4.2) ? acc : noisy(base, 0.05, x, y)];
    }),
  mosaic: (c, { base, acc, noisy }) =>
    c.fill((x, y) => [noisy(((x >> 2) + (y >> 2)) % 2 ? base : acc, 0.05, x, y)]),
  sandstone: (c, { base, acc, noisy }) =>
    c.fill((x, y) => [y === 0 || y === 11 || y === 15 ? acc : noisy(base, 0.05, x, y)]),
  shingles: (c, { base, acc, n }) =>
    c.fill((x, y) => {
      const row = y >> 2;
      const off = row % 2 ? 2 : 0;
      return [(y & 3) === 3 || ((x + off) & 3) === 3 ? acc : mul(base, 0.92 + n(x >> 2, row, 61) * 0.14)];
    }),
  leaves: (c, { base, acc, n }) =>
    c.fill((x, y) => {
      const v = n(x, y, 71);
      if (v < 0.18) return [base, 0];
      return [v > 0.7 ? acc : mul(base, 0.85 + v * 0.3)];
    }),
  glass: (c, { base, acc }) =>
    c.fill((x, y) => {
      if (border(x, y)) return [mix(base, acc, 0.4), 230];
      if ((x === y + 3 || x === y + 4) && x > 4 && x < 12) return [mix(base, [255, 255, 255], 0.6), 110];
      return [base, 55];
    }),
  wool: (c, { base, n }) =>
    c.fill((x, y) => [mul(base, 0.93 + ((x + y) % 3 === 0 ? 0.06 : 0) + (n(x, y) - 0.5) * 0.06)]),
  sand: (c, { base, acc, n, noisy }) =>
    c.fill((x, y) => [noisy(n(x, y, 81) > 0.86 ? acc : base, 0.08, x, y)]),
  dirt: (c, { base, acc, n, noisy }) =>
    c.fill((x, y) => {
      const v = n(x, y, 91);
      return [noisy(v > 0.82 ? acc : v < 0.1 ? mix(base, [255, 255, 255], 0.15) : base, 0.08, x, y)];
    }),
  grass_top: (c, { base, n }) => c.fill((x, y) => [mul(base, 0.85 + n(x, y, 101) * 0.3)]),
  grass_side: (c, { base, acc, n }) =>
    c.fill((x, y) => {
      const fringe = 3 + Math.floor(n(x, 0, 111) * 3);
      if (y < fringe) return [mul(acc, 0.85 + n(x, y) * 0.3)];
      return [mul(base, 0.9 + (n(x, y, 112) - 0.5) * 0.2)];
    }),
  path_top: (c, { base, n }) => c.fill((x, y) => [mul(base, 0.9 + n(x, y, 121) * 0.2)]),
  farmland: (c, { base, n }) =>
    c.fill((x, y) => [y % 4 === 0 ? mul(base, 0.7) : mul(base, 0.9 + n(x, y) * 0.2)]),
  bookshelf: (c, { base, n }) => {
    const spines: RGB[] = [
      [150, 40, 30],
      [40, 70, 140],
      [50, 110, 50],
      [120, 90, 40],
      [110, 40, 110],
      rgb(0xd8c08a),
    ];
    c.fill((x, y) => {
      if (y < 1 || y > 14 || y === 7 || y === 8) return [mul(base, y === 7 ? 0.7 : 1)];
      const shelf = y < 7 ? 0 : 1;
      const book = Math.floor((x + shelf * 3) / 2);
      if (x === 0 || x === 15) return [mul(base, 0.8)];
      const col = spines[Math.floor(n(book, shelf, 131) * spines.length)]!;
      const top = shelf === 0 ? 1 + Math.floor(n(book, 9, 132) * 2) : 9 + Math.floor(n(book, 9, 133) * 2);
      return [y < top ? mul(base, 0.45) : mul(col, (x + shelf) % 2 ? 0.85 : 1)];
    });
  },
  door: (c, { base, acc, n }) =>
    c.fill((x, y) => {
      if (border(x, y, 1)) return [acc];
      if (y >= 2 && y <= 6 && x >= 3 && x <= 12 && x !== 7 && x !== 8)
        return [mix(base, [180, 210, 230], 0.5), 0];
      if (x === 12 && y === 9) return [[40, 40, 40]];
      return [mul(base, 0.92 + n(x, y >> 2) * 0.12)];
    }),
  trapdoor: (c, { base, acc }) =>
    c.fill((x, y) => {
      if (border(x, y, 1) || x === 7 || x === 8 || y === 7 || y === 8) return [acc];
      if ((x === 3 || x === 12) && (y === 3 || y === 12)) return [base, 0];
      return [base];
    }),
  crafting_top: (c, { base, acc, noisy }) =>
    c.fill((x, y) => [
      border(x, y) || x === 5 || x === 10 || y === 5 || y === 10 ? acc : noisy(base, 0.08, x, y),
    ]),
  crafting_side: (c, { base, acc, n }) =>
    c.fill((x, y) => {
      if (y < 2) return [mul(acc, 1.1)];
      if ((x === 4 && y > 4 && y < 12) || (y === 5 && x > 2 && x < 7)) return [[90, 90, 95]];
      if ((x === 11 && y > 4 && y < 12) || (y === 6 && x > 9 && x < 13)) return [[110, 80, 50]];
      return [mul(base, 0.92 + n(x, y >> 2) * 0.12)];
    }),
  furnace: (c, { base, acc, n }) =>
    c.fill((x, y) => {
      if (y >= 9 && y <= 13 && x >= 4 && x <= 11) return [y === 13 ? [200, 120, 40] : acc];
      return [mul(base, 0.9 + n(x, y) * 0.15)];
    }),
  chest: (c, { base, acc, n }) =>
    c.fill((x, y) => {
      if (border(x, y)) return [mul(acc, 0.9)];
      if (y === 5 || y === 6) return [acc];
      if (y >= 4 && y <= 7 && x >= 7 && x <= 8) return [[200, 200, 200]];
      return [mul(base, 0.92 + n(x, y >> 2) * 0.12)];
    }),
  barrel_top: (c, { base, acc }) =>
    c.fill((x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (border(x, y)) return [mul(acc, 0.8)];
      return [d > 5 && d < 6.2 ? [70, 70, 75] : mul(base, x % 4 === 0 ? 0.85 : 1)];
    }),
  barrel_side: (c, { base, acc }) =>
    c.fill((x, y) => [y === 2 || y === 13 ? [70, 70, 75] : x % 4 === 0 ? acc : base]),
  glow: (c, { base, acc, n }) =>
    c.fill((x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5) / 10;
      return [mix(acc, base, Math.min(1, d + n(x, y) * 0.35))];
    }),
  lamp: (c, { base, acc, n }) =>
    c.fill((x, y) => [(x + y) % 5 === 0 || (x - y + 16) % 5 === 0 ? acc : mul(base, 0.8 + n(x, y) * 0.2)]),
  water: (c, { base, acc, n }) =>
    c.fill((x, y) => {
      const wave = Math.sin(x * 0.8 + y * 0.4 + n(0, y, 141) * 3) > 0.85;
      return [wave ? acc : mul(base, 0.95 + n(x, y) * 0.1), 175];
    }),
  lava: (c, { base, acc, n }) =>
    c.fill((x, y) => [mix(base, acc, n(x >> 1, y >> 1, 151) * 0.8 + n(x, y) * 0.2)]),
  metal: (c, { base, acc, noisy }) =>
    c.fill((x, y) => {
      if (x === 0 || y === 0) return [mix(base, [255, 255, 255], 0.3)];
      if (x === 15 || y === 15) return [acc];
      return [noisy(base, 0.04, x, y)];
    }),
  thatch: (c, { base, acc, n }) =>
    c.fill((x, y) => [
      y === 3 || y === 12 ? acc : mul(base, 0.85 + n(x, 0, 161) * 0.25 + (n(x, y) - 0.5) * 0.08),
    ]),
  ore: (c, { base, acc, n, noisy }) =>
    c.fill((x, y) => [noisy(n(x >> 1, y >> 1, 171) > 0.8 ? acc : base, 0.1, x, y)]),
  scaffold: (c, { base, acc }) =>
    c.fill((x, y) => {
      if (border(x, y, 2)) return [x < 2 || x > 13 ? acc : base];
      if (Math.abs(x - y) < 1.2) return [base];
      return [base, 0];
    }),
  plant: (c, { base, acc, n }) =>
    c.fill((x, y) => {
      const blade = n(x, 0, 181);
      const h = 4 + Math.floor(blade * 12);
      if (16 - y <= h && blade > 0.35) return [mix(base, acc, n(x, y) * 0.5)];
      return [base, 0];
    }),
  flower: (c, { base, acc }) =>
    c.fill((x, y) => {
      if (x >= 7 && x <= 8 && y >= 7) return [acc];
      if (Math.hypot(x - 7.5, y - 5) < 3.2) return [Math.hypot(x - 7.5, y - 5) < 1.2 ? [240, 220, 80] : base];
      if (y === 11 && (x === 6 || x === 9)) return [acc];
      return [base, 0];
    }),
  torch: (c, { base, acc }) =>
    c.fill((x, y) => {
      if (y < 6) return [acc];
      return [base];
    }),
  ladder: (c, { base, acc }) =>
    c.fill((x, y) => {
      if (x <= 2 || x >= 13) return [acc];
      if (y % 4 === 1) return [base];
      return [base, 0];
    }),
  rail: (c, { base, acc }) =>
    c.fill((x, y) => {
      if (x === 3 || x === 12) return [base];
      if (y % 4 === 2 && x > 1 && x < 14) return [acc];
      return [base, 0];
    }),
  bars: (c, { base, acc }) =>
    c.fill((x, y) => {
      if (x % 5 === 2 || y === 0 || y === 15) return [x % 5 === 2 ? base : acc];
      return [base, 0];
    }),
};

/** Average colour of a texture (for LOD/thumbnails). */
export function averageColor(data: Uint8Array): [number, number, number] {
  let r = 0,
    g = 0,
    b = 0,
    k = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 40) continue;
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
    k++;
  }
  k = Math.max(1, k);
  return [r / k, g / k, b / k];
}
