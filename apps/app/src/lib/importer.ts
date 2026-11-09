/** Import of user files (.schem/.litematic/.nbt/.kbuild) and content packs (.zip). */
import { unzipSync, strFromU8 } from "fflate";
import { decodeKBuild, type ContentPackManifest } from "@kladka/voxel-core";
import { VoxelViewer } from "@kladka/viewer";
import { getOne, put, type ImportRecord } from "../db/db";
import { importInWorker } from "./worker-client";

export const MAX_IMPORT_BYTES = 64 * 1024 * 1024;

function newId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}

const COVER_W = 800,
  COVER_H = 500;

/**
 * Renders a cover image for an imported build on the device (offscreen, nothing leaves the device):
 * - "classic": the normal view on a transparent background with a soft contact shadow, so it suits both
 *   themes (same look as the built-in covers);
 * - "shaders": the "Shaders" mode at golden hour with sky, sun shadows and bloom.
 */
export async function renderCover(
  kbuild: Uint8Array,
  style: "classic" | "shaders",
): Promise<string | undefined> {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${COVER_W}px;height:${COVER_H}px;pointer-events:none;`;
  document.body.appendChild(host);
  let v: VoxelViewer | null = null;
  try {
    v = new VoxelViewer(host, {
      mode: style === "shaders" ? "shaders" : "classic",
      quality: "medium",
      timeOfDay: "sunset",
      preserveDrawingBuffer: true,
      ground: true,
      transparent: style === "classic",
      maxPixelRatio: 1,
    });
    const { model } = decodeKBuild(kbuild);
    await v.setModel(model, null);
    v.resetCamera(0);
    v.renderNow();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    return v.capture(COVER_W, COVER_H, "image/webp", 0.82);
  } catch {
    return undefined;
  } finally {
    v?.dispose();
    host.remove();
  }
}

async function renderCovers(kbuild: Uint8Array): Promise<{ classic?: string; shaders?: string }> {
  const classic = await renderCover(kbuild, "classic");
  const shaders = await renderCover(kbuild, "shaders");
  return { classic, shaders };
}

const coverJobs = new Set<string>();

/**
 * Builds imported before covers existed get their covers rendered the
 * first time their page is opened. Returns true when the record was updated.
 */
export async function ensureImportCovers(id: string): Promise<boolean> {
  if (coverJobs.has(id)) return false;
  coverJobs.add(id);
  try {
    const rec = await getOne("imports", id);
    if (!rec || rec.covers) return false; // already rendered (or tried) once
    const covers = await renderCovers(rec.bytes);
    if (!covers.classic && !covers.shaders) return false;
    await put("imports", { ...rec, covers, thumb: covers.classic ?? rec.thumb });
    return true;
  } finally {
    coverJobs.delete(id);
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
  const covers = await renderCovers(res.bytes);
  const rec: ImportRecord = {
    id,
    meta: res.meta,
    stats: res.stats,
    bytes: res.bytes,
    thumb: covers.classic,
    covers,
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
