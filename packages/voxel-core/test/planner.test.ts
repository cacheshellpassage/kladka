import { describe, expect, it } from "vitest";
import {
  STAGES,
  blockInfo,
  finalizeConnections,
  materialList,
  planBuild,
  roleFromCode,
  state,
  estimate,
  layerGrid,
  minecraftJava,
  type BuildPlan,
  type VoxelModel,
} from "../src";
import { cottage, newTestModel } from "./fixtures";

const FACING: Record<string, [number, number, number]> = {
  north: [0, 0, -1],
  south: [0, 0, 1],
  east: [1, 0, 0],
  west: [-1, 0, 0],
};
const N6: Array<[number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** Re-simulates the plan and checks every block is placeable when its step comes. */
export function verifyPlacement(m: VoxelModel, plan: BuildPlan): string[] {
  const errors: string[] = [];
  const placed = new Uint8Array(m.volume);
  for (const step of plan.steps) {
    for (const i of step.blocks) {
      const c = m.coords(i);
      const st = m.palette[m.blocks[i]!]!;
      const info = blockInfo(st.name);
      const at = (dx: number, dy: number, dz: number) =>
        m.inBounds(c.x + dx, c.y + dy, c.z + dz) ? placed[m.index(c.x + dx, c.y + dy, c.z + dz)] === 1 : true;
      let ok: boolean;
      if (step.scaffold) ok = true;
      else if (info.shape === "door" && st.props.half === "upper") ok = at(0, -1, 0);
      else if (info.attach === "below" || info.gravity) ok = c.y <= plan.groundY || at(0, -1, 0);
      else if (info.attach === "back") {
        const o = FACING[st.props.facing ?? "north"]!;
        ok = at(-o[0], -o[1], -o[2]);
      } else if (info.attach === "hanging" && st.props.hanging === "true") ok = at(0, 1, 0);
      else
        ok =
          c.y <= plan.groundY ||
          N6.some(([dx, dy, dz]) => {
            const nx = c.x + dx,
              ny = c.y + dy,
              nz = c.z + dz;
            return m.inBounds(nx, ny, nz) && placed[m.index(nx, ny, nz)] === 1;
          });
      if (!ok) errors.push(`${st.name} at ${c.x},${c.y},${c.z} (step ${step.index}) has no support`);
      placed[i] = 1;
    }
  }
  return errors;
}

describe("planner on the test cottage", () => {
  const m = cottage();
  const plan = planBuild(m);

  it("places every block exactly once", () => {
    const seen = new Set<number>();
    for (const s of plan.steps)
      for (const i of s.blocks) {
        expect(seen.has(i)).toBe(false);
        seen.add(i);
      }
    expect(seen.size).toBe(m.countBlocks());
    expect(plan.totalBlocks).toBe(m.countBlocks());
  });

  it("orders stages foundation → … → decor", () => {
    const order = plan.stages.map((s) => STAGES.indexOf(s.id));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(plan.stages[0]!.id).toBe("foundation");
  });

  it("builds frame, walls and windows together, floor by floor", () => {
    const shell = plan.stages.find((s) => s.id === "shell")!;
    for (const [x, y, z] of [
      [1, 2, 1], // oak log corner
      [2, 2, 1], // planks
      [4, 2, 1], // glass pane
    ] as const) {
      const k = plan.stepOf[m.index(x, y, z)]!;
      expect(k).toBeGreaterThanOrEqual(shell.stepStart);
      expect(k).toBeLessThan(shell.stepEnd);
    }
    // nothing of a higher layer of the shell comes before the window of layer 2
    const pane = plan.stepOf[m.index(4, 2, 1)]!;
    for (const s of plan.steps.slice(shell.stepStart, pane)) expect(s.layer).toBeLessThanOrEqual(2);
  });

  it("every step is buildable when reached (supports before attachments)", () => {
    expect(verifyPlacement(m, plan)).toEqual([]);
  });

  it("classifies roles sensibly", () => {
    const roleAt = (x: number, y: number, z: number) => roleFromCode(plan.roles[m.index(x, y, z)]!);
    expect(roleAt(3, 0, 3)).toBe("foundation"); // cobblestone floor
    expect(roleAt(1, 2, 1)).toBe("frame"); // oak log corner
    expect(roleAt(2, 2, 1)).toBe("walls"); // planks
    expect(roleAt(4, 2, 1)).toBe("openings"); // glass pane
    expect(roleAt(3, 5, 0)).toBe("roof"); // eave stairs
    expect(roleAt(3, 1, 3)).toBe("interior"); // chest
    expect(roleAt(3, 2, 8)).toBe("lighting"); // wall torch
  });

  it("puts the upper door half into the same step as the lower half", () => {
    const lower = plan.stepOf[m.index(4, 1, 7)]!;
    const upper = plan.stepOf[m.index(4, 2, 7)]!;
    expect(lower).toBeGreaterThanOrEqual(0);
    expect(upper).toBe(lower);
  });

  it("defers the hanging lantern until the ceiling exists", () => {
    const lantern = plan.stepOf[m.index(5, 3, 5)]!;
    const ceiling = plan.stepOf[m.index(5, 4, 5)]!;
    expect(lantern).toBeGreaterThan(ceiling);
  });

  it("keeps steps within the size limit", () => {
    for (const s of plan.steps) expect(s.blocks.length).toBeLessThanOrEqual(48 * 2);
  });

  it("produces a 2D layer grid", () => {
    const g = layerGrid(m, plan, 1);
    expect(g.width).toBe(m.size.x);
    expect(g.cells.filter((c) => c !== 0).length).toBeGreaterThan(10);
  });
});

describe("planner edge cases", () => {
  it("flags floating blocks for scaffolding", () => {
    const m = newTestModel(3, 6, 3);
    m.set(1, 0, 1, state("stone"));
    m.set(1, 5, 1, state("stone")); // floating
    const plan = planBuild(m);
    expect(plan.steps.some((s) => s.scaffold)).toBe(true);
    expect(plan.warnings.length).toBe(1);
  });

  it("explicit roles from generators win over heuristics", () => {
    const m = newTestModel(3, 3, 3);
    for (let x = 0; x < 3; x++) m.set(x, 0, 0, state("stone"));
    m.roles = new Uint8Array(m.volume);
    m.roles[m.index(2, 0, 0)] = 7; // decor
    const plan = planBuild(m);
    expect(roleFromCode(plan.roles[m.index(2, 0, 0)]!)).toBe("decor");
    expect(plan.stages.map((s) => s.id)).toEqual(["foundation", "decor"]);
  });

  it("builds each pillar bottom-up in one step instead of one block per layer", () => {
    const m = newTestModel(12, 6, 12);
    m.roles = new Uint8Array(m.volume);
    const posts: Array<[number, number]> = [
      [1, 1],
      [10, 1],
      [1, 10],
      [10, 10],
    ];
    for (const [x, z] of posts)
      for (let y = 0; y < 5; y++) {
        m.set(x, y, z, state("oak_log"));
        m.roles[m.index(x, y, z)] = 2; // frame
      }
    const plan = planBuild(m);
    expect(verifyPlacement(m, plan)).toEqual([]);
    // four identical posts are one step: "4 pillars, each bottom-up"
    expect(plan.steps).toHaveLength(1);
    const s = plan.steps[0]!;
    expect(s.blocks).toHaveLength(20);
    expect(s.pillars).toBe(4);
    expect([s.layer, s.layerTo]).toEqual([0, 4]);
    for (let k = 0; k < 4; k++) {
      // one pillar after another, bottom-up inside each
      const part = s.blocks.slice(k * 5, k * 5 + 5).map((i) => m.coords(i));
      expect(part.map((c) => c.y)).toEqual([0, 1, 2, 3, 4]);
      expect(new Set(part.map((c) => `${c.x},${c.z}`)).size).toBe(1);
    }
    expect(plan.stages[0]!.layers).toEqual([{ y: 0, stepStart: 0, stepEnd: 1 }]);
  });

  it("joins small steps of one block even when their states differ", () => {
    const m = newTestModel(9, 4, 9);
    m.roles = new Uint8Array(m.volume);
    for (let x = 0; x < 9; x++)
      for (let z = 0; z < 9; z++) {
        m.set(x, 0, z, state("stone"));
        m.roles[m.index(x, 0, z)] = 1; // foundation
      }
    // panes on two different walls have different connection states
    m.set(1, 1, 4, state("glass_pane", { north: "true", south: "true" }));
    m.set(7, 1, 4, state("glass_pane", { north: "true", south: "true" }));
    m.set(4, 1, 1, state("glass_pane", { east: "true", west: "true" }));
    m.set(4, 1, 7, state("glass_pane", { east: "true", west: "true" }));
    for (const [x, z] of [
      [1, 4],
      [7, 4],
      [4, 1],
      [4, 7],
    ] as Array<[number, number]>)
      m.roles[m.index(x, 1, z)] = 4; // openings
    const plan = planBuild(m);
    expect(verifyPlacement(m, plan)).toEqual([]);
    const panes = plan.steps.filter((st) => st.stage === "shell");
    expect(panes).toHaveLength(1);
    expect(panes[0]!.blocks).toHaveLength(4);
    expect(panes[0]!.pillars).toBeUndefined();
  });

  it("builds a ladder together with the wall it hangs on, not after the roof", () => {
    const m = newTestModel(5, 7, 5);
    m.roles = new Uint8Array(m.volume);
    for (let y = 0; y < 6; y++) {
      m.set(2, y, 2, state("stone_bricks"));
      m.roles[m.index(2, y, 2)] = 3; // walls
    }
    for (let y = 1; y < 6; y++) {
      m.set(2, y, 3, state("ladder", { facing: "south" }));
      m.roles[m.index(2, y, 3)] = 6; // interior
    }
    const plan = planBuild(m);
    expect(verifyPlacement(m, plan)).toEqual([]);
    // the ladder is the way up, so it grows with its wall: one pillar step "wall + ladder", bottom-up
    const ladderSteps = new Set([1, 2, 3, 4, 5].map((y) => plan.stepOf[m.index(2, y, 3)]!));
    expect(ladderSteps.size).toBe(1);
    const step = plan.steps[[...ladderSteps][0]!]!;
    expect(step.stage).toBe("shell");
    expect(step.blocks).toHaveLength(10);
    expect([step.layer, step.layerTo]).toEqual([1, 5]);
  });

  it("does not lift an attachment above its support", () => {
    // torches on a wall that is built in the same stage, layer by layer: the wall comes first
    const m = newTestModel(5, 5, 5);
    for (let y = 0; y < 4; y++) m.set(2, y, 2, state("stone_bricks"));
    for (let y = 1; y < 4; y++) m.set(2, y, 3, state("wall_torch", { facing: "south" }));
    const plan = planBuild(m);
    expect(verifyPlacement(m, plan)).toEqual([]);
  });

  it("joins single blocks of one kind on one layer into one step", () => {
    const m = newTestModel(16, 3, 16);
    m.roles = new Uint8Array(m.volume);
    for (const [x, z] of [
      [0, 0],
      [15, 0],
      [0, 15],
      [15, 15],
    ] as const) {
      m.set(x, 0, z, state("lantern"));
      m.roles[m.index(x, 0, z)] = 7; // decor
    }
    const plan = planBuild(m);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]!.blocks).toHaveLength(4);
  });

  /** A stone floor with one L-shaped piece of wall per entry: [x, z, mirrored along x, stairs facing]. */
  function cornerPieces(pieces: Array<[number, number, boolean, string]>): VoxelModel {
    const m = newTestModel(20, 3, 20);
    m.roles = new Uint8Array(m.volume);
    for (let x = 0; x < 20; x++)
      for (let z = 0; z < 20; z++) {
        m.set(x, 0, z, state("stone"));
        m.roles[m.index(x, 0, z)] = 1; // foundation
      }
    for (const [x, z, flip, facing] of pieces) {
      const dx = flip ? -1 : 1;
      const cells: Array<[number, number, ReturnType<typeof state>]> = [
        [x, z, state("stone_bricks")],
        [x + dx, z, state("stone_bricks")],
        [x + 2 * dx, z, state("stone_brick_stairs", { facing, half: "bottom" })],
        [x, z + 1, state("stone_bricks")],
        [x, z + 2, state("cobblestone")],
      ];
      for (const [cx, cz, st] of cells) {
        m.set(cx, 1, cz, st);
        m.roles[m.index(cx, 1, cz)] = 3; // walls
      }
    }
    return m;
  }

  it("builds identical parts of a symmetric build in one step", () => {
    const m = cornerPieces([
      [1, 1, false, "east"],
      [9, 1, false, "east"],
      [1, 12, false, "east"],
    ]);
    const plan = planBuild(m);
    expect(verifyPlacement(m, plan)).toEqual([]);
    const walls = plan.steps.filter((s) => s.stage === "shell");
    expect(walls).toHaveLength(1);
    expect(walls[0]!.blocks).toHaveLength(15);
    expect(walls[0]!.copies).toBe(3);
    expect(walls[0]!.mirrored).toBeUndefined();
    expect(walls[0]!.pillars).toBeUndefined();
    // every block is still placed exactly once
    expect(new Set(plan.steps.flatMap((s) => s.blocks)).size).toBe(plan.totalBlocks);
    expect(plan.stages.find((s) => s.id === "shell")!.stepEnd).toBe(plan.steps.length);
  });

  it("treats a mirrored part as the same part, stairs included", () => {
    // the mirror image has its stairs turned the other way: still the same piece of work
    const m = cornerPieces([
      [1, 1, false, "east"],
      [18, 1, true, "west"],
    ]);
    const walls = planBuild(m).steps.filter((s) => s.stage === "shell");
    expect(walls).toHaveLength(1);
    expect(walls[0]!.copies).toBe(2);
    expect(walls[0]!.mirrored).toBe(true);

    // same outline, but the stairs are not mirrored: a different part, the steps stay apart
    const odd = cornerPieces([
      [1, 1, false, "east"],
      [18, 1, true, "east"],
    ]);
    const apart = planBuild(odd).steps.filter((s) => s.stage === "shell");
    expect(apart).toHaveLength(2);
    expect(apart.every((s) => s.copies === undefined)).toBe(true);
  });

  it("keeps different parts and parts on different layers apart", () => {
    const m = cornerPieces([[1, 1, false, "east"]]);
    // an L of the same outline in another material, and a straight piece
    for (const [x, z] of [
      [10, 10],
      [11, 10],
      [12, 10],
      [10, 11],
      [10, 12],
    ] as const) {
      m.set(x, 1, z, state("oak_planks"));
      m.roles![m.index(x, 1, z)] = 3;
    }
    const walls = planBuild(m).steps.filter((s) => s.stage === "shell");
    expect(walls).toHaveLength(2);
    expect(walls.some((s) => s.copies !== undefined)).toBe(false);
  });

  it("never merges a part ahead of what holds it (random symmetric builds)", () => {
    // deterministic pseudo-random blobs, mirrored along x: many identical parts, some hanging on others
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    let merged = 0;
    for (let round = 0; round < 40; round++) {
      const m = newTestModel(24, 6, 12);
      m.roles = new Uint8Array(m.volume);
      const put = (x: number, y: number, z: number, name: string) => {
        for (const px of [x, 23 - x]) {
          m.set(px, y, z, state(name));
          m.roles![m.index(px, y, z)] = 3; // walls
        }
      };
      for (let n = 0; n < 60; n++) {
        const x = Math.floor(rnd() * 12);
        const z = Math.floor(rnd() * 12);
        const y = Math.floor(rnd() * 5);
        const len = 1 + Math.floor(rnd() * 4);
        const name = rnd() < 0.5 ? "stone_bricks" : "oak_planks";
        for (let k = 0; k < len && x + k < 12; k++) put(x + k, y, z, name);
      }
      const plan = planBuild(m, { maxStepBlocks: 4 + (round % 5) * 3 });
      expect(verifyPlacement(m, plan)).toEqual([]);
      expect(plan.steps.flatMap((s) => s.blocks)).toHaveLength(plan.totalBlocks);
      merged += plan.steps.filter((s) => s.copies).length;
    }
    expect(merged).toBeGreaterThan(20);
  });

  it("handles an empty model", () => {
    const plan = planBuild(newTestModel(2, 2, 2));
    expect(plan.steps).toEqual([]);
    expect(plan.totalBlocks).toBe(0);
  });

  it("is fast enough for a 64×40×64 hollow box", () => {
    const m = newTestModel(64, 40, 64);
    for (let y = 0; y < 40; y++)
      for (let z = 0; z < 64; z++)
        for (let x = 0; x < 64; x++)
          if (x === 0 || z === 0 || x === 63 || z === 63 || y === 0 || y === 39)
            m.set(x, y, z, state("stone_bricks"));
    const t = performance.now();
    const plan = planBuild(m);
    const ms = performance.now() - t;
    expect(plan.totalBlocks).toBe(m.countBlocks());
    expect(verifyPlacement(m, plan)).toEqual([]);
    expect(ms).toBeLessThan(8000);
  });
});

