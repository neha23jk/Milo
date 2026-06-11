import { execute, query } from "@/db";
import { emitApp } from "@/lib/events";
import type { Priority, Task, TaskStatus } from "@/types";

interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  priority: string;
  deadline: string | null;
  estimated_minutes: number;
  status: string;
  scheduled_date: string | null;
  fixed_start: string | null;
  splittable: number;
  tags: string;
  created_at: string;
  completed_at: string | null;
}

function mapTask(r: TaskRow): Task {
  let tags: string[] = [];
  try {
    tags = JSON.parse(r.tags || "[]");
  } catch {
    tags = [];
  }
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    priority: r.priority as Priority,
    deadline: r.deadline,
    estimatedMinutes: r.estimated_minutes,
    status: r.status as TaskStatus,
    scheduledDate: r.scheduled_date,
    fixedStart: r.fixed_start,
    splittable: r.splittable !== 0,
    tags,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  };
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  priority?: Priority;
  deadline?: string | null;
  estimatedMinutes?: number;
  scheduledDate?: string | null;
  fixedStart?: string | null;
  splittable?: boolean;
  tags?: string[];
}

export async function listTasks(date?: string): Promise<Task[]> {
  const rows = date
    ? await query<TaskRow>(
        "SELECT * FROM tasks WHERE scheduled_date = ? ORDER BY id DESC",
        [date],
      )
    : await query<TaskRow>("SELECT * FROM tasks ORDER BY id DESC");
  return rows.map(mapTask);
}

export async function createTask(input: CreateTaskInput): Promise<number> {
  const { lastInsertId } = await execute(
    `INSERT INTO tasks
       (title, description, priority, deadline, estimated_minutes, scheduled_date, fixed_start, splittable, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.title,
      input.description ?? null,
      input.priority ?? "medium",
      input.deadline ?? null,
      input.estimatedMinutes ?? 30,
      input.scheduledDate ?? null,
      input.fixedStart ?? null,
      input.splittable === false ? 0 : 1,
      JSON.stringify(input.tags ?? []),
    ],
  );
  await emitApp("tasks_changed");
  return lastInsertId;
}

export async function updateTaskStatus(
  id: number,
  status: TaskStatus,
): Promise<void> {
  const completedAt = status === "done" ? new Date().toISOString() : null;
  await execute(
    "UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?",
    [status, completedAt, id],
  );
  await emitApp("tasks_changed");
}

export async function completeTask(id: number): Promise<void> {
  await updateTaskStatus(id, "done");
}

export async function deleteTask(id: number): Promise<void> {
  await execute("DELETE FROM tasks WHERE id = ?", [id]);
  await emitApp("tasks_changed");
}
