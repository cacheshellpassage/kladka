/** Landmarks: bridge, pagoda, shrine gate, tea house, mini castle, chapel, gazebo, fountain, treehouse, modern villa. */
import { Builder, STONE, roofSet, woodSet, type Wood } from "../lib/builder";
import { bed, bush, chair, door, furniture, gableRoof, hipRoof, lantern, table, tree, wallTorch, windowRow } from "../lib/parts";

export function bridge(p: { length: number; width: number; stone: keyof typeof STONE; wood: Wood; arches: number }): Builder {
  const st = STONE[p.stone]!;
  const w = woodSet(p.wood);
  const L = p.length,
    Wd = p.width;
  const rise = Math.max(3, Math.floor(L / 6));
  const b = new Builder(L + 4, rise + 10, Wd + 6);
  const z0 = 3,
    z1 = 3 + Wd - 1;
  // water under the bridge
  for (let x = 4; x < L; x++) for (let z = 0; z < Wd + 6; z++) b.set(x, 0, z, "water", "foundation", { level: "0" });
  // deck follows a gentle arc
  const deckY = (x: number) => Math.round(rise * Math.sin((Math.PI * (x - 2)) / (L - 1))) + 2;
  for (let x = 2; x < L + 2; x++) {
    const y = deckY(x);
    for (let z = z0; z <= z1; z++) b.set(x, y, z, z === z0 || z === z1 ? st.block : w.planks, "walls");
    // parapet
    b.set(x, y + 1, z0, st.wall ?? st.slab, "decor");
    b.set(x, y + 1, z1, st.wall ?? st.slab, "decor");
    // fill below the deck down to the arches
    const span = (L - 1) / p.arches;
    const local = ((x - 2) % span) / span; // 0..1 in each arch
    const archTop = Math.round(Math.sin(Math.PI * local) * (rise + 1));
    for (let yy = 1; yy < y; yy++) {
      if (yy <= archTop) continue;
      for (let z = z0; z <= z1; z++) b.set(x, yy, z, st.block, "foundation");
    }
    // piers between arches go down into the water
    if (local < 1 / span || x === 2 || x === L + 1) for (let yy = 0; yy < y; yy++) for (let z = z0; z <= z1; z++) b.set(x, yy, z, st.block, "foundation");
  }
  // stairs at both ends
  for (const [x, f] of [
    [1, "east"],
    [L + 2, "west"],
  ] as const)
    for (let z = z0 + 1; z <= z1 - 1; z++) b.set(x, 1, z, st.stairs, "foundation", { facing: f, half: "bottom" });
  // lamp posts
  for (const x of [3, Math.floor(L / 2) + 2, L]) {
    const y = deckY(x) + 1;
    for (const z of [z0, z1]) {
      b.set(x, y, z, st.wall ?? w.fence, "decor");
      b.set(x, y + 1, z, w.fence, "decor");
      lantern(b, x, y + 2, z, false);
    }
  }
  return b;
}

