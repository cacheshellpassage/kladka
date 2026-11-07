/**
 * Sponge Schematic (.schem) versions 1, 2 and 3 — import; versions 2 and 3 — export.
 * Spec: https://github.com/SpongePowered/Schematic-Specification (see docs/FORMATS.md).
 */
import { stateKey } from "../model/blockstate";
import type { VoxelModel } from "../model/model";
import {
  getIntVector,
  getNumber,
  getNumberOr,
  getOptCompound,
  getOptList,
  getString,
  getStringOr,
  nbt,
  type NbtCompound,
  type NbtRoot,
  type NbtTag,
} from "../nbt/types";
import { FormatError, internAll, newModel, parseStates, without } from "./common";
import { decodeVarints, encodeVarints } from "./varint";

export function isSpongeRoot(root: NbtRoot): boolean {
  const t = root.tag;
  const inner = getOptCompound(t, "Schematic");
  const s = inner && !t.value.has("Width") ? inner : t;
  return s.value.has("Width") && s.value.has("Height") && s.value.has("Length") && (s.value.has("Palette") || s.value.has("Blocks") || s.value.has("BlockData"));
}

export function readSponge(root: NbtRoot): VoxelModel {
  let s = root.tag;
  const inner = getOptCompound(s, "Schematic");
  if (inner && !s.value.has("Width")) s = inner;

  const version = getNumberOr(s, "Version", 1);
  if (version < 1 || version > 3) throw new FormatError(`Unsupported Sponge schematic version ${version}`);
  const dataVersion = getNumberOr(s, "DataVersion", 1343);
  const size = {
    x: getNumber(s, "Width") & 0xffff,
    y: getNumber(s, "Height") & 0xffff,
    z: getNumber(s, "Length") & 0xffff,
  };
  const m = newModel(size, dataVersion);
  m.meta.sourceFormat = `schem-v${version}`;
  if (s.value.has("Offset")) {
    const o = getIntVector(s, "Offset");
    m.origin = { x: o[0] ?? 0, y: o[1] ?? 0, z: o[2] ?? 0 };
  }

  let paletteTag: NbtCompound | undefined;
  let dataTag: NbtTag | undefined;
  let beList = undefined as ReturnType<typeof getOptList>;
  if (version >= 3) {
    const blocks = getOptCompound(s, "Blocks");
    if (blocks) {
      paletteTag = getOptCompound(blocks, "Palette");
      dataTag = blocks.value.get("Data");
      beList = getOptList(blocks, "BlockEntities");
    }
  } else {
    paletteTag = getOptCompound(s, "Palette");
    dataTag = s.value.get("BlockData");
    beList = getOptList(s, "BlockEntities") ?? getOptList(s, "TileEntities");
  }

  if (paletteTag && dataTag) {
    if (dataTag.kind !== "byteArray") throw new FormatError("Block data must be a byte array");
    const entries: Array<[string, number]> = [];
    for (const [k, v] of paletteTag.value) {
      if (v.kind !== "int" && v.kind !== "short" && v.kind !== "byte") continue;
      entries.push([k, v.value]);
    }
    const maxIdx = entries.reduce((a, [, v]) => Math.max(a, v), 0);
    const states = new Array<string>(maxIdx + 1).fill("minecraft:air");
    for (const [k, v] of entries) states[v] = k;
    const remap = internAll(m, parseStates(states));
    const data = decodeVarints(dataTag.value, m.volume);
    for (let i = 0; i < data.length; i++) {
      const v = data[i]!;
      if (v >= remap.length) throw new FormatError(`Palette index ${v} out of range`);
      m.blocks[i] = remap[v]!;
    }
  }

  if (beList) {
    for (const t of beList.value) {
      if (t.kind !== "compound") continue;
      const pos = getIntVector(t, "Pos");
      const [x, y, z] = [pos[0] ?? 0, pos[1] ?? 0, pos[2] ?? 0];
      if (!m.inBounds(x, y, z)) continue;
      const id = getStringOr(t, "Id", getStringOr(t, "id", ""));
      const data = version >= 3 ? (getOptCompound(t, "Data") ?? nbt.compound()) : without(t, ["Pos", "Id", "id"]);
      m.blockEntities.set(m.index(x, y, z), { id, data });
    }
  }

  const ents = getOptList(s, "Entities");
  if (ents) {
    for (const t of ents.value) {
      if (t.kind !== "compound") continue;
      const pos = getIntVector(t, "Pos");
      const id = getStringOr(t, "Id", getStringOr(t, "id", ""));
      const data = version >= 3 ? (getOptCompound(t, "Data") ?? nbt.compound()) : without(t, ["Pos", "Id"]);
      m.entities.push({ id, pos: [pos[0] ?? 0, pos[1] ?? 0, pos[2] ?? 0], data });
    }
  }

  const meta = getOptCompound(s, "Metadata");
  if (meta) {
    m.meta.extra = meta;
    if (meta.value.has("Name")) m.meta.name = getString(meta, "Name");
    if (meta.value.has("Author")) m.meta.author = getString(meta, "Author");
    if (meta.value.has("Date")) m.meta.createdAt = getNumber(meta, "Date");
  }
  return m;
}

