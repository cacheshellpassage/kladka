/**
 * Dev report: how convenient the step plan is to follow by hand in survival.
 * `pnpm --filter @kladka/content exec tsx src/dev/reach-report.ts [id | file.litematic ...] [--detail]`
 *
 * The plan is replayed step by step. Before every step the walkable cells are found from the ground around
 * the build (walk, jump one block up, fall, climb ladders and vines, pass doors, gates and trapdoors). A
 * block counts as reachable when some walkable cell has the eye (1.62 above the feet) within 4.5 blocks of
 * the block and a clear line of sight to it through what is built at that moment. Everything else needs the
 * builder to pillar up or put up scaffolding.
 *
 * Experiments with the stage order, via the ORDER environment variable:
 *  - ORDER=ladders — ladders and indoor stairs go up with the walls instead of after the roof;
 *  - ORDER=floors  — the same, and frame and openings too, so a house rises floor by floor.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import {
  blockInfo,
  importBytes,
  planBuild,
  roleCode,
  roleFromCode,
  type VoxelModel,
} from "@kladka/voxel-core";
import { CATALOG, buildEntry } from "../catalog";

const REACH = 4.5;
const EYE = 1.62;
const MARGIN = 6;

/** Shapes a player walks through (doors, gates and trapdoors are assumed open). */
const WALK_THROUGH = new Set([
  "air",
  "cross",
  "crop",
  "torch",
  "wall_torch",
  "rail",
  "button",
  "plate",
  "vine",
  "layer",
  "carpet",
  "liquid",
  "sign",
  "wall_sign",
  "banner",
  "wall_banner",
  "ladder",
  "door",
  "fence_gate",
  "trapdoor",
  "lantern",
  "chain",
  "hanging_sign",
  "candle",
  "small",
]);
/** Shapes that stop a line of sight. */
const SEE_THROUGH = new Set([...WALK_THROUGH, "pane", "fence", "rod"]);
const CLIMB = new Set(["ladder", "vine"]);
/** 1.5 blocks tall: cannot be jumped onto from the ground. */
const TALL = new Set(["fence", "wall", "fence_gate"]);

interface Report {
  id: string;
  blocks: number;
  steps: number;
  median: number;
  singles: number;
  unreachable: number;
  unreachSteps: number;
  byStage: Map<string, number>;
  travel: number;
  swings: number;
  firstUnreach: number;
  heights: number;
  detail: string[];
}