export function pagoda(p: { tiers: number; base: number; wood: Wood; wall: string; roofMat: string; pillar: string }): Builder {
  const size = p.base + 8;
  const tierH = 4;
  const b = new Builder(size, p.tiers * (tierH + 2) + 10, size);
  const c = Math.floor(size / 2);
  const w = woodSet(p.wood);
  const roof = roofSet(p.roofMat);
  // stone platform with steps
  const h0 = Math.floor(p.base / 2) + 1;
  b.fill(c - h0 - 1, 0, c - h0 - 1, c + h0 + 1, 0, c + h0 + 1, "stone_bricks", "foundation");
  b.fill(c - h0, 1, c - h0, c + h0, 1, c + h0, "polished_andesite", "foundation");
  for (let x = c - 1; x <= c + 1; x++) b.set(x, 1, c + h0 + 1, "stone_brick_stairs", "foundation", { facing: "north", half: "bottom" });
  let y = 2;
  for (let t = 0; t < p.tiers; t++) {
    const h = Math.max(1, Math.floor(p.base / 2) - t);
    const x0 = c - h,
      x1 = c + h,
      z0 = c - h,
      z1 = c + h;
    b.walls(x0, z0, x1, z1, y, y + tierH - 2, p.wall, "walls");
    for (const [x, z] of [
      [x0, z0],
      [x1, z0],
      [x0, z1],
      [x1, z1],
    ] as const)
      for (let yy = y; yy <= y + tierH - 2; yy++) b.set(x, yy, z, p.pillar, "frame");
    // openings on each side
    for (const [ax, fx] of [
      ["x", z1],
      ["x", z0],
      ["z", x0],
      ["z", x1],
    ] as const)
      windowRow(b, ax, fx, c - (h > 2 ? 1 : 0), c + (h > 2 ? 1 : 0), y + 1, y + 1, t === 0 && ax === "x" && fx === z1 ? "air" : `${w.trapdoor}`);
    if (t === 0) door(b, c, y, z1, "south", w.door);
    // floor slab & flared roof
    const ry = y + tierH - 1;
    b.fill(x0, ry, z0, x1, ry, z1, w.planks, "walls");
    // flared eaves: ring of upside-down stairs then roof ring sloping in
    const o = 2;
    for (let x = x0 - o; x <= x1 + o; x++) {
      b.set(x, ry, z0 - o, roof.stairs, "roof", { facing: "north", half: "top" });
      b.set(x, ry, z1 + o, roof.stairs, "roof", { facing: "south", half: "top" });
    }
    for (let z = z0 - o + 1; z <= z1 + o - 1; z++) {
      b.set(x0 - o, ry, z, roof.stairs, "roof", { facing: "west", half: "top" });
      b.set(x1 + o, ry, z, roof.stairs, "roof", { facing: "east", half: "top" });
    }
    b.fill(x0 - 1, ry, z0 - 1, x1 + 1, ry, z0 - 1, roof.slab, "roof", { type: "top" });
    b.fill(x0 - 1, ry, z1 + 1, x1 + 1, ry, z1 + 1, roof.slab, "roof", { type: "top" });
    b.fill(x0 - 1, ry, z0, x0 - 1, ry, z1, roof.slab, "roof", { type: "top" });
    b.fill(x1 + 1, ry, z0, x1 + 1, ry, z1, roof.slab, "roof", { type: "top" });
    // upturned corners
    for (const [x, z] of [
      [x0 - o, z0 - o],
      [x1 + o, z0 - o],
      [x0 - o, z1 + o],
      [x1 + o, z1 + o],
    ] as const)
      b.set(x, ry + 1, z, roof.slab, "roof", { type: "bottom" });
    hipRoof(b, x0, z0, x1, z1, ry + 1, roof, 0);
    // lanterns hanging under eaves
    lantern(b, x0 - 1, ry - 1, z1 + 1, true);
    lantern(b, x1 + 1, ry - 1, z1 + 1, true);
    y = ry + 2;
  }
  // spire
  for (let i = 0; i < 3; i++) b.set(c, y - 1 + i, c, i === 2 ? "lightning_rod" : "chain", "roof", i === 2 ? { facing: "up" } : { axis: "y" });
  // garden
  tree(b, 1, 0, 1, woodSet("cherry"), 4, 2);
  bush(b, size - 2, 0, size - 2, "azalea_leaves", 1);
  return b;
}

export function shrine(p: { wood: Wood; gate: string; roofMat: string }): Builder {
  const b = new Builder(17, 12, 21);
  const w = woodSet(p.wood);
  const roof = roofSet(p.roofMat);
  // gravel path
  for (let z = 0; z < 21; z++) for (let x = 6; x <= 10; x++) b.set(x, 0, z, x === 6 || x === 10 ? "stone_bricks" : "gravel", "foundation");
  // torii gate at the front
  const gz = 17;
  for (const x of [5, 11]) {
    b.set(x, 0, gz, "stone_bricks", "foundation");
    for (let y = 1; y <= 5; y++) b.set(x, y, gz, p.gate, "frame");
  }
  for (let x = 4; x <= 12; x++) b.set(x, 6, gz, p.gate, "walls");
  for (let x = 3; x <= 13; x++) b.set(x, 7, gz, "dark_oak_slab", "roof", { type: "bottom" });
  for (let x = 5; x <= 11; x++) b.set(x, 4, gz, p.gate, "walls");
  b.set(8, 5, gz, "dark_oak_planks", "walls");
  // shrine building
  const x0 = 4,
    x1 = 12,
    z0 = 2,
    z1 = 8;
  b.fill(x0 - 1, 1, z0 - 1, x1 + 1, 1, z1 + 1, "stone_bricks", "foundation");
  b.walls(x0, z0, x1, z1, 2, 4, "white_terracotta", "walls", w.log);
  for (let x = x0 + 2; x <= x1 - 2; x += 2) for (let y = 2; y <= 4; y++) b.set(x, y, z1, p.gate, "frame");
  door(b, 8, 2, z1, "south", w.door);
  windowRow(b, "x", z1, 6, 6, 3, 3, w.trapdoor);
  windowRow(b, "x", z1, 10, 10, 3, 3, w.trapdoor);
  b.fill(x0, 5, z0, x1, 5, z1, w.planks, "walls");
  gableRoof(b, x0, z0, x1, z1, 5, roof, { axis: "x", gable: w.planks, overhang: 2, eaveTrim: true });
  // stone lanterns along the path
  for (const z of [11, 14]) {
    for (const x of [5, 11]) {
      b.set(x, 0, z, "stone_bricks", "foundation");
      b.set(x, 1, z, "stone_brick_wall", "decor");
      b.set(x, 2, z, "lantern", "lighting", { hanging: "false", waterlogged: "false" });
      b.set(x, 3, z, "stone_brick_slab", "decor", { type: "bottom" });
    }
  }
  bush(b, 2, 0, 12, "cherry_leaves", 1);
  bush(b, 14, 0, 12, "cherry_leaves", 1);
  return b;
}