function unsignedShort(v: number): NbtTag {
  if (v > 0xffff) throw new FormatError(`Dimension ${v} exceeds the Sponge limit of 65535`);
  return nbt.short(v > 0x7fff ? v - 0x10000 : v);
}

function metadataTag(m: VoxelModel): NbtCompound {
  const meta = nbt.compound();
  if (m.meta.extra) for (const [k, v] of m.meta.extra.value) meta.value.set(k, v);
  if (m.meta.name) meta.value.set("Name", nbt.string(m.meta.name));
  if (m.meta.author) meta.value.set("Author", nbt.string(m.meta.author));
  meta.value.set("Date", nbt.long(m.meta.createdAt ?? Date.now()));
  return meta;
}

function paletteCompound(m: VoxelModel): NbtCompound {
  const pal = nbt.compound();
  m.palette.forEach((p, i) => pal.value.set(stateKey(p), nbt.int(i)));
  return pal;
}

export function writeSpongeV3(m: VoxelModel): NbtRoot {
  const blockEntities: NbtTag[] = [];
  for (const [i, be] of [...m.blockEntities].sort((a, b) => a[0] - b[0])) {
    const c = m.coords(i);
    blockEntities.push(nbt.compound({ Pos: nbt.intArray([c.x, c.y, c.z]), Id: nbt.string(be.id), Data: be.data }));
  }
  const schematic = nbt.compound({
    Version: nbt.int(3),
    DataVersion: nbt.int(m.dataVersion),
    Metadata: metadataTag(m),
    Width: unsignedShort(m.size.x),
    Height: unsignedShort(m.size.y),
    Length: unsignedShort(m.size.z),
    Offset: nbt.intArray([m.origin.x, m.origin.y, m.origin.z]),
    Blocks: nbt.compound({
      Palette: paletteCompound(m),
      Data: nbt.byteArray(encodeVarints(m.blocks)),
      BlockEntities: nbt.list("compound", blockEntities),
    }),
  });
  if (m.entities.length) {
    schematic.value.set(
      "Entities",
      nbt.list(
        "compound",
        m.entities.map((e) =>
          nbt.compound({
            Pos: nbt.list("double", e.pos.map((v) => nbt.double(v))),
            Id: nbt.string(e.id),
            Data: e.data,
          }),
        ),
      ),
    );
  }
  return { name: "", tag: nbt.compound({ Schematic: schematic }) };
}

export function writeSpongeV2(m: VoxelModel): NbtRoot {
  const blockEntities: NbtTag[] = [];
  for (const [i, be] of [...m.blockEntities].sort((a, b) => a[0] - b[0])) {
    const c = m.coords(i);
    const t = nbt.compound({ Pos: nbt.intArray([c.x, c.y, c.z]), Id: nbt.string(be.id) });
    for (const [k, v] of be.data.value) if (k !== "id" && k !== "Id" && k !== "Pos") t.value.set(k, v);
    blockEntities.push(t);
  }
  const tag = nbt.compound({
    Version: nbt.int(2),
    DataVersion: nbt.int(m.dataVersion),
    Metadata: metadataTag(m),
    Width: unsignedShort(m.size.x),
    Height: unsignedShort(m.size.y),
    Length: unsignedShort(m.size.z),
    Offset: nbt.intArray([m.origin.x, m.origin.y, m.origin.z]),
    PaletteMax: nbt.int(m.palette.length),
    Palette: paletteCompound(m),
    BlockData: nbt.byteArray(encodeVarints(m.blocks)),
    BlockEntities: nbt.list("compound", blockEntities),
  });
  if (m.entities.length) {
    tag.value.set(
      "Entities",
      nbt.list(
        "compound",
        m.entities.map((e) => {
          const t = nbt.compound({ Pos: nbt.list("double", e.pos.map((v) => nbt.double(v))), Id: nbt.string(e.id) });
          for (const [k, v] of e.data.value) if (k !== "Pos" && k !== "Id") t.value.set(k, v);
          return t;
        }),
      ),
    );
  }
  return { name: "Schematic", tag };
}
