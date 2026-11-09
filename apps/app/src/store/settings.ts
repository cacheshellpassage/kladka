/** User settings (persisted in localStorage; small and synchronous). */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Locale = "ru" | "en";
export type ThemePref = "system" | "light" | "dark";
export type QualityPref = "low" | "medium" | "high";
export type ModePref = "classic" | "shaders";
export type Units = "pieces" | "stacks" | "shulkers";

export interface Settings {
  locale: Locale;
  theme: ThemePref;
  quality: QualityPref;
  renderMode: ModePref;
  hand: "right" | "left";
  cameraButtons: boolean;
  textScale: number;
  units: Units;
  coverStyle: ModePref;
  showFuture: boolean;
  ghostBelow: boolean;
  autoCamera: boolean;
  autoCutaway: boolean;
  onboarded: boolean;
  guideView: "3d" | "2d" | "split";
  rememberResourcePack: boolean;
}

interface SettingsState extends Settings {
  set: (patch: Partial<Settings>) => void;
  reset: () => void;
}

function defaultLocale(): Locale {
  try {
    const l = (navigator.language || "ru").toLowerCase();
    return l.startsWith("ru") || l.startsWith("uk") || l.startsWith("be") || l.startsWith("kk") ? "ru" : "en";
  } catch {
    return "ru";
  }
}

function defaultQuality(): QualityPref {
  try {
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    const coarse = matchMedia("(pointer: coarse)").matches;
    if (coarse && mem <= 3) return "low";
    return coarse ? "medium" : "high";
  } catch {
    return "medium";
  }
}

export const DEFAULT_SETTINGS: Settings = {
  locale: defaultLocale(),
  theme: "system",
  quality: defaultQuality(),
  renderMode: "classic",
  hand: "right",
  cameraButtons: true,
  textScale: 1,
  units: "stacks",
  coverStyle: "classic",
  showFuture: false,
  ghostBelow: false,
  autoCamera: true,
  autoCutaway: true,
  onboarded: false,
  guideView: "split",
  rememberResourcePack: false,
};

const safeStorage = createJSONStorage(() => {
  try {
    const k = "__kladka_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }
});

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    { name: "kladka.settings", version: 1, storage: safeStorage },
  ),
);

export function effectiveTheme(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref;
  try {
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}
