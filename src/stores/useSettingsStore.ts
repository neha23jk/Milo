import { create } from "zustand";
import type { Settings } from "@/types";
import { getSettings, setSetting } from "@/services/settings";

interface SettingsStore {
  settings: Settings | null;
  load: () => Promise<void>;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  load: async () => {
    set({ settings: await getSettings() });
  },
  update: async (key, value) => {
    await setSetting(key, String(value));
    const current = get().settings;
    if (current) set({ settings: { ...current, [key]: value } });
  },
}));
