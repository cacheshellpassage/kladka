/** Library state: core + imported builds, favorites and progress. */
import { create } from "zustand";
import { getAll, put, remove, type ProgressRecord } from "../db/db";
import { loadCorePack, loadImports, type LibraryItem } from "../lib/content";

interface LibraryState {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  core: LibraryItem[];
  imports: LibraryItem[];
  favorites: Set<string>;
  progress: Map<string, ProgressRecord>;
  load: () => Promise<void>;
  reloadImports: () => Promise<void>;
  toggleFavorite: (id: string) => void;
  saveProgress: (p: Omit<ProgressRecord, "updatedAt">) => void;
  removeImport: (id: string) => Promise<void>;
  byId: (id: string) => LibraryItem | undefined;
}

export const useLibrary = create<LibraryState>()((set, get) => ({
  status: "idle",
  error: null,
  core: [],
  imports: [],
  favorites: new Set(),
  progress: new Map(),

  load: async () => {
    if (get().status === "loading" || get().status === "ready") return;
    set({ status: "loading", error: null });
    try {
      const [core, imports, favs, progress] = await Promise.all([
        loadCorePack(),
        loadImports(),
        getAll("favorites"),
        getAll("progress"),
      ]);
      set({
        core,
        imports,
        favorites: new Set(favs.map((f) => f.id)),
        progress: new Map(progress.map((p) => [p.id, p])),
        status: "ready",
      });
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  },

  reloadImports: async () => {
    set({ imports: await loadImports() });
  },

  toggleFavorite: (id) => {
    const favorites = new Set(get().favorites);
    if (favorites.has(id)) {
      favorites.delete(id);
      void remove("favorites", id);
    } else {
      favorites.add(id);
      void put("favorites", { id, at: Date.now() });
    }
    set({ favorites });
  },

  saveProgress: (p) => {
    const rec: ProgressRecord = { ...p, updatedAt: Date.now() };
    const progress = new Map(get().progress);
    progress.set(p.id, rec);
    set({ progress });
    void put("progress", rec);
  },

  removeImport: async (id) => {
    await remove("imports", id);
    await remove("progress", id);
    const progress = new Map(get().progress);
    progress.delete(id);
    set({ imports: get().imports.filter((i) => i.id !== id), progress });
  },

  byId: (id) => get().core.find((b) => b.id === id) ?? get().imports.find((b) => b.id === id),
}));
