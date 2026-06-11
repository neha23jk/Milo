# Mochi AI — Work Tracker

> Status snapshot as of **2026-06-12** (updated: scheduler+timeline, milestones,
> reminders/notifications, gamification, analytics shipped). Built vs. left below.
> Full design spec: [`idea.md`](./idea.md) · Setup: [`SETUP.md`](./SETUP.md)
>
> **Frontend builds clean** (`npm run build` ✓, both windows bundle). Rust shell not yet
> run/compiled locally (needs MSVC + rustup per SETUP.md).

---

## Legend
- ✅ Done — implemented and type-checks
- 🟡 Partial — scaffolded or half-wired, needs finishing
- ⬜ Not started — schema/placeholder may exist, no logic/UI

---

## Implementation steps (from idea.md §"Detailed Implementation Steps")

| # | Step | Status |
| --- | --- | --- |
| 1 | Scaffold Tauri + React + TS + Vite + Tailwind + shadcn/ui + Framer Motion + Zustand + Recharts | ✅ |
| 2 | Two windows (`main`/dashboard, `pet`) in `tauri.conf.json`; pet transparent/frameless/always-on-top | ✅ |
| 3 | Vite multi-page (`index.html`, `pet.html`) with `DashboardApp` + `PetApp` roots | ✅ |
| 4 | `tauri-plugin-sql` SQLite; schema migrations run on startup | ✅ |
| 5 | TS `db/` typed query helpers + `services/tasks` CRUD | ✅ |
| 6 | `useTaskStore` (Zustand) + task list / cards UI | ✅ |
| 7 | Secure-store BYOK `setApiKey`/`testApiKey` + Settings view | ✅ |
| 8 | `LlmProvider` interface + `GeminiProvider` (REST + structured output, `breakdownTasks`, `classifyIntent`) | ✅ |
| 9 | **Deterministic packing engine** + `generateSchedule`/`getSchedule`/`reschedule` services | ✅ |
| 10 | `TimelineView` + `ScheduleBlock` + `useScheduleStore`; morning chat flow | ✅ |
| 11 | Rive pet + click-through (`setIgnoreCursorEvents`) + drag; autostart; tray; fullscreen auto-hide; close-to-hide | 🟡 |
| 12 | Scheduler/reminder loop in pet window + notifications + cross-window event sync | ✅ |

---

## Done ✅

### Project & shell
- Tauri v2 scaffold, all deps installed (`package.json`), `npm run build` passes.
- Two-window config (`src-tauri/tauri.conf.json`): dashboard `main` + floating `pet` (transparent, frameless, always-on-top, skipTaskbar).
- Multi-page Vite (`index.html` + `pet.html`, `vite.config.ts`), entry roots `src/main.tsx` / `src/pet.tsx`.
- System tray with menu (Show Dashboard / Sleep Pet / Quit) — `src-tauri/src/lib.rs`.
- Close-dashboard-to-hide (app keeps living) — `lib.rs` `on_window_event`.
- Autostart plugin registered (Rust) + toggle wired in Settings.

### Data layer
- Full SQLite schema, **all tables present** (`src/db/schema.ts`): profile, tasks, milestones, schedules, schedule_blocks, focus_sessions, reports, pet_state, achievements, user_achievements, inventory, notifications, activity_log, settings + seeds.
- Singleton DB connection + `query`/`execute` helpers, WAL + FK pragmas (`src/db/index.ts`).
- `services/tasks.ts` — list / create / updateStatus / complete / delete (+ emits `tasks_changed`).
- `services/settings.ts` — get/set settings.
- `services/pet.ts` — getPetState / setEmotion / touchInteraction.

### AI
- `LlmProvider` interface + `MissingApiKeyError` (`src/services/ai/provider.ts`).
- `GeminiProvider` (`gemini.ts`) — `breakdownTasks` (structured JSON schema), `generateSummary`, `classifyIntent` guardrail.
- Provider factory (`ai/index.ts`), BYOK secure store (`src/lib/secureStore.ts`).

### UI / state
- `DashboardApp` shell — sidebar nav (Today / Settings), theme apply, cross-window task sync.
- `TodayView` — "Plan my day" (AI breakdown → tasks), quick-add, complete w/ pet celebrate, delete, % complete.
- `SettingsView` — BYOK key save/test, schedule-default hours, theme picker, autostart toggle, hide-on-fullscreen toggle.
- Zustand stores: `useTaskStore`, `useSettingsStore`, `usePetStore`.
- Cross-window event bus typed (`src/lib/events.ts`).

