/**
 * Litematica (.litematic) import (format versions 4..7, any number of sub-regions) and export
 * (version 7 / sub-version 1, single region). See docs/FORMATS.md.
 */
import { LITEMATIC_SUBVERSION, LITEMATIC_VERSION } from "../games/minecraft-java/version";
import type { BlockState } from "../model/blockstate";
import type { RegionInfo, VoxelModel } from "../model/model";
import {
  compoundToStringRecord,
  getCompound,
  getIntVector,
  getList,
  getNumber,
  getNumberOr,
  getOptCompound,
  getOptList,
  getString,
  getStringOr,
  nbt,
  stringRecordToCompound,
  type NbtRoot,
  type NbtTag,
} from "../nbt/types";
import { FormatError, internAll, newModel, vecCompound, without } from "./common";

/** Bits per entry as computed by Litematica: max(2, bitLength(paletteSize - 1)). */
export function litematicaBits(paletteSize: number): number {
  const n = Math.max(0, paletteSize - 1);
  const bitLength = n === 0 ? 0 : 32 - Math.clz32(n);
  return Math.max(2, bitLength);
}

/** Packs values into longs; entries may straddle long boundaries (Litematica layout). */
export function packBits(values: ArrayLike<number>, bits: number): BigInt64Array {
  const total = values.length * bits;
  const longs = new BigUint64Array(Math.ceil(total / 64));
  const mask = (1n << BigInt(bits)) - 1n;
  for (let i = 0; i < values.length; i++) {
    const v = BigInt(values[i]!) & mask;
    const start = i * bits;
    const li = start >>> 6;
    const off = start & 63;
    longs[li] = BigInt.asUintN(64, longs[li]! | (v << BigInt(off)));
    const endLi = (start + bits - 1) >>> 6;
    if (endLi !== li) {
      longs[endLi] = BigInt.asUintN(64, longs[endLi]! | (v >> BigInt(64 - off)));
    }
  }
  return new BigInt64Array(longs.buffer);
}

export function unpackBits(longsSigned: BigInt64Array, bits: number, count: number): Uint32Array {
  const longs = new BigUint64Array(longsSigned.buffer, longsSigned.byteOffset, longsSigned.length);
  const expected = Math.ceil((count * bits) / 64);
  if (longs.length < expected) throw new FormatError(`BlockStates array too short (${longs.length} < ${expected})`);
  const out = new Uint32Array(count);
  const mask = (1n << BigInt(bits)) - 1n;
  for (let i = 0; i < count; i++) {
    const start = i * bits;
    const li = start >>> 6;
    const off = start & 63;
    let v = longs[li]! >> BigInt(off);
    const endLi = (start + bits - 1) >>> 6;
    if (endLi !== li) v |= longs[endLi]! << BigInt(64 - off);
    out[i] = Number(v & mask);
  }
  return out;
}

export function isLitematicRoot(root: NbtRoot): boolean {
  return root.tag.value.has("Regions") && root.tag.value.has("Metadata");
}

interface RegionRead {
  name: string;
  min: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  states: BlockState[];
  data: Uint32Array;
  tiles: Array<{ x: number; y: number; z: number; id: string; data: ReturnType<typeof without> }>;
  entities: Array<{ id: string; pos: [number, number, number]; data: ReturnType<typeof without> }>;
}

