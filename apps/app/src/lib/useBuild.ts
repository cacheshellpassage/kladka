/** Loads a build (model + plan + materials) with a small in-memory cache. */
import { useEffect, useState } from "react";
import { decodeKBuild, materialList, type MaterialLine, type VoxelModel } from "@kladka/voxel-core";
import { useLibrary } from "../store/library";
import { loadBuildBytes, type LibraryItem } from "./content";
import { planInWorker, type SerializedPlan } from "./worker-client";

export interface LoadedBuild {
  item: LibraryItem;
  model: VoxelModel;
  plan: SerializedPlan;
  materials: MaterialLine[];
}

const cache = new Map<string, Promise<LoadedBuild>>();
const MAX_CACHE = 4;

export function loadBuild(item: LibraryItem): Promise<LoadedBuild> {
  const key = `${item.source}:${item.id}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const bytes = await loadBuildBytes(item);
      const { model } = decodeKBuild(bytes);
      const plan = await planInWorker(bytes);
      return { item, model, plan, materials: materialList(model) };
    })();
    p.catch(() => cache.delete(key));
    cache.set(key, p);
    while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
  }
  return p;
}

export function forgetBuild(id: string): void {
  for (const k of [...cache.keys()]) if (k.endsWith(`:${id}`)) cache.delete(k);
}

export function useBuild(id: string): {
  build: LoadedBuild | null;
  error: string | null;
  item: LibraryItem | undefined;
} {
  const status = useLibrary((s) => s.status);
  const item = useLibrary((s) => s.byId(id));
  const [build, setBuild] = useState<LoadedBuild | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setBuild(null);
    setError(null);
    if (!item) return;
    loadBuild(item).then(
      (b) => alive && setBuild(b),
      (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [item, status]);
  return { build, error, item };
}
