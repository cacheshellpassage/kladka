/** Rural builds: barn, well, farm, stable, greenhouse, blacksmith, market stalls, fishing hut, watermill. */
import { Builder, STONE, roofSet, woodSet, type Wood } from "../lib/builder";
import { bush, chair, door, furniture, gableRoof, lantern, table, tree, wallTorch, windowRow } from "../lib/parts";

export interface BarnParams {
  width: number;
  depth: number;
  wall: string;
  trim: string;
  wood: Wood;
  roofMat: string;
}

/** Barn with a gambrel (two-pitch) roof, big doors and hay loft. */
export function barn(p: BarnParams): Builder {
  const M = 3,
    W = p.width,
    D = p.depth;
  const b = new Builder(W + 2 * M, 20 + Math.ceil(W / 2), D + 2 * M);
  const w = woodSet(p.wood);
  const roof = roofSet(p.roofMat);
  const x0 = M,
    x1 = M + W - 1,
    z0 = M,
    z1 = M + D - 1;
  b.floor(x0, z0, x1, z1, 0, "stone_bricks");
  const wallTop = 5;
  b.walls(x0, z0, x1, z1, 1, wallTop, p.wall, "walls", w.log);
  // trims
  for (let x = x0; x <= x1; x++) {
    b.set(x, wallTop, z0, p.trim, "walls");
    b.set(x, wallTop, z1, p.trim, "walls");
  }
  // big double door opening on the south gable (2 wide × 3 tall) with gates
  const mid = Math.floor((x0 + x1) / 2);
  for (let y = 1; y <= 3; y++) for (const x of [mid, mid + 1 - (W % 2)]) b.clear(x, y, z1);
  b.set(mid, 1, z1, w.gate, "openings", { facing: "south", open: "false", in_wall: "false", powered: "false" });
  b.set(mid + 1 - (W % 2), 1, z1, w.gate, "openings", { facing: "south", open: "false", in_wall: "false", powered: "false" });
  // white X braces on doors region
  for (let y = 2; y <= 3; y++) {
    b.set(mid - 1, y, z1 + 0, p.trim, "walls");
    b.set(mid + 2 - (W % 2), y, z1, p.trim, "walls");
  }
  // windows on long sides
  for (let z = z0 + 2; z <= z1 - 2; z += 3) {
    windowRow(b, "z", x0, z, z, 3, 3, "glass_pane");
    windowRow(b, "z", x1, z, z, 3, 3, "glass_pane");
  }
  // hay loft floor
  b.fill(x0 + 1, wallTop, z0 + 1, x1 - 1, wallTop, z0 + Math.floor(D / 2), w.planks, "walls");
  for (let x = x0 + 1; x <= x1 - 1; x++) for (let z = z0 + 1; z <= z0 + 2; z++) b.set(x, wallTop + 1, z, "hay_block", "interior", { axis: "y" });
  // gambrel roof: steep lower part then shallow upper part (ridge along z)
  const ov = 1;
  let y = wallTop + 1;
  const cl0 = x0 - ov,
    ch0 = x1 + ov;
  let cl = cl0,
    ch = ch0;
  const steep = Math.max(2, Math.floor(W / 4));
  for (let i = 0; cl <= ch; i++) {
    for (let z = z0 - 1; z <= z1 + 1; z++) {
      if (cl === ch) b.set(cl, y, z, roof.slab, "roof", { type: "bottom" });
      else {
        b.set(cl, y, z, roof.stairs, "roof", { facing: "east", half: "bottom" });
        b.set(ch, y, z, roof.stairs, "roof", { facing: "west", half: "bottom" });
      }
    }
    // gable walls
    for (let x = cl + 1; x <= ch - 1; x++) {
      if (x < x0 || x > x1) continue;
      b.set(x, y, z0, p.wall, "roof");
      b.set(x, y, z1, p.wall, "roof");
    }
    if (i < steep) {
      // steep part: go up twice per step inward
      y++;
      for (let z = z0 - 1; z <= z1 + 1; z++) {
        if (cl + 1 <= ch - 1) {
          b.set(cl + 1, y, z, roof.stairs, "roof", { facing: "east", half: "bottom" });
          b.set(ch - 1, y, z, roof.stairs, "roof", { facing: "west", half: "bottom" });
        }
      }
      for (let x = cl + 2; x <= ch - 2; x++) {
        if (x < x0 || x > x1) continue;
        b.set(x, y, z0, p.wall, "roof");
        b.set(x, y, z1, p.wall, "roof");
      }
      cl += 2;
      ch -= 2;
      y++;
    } else {
      cl++;
      ch--;
      y++;
    }
  }
  // loft window in the south gable
  b.set(mid, wallTop + 3, z1, "glass_pane", "openings");
  // interior
  for (let z = z0 + 1; z < z1 - 1; z += 3) {
    b.set(x0 + 1, 1, z, "hay_block", "interior", { axis: "y" });
    b.set(x1 - 1, 1, z, "composter", "interior", { level: "0" });
  }
  lantern(b, mid, wallTop - 1, Math.floor((z0 + z1) / 2), true);
  wallTorch(b, mid - 2, 3, z1 + 1, "south");
  wallTorch(b, mid + 3 - (W % 2), 3, z1 + 1, "south");
  // fenced paddock
  const pz0 = z1 + 2,
    pz1 = z1 + 2;
  for (let x = x0 - 2; x <= x0 + 1; x++) b.set(x, 0, pz1, w.fence, "decor");
  void pz0;
  return b;
}

