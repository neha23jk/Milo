import { execute, query } from "@/db";
import { emitApp } from "@/lib/events";
import type { Milestone, MilestoneStatus } from "@/types";

interface MilestoneRow {
  id: number;
  task_id: number;
  title: string;
  order_index: number;
  status: string;
  estimated_minutes: number;
  xp_reward: number;
  completed_at: string | null;
}

function mapMilestone(r: MilestoneRow): Milestone {
  return {
    id: r.id,
    taskId: r.task_id,
    title: r.title,
    orderIndex: r.order_index,
    status: r.status as MilestoneStatus,
    estimatedMinutes: r.estimated_minutes,
    xpReward: r.xp_reward,
    completedAt: r.completed_at,
  };
}

export interface NewMilestone {
  title: string;
  estimatedMinutes?: number;
  xpReward?: number;
}

export async function listMilestones(taskId: number): Promise<Milestone[]> {
  const rows = await query<MilestoneRow>(
    "SELECT * FROM milestones WHERE task_id = ? ORDER BY order_index ASC, id ASC",
    [taskId],
  );
  return rows.map(mapMilestone);
}

/** Batch-load milestones for several tasks at once, grouped by task id. */
export async function listMilestonesForTasks(
  taskIds: number[],
): Promise<Record<number, Milestone[]>> {
  const grouped: Record<number, Milestone[]> = {};
  if (taskIds.length === 0) return grouped;

  const placeholders = taskIds.map(() => "?").join(", ");
  const rows = await query<MilestoneRow>(
    `SELECT * FROM milestones WHERE task_id IN (${placeholders})
     ORDER BY task_id ASC, order_index ASC, id ASC`,
    taskIds,
  );
  for (const r of rows) {
    (grouped[r.task_id] ??= []).push(mapMilestone(r));
  }
  return grouped;
}

/** Bulk-insert milestones for a task (used when the AI breaks a task down). */
export async function addMilestones(
  taskId: number,
  milestones: NewMilestone[],
): Promise<void> {
  if (milestones.length === 0) return;
  let order = 0;
  for (const m of milestones) {
    await execute(
      `INSERT INTO milestones (task_id, title, order_index, estimated_minutes, xp_reward)
       VALUES (?, ?, ?, ?, ?)`,
      [
        taskId,
        m.title,
        order++,
        m.estimatedMinutes ?? 15,
        m.xpReward ?? 10,
      ],
    );
  }
  await emitApp("tasks_changed");
}

/** Flip a milestone done/pending. Emits `milestone_completed` when completed. */
export async function setMilestoneStatus(
  id: number,
  status: MilestoneStatus,
): Promise<void> {
  const completedAt = status === "done" ? new Date().toISOString() : null;
  await execute(
    "UPDATE milestones SET status = ?, completed_at = ? WHERE id = ?",
    [status, completedAt, id],
  );
  await emitApp("tasks_changed");
  if (status === "done") {
    await emitApp("milestone_completed", id);
  }
}

export async function deleteMilestone(id: number): Promise<void> {
  await execute("DELETE FROM milestones WHERE id = ?", [id]);
  await emitApp("tasks_changed");
}
