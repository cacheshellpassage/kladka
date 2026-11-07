/**
 * Heuristic role classifier for imported builds (see docs/ARCHITECTURE.md → "Smart stages").
 *
 * The heuristics, in order:
 *  1. Exterior air = air reachable from the sides/top of the bounding box through passable blocks.
 *  2. Ground layer(s): the lowest layer with blocks plus following layers that cover ≥ 70 % of the
 *     footprint (max. 3 layers) → foundation.
 *  3. Hint-based roles: logs/pillars → frame; doors/glass/panes/gates → openings; furniture → interior;
 *     torches/lanterns/glowing blocks → lighting; plants/leaves/signs/banners → decor.
 *  4. Roof: sky-exposed stairs/slabs on the outside (≥ 2 layers above ground), sky-exposed full blocks
 *     covering enclosed air, and stairs/slabs directly under roof blocks (eave undersides).
 *  5. Corner pillars: vertical runs (≥ 3) of one block at convex outside corners whose material differs
 *     from the adjacent wall → frame.
 *  6. Fences/walls (garden walls) inside → interior, outside → decor.
 *  7. Everything else structural → walls (this includes floors and partitions).
 */
import { blockInfo, isPassable, type BlockInfo } from "../games/minecraft-java/blocks";
import type { VoxelModel } from "../model/model";
import { roleCode, type Role } from "./roles";

export interface Analysis {
  /** 1 for air voxels connected to the outside. */
  exteriorAir: Uint8Array;
  /** 1 for blocks touching exterior air. */
  exteriorAdj: Uint8Array;
  /** 1 for blocks with nothing solid above them. */
  skyExposed: Uint8Array;
  groundY: number;
  foundationTop: number;
  footprint: number;
  infos: BlockInfo[];
  passable: Uint8Array;
}

const N6: Array<[number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export function analyze(m: VoxelModel): Analysis {
  const { x: sx, y: sy, z: sz } = m.size;
  const infos = m.palette.map((p) => blockInfo(p.name));
  const passable = Uint8Array.from(m.palette.map((p) => (isPassable(p.name) ? 1 : 0)));
  const vol = m.volume;
  const ext = new Uint8Array(vol);
  const queue = new Int32Array(vol);
  let qh = 0,
    qt = 0;
  const layer = sx * sz;
  const seed = (x: number, y: number, z: number) => {
    const i = x + z * sx + y * layer;
    if (!ext[i] && passable[m.blocks[i]!]) {
      ext[i] = 1;
      queue[qt++] = i;
    }
  };
  for (let y = 0; y < sy; y++) {
    for (let x = 0; x < sx; x++) {
      seed(x, y, 0);
      seed(x, y, sz - 1);
    }
    for (let z = 0; z < sz; z++) {
      seed(0, y, z);
      seed(sx - 1, y, z);
    }
  }
  for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) seed(x, sy - 1, z);
  while (qh < qt) {
    const i = queue[qh++]!;
    const y = Math.floor(i / layer);
    const r = i - y * layer;
    const z = Math.floor(r / sx);
    const x = r - z * sx;
    for (const [dx, dy, dz] of N6) {
      const nx = x + dx,
        ny = y + dy,
        nz = z + dz;
      if (nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= sz) continue;
      const j = nx + nz * sx + ny * layer;
      if (ext[j] || !passable[m.blocks[j]!]) continue;
      ext[j] = 1;
      queue[qt++] = j;
    }
  }

  const exteriorAdj = new Uint8Array(vol);
  const skyExposed = new Uint8Array(vol);
  const colCovered = new Uint8Array(layer);
  for (let y = sy - 1; y >= 0; y--) {
    for (let z = 0; z < sz; z++)
      for (let x = 0; x < sx; x++) {
        const c = x + z * sx;
        const i = c + y * layer;
        const p = m.blocks[i]!;
        if (p === 0) continue;
        if (!colCovered[c]) skyExposed[i] = 1;
        if (!passable[p]) colCovered[c] = 1;
        for (const [dx, dy, dz] of N6) {
          const nx = x + dx,
            ny = y + dy,
            nz = z + dz;
          if (ny < 0) continue;
          if (nx < 0 || nz < 0 || nx >= sx || nz >= sz || ny >= sy) {
            exteriorAdj[i] = 1;
            break;
          }
          if (ext[nx + nz * sx + ny * layer]) {
            exteriorAdj[i] = 1;
            break;
          }
        }
      }
  }

  // Ground & foundation
  const counts = new Int32Array(sy);
  const cols = new Uint8Array(layer);
  let groundY = -1;
  for (let y = 0; y < sy; y++)
    for (let c = 0; c < layer; c++) {
      const p = m.blocks[c + y * layer]!;
      if (p === 0 || passable[p]) continue;
      counts[y]!++;
      cols[c] = 1;
      if (groundY < 0) groundY = y;
    }
  let footprint = 0;
  for (let c = 0; c < layer; c++) footprint += cols[c]!;
  if (groundY < 0) groundY = 0;
  let foundationTop = groundY;
  while (
    foundationTop + 1 < sy &&
    foundationTop + 1 <= groundY + 2 &&
    counts[foundationTop + 1]! >= 0.7 * footprint
  ) {
    foundationTop++;
  }
  // Never treat the whole build as foundation (e.g. solid cubes).
  if (foundationTop > groundY && foundationTop >= sy - 2) foundationTop = groundY;

  return { exteriorAir: ext, exteriorAdj, skyExposed, groundY, foundationTop, footprint, infos, passable };
}

