/** Towers: square watchtower, round wizard tower, lighthouse, windmill. */
import { Builder, STONE, roofSet, woodSet, type Wood } from "../lib/builder";
import { coneRoof, door, hipRoof, lantern, wallTorch, windowRow } from "../lib/parts";

export interface WatchtowerParams {
  size: number;
  height: number;
  stone: keyof typeof STONE;
  wood: Wood;
  roofMat: string;
}

export function watchtower(p: WatchtowerParams): Builder {
  const S = p.size,
    M = 3;
  const b = new Builder(S + 2 * M, p.height + S + 10, S + 2 * M);
  const st = STONE[p.stone]!;
  const w = woodSet(p.wood);
  const x0 = M,
    z0 = M,
    x1 = M + S - 1,
    z1 = M + S - 1;
  b.floor(x0 - 1, z0 - 1, x1 + 1, z1 + 1, 0, st.block, "foundation");
  b.walls(x0, z0, x1, z1, 1, p.height, st.block, "walls");
  // corner buttresses
  for (const [x, z] of [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ] as const)
    for (let y = 1; y <= p.height; y++) b.set(x, y, z, st.wall ? "chiseled_stone_bricks" : st.block, "frame");
  // arrow slits
  const mid = Math.floor((x0 + x1) / 2);
  for (let y = 4; y < p.height - 2; y += 4) {
    b.clear(mid, y, z0);
    b.clear(mid, y, z1);
    b.clear(x0, y, mid);
    b.clear(x1, y, mid);
    b.set(mid, y, z0, "iron_bars", "openings");
    b.set(x0, y, mid, "iron_bars", "openings");
    b.set(x1, y, mid, "iron_bars", "openings");
  }
  door(b, mid, 1, z1, "south", "spruce_door");
  // internal ladder on the north wall
  for (let y = 1; y <= p.height; y++) b.set(mid, y, z0 + 1, "ladder", "interior", { facing: "south" });
  // lookout platform (overhanging)
  const py = p.height + 1;
  b.fill(x0 - 1, py, z0 - 1, x1 + 1, py, z1 + 1, w.planks, "walls");
  b.clear(mid, py, z0 + 1);
  b.set(mid, py, z0 + 1, "ladder", "interior", { facing: "south" });
  for (let x = x0 - 1; x <= x1 + 1; x++) {
    b.set(x, py - 1, z0 - 1, st.stairs, "walls", { facing: "south", half: "top" });
    b.set(x, py - 1, z1 + 1, st.stairs, "walls", { facing: "north", half: "top" });
  }
  for (let z = z0; z <= z1; z++) {
    b.set(x0 - 1, py - 1, z, st.stairs, "walls", { facing: "east", half: "top" });
    b.set(x1 + 1, py - 1, z, st.stairs, "walls", { facing: "west", half: "top" });
  }
  // posts and railing
  for (const [x, z] of [
    [x0 - 1, z0 - 1],
    [x1 + 1, z0 - 1],
    [x0 - 1, z1 + 1],
    [x1 + 1, z1 + 1],
  ] as const)
    for (let y = py + 1; y <= py + 3; y++) b.set(x, y, z, w.log, "frame", { axis: "y" });
  b.ring(x0 - 1, z0 - 1, x1 + 1, z1 + 1, py + 1, w.fence, "decor");
  for (const [x, z] of [
    [x0 - 1, z0 - 1],
    [x1 + 1, z0 - 1],
    [x0 - 1, z1 + 1],
    [x1 + 1, z1 + 1],
  ] as const)
    b.set(x, py + 1, z, w.log, "frame", { axis: "y" });
  hipRoof(b, x0 - 1, z0 - 1, x1 + 1, z1 + 1, py + 4, roofSet(p.roofMat), 1, undefined, w.planks);
  lantern(b, mid, py + 3, mid, true);
  wallTorch(b, mid - 1, 3, z1 + 1, "south");
  wallTorch(b, mid + 1, 3, z1 + 1, "south");
  return b;
}

