/** Import of user files (.schem/.litematic/.nbt/.kbuild) and content packs (.zip). */
import { unzipSync, strFromU8 } from "fflate";
import { decodeKBuild, type ContentPackManifest } from "@kladka/voxel-core";
import { VoxelViewer } from "@kladka/viewer";
import { put, type ImportRecord } from "../db/db";
import { importInWorker } from "./worker-client";

export const MAX_IMPORT_BYTES = 64 * 1024 * 1024;

function newId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}

/** Renders a small cover image for an imported build (local, offscreen). */
export async function renderThumb(kbuild: Uint8Array): Promise<string | undefined> {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:384px;height:240px;pointer-events:none;";
  document.body.appendChild(host);
  let v: VoxelViewer | null = null;
  try {
    v = new VoxelViewer(host, {
      mode: "classic",
      quality: "medium",
      preserveDrawingBuffer: true,
      ground: true,
      transparent: true,
    });
    const { model } = decodeKBuild(kbuild);
    await v.setModel(model, null);
    v.resetCamera(0);
    return v.capture(384, 240, "image/webp", 0.8);
  } catch {
    return undefined;
  } finally {
    v?.dispose();
    host.remove();
  }
}

export async function importFile(file: File): Promise<ImportRecord[]> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("too-big");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (/\.zip$/i.test(file.name) || (bytes[0] === 0x50 && bytes[1] === 0x4b)) return importPack(bytes);
  return [await importOne(bytes, file.name, newId("imp"))];
}

async function importOne(bytes: Uint8Array, filename: string, id: string): Promise<ImportRecord> {
  const res = await importInWorker(bytes, filename, id);
  const thumb = await renderThumb(res.bytes);
  const rec: ImportRecord = {
    id,
    meta: res.meta,
    stats: res.stats,
    bytes: res.bytes,
    thumb,
    sourceFile: filename,
    sourceFormat: res.format,
    warnings: res.warnings,
    createdAt: Date.now(),
  };
  await put("imports", rec);
  return rec;
}

/** A content pack is a zip with pack.json (kladka-pack v1) and the referenced build files. */
async function importPack(zip: Uint8Array): Promise<ImportRecord[]> {
  const files = unzipSync(zip);
  const manifestKey = Object.keys(files).find((k) => k === "pack.json" || k.endsWith("/pack.json"));
  if (!manifestKey) throw new Error("pack.json not found");
  const root = manifestKey.slice(0, manifestKey.length - "pack.json".length);
  const manifest = JSON.parse(strFromU8(files[manifestKey]!)) as ContentPackManifest;
  if (manifest.format !== "kladka-pack") throw new Error("not a kladka content pack");
  const out: ImportRecord[] = [];
  for (const b of manifest.builds) {
    const data = files[root + b.file];
    if (!data) continue;
    const rec = await importOne(data, b.file, `pack-${manifest.id}-${b.id}`);
    // keep the pack's metadata (title, license, author)
    rec.meta = { ...b.meta, id: rec.id };
    await put("imports", rec);
    out.push(rec);
  }
  return out;
}
