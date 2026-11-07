/** Local IndexedDB storage (imports, progress, favorites, optional resource pack). */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { BuildMeta, BuildStats } from "@kladka/voxel-core";

export interface ImportRecord {
  id: string;
  meta: BuildMeta;
  stats: BuildStats;
  /** .kbuild bytes (our compact format) */
  bytes: Uint8Array;
  thumb?: string;
  sourceFile: string;
  sourceFormat: string;
  warnings: string[];
  createdAt: number;
}

export interface ProgressRecord {
  id: string;
  /** Current step index. */
  step: number;
  /** Number of completed steps (steps 0..done-1 are done). */
  done: number;
  total: number;
  updatedAt: number;
}

export interface FavoriteRecord {
  id: string;
  at: number;
}

export interface ResourcePackRecord {
  id: "active";
  name: string;
  textures: Record<string, Uint8Array>;
}

interface Stores {
  imports: ImportRecord;
  progress: ProgressRecord;
  favorites: FavoriteRecord;
  resourcePack: ResourcePackRecord;
}
type StoreName = keyof Stores;

interface KladkaDB extends DBSchema {
  imports: { key: string; value: ImportRecord };
  progress: { key: string; value: ProgressRecord };
  favorites: { key: string; value: FavoriteRecord };
  resourcePack: { key: string; value: ResourcePackRecord };
}

const STORES: StoreName[] = ["imports", "progress", "favorites", "resourcePack"];
let dbp: Promise<IDBPDatabase<KladkaDB>> | null = null;
let memoryFallback = false;
const mem: { [K in StoreName]: Map<string, Stores[K]> } = {
  imports: new Map(),
  progress: new Map(),
  favorites: new Map(),
  resourcePack: new Map(),
};

function db(): Promise<IDBPDatabase<KladkaDB>> {
  if (!dbp) {
    dbp = openDB<KladkaDB>("kladka", 1, {
      upgrade(d) {
        for (const s of STORES) d.createObjectStore(s, { keyPath: "id" });
      },
    });
  }
  return dbp;
}

async function run<T>(fn: (d: IDBPDatabase<KladkaDB>) => Promise<T>, fallback: () => T): Promise<T> {
  if (memoryFallback || typeof indexedDB === "undefined") return fallback();
  try {
    return await fn(await db());
  } catch {
    // private mode / blocked storage: keep working in memory for this session
    memoryFallback = true;
    return fallback();
  }
}

export function getAll<S extends StoreName>(store: S): Promise<Stores[S][]> {
  return run(
    (d) => d.getAll(store) as Promise<Stores[S][]>,
    () => [...mem[store].values()],
  );
}

export function getOne<S extends StoreName>(store: S, id: string): Promise<Stores[S] | undefined> {
  return run(
    (d) => d.get(store, id) as Promise<Stores[S] | undefined>,
    () => mem[store].get(id),
  );
}

export async function put<S extends StoreName>(store: S, value: Stores[S]): Promise<void> {
  mem[store].set(value.id, value);
  await run(
    async (d) => {
      await d.put(store, value as never);
    },
    () => undefined,
  );
}

export async function remove(store: StoreName, id: string): Promise<void> {
  mem[store].delete(id);
  await run(
    (d) => d.delete(store, id),
    () => undefined,
  );
}

export async function clearAll(): Promise<void> {
  for (const s of STORES) mem[s].clear();
  await run(
    async (d) => {
      for (const s of STORES) await d.clear(s);
    },
    () => undefined,
  );
}

export async function estimateStorage(): Promise<number | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e?.usage ?? null;
  } catch {
    return null;
  }
}
