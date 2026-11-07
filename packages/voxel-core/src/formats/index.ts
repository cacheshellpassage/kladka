/**
 * Format detection and the public import/export API.
 */
import { MC_DATA_VERSION } from "../games/minecraft-java/version";
import type { BuildMeta } from "../content/meta";
import type { VoxelModel } from "../model/model";
import { maybeDecompress, readNbt, writeNbtFile } from "../nbt/codec";
import { FormatError } from "./common";
import { decodeKBuild, encodeKBuild } from "./kbuild";
import { isLitematicRoot, readLitematic, writeLitematic } from "./litematic";
import { isSpongeRoot, readSponge, writeSpongeV2, writeSpongeV3 } from "./sponge";
import { isStructureRoot, readStructure, writeStructure } from "./structure";

export type ImportFormat = "schem" | "litematic" | "nbt" | "kbuild";
export type ExportFormat = "schem" | "schem-v2" | "litematic" | "nbt";

export interface ImportResult {
  model: VoxelModel;
  format: ImportFormat;
  meta?: BuildMeta;
  warnings: string[];
}

function extOf(name: string | undefined): string {
  if (!name) return "";
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

/** Imports a schematic/structure/build file from raw bytes. Format is sniffed from content. */
export function importBytes(bytes: Uint8Array, filename?: string): ImportResult {
  const ext = extOf(filename);
  const warnings: string[] = [];
  if (ext === "kbuild" || (bytes[0] === 0x7b /* { */ && ext !== "nbt")) {
    const { model, meta } = decodeKBuild(bytes);
    return { model, meta, format: "kbuild", warnings };
  }
  let raw: Uint8Array;
  try {
    raw = maybeDecompress(bytes);
  } catch {
    throw new FormatError("File is not a valid gzip/NBT file");
  }
  if (raw[0] === 0x7b) {
    const { model, meta } = decodeKBuild(raw);
    return { model, meta, format: "kbuild", warnings };
  }
  const root = readNbt(raw);
  let model: VoxelModel;
  let format: ImportFormat;
  if (isLitematicRoot(root)) {
    model = readLitematic(root);
    format = "litematic";
  } else if (isSpongeRoot(root)) {
    model = readSponge(root);
    format = "schem";
  } else if (isStructureRoot(root)) {
    model = readStructure(root);
    format = "nbt";
  } else if (root.tag.value.has("Blocks") && root.tag.value.has("Data") && root.tag.value.has("Materials")) {
    throw new FormatError(
      "Legacy MCEdit .schematic (pre-1.13 numeric ids) is not supported; re-save it as .schem",
    );
  } else {
    throw new FormatError("Unknown NBT structure: not a .schem, .litematic or structure .nbt file");
  }
  if (ext && ext !== format && !(ext === "schematic" && format === "schem")) {
    warnings.push(`File extension .${ext} does not match detected format ${format}`);
  }
  if (model.dataVersion > MC_DATA_VERSION) {
    warnings.push(
      `File was saved by a newer game version (DataVersion ${model.dataVersion} > ${MC_DATA_VERSION})`,
    );
  }
  const unknown = model.palette.filter((p) => !p.name.startsWith("minecraft:")).length;
  if (unknown) warnings.push(`${unknown} block types are from mods and are shown with placeholder colours`);
  return { model, format, warnings };
}

export interface ExportResult {
  bytes: Uint8Array;
  extension: string;
  mime: string;
}

export function exportModel(
  m: VoxelModel,
  format: ExportFormat,
  opts: { includeAir?: boolean } = {},
): ExportResult {
  switch (format) {
    case "schem":
      return { bytes: writeNbtFile(writeSpongeV3(m)), extension: "schem", mime: "application/octet-stream" };
    case "schem-v2":
      return { bytes: writeNbtFile(writeSpongeV2(m)), extension: "schem", mime: "application/octet-stream" };
    case "litematic":
      return {
        bytes: writeNbtFile(writeLitematic(m)),
        extension: "litematic",
        mime: "application/octet-stream",
      };
    case "nbt":
      return {
        bytes: writeNbtFile(writeStructure(m, { includeAir: opts.includeAir })),
        extension: "nbt",
        mime: "application/octet-stream",
      };
  }
}

export function exportKBuild(m: VoxelModel, meta: BuildMeta): Uint8Array {
  return encodeKBuild(m, meta);
}

export { FormatError } from "./common";
export * from "./sponge";
export * from "./litematic";
export * from "./structure";
export * from "./kbuild";
export * from "./varint";