export function teaHouse(p: { wood: Wood; roofMat: string }): Builder {
  const w = woodSet(p.wood);
  const b = new Builder(19, 12, 17);
  const roof = roofSet(p.roofMat);
  const x0 = 4,
    x1 = 13,
    z0 = 4,
    z1 = 11;
  // raised wooden deck on stone footings
  for (let x = x0 - 1; x <= x1 + 1; x += 3) for (let z = z0 - 1; z <= z1 + 1; z += 3) b.set(x, 0, z, "stone_bricks", "foundation");
  b.fill(x0 - 1, 1, z0 - 1, x1 + 1, 1, z1 + 1, w.planks, "foundation");
  b.walls(x0, z0, x1, z1, 2, 4, "white_terracotta", "walls", "stripped_spruce_log");
  for (let x = x0 + 3; x < x1; x += 3) for (let y = 2; y <= 4; y++) {
    b.set(x, y, z0, "stripped_spruce_log", "frame", { axis: "y" });
    b.set(x, y, z1, "stripped_spruce_log", "frame", { axis: "y" });
  }
  // sliding panel openings
  for (let x = x0 + 1; x <= x1 - 1; x++) if ((x - x0) % 3 !== 0) b.set(x, 3, z1, "glass_pane", "openings");
  for (let x = x0 + 1; x <= x1 - 1; x++) if ((x - x0) % 3 !== 0) b.set(x, 3, z0, "glass_pane", "openings");
  door(b, Math.floor((x0 + x1) / 2), 2, z1, "south", "spruce_door");
  b.fill(x0, 5, z0, x1, 5, z1, w.planks, "walls");
  hipRoof(b, x0, z0, x1, z1, 5, roof, 2);
  // low tables & cushions
  for (const x of [x0 + 2, x1 - 2]) {
    b.set(x, 2, z0 + 3, w.slab, "interior", { type: "bottom" });
    b.set(x - 1, 2, z0 + 3, "red_carpet", "interior");
    b.set(x + 1, 2, z0 + 3, "red_carpet", "interior");
  }
  b.set(x0 + 4, 2, z0 + 2, "flower_pot", "interior");
  lantern(b, x0 + 4, 4, z0 + 4, true);
  // pond in front
  for (let x = 3; x <= 7; x++) for (let z = 13; z <= 15; z++) b.set(x, 0, z, "water", "decor", { level: "0" });
  b.set(5, 1, 14, "lily_pad", "decor");
  bush(b, 15, 0, 14, "cherry_leaves", 1);
  bush(b, 1, 0, 2, "azalea_leaves", 1);
  return b;
}

