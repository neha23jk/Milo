import { execute, query } from "@/db";
import { nowLocalIso } from "@/lib/datetime";

export type NotificationType = "task_reminder" | "deadline" | "break" | "system";

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  body: string | null;
  relatedTaskId: number | null;
  scheduledFor: string; // local ISO "YYYY-MM-DDTHH:MM:SS"
  firedAt: string | null;
  status: "pending" | "fired" | "cancelled";
}

interface NotificationRow {
  id: number;
  type: string;
  title: string;
  body: string | null;
  related_task_id: number | null;
  scheduled_for: string;
  fired_at: string | null;
  status: string;
}

function mapNotification(r: NotificationRow): AppNotification {
  return {
    id: r.id,
    type: r.type as NotificationType,
    title: r.title,
    body: r.body,
    relatedTaskId: r.related_task_id,
    scheduledFor: r.scheduled_for,
    firedAt: r.fired_at,
    status: r.status as AppNotification["status"],
  };
}

export interface ScheduleNotificationInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  relatedTaskId?: number | null;
  scheduledFor: string; // local ISO
}

export async function scheduleNotification(
  input: ScheduleNotificationInput,
): Promise<void> {
  await execute(
    `INSERT INTO notifications (type, title, body, related_task_id, scheduled_for, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [
      input.type,
      input.title,
      input.body ?? null,
      input.relatedTaskId ?? null,
      input.scheduledFor,
    ],
  );
}

/** Pending notifications whose time has arrived (scheduled_for <= now). */
export async function dueNotifications(): Promise<AppNotification[]> {
  const rows = await query<NotificationRow>(
    `SELECT * FROM notifications
      WHERE status = 'pending' AND scheduled_for <= ?
      ORDER BY scheduled_for ASC`,
    [nowLocalIso()],
  );
  return rows.map(mapNotification);
}

export async function markFired(id: number): Promise<void> {
  await execute(
    "UPDATE notifications SET status = 'fired', fired_at = ? WHERE id = ?",
    [nowLocalIso(), id],
  );
}

/** Drop still-pending reminders for a given day (by scheduled_for prefix). */
export async function clearPendingForDate(date: string): Promise<void> {
  await execute(
    "DELETE FROM notifications WHERE status = 'pending' AND scheduled_for LIKE ?",
    [`${date}%`],
  );
}
