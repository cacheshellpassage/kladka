/** Transient UI state: toasts and the active resource-pack texture provider. */
import { create } from "zustand";
import type { TextureProvider } from "@kladka/viewer";

interface UiState {
  toast: string | null;
  showToast: (msg: string) => void;
  provider: TextureProvider | null;
  providerInfo: { name: string; count: number } | null;
  setProvider: (p: TextureProvider | null, info: { name: string; count: number } | null) => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useUi = create<UiState>()((set) => ({
  toast: null,
  showToast: (msg) => {
    clearTimeout(timer);
    set({ toast: msg });
    timer = setTimeout(() => set({ toast: null }), 3200);
  },
  provider: null,
  providerInfo: null,
  setProvider: (provider, providerInfo) => set({ provider, providerInfo }),
}));
