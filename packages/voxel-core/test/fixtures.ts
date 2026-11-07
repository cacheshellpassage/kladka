/** Hand-made test fixtures (no third-party schematics are used). */
import { VoxelModel, minecraftJava, nbt, state, MC_DATA_VERSION } from "../src";

export function newTestModel(x: number, y: number, z: number): VoxelModel {
  return new VoxelModel({ x, y, z }, { dataVersion: MC_DATA_VERSION, materialOf: minecraftJava.materialOf });
}

/**
 * 7×8×7 cottage: cobblestone floor, oak log corners, oak plank walls, glass windows,
 * door, gable roof of spruce stairs, torches outside, a chest (with block entity), a hanging lantern.
 */
export function cottage(): VoxelModel {
  const m = newTestModel(9, 9, 9);
  const W = 7;
  const o = 1; // offset inside the model (room for eaves)
  // floor
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) m.set(x + o, 0, z + o, state("cobblestone"));
  // walls y=1..3
  for (let y = 1; y <= 3; y++)
    for (let x = 0; x < W; x++)
      for (let z = 0; z < W; z++) {
        const edgeX = x === 0 || x === W - 1;
        const edgeZ = z === 0 || z === W - 1;
        if (!edgeX && !edgeZ) continue;
        const corner = edgeX && edgeZ;
        m.set(x + o, y, z + o, corner ? state("oak_log", { axis: "y" }) : state("oak_planks"));
      }
  // ceiling y=4
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) m.set(x + o, 4, z + o, state("oak_planks"));
  // gable roof: stairs facing north/south rising towards the middle (z)
  for (let step = 0; step < 4; step++) {
    const y = 5 + step;
    for (let x = -1; x <= W; x++) {
      const zs = step - 1 + o;
      const zn = W - step + o;
      if (y >= m.size.y) continue;
      if (zs <= zn) {
        m.set(x + o, y, zs, state("spruce_stairs", { facing: "south", half: "bottom" }));
        m.set(x + o, y, zn, state("spruce_stairs", { facing: "north", half: "bottom" }));
      }
    }
  }
  // windows and door
  m.set(o + 3, 2, o, state("glass_pane"));
  m.set(o, 2, o + 3, state("glass_pane"));
  m.set(o + 3, 1, o + W - 1, state("oak_door", { facing: "south", half: "lower", hinge: "left", open: "false" }));
  m.set(o + 3, 2, o + W - 1, state("oak_door", { facing: "south", half: "upper", hinge: "left", open: "false" }));
  // torch outside next to the door (attached to wall, facing south)
  m.set(o + 2, 2, o + W, state("wall_torch", { facing: "south" }));
  // chest with block entity
  m.set(o + 2, 1, o + 2, state("chest", { facing: "south", type: "single" }));
  m.blockEntities.set(m.index(o + 2, 1, o + 2), {
    id: "minecraft:chest",
    data: nbt.compound({ CustomName: nbt.string('"Tools"'), Items: nbt.list("compound", []) }),
  });
  // hanging lantern below the ceiling
  m.set(o + 4, 3, o + 4, state("lantern", { hanging: "true" }));
  // bed
  m.set(o + 4, 1, o + 1, state("red_bed", { facing: "north", part: "head" }));
  m.set(o + 4, 1, o + 2, state("red_bed", { facing: "north", part: "foot" }));
  minecraftJava.finalize(m);
  m.meta.name = "Test cottage";
  m.meta.author = "kladka-tests";
  return m;
}

export function sameBlocks(a: VoxelModel, b: VoxelModel): boolean {
  if (a.size.x !== b.size.x || a.size.y !== b.size.y || a.size.z !== b.size.z) return false;
  for (let i = 0; i < a.volume; i++) {
    const pa = a.palette[a.blocks[i]!]!;
    const pb = b.palette[b.blocks[i]!]!;
    if (pa.name !== pb.name) return false;
    const ka = Object.keys(pa.props).sort().map((k) => `${k}=${pa.props[k]}`).join(",");
    const kb = Object.keys(pb.props).sort().map((k) => `${k}=${pb.props[k]}`).join(",");
    if (ka !== kb) return false;
  }
  return true;
}