function analyse(id: string, m: VoxelModel, detail: boolean): Report {
  let plan = planBuild(m);
  const order = process.env.ORDER;
  if (order === "ladders" || order === "floors") {
    const roles = Uint8Array.from(plan.roles);
    const wallsCode = roleCode("walls");
    for (let i = 0; i < m.volume; i++) {
      const sh = blockInfo(m.palette[m.blocks[i]!]!.name).shape;
      const r = roleFromCode(roles[i]!);
      const climb = sh === "ladder" || (sh === "stairs" && r === "interior");
      if (climb || (order === "floors" && (r === "openings" || r === "frame"))) roles[i] = wallsCode;
    }
    plan = planBuild(m, { roles });
  }
  const { x: sx, y: sy, z: sz } = m.size;
  const gx = sx + 2 * MARGIN,
    gz = sz + 2 * MARGIN,
    gy = sy + 3;
  const g0 = plan.groundY; // feet level outside the build
  const infos = m.palette.map((p) => blockInfo(p.name));
  const shapeAt = new Array<string>(m.volume);
  for (let i = 0; i < m.volume; i++) shapeAt[i] = infos[m.blocks[i]!]!.shape;
  const placed = new Uint8Array(m.volume);
  const cell = (x: number, y: number, z: number) => x + z * gx + y * gx * gz;
  /** Model index of a grid cell, or -1 outside the model. */
  const mi = (x: number, y: number, z: number) => {
    const X = x - MARGIN,
      Z = z - MARGIN;
    if (X < 0 || Z < 0 || X >= sx || Z >= sz || y < 0 || y >= sy) return -1;
    return m.index(X, y, Z);
  };
  const shape = (x: number, y: number, z: number) => {
    const i = mi(x, y, z);
    return i >= 0 && placed[i] ? shapeAt[i]! : "air";
  };
  const passable = (x: number, y: number, z: number) => {
    if (y < g0) return false; // terrain
    return WALK_THROUGH.has(shape(x, y, z));
  };
  const floorUnder = (x: number, y: number, z: number) => y - 1 < g0 || !WALK_THROUGH.has(shape(x, y - 1, z));
  const climbable = (x: number, y: number, z: number) => CLIMB.has(shape(x, y, z));
  const stand = (x: number, y: number, z: number) =>
    y >= g0 &&
    y < gy &&
    passable(x, y, z) &&
    passable(x, y + 1, z) &&
    (floorUnder(x, y, z) || climbable(x, y, z));

  const walk = new Uint8Array(gx * gy * gz);
  const reachWalk = () => {
    walk.fill(0);
    const q: number[] = [];
    const push = (x: number, y: number, z: number) => {
      const c = cell(x, y, z);
      if (!walk[c]) {
        walk[c] = 1;
        q.push(x, y, z);
      }
    };
    for (let x = 0; x < gx; x++)
      for (let z = 0; z < gz; z++)
        if (x === 0 || z === 0 || x === gx - 1 || z === gz - 1) if (stand(x, g0, z)) push(x, g0, z);
    for (let h = 0; h < q.length; h += 3) {
      const x = q[h]!,
        y = q[h + 1]!,
        z = q[h + 2]!;
      // ladders: up and down the column
      if (climbable(x, y, z) || climbable(x, y + 1, z)) {
        if (y + 1 < gy && passable(x, y + 2, z) && stand(x, y + 1, z)) push(x, y + 1, z);
        if (y - 1 >= g0 && stand(x, y - 1, z)) push(x, y - 1, z);
      }
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx,
          nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= gx || nz >= gz) continue;
        if (stand(nx, y, nz)) {
          push(nx, y, nz);
          continue;
        }
        // jump one block up (not onto fences and walls)
        if (stand(nx, y + 1, nz) && passable(x, y + 2, z) && !TALL.has(shape(nx, y, nz))) {
          push(nx, y + 1, nz);
          continue;
        }
        // walk off an edge and fall
        if (passable(nx, y, nz) && passable(nx, y + 1, nz)) {
          for (let fy = y - 1; fy >= g0; fy--) {
            if (!passable(nx, fy, nz)) break;
            if (stand(nx, fy, nz)) {
              push(nx, fy, nz);
              break;
            }
          }
        }
      }
    }
  };

  /** Clear line from (ax,ay,az) to the inside of target cell t (grid coords), through built blocks. */
  const clear = (
    ax: number,
    ay: number,
    az: number,
    tx: number,
    ty: number,
    tz: number,
    px: number,
    py: number,
    pz: number,
  ) => {
    const dx = px - ax,
      dy = py - ay,
      dz = pz - az;
    const len = Math.hypot(dx, dy, dz);
    const n = Math.ceil(len / 0.1);
    for (let k = 1; k < n; k++) {
      const x = Math.floor(ax + (dx * k) / n),
        y = Math.floor(ay + (dy * k) / n),
        z = Math.floor(az + (dz * k) / n);
      if (x === tx && y === ty && z === tz) return true;
      if (y < g0) return false;
      if (!SEE_THROUGH.has(shape(x, y, z))) return false;
    }
    return true;
  };
  const reachable = (tx: number, ty: number, tz: number) => {
    const r = Math.ceil(REACH) + 1;
    for (let y = Math.max(g0, ty - r - 1); y <= Math.min(gy - 1, ty + r); y++)
      for (let z = Math.max(0, tz - r); z <= Math.min(gz - 1, tz + r); z++)
        for (let x = Math.max(0, tx - r); x <= Math.min(gx - 1, tx + r); x++) {
          if (!walk[cell(x, y, z)]) continue;
          // the builder cannot stand where the block goes
          if (x === tx && z === tz && (y === ty || y + 1 === ty)) continue;
          const ex = x + 0.5,
            ey = y + EYE,
            ez = z + 0.5;
          const nx = Math.max(tx, Math.min(ex, tx + 1)),
            ny = Math.max(ty, Math.min(ey, ty + 1)),
            nz = Math.max(tz, Math.min(ez, tz + 1));
          if (Math.hypot(nx - ex, ny - ey, nz - ez) > REACH) continue;
          const pts: Array<[number, number, number]> = [
            [tx + 0.5, ty + 0.5, tz + 0.5],
            [nx + (tx + 0.5 - nx) * 0.1, ny + (ty + 0.5 - ny) * 0.1, nz + (tz + 0.5 - nz) * 0.1],
          ];
          for (const [px, py, pz] of pts) if (clear(ex, ey, ez, tx, ty, tz, px, py, pz)) return true;
        }
    return false;
  };

  let unreachable = 0,
    unreachSteps = 0,
    travel = 0,
    swings = 0,
    firstUnreach = -1;
  const byStage = new Map<string, number>();
  const det: string[] = [];
  let prev: [number, number, number] | null = null;
  let lastDir = 0;
  let maxH = 0;
  for (const s of plan.steps) {
    reachWalk();
    let bad = 0;
    let badTop = 0;
    for (const i of s.blocks) {
      const c = m.coords(i);
      if (!reachable(c.x + MARGIN, c.y, c.z + MARGIN)) {
        bad++;
        badTop = Math.max(badTop, c.y - g0);
      }
      placed[i] = 1;
    }
    let cx = 0,
      cy = 0,
      cz = 0;
    for (const i of s.blocks) {
      const c = m.coords(i);
      cx += c.x;
      cy += c.y;
      cz += c.z;
      maxH = Math.max(maxH, c.y - g0);
    }
    const n = s.blocks.length;
    const cen: [number, number, number] = [cx / n, cy / n, cz / n];
    if (prev) {
      travel += Math.hypot(cen[0] - prev[0], cen[2] - prev[2]);
      const dy = cen[1] - prev[1];
      const dir = dy > 2.5 ? 1 : dy < -2.5 ? -1 : 0;
      if (dir && lastDir && dir !== lastDir) swings++;
      if (dir) lastDir = dir;
    }
    prev = cen;
    if (bad) {
      unreachable += bad;
      unreachSteps++;
      if (firstUnreach < 0) firstUnreach = s.index;
      byStage.set(s.stage, (byStage.get(s.stage) ?? 0) + bad);
      if (detail) {
        const names = new Map<string, number>();
        for (const i of s.blocks) {
          const k = m.palette[m.blocks[i]!]!.name.replace("minecraft:", "");
          names.set(k, (names.get(k) ?? 0) + 1);
        }
        const what = [...names]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([k, v]) => `${k}×${v}`)
          .join(", ");
        det.push(
          `  step ${String(s.index + 1).padStart(4)} ${s.stage.padEnd(10)} y+${s.layer - g0}${s.layerTo !== undefined ? `..${s.layerTo - g0}` : ""}  ${bad}/${n} out of reach (top y+${badTop})  ${what}${s.scaffold ? "  [scaffold]" : ""}${s.deferred ? "  [deferred]" : ""}`,
        );
      }
    }
  }
  const sizes = plan.steps.map((s) => s.blocks.length).sort((a, b) => a - b);
  return {
    id,
    blocks: plan.totalBlocks,
    steps: plan.steps.length,
    median: sizes[Math.floor(sizes.length / 2)] ?? 0,
    singles: sizes.filter((v) => v === 1).length,
    unreachable,
    unreachSteps,
    byStage,
    travel: Math.round(travel),
    swings,
    firstUnreach,
    heights: maxH,
    detail: det,
  };
}

