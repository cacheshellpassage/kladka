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
    const panes = plan.steps.filter((st) => st.stage === "openings");
    expect(panes).toHaveLength(1);
    expect(panes[0]!.blocks).toHaveLength(4);
    expect(panes[0]!.pillars).toBeUndefined();
  });

  it("places a ladder column on an existing wall in one step", () => {
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
    const ladders = plan.steps.filter((s) => s.stage === "interior");
    expect(ladders).toHaveLength(1);
    expect(ladders[0]!.blocks).toHaveLength(5);
    expect(ladders[0]!.layerTo).toBe(5);
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
