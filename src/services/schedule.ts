import { execute, query } from "@/db";
import { emitApp } from "@/lib/events";
import type {
  BlockStatus,
  BlockType,
  Priority,
  Schedule,
  ScheduleBlock,
} from "@/types";
import { getSettings } from "@/services/settings";
import {
  clearPendingForDate,
  scheduleNotification,
} from "@/services/notifications";
import {
  dateAtMinute,
  packSchedule,
  type PackOverflow,
  type PackTask,
} from "@/services/scheduler/packer";

// --- Row shapes -------------------------------------------------------------

interface ScheduleRow {
  id: number;
  date: string;
  available_start: string;
  available_end: string;
  ai_summary: string | null;
  generated_at: string;
}

interface BlockRow {
  id: number;
  schedule_id: number;
  task_id: number | null;
  milestone_id: number | null;
  block_type: string;
  start_time: string;
  end_time: string;
  status: string;
}

function mapSchedule(r: ScheduleRow): Schedule {
  return {
    id: r.id,
    date: r.date,
    availableStart: r.available_start,
    availableEnd: r.available_end,
    aiSummary: r.ai_summary,
    generatedAt: r.generated_at,
  };
}

function mapBlock(r: BlockRow): ScheduleBlock {
  return {
    id: r.id,
    scheduleId: r.schedule_id,
    taskId: r.task_id,
    milestoneId: r.milestone_id,
    blockType: r.block_type as BlockType,
    startTime: r.start_time,
    endTime: r.end_time,
    status: r.status as BlockStatus,
  };
}

/** A block joined with its task's title/priority for rendering. */
export interface ScheduleBlockView extends ScheduleBlock {
  title: string;
  priority: Priority | null;
  /** True when this block is a pinned fixed-time event. */
  fixed: boolean;
  /** Set when a task spans multiple blocks (e.g. split by breaks). */
  part?: { index: number; total: number };
}

export interface DaySchedule {
  schedule: Schedule;
  blocks: ScheduleBlockView[];
}

export interface GenerateResult extends DaySchedule {
  overflow: PackOverflow[];
}

// --- Reads ------------------------------------------------------------------

async function findSchedule(date: string): Promise<Schedule | null> {
  const rows = await query<ScheduleRow>(
    "SELECT * FROM schedules WHERE date = ?",
    [date],
  );
  return rows[0] ? mapSchedule(rows[0]) : null;
}

/** Loads the schedule for a date plus its blocks (with task titles). */
export async function getSchedule(date: string): Promise<DaySchedule | null> {
  const schedule = await findSchedule(date);
  if (!schedule) return null;

  const rows = await query<
    BlockRow & {
      title: string | null;
      priority: string | null;
      fixed_start: string | null;
    }
  >(
    `SELECT b.*, t.title AS title, t.priority AS priority, t.fixed_start AS fixed_start
       FROM schedule_blocks b
       LEFT JOIN tasks t ON t.id = b.task_id
      WHERE b.schedule_id = ?
      ORDER BY b.start_time ASC`,
    [schedule.id],
  );

  // Reconstruct "part n of m" labels for tasks split across multiple blocks
  // (part info isn't persisted; derive it from how many blocks share a task_id).
  const totalByTask = new Map<number, number>();
  for (const r of rows) {
    if (r.task_id != null) {
      totalByTask.set(r.task_id, (totalByTask.get(r.task_id) ?? 0) + 1);
    }
  }
  const seenByTask = new Map<number, number>();

  const blocks: ScheduleBlockView[] = rows.map((r) => {
    let part: ScheduleBlockView["part"];
    if (r.task_id != null) {
      const total = totalByTask.get(r.task_id) ?? 1;
      if (total > 1) {
        const index = (seenByTask.get(r.task_id) ?? 0) + 1;
        seenByTask.set(r.task_id, index);
        part = { index, total };
      }
    }
    return {
      ...mapBlock(r),
      title: r.title ?? (r.block_type === "break" ? "Break" : "Block"),
      priority: (r.priority as Priority | null) ?? null,
      fixed: r.fixed_start != null,
      part,
    };
  });

  return { schedule, blocks };
}

// --- Generation -------------------------------------------------------------

interface SchedulableTaskRow {
  id: number;
  title: string;
  priority: string;
  estimated_minutes: number;
  deadline: string | null;
  fixed_start: string | null;
  splittable: number;
}

/**
 * (Re)generate the day's schedule. Pulls the date's still-open tasks, runs the
 * deterministic packer over the available window, and replaces any existing
 * blocks for that date. Completed tasks are left out so a re-run naturally
 * reflows only the remaining work.
 */
export async function generateSchedule(date: string): Promise<GenerateResult> {
  const settings = await getSettings();

  const taskRows = await query<SchedulableTaskRow>(
    `SELECT id, title, priority, estimated_minutes, deadline, fixed_start, splittable
       FROM tasks
      WHERE scheduled_date = ? AND status IN ('pending', 'in_progress')
      ORDER BY id ASC`,
    [date],
  );

  const packTasks: PackTask[] = taskRows.map((r) => ({
    id: r.id,
    title: r.title,
    priority: r.priority as Priority,
    estimatedMinutes: r.estimated_minutes,
    deadline: r.deadline,
    fixedStart: r.fixed_start,
    splittable: r.splittable !== 0,
  }));

  const { blocks, overflow } = packSchedule(
    packTasks,
    settings.defaultWorkStart,
    settings.defaultWorkEnd,
  );

  // Upsert the schedule row for this date.
  await execute(
    `INSERT INTO schedules (date, available_start, available_end, generated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(date) DO UPDATE SET
       available_start = excluded.available_start,
       available_end = excluded.available_end,
       generated_at = excluded.generated_at`,
    [date, settings.defaultWorkStart, settings.defaultWorkEnd],
  );

  const schedule = (await findSchedule(date))!;

  // Replace blocks wholesale — simplest correct reflow. Reminders for the day
  // are rebuilt to match (drop stale pending ones first).
  await execute("DELETE FROM schedule_blocks WHERE schedule_id = ?", [
    schedule.id,
  ]);
  await clearPendingForDate(date);

  const titleById = new Map(taskRows.map((r) => [r.id, r.title]));

  for (const b of blocks) {
    const startIso = dateAtMinute(date, b.startMinute);
    await execute(
      `INSERT INTO schedule_blocks
         (schedule_id, task_id, milestone_id, block_type, start_time, end_time, status)
       VALUES (?, ?, NULL, ?, ?, ?, 'scheduled')`,
      [schedule.id, b.taskId, b.blockType, startIso, dateAtMinute(date, b.endMinute)],
    );

    // One reminder per task block, fired when the block begins.
    if (b.blockType === "task" && b.taskId != null) {
      const title = titleById.get(b.taskId) ?? "Time to focus";
      await scheduleNotification({
        type: "task_reminder",
        title: "Time to focus ✨",
        body: title,
        relatedTaskId: b.taskId,
        scheduledFor: startIso,
      });
    }
  }

  await emitApp("schedule_updated");

  const day = (await getSchedule(date))!;
  return { ...day, overflow };
}

/** Re-flow the remaining (incomplete) work for a date. */
export async function reschedule(date: string): Promise<GenerateResult> {
  return generateSchedule(date);
}

/** Update a single block's status (e.g. mark active / done / skipped). */
export async function setBlockStatus(
  blockId: number,
  status: BlockStatus,
): Promise<void> {
  await execute("UPDATE schedule_blocks SET status = ? WHERE id = ?", [
    status,
    blockId,
  ]);
  await emitApp("active_block_changed", blockId);
}
