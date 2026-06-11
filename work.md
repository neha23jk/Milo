# Mochi AI — Work Tracker

> Status snapshot as of **2026-06-11**. Source of truth for what's built vs. what's left.
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
| 9 | **Deterministic packing engine** + `generateSchedule`/`getSchedule`/`reschedule` services | ⬜ |
| 10 | `TimelineView` + `ScheduleBlock` + `useScheduleStore`; morning chat flow | ⬜ |
| 11 | Rive pet + click-through (`setIgnoreCursorEvents`) + drag; autostart; tray; fullscreen auto-hide; close-to-hide | 🟡 |
| 12 | Scheduler/reminder loop in pet window + notifications + cross-window event sync | ⬜ |

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

---

## Remaining ⬜ / 🟡

### A. Scheduler engine (Step 9) — ⬜ highest priority
- [ ] Deterministic TS time-block **packer** (priority + deadline + estimate → non-overlapping blocks within available window). LLM never does time math.
- [ ] `services/schedule.ts`: `generateSchedule(date)`, `getSchedule(date)`, `reschedule(...)`.
- [ ] Persist to `schedules` + `schedule_blocks` tables (currently unused).
- [ ] Mark blocks active/done; emit `schedule_updated` / `active_block_changed`.

### B. Timeline UI (Step 10) — ⬜
- [ ] `useScheduleStore` (Zustand) over schedule service.
- [ ] `TimelineView` + `ScheduleBlock` components (time-axis day view).
- [ ] Wire into dashboard nav (new "Schedule"/"Timeline" tab).
- [ ] Morning "plan my day" chat flow → generate + show timeline.

### C. Milestones — ⬜
- [ ] `services/milestones.ts` (CRUD; `breakdownTasks` already returns milestones but they're dropped in `TodayView`).
- [ ] Persist milestones on AI plan; milestone list/check UI on task cards.
- [ ] Milestone completion → XP (`milestone_completed` / `xp_reward`).

### D. Reminder/scheduler loop + notifications (Step 12) — ⬜
- [ ] Background loop in **pet window** ticking over `notifications` table.
- [ ] `services/notifications.ts` — schedule/fire via `tauri-plugin-notification` (plugin registered, unused).
- [ ] Emit `task_reminder`; pet reacts (emotion/bubble).

### E. Gamification — ⬜ (schema ready, no logic)
- [ ] `services/gamification.ts` — XP, coins, level curve, streak (current/longest), `last_active_date` roll-over.
- [ ] Award on task/milestone completion; emit `level_up`.
- [ ] Achievements engine (criteria eval) → `user_achievements`, emit `achievement_unlocked`.
- [ ] Inventory/shop (coins) — optional, later.
- [ ] UI: level/XP bar, streak, coins, recent achievements (dashboard header/widget).

### F. Analytics & reports — ⬜ (schema ready, Recharts installed, no UI)
- [ ] Focus timer + `focus_sessions` writes (start/stop, duration).
- [ ] `services/reports.ts` — daily report build (completion rate, focus minutes, done/missed) + `generateSummary` AI blurb.
- [ ] Stats/analytics view with Recharts; `daily_report_ready` event.

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
1. **A → B** (scheduler engine + timeline) — the core value prop; unblocks the headline "AI plans your day into time blocks."
2. **C** milestones persistence (cheap, AI already returns them).
3. **E** gamification basics (XP/streak) — makes completion feel rewarding.
4. **G** Rive + click-through — the desktop-pet magic; needs Rust running.
