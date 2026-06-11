import { create } from "zustand";
import type { Task } from "@/types";
import {
  completeTask as svcComplete,
  createTask as svcCreate,
  deleteTask as svcDelete,
  listTasks,
  type CreateTaskInput,
} from "@/services/tasks";

interface TaskStore {
  tasks: Task[];
  loading: boolean;
  load: (date?: string) => Promise<void>;
  add: (input: CreateTaskInput) => Promise<void>;
  complete: (id: number) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,
  load: async (date) => {
    set({ loading: true });
    try {
      const tasks = await listTasks(date);
      set({ tasks });
    } finally {
      set({ loading: false });
    }
  },
  add: async (input) => {
    await svcCreate(input);
    await get().load();
  },
  complete: async (id) => {
    await svcComplete(id);
    await get().load();
  },
  remove: async (id) => {
    await svcDelete(id);
    await get().load();
  },
}));
