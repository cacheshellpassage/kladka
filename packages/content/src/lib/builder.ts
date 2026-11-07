/**
 * Builder API for parametric, original builds. Every block is placed with an explicit role so that
 * generated builds get hand-crafted stages instead of heuristics.
 */
import {
  MC_DATA_VERSION,
  VoxelModel,
  minecraftJava,
  parseState,
  roleCode,
  type BlockState,
  type Role,
} from "@kladka/voxel-core";

export type B = string | BlockState;
export type Facing = "north" | "south" | "east" | "west";
export const FACINGS: Facing[] = ["north", "east", "south", "west"];
export const OPP: Record<Facing, Facing> = { north: "south", south: "north", east: "west", west: "east" };
export const DIRV: Record<Facing, [number, number]> = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
};

export function bs(b: B, props?: Record<string, string>): BlockState {
  const s = typeof b === "string" ? parseState(b) : b;
  return props ? { name: s.name, props: { ...s.props, ...props } } : s;
}

export class Builder {
  readonly m: VoxelModel;
  readonly roles: Uint8Array;

  constructor(
    readonly sx: number,
    readonly sy: number,
    readonly sz: number,
  ) {
    this.m = new VoxelModel(
      { x: sx, y: sy, z: sz },
      { dataVersion: MC_DATA_VERSION, materialOf: minecraftJava.materialOf },
    );
    this.roles = new Uint8Array(this.m.volume);
  }

  in(x: number, y: number, z: number): boolean {
    return this.m.inBounds(x, y, z);
  }

  set(x: number, y: number, z: number, b: B, role: Role, props?: Record<string, string>): void {
    if (!this.in(x, y, z)) return;
    const st = bs(b, props);
    if (st.name === "minecraft:air") return this.clear(x, y, z);
    this.m.set(x, y, z, st);
    this.roles[this.m.index(x, y, z)] = roleCode(role);
  }

  /** Sets only where the cell is empty. */
  put(x: number, y: number, z: number, b: B, role: Role, props?: Record<string, string>): void {
    if (this.isAir(x, y, z)) this.set(x, y, z, b, role, props);
  }

  clear(x: number, y: number, z: number): void {
    if (!this.in(x, y, z)) return;
    this.m.set(x, y, z, 0);
    this.roles[this.m.index(x, y, z)] = 0;
  }

  isAir(x: number, y: number, z: number): boolean {
    return !this.in(x, y, z) || this.m.isAir(x, y, z);
  }

  name(x: number, y: number, z: number): string {
    return this.m.get(x, y, z).name.replace("minecraft:", "");
  }

  fill(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    b: B,
    role: Role,
    props?: Record<string, string>,
  ): void {
    const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [ay, by] = y0 <= y1 ? [y0, y1] : [y1, y0];
    const [az, bz] = z0 <= z1 ? [z0, z1] : [z1, z0];
    for (let y = ay; y <= by; y++)
      for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) this.set(x, y, z, b, role, props);
  }

  clearBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.clear(x, y, z);
  }

  /** Rectangle outline on one layer. */
  ring(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y: number,
    b: B,
    role: Role,
    props?: Record<string, string>,
  ): void {
    for (let x = x0; x <= x1; x++) {
      this.set(x, y, z0, b, role, props);
      this.set(x, y, z1, b, role, props);
    }
    for (let z = z0; z <= z1; z++) {
      this.set(x0, y, z, b, role, props);
      this.set(x1, y, z, b, role, props);
    }
  }

  /** Perimeter walls from y0 to y1; optional corner pillars (frame role). */
  walls(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y0: number,
    y1: number,
    b: B,
    role: Role = "walls",
    corner?: B,
  ): void {
    for (let y = y0; y <= y1; y++) this.ring(x0, z0, x1, z1, y, b, role);
    if (corner) {
      for (let y = y0; y <= y1; y++)
        for (const [x, z] of [
          [x0, z0],
          [x1, z0],
          [x0, z1],
          [x1, z1],
        ] as const)
          this.set(x, y, z, bs(corner, { axis: "y" }), "frame");
    }
  }

  floor(x0: number, z0: number, x1: number, z1: number, y: number, b: B, role: Role = "foundation"): void {
    this.fill(x0, y, z0, x1, y, z1, b, role);
  }

  /** Circle (filled or ring) helper; calls fn for each cell. */
  circle(cx: number, cz: number, r: number, filled: boolean, fn: (x: number, z: number) => void): void {
    const R = Math.ceil(r) + 1;
    for (let dz = -R; dz <= R; dz++)
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dz);
        if (filled ? d <= r + 0.35 : d <= r + 0.35 && d > r - 0.75) fn(cx + dx, cz + dz);
      }
  }

  /** Returns the finished model: connections computed, roles attached, trimmed to content. */
  finish(): VoxelModel {
    this.m.roles = this.roles;
    minecraftJava.finalize(this.m);
    this.m.roles = this.roles;
    const t = this.m.trimmed();
    t.compactPalette();
    return t;
  }
}

/* ---------------------------------------------------------------- */
/* Material sets                                                      */
/* ---------------------------------------------------------------- */

