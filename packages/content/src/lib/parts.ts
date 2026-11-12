/** Reusable building parts: roofs, openings, furniture, lighting, decoration. */
import { blockInfo } from "@kladka/voxel-core";
import { DIRV, OPP, bs, type B, type Builder, type Facing, type MatSet, type WoodSet } from "./builder";

/* ---------------------------------------------------------------- */
/* Roofs                                                              */
/* ---------------------------------------------------------------- */

export interface GableOpts {
  /** Ridge direction: "x" means slopes face north/south. */
  axis: "x" | "z";
  overhang?: number;
  /** Material for the triangular gable ends (null = leave open). */
  gable?: B | null;
  /** Put a row of slabs on the ridge for even widths. */
  ridgeCap?: boolean;
  /** Extend the roof along the ridge by this many blocks beyond the walls. */
  extend?: number;
  /** Add upside-down stairs under the eave edge. */
  eaveTrim?: boolean;
  /** Fill the wall rectangle at the roof's first layer (needed when there is no ceiling). */
  deck?: B;
  /**
   * Solid blocks under every stair row above the first one. Defaults to the roof's full block when
   * the gable ends are open (otherwise the rows have nothing to be placed against).
   */
  underFill?: B | null;
}

/**
 * Gable roof over the wall rectangle (x0..x1, z0..z1) starting at layer y.
 * Returns the layer above the ridge.
 */
export function gableRoof(
  b: Builder,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  mat: MatSet,
  o: GableOpts,
): number {
  const ov = o.overhang ?? 1;
  const ext = o.extend ?? ov;
  // work in a rotated frame: "a" runs along the ridge, "c" across the slopes
  const alongX = o.axis === "x";
  const a0 = (alongX ? x0 : z0) - ext,
    a1 = (alongX ? x1 : z1) + ext;
  const c0 = (alongX ? z0 : x0) - ov,
    c1 = (alongX ? z1 : x1) + ov;
  const P = (a: number, c: number): [number, number] => (alongX ? [a, c] : [c, a]);
  const lowFacing: Facing = alongX ? "south" : "east";
  const highFacing: Facing = alongX ? "north" : "west";
  if (o.deck) b.fill(x0, y, z0, x1, y, z1, o.deck, "roof");
  const under = o.underFill === undefined ? (o.gable === null || ov > 1 ? mat.block : null) : o.underFill;
  let i = 0;
  for (; ; i++) {
    const cl = c0 + i,
      ch = c1 - i,
      yy = y + i;
    if (cl > ch) break;
    if (under && i > 0) {
      for (let a = a0; a <= a1; a++) {
        const [xl, zl] = P(a, cl);
        const [xh, zh] = P(a, ch);
        b.put(xl, yy - 1, zl, under, "roof");
        b.put(xh, yy - 1, zh, under, "roof");
      }
    }
    for (let a = a0; a <= a1; a++) {
      if (cl === ch) {
        const [x, z] = P(a, cl);
        b.set(x, yy, z, mat.slab, "roof", { type: "bottom" });
      } else {
        const [xl, zl] = P(a, cl);
        const [xh, zh] = P(a, ch);
        b.set(xl, yy, zl, mat.stairs, "roof", { facing: lowFacing, half: "bottom" });
        b.set(xh, yy, zh, mat.stairs, "roof", { facing: highFacing, half: "bottom" });
        if (o.eaveTrim && i === 0) {
          b.put(xl, yy - 1, zl, mat.stairs, "roof", { facing: highFacing, half: "top" });
          b.put(xh, yy - 1, zh, mat.stairs, "roof", { facing: lowFacing, half: "top" });
        }
      }
    }
    // gable ends
    if (o.gable !== null) {
      const gableB = o.gable ?? mat.block;
      for (let c = cl + 1; c <= ch - 1; c++) {
        const wc0 = alongX ? z0 : x0,
          wc1 = alongX ? z1 : x1;
        if (c < wc0 || c > wc1) continue;
        for (const a of [alongX ? x0 : z0, alongX ? x1 : z1]) {
          const [x, z] = P(a, c);
          b.set(x, yy, z, gableB, "roof");
        }
      }
    }
    if (o.ridgeCap && ch - cl === 1) {
      for (let a = a0; a <= a1; a++) {
        const [x, z] = P(a, cl);
        const [x2, z2] = P(a, ch);
        b.set(x, yy + 1, z, mat.slab, "roof", { type: "bottom" });
        b.set(x2, yy + 1, z2, mat.slab, "roof", { type: "bottom" });
      }
    }
  }
  return y + i;
}

/**
 * Hip (pyramid) roof: stairs on all four sides, shrinking each layer. Each new ring is laid on a ring
 * of full blocks (otherwise the stairs would only touch the ring below diagonally and could not be
 * placed by hand). Returns the top layer + 1.
 */
