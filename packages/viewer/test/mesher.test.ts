import { describe, expect, it } from "vitest";
import { VoxelModel, minecraftJava, state, type TexPattern } from "@kladka/voxel-core";
import { buildPaletteRender } from "../src/palette-render";
import { meshChunk, nonEmptyChunks } from "../src/mesher";
import { generateTexture, TEX } from "../src/textures";

function model(): VoxelModel {
  return new VoxelModel({ x: 4, y: 3, z: 4 }, { materialOf: minecraftJava.materialOf });
}

function quads(
  m: VoxelModel,
  stepOf: Int32Array | null = null,
  clip: Parameters<typeof meshChunk>[0]["clip"] = null,
) {
  const { table } = buildPaletteRender(m.palette, null);
  const mesh = meshChunk({ model: m, table, stepOf, roles: null, clip }, 0, 0, 0);
  const count = (p?: { indices: Uint32Array }) => (p ? p.indices.length / 6 : 0);
  return {
    opaque: count(mesh.opaque),
    cutout: count(mesh.cutout),
    translucent: count(mesh.translucent),
    mesh,
  };
}

describe("greedy mesher", () => {
  it("emits 6 faces for a single cube", () => {
    const m = model();
    m.set(1, 1, 1, state("stone"));
    expect(quads(m).opaque).toBe(6);
  });

  it("merges coplanar faces of identical neighbours", () => {
    const m = model();
    m.set(0, 0, 0, state("stone"));
    m.set(1, 0, 0, state("stone"));
    expect(quads(m).opaque).toBe(6);
  });

  it("keeps the shared face when the neighbour is built later (step-aware culling)", () => {
    const m = model();
    m.set(0, 0, 0, state("stone"));
    m.set(1, 0, 0, state("stone"));
    const stepOf = new Int32Array(m.volume).fill(-1);
    stepOf[m.index(0, 0, 0)] = 0;
    stepOf[m.index(1, 0, 0)] = 1;
    // A: 6 faces (east stays because B comes later), B: 5 faces; nothing merges across steps
    expect(quads(m, stepOf).opaque).toBe(11);
  });

  it("treats clipped blocks as air so cut faces are closed", () => {
    const m = model();
    m.set(0, 1, 0, state("stone"));
    m.set(0, 2, 0, state("stone"));
    expect(quads(m).opaque).toBe(6);
    expect(quads(m, null, { min: [0, 0, 0], max: [4, 2, 4] }).opaque).toBe(6);
  });

  it("darkens the bottom edge of blocks standing on the ground", () => {
    const m = model();
    m.set(0, 0, 0, state("stone"));
    m.set(0, 1, 0, state("stone"));
    // the ground occludes the lowest corners, so the two side faces no longer merge
    expect(quads(m).opaque).toBe(10);
  });

  it("routes glass to the translucent pass and culls glass-glass faces", () => {
    const m = model();
    m.set(0, 0, 0, state("glass"));
    m.set(1, 0, 0, state("glass"));
    const q = quads(m);
    expect(q.translucent).toBe(6);
    expect(q.opaque).toBe(0);
  });

  it("emits boxes for shaped blocks and planes for plants", () => {
    const m = model();
    m.set(0, 0, 0, state("oak_stairs", { facing: "north", half: "bottom", shape: "straight" }));
    m.set(2, 0, 0, state("poppy"));
    const q = quads(m);
    expect(q.opaque).toBe(12); // 2 boxes × 6 faces
    expect(q.cutout).toBe(4); // 2 planes × 2 sides
  });

  it("culls box faces against opaque neighbours", () => {
    const m = model();
    m.set(0, 0, 0, state("stone"));
    m.set(0, 1, 0, state("oak_slab", { type: "bottom" }));
    // stone: 5 faces (top hidden by nothing: slab is not a full cube → stone top stays) = 6; slab: bottom culled = 5
    expect(quads(m).opaque).toBe(11);
  });

  it("lists non-empty chunks only", () => {
    const m = new VoxelModel({ x: 70, y: 10, z: 40 });
    m.set(65, 0, 1, state("stone"));
    expect(nonEmptyChunks(m)).toEqual([[64, 0, 0]]);
  });
});

describe("procedural textures", () => {
  const patterns: TexPattern[] = [
    "plain",
    "noise",
    "planks",
    "log",
    "log_top",
    "bricks",
    "stone_bricks",
    "cobble",
    "stone",
    "tiles",
    "polished",
    "smooth",
    "leaves",
    "glass",
    "wool",
    "sand",
    "grass_top",
    "grass_side",
    "dirt",
    "bookshelf",
    "door",
    "trapdoor",
    "crafting_top",
    "crafting_side",
    "furnace",
    "chest",
    "glow",
    "water",
    "lava",
    "metal",
    "thatch",
    "pillar",
    "pillar_top",
    "lamp",
    "concrete",
    "terracotta",
    "ore",
    "scaffold",
    "plant",
    "flower",
    "torch",
    "ladder",
    "rail",
    "chiseled",
    "path_top",
    "farmland",
    "bars",
    "barrel_top",
    "barrel_side",
    "sandstone",
    "mosaic",
    "shingles",
  ];
  it("generates deterministic 16×16 RGBA data for every pattern", () => {
    for (const p of patterns) {
      const a = generateTexture({ pattern: p, color: 0x8a6a4a, accent: 0x5a4a3a });
      const b = generateTexture({ pattern: p, color: 0x8a6a4a, accent: 0x5a4a3a });
      expect(a.length).toBe(TEX * TEX * 4);
      expect(Array.from(a)).toEqual(Array.from(b));
    }
  });
  it("leaves have transparent holes, glass is mostly transparent", () => {
    const leaves = generateTexture({ pattern: "leaves", color: 0x4f9a2c, accent: 0x3a7a1c });
    const glass = generateTexture({ pattern: "glass", color: 0xd6eef2, accent: 0xffffff });
    const alpha = (d: Uint8Array) => Array.from({ length: d.length / 4 }, (_, i) => d[i * 4 + 3]!);
    expect(alpha(leaves).some((a) => a === 0)).toBe(true);
    expect(alpha(glass).filter((a) => a < 128).length).toBeGreaterThan(100);
  });
});