export interface WellParams {
  stone: keyof typeof STONE;
  wood: Wood;
  roofMat: string;
}

export function well(p: WellParams): Builder {
  const b = new Builder(11, 10, 11);
  const st = STONE[p.stone]!;
  const w = woodSet(p.wood);
  const c = 5;
  // basin: 4×4 ring with water inside
  b.fill(c - 2, 0, c - 2, c + 1, 0, c + 1, st.block, "foundation");
  b.ring(c - 2, c - 2, c + 1, c + 1, 1, st.block, "walls");
  for (let x = c - 1; x <= c; x++) for (let z = c - 1; z <= c; z++) b.set(x, 1, z, "water", "decor", { level: "0" });
  b.ring(c - 2, c - 2, c + 1, c + 1, 2, st.slab, "walls", { type: "bottom" });
  // posts
  for (const [x, z] of [
    [c - 2, c - 2],
    [c + 1, c - 2],
    [c - 2, c + 1],
    [c + 1, c + 1],
  ] as const)
    for (let y = 2; y <= 4; y++) b.set(x, y, z, w.fence, "frame");
  // small gable roof
  gableRoof(b, c - 2, c - 2, c + 1, c + 1, 5, roofSet(p.roofMat), { axis: "x", gable: null, overhang: 1, deck: w.planks });
  b.set(c, 4, c - 1, "chain", "decor", { axis: "y" });
  lantern(b, c - 1, 4, c, true);
  // path around
  for (let x = c - 4; x <= c + 3; x++)
    for (let z = c - 4; z <= c + 3; z++) {
      const d = Math.max(Math.abs(x - c + 0.5), Math.abs(z - c + 0.5));
      if (d > 2.6 && d < 4 && (x + z) % 3 !== 0) b.set(x, 0, z, "dirt_path", "foundation");
    }
  b.set(c + 3, 1, c - 3, "barrel", "decor", { facing: "up" });
  b.set(c - 4, 1, c + 2, "flower_pot", "decor");
  return b;
}

export interface FarmParams {
  width: number;
  depth: number;
  wood: Wood;
  crops: string[];
}