### Pet window
- Floating draggable pet, click → opens/focuses dashboard (`PetApp.tsx`).
- Emotion state synced via `pet_emotion_changed` event; tray "sleep" handled.
- Emoji-based `PetSprite` **placeholder** (8 emotions + speech bubbles).

### Scheduler + Timeline (Steps 9–10)
- **Deterministic packer** (`src/services/scheduler/packer.ts`) — pure, no DB/LLM.
  Priority + deadline ordering, splits long tasks into focus chunks with breaks
  (pomodoro-ish), reports overflow instead of dropping work. Time helpers
  (`hmToMinutes`/`minutesToHm`/`dateAtMinute`).
- **Schedule service** (`src/services/schedule.ts`) — `generateSchedule`,
  `getSchedule` (joins task titles, reconstructs "part n/m"), `reschedule`,
  `setBlockStatus`. Upserts `schedules`, replaces `schedule_blocks`, emits
  `schedule_updated` / `active_block_changed`.
- **`useScheduleStore`** (Zustand) + **`TimelineView`** — day timeline with
  time column, priority accent, breaks, per-block done/skip, Generate/Reflow,
  overflow panel. Wired into dashboard nav as "Schedule" tab.

### Milestones (Step C)
- **`services/milestones.ts`** — list / batch-list-for-tasks / `addMilestones`
  (bulk from AI) / `setMilestoneStatus` (emits `milestone_completed`) / delete.
- **`useMilestoneStore`** — milestones grouped by task, optimistic toggle.
- `TodayView` now **persists** AI-returned milestones (previously dropped) and
  shows an expandable per-task checklist with `done/total steps` count.

### Reminders + notifications (Step 12 / D)
- **`services/notifications.ts`** — `scheduleNotification`, `dueNotifications`
  (local-ISO `<= now`), `markFired`, `clearPendingForDate`.
- **`services/reminderLoop.ts`** — 30s poll, OS permission request, fires via
  `tauri-plugin-notification`, marks fired, emits `task_reminder`, pet reacts
  (excited → idle). Idempotent start/stop.
- **Pet window owns the loop** (`PetApp` starts/stops it) — no Rust daemon.
- `generateSchedule` now **creates a reminder per task block** at its start time
  (and clears stale pending reminders for the date on reflow).
- `src/lib/datetime.ts` — `nowLocalIso` / `todayLocalDate` local-time helpers.

### Gamification (Step E)
- **`services/gamification.ts`** — `getProfile` (with `xpToNext` curve =
  `100 + (level-1)*50`), `awardTaskCompleted` (+25 XP/+5 coins),
  `awardMilestoneCompleted` (milestone `xp_reward`/+2 coins). Level-up rollover
  loop grants bonus coins + emits `level_up`. Daily **streak** roll
  (current/longest via `last_active_date` + `previousDate`). `activity_log`
  writes. Achievements engine: JSON `{metric,gte}` criteria evaluated in TS,
  unlocks → `user_achievements`, grants reward, emits `achievement_unlocked`.
- **8 seeded achievements** (`db/schema.ts`): tasks-completed (1/10/50),
  streak (3/7/30), level (5/10).
- **`useProfileStore`** — live profile; dashboard reloads on
  `profile_changed`/`level_up`.
- **UI**: `ProfilePanel` (sidebar level ring + XP bar + streak + coins),
  `RewardsView` ("Rewards" tab — stat cards + achievements grid),
  `RewardToast` (animated level-up / achievement popups). Pet celebrates on
  `level_up`.
- Award wiring in `TodayView`: task completion (guarded against re-award) and
  per-milestone completion both grant XP/coins and refresh the profile.
- New event: `profile_changed`.

### Analytics & reports (Step F)
- **`services/focus.ts`** — `startFocusSession` / `endFocusSession` /
  `focusMinutesForDate`; sessions stored with local-ISO timestamps.
- **`useFocusStore`** — running session + live elapsed tick; pet goes
  `working` while focusing.