describe("materials and estimates", () => {
  it("counts items correctly (double slabs, doors, beds, wall torches, potted plants)", () => {
    const m = newTestModel(4, 3, 4);
    m.set(0, 0, 0, state("oak_slab", { type: "double" }));
    m.set(1, 0, 0, state("oak_slab", { type: "bottom" }));
    m.set(2, 0, 0, state("oak_door", { half: "lower", facing: "north" }));
    m.set(2, 1, 0, state("oak_door", { half: "upper", facing: "north" }));
    m.set(0, 0, 2, state("red_bed", { part: "foot", facing: "north" }));
    m.set(0, 0, 1, state("red_bed", { part: "head", facing: "north" }));
    m.set(3, 1, 3, state("wall_torch", { facing: "north" }));
    m.set(3, 0, 3, state("potted_poppy"));
    const lines = materialList(m);
    const get = (id: string) => lines.find((l) => l.item === id)?.count;
    expect(get("oak_slab")).toBe(3);
    expect(get("oak_door")).toBe(1);
    expect(get("red_bed")).toBe(1);
    expect(get("torch")).toBe(1);
    expect(get("flower_pot")).toBe(1);
    expect(get("poppy")).toBe(1);
    expect(lines.find((l) => l.item === "red_bed")?.stackSize).toBe(1);
  });

  it("computes stacks and shulkers", () => {
    const m = newTestModel(10, 10, 20);
    const p = m.intern(state("cobblestone"));
    for (let i = 0; i < 2000; i++) m.blocks[i] = p;
    const line = materialList(m)[0]!;
    expect(line.count).toBe(2000);
    expect(line.stacks).toBe(31);
    expect(line.remainder).toBe(16);
    expect(line.shulkers).toBeCloseTo(2000 / 1728);
  });

  it("estimates difficulty and time in a sane range", () => {
    const m = cottage();
    const plan = planBuild(m);
    const e = estimate(m, plan, materialList(m).length);
    expect(e.difficulty).toBeGreaterThanOrEqual(1);
    expect(e.difficulty).toBeLessThanOrEqual(3);
    expect(e.minutes).toBeGreaterThanOrEqual(5);
  });
});

