/**
 * Internal, game-agnostic voxel model.
 *
 * - Dense `Uint16Array` of palette indices, index = x + z*sx + y*sx*sz (same order as Sponge/Litematica,
 *   so importers/exporters are straight copies). Palette index 0 is always air.
 * - Block entities and entities are kept as raw NBT so that round trips are lossless.
 * - Optional per-voxel role codes (see `plan/roles.ts`), provided by generators.
 */
import { AIR, isAirName, stateKey, type BlockState, type GameId } from "./blockstate";
import type { NbtCompound } from "../nbt/types";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface LocalizedText {
  ru: string;
  en: string;
}

export interface PaletteEntry extends BlockState {
  game: GameId;
  /** Canonical material key (e.g. oak_stairs → oak_planks), filled by the game adapter. */
  material: string;
}

export interface BlockEntityData {
  /** Block entity type id, e.g. `minecraft:chest`. */
  id: string;
  /** Remaining data (without position/id fields). */
  data: NbtCompound;
}

export interface EntityData {
  id: string;
  pos: [number, number, number];
  data: NbtCompound;
}

export interface RegionInfo {
  name: string;
  min: Vec3;
  size: Vec3;
}

export interface ModelMeta {
  name?: string;
  author?: string;
  description?: string;
  /** ms since epoch */
  createdAt?: number;
  /** Original file format, when imported. */
  sourceFormat?: string;
  /** Litematica sub-regions (for information; data is merged). */
  regions?: RegionInfo[];
  /** Raw metadata compound from Sponge files, preserved for round trips. */
  extra?: NbtCompound;
}

export class VoxelModel {
  readonly size: Vec3;
  game: GameId;
  dataVersion: number;
  origin: Vec3;
  readonly blocks: Uint16Array;
  palette: PaletteEntry[];
  readonly blockEntities = new Map<number, BlockEntityData>();
  entities: EntityData[] = [];
  meta: ModelMeta = {};
  /** Optional explicit role code per voxel (0 = auto). */
  roles: Uint8Array | null = null;
  private paletteIndex = new Map<string, number>();
  private materialOf: (s: BlockState) => string;

