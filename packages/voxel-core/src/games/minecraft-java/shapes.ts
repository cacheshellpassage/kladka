/**
 * Parametric block geometry, written from scratch for this project (no game model files).
 * Every non-cube block is approximated by a few axis-aligned boxes in 1/16 block units,
 * or by crossed planes for plants. The viewer turns these into triangles.
 */
import type { BlockState } from "../../model/blockstate";
import { shortId } from "../../model/blockstate";
import type { BlockInfo } from "./blocks";

export type Face = "up" | "down" | "north" | "south" | "east" | "west";
export type Horizontal = "north" | "east" | "south" | "west";

export interface Box {
  from: [number, number, number];
  to: [number, number, number];
  /** Optional per-box emissive override (e.g. torch flame). */
  glow?: boolean;
  /** Use the "top" texture on all faces (e.g. plant on pot). */
  tint?: number;
}

export interface ShapeGeometry {
  boxes: Box[];
  /** Crossed planes (plants): "x" = two diagonal planes, "hash" = four planes (crops). */
  planes?: "x" | "hash";
  /** Height of crossed planes in 1/16. */
  planeHeight?: number;
}

const HORIZONTALS: Horizontal[] = ["north", "east", "south", "west"];

export function turnsFromNorth(f: string | undefined): number {
  const i = HORIZONTALS.indexOf((f ?? "north") as Horizontal);
  return i < 0 ? 0 : i;
}

export function opposite(f: Horizontal): Horizontal {
  return HORIZONTALS[(HORIZONTALS.indexOf(f) + 2) % 4]!;
}

export function clockwise(f: Horizontal): Horizontal {
  return HORIZONTALS[(HORIZONTALS.indexOf(f) + 1) % 4]!;
}

export function counterClockwise(f: Horizontal): Horizontal {
  return HORIZONTALS[(HORIZONTALS.indexOf(f) + 3) % 4]!;
}

export const DIR: Record<Face, [number, number, number]> = {
  up: [0, 1, 0],
  down: [0, -1, 0],
  north: [0, 0, -1],
  south: [0, 0, 1],
  east: [1, 0, 0],
  west: [-1, 0, 0],
};

/** Rotates a box defined for "north" by quarter turns clockwise (seen from above). */
export function rotateBox(b: Box, turns: number): Box {
  let [x0, y0, z0] = b.from;
  let [x1, y1, z1] = b.to;
  for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
    // (x, z) -> (16 - z, x)
    const nx0 = 16 - z1,
      nx1 = 16 - z0,
      nz0 = x0,
      nz1 = x1;
    x0 = nx0;
    x1 = nx1;
    z0 = nz0;
    z1 = nz1;
  }
  return { ...b, from: [x0, y0, z0], to: [x1, y1, z1] };
}

function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, extra: Partial<Box> = {}): Box {
  return { from: [x0, y0, z0], to: [x1, y1, z1], ...extra };
}

const FULL: ShapeGeometry = { boxes: [box(0, 0, 0, 16, 16, 16)] };

function rot(boxes: Box[], facing: string | undefined): Box[] {
  const t = turnsFromNorth(facing);
  return boxes.map((b) => rotateBox(b, t));
}

function stairs(p: Readonly<Record<string, string>>): Box[] {
  const top = p.half === "top";
  const [b0, b1] = top ? [8, 16] : [0, 8];
  const [s0, s1] = top ? [0, 8] : [8, 16];
  const out: Box[] = [box(0, b0, 0, 16, b1, 16)];
  // quarters for facing north: back = north (z 0..8); left = west.
  const NW = box(0, s0, 0, 8, s1, 8);
  const NE = box(8, s0, 0, 16, s1, 8);
  const SW = box(0, s0, 8, 8, s1, 16);
  const SE = box(8, s0, 8, 16, s1, 16);
  let q: Box[];
  switch (p.shape) {
    case "outer_left":
      q = [NW];
      break;
    case "outer_right":
      q = [NE];
      break;
    case "inner_left":
      q = [box(0, s0, 0, 16, s1, 8), SW];
      break;
    case "inner_right":
      q = [box(0, s0, 0, 16, s1, 8), SE];
      break;
    default:
      q = [box(0, s0, 0, 16, s1, 8)];
  }
  void NE;
  return out.concat(rot(q, p.facing));
}

