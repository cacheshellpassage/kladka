import type { LocalizedText } from "../model/model";

export type License = "CC0-1.0" | "CC-BY-4.0" | (string & {});

export type BuildStyle =
  | "rustic"
  | "medieval"
  | "japanese"
  | "nordic"
  | "coastal"
  | "fantasy"
  | "farm"
  | "industrial"
  | "modern"
  | "desert"
  | "imported";

/** Metadata of a build shipped in a content pack (or imported by the user). */
export interface BuildMeta {
  id: string;
  title: LocalizedText;
  description?: LocalizedText;
  author: string;
  license: License;
  /** ISO date (YYYY-MM-DD). */
  createdAt: string;
  style: BuildStyle;
  tags: string[];
  generator?: { name: string; params: Record<string, unknown>; seed?: number };
}

export interface ContentPackManifest {
  format: "kladka-pack";
  version: 1;
  id: string;
  name: LocalizedText;
  description?: LocalizedText;
  author: string;
  license: License;
  createdAt: string;
  game: "minecraft-java";
  builds: PackBuildEntry[];
}

export interface PackBuildEntry {
  id: string;
  /** Relative path of the build file (.kbuild, .schem, .litematic or .nbt). */
  file: string;
  meta: BuildMeta;
  /** Relative paths of preview images. */
  previews?: {
    classic?: string[];
    cinematic?: string[];
    thumb?: string;
    thumbCinematic?: string;
  };
  stats?: BuildStats;
}

export interface BuildStats {
  size: [number, number, number];
  blocks: number;
  materials: number;
  steps: number;
  difficulty: number;
  minutes: number;
}