  constructor(
    size: Vec3,
    opts: {
      game?: GameId;
      dataVersion?: number;
      origin?: Vec3;
      materialOf?: (s: BlockState) => string;
    } = {},
  ) {
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) throw new RangeError("Model size must be positive");
    const volume = size.x * size.y * size.z;
    if (volume > 512 * 512 * 384) throw new RangeError(`Model too large (${volume} voxels)`);
    this.size = { ...size };
    this.game = opts.game ?? "minecraft-java";
    this.dataVersion = opts.dataVersion ?? 0;
    this.origin = opts.origin ? { ...opts.origin } : { x: 0, y: 0, z: 0 };
    this.blocks = new Uint16Array(volume);
    this.materialOf = opts.materialOf ?? ((s) => s.name);
    this.palette = [];
    this.intern(AIR);
  }

  get volume(): number {
    return this.blocks.length;
  }

  index(x: number, y: number, z: number): number {
    return x + z * this.size.x + y * this.size.x * this.size.z;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.size.x && y < this.size.y && z < this.size.z;
  }

  coords(i: number): Vec3 {
    const sx = this.size.x;
    const layer = sx * this.size.z;
    const y = Math.floor(i / layer);
    const r = i - y * layer;
    const z = Math.floor(r / sx);
    return { x: r - z * sx, y, z };
  }

  /** Returns the palette index for a state, adding it if needed. Air variants map to 0. */
  intern(s: BlockState): number {
    if (isAirName(s.name) && this.palette.length > 0) return 0;
    const key = stateKey(s);
    const found = this.paletteIndex.get(key);
    if (found !== undefined) return found;
    const idx = this.palette.length;
    if (idx > 0xffff) throw new RangeError("Palette overflow (more than 65535 states)");
    this.palette.push({ game: this.game, name: s.name, props: { ...s.props }, material: this.materialOf(s) });
    this.paletteIndex.set(key, idx);
    return idx;
  }

  setMaterialResolver(fn: (s: BlockState) => string): void {
    this.materialOf = fn;
    for (const p of this.palette) p.material = fn(p);
  }

  getIndex(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0;
    return this.blocks[this.index(x, y, z)]!;
  }

  get(x: number, y: number, z: number): PaletteEntry {
    return this.palette[this.getIndex(x, y, z)]!;
  }

  set(x: number, y: number, z: number, s: BlockState | number): void {
    if (!this.inBounds(x, y, z)) return;
    const p = typeof s === "number" ? s : this.intern(s);
    const i = this.index(x, y, z);
    this.blocks[i] = p;
    if (p === 0) this.blockEntities.delete(i);
  }

  isAir(x: number, y: number, z: number): boolean {
    return this.getIndex(x, y, z) === 0;
  }

  /** Number of non-air voxels. */
  countBlocks(): number {
    let n = 0;
    for (let i = 0; i < this.blocks.length; i++) if (this.blocks[i] !== 0) n++;
    return n;
  }

  /** Tight bounding box of non-air voxels, or null when empty. */
  bounds(): { min: Vec3; max: Vec3 } | null {
    const { x: sx, y: sy, z: sz } = this.size;
    let minX = sx,
      minY = sy,
      minZ = sz,
      maxX = -1,
      maxY = -1,
      maxZ = -1;
    let i = 0;
    for (let y = 0; y < sy; y++)
      for (let z = 0; z < sz; z++)
        for (let x = 0; x < sx; x++, i++) {
          if (this.blocks[i] === 0) continue;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (z < minZ) minZ = z;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          if (z > maxZ) maxZ = z;
        }
    if (maxX < 0) return null;
    return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
  }

  /** Returns a new model cropped to the tight bounds (keeps block entities and roles). */
  trimmed(): VoxelModel {
    const b = this.bounds();
    if (!b) return this;
    const size = { x: b.max.x - b.min.x + 1, y: b.max.y - b.min.y + 1, z: b.max.z - b.min.z + 1 };
    if (size.x === this.size.x && size.y === this.size.y && size.z === this.size.z) return this;
    const m = new VoxelModel(size, {
      game: this.game,
      dataVersion: this.dataVersion,
      origin: { x: this.origin.x + b.min.x, y: this.origin.y + b.min.y, z: this.origin.z + b.min.z },
      materialOf: this.materialOf,
    });
    m.meta = { ...this.meta };
    if (this.roles) m.roles = new Uint8Array(m.volume);
    for (let y = 0; y < size.y; y++)
      for (let z = 0; z < size.z; z++)
        for (let x = 0; x < size.x; x++) {
          const si = this.index(x + b.min.x, y + b.min.y, z + b.min.z);
          const p = this.blocks[si]!;
          if (p === 0) continue;
          const di = m.index(x, y, z);
          m.blocks[di] = m.intern(this.palette[p]!);
          if (this.roles && m.roles) m.roles[di] = this.roles[si]!;
          const be = this.blockEntities.get(si);
          if (be) m.blockEntities.set(di, be);
        }
    m.entities = this.entities.map((e) => ({
      ...e,
      pos: [e.pos[0] - b.min.x, e.pos[1] - b.min.y, e.pos[2] - b.min.z],
    }));
    return m;
  }

  /** Removes palette entries that are no longer referenced and renumbers blocks. */
  compactPalette(): void {
    const used = new Uint8Array(this.palette.length);
    used[0] = 1;
    for (let i = 0; i < this.blocks.length; i++) used[this.blocks[i]!] = 1;
    const remap = new Uint16Array(this.palette.length);
    const next: PaletteEntry[] = [];
    this.paletteIndex.clear();
    for (let p = 0; p < this.palette.length; p++) {
      if (!used[p]) continue;
      remap[p] = next.length;
      this.paletteIndex.set(stateKey(this.palette[p]!), next.length);
      next.push(this.palette[p]!);
    }
    for (let i = 0; i < this.blocks.length; i++) this.blocks[i] = remap[this.blocks[i]!]!;
    this.palette = next;
  }

  /** Iterates over non-air voxels. */
  *nonAir(): Generator<{ i: number; x: number; y: number; z: number; p: number }> {
    const { x: sx, y: sy, z: sz } = this.size;
    let i = 0;
    for (let y = 0; y < sy; y++)
      for (let z = 0; z < sz; z++)
        for (let x = 0; x < sx; x++, i++) {
          const p = this.blocks[i]!;
          if (p !== 0) yield { i, x, y, z, p };
        }
  }

  clone(): VoxelModel {
    const m = new VoxelModel(this.size, {
      game: this.game,
      dataVersion: this.dataVersion,
      origin: this.origin,
      materialOf: this.materialOf,
    });
    for (const p of this.palette.slice(1)) m.intern(p);
    m.blocks.set(this.blocks);
    for (const [k, v] of this.blockEntities) m.blockEntities.set(k, v);
    m.entities = this.entities.map((e) => ({ ...e }));
    m.meta = { ...this.meta };
    m.roles = this.roles ? this.roles.slice() : null;
    return m;
  }
}