export function farm(p: FarmParams): Builder {
  const M = 2;
  const b = new Builder(p.width + 2 * M + 6, 12, p.depth + 2 * M);
  const w = woodSet(p.wood);
  const x0 = M,
    z0 = M,
    x1 = M + p.width - 1,
    z1 = M + p.depth - 1;
  // fields with water channels every 5 rows (z axis)
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++) {
      const water = (x - x0) % 9 === 4;
      if (water) {
        b.set(x, 0, z, "water", "foundation", { level: "0" });
      } else {
        b.set(x, 0, z, "farmland", "foundation", { moisture: "7" });
        const crop = p.crops[Math.floor((x - x0) / 9) % p.crops.length]!;
        b.set(x, 1, z, crop, "decor", { age: "7" });
      }
    }
  // border logs & fence
  b.ring(x0 - 1, z0 - 1, x1 + 1, z1 + 1, 0, w.log, "foundation", { axis: "y" });
  b.ring(x0 - 1, z0 - 1, x1 + 1, z1 + 1, 1, w.fence, "decor");
  const gx = Math.floor((x0 + x1) / 2);
  b.set(gx, 1, z1 + 1, w.gate, "openings", { facing: "south", open: "false", in_wall: "false", powered: "false" });
  for (const [x, z] of [
    [x0 - 1, z0 - 1],
    [x1 + 1, z0 - 1],
    [x0 - 1, z1 + 1],
    [x1 + 1, z1 + 1],
  ] as const) {
    b.set(x, 1, z, w.log, "frame", { axis: "y" });
    b.set(x, 2, z, "torch", "lighting");
  }
  // scarecrow
  const sx = gx + 2,
    sz = Math.floor((z0 + z1) / 2);
  b.set(sx, 1, sz, w.fence, "decor");
  b.set(sx, 2, sz, w.fence, "decor");
  b.set(sx, 3, sz, "hay_block", "decor", { axis: "y" });
  b.set(sx, 4, sz, "carved_pumpkin", "decor", { facing: "south" });
  b.set(sx - 1, 3, sz, w.fence, "decor");
  b.set(sx + 1, 3, sz, w.fence, "decor");
  // tool shed on the east
  const hx0 = x1 + 3,
    hx1 = x1 + 6,
    hz0 = z0,
    hz1 = z0 + 3;
  b.floor(hx0, hz0, hx1, hz1, 0, "cobblestone");
  b.walls(hx0, hz0, hx1, hz1, 1, 3, w.planks, "walls", w.log);
  door(b, hx0 + 1, 1, hz1, "south", w.door);
  gableRoof(b, hx0, hz0, hx1, hz1, 4, w.mat, { axis: "z", gable: w.planks });
  b.set(hx1 - 1, 1, hz0 + 1, "composter", "interior", { level: "0" });
  b.set(hx0 + 1, 1, hz0 + 1, "barrel", "interior", { facing: "up" });
  b.set(hx1 - 1, 1, hz1 - 1, "chest", "interior", { facing: "west" });
  wallTorch(b, hx0 + 2, 2, hz1 + 1, "south");
  tree(b, hx1 + 2, 0, hz1 + 4, w, 4, 2);
  return b;
}

export function stable(p: { stalls: number; wood: Wood; roofMat: string }): Builder {
  const W = p.stalls * 3 + 1,
    D = 7,
    M = 3;
  const b = new Builder(W + 2 * M, 14, D + 2 * M + 2);
  const w = woodSet(p.wood);
  const x0 = M,
    z0 = M,
    x1 = M + W - 1,
    z1 = M + D - 1;
  b.floor(x0, z0, x1, z1, 0, "coarse_dirt");
  // back wall closed, front open with posts
  b.walls(x0, z0, x1, z0, 1, 3, w.planks, "walls");
  for (let z = z0; z <= z1; z++) {
    for (let y = 1; y <= 3; y++) {
      b.set(x0, y, z, w.planks, "walls");
      b.set(x1, y, z, w.planks, "walls");
    }
  }
  for (let i = 0; i <= p.stalls; i++) {
    const x = x0 + i * 3;
    for (let y = 1; y <= 3; y++) b.set(x, y, z1, w.log, "frame", { axis: "y" });
    if (i > 0 && i < p.stalls) for (let z = z0 + 1; z <= z1 - 3; z++) b.set(x, 1, z, w.fence, "interior");
  }
  for (let i = 0; i < p.stalls; i++) {
    const x = x0 + i * 3 + 1;
    b.set(x, 1, z0 + 1, "hay_block", "interior", { axis: "y" });
    b.set(x + 1, 1, z0 + 1, "cauldron", "interior");
    b.set(x, 1, z1, w.gate, "openings", { facing: "south", open: "false", in_wall: "false", powered: "false" });
    b.set(x + 1, 1, z1, w.gate, "openings", { facing: "south", open: "false", in_wall: "false", powered: "false" });
    lantern(b, x, 3, z1 - 1, true);
  }
  b.fill(x0, 4, z0, x1, 4, z1, w.planks, "walls");
  gableRoof(b, x0, z0, x1, z1, 4, roofSet(p.roofMat), { axis: "x", gable: w.planks, eaveTrim: true });
  for (let x = x0 + 1; x <= x1 - 1; x += 2) b.set(x, 0, z1 + 2, "hay_block", "decor", { axis: "x" });
  return b;
}

