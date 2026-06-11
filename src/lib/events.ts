import {
  emit as tauriEmit,
  listen as tauriListen,
  type UnlistenFn,
} from "@tauri-apps/api/event";

/**
 * The cross-window event bus. SQLite is the source of truth; these events are
 * just change-notifications so the pet window and dashboard window stay in sync.
 */
export type AppEvent =
  | "tasks_changed"
  | "pet_emotion_changed"
  | "schedule_updated"
  | "active_block_changed"
  | "task_reminder"
  | "milestone_completed"
  | "level_up"
  | "achievement_unlocked"
  | "daily_report_ready"
  | "tray://sleep_pet";

export function emitApp<T = unknown>(event: AppEvent, payload?: T): Promise<void> {
  return tauriEmit(event, payload);
}

export function listenApp<T = unknown>(
  event: AppEvent,
  cb: (payload: T) => void,
): Promise<UnlistenFn> {
  return tauriListen<T>(event, (e) => cb(e.payload));
}