export interface RoundTowerParams {
  radius: number;
  height: number;
  stone: keyof typeof STONE;
  roofMat: string;
  accent: string;
  wood: Wood;
  tip?: string;
}

/** Round tower with a tall cone roof ("wizard tower"). */
export function wizardTower(p: RoundTowerParams): Builder {
  const R = p.radius;
  const size = 2 * R + 9;
  const b = new Builder(size, p.height + R * 3 + 10, size);
  const c = Math.floor(size / 2);
  const st = STONE[p.stone]!;
  const w = woodSet(p.wood);
  b.circle(c, c, R + 1, true, (x, z) => b.set(x, 0, z, st.block, "foundation"));
  for (let y = 1; y <= p.height; y++) {
    b.circle(c, c, R, false, (x, z) => b.set(x, y, z, y % 6 === 0 ? p.accent : st.block, "walls"));
  }
  // floors every 6 blocks
  for (let y = 6; y < p.height; y += 6)
    b.circle(c, c, R - 1, true, (x, z) => b.set(x, y, z, w.planks, "walls"));
  // windows (4 directions)
  for (let y = 3; y < p.height; y += 6) {
    for (const [dx, dz] of [
      [0, -R],
      [R, 0],
      [-R, 0],
    ] as const)
      for (let k = 0; k < 2; k++) b.set(c + dx, y + k, c + dz, "glass_pane", "openings");
  }
  door(b, c, 1, c + R, "south", w.door);
  // ladder through floors along the north wall
  for (let y = 1; y <= p.height; y++) {
    b.clear(c, y, c - R + 1);
    b.set(c, y, c - R + 1, "ladder", "interior", { facing: "south" });
  }
  // overhanging rim
  const top = p.height + 1;
  b.circle(c, c, R + 1, false, (x, z) => b.set(x, top, z, st.block, "walls"));
  b.circle(c, c, R, true, (x, z) => b.set(x, top, z, w.planks, "walls"));
  b.clear(c, top, c - R + 1);
  b.set(c, top, c - R + 1, "ladder", "interior", { facing: "south" });
  coneRoof(b, c, c, R + 1.5, top + 1, roofSet(p.roofMat), p.tip ?? "end_rod");
  wallTorch(b, c - 1, 3, c + R + 1, "south");
  wallTorch(b, c + 1, 3, c + R + 1, "south");
  b.set(c + 1, 1, c, "enchanting_table", "interior");
  b.set(c - 1, 1, c, "bookshelf", "interior");
  b.set(c - 1, 2, c, "bookshelf", "interior");
  b.set(c, 7, c, "brewing_stand", "interior");
  lantern(b, c + 1, 5, c + 1, true, p.accent.includes("purpur") || p.accent.includes("amethyst"));
  return b;
}

export interface LighthouseParams {
  radius: number;
  height: number;
  stripeA: string;
  stripeB: string;
  base: keyof typeof STONE;
}