const args = process.argv.slice(2);
const detail = args.includes("--detail");
const ids = args.filter((a) => !a.startsWith("--"));
/** An argument with a file extension is a schematic file to import; anything else is a catalogue id. */
const files = ids.filter((a) => /.(litematic|schem|schematic|nbt|kbuild)$/i.test(a));
const list: Array<{ id: string; model: () => VoxelModel }> = [
  ...files.map((f) => ({
    id: basename(f),
    model: () => importBytes(new Uint8Array(readFileSync(f)), f).model,
  })),
  ...(ids.length > files.length || !ids.length
    ? CATALOG.filter((c) => !ids.length || ids.includes(c.id)).map((c) => ({
        id: c.id,
        model: () => buildEntry(c).model,
      }))
    : []),
];
console.log(
  "build               blocks steps med 1blk  height  out-of-reach (steps)   by stage                         travel swings",
);
for (const e of list) {
  const r = analyse(e.id, e.model(), detail);
  const pct = ((100 * r.unreachable) / r.blocks).toFixed(1);
  const st = [...r.byStage].map(([k, v]) => `${k} ${v}`).join(", ");
  console.log(
    `${r.id.padEnd(19)} ${String(r.blocks).padStart(6)} ${String(r.steps).padStart(5)} ${String(r.median).padStart(3)} ${String(r.singles).padStart(4)}  ${String(r.heights).padStart(6)}  ${String(r.unreachable).padStart(5)} ${pct.padStart(5)}% (${String(r.unreachSteps).padStart(3)})   ${st.padEnd(32)} ${String(r.travel).padStart(6)} ${String(r.swings).padStart(5)}`,
  );
  if (detail) for (const d of r.detail) console.log(d);
}
