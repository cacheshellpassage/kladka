/** Content-pack assembly (shared by the build script, the renderer and tests). */
import {
  encodeKBuild,
  estimate,
  materialList,
  planBuild,
  type BuildStats,
  type ContentPackManifest,
  type PackBuildEntry,
} from "@kladka/voxel-core";
import {
  CATALOG,
  CONTENT_AUTHOR,
  CONTENT_DATE,
  CONTENT_LICENSE,
  buildEntry,
  type CatalogEntry,
} from "./catalog";

export interface BuiltBuild {
  entry: PackBuildEntry;
  bytes: Uint8Array;
}

export function buildOne(e: CatalogEntry): BuiltBuild {
  const { model, meta } = buildEntry(e);
  const plan = planBuild(model);
  const mats = materialList(model);
  const est = estimate(model, plan, mats.length);
  const stats: BuildStats = {
    size: [model.size.x, model.size.y, model.size.z],
    blocks: plan.totalBlocks,
    materials: mats.length,
    steps: plan.steps.length,
    difficulty: est.difficulty,
    minutes: est.minutes,
  };
  return {
    entry: { id: e.id, file: `builds/${e.id}.kbuild`, meta, stats },
    bytes: encodeKBuild(model, meta),
  };
}

export function packManifest(builds: PackBuildEntry[]): ContentPackManifest {
  return {
    format: "kladka-pack",
    version: 1,
    id: "core",
    name: { ru: "Базовый набор", en: "Core pack" },
    description: {
      ru: "Оригинальные постройки, созданные генераторами проекта. Лицензия CC0.",
      en: "Original builds produced by the project's generators. Licensed CC0.",
    },
    author: CONTENT_AUTHOR,
    license: CONTENT_LICENSE,
    createdAt: CONTENT_DATE,
    game: "minecraft-java",
    builds,
  };
}

export { CATALOG };