/** Returns role codes for every voxel (0 for air). Explicit roles in `m.roles` win. */
export function classifyRoles(m: VoxelModel, a: Analysis = analyze(m)): Uint8Array {
  const { x: sx, y: sy, z: sz } = m.size;
  const layer = sx * sz;
  const roles = new Uint8Array(m.volume);
  const R = (r: Role) => roleCode(r);
  const { infos, exteriorAdj, skyExposed, exteriorAir, foundationTop, groundY } = a;

  // Pass 1: hints and basic structure
  for (const { i, y, p } of m.nonAir()) {
    const info = infos[p]!;
    if (info.shape === "air") continue;
    let role: Role;
    switch (info.hint) {
      case "frame":
        role = y <= foundationTop ? "foundation" : "frame";
        break;
      case "opening":
        role = "openings";
        break;
      case "interior":
        role = "interior";
        break;
      case "light":
        role = "lighting";
        break;
      case "decor":
      case "liquid":
        role = "decor";
        break;
      case "nature":
        role =
          y <= foundationTop && info.shape === "cube" && info.render === "opaque" ? "foundation" : "decor";
        break;
      case "fence":
        role = exteriorAdj[i] ? "decor" : "interior";
        break;
      default:
        role = y <= foundationTop ? "foundation" : "walls";
    }
    roles[i] = R(role);
  }

  // Pass 2: roofs (top-down so that eave undersides can follow roof blocks above them)
  const roof = R("roof");
  const walls = R("walls");
  for (let y = sy - 1; y > foundationTop; y--) {
    for (let z = 0; z < sz; z++)
      for (let x = 0; x < sx; x++) {
        const i = x + z * sx + y * layer;
        if (roles[i] !== walls) continue;
        const info = infos[m.blocks[i]!]!;
        const shaped = info.shape === "stairs" || info.shape === "slab";
        if (shaped && skyExposed[i] && exteriorAdj[i] && y >= groundY + 2) {
          roles[i] = roof;
          continue;
        }
        if (info.shape === "cube" && skyExposed[i] && y > foundationTop + 1) {
          const below = i - layer;
          if (m.blocks[below] === 0 && !exteriorAir[below]) {
            roles[i] = roof;
            continue;
          }
          if (roles[below] === roof) {
            roles[i] = roof;
            continue;
          }
        }
        if (
          y + 1 < sy &&
          roles[i + layer] === roof &&
          (shaped || info.shape === "cube") &&
          exteriorAdj[i] &&
          skyExposedBelowRoof(m, i, layer, roles, roof)
        ) {
          roles[i] = roof;
        }
      }
  }

  // Pass 3: corner pillars
  const frame = R("frame");
  for (let z = 0; z < sz; z++)
    for (let x = 0; x < sx; x++) {
      let runStart = -1;
      let runP = -1;
      for (let y = foundationTop + 1; y <= sy; y++) {
        const i = x + z * sx + y * layer;
        const p = y < sy ? m.blocks[i]! : -1;
        const ok =
          y < sy &&
          p !== 0 &&
          roles[i] === walls &&
          infos[p]!.shape === "cube" &&
          exteriorAdj[i] &&
          isConvexCorner(m, a, x, y, z);
        if (ok && p === runP) continue;
        if (runStart >= 0 && y - runStart >= 3 && differsFromNeighbours(m, x, runStart, z, runP)) {
          for (let yy = runStart; yy < y; yy++) roles[x + z * sx + yy * layer] = frame;
        }
        runStart = ok ? y : -1;
        runP = ok ? p : -1;
      }
    }
  return roles;
}

function skyExposedBelowRoof(
  m: VoxelModel,
  i: number,
  layer: number,
  roles: Uint8Array,
  roof: number,
): boolean {
  // a block under a roof block counts as eave underside only if it is not supporting interior space
  const below = i - layer;
  return below < 0 || m.blocks[below] === 0 || roles[below] === roof;
}

function isConvexCorner(m: VoxelModel, a: Analysis, x: number, y: number, z: number): boolean {
  const ext = (dx: number, dz: number) => {
    const nx = x + dx,
      nz = z + dz;
    if (!m.inBounds(nx, y, nz)) return true;
    return a.exteriorAir[m.index(nx, y, nz)] === 1;
  };
  return (ext(1, 0) || ext(-1, 0)) && (ext(0, 1) || ext(0, -1));
}

function differsFromNeighbours(m: VoxelModel, x: number, y: number, z: number, p: number): boolean {
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const q = m.getIndex(x + dx, y, z + dz);
    if (q !== 0 && q !== p && m.palette[q]!.material !== m.palette[p]!.material) return true;
  }
  return false;
}