export function castle(p: { size: number; stone: keyof typeof STONE; wood: Wood; roofMat: string; banner: string }): Builder {
  const S = p.size;
  const b = new Builder(S + 8, 26, S + 8);
  const st = STONE[p.stone]!;
  const w = woodSet(p.wood);
  const x0 = 4,
    z0 = 4,
    x1 = 4 + S - 1,
    z1 = 4 + S - 1;
  const wallH = 6;
  b.floor(x0, z0, x1, z1, 0, "cobblestone");
  // curtain wall with walkway and crenellations
  b.walls(x0, z0, x1, z1, 1, wallH, st.block, "walls");
  b.walls(x0 + 1, z0 + 1, x1 - 1, z1 - 1, wallH, wallH, st.slab, "walls");
  for (let x = x0; x <= x1; x++)
    for (const z of [z0, z1]) if ((x - x0) % 2 === 0) b.set(x, wallH + 1, z, st.block, "walls");
  for (let z = z0; z <= z1; z++)
    for (const x of [x0, x1]) if ((z - z0) % 2 === 0) b.set(x, wallH + 1, z, st.block, "walls");
  // corner towers
  for (const [cx, cz] of [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ] as const) {
    for (let y = 0; y <= wallH + 3; y++) b.circle(cx, cz, 2, y === 0, (x, z) => b.set(x, y, z, y === 0 ? "cobblestone" : st.block, y === 0 ? "foundation" : "walls"));
    b.circle(cx, cz, 1.2, true, (x, z) => b.set(x, wallH + 3, z, w.planks, "walls"));
    const top = wallH + 4;
    b.circle(cx, cz, 2, false, (x, z) => {
      if ((x + z) % 2 === 0) b.set(x, top, z, st.block, "walls");
    });
    b.set(cx, top, cz, w.fence, "decor");
    b.set(cx, top + 1, cz, w.fence, "decor");
    b.set(cx, top + 2, cz, `${p.banner}_wool`, "decor");
    b.set(cx + 1, top + 2, cz, `${p.banner}_wool`, "decor");
    for (let y = 3; y < wallH; y += 3) b.set(cx, y, cz + (cz === z1 ? 2 : -2), "iron_bars", "openings");
  }
  // gatehouse in the south wall
  const gx = Math.floor((x0 + x1) / 2);
  for (let y = 1; y <= 3; y++) for (let x = gx - 1; x <= gx + 1; x++) b.clear(x, y, z1);
  for (let x = gx - 1; x <= gx + 1; x++) b.set(x, 4, z1, st.stairs, "walls", { facing: "south", half: "top" });
  for (let x = gx - 1; x <= gx + 1; x++) b.set(x, 3, z1, "iron_bars", "openings");
  wallTorch(b, gx - 2, 3, z1 + 1, "south");
  wallTorch(b, gx + 2, 3, z1 + 1, "south");
  // keep in the middle
  const k = Math.max(3, Math.floor(S / 4));
  const kx0 = gx - k,
    kx1 = gx + k,
    kz0 = Math.floor((z0 + z1) / 2) - k,
    kz1 = Math.floor((z0 + z1) / 2) + k;
  b.walls(kx0, kz0, kx1, kz1, 1, 10, st.block, "walls");
  b.fill(kx0, 5, kz0, kx1, 5, kz1, w.planks, "walls");
  b.fill(kx0, 10, kz0, kx1, 10, kz1, w.planks, "walls");
  door(b, gx, 1, kz1, "south", "dark_oak_door");
  for (let y = 2; y <= 8; y += 4) {
    windowRow(b, "x", kz1, gx - 2, gx - 2, y + 1, y + 2);
    windowRow(b, "x", kz1, gx + 2, gx + 2, y + 1, y + 2);
    windowRow(b, "z", kx0, kz0 + 2, kz0 + 2, y + 1, y + 2);
    windowRow(b, "z", kx1, kz0 + 2, kz0 + 2, y + 1, y + 2);
  }
  for (let y = 1; y <= 10; y++) {
    b.clear(kx0 + 1, y, kz0 + 1);
    b.set(kx0 + 1, y, kz0 + 1, "ladder", "interior", { facing: "east" });
  }
  hipRoof(b, kx0, kz0, kx1, kz1, 10, roofSet(p.roofMat), 1);
  // courtyard details
  b.set(x0 + 3, 1, z1 - 3, "hay_block", "decor", { axis: "y" });
  b.set(x0 + 3, 1, z1 - 4, "barrel", "decor", { facing: "up" });
  b.set(x1 - 3, 1, z1 - 3, "anvil", "interior", { facing: "north" });
  lantern(b, gx, 4, kz0 + 2, true);
  furniture(b, gx + 1, 1, kz0 + 1, "chest", "south");
  bed(b, kx1 - 1, 6, kz0 + 2, "north", "blue");
  return b;
}