export function lighthouse(p: LighthouseParams): Builder {
  const R = p.radius;
  const size = 2 * R + 11;
  const b = new Builder(size, p.height + 14, size);
  const c = Math.floor(size / 2);
  const st = STONE[p.base]!;
  // rocky base platform
  b.circle(c, c, R + 3, true, (x, z) => b.set(x, 0, z, st.block, "foundation"));
  b.circle(c, c, R + 3, false, (x, z) => b.set(x, 1, z, st.wall ?? st.slab, "decor"));
  b.circle(c, c, R + 1, true, (x, z) => b.set(x, 1, z, st.block, "foundation"));
  for (let y = 2; y <= p.height; y++) {
    const r = R - Math.floor((y / p.height) * 1.2);
    const stripe = Math.floor((y - 2) / 4) % 2 === 0 ? p.stripeA : p.stripeB;
    b.circle(c, c, r, false, (x, z) => b.set(x, y, z, stripe, "walls"));
  }
  for (let y = 4; y < p.height; y += 5) b.set(c, y, c + R, "glass_pane", "openings");
  door(b, c, 2, c + R, "south", "spruce_door");
  for (let y = 2; y <= p.height; y++) b.set(c, y, c - R + 1, "ladder", "interior", { facing: "south" });
  // gallery
  const g = p.height + 1;
  b.circle(c, c, R + 1, true, (x, z) => b.set(x, g, z, st.block, "walls"));
  b.clear(c, g, c - R + 1);
  b.set(c, g, c - R + 1, "ladder", "interior", { facing: "south" });
  b.circle(c, c, R + 1, false, (x, z) => b.set(x, g + 1, z, "iron_bars", "decor"));
  // lantern room
  const lr = Math.max(1, R - 1);
  for (let y = g + 1; y <= g + 3; y++)
    b.circle(c, c, lr, false, (x, z) => b.set(x, y, z, "glass", "openings"));
  b.set(c, g + 1, c, "sea_lantern", "lighting");
  b.set(c, g + 2, c, "glowstone", "lighting");
  b.circle(c, c, lr + 1, true, (x, z) => b.set(x, g + 4, z, p.stripeB, "roof"));
  coneRoof(b, c, c, lr + 0.5, g + 5, roofSet("dark_prismarine"), "lightning_rod");
  return b;
}

export interface WindmillParams {
  radius: number;
  height: number;
  wall: string;
  wood: Wood;
  roofMat: string;
  sail: string;
}

export function windmill(p: WindmillParams): Builder {
  const R = p.radius;
  const sailLen = p.height - 2;
  const size = 2 * Math.max(R + 3, sailLen + 2) + 3;
  const b = new Builder(size, p.height + sailLen + R + 10, size);
  const c = Math.floor(size / 2);
  const w = woodSet(p.wood);
  b.circle(c, c, R + 1, true, (x, z) => b.set(x, 0, z, "cobblestone", "foundation"));
  for (let y = 1; y <= p.height; y++) {
    const r = R - (y > p.height * 0.6 ? 1 : 0);
    b.circle(c, c, r, false, (x, z) => b.set(x, y, z, y <= 2 ? "cobblestone" : p.wall, "walls"));
  }
  for (let y = 5; y < p.height; y += 4) {
    b.set(c + R - (y > p.height * 0.6 ? 1 : 0), y, c, "glass_pane", "openings");
    b.set(c - R + (y > p.height * 0.6 ? 1 : 0), y, c, "glass_pane", "openings");
  }
  door(b, c, 1, c + R, "south", w.door);
  const top = p.height + 1;
  b.circle(c, c, R - 1, true, (x, z) => b.set(x, top - 1, z, w.planks, "walls"));
  coneRoof(b, c, c, R, top, roofSet(p.roofMat));
  // hub and sails on the south side
  const hy = p.height - 1;
  const hz = c + R - (hy > p.height * 0.6 ? 1 : 0);
  b.set(c, hy, hz + 1, w.log, "decor", { axis: "z" });
  b.set(c, hy, hz + 2, w.log, "decor", { axis: "z" });
  for (let i = 1; i <= sailLen; i++) {
    const arms: Array<[number, number]> = [
      [c + i, hy],
      [c - i, hy],
      [c, hy + i],
      [c, hy - i],
    ];
    for (const [x, y] of arms) b.set(x, y, hz + 2, w.fence, "decor");
    if (i >= 2) {
      // sail cloth on one side of each arm
      b.set(c + i, hy + 1, hz + 2, p.sail, "decor");
      b.set(c - i, hy - 1, hz + 2, p.sail, "decor");
      b.set(c - 1, hy + i, hz + 2, p.sail, "decor");
      b.set(c + 1, hy - i, hz + 2, p.sail, "decor");
    }
  }
  // flour sacks & interior
  b.set(c + 1, 1, c - 1, "barrel", "interior", { facing: "up" });
  b.set(c - 1, 1, c - 1, "hay_block", "interior", { axis: "y" });
  b.set(c, 1, c, "stonecutter", "interior", { facing: "south" });
  wallTorch(b, c - 1, 3, c + R + 1, "south");
  void windowRow;
  return b;
}