export function greenhouse(p: { width: number; depth: number; frame: string }): Builder {
  const M = 2,
    W = p.width,
    D = p.depth;
  const b = new Builder(W + 2 * M, 12, D + 2 * M);
  const x0 = M,
    z0 = M,
    x1 = M + W - 1,
    z1 = M + D - 1;
  b.floor(x0, z0, x1, z1, 0, "smooth_stone");
  b.walls(x0, z0, x1, z1, 1, 4, "glass", "openings");
  for (let x = x0; x <= x1; x += 3) for (let y = 1; y <= 4; y++) {
    b.set(x, y, z0, p.frame, "frame");
    b.set(x, y, z1, p.frame, "frame");
  }
  for (const x of [x0, x1]) for (let z = z0; z <= z1; z += 3) for (let y = 1; y <= 4; y++) b.set(x, y, z, p.frame, "frame");
  // glass gable roof
  let cl = z0,
    ch = z1,
    y = 5;
  while (cl <= ch) {
    for (let x = x0; x <= x1; x++) {
      b.set(x, y, cl, "glass", "roof");
      b.set(x, y, ch, "glass", "roof");
    }
    for (let z = cl; z <= ch; z++) {
      b.set(x0, y, z, "glass", "roof");
      b.set(x1, y, z, "glass", "roof");
    }
    cl++;
    ch--;
    y++;
  }
  door(b, Math.floor((x0 + x1) / 2), 1, z1, "south", "birch_door");
  // planting beds
  for (let x = x0 + 1; x <= x1 - 1; x++)
    for (const z of [z0 + 1, z1 - 1]) {
      if (x === Math.floor((x0 + x1) / 2) && z === z1 - 1) continue;
      b.set(x, 0, z, "farmland", "foundation", { moisture: "7" });
      b.set(x, 1, z, ["carrots", "potatoes", "beetroots", "wheat"][x % 4]!, "decor", { age: x % 4 === 2 ? "3" : "7" });
    }
  for (let x = x0 + 2; x <= x1 - 2; x += 2) b.set(x, 1, Math.floor((z0 + z1) / 2), "potted_red_tulip", "decor");
  b.set(x0 + 1, 1, Math.floor((z0 + z1) / 2), "water_cauldron", "interior", { level: "3" });
  lantern(b, Math.floor((x0 + x1) / 2), 4, Math.floor((z0 + z1) / 2), true);
  return b;
}

export function blacksmith(p: { wood: Wood; stone: keyof typeof STONE; roofMat: string }): Builder {
  const M = 3,
    W = 9,
    D = 7;
  const b = new Builder(W + 2 * M, 14, D + 2 * M);
  const w = woodSet(p.wood);
  const st = STONE[p.stone]!;
  const x0 = M,
    z0 = M,
    x1 = M + W - 1,
    z1 = M + D - 1;
  b.floor(x0, z0, x1, z1, 0, st.block);
  // closed back half
  const zm = z0 + 3;
  b.walls(x0, z0, x1, zm, 1, 3, w.planks, "walls", w.log);
  door(b, x0 + 2, 1, zm, "south", w.door);
  windowRow(b, "x", z0, x0 + 3, x0 + 5, 2, 2);
  // open forge area with posts
  for (const x of [x0, x1]) for (let y = 1; y <= 3; y++) b.set(x, y, z1, w.log, "frame", { axis: "y" });
  b.fill(x0, 4, z0, x1, 4, z1, w.planks, "walls");
  gableRoof(b, x0, z0, x1, z1, 4, roofSet(p.roofMat), { axis: "x", gable: w.planks, eaveTrim: true });
  // forge: stone block with lava-free hearth (campfire), chimney
  b.fill(x1 - 2, 1, zm + 1, x1 - 1, 1, zm + 2, st.block, "interior");
  b.set(x1 - 2, 2, zm + 1, "campfire", "interior", { lit: "true", facing: "south", signal_fire: "false", waterlogged: "false" });
  b.set(x1 - 1, 2, zm + 1, "blast_furnace", "interior", { facing: "south" });
  for (let y = 2; y <= 8; y++) b.set(x1 - 1, y, zm + 2, "bricks", y > 4 ? "roof" : "interior");
  b.set(x0 + 2, 1, zm + 2, "anvil", "interior", { facing: "east" });
  b.set(x0 + 4, 1, zm + 1, "grindstone", "interior", { face: "floor", facing: "south" });
  b.set(x0 + 1, 1, zm + 1, "smithing_table", "interior");
  b.set(x0 + 1, 1, zm + 3, "water_cauldron", "interior", { level: "3" });
  b.set(x0 + 1, 1, z0 + 1, "chest", "interior", { facing: "south" });
  b.set(x1 - 1, 1, z0 + 1, "barrel", "interior", { facing: "up" });
  lantern(b, x0 + 4, 3, zm + 2, true);
  wallTorch(b, x0 + 1, 2, zm + 1, "south");
  return b;
}

