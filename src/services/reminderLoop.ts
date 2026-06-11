import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { emitApp } from "@/lib/events";
import { setEmotion } from "@/services/pet";
import { dueNotifications, markFired } from "@/services/notifications";

const TICK_MS = 30_000;

let timer: ReturnType<typeof setInterval> | null = null;
let ticking = false;

async function ensurePermission(): Promise<boolean> {
  try {
    if (await isPermissionGranted()) return true;
    const result = await requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

async function tick(): Promise<void> {
  if (ticking) return; // avoid overlapping ticks
  ticking = true;
  try {
    const due = await dueNotifications();
    if (due.length === 0) return;

    const granted = await ensurePermission();

    for (const n of due) {
      if (granted) {
        try {
          sendNotification({ title: n.title, body: n.body ?? undefined });
        } catch {
          // OS notification failed; still mark fired + emit in-app event.
        }
      }
      await markFired(n.id);
      await emitApp("task_reminder", n);
    }

    // Pet reacts to the most recent reminder.
    await setEmotion("excited");
    setTimeout(() => void setEmotion("idle"), 4000);
  } finally {
    ticking = false;
  }
}

/** Start the reminder loop (idempotent). Returns a stop function. */
export function startReminderLoop(): () => void {
  if (timer) return stopReminderLoop;
  // Kick once on startup so overdue reminders fire promptly, then poll.
  void tick();
  timer = setInterval(() => void tick(), TICK_MS);
  return stopReminderLoop;
}

export function stopReminderLoop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