function sideArms(p: Readonly<Record<string, string>>, arm: (side: Horizontal, v: string) => Box[]): Box[] {
  const out: Box[] = [];
  for (const side of HORIZONTALS) {
    const v = p[side];
    if (!v || v === "false" || v === "none") continue;
    out.push(...rot(arm(side, v), side));
  }
  return out;
}

/** Returns geometry for a block state. Cubes return a single full box. */
export function shapeGeometry(s: BlockState, info: BlockInfo): ShapeGeometry {
  const p = s.props;
  const id = shortId(s.name);
  switch (info.shape) {
    case "air":
      return { boxes: [] };
    case "cube":
      return FULL;
    case "slab":
      if (p.type === "double") return FULL;
      return { boxes: [p.type === "top" ? box(0, 8, 0, 16, 16, 16) : box(0, 0, 0, 16, 8, 16)] };
    case "stairs":
      return { boxes: stairs(p) };
    case "fence":
      return {
        boxes: [
          box(6, 0, 6, 10, 16, 10),
          ...sideArms(p, () => [box(7, 12, 0, 9, 15, 6), box(7, 6, 0, 9, 9, 6)]),
        ],
      };
    case "fence_gate": {
      const open = p.open === "true";
      const base = [box(0, 5, 7, 2, 16, 9), box(14, 5, 7, 16, 16, 9)];
      if (!open) base.push(box(2, 6, 7, 14, 9, 9), box(2, 12, 7, 14, 15, 9), box(6, 9, 7, 10, 12, 9));
      else base.push(box(0, 6, 9, 2, 15, 15), box(14, 6, 9, 16, 15, 15));
      return { boxes: rot(base, p.facing) };
    }
    case "wall": {
      const boxes: Box[] = [];
      const up = p.up !== "false";
      if (up) boxes.push(box(4, 0, 4, 12, 16, 12));
      boxes.push(...sideArms(p, (_side, v) => [box(5, 0, 0, 11, v === "tall" ? 16 : 14, up ? 4 : 8)]));
      if (!up) {
        // straight wall without post: connect through the centre
        const ns = p.north && p.north !== "none" && p.south && p.south !== "none";
        const h = p.north === "tall" || p.east === "tall" ? 16 : 14;
        boxes.push(ns ? box(5, 0, 4, 11, h, 12) : box(4, 0, 5, 12, h, 11));
      }
      if (boxes.length === 0) boxes.push(box(4, 0, 4, 12, 16, 12));
      return { boxes };
    }
    case "pane":
      return {
        boxes: [box(7, 0, 7, 9, 16, 9), ...sideArms(p, () => [box(7, 0, 0, 9, 16, 7)])],
      };
    case "door": {
      const f = (p.facing ?? "north") as Horizontal;
      const open = p.open === "true";
      const side = !open ? f : p.hinge === "right" ? counterClockwise(f) : clockwise(f);
      return { boxes: rot([box(0, 0, 0, 16, 16, 3)], side) };
    }
    case "trapdoor": {
      if (p.open === "true") {
        const f = (p.facing ?? "north") as Horizontal;
        return { boxes: rot([box(0, 0, 0, 16, 16, 3)], opposite(f)) };
      }
      return { boxes: [p.half === "top" ? box(0, 13, 0, 16, 16, 16) : box(0, 0, 0, 16, 3, 16)] };
    }
    case "torch":
      return { boxes: [box(7, 0, 7, 9, 8, 9), box(6.5, 8, 6.5, 9.5, 10.5, 9.5, { glow: true })] };
    case "wall_torch":
      // defined for facing north: attached to the block in the south
      return {
        boxes: rot([box(7, 3, 11.5, 9, 11, 13.5), box(6.5, 11, 10.5, 9.5, 13.5, 13.5, { glow: true })], p.facing),
      };
    case "lantern": {
      const dy = p.hanging === "true" ? 1 : 0;
      const boxes = [box(5, dy, 5, 11, 7 + dy, 11, { glow: true }), box(6, 7 + dy, 6, 10, 9 + dy, 10)];
      if (dy) boxes.push(box(7.5, 10, 7.5, 8.5, 16, 8.5));
      return { boxes };
    }
    case "ladder":
      return { boxes: rot([box(0, 0, 14.5, 16, 16, 16)], p.facing) };
    case "carpet":
      return { boxes: [box(0, 0, 0, 16, id === "lily_pad" ? 0.5 : 1, 16)] };
    case "cross":
      return { boxes: [], planes: "x", planeHeight: 16 };
    case "crop": {
      const age = Number(p.age ?? 7);
      const max = id === "beetroots" || id === "nether_wart" ? 3 : 7;
      return { boxes: [], planes: "hash", planeHeight: Math.max(3, Math.round((16 * (age + 1)) / (max + 1))) };
    }
    case "bed":
      return { boxes: [box(0, 3, 0, 16, 9, 16), box(0, 0, 0, 3, 3, 3), box(13, 0, 13, 16, 3, 16)] };
    case "chest":
      return { boxes: [box(1, 0, 1, 15, 14, 15)] };
    case "button": {
      if (p.face === "floor") return { boxes: [box(5, 0, 6, 11, 2, 10)] };
      if (p.face === "ceiling") return { boxes: [box(5, 14, 6, 11, 16, 10)] };
      return { boxes: rot([box(5, 6, 14, 11, 10, 16)], p.facing) };
    }
    case "plate":
      return { boxes: [box(1, 0, 1, 15, 1, 15)] };
    case "layer":
      return { boxes: [box(0, 0, 0, 16, 2 * Math.max(1, Number(p.layers ?? 1)), 16)] };
    case "liquid": {
      const level = Number(p.level ?? 0);
      const h = level === 0 || level >= 8 ? 14 : Math.max(2, 14 - level * 1.75);
      return { boxes: [box(0, 0, 0, 16, h, 16)] };
    }
    case "rail":
      return { boxes: [box(0, 0, 0, 16, 1, 16)] };
    case "sign": {
      const turns = Math.round(Number(p.rotation ?? 0) / 4) % 4;
      return {
        boxes: [box(7, 0, 7, 9, 9, 9), ...[box(1, 9, 7.25, 15, 16, 8.75)].map((b) => rotateBox(b, turns))],
      };
    }
    case "wall_sign":
      return { boxes: rot([box(1, 4.5, 14, 15, 12.5, 16)], p.facing) };
    case "hanging_sign":
      return { boxes: [box(1, 0, 7, 15, 10, 9), box(3, 10, 7.5, 4, 16, 8.5), box(12, 10, 7.5, 13, 16, 8.5)] };
    case "banner":
      return { boxes: [box(7, 0, 7, 9, 16, 9), box(1, 4, 7.5, 15, 16, 8.5)] };
    case "wall_banner":
      return { boxes: rot([box(1, 0, 14, 15, 16, 15.5)], p.facing) };
    case "pot": {
      const boxes = [box(5, 0, 5, 11, 6, 11)];
      if (id.startsWith("potted_")) boxes.push(box(6, 6, 6, 10, 12, 10, { tint: 0x4f9a2c }));
      return { boxes };
    }
    case "chain": {
      const b = box(6.5, 0, 6.5, 9.5, 16, 9.5);
      if (p.axis === "x") return { boxes: [box(0, 6.5, 6.5, 16, 9.5, 9.5)] };
      if (p.axis === "z") return { boxes: [box(6.5, 6.5, 0, 9.5, 9.5, 16)] };
      return { boxes: [b] };
    }
    case "candle": {
      const n = Math.min(4, Math.max(1, Number(p.candles ?? 1)));
      const pos = [
        [7, 7],
        [5, 9],
        [9, 5],
        [9, 9],
      ];
      const boxes: Box[] = [];
      for (let i = 0; i < n; i++) {
        const [x, z] = pos[i]!;
        boxes.push(box(x!, 0, z!, x! + 2, 6, z! + 2));
      }
      return { boxes };
    }
    case "campfire":
      return {
        boxes: [
          box(1, 0, 0, 5, 4, 16),
          box(11, 0, 0, 15, 4, 16),
          box(0, 3, 1, 16, 7, 5),
          box(0, 3, 11, 16, 7, 15),
          ...(p.lit === "false" ? [] : [box(5, 1, 5, 11, 9, 11, { glow: true })]),
        ],
      };
    case "path":
      return { boxes: [box(0, 0, 0, 16, 15, 16)] };
    case "rod": {
      const f = p.facing ?? "up";
      if (f === "east" || f === "west") return { boxes: [box(0, 7, 7, 16, 9, 9, { glow: id === "end_rod" })] };
      if (f === "north" || f === "south") return { boxes: [box(7, 7, 0, 9, 9, 16, { glow: id === "end_rod" })] };
      return { boxes: [box(7, 0, 7, 9, 16, 9, { glow: id === "end_rod" })] };
    }
    case "small":
    case "head":
      return { boxes: [box(4, 0, 4, 12, 8, 12)] };
    case "vine": {
      const boxes: Box[] = [];
      for (const side of HORIZONTALS) if (p[side] === "true") boxes.push(...rot([box(0, 0, 0, 16, 16, 0.8)], side));
      if (p.up === "true") boxes.push(box(0, 15.2, 0, 16, 16, 16));
      if (boxes.length === 0) boxes.push(box(0, 0, 0, 16, 16, 0.8));
      return { boxes };
    }
    case "anvil": {
      const boxes = [box(2, 0, 2, 14, 4, 14), box(4, 4, 3, 12, 5, 13), box(6, 5, 4, 10, 10, 12), box(3, 10, 0, 13, 16, 16)];
      return { boxes: p.facing === "east" || p.facing === "west" ? boxes.map((b) => rotateBox(b, 1)) : boxes };
    }
    case "lectern":
      return { boxes: [box(0, 0, 0, 16, 2, 16), box(4, 2, 4, 12, 13, 12), ...rot([box(0, 12, 1, 16, 15, 15)], p.facing)] };
    case "table":
      return { boxes: [box(0, 0, 0, 16, id === "stonecutter" ? 9 : 12, 16)] };
    case "cake":
      return { boxes: [box(1, 0, 1, 15, 8, 15)] };
    case "bell":
      return { boxes: [box(5, 4, 5, 11, 11, 11), box(4, 4, 4, 12, 6, 12), box(7, 11, 7, 9, 16, 9)] };
    case "hopper":
      return { boxes: [box(0, 10, 0, 16, 16, 16), box(4, 4, 4, 12, 10, 12), box(6, 0, 6, 10, 4, 10)] };
    case "cauldron":
      return {
        boxes: [
          box(0, 3, 0, 16, 16, 2),
          box(0, 3, 14, 16, 16, 16),
          box(0, 3, 2, 2, 16, 14),
          box(14, 3, 2, 16, 16, 14),
          box(2, 3, 2, 14, 4, 14),
          box(0, 0, 0, 4, 3, 4),
          box(12, 0, 12, 16, 3, 16),
          box(0, 0, 12, 4, 3, 16),
          box(12, 0, 0, 16, 3, 4),
        ],
      };
  }
}