- **`FocusTimer`** component on the Today view (start/stop, mm:ss).
- **`services/reports.ts`** — `generateDailyReport` (completion rate, focus
  minutes, done/missed; AI summary via `generateSummary` with a deterministic
  fallback when no key), `getReport`, plus analytics queries `getDailyStats`
  (7-day) and `getProductiveHours` (focus by hour-of-day). Emits
  `daily_report_ready`.
- **`AnalyticsView`** ("Insights" tab) — today's report card with AI summary +
  Generate, and three **Recharts** panels: completion-rate area, focus-minutes
  bar, productive-hours bar.

---

## Remaining ⬜ / 🟡

### A. Scheduler engine (Step 9) — ✅ DONE (see Done section)

### B. Timeline UI (Step 10) — ✅ DONE (see Done section)
Follow-ups (nice-to-have, not blocking):
- [ ] Auto-reflow schedule when a task is completed/added (currently manual Reflow button).
- [ ] "Current/next block" highlight against the live clock.
- [ ] Block status (done/skipped) feeding back into task status + gamification.

### C. Milestones — ✅ DONE (see Done section)
Follow-up:
- [ ] Milestone completion → XP award (wired to event `milestone_completed`; actual XP grant lands with **E. Gamification**, `xp_reward` column ready).

### D. Reminder/scheduler loop + notifications (Step 12) — ✅ DONE (see Done section)
Follow-ups:
- [ ] Deadline reminders (not just block-start) for tasks with a `deadline`.
- [ ] "Snooze" / dismiss from the OS notification.
- [ ] Respect a quiet-hours / do-not-disturb setting.

### E. Gamification — ✅ DONE (see Done section)
Follow-ups (deferred):
- [ ] Inventory/shop — spend coins on hats/accessories/backgrounds (tables exist, unused).
- [ ] Pet growth stage tied to level (`pet_state.growth_stage`).
- [ ] Streak-break detection on app open (currently only rolls forward on activity).
- [ ] Weekly/monthly streak variants (only daily streak implemented).

### F. Analytics & reports — ✅ DONE (see Done section)
Follow-ups (deferred):
- [ ] Per-task focus attribution / link sessions to the active schedule block.
- [ ] Weekly + monthly aggregate views (only 7-day + all-time hours so far).
- [ ] Streak-history chart (data in `activity_log`, not yet charted).
- [ ] Auto-generate the daily report at day's end (currently manual button).

### G. Pet polish (Step 11 remainder) — 🟡
- [ ] **Rive** state-machine dog replacing emoji `PetSprite`; map 8 emotions → Rive inputs.
- [ ] Click-through (`setIgnoreCursorEvents`) so desktop stays usable; re-enable hit area on pet body only.
- [ ] **Per-pixel hit-testing** (clicks on dog body, not bounding box) — flagged open art item.
- [ ] **Fullscreen auto-hide** (hide pet over fullscreen apps; respect `hideOnFullscreen` setting).
- [ ] Capability/permission entries for `setIgnoreCursorEvents` etc. in `capabilities/default.json`.

### H. Cross-cutting / not yet covered
- [ ] Profile/onboarding (display name, pet pick) — `profile` row seeded only.
- [ ] Pet growth stages tied to level (`growth_stage`).
- [ ] Provider expansion (OpenAI/Claude/Groq) — interface ready, only Gemini wired.
- [ ] Rust toolchain install + first `npm run tauri dev` smoke test (per SETUP.md) — never run.
- [ ] Real app icons (currently default Tauri placeholders).
- [ ] Git: repo is **not initialized** (`git init` + first commit pending).

---

## Suggested next slice
1. ~~**A → B** scheduler engine + timeline~~ ✅ done.
2. ~~**C** milestones persistence~~ ✅ done.
3. ~~**D** reminder loop + notifications~~ ✅ done.
4. ~~**E** gamification (XP/coins/levels/streaks/achievements)~~ ✅ done.
5. ~~**F** analytics & reports (focus timer, daily report, Recharts trends)~~ ✅ done.
6. **G** Rive pet + click-through + fullscreen auto-hide — the desktop-pet
   magic; needs the Rust runtime to actually exercise.
7. **H** onboarding, pet growth stages, real icons, **git init**, and a real
   `npm run tauri dev` smoke test (nothing has run against live Tauri yet).

> ⚠️ Nothing built so far has been run against the **live Tauri runtime** yet
> (no Rust toolchain installed). Notifications, the reminder loop, and SQLite all
> need a real `npm run tauri dev` smoke test before they can be called verified.