describe("plot, decor and long deferred steps", () => {
  /** A 12×12 lawn (dirt under grass) with a 4×4 stone hut and flowers on the lawn. */
  function plot(): VoxelModel {
    const m = newTestModel(12, 6, 12);
    for (let x = 0; x < 12; x++)
      for (let z = 0; z < 12; z++) {
        m.set(x, 0, z, state("dirt"));
        m.set(x, 1, z, state("grass_block"));
      }
    for (let x = 4; x < 8; x++)
      for (let z = 4; z < 8; z++) {
        m.set(x, 1, z, state("cobblestone"));
        for (let y = 2; y < 5; y++)
          if (x === 4 || x === 7 || z === 4 || z === 7) m.set(x, y, z, state("stone_bricks"));
        m.set(x, 5, z, state("stone_bricks"));
      }
    m.set(1, 2, 1, state("poppy"));
    m.set(2, 2, 1, state("dandelion"));
    m.set(10, 2, 10, state("poppy"));
    return m;
  }

  it("puts the ground of the plot into the first stage, and the soil under the hut too", () => {
    const m = plot();
    const plan = planBuild(m);
    expect(verifyPlacement(m, plan)).toEqual([]);
    expect(plan.stages[0]!.id).toBe("site");
    const site = plan.stages[0]!;
    expect(site.blockCount).toBe(12 * 12 * 2 - 16); // all the soil, except where the cobblestone floor is
    expect(roleFromCode(plan.roles[m.index(5, 0, 5)]!)).toBe("site"); // dirt under the hut
    expect(roleFromCode(plan.roles[m.index(5, 1, 5)]!)).toBe("foundation"); // the floor itself
    // the hut does not wait for the lawn around it: nothing of the building is in the site stage
    for (const s of plan.steps.slice(site.stepStart, site.stepEnd))
      for (const i of s.blocks) expect(roleFromCode(plan.roles[i]!)).toBe("site");
  });

  it("keeps a grass roof part of the building", () => {
    const m = plot();
    for (let x = 4; x < 8; x++) for (let z = 4; z < 8; z++) m.set(x, 5, z, state("grass_block"));
    const plan = planBuild(m);
    expect(roleFromCode(plan.roles[m.index(5, 5, 5)]!)).not.toBe("site");
  });

  it("asks for dirt instead of grass blocks", () => {
    const items = materialList(plot());
    expect(items.find((l) => l.item.endsWith("grass_block"))).toBeUndefined();
  });

  it("places flowers of one spot in one step and says which layers it spans", () => {
    const m = plot();
    m.set(2, 3, 2, state("lantern")); // on nothing… hangs from nothing: placed on a block below
    m.set(2, 2, 2, state("oak_fence"));
    const plan = planBuild(m);
    expect(verifyPlacement(m, plan)).toEqual([]);
    const near = plan.stepOf[m.index(1, 2, 1)]!;
    expect(plan.stepOf[m.index(2, 2, 1)]).toBe(near);
    expect(plan.stepOf[m.index(2, 3, 2)]).toBe(near);
    expect(plan.steps[near]!.layerMax).toBe(3);
    expect(plan.steps[near]!.layerTo).toBeUndefined(); // not a pillar
  });

  it("cuts a long list of blocks that waited for support into steps of at most 48", () => {
    // 64 lanterns hang from a ceiling one layer above them: they wait for it and come right after it
    const m = newTestModel(10, 7, 10);
    m.roles = new Uint8Array(m.volume);
    const set = (x: number, y: number, z: number, st: ReturnType<typeof state>) => {
      m.set(x, y, z, st);
      m.roles![m.index(x, y, z)] = 3; // walls
    };
    for (const [x, z] of [
      [0, 0],
      [9, 0],
      [0, 9],
      [9, 9],
    ] as const)
      for (let y = 0; y < 5; y++) set(x, y, z, state("stone_bricks"));
    for (let x = 0; x < 10; x++) for (let z = 0; z < 10; z++) set(x, 5, z, state("stone_bricks"));
    for (let x = 1; x < 9; x++)
      for (let z = 1; z < 9; z++) set(x, 4, z, state("lantern", { hanging: "true" }));
    const plan = planBuild(m);
    expect(verifyPlacement(m, plan)).toEqual([]);
    const waited = plan.steps.filter((st) => st.deferred);
    expect(waited.reduce((n, st) => n + st.blocks.length, 0)).toBe(64);
    expect(waited.length).toBeGreaterThan(1);
    for (const st of plan.steps) expect(st.blocks.length).toBeLessThanOrEqual(48);
  });
});

describe("connections", () => {
  it("connects fences and computes stair corners", () => {
    const m = newTestModel(5, 2, 5);
    m.set(1, 0, 1, state("oak_fence"));
    m.set(2, 0, 1, state("oak_fence"));
    m.set(3, 0, 1, state("stone"));
    m.set(1, 0, 3, state("oak_stairs", { facing: "east" }));
    m.set(1, 0, 4, state("oak_stairs", { facing: "north" }));
    finalizeConnections(m);
    expect(m.get(1, 0, 1).props.east).toBe("true");
    expect(m.get(1, 0, 1).props.west).toBe("false");
    expect(m.get(2, 0, 1).props.east).toBe("true"); // connects to solid stone
    expect(m.get(1, 0, 4).props.shape).not.toBe("straight");
    expect(minecraftJava.shape(m.get(1, 0, 4)).boxes.length).toBeGreaterThan(1);
  });
});