export function readLitematic(root: NbtRoot): VoxelModel {
  const t = root.tag;
  const version = getNumberOr(t, "Version", 0);
  if (version > LITEMATIC_VERSION) throw new FormatError(`Unsupported Litematica version ${version}`);
  if (version < 4) throw new FormatError(`Litematica version ${version} predates the flattening (MC 1.13) and is not supported`);
  const dataVersion = getNumberOr(t, "MinecraftDataVersion", 0);
  const regionsTag = getCompound(t, "Regions");
  const regions: RegionRead[] = [];

  for (const [name, rt] of regionsTag.value) {
    if (rt.kind !== "compound") continue;
    const p = getCompound(rt, "Position");
    const s = getCompound(rt, "Size");
    const pos = { x: getNumber(p, "x"), y: getNumber(p, "y"), z: getNumber(p, "z") };
    const sz = { x: getNumber(s, "x"), y: getNumber(s, "y"), z: getNumber(s, "z") };
    const abs = { x: Math.abs(sz.x), y: Math.abs(sz.y), z: Math.abs(sz.z) };
    if (abs.x === 0 || abs.y === 0 || abs.z === 0) continue;
    const min = {
      x: sz.x < 0 ? pos.x + sz.x + 1 : pos.x,
      y: sz.y < 0 ? pos.y + sz.y + 1 : pos.y,
      z: sz.z < 0 ? pos.z + sz.z + 1 : pos.z,
    };
    const paletteList = getList(rt, "BlockStatePalette");
    const states: BlockState[] = paletteList.value.map((e) => {
      if (e.kind !== "compound") throw new FormatError("Invalid palette entry");
      return { name: getString(e, "Name"), props: compoundToStringRecord(getOptCompound(e, "Properties")) };
    });
    if (states.length === 0) states.push({ name: "minecraft:air", props: {} });
    const bs = rt.value.get("BlockStates");
    if (!bs || bs.kind !== "longArray") throw new FormatError(`Region "${name}" has no BlockStates`);
    const volume = abs.x * abs.y * abs.z;
    const data = unpackBits(bs.value, litematicaBits(states.length), volume);

    const tiles: RegionRead["tiles"] = [];
    for (const te of getOptList(rt, "TileEntities")?.value ?? []) {
      if (te.kind !== "compound") continue;
      tiles.push({
        x: getNumber(te, "x"),
        y: getNumber(te, "y"),
        z: getNumber(te, "z"),
        id: getStringOr(te, "id", ""),
        data: without(te, ["x", "y", "z", "id"]),
      });
    }
    const entities: RegionRead["entities"] = [];
    for (const en of getOptList(rt, "Entities")?.value ?? []) {
      if (en.kind !== "compound") continue;
      const ep = en.value.has("Pos") ? getIntVector(en, "Pos") : [0, 0, 0];
      entities.push({
        id: getStringOr(en, "id", ""),
        pos: [ep[0] ?? 0, ep[1] ?? 0, ep[2] ?? 0],
        data: without(en, ["Pos", "id"]),
      });
    }
    regions.push({ name, min, size: abs, states, data, tiles, entities });
  }
  if (regions.length === 0) throw new FormatError("Litematic file contains no regions");

  const gmin = {
    x: Math.min(...regions.map((r) => r.min.x)),
    y: Math.min(...regions.map((r) => r.min.y)),
    z: Math.min(...regions.map((r) => r.min.z)),
  };
  const gmax = {
    x: Math.max(...regions.map((r) => r.min.x + r.size.x)),
    y: Math.max(...regions.map((r) => r.min.y + r.size.y)),
    z: Math.max(...regions.map((r) => r.min.z + r.size.z)),
  };
  const m = newModel({ x: gmax.x - gmin.x, y: gmax.y - gmin.y, z: gmax.z - gmin.z }, dataVersion);
  m.meta.sourceFormat = `litematic-v${version}`;
  m.origin = { ...gmin };
  const infos: RegionInfo[] = [];

  for (const r of regions) {
    const remap = internAll(m, r.states);
    const ox = r.min.x - gmin.x,
      oy = r.min.y - gmin.y,
      oz = r.min.z - gmin.z;
    let i = 0;
    for (let y = 0; y < r.size.y; y++)
      for (let z = 0; z < r.size.z; z++)
        for (let x = 0; x < r.size.x; x++, i++) {
          const v = r.data[i]!;
          if (v >= remap.length) throw new FormatError(`Palette index ${v} out of range in region "${r.name}"`);
          const p = remap[v]!;
          if (p !== 0) m.blocks[m.index(x + ox, y + oy, z + oz)] = p;
        }
    for (const te of r.tiles) {
      const x = te.x + ox,
        y = te.y + oy,
        z = te.z + oz;
      if (!m.inBounds(x, y, z)) continue;
      const id = te.id || m.get(x, y, z).name;
      m.blockEntities.set(m.index(x, y, z), { id, data: te.data });
    }
    for (const en of r.entities) {
      m.entities.push({ id: en.id, pos: [en.pos[0] + ox, en.pos[1] + oy, en.pos[2] + oz], data: en.data });
    }
    infos.push({ name: r.name, min: { x: ox, y: oy, z: oz }, size: r.size });
  }
  m.meta.regions = infos;

  const meta = getOptCompound(t, "Metadata");
  if (meta) {
    m.meta.name = getStringOr(meta, "Name", "");
    m.meta.author = getStringOr(meta, "Author", "");
    m.meta.description = getStringOr(meta, "Description", "");
    if (meta.value.has("TimeCreated")) m.meta.createdAt = getNumber(meta, "TimeCreated");
  }
  return m;
}