export function marketStalls(p: { count: number; wood: Wood; colors: string[] }): Builder {
  const w = woodSet(p.wood);
  const span = 5;
  const b = new Builder(p.count * (span + 1) + 4, 8, 9);
  for (let i = 0; i < p.count; i++) {
    const x0 = 2 + i * (span + 1),
      x1 = x0 + span - 1,
      z0 = 2,
      z1 = 5;
    const color = p.colors[i % p.colors.length]!;
    for (const [x, z] of [
      [x0, z0],
      [x1, z0],
      [x0, z1],
      [x1, z1],
    ] as const)
      for (let y = 0; y <= 3; y++) b.set(x, y, z, w.fence, "frame");
    // counter
    for (let x = x0 + 1; x <= x1 - 1; x++) b.set(x, 0, z1, w.planks, "interior");
    for (let x = x0 + 1; x <= x1 - 1; x++) b.set(x, 1, z1, w.slab, "interior", { type: "bottom" });
    // striped awning sloping to the front
    for (let x = x0; x <= x1; x++) {
      const c = x % 2 === 0 ? `${color}_wool` : "white_wool";
      b.set(x, 4, z0, c, "roof");
      b.set(x, 4, z0 + 1, c, "roof");
      b.set(x, 4, z0 + 2, c, "roof");
      b.set(x, 3, z1 + 1 - 1 + 1, `${color}_carpet`, "roof");
    }
    // goods
    b.set(x0 + 1, 2, z1, "melon", "decor");
    b.set(x0 + 2, 2, z1, "pumpkin", "decor");
    b.set(x0 + 3, 2, z1, "flower_pot", "decor");
    b.set(x0 + 2, 0, z0 + 1, "barrel", "interior", { facing: "up" });
    b.set(x0 + 1, 0, z0 + 1, "chest", "interior", { facing: "south" });
    lantern(b, x0 + 2, 3, z0 + 1, true);
  }
  return b;
}