export function hipRoof(
  b: Builder,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  mat: MatSet,
  overhang = 1,
  cap?: B,
  deck?: B,
): number {
  let ax = x0 - overhang,
    bx = x1 + overhang,
    az = z0 - overhang,
    bz = z1 + overhang;
  let yy = y;
  if (deck) b.fill(x0, y, z0, x1, y, z1, deck, "roof");
  while (ax <= bx && az <= bz) {
    if (yy > y) {
      // supporting ring under this layer's stairs
      b.ring(ax, az, bx, bz, yy - 1, mat.block, "roof");
    }
    if (ax === bx || az === bz) {
      for (let x = ax; x <= bx; x++)
        for (let z = az; z <= bz; z++)
          b.set(x, yy, z, cap ?? mat.slab, "roof", cap ? undefined : { type: "bottom" });
      yy++;
      break;
    }
    for (let x = ax; x <= bx; x++) {
      b.set(x, yy, az, mat.stairs, "roof", { facing: "south", half: "bottom" });
      b.set(x, yy, bz, mat.stairs, "roof", { facing: "north", half: "bottom" });
    }
    for (let z = az + 1; z <= bz - 1; z++) {
      b.set(ax, yy, z, mat.stairs, "roof", { facing: "east", half: "bottom" });
      b.set(bx, yy, z, mat.stairs, "roof", { facing: "west", half: "bottom" });
    }
    ax++;
    bx--;
    az++;
    bz--;
    yy++;
  }
  return yy;
}

/** Flat roof: slab/blocks covering the rectangle with a parapet ring. */
export function flatRoof(
  b: Builder,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  deck: B,
  parapet?: B,
): void {
  b.fill(x0, y, z0, x1, y, z1, deck, "roof");
  if (parapet) b.ring(x0, z0, x1, z1, y + 1, parapet, "roof");
}

/** Cone roof over a circle (towers). */
export function coneRoof(
  b: Builder,
  cx: number,
  cz: number,
  r: number,
  y: number,
  mat: MatSet,
  tip?: B,
): number {
  let yy = y;
  for (let rr = r; rr >= 0.5; rr -= 0.75) {
    if (yy > y) b.circle(cx, cz, rr, true, (x, z) => b.put(x, yy - 1, z, mat.block, "roof"));
    b.circle(cx, cz, rr, false, (x, z) => {
      const dx = x - cx,
        dz = z - cz;
      let facing: Facing;
      if (Math.abs(dx) > Math.abs(dz)) facing = dx > 0 ? "west" : "east";
      else facing = dz > 0 ? "north" : "south";
      b.set(x, yy, z, mat.stairs, "roof", { facing, half: "bottom" });
    });
    // fill the inner disc of the layer below the next ring so the cone has no holes
    yy++;
  }
  b.put(cx, yy - 1, cz, mat.block, "roof");
  b.set(cx, yy, cz, mat.block, "roof");
  if (tip) b.set(cx, yy + 1, cz, tip, "roof");
  return yy + 2;
}

/* ---------------------------------------------------------------- */
/* Openings                                                           */
/* ---------------------------------------------------------------- */

/** Door in a wall cell (x, y = lower half, z), facing outward direction `out`. */
export function door(
  b: Builder,
  x: number,
  y: number,
  z: number,
  out: Facing,
  doorBlock: string,
  hinge: "left" | "right" = "left",
): void {
  const facing = OPP[out]; // player faces into the house when placing
  b.set(x, y, z, doorBlock, "openings", { facing, half: "lower", hinge, open: "false", powered: "false" });
  b.set(x, y + 1, z, doorBlock, "openings", {
    facing,
    half: "upper",
    hinge,
    open: "false",
    powered: "false",
  });
}

/** Window of panes (or glass blocks) in a wall plane. `axis` = the axis the wall runs along. */
export function windowRow(
  b: Builder,
  axis: "x" | "z",
  fixed: number,
  from: number,
  to: number,
  y0: number,
  y1: number,
  glass: B = "glass_pane",
): void {
  for (let y = y0; y <= y1; y++)
    for (let t = from; t <= to; t++) {
      const [x, z] = axis === "x" ? [t, fixed] : [fixed, t];
      b.set(x, y, z, glass, "openings");
    }
}

/** Shutters (open trapdoors) on both sides of a window, mounted on the outside wall face. */
export function shutters(
  b: Builder,
  axis: "x" | "z",
  fixed: number,
  from: number,
  to: number,
  y0: number,
  y1: number,
  out: Facing,
  trapdoor: string,
): void {
  const [ox, oz] = DIRV[out];
  for (let y = y0; y <= y1; y++) {
    const ends = [from - 1, to + 1];
    for (const t of ends) {
      const [x, z] = axis === "x" ? [t, fixed] : [fixed, t];
      b.put(x + ox, y, z + oz, trapdoor, "decor", {
        facing: out,
        half: y === y0 ? "bottom" : "top",
        open: "true",
      });
    }
  }
}

