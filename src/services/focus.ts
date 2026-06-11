import { execute, query } from "@/db";
import { nowLocalIso } from "@/lib/datetime";

// Focus sessions track time spent heads-down on (optionally) a specific task.
// started_at / ended_at are stored as local ISO "YYYY-MM-DDTHH:MM:SS".

export async function startFocusSession(
  taskId: number | null = null,
): Promise<number> {
  const { lastInsertId } = await execute(
    "INSERT INTO focus_sessions (task_id, started_at) VALUES (?, ?)",
    [taskId, nowLocalIso()],
  );
  return lastInsertId;
}

/** Close an open session, recording its duration. */
export async function endFocusSession(
  id: number,
  durationSeconds: number,
): Promise<void> {
  await execute(
    "UPDATE focus_sessions SET ended_at = ?, duration_seconds = ? WHERE id = ?",
    [nowLocalIso(), Math.max(0, Math.round(durationSeconds)), id],
  );
}

/** Total focus minutes logged on a given local date (YYYY-MM-DD). */
export async function focusMinutesForDate(date: string): Promise<number> {
  const rows = await query<{ secs: number }>(
    "SELECT COALESCE(SUM(duration_seconds), 0) AS secs FROM focus_sessions WHERE substr(started_at, 1, 10) = ?",
    [date],
  );
  return Math.round((rows[0]?.secs ?? 0) / 60);
}
