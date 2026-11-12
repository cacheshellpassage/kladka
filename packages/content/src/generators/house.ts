/**
 * Generic parametric house: covers huts, cottages, multi-storey and timber-framed houses,
 * desert and beach houses. All proportions are derived from parameters.
 */
import { Builder, roofSet, woodSet, type Wood } from "../lib/builder";
import {
  bed,
  bush,
  carpet,
  chair,
  chimney,
  door,
  flatRoof,
  flowerBox,
  furniture,
  gableRoof,
  hipRoof,
  ladder,
  lantern,
  shutters,
  table,
  wallTorch,
  windowRow,
} from "../lib/parts";

export interface HouseParams {
  width: number;
  depth: number;
  floors: number;
  floorHeight?: number;
  wood: Wood;
  /** Wall infill (defaults to planks of `wood`). */
  wall?: string;
  /** Foundation / floor of ground level. */
  base?: string;
  /** Corner/beam logs (defaults to the wood's log). */
  frame?: string | null;
  /** Timber-frame posts every N blocks. */
  posts?: number;
  roof: "gable-x" | "gable-z" | "hip" | "flat";
  roofMat: string;
  gableFill?: string;
  glass?: string;
  chimney?: string | null;
  shutters?: boolean;
  flowerBoxes?: boolean;
  porch?: boolean;
  stilts?: number;
  jetty?: boolean;
  carpetColor?: string;
  bedColor?: string;
  garden?: boolean;
  lanterns?: boolean;
}