export function chapel(p: { stone: keyof typeof STONE; wood: Wood; roofMat: string }): Builder {
  const st = STONE[p.stone]!;
  const w = woodSet(p.wood);
  const b = new Builder(15, 26, 22);
  const x0 = 3,
    x1 = 11,
    z0 = 6,
    z1 = 18;
  b.floor(x0, z0, x1, z1, 0, st.block);
  b.walls(x0, z0, x1, z1, 1, 6, st.block, "walls");
  for (let z = z0 + 2; z <= z1 - 2; z += 3) {
    windowRow(b, "z", x0, z, z, 2, 5, "light_blue_stained_glass_pane");
    windowRow(b, "z", x1, z, z, 2, 5, "yellow_stained_glass_pane");
  }
  // buttresses
  for (let z = z0; z <= z1; z += 3) {
    b.set(x0 - 1, 1, z, st.block, "walls");
    b.set(x0 - 1, 2, z, st.stairs, "walls", { facing: "east", half: "bottom" });
    b.set(x1 + 1, 1, z, st.block, "walls");
    b.set(x1 + 1, 2, z, st.stairs, "walls", { facing: "west", half: "bottom" });
  }
  b.fill(x0, 7, z0, x1, 7, z1, w.planks, "walls");
  gableRoof(b, x0, z0, x1, z1, 7, roofSet(p.roofMat), { axis: "z", gable: st.block, eaveTrim: true });
  // bell tower over the entrance (south end)
  const tx0 = 5,
    tx1 = 9,
    tz0 = z1 - 1,
    tz1 = z1 + 3;
  b.floor(tx0, tz0, tx1, tz1, 0, st.block);
  b.walls(tx0, tz0, tx1, tz1, 1, 13, st.block, "walls");
  door(b, 7, 1, tz1, "south", w.door);
  for (let y = 1; y <= 3; y++) b.clear(7, y, tz0);
  windowRow(b, "x", tz1, 7, 7, 5, 7, "glass_pane");
  // belfry
  for (let y = 14; y <= 16; y++)
    for (const [x, z] of [
      [tx0, tz0],
      [tx1, tz0],
      [tx0, tz1],
      [tx1, tz1],
    ] as const)
      b.set(x, y, z, st.block, "walls");
  b.fill(tx0, 17, tz0, tx1, 17, tz1, st.block, "walls");
  b.set(7, 16, z1 + 1, "bell", "decor", { attachment: "ceiling", facing: "south", powered: "false" });
  hipRoof(b, tx0, tz0, tx1, tz1, 18, roofSet(p.roofMat), 0);
  b.set(7, 21, z1 + 1, "gold_block", "roof");
  // pews and altar
  for (let z = z0 + 3; z <= z1 - 3; z += 2) {
    for (const x of [x0 + 1, x0 + 2, x1 - 2, x1 - 1]) chair(b, x, 1, z, w, "north");
  }
  b.fill(6, 1, z0 + 1, 8, 1, z0 + 1, "chiseled_stone_bricks", "interior");
  b.set(7, 2, z0 + 1, "candle", "lighting", { candles: "3", lit: "true", waterlogged: "false" });
  b.set(5, 1, z0 + 1, "lectern", "interior", { facing: "south", has_book: "false", powered: "false" });
  lantern(b, 7, 6, Math.floor((z0 + z1) / 2), true);
  lantern(b, 7, 6, z0 + 3, true);
  return b;
}

export function gazebo(p: { wood: Wood; roofMat: string; radius: number }): Builder {
  const R = p.radius;
  const size = 2 * R + 7;
  const b = new Builder(size, R + 10, size);
  const c = Math.floor(size / 2);
  const w = woodSet(p.wood);
  b.circle(c, c, R + 1, true, (x, z) => b.set(x, 0, z, "stone_bricks", "foundation"));
  b.circle(c, c, R, true, (x, z) => b.set(x, 1, z, w.planks, "foundation"));
  const posts: Array<[number, number]> = [];
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    posts.push([Math.round(c + Math.cos(ang) * R), Math.round(c + Math.sin(ang) * R)]);
  }
  for (const [x, z] of posts) for (let y = 2; y <= 4; y++) b.set(x, y, z, w.log, "frame", { axis: "y" });
  b.circle(c, c, R, false, (x, z) => {
    if (z === c + R && Math.abs(x - c) <= 1) return;
    b.put(x, 2, z, w.fence, "decor");
  });
  b.circle(c, c, R + 1, true, (x, z) => b.set(x, 5, z, w.planks, "walls"));
  b.circle(c, c, R + 1.5, false, (x, z) => b.set(x, 5, z, roofSet(p.roofMat).slab, "roof", { type: "top" }));
  hipRoof(b, c - R, c - R, c + R, c + R, 6, roofSet(p.roofMat), 0, "lantern");
  table(b, c, 2, c, w);
  chair(b, c - 1, 2, c, w, "east");
  chair(b, c + 1, 2, c, w, "west");
  lantern(b, c, 4, c - 1, true);
  for (let i = -1; i <= 1; i++) b.set(c + i, 1, c + R + 1, "stone_brick_stairs", "foundation", { facing: "north", half: "bottom" });
  return b;
}

