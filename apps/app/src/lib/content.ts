/** Loading built-in and imported builds. */
import type { BuildMeta, BuildStats, ContentPackManifest, PackBuildEntry } from "@kladka/voxel-core";
import { getAll, getOne, type ImportRecord } from "../db/db";

export type BuildSource = "core" | "import";

export interface LibraryItem {
  id: string;
  source: BuildSource;
  meta: BuildMeta;
  stats: BuildStats;
  previews?: PackBuildEntry["previews"];
  /** URL relative to the app root for core builds. */
  file?: string;
  thumb?: string;
  /** Imported builds: covers rendered on the device (classic and shaders). */
  covers?: { classic?: string; shaders?: string };
  warnings?: string[];
}

export const CORE_BASE = "packs/core/";

export async function loadCorePack(): Promise<LibraryItem[]> {
  const res = await fetch(`${CORE_BASE}pack.json`);
  if (!res.ok) throw new Error(`pack.json: HTTP ${res.status}`);
  const manifest = (await res.json()) as ContentPackManifest;
  return manifest.builds.map((b) => ({
    id: b.id,
    source: "core" as const,
    meta: b.meta,
    stats: b.stats ?? { size: [0, 0, 0], blocks: 0, materials: 0, steps: 0, difficulty: 1, minutes: 0 },
    previews: b.previews,
    file: CORE_BASE + b.file,
  }));
}

export function importToItem(r: ImportRecord): LibraryItem {
  return {
    id: r.id,
    source: "import",
    meta: r.meta,
    stats: r.stats,
    thumb: r.thumb,
    covers: r.covers,
    warnings: r.warnings,
  };
}

export async function loadImports(): Promise<LibraryItem[]> {
  const list = await getAll("imports");
  return list.sort((a, b) => b.createdAt - a.createdAt).map(importToItem);
}

/** Raw bytes of a build (.kbuild for both core and imported builds). */
export async function loadBuildBytes(item: LibraryItem): Promise<Uint8Array> {
  if (item.source === "core" && item.file) {
    const res = await fetch(item.file);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  const rec = await getOne("imports", item.id);
  if (!rec) throw new Error("not found");
  return rec.bytes;
}

export function previewUrl(
  item: LibraryItem,
  style: "classic" | "shaders",
  kind: "thumb" | "cover",
  angle = 0,
): string | undefined {
  if (item.source === "import") {
    const c = item.covers;
    return (style === "shaders" ? (c?.shaders ?? c?.classic) : c?.classic) ?? item.thumb;
  }
  const p = item.previews;
  if (!p) return undefined;
  if (kind === "thumb") {
    const rel = style === "shaders" ? (p.thumbCinematic ?? p.thumb) : (p.thumb ?? p.thumbCinematic);
    return rel ? CORE_BASE + rel : undefined;
  }
  const list = style === "shaders" ? (p.cinematic ?? p.classic) : (p.classic ?? p.cinematic);
  const rel = list?.[angle] ?? list?.[0];
  return rel ? CORE_BASE + rel : undefined;
}