export function house(p: HouseParams): Builder {
  const fh = p.floorHeight ?? 4;
  const M = 4; // margin for roof overhang & decoration
  const stilt = p.stilts ?? 0;
  const W = p.width,
    D = p.depth;
  const height = stilt + 1 + p.floors * fh + Math.ceil(Math.max(W, D) / 2) + 6;
  const b = new Builder(W + 2 * M, height, D + 2 * M + (p.porch ? 3 : 0));
  const w = woodSet(p.wood);
  const x0 = M,
    x1 = M + W - 1,
    z0 = M,
    z1 = M + D - 1;
  const wall = p.wall ?? w.planks;
  const base = p.base ?? "cobblestone";
  const frame = p.frame === undefined ? w.log : p.frame;
  const glass = p.glass ?? "glass_pane";
  const roof = roofSet(p.roofMat);

  // stilts / foundation
  let yb = 0;
  if (stilt > 0) {
    for (let y = 0; y < stilt; y++)
      for (const [x, z] of [
        [x0, z0],
        [x1, z0],
        [x0, z1],
        [x1, z1],
        [Math.floor((x0 + x1) / 2), z0],
        [Math.floor((x0 + x1) / 2), z1],
      ] as const)
        b.set(x, y, z, w.log, "foundation", { axis: "y" });
    yb = stilt;
    b.floor(x0, z0, x1, z1, yb, w.planks, "foundation");
  } else {
    b.floor(x0, z0, x1, z1, 0, base, "foundation");
  }

  const topY = yb + p.floors * fh; // ceiling layer of the top floor
  for (let f = 0; f < p.floors; f++) {
    const fy = yb + f * fh; // floor layer of this storey
    const jet = p.jetty && f > 0 ? 1 : 0;
    const za = z0 - jet,
      zb = z1 + jet;
    if (jet) {
      // extend the floor and add brackets under the overhang
      b.fill(x0, fy, za, x1, fy, za, w.planks, "walls");
      b.fill(x0, fy, zb, x1, fy, zb, w.planks, "walls");
      for (let x = x0; x <= x1; x += 2) {
        b.set(x, fy - 1, za, w.stairs, "walls", { facing: "south", half: "top" });
        b.set(x, fy - 1, zb, w.stairs, "walls", { facing: "north", half: "top" });
      }
    }
    b.walls(x0, za, x1, zb, fy + 1, fy + fh - 1, wall, "walls");
    if (frame) {
      for (let y = fy + 1; y <= fy + fh - 1; y++)
        for (const [x, z] of [
          [x0, za],
          [x1, za],
          [x0, zb],
          [x1, zb],
        ] as const)
          b.set(x, y, z, frame, "frame", { axis: "y" });
      if (p.posts) {
        for (let x = x0 + p.posts; x < x1; x += p.posts)
          for (let y = fy + 1; y <= fy + fh - 1; y++) {
            b.set(x, y, za, frame, "frame", { axis: "y" });
            b.set(x, y, zb, frame, "frame", { axis: "y" });
          }
        for (let z = za + p.posts; z < zb; z += p.posts)
          for (let y = fy + 1; y <= fy + fh - 1; y++) {
            b.set(x0, y, z, frame, "frame", { axis: "y" });
            b.set(x1, y, z, frame, "frame", { axis: "y" });
          }
      }
    }
    // ceiling / next floor with log beams along the edges
    const cy = fy + fh;
    b.fill(x0, cy, za, x1, cy, zb, w.planks, "walls");
    if (frame) {
      for (let x = x0; x <= x1; x++) {
        b.set(x, cy, za, frame, "frame", { axis: "x" });
        b.set(x, cy, zb, frame, "frame", { axis: "x" });
      }
      for (let z = za; z <= zb; z++) {
        b.set(x0, cy, z, frame, "frame", { axis: "z" });
        b.set(x1, cy, z, frame, "frame", { axis: "z" });
      }
    }

    // windows: on every wall, spaced
    const wy0 = fy + 2,
      wy1 = Math.min(fy + fh - 2, fy + 3);
    const step = W >= 9 ? 3 : 2;
    for (let x = x0 + 2; x <= x1 - 2; x += step + 1) {
      const xe = Math.min(x + step - 2, x1 - 2);
      const mid = Math.floor((x0 + x1) / 2);
      const isDoorCol = f === 0 && mid >= x - 1 && mid <= xe + 1;
      if (!isDoorCol) {
        windowRow(b, "x", zb, x, xe, wy0, wy1, glass);
        if (p.shutters) shutters(b, "x", zb, x, xe, wy0, wy1, "south", w.trapdoor);
        if (p.flowerBoxes && f === 0)
          flowerBox(b, x, fy, zb, "x", xe - x + 1, "south", w.trapdoor, [
            "poppy",
            "dandelion",
            "azure_bluet",
          ]);
      }
      windowRow(b, "x", za, x, xe, wy0, wy1, glass);
      if (p.shutters) shutters(b, "x", za, x, xe, wy0, wy1, "north", w.trapdoor);
    }
    for (let z = za + 2; z <= zb - 2; z += step + 1) {
      const ze = Math.min(z + step - 2, zb - 2);
      windowRow(b, "z", x0, z, ze, wy0, wy1, glass);
      windowRow(b, "z", x1, z, ze, wy0, wy1, glass);
      if (p.shutters) {
        shutters(b, "z", x0, z, ze, wy0, wy1, "west", w.trapdoor);
        shutters(b, "z", x1, z, ze, wy0, wy1, "east", w.trapdoor);
      }
    }

    // ladder to the next floor (inside, along the west wall)
    if (f < p.floors - 1) {
      const lz = z0 + 1;
      for (let y = fy + 1; y <= fy + fh; y++) ladder(b, x0 + 1, y, lz, "east", wall);
    }
  }

  // door on the south side (ground floor)
  const dx = Math.floor((x0 + x1) / 2);
  door(b, dx, yb + 1, z1, "south", w.door);
  // steps in front of raised houses
  if (stilt > 0) {
    for (let i = 1; i <= stilt; i++)
      b.set(dx, stilt - i, z1 + i, w.stairs, "foundation", { facing: "north", half: "bottom" });
  } else {
    b.set(dx, 0, z1 + 1, w.slab, "decor", { type: "bottom" });
  }
  wallTorch(b, dx - 1, yb + 2, z1 + 1, "south");
  wallTorch(b, dx + 1, yb + 2, z1 + 1, "south");

  // porch with fence and roof
  if (p.porch) {
    const pz1 = z1 + 3;
    b.fill(x0, yb, z1 + 1, x1, yb, pz1, w.planks, "foundation");
    for (let x = x0; x <= x1; x++) if (x !== dx) b.set(x, yb + 1, pz1, w.fence, "decor");
    for (let z = z1 + 1; z <= pz1; z++) {
      b.set(x0, yb + 1, z, w.fence, "decor");
      b.set(x1, yb + 1, z, w.fence, "decor");
    }
    for (const x of [x0, x1])
      for (let y = yb + 1; y <= yb + 3; y++) b.set(x, y, pz1, w.log, "frame", { axis: "y" });
    for (let x = x0; x <= x1; x++)
      for (let z = z1 + 1; z <= pz1; z++) b.set(x, yb + 4, z, w.slab, "roof", { type: "bottom" });
    b.clear(dx - 1, yb + 2, z1 + 1);
    b.clear(dx + 1, yb + 2, z1 + 1);
    lantern(b, dx, yb + 3, z1 + 2, true);
    chair(b, x1 - 1, yb + 1, z1 + 1, w, "north");
    if (stilt === 0) b.set(dx, 0, pz1 + 1, w.slab, "decor", { type: "bottom" });
  }

  // roof
  const gableFill = p.gableFill ?? wall;
  let roofTop = topY;
  if (p.roof === "gable-x")
    roofTop = gableRoof(b, x0, z0, x1, z1, topY, roof, { axis: "x", gable: gableFill, eaveTrim: true });
  else if (p.roof === "gable-z")
    roofTop = gableRoof(b, x0, z0, x1, z1, topY, roof, { axis: "z", gable: gableFill, eaveTrim: true });
  else if (p.roof === "hip") roofTop = hipRoof(b, x0, z0, x1, z1, topY, roof, 1);
  else flatRoof(b, x0, z0, x1, z1, topY, roof.block, roof.slab);

  if (p.chimney) chimney(b, x1 - 1, z0 + 1, topY + 1, Math.max(roofTop, topY + 3), p.chimney);

  // interior (ground floor)
  const iy = yb + 1;
  bed(b, x1 - 1, iy, z0 + 2, "north", p.bedColor ?? "red");
  furniture(b, x0 + 1, iy, z1 - 1, "crafting_table");
  furniture(b, x0 + 2, iy, z0 + 1, "furnace", "south");
  furniture(b, x0 + 3, iy, z0 + 1, "chest", "south");
  if (W >= 7 && D >= 7) {
    const tx = Math.floor((x0 + x1) / 2),
      tz = Math.floor((z0 + z1) / 2);
    table(b, tx, iy, tz, w);
    chair(b, tx - 1, iy, tz, w, "east");
    chair(b, tx + 1, iy, tz, w, "west");
    furniture(b, x1 - 1, iy, z1 - 1, "barrel", "north");
    if (D >= 8) furniture(b, x0 + 1, iy, z0 + 3, "bookshelf");
  }
  if (p.carpetColor) carpet(b, x0 + 2, z0 + 3, x1 - 2, z1 - 2, iy, p.carpetColor);
  if (p.lanterns !== false)
    lantern(b, Math.floor((x0 + x1) / 2), yb + fh - 1, Math.floor((z0 + z1) / 2) - 1, true);
  for (let f = 1; f < p.floors; f++) {
    const fy = yb + f * fh + 1;
    bed(b, x1 - 1, fy, z1 - 2, "south", p.bedColor ?? "blue");
    furniture(b, x1 - 1, fy, z0 + 1, "bookshelf");
    furniture(b, x1 - 2, fy, z0 + 1, "chest", "south");
    lantern(b, Math.floor((x0 + x1) / 2), fy + fh - 2, Math.floor((z0 + z1) / 2), true);
  }

  // garden
  if (p.garden && stilt === 0) {
    bush(b, x0 - 2, 0, z1 + 1, w.leaves === "cherry_leaves" ? "cherry_leaves" : "oak_leaves", 1);
    bush(b, x1 + 2, 0, z0, "azalea_leaves", 1);
    b.put(x1 + 2, 0, z1 + 2, "rose_bush", "decor", { half: "lower" });
    b.put(x1 + 2, 1, z1 + 2, "rose_bush", "decor", { half: "upper" });
    b.put(x0 - 1, 0, z0 + 1, "oxeye_daisy", "decor");
    b.put(x0 - 1, 0, z0 + 3, "cornflower", "decor");
  }

  return b;
}
