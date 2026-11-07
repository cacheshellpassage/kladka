/**
 * Build planner: turns a voxel model into stages → layers → steps that are physically buildable
 * by hand in survival mode.
 *
 * Algorithm (documented in docs/ARCHITECTURE.md):
 *  - every block gets a role (explicit from generators, or `classifyRoles` heuristics) → stage;
 *  - groups are processed in order stage → layer (bottom-up);
 *  - inside a group a "placement simulation" runs a BFS: a block can be placed when its support rule
 *    is satisfied (attachables need their specific support block, gravity blocks need the block below,
 *    other blocks need any already placed face neighbour or the ground);
 *  - blocks that cannot be placed yet are deferred and retried after every placement; they are emitted
 *    as an extra step of the group where they became placeable;
 *  - placed blocks of a group are split into connected regions (6-connectivity), large regions are cut
 *    into chunks of ≤ MAX_STEP_BLOCKS, and steps are ordered by a nearest-neighbour tour;
 *  - companion halves (upper door half, bed head, upper half of tall plants) join their partner's step.
 */
import { blockInfo, type BlockInfo } from "../games/minecraft-java/blocks";
import { shortId } from "../model/blockstate";
import type { VoxelModel } from "../model/model";
import { analyze, classifyRoles } from "./classify";
import { ROLES, STAGES, roleCode, roleFromCode, stageOfRole, type Role, type StageId } from "./roles";

export const MAX_STEP_BLOCKS = 48;

export interface PlanStep {
  index: number;
  stage: StageId;
  /** Y of the layer group this step belongs to. */
  layer: number;
  /** Voxel indices in placement order. */
  blocks: number[];
  /** Blocks that became placeable only after a later group (e.g. hanging lanterns). */
  deferred?: boolean;
  /** Blocks without any support (need temporary scaffolding). */
  scaffold?: boolean;
}

export interface PlanLayer {
  y: number;
  stepStart: number;
  stepEnd: number;
}

export interface PlanStage {
  id: StageId;
  layers: PlanLayer[];
  stepStart: number;
  stepEnd: number;
  blockCount: number;
}

export interface BuildPlan {
  steps: PlanStep[];
  stages: PlanStage[];
  /** Global step index per voxel (-1 for air). */
  stepOf: Int32Array;
  /** Role code per voxel (0 for air). */
  roles: Uint8Array;
  totalBlocks: number;
  groundY: number;
  warnings: string[];
}

const FACES: Array<[number, number, number]> = [
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
  [0, 1, 0],
];

const FACING_OFFSET: Record<string, [number, number, number]> = {
  north: [0, 0, -1],
  south: [0, 0, 1],
  east: [1, 0, 0],
  west: [-1, 0, 0],
  up: [0, 1, 0],
  down: [0, -1, 0],
};

const TALL_PLANTS = new Set(["sunflower", "lilac", "rose_bush", "peony", "tall_grass", "large_fern", "pitcher_plant", "tall_seagrass", "tall_dry_grass"]);

/** Voxel index of the block this block must be attached to, or -1 (any neighbour), or -2 (ground ok). */
function requiredSupport(m: VoxelModel, i: number, info: BlockInfo): number {
  const st = m.palette[m.blocks[i]!]!;
  const c = m.coords(i);
  const rel = (dx: number, dy: number, dz: number) =>
    m.inBounds(c.x + dx, c.y + dy, c.z + dz) ? m.index(c.x + dx, c.y + dy, c.z + dz) : -2;
  const p = st.props;
  if (info.gravity) return rel(0, -1, 0);
  switch (info.attach) {
    case "below":
      return rel(0, -1, 0);
    case "above":
      return rel(0, 1, 0);
    case "back": {
      const o = FACING_OFFSET[p.facing ?? "north"] ?? [0, 0, -1];
      return rel(-o[0], -o[1], -o[2]);
    }
    case "face": {
      if (p.face === "floor") return rel(0, -1, 0);
      if (p.face === "ceiling") return rel(0, 1, 0);
      const o = FACING_OFFSET[p.facing ?? "north"] ?? [0, 0, -1];
      return rel(-o[0], -o[1], -o[2]);
    }
    case "hanging":
      return p.hanging === "true" ? rel(0, 1, 0) : rel(0, -1, 0);
    default:
      return -1;
  }
}

