import { create } from "zustand";
import type { Milestone, MilestoneStatus } from "@/types";
import {
  listMilestonesForTasks,
  setMilestoneStatus as svcSetStatus,
} from "@/services/milestones";

interface MilestoneStore {
  /** Milestones grouped by task id. */
  byTask: Record<number, Milestone[]>;
  load: (taskIds: number[]) => Promise<void>;
  /** Toggle a milestone; resolves to its new status (or null if not found). */
  toggle: (
    taskId: number,
    milestoneId: number,
  ) => Promise<MilestoneStatus | null>;
}

export const useMilestoneStore = create<MilestoneStore>((set, get) => ({
  byTask: {},
  load: async (taskIds) => {
    const byTask = await listMilestonesForTasks(taskIds);
    set({ byTask });
  },
  toggle: async (taskId, milestoneId) => {
    const current = get().byTask[taskId] ?? [];
    const m = current.find((x) => x.id === milestoneId);
    if (!m) return null;
    const next: MilestoneStatus = m.status === "done" ? "pending" : "done";
    await svcSetStatus(milestoneId, next);
    // Optimistic local update so the checkbox feels instant.
    set((s) => ({
      byTask: {
        ...s.byTask,
        [taskId]: (s.byTask[taskId] ?? []).map((x) =>
          x.id === milestoneId ? { ...x, status: next } : x,
        ),
      },
    }));
    return next;
  },
}));
