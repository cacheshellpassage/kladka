/**
 * Vanilla Structure Block files (.nbt): import and export.
 * Missing positions are structure voids (kept as air in our model).
 */

import type { VoxelModel } from "../model/model";
import {
  compoundToStringRecord,
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
  type NbtList,
  type NbtRoot,
  type NbtTag,
} from "../nbt/types";
import { FormatError, internAll, intList, newModel, without } from "./common";

export function isStructureRoot(root: NbtRoot): boolean {
  const t = root.tag.value;
  return t.has("size") && (t.has("palette") || t.has("palettes")) && t.has("blocks");
}

export function readStructure(root: NbtRoot): VoxelModel {
  const t = root.tag;
  const size = getIntVector(t, "size");
  const m = newModel({ x: size[0] ?? 0, y: size[1] ?? 0, z: size[2] ?? 0 }, getNumberOr(t, "DataVersion", 0));
  m.meta.sourceFormat = "structure-nbt";

  let paletteList: NbtList | undefined = getOptList(t, "palette");
  if (!paletteList) {
    const palettes = getList(t, "palettes");
    const first = palettes.value[0];
    if (!first || first.kind !== "list") throw new FormatError("Structure has an empty palettes list");
    paletteList = first;
  }
  const states = paletteList.value.map((e) => {
    if (e.kind !== "compound") throw new FormatError("Invalid palette entry");
    return { name: getString(e, "Name"), props: compoundToStringRecord(getOptCompound(e, "Properties")) };
  });
  const remap = internAll(m, states);

  for (const b of getList(t, "blocks").value) {
    if (b.kind !== "compound") continue;
    const st = getNumber(b, "state");
    const pos = getIntVector(b, "pos");
    const [x, y, z] = [pos[0] ?? 0, pos[1] ?? 0, pos[2] ?? 0];
    if (!m.inBounds(x, y, z)) continue;
    const p = remap[st];
    if (p === undefined) throw new FormatError(`Palette index ${st} out of range`);
    m.set(x, y, z, p);
    const beTag = getOptCompound(b, "nbt");
    if (beTag && p !== 0) {
      m.blockEntities.set(m.index(x, y, z), { id: getStringOr(beTag, "id", ""), data: without(beTag, ["id", "x", "y", "z"]) });
    }
  }

  for (const e of getOptList(t, "entities")?.value ?? []) {
    if (e.kind !== "compound") continue;
    const pos = getIntVector(e, "pos");
    const data = getOptCompound(e, "nbt") ?? nbt.compound();
    m.entities.push({ id: getStringOr(data, "id", ""), pos: [pos[0] ?? 0, pos[1] ?? 0, pos[2] ?? 0], data: without(data, ["id"]) });
  }
  return m;
}

export interface StructureWriteOptions {
  /** Write air blocks explicitly (vanilla behaviour, clears the area when loaded). Default true. */
  includeAir?: boolean;
}

export function writeStructure(m: VoxelModel, opts: StructureWriteOptions = {}): NbtRoot {
  const includeAir = opts.includeAir ?? true;
  const palette: NbtTag[] = m.palette.map((p) => {
    const c = nbt.compound({ Name: nbt.string(p.name) });
    if (Object.keys(p.props).length) c.value.set("Properties", stringRecordToCompound(p.props as Record<string, string>));
    return c;
  });
  const blocks: NbtTag[] = [];
  const { x: sx, y: sy, z: sz } = m.size;
  for (let y = 0; y < sy; y++)
    for (let z = 0; z < sz; z++)
      for (let x = 0; x < sx; x++) {
        const i = m.index(x, y, z);
        const p = m.blocks[i]!;
        if (p === 0 && !includeAir) continue;
        const b = nbt.compound({ state: nbt.int(p), pos: intList([x, y, z]) });
        const be = m.blockEntities.get(i);
        if (be) {
          const data = nbt.compound({ id: nbt.string(be.id) });
          for (const [k, v] of be.data.value) data.value.set(k, v);
          b.value.set("nbt", data);
        }
        blocks.push(b);
      }
  const entities: NbtTag[] = m.entities.map((e) => {
    const data = nbt.compound({ id: nbt.string(e.id) });
    for (const [k, v] of e.data.value) data.value.set(k, v);
    return nbt.compound({
      pos: nbt.list("double", e.pos.map((v) => nbt.double(v))),
      blockPos: intList(e.pos.map((v) => Math.floor(v))),
      nbt: data,
    });
  });
  return {
    name: "",
    tag: nbt.compound({
      DataVersion: nbt.int(m.dataVersion),
      size: intList([sx, sy, sz]),
      palette: nbt.list("compound", palette),
      blocks: nbt.list("compound", blocks),
      entities: nbt.list("compound", entities),
    }),
  };
}