/** Partner voxel for companion halves (placed together with their partner), else -1. */
function companionOf(m: VoxelModel, i: number, info: BlockInfo): number {
  const st = m.palette[m.blocks[i]!]!;
  const c = m.coords(i);
  const s = shortId(st.name);
  if ((info.shape === "door" || TALL_PLANTS.has(s)) && st.props.half === "upper" && c.y > 0) {
    const j = m.index(c.x, c.y - 1, c.z);
    return m.blocks[j] !== 0 ? j : -1;
  }
  if (info.shape === "bed" && st.props.part === "head") {
    const o = FACING_OFFSET[st.props.facing ?? "north"] ?? [0, 0, -1];
    const nx = c.x - o[0],
      nz = c.z - o[2];
    if (m.inBounds(nx, c.y, nz)) {
      const j = m.index(nx, c.y, nz);
      return m.blocks[j] !== 0 ? j : -1;
    }
  }
  return -1;
}

export interface PlanOptions {
  /** Override roles (e.g. user edits). */
  roles?: Uint8Array;
  maxStepBlocks?: number;
}

export function planBuild(m: VoxelModel, opts: PlanOptions = {}): BuildPlan {
  const maxStep = opts.maxStepBlocks ?? MAX_STEP_BLOCKS;
  const { x: sx, y: sy, z: sz } = m.size;
  const layer = sx * sz;
  const vol = m.volume;
  const a = analyze(m);
  const auto = classifyRoles(m, a);
  const roles = new Uint8Array(vol);
  const explicit = opts.roles ?? m.roles;
  const infos: BlockInfo[] = m.palette.map((p) => blockInfo(p.name));
  const warnings: string[] = [];

  let total = 0;
  const companionPartner = new Int32Array(vol).fill(-1);
  const companionsOf = new Map<number, number[]>();
  for (let i = 0; i < vol; i++) {
    const p = m.blocks[i]!;
    if (p === 0 || infos[p]!.shape === "air") continue;
    total++;
    roles[i] = explicit && explicit[i] ? explicit[i]! : auto[i]! || roleCode("walls");
    const partner = companionOf(m, i, infos[p]!);
    if (partner >= 0) {
      companionPartner[i] = partner;
      const list = companionsOf.get(partner) ?? [];
      list.push(i);
      companionsOf.set(partner, list);
    }
  }

  // Group blocks by (stage, y)
  const groups = new Map<string, number[]>();
  const keyOf = (stage: number, y: number) => `${stage}:${y}`;
  for (let i = 0; i < vol; i++) {
    if (!roles[i] || companionPartner[i]! >= 0) continue;
    const role = roleFromCode(roles[i]!) as Role;
    const stage = STAGES.indexOf(stageOfRole(role));
    const y = Math.floor(i / layer);
    const k = keyOf(stage, y);
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(i);
  }

  const placed = new Uint8Array(vol);
  const stepOf = new Int32Array(vol).fill(-1);
  const supportOf = new Int32Array(vol);
  for (let i = 0; i < vol; i++) if (roles[i]) supportOf[i] = requiredSupport(m, i, infos[m.blocks[i]!]!);
  // Reverse dependency: support voxel → dependants (for attachables)
  const dependants = new Map<number, number[]>();
  for (let i = 0; i < vol; i++) {
    const s = supportOf[i]!;
    if (roles[i] && s >= 0) {
      const l = dependants.get(s) ?? [];
      l.push(i);
      dependants.set(s, l);
    }
  }

  const isSupported = (i: number): boolean => {
    const s = supportOf[i]!;
    const y = Math.floor(i / layer);
    if (s === -2) return true; // support would be outside the model: assume ground/wall
    if (s >= 0) {
      if (placed[s]) return true;
      // support position holds nothing placeable in the model → cannot wait for it
      return !roles[s];
    }
    if (y <= a.groundY) return true;
    const r = i - y * layer;
    const z = Math.floor(r / sx);
    const x = r - z * sx;
    for (const [dx, dy, dz] of FACES) {
      const nx = x + dx,
        ny = y + dy,
        nz = z + dz;
      if (nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= sz) continue;
      if (placed[nx + nz * sx + ny * layer]) return true;
    }
    return false;
  };

  const steps: PlanStep[] = [];
  const stages: PlanStage[] = [];
  let deferred = new Set<number>();
  let cursor: [number, number, number] = [0, 0, 0];

  const placeWithCompanions = (i: number, out: number[]) => {
    placed[i] = 1;
    out.push(i);
    for (const c of companionsOf.get(i) ?? []) {
      placed[c] = 1;
      out.push(c);
    }
  };

  const neighbours = (i: number): number[] => {
    const y = Math.floor(i / layer);
    const r = i - y * layer;
    const z = Math.floor(r / sx);
    const x = r - z * sx;
    const out: number[] = [];
    for (const [dx, dy, dz] of FACES) {
      const nx = x + dx,
        ny = y + dy,
        nz = z + dz;
      if (nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= sz) continue;
      out.push(nx + nz * sx + ny * layer);
    }
    const deps = dependants.get(i);
    if (deps) out.push(...deps);
    return out;
  };

  for (let si = 0; si < STAGES.length; si++) {
    const stageId = STAGES[si]!;
    const stage: PlanStage = { id: stageId, layers: [], stepStart: steps.length, stepEnd: steps.length, blockCount: 0 };
    for (let y = 0; y < sy; y++) {
      const group = groups.get(keyOf(si, y));
      if (!group && deferred.size === 0) continue;
      const inGroup = new Set(group ?? []);
      const order: number[] = [];
      const extra: number[] = [];
      const queue: number[] = [];
      let qh = 0;
      const enq = new Set<number>();
      for (const i of inGroup) if (isSupported(i)) (queue.push(i), enq.add(i));
      for (const i of deferred) if (isSupported(i)) (queue.push(i), enq.add(i));
      // BFS placement simulation
      while (qh < queue.length) {
        const i = queue[qh++]!;
        if (placed[i]) continue;
        const isExtra = !inGroup.has(i);
        placeWithCompanions(i, isExtra ? extra : order);
        if (isExtra) deferred.delete(i);
        for (const n of neighbours(i)) {
          if (placed[n] || enq.has(n)) continue;
          if (!inGroup.has(n) && !deferred.has(n)) continue;
          if (isSupported(n)) {
            queue.push(n);
            enq.add(n);
          }
        }
      }
      for (const i of inGroup) if (!placed[i]) deferred.add(i);
      if (order.length === 0 && extra.length === 0) continue;

      const layerInfo: PlanLayer = { y, stepStart: steps.length, stepEnd: steps.length };
      for (const blocks of splitIntoSteps(m, order, maxStep, cursor)) {
        steps.push({ index: steps.length, stage: stageId, layer: y, blocks });
        cursor = centroid(m, blocks);
      }
      if (extra.length) steps.push({ index: steps.length, stage: stageId, layer: y, blocks: extra, deferred: true });
      layerInfo.stepEnd = steps.length;
      stage.layers.push(layerInfo);
      stage.blockCount += order.length + extra.length;
    }
    stage.stepEnd = steps.length;
    if (stage.stepEnd > stage.stepStart) stages.push(stage);
  }

  // Floating blocks that never got support: force-place them (bottom-up) with a scaffold hint.
  if (deferred.size) {
    const rest = [...deferred].sort((p, q) => p - q);
    const out: number[] = [];
    for (const i of rest) if (!placed[i]) placeWithCompanions(i, out);
    if (out.length) {
      const last = stages[stages.length - 1];
      const y = Math.floor(out[0]! / layer);
      const step: PlanStep = { index: steps.length, stage: last?.id ?? "decor", layer: y, blocks: out, scaffold: true };
      steps.push(step);
      if (last) {
        last.layers.push({ y, stepStart: step.index, stepEnd: step.index + 1 });
        last.stepEnd = steps.length;
        last.blockCount += out.length;
      }
      warnings.push(`${out.length} blocks have no support and need temporary scaffolding`);
    }
    deferred = new Set();
  }

  // Companions that were never placed (partner missing) – should not happen, but keep data consistent.
  for (let i = 0; i < vol; i++) if (roles[i] && !placed[i]) placed[i] = 1;

  for (const s of steps) for (const i of s.blocks) stepOf[i] = s.index;
  return { steps, stages, stepOf, roles, totalBlocks: total, groundY: a.groundY, warnings };
}

