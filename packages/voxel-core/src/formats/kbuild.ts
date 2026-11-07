/**
 * Our own compact build format (`.kbuild`): gzip-compressed JSON with an RLE-encoded voxel array,
 * explicit per-voxel roles and build metadata. Used for content packs.
 */
import { gunzipSync, gzipSync, strFromU8, strToU8 } from "fflate";
import type { BuildMeta } from "../content/meta";
import { parseState, stateKey } from "../model/blockstate";
import type { VoxelModel } from "../model/model";
import { isGzip } from "../nbt/codec";
import { fromBase64, toBase64 } from "../util/base64";
import { FormatError, internAll, newModel } from "./common";
import { encodeVarints } from "./varint";

export interface KBuildFile {
  format: "kladka-build";
  version: 1;
  game: "minecraft-java";
  dataVersion: number;
  size: [number, number, number];
  palette: string[];
  /** base64(varint pairs [value, runLength]...) */
  blocks: string;
  roles?: string;
  meta: BuildMeta;
}

export function rleEncode(values: ArrayLike<number>): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < values.length) {
    const v = values[i]!;
    let j = i + 1;
    while (j < values.length && values[j] === v) j++;
    out.push(v, j - i);
    i = j;
  }
  return encodeVarints(out);
}

export function rleDecode(bytes: Uint8Array, length: number): Uint32Array {
  const out = new Uint32Array(length);
  let o = 0;
  let p = 0;
  const read = (): number => {
    let value = 0,
      shift = 0;
    for (;;) {
      if (p >= bytes.length) throw new FormatError("RLE data truncated");
      const b = bytes[p++]!;
      value |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return value >>> 0;
      shift += 7;
    }
  };
  while (o < length) {
    const v = read();
    const n = read();
    if (o + n > length) throw new FormatError("RLE run exceeds volume");
    out.fill(v, o, o + n);
    o += n;
  }
  return out;
}

export function toKBuild(m: VoxelModel, meta: BuildMeta): KBuildFile {
  return {
    format: "kladka-build",
    version: 1,
    game: "minecraft-java",
    dataVersion: m.dataVersion,
    size: [m.size.x, m.size.y, m.size.z],
    palette: m.palette.map((p) => stateKey(p)),
    blocks: toBase64(rleEncode(m.blocks)),
    roles: m.roles ? toBase64(rleEncode(m.roles)) : undefined,
    meta,
  };
}

export function fromKBuild(f: KBuildFile): { model: VoxelModel; meta: BuildMeta } {
  if (f.format !== "kladka-build") throw new FormatError("Not a kladka build file");
  if (f.version !== 1) throw new FormatError(`Unsupported build file version ${f.version}`);
  const [x, y, z] = f.size;
  const m = newModel({ x, y, z }, f.dataVersion);
  const remap = internAll(m, f.palette.map(parseState));
  const data = rleDecode(fromBase64(f.blocks), m.volume);
  for (let i = 0; i < data.length; i++) {
    const v = data[i]!;
    if (v >= remap.length) throw new FormatError(`Palette index ${v} out of range`);
    m.blocks[i] = remap[v]!;
  }
  if (f.roles) {
    const r = rleDecode(fromBase64(f.roles), m.volume);
    m.roles = Uint8Array.from(r);
  }
  m.meta = { name: f.meta.title.en, author: f.meta.author, sourceFormat: "kbuild" };
  return { model: m, meta: f.meta };
}

export function encodeKBuild(m: VoxelModel, meta: BuildMeta): Uint8Array {
  return gzipSync(strToU8(JSON.stringify(toKBuild(m, meta))), { level: 9, mtime: 0 });
}

export function decodeKBuild(bytes: Uint8Array): { model: VoxelModel; meta: BuildMeta } {
  const raw = isGzip(bytes) ? gunzipSync(bytes) : bytes;
  let json: KBuildFile;
  try {
    json = JSON.parse(strFromU8(raw)) as KBuildFile;
  } catch {
    throw new FormatError("Build file is not valid JSON");
  }
  return fromKBuild(json);
}