export function fishingHut(p: { wood: Wood; roofMat: string }): Builder {
  const w = woodSet(p.wood);
  const b = new Builder(15, 13, 20);
  // water area (one layer)
  for (let x = 0; x < 15; x++) for (let z = 9; z < 20; z++) b.set(x, 0, z, "water", "foundation", { level: "0" });
  // shore
  for (let x = 0; x < 15; x++) for (let z = 0; z < 9; z++) b.set(x, 0, z, "sand", "foundation");
  // pier on posts
  const px0 = 5,
    px1 = 8;
  for (let z = 7; z <= 18; z++) for (let x = px0; x <= px1; x++) b.set(x, 1, z, w.planks, "foundation");
  for (let z = 9; z <= 18; z += 3) for (const x of [px0, px1]) b.set(x, 0, z, w.log, "foundation", { axis: "y" });
  for (let z = 9; z <= 18; z++) {
    b.set(px0, 2, z, w.fence, "decor");
    b.set(px1, 2, z, w.fence, "decor");
  }
  b.clear(px0, 2, 18);
  b.clear(px1, 2, 18);
  lantern(b, px0, 3, 12, false);
  lantern(b, px1, 3, 15, false);
  // hut on the shore
  const x0 = 3,
    x1 = 10,
    z0 = 1,
    z1 = 6;
  b.floor(x0, z0, x1, z1, 1, w.planks);
  b.walls(x0, z0, x1, z1, 2, 4, w.planks, "walls", w.log);
  door(b, 6, 2, z1, "south", w.door);
  windowRow(b, "x", z0, 5, 8, 3, 3);
  windowRow(b, "z", x1, 3, 4, 3, 3);
  gableRoof(b, x0, z0, x1, z1, 5, roofSet(p.roofMat), { axis: "x", gable: w.planks, eaveTrim: true });
  b.set(x0 + 1, 2, z0 + 1, "barrel", "interior", { facing: "up" });
  b.set(x0 + 2, 2, z0 + 1, "barrel", "interior", { facing: "up" });
  b.set(x1 - 1, 2, z0 + 1, "chest", "interior", { facing: "south" });
  b.set(x1 - 1, 2, z1 - 2, "red_bed", "interior", { facing: "north", part: "foot", occupied: "false" });
  b.set(x1 - 1, 2, z1 - 3, "red_bed", "interior", { facing: "north", part: "head", occupied: "false" });
  b.set(x0 + 1, 2, z1 - 1, "crafting_table", "interior");
  wallTorch(b, 5, 3, z1 + 1, "south");
  // crates and nets on the pier
  b.set(px1 - 1, 2, 17, "barrel", "decor", { facing: "up" });
  b.set(px0 + 1, 2, 16, "cobweb", "decor");
  chair(b, px0 + 1, 2, 14, w, "west");
  bush(b, 1, 1, 2, "oak_leaves", 1);
  return b;
}

export function watermill(p: { wood: Wood; stone: keyof typeof STONE; roofMat: string }): Builder {
  const w = woodSet(p.wood);
  const st = STONE[p.stone]!;
  const b = new Builder(22, 18, 18);
  const x0 = 3,
    z0 = 3,
    x1 = 11,
    z1 = 11;
  // stream along the east side
  for (let z = 0; z < 18; z++) for (let x = 13; x <= 17; x++) b.set(x, 0, z, "water", "foundation", { level: "0" });
  b.floor(x0, z0, x1, z1, 0, st.block);
  b.walls(x0, z0, x1, z1, 1, 2, st.block, "walls");
  b.walls(x0, z0, x1, z1, 3, 6, w.planks, "walls", w.log);
  b.fill(x0, 7, z0, x1, 7, z1, w.planks, "walls");
  gableRoof(b, x0, z0, x1, z1, 7, roofSet(p.roofMat), { axis: "z", gable: w.planks, eaveTrim: true });
  door(b, 7, 1, z1, "south", w.door);
  windowRow(b, "x", z1, 4, 5, 4, 5);
  windowRow(b, "x", z1, 9, 10, 4, 5);
  windowRow(b, "x", z0, 6, 8, 4, 5);
  // axle and wheel on the east side (wheel plane x = 14)
  const cy = 5,
    cz = 7;
  b.set(x1 + 1, cy, cz, w.log, "decor", { axis: "x" });
  b.set(x1 + 2, cy, cz, w.log, "decor", { axis: "x" });
  for (let dy = -4; dy <= 4; dy++)
    for (let dz = -4; dz <= 4; dz++) {
      const d = Math.hypot(dy, dz);
      if (d > 3.5 && d < 4.6) b.set(14, cy + dy, cz + dz, w.planks, "decor");
      else if ((dy === 0 || dz === 0) && d < 3.6) b.set(14, cy + dy, cz + dz, w.fence, "decor");
    }
  b.set(14, cy, cz, w.log, "decor", { axis: "x" });
  // interior
  b.set(x0 + 1, 1, z0 + 1, "stonecutter", "interior", { facing: "south" });
  b.set(x0 + 2, 1, z0 + 1, "barrel", "interior", { facing: "up" });
  b.set(x0 + 3, 1, z0 + 1, "barrel", "interior", { facing: "up" });
  b.set(x1 - 1, 1, z0 + 1, "hay_block", "interior", { axis: "y" });
  table(b, 6, 1, 7, w);
  lantern(b, 7, 6, 7, true);
  wallTorch(b, 6, 2, z1 + 1, "south");
  wallTorch(b, 8, 2, z1 + 1, "south");
  return b;
}

export { furniture };
