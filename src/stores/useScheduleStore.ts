import { create } from "zustand";
import type { BlockStatus } from "@/types";
import {
  generateSchedule,
  getSchedule,
  setBlockStatus as svcSetBlockStatus,
  type DaySchedule,
  type ScheduleBlockView,
} from "@/services/schedule";
import type { PackOverflow } from "@/services/scheduler/packer";

interface ScheduleStore {
  date: string | null;
  schedule: DaySchedule["schedule"] | null;
  blocks: ScheduleBlockView[];
  overflow: PackOverflow[];
  loading: boolean;
  generating: boolean;

  /** Load an existing schedule for a date (no generation). */
  load: (date: string) => Promise<void>;
  /** (Re)generate the schedule for a date from its open tasks. */
  generate: (date: string) => Promise<void>;
  setBlockStatus: (blockId: number, status: BlockStatus) => Promise<void>;
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  date: null,
  schedule: null,
  blocks: [],
  overflow: [],
  loading: false,
  generating: false,

  load: async (date) => {
    set({ loading: true, date });
    try {
      const day = await getSchedule(date);
      set({
        schedule: day?.schedule ?? null,
        blocks: day?.blocks ?? [],
        // keep last overflow only if same date, otherwise clear
        overflow: get().date === date ? get().overflow : [],
      });
    } finally {
      set({ loading: false });
    }
  },

  generate: async (date) => {
    set({ generating: true, date });
    try {
      const result = await generateSchedule(date);
      set({
        schedule: result.schedule,
        blocks: result.blocks,
        overflow: result.overflow,
      });
    } finally {
      set({ generating: false });
    }
  },

  setBlockStatus: async (blockId, status) => {
    await svcSetBlockStatus(blockId, status);
    const date = get().date;
    if (date) await get().load(date);
  },
}));
