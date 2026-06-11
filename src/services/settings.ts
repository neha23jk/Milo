import { execute, query } from "@/db";
import type { Settings } from "@/types";

const DEFAULTS: Settings = {
  theme: "system",
  provider: "gemini",
  defaultWorkStart: "09:00",
  defaultWorkEnd: "20:00",
  hideOnFullscreen: true,
  autostart: false,
};

export async function getSettings(): Promise<Settings> {
  const rows = await query<{ key: string; value: string }>(
    "SELECT key, value FROM settings",
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    theme: (map.theme as Settings["theme"]) ?? DEFAULTS.theme,
    provider: (map.provider as Settings["provider"]) ?? DEFAULTS.provider,
    defaultWorkStart: map.defaultWorkStart ?? DEFAULTS.defaultWorkStart,
    defaultWorkEnd: map.defaultWorkEnd ?? DEFAULTS.defaultWorkEnd,
    hideOnFullscreen: (map.hideOnFullscreen ?? "true") === "true",
    autostart: (map.autostart ?? "false") === "true",
  };
}

export async function setSetting(
  key: keyof Settings,
  value: string,
): Promise<void> {
  await execute(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}
