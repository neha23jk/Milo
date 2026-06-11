import { create } from "zustand";
import type { PetEmotion } from "@/types";
import { getPetState, setEmotion as svcSetEmotion } from "@/services/pet";

interface PetStore {
  emotion: PetEmotion;
  load: () => Promise<void>;
  setEmotion: (emotion: PetEmotion) => Promise<void>;
  /** Local-only update used when reacting to a broadcast event. */
  applyEmotion: (emotion: PetEmotion) => void;
}

export const usePetStore = create<PetStore>((set) => ({
  emotion: "idle",
  load: async () => {
    const state = await getPetState();
    set({ emotion: state.currentEmotion });
  },
  setEmotion: async (emotion) => {
    set({ emotion });
    await svcSetEmotion(emotion);
  },
  applyEmotion: (emotion) => set({ emotion }),
}));
