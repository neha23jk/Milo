import { create } from "zustand";
import { endFocusSession, startFocusSession } from "@/services/focus";
import { setEmotion } from "@/services/pet";

interface FocusStore {
  sessionId: number | null;
  /** Epoch ms when the current session started (for elapsed calc). */
  startedAt: number | null;
  taskId: number | null;
  /** Live elapsed seconds, updated by a ticking interval while running. */
  elapsed: number;
  start: (taskId?: number | null) => Promise<void>;
  stop: () => Promise<void>;
  tick: () => void;
}

export const useFocusStore = create<FocusStore>((set, get) => ({
  sessionId: null,
  startedAt: null,
  taskId: null,
  elapsed: 0,

  start: async (taskId = null) => {
    if (get().sessionId) return; // already running
    const id = await startFocusSession(taskId);
    set({ sessionId: id, startedAt: Date.now(), taskId, elapsed: 0 });
    await setEmotion("working");
  },

  stop: async () => {
    const { sessionId, startedAt } = get();
    if (sessionId == null || startedAt == null) return;
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    await endFocusSession(sessionId, seconds);
    set({ sessionId: null, startedAt: null, taskId: null, elapsed: 0 });
    await setEmotion("idle");
  },

  tick: () => {
    const { startedAt } = get();
    if (startedAt == null) return;
    set({ elapsed: Math.round((Date.now() - startedAt) / 1000) });
  },
}));