export function fountain(p: { stone: keyof typeof STONE; radius: number }): Builder {
  const st = STONE[p.stone]!;
  const R = p.radius;
  const size = 2 * R + 5;
  const b = new Builder(size, 9, size);
  const c = Math.floor(size / 2);
  b.circle(c, c, R + 1, true, (x, z) => b.set(x, 0, z, "smooth_stone", "foundation"));
  b.circle(c, c, R, false, (x, z) => b.set(x, 1, z, st.block, "walls"));
  b.circle(c, c, R - 1, true, (x, z) => b.set(x, 1, z, "water", "decor", { level: "0" }));
  for (let y = 1; y <= 3; y++) b.set(c, y, c, st.block, "walls");
  b.circle(c, c, 1, true, (x, z) => b.set(x, 4, z, st.slab, "walls", { type: "bottom" }));
  b.set(c, 4, c, st.block, "walls");
  b.set(c, 5, c, "water", "decor", { level: "0" });
  b.circle(c, c, R + 1, false, (x, z) => {
    if ((x + z) % 4 === 0) b.set(x, 1, z, "lantern", "lighting", { hanging: "false", waterlogged: "false" });
  });
  return b;
}

export function treehouse(p: { wood: Wood; roofMat: string }): Builder {
  const w = woodSet(p.wood);
  const b = new Builder(17, 24, 17);
  const c = 8;
  // trunk 2×2
  for (let y = 0; y <= 14; y++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) b.set(c + dx, y, c + dz, w.wood, "frame", { axis: "y" });
  // platform
  const py = 8;
  b.fill(c - 4, py, c - 4, c + 5, py, c + 5, w.planks, "walls");
  for (let x = c - 4; x <= c + 5; x++) {
    b.set(x, py - 1, c - 4, w.stairs, "walls", { facing: "south", half: "top" });
    b.set(x, py - 1, c + 5, w.stairs, "walls", { facing: "north", half: "top" });
  }
  // cabin
  const x0 = c - 3,
    x1 = c + 4,
    z0 = c - 3,
    z1 = c + 2;
  b.walls(x0, z0, x1, z1, py + 1, py + 3, w.planks, "walls", w.log);
  door(b, c, py + 1, z1, "south", w.door);
  windowRow(b, "z", x0, z0 + 2, z0 + 3, py + 2, py + 2);
  windowRow(b, "z", x1, z0 + 2, z0 + 3, py + 2, py + 2);
  b.fill(x0, py + 4, z0, x1, py + 4, z1, w.planks, "walls");
  gableRoof(b, x0, z0, x1, z1, py + 4, roofSet(p.roofMat), { axis: "x", gable: w.planks });
  // balcony fence
  for (let x = c - 4; x <= c + 5; x++) b.put(x, py + 1, c + 5, w.fence, "decor");
  for (let z = z1 + 1; z <= c + 5; z++) {
    b.put(c - 4, py + 1, z, w.fence, "decor");
    b.put(c + 5, py + 1, z, w.fence, "decor");
  }
  // ladder up the trunk (south face of the trunk)
  for (let y = 1; y < py; y++) b.set(c, y, c + 2, "ladder", "interior", { facing: "south" });
  b.clear(c, py, c + 2);
  b.set(c, py, c + 2, "ladder", "interior", { facing: "south" });
  // canopy
  for (let dy = 0; dy <= 4; dy++) {
    const r = dy < 3 ? 5 : 3;
    for (let dx = -r; dx <= r + 1; dx++)
      for (let dz = -r; dz <= r + 1; dz++) {
        if (Math.hypot(dx - 0.5, dz - 0.5) > r + 0.3) continue;
        b.put(c + dx, 15 + dy, c + dz, w.leaves, "decor", { persistent: "true", distance: "1", waterlogged: "false" });
      }
  }
  b.set(x0 + 1, py + 1, z0 + 1, "chest", "interior", { facing: "south" });
  b.set(x1 - 1, py + 1, z0 + 1, "crafting_table", "interior");
  lantern(b, c + 2, py + 3, c, true);
  lantern(b, c - 4, py + 2, c + 5, false);
  void tree;
  return b;
}