/* ---------------------------------------------------------------- */
/* Lighting & decoration                                              */
/* ---------------------------------------------------------------- */

/** Wall torch attached to the wall at (x, y, z) - dir; the torch block is at (x, y, z). */
/**
 * One block of a ladder. In the game a ladder hangs only on a solid block: a window pane, iron bars or a gap
 * behind it becomes `wall`, otherwise the ladder could not be placed.
 */
export function ladder(b: Builder, x: number, y: number, z: number, facing: Facing, wall: B): void {
  const [dx, dz] = DIRV[facing];
  const bx = x - dx,
    bz = z - dz;
  const behind = blockInfo(b.isAir(bx, y, bz) ? "air" : b.name(bx, y, bz));
  if (!(behind.full && behind.shape === "cube")) b.set(bx, y, bz, wall, "walls");
  b.clear(x, y, z);
  b.set(x, y, z, "ladder", "interior", { facing, waterlogged: "false" });
}

export function wallTorch(b: Builder, x: number, y: number, z: number, facing: Facing): void {
  b.set(x, y, z, "wall_torch", "lighting", { facing });
}

export function lantern(b: Builder, x: number, y: number, z: number, hanging: boolean, soul = false): void {
  b.set(x, y, z, soul ? "soul_lantern" : "lantern", "lighting", {
    hanging: String(hanging),
    waterlogged: "false",
  });
}

export function flowerBox(
  b: Builder,
  x: number,
  y: number,
  z: number,
  axis: "x" | "z",
  len: number,
  out: Facing,
  trapdoor: string,
  flowers: string[],
): void {
  const [ox, oz] = DIRV[out];
  for (let t = 0; t < len; t++) {
    const [x1, z1] = axis === "x" ? [x + t, z] : [x, z + t];
    b.set(x1 + ox, y, z1 + oz, "grass_block", "decor");
    b.put(x1 + ox * 2, y, z1 + oz * 2, trapdoor, "decor", { facing: out, half: "bottom", open: "true" });
    b.set(x1 + ox, y + 1, z1 + oz, flowers[t % flowers.length]!, "decor");
  }
}

export function bush(b: Builder, x: number, y: number, z: number, leaves: string, r = 1): void {
  for (let dy = 0; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) + Math.abs(dz) + dy > r + (dy === 0 ? 1 : 0)) continue;
        b.put(x + dx, y + dy, z + dz, leaves, "decor", {
          persistent: "true",
          distance: "1",
          waterlogged: "false",
        });
      }
}

export function tree(b: Builder, x: number, y: number, z: number, w: WoodSet, height = 5, crown = 2): void {
  for (let i = 0; i < height; i++) b.set(x, y + i, z, w.log, "decor", { axis: "y" });
  const top = y + height;
  for (let dy = -2; dy <= 1; dy++) {
    const r = dy >= 0 ? crown - 1 : crown;
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && (dy === 1 || (x + z + dy) % 2 === 0)) continue;
        b.put(x + dx, top + dy, z + dz, w.leaves, "decor", {
          persistent: "true",
          distance: "1",
          waterlogged: "false",
        });
      }
  }
}

/** Simple chimney column with a campfire-free top (just open). */
export function chimney(b: Builder, x: number, z: number, y0: number, y1: number, block: B): void {
  for (let y = y0; y <= y1; y++) b.set(x, y, z, block, "roof");
}

/* ---------------------------------------------------------------- */
/* Furniture                                                          */
/* ---------------------------------------------------------------- */

export function bed(b: Builder, x: number, y: number, z: number, headDir: Facing, color = "red"): void {
  const [dx, dz] = DIRV[headDir];
  b.set(x, y, z, `${color}_bed`, "interior", { facing: headDir, part: "foot", occupied: "false" });
  b.set(x + dx, y, z + dz, `${color}_bed`, "interior", { facing: headDir, part: "head", occupied: "false" });
}

export function table(b: Builder, x: number, y: number, z: number, w: WoodSet): void {
  b.set(x, y, z, w.fence, "interior");
  b.set(x, y + 1, z, w.plate, "interior");
}

export function chair(b: Builder, x: number, y: number, z: number, w: WoodSet, facing: Facing): void {
  b.set(x, y, z, w.stairs, "interior", { facing, half: "bottom" });
}

export function furniture(b: Builder, x: number, y: number, z: number, block: string, facing?: Facing): void {
  b.set(x, y, z, block, "interior", facing ? { facing } : undefined);
}

export function carpet(
  b: Builder,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  color: string,
): void {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) b.put(x, y, z, `${color}_carpet`, "interior");
}

export function bs2(b: B, props?: Record<string, string>) {
  return bs(b, props);
}