export function writeLitematic(m: VoxelModel, opts: { regionName?: string } = {}): NbtRoot {
  const regionName = opts.regionName || m.meta.name || "Main";
  const palette = m.palette;
  const bits = litematicaBits(palette.length);
  const states = packBits(m.blocks, bits);
  const now = Date.now();
  const created = m.meta.createdAt ?? now;

  const tiles: NbtTag[] = [];
  for (const [i, be] of [...m.blockEntities].sort((a, b) => a[0] - b[0])) {
    const c = m.coords(i);
    const tag = nbt.compound({ x: nbt.int(c.x), y: nbt.int(c.y), z: nbt.int(c.z), id: nbt.string(be.id) });
    for (const [k, v] of be.data.value) if (!["x", "y", "z", "id"].includes(k)) tag.value.set(k, v);
    tiles.push(tag);
  }
  const entities: NbtTag[] = m.entities.map((e) => {
    const tag = nbt.compound({ id: nbt.string(e.id), Pos: nbt.list("double", e.pos.map((v) => nbt.double(v))) });
    for (const [k, v] of e.data.value) if (k !== "Pos" && k !== "id") tag.value.set(k, v);
    return tag;
  });

  const region = nbt.compound({
    Position: vecCompound({ x: 0, y: 0, z: 0 }),
    Size: vecCompound(m.size),
    BlockStatePalette: nbt.list(
      "compound",
      palette.map((p) => {
        const c = nbt.compound({ Name: nbt.string(p.name) });
        if (Object.keys(p.props).length) c.value.set("Properties", stringRecordToCompound(p.props as Record<string, string>));
        return c;
      }),
    ),
    BlockStates: nbt.longArray(states),
    TileEntities: nbt.list("compound", tiles),
    Entities: nbt.list("compound", entities),
    PendingBlockTicks: nbt.list("compound", []),
    PendingFluidTicks: nbt.list("compound", []),
  });

  const total = m.countBlocks();
  const meta = nbt.compound({
    Name: nbt.string(m.meta.name ?? regionName),
    Author: nbt.string(m.meta.author ?? ""),
    Description: nbt.string(m.meta.description ?? ""),
    RegionCount: nbt.int(1),
    TotalBlocks: nbt.int(total),
    TotalVolume: nbt.int(m.volume),
    TimeCreated: nbt.long(created),
    TimeModified: nbt.long(now),
    EnclosingSize: vecCompound(m.size),
  });

  return {
    name: "",
    tag: nbt.compound({
      MinecraftDataVersion: nbt.int(m.dataVersion),
      Version: nbt.int(LITEMATIC_VERSION),
      SubVersion: nbt.int(LITEMATIC_SUBVERSION),
      Metadata: meta,
      Regions: nbt.compound({ [regionName]: region }),
    }),
  };
}
