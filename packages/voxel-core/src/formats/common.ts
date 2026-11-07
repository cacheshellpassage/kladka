import { gameAdapter } from "../games";
import { parseState, stateKey, type BlockState } from "../model/blockstate";
import { VoxelModel, type Vec3 } from "../model/model";
import { nbt, type NbtCompound, type NbtTag } from "../nbt/types";

export class FormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormatError";
  }
}

export const MAX_IMPORT_VOLUME = 400 * 400 * 384;

export function newModel(size: Vec3, dataVersion: number): VoxelModel {
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) throw new FormatError(`Invalid size ${size.x}×${size.y}×${size.z}`);
  if (size.x * size.y * size.z > MAX_IMPORT_VOLUME) {
    throw new FormatError(`Structure is too large (${size.x}×${size.y}×${size.z})`);
  }
  const game = gameAdapter("minecraft-java");
  return new VoxelModel(size, { game: "minecraft-java", dataVersion, materialOf: game.materialOf });
}

/** Builds a palette-index remap from a list of state strings. */
export function internAll(m: VoxelModel, states: BlockState[]): Uint16Array {
  const remap = new Uint16Array(states.length);
  states.forEach((s, i) => (remap[i] = m.intern(s)));
  return remap;
}

export function parseStates(keys: string[]): BlockState[] {
  return keys.map((k) => parseState(k));
}

export function stateString(s: BlockState): string {
  return stateKey(s);
}

/** Returns a copy of the compound without the given keys. */
export function without(c: NbtCompound, keys: string[]): NbtCompound {
  const m = new Map<string, NbtTag>();
  for (const [k, v] of c.value) if (!keys.includes(k)) m.set(k, v);
  return { kind: "compound", value: m };
}

export function intList(values: number[]): NbtTag {
  return nbt.list(
    "int",
    values.map((v) => nbt.int(v)),
  );
}

export function vecCompound(v: Vec3): NbtCompound {
  return nbt.compound({ x: nbt.int(v.x), y: nbt.int(v.y), z: nbt.int(v.z) });
}
