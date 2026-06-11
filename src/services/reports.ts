import { execute, query } from "@/db";
import { emitApp } from "@/lib/events";
import { previousDate, todayLocalDate } from "@/lib/datetime";
import { getProvider, MissingApiKeyError } from "@/services/ai";

// --- Daily report -----------------------------------------------------------

export interface DailyReport {
  date: string;
  completionRate: number; // 0..1
  focusMinutes: number;
  tasksCompleted: number;
  tasksMissed: number;
  aiSummary: string | null;
  createdAt: string | null;
}

interface ReportRow {
  date: string;
  completion_rate: number;
  focus_minutes: number;
  tasks_completed: number;
  tasks_missed: number;
  ai_summary: string | null;
  created_at: string | null;
}

function mapReport(r: ReportRow): DailyReport {
  return {
    date: r.date,
    completionRate: r.completion_rate,
    focusMinutes: r.focus_minutes,
    tasksCompleted: r.tasks_completed,
    tasksMissed: r.tasks_missed,
    aiSummary: r.ai_summary,
    createdAt: r.created_at,
  };
}

/** Raw, computed-on-the-fly stats for a date (independent of stored reports). */
async function computeStats(date: string): Promise<{
  total: number;
  completed: number;
  missed: number;
  completionRate: number;
  focusMinutes: number;
}> {
  const taskRows = await query<{ total: number; done: number; missed: number }>(
    `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
        SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) AS missed
       FROM tasks WHERE scheduled_date = ?`,
    [date],
  );
  const total = taskRows[0]?.total ?? 0;
  const completed = taskRows[0]?.done ?? 0;
  const missed = taskRows[0]?.missed ?? 0;

  const focusRows = await query<{ secs: number }>(
    "SELECT COALESCE(SUM(duration_seconds), 0) AS secs FROM focus_sessions WHERE substr(started_at, 1, 10) = ?",
    [date],
  );
  const focusMinutes = Math.round((focusRows[0]?.secs ?? 0) / 60);

  return {
    total,
    completed,
    missed,
    completionRate: total > 0 ? completed / total : 0,
    focusMinutes,
  };
}

export async function getReport(date: string): Promise<DailyReport | null> {
  const rows = await query<ReportRow>(
    "SELECT * FROM reports WHERE date = ?",
    [date],
  );
  return rows[0] ? mapReport(rows[0]) : null;
}

/**
 * Compute + persist the daily report. Adds an AI summary when a key is set;
 * falls back to a deterministic blurb otherwise. Emits `daily_report_ready`.
 */
export async function generateDailyReport(
  date: string = todayLocalDate(),
): Promise<DailyReport> {
  const stats = await computeStats(date);

  let aiSummary: string | null = null;
  const context =
    `Date ${date}: completed ${stats.completed}/${stats.total} tasks ` +
    `(${Math.round(stats.completionRate * 100)}%), ${stats.focusMinutes} focus minutes, ` +
    `${stats.missed} missed.`;
  try {
    const provider = await getProvider();
    aiSummary = await provider.generateSummary(context);
  } catch (err) {
    if (!(err instanceof MissingApiKeyError)) {
      // Network/other error: keep the deterministic fallback, don't throw.
    }
    aiSummary = fallbackSummary(stats);
  }

  await execute(
    `INSERT INTO reports
       (date, completion_rate, focus_minutes, tasks_completed, tasks_missed, ai_summary)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       completion_rate = excluded.completion_rate,
       focus_minutes = excluded.focus_minutes,
       tasks_completed = excluded.tasks_completed,
       tasks_missed = excluded.tasks_missed,
       ai_summary = excluded.ai_summary`,
    [
      date,
      stats.completionRate,
      stats.focusMinutes,
      stats.completed,
      stats.missed,
      aiSummary,
    ],
  );

  await emitApp("daily_report_ready", date);
  return (await getReport(date))!;
}

function fallbackSummary(stats: {
  completed: number;
  total: number;
  focusMinutes: number;
}): string {
  if (stats.total === 0) return "No tasks scheduled today — a fresh start awaits!";
  const pct = Math.round((stats.completed / stats.total) * 100);
  if (pct >= 80) return `Great day — ${pct}% done and ${stats.focusMinutes} min focused. Keep the streak alive!`;
  if (pct >= 40) return `Solid progress: ${pct}% complete, ${stats.focusMinutes} min focused. Tomorrow's another shot.`;
  return `Tough day (${pct}% done). Small steps count — let's regroup tomorrow.`;
}

// --- Analytics / trends -----------------------------------------------------

export interface DayStat {
  date: string; // YYYY-MM-DD
  completionRate: number; // 0..1
  tasksCompleted: number;
  tasksTotal: number;
  focusMinutes: number;
}

function lastNDates(n: number): string[] {
  const dates: string[] = [];
  let d = todayLocalDate();
  for (let i = 0; i < n; i++) {
    dates.unshift(d);
    d = previousDate(d);
  }
  return dates;
}

/** Per-day completion + focus for the last `days` days (oldest first). */
export async function getDailyStats(days = 7): Promise<DayStat[]> {
  const dates = lastNDates(days);
  const earliest = dates[0];

  const taskRows = await query<{ date: string; total: number; done: number }>(
    `SELECT scheduled_date AS date,
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done
       FROM tasks
      WHERE scheduled_date >= ?
      GROUP BY scheduled_date`,
    [earliest],
  );
  const taskByDate = new Map(taskRows.map((r) => [r.date, r]));

  const focusRows = await query<{ date: string; secs: number }>(
    `SELECT substr(started_at, 1, 10) AS date, SUM(duration_seconds) AS secs
       FROM focus_sessions
      WHERE started_at >= ?
      GROUP BY substr(started_at, 1, 10)`,
    [earliest],
  );
  const focusByDate = new Map(focusRows.map((r) => [r.date, r.secs]));

  return dates.map((date) => {
    const t = taskByDate.get(date);
    const total = t?.total ?? 0;
    const done = t?.done ?? 0;
    return {
      date,
      tasksTotal: total,
      tasksCompleted: done,
      completionRate: total > 0 ? done / total : 0,
      focusMinutes: Math.round((focusByDate.get(date) ?? 0) / 60),
    };
  });
}

export interface HourStat {
  hour: number; // 0..23
  focusMinutes: number;
}

/** Focus minutes bucketed by hour-of-day across all history. */
export async function getProductiveHours(): Promise<HourStat[]> {
  const rows = await query<{ hour: string; secs: number }>(
    `SELECT substr(started_at, 12, 2) AS hour, SUM(duration_seconds) AS secs
       FROM focus_sessions
      GROUP BY substr(started_at, 12, 2)`,
  );
  const byHour = new Map(
    rows.map((r) => [parseInt(r.hour, 10), Math.round(r.secs / 60)]),
  );
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    focusMinutes: byHour.get(hour) ?? 0,
  }));
}