export function modernVilla(p: { wall: string; accent: string; glass: string }): Builder {
  const b = new Builder(24, 14, 20);
  const x0 = 3,
    x1 = 18,
    z0 = 3,
    z1 = 13;
  b.floor(x0, z0, x1, z1, 0, "smooth_stone");
  // ground floor: walls with large windows
  b.walls(x0, z0, x1, z1, 1, 3, p.wall, "walls");
  for (let x = x0 + 1; x <= x1 - 1; x++) for (let y = 1; y <= 3; y++) if (x < x1 - 5 || y > 1) b.set(x, y, z1, p.glass, "openings");
  door(b, x1 - 3, 1, z1, "south", "iron_door");
  b.fill(x0, 4, z0, x1, 4, z1, p.accent, "walls");
  // cantilevered upper floor shifted east
  const ux0 = x0 + 4,
    ux1 = x1 + 2,
    uz0 = z0 - 1,
    uz1 = z1 - 2;
  b.fill(ux0, 4, uz0, ux1, 4, uz1, p.accent, "walls");
  b.walls(ux0, uz0, ux1, uz1, 5, 7, p.wall, "walls");
  for (let z = uz0 + 1; z <= uz1 - 1; z++) for (let y = 5; y <= 7; y++) b.set(ux1, y, z, p.glass, "openings");
  for (let x = ux0 + 1; x <= ux1 - 1; x++) for (let y = 6; y <= 7; y++) b.set(x, y, uz1, p.glass, "openings");
  b.fill(ux0 - 1, 8, uz0 - 1, ux1 + 1, 8, uz1 + 1, p.accent, "roof");
  // roof terrace railing over the ground floor
  for (let x = x0; x < ux0; x++) b.set(x, 5, z1, p.glass, "decor");
  for (let z = z0; z <= z1; z++) b.set(x0, 5, z, p.glass, "decor");
  // pool
  for (let x = x0; x <= x0 + 6; x++) for (let z = z1 + 2; z <= z1 + 4; z++) b.set(x, 0, z, "water", "decor", { level: "0" });
  b.ring(x0 - 1, z1 + 1, x0 + 7, z1 + 5, 0, "smooth_quartz", "foundation");
  // interior
  b.set(x0 + 2, 1, z0 + 1, "white_bed", "interior", { facing: "north", part: "head", occupied: "false" });
  b.set(x0 + 2, 1, z0 + 2, "white_bed", "interior", { facing: "north", part: "foot", occupied: "false" });
  b.set(x1 - 1, 1, z0 + 1, "smoker", "interior", { facing: "south" });
  b.set(x1 - 2, 1, z0 + 1, "crafting_table", "interior");
  b.set(x1 - 3, 1, z0 + 1, "barrel", "interior", { facing: "up" });
  for (let x = x0 + 5; x <= x0 + 8; x++) b.set(x, 1, z0 + 5, "gray_carpet", "interior");
  b.set(Math.floor((x0 + x1) / 2), 3, Math.floor((z0 + z1) / 2), "sea_lantern", "lighting");
  b.set(ux0 + 4, 7, uz0 + 3, "sea_lantern", "lighting");
  for (let y = 1; y <= 3; y++) b.set(ux0, y, uz0 + 2, p.wall, "walls");
  for (let y = 1; y <= 4; y++) b.set(ux0 + 1, y, uz0 + 2, "ladder", "interior", { facing: "east" });
  b.clear(ux0 + 1, 4, uz0 + 2);
  b.set(ux0 + 1, 4, uz0 + 2, "ladder", "interior", { facing: "east" });
  b.set(ux0, 4, uz0 + 2, p.accent, "walls");
  void table;
  return b;
}