export interface MatSet {
  block: string;
  stairs: string;
  slab: string;
  wall?: string;
}

export const WOODS = [
  "oak",
  "spruce",
  "birch",
  "jungle",
  "acacia",
  "dark_oak",
  "mangrove",
  "cherry",
] as const;
export type Wood = (typeof WOODS)[number];

export function woodSet(w: Wood) {
  return {
    planks: `${w}_planks`,
    log: `${w}_log`,
    stripped: `stripped_${w}_log`,
    wood: `${w}_wood`,
    stairs: `${w}_stairs`,
    slab: `${w}_slab`,
    fence: `${w}_fence`,
    gate: `${w}_fence_gate`,
    door: `${w}_door`,
    trapdoor: `${w}_trapdoor`,
    leaves: `${w}_leaves`,
    sign: `${w}_wall_sign`,
    button: `${w}_button`,
    plate: `${w}_pressure_plate`,
    mat: { block: `${w}_planks`, stairs: `${w}_stairs`, slab: `${w}_slab` } as MatSet,
  };
}
export type WoodSet = ReturnType<typeof woodSet>;

export const STONE: Record<string, MatSet> = {
  stone_bricks: {
    block: "stone_bricks",
    stairs: "stone_brick_stairs",
    slab: "stone_brick_slab",
    wall: "stone_brick_wall",
  },
  mossy_stone_bricks: {
    block: "mossy_stone_bricks",
    stairs: "mossy_stone_brick_stairs",
    slab: "mossy_stone_brick_slab",
    wall: "mossy_stone_brick_wall",
  },
  cobblestone: {
    block: "cobblestone",
    stairs: "cobblestone_stairs",
    slab: "cobblestone_slab",
    wall: "cobblestone_wall",
  },
  mossy_cobblestone: {
    block: "mossy_cobblestone",
    stairs: "mossy_cobblestone_stairs",
    slab: "mossy_cobblestone_slab",
    wall: "mossy_cobblestone_wall",
  },
  bricks: { block: "bricks", stairs: "brick_stairs", slab: "brick_slab", wall: "brick_wall" },
  sandstone: {
    block: "sandstone",
    stairs: "sandstone_stairs",
    slab: "sandstone_slab",
    wall: "sandstone_wall",
  },
  smooth_sandstone: {
    block: "smooth_sandstone",
    stairs: "smooth_sandstone_stairs",
    slab: "smooth_sandstone_slab",
  },
  red_sandstone: {
    block: "red_sandstone",
    stairs: "red_sandstone_stairs",
    slab: "red_sandstone_slab",
    wall: "red_sandstone_wall",
  },
  deepslate_tiles: {
    block: "deepslate_tiles",
    stairs: "deepslate_tile_stairs",
    slab: "deepslate_tile_slab",
    wall: "deepslate_tile_wall",
  },
  deepslate_bricks: {
    block: "deepslate_bricks",
    stairs: "deepslate_brick_stairs",
    slab: "deepslate_brick_slab",
    wall: "deepslate_brick_wall",
  },
  cobbled_deepslate: {
    block: "cobbled_deepslate",
    stairs: "cobbled_deepslate_stairs",
    slab: "cobbled_deepslate_slab",
    wall: "cobbled_deepslate_wall",
  },
  polished_andesite: {
    block: "polished_andesite",
    stairs: "polished_andesite_stairs",
    slab: "polished_andesite_slab",
  },
  andesite: { block: "andesite", stairs: "andesite_stairs", slab: "andesite_slab", wall: "andesite_wall" },
  mud_bricks: {
    block: "mud_bricks",
    stairs: "mud_brick_stairs",
    slab: "mud_brick_slab",
    wall: "mud_brick_wall",
  },
  quartz: { block: "quartz_block", stairs: "quartz_stairs", slab: "quartz_slab" },
  dark_prismarine: {
    block: "dark_prismarine",
    stairs: "dark_prismarine_stairs",
    slab: "dark_prismarine_slab",
  },
  prismarine_bricks: {
    block: "prismarine_bricks",
    stairs: "prismarine_brick_stairs",
    slab: "prismarine_brick_slab",
  },
  blackstone: {
    block: "polished_blackstone_bricks",
    stairs: "polished_blackstone_brick_stairs",
    slab: "polished_blackstone_brick_slab",
    wall: "polished_blackstone_brick_wall",
  },
  tuff_bricks: {
    block: "tuff_bricks",
    stairs: "tuff_brick_stairs",
    slab: "tuff_brick_slab",
    wall: "tuff_brick_wall",
  },
  granite: { block: "polished_granite", stairs: "polished_granite_stairs", slab: "polished_granite_slab" },
};

export function roofSet(name: string): MatSet {
  if (STONE[name]) return STONE[name]!;
  return woodSet(name as Wood).mat;
}

/* ---------------------------------------------------------------- */
/* Deterministic RNG                                                  */
/* ---------------------------------------------------------------- */

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(r: () => number, items: readonly T[]): T {
  return items[Math.floor(r() * items.length) % items.length]!;
}