function centroid(m: VoxelModel, blocks: number[]): [number, number, number] {
  let x = 0,
    y = 0,
    z = 0;
  for (const i of blocks) {
    const c = m.coords(i);
    x += c.x;
    y += c.y;
    z += c.z;
  }
  const n = Math.max(1, blocks.length);
  return [x / n, y / n, z / n];
}

/** Splits placed blocks (in valid placement order) into connected, size-limited, proximity-ordered steps. */
function splitIntoSteps(m: VoxelModel, order: number[], maxStep: number, start: [number, number, number]): number[][] {
  if (order.length === 0) return [];
  const pos = new Map<number, number>();
  order.forEach((i, k) => pos.set(i, k));
  const { x: sx, z: sz } = m.size;
  const layer = sx * sz;
  const comp = new Int32Array(order.length).fill(-1);
  const comps: number[][] = [];
  for (let k = 0; k < order.length; k++) {
    if (comp[k]! >= 0) continue;
    const id = comps.length;
    const members: number[] = [];
    const stack = [k];
    comp[k] = id;
    while (stack.length) {
      const q = stack.pop()!;
      members.push(q);
      const i = order[q]!;
      const y = Math.floor(i / layer);
      const r = i - y * layer;
      const z = Math.floor(r / sx);
      const x = r - z * sx;
      for (const [dx, dy, dz] of FACES) {
        const nx = x + dx,
          ny = y + dy,
          nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= sx || nz >= sz || ny < 0) continue;
        const nk = pos.get(nx + nz * sx + ny * layer);
        if (nk === undefined || comp[nk]! >= 0) continue;
        comp[nk] = id;
        stack.push(nk);
      }
    }
    members.sort((p, q) => p - q); // restore placement order inside the component
    comps.push(members.map((q) => order[q]!));
  }

  // Cut large components into chunks (placement order is preserved, so each chunk stays buildable).
  const chunks: number[][] = [];
  const compOfChunk: number[] = [];
  comps.forEach((c, ci) => {
    const parts = Math.max(1, Math.ceil(c.length / maxStep));
    const size = Math.ceil(c.length / parts);
    for (let k = 0; k < c.length; k += size) {
      chunks.push(c.slice(k, k + size));
      compOfChunk.push(ci);
    }
  });

  // Nearest-neighbour tour over chunk centroids; chunks of one component keep their relative order.
  const cents = chunks.map((c) => centroid(m, c));
  const used = new Uint8Array(chunks.length);
  const result: number[][] = [];
  let cur = start;
  for (let n = 0; n < chunks.length; n++) {
    let best = -1;
    let bestD = Infinity;
    for (let k = 0; k < chunks.length; k++) {
      if (used[k]) continue;
      // only the first unused chunk of each component is eligible (keeps intra-component order)
      if (k > 0 && compOfChunk[k - 1] === compOfChunk[k] && !used[k - 1]) continue;
      const c = cents[k]!;
      const d = (c[0] - cur[0]) ** 2 + (c[1] - cur[1]) ** 2 + (c[2] - cur[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    used[best] = 1;
    result.push(chunks[best]!);
    cur = cents[best]!;
  }
  return mergeSmallNeighbours(m, result, Math.min(maxStep, MERGE_LIMIT));
}

/** Small regions closer than this many blocks (bounding-box gap) are merged into one step. */
const MERGE_GAP = 3;
const MERGE_LIMIT = 24;

/**
 * Merges consecutive small steps that are spatially close (e.g. the panes of neighbouring windows),
 * so the user gets fewer, more meaningful steps. Order inside each part is preserved, so the merged
 * step is still buildable (parts are independent regions).
 */
function mergeSmallNeighbours(m: VoxelModel, steps: number[][], limit: number): number[][] {
  if (steps.length < 2) return steps;
  const box = (s: number[]) => {
    const b = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
    for (const i of s) {
      const c = m.coords(i);
      b.x0 = Math.min(b.x0, c.x);
      b.y0 = Math.min(b.y0, c.y);
      b.z0 = Math.min(b.z0, c.z);
      b.x1 = Math.max(b.x1, c.x);
      b.y1 = Math.max(b.y1, c.y);
      b.z1 = Math.max(b.z1, c.z);
    }
    return b;
  };
  const gap = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
    Math.max(0, a.x0 - b.x1, b.x0 - a.x1, a.y0 - b.y1, b.y0 - a.y1, a.z0 - b.z1, b.z0 - a.z1);
  const out: number[][] = [];
  let cur = steps[0]!;
  let curBox = box(cur);
  for (let k = 1; k < steps.length; k++) {
    const next = steps[k]!;
    const nb = box(next);
    if (cur.length + next.length <= limit && gap(curBox, nb) <= MERGE_GAP) {
      cur = cur.concat(next);
      curBox = {
        x0: Math.min(curBox.x0, nb.x0),
        y0: Math.min(curBox.y0, nb.y0),
        z0: Math.min(curBox.z0, nb.z0),
        x1: Math.max(curBox.x1, nb.x1),
        y1: Math.max(curBox.y1, nb.y1),
        z1: Math.max(curBox.z1, nb.z1),
      };
    } else {
      out.push(cur);
      cur = next;
      curBox = nb;
    }
  }
  out.push(cur);
  return out;
}

/** Steps index range of the full plan, convenient for UI. */
export function stageOfStep(plan: BuildPlan, step: number): PlanStage | undefined {
  return plan.stages.find((s) => step >= s.stepStart && step < s.stepEnd);
}

export function layerOfStep(plan: BuildPlan, step: number): PlanLayer | undefined {
  const st = stageOfStep(plan, step);
  return st?.layers.find((l) => step >= l.stepStart && step < l.stepEnd);
}

export { ROLES };
