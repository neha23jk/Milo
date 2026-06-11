# PROJECT SPECIFICATION

## Project Name

Mochi AI (working title)

## Project Vision

Build a lightweight AI-powered desktop productivity companion that lives on the user's desktop as a cute virtual pet.

The pet is not simply an avatar inside a productivity app. It exists as a floating desktop companion that remains visible while the user works.

The pet's purpose is to:

* Create intelligent daily schedules
* Break large tasks into rewarding milestones
* Remind users about upcoming tasks
* Track productivity
* Celebrate achievements
* Provide daily reports
* Gamify productivity through pet growth and progression

The goal is to combine **AI Scheduling, Productivity Management, Desktop Pet Interaction, Gamification, and Analytics** into a single polished product.

The experience should feel similar to: Shimeji, Clippy, Finch, Habitica, Motion, Reclaim AI — while maintaining a premium modern aesthetic.

---

# ARCHITECTURAL PRINCIPLES (decided)

These foundational decisions were locked during architecture review. Everything downstream follows from them.

1. **Local-first, no server.** All data lives on the user's machine in an embedded **SQLite** database. There is **no backend server** in the MVP. This satisfies the offline-first, lightweight, and fast-launch requirements, and removes hosting cost/maintenance.
2. **TypeScript-first; near-zero custom Rust.** Application logic (scheduling, XP, streaks, AI calls, DB access) lives in **TypeScript**, using official Tauri plugins for native capabilities (SQLite, notifications, secure storage, HTTP, window control). The shared **SQLite file is the single source of truth**, and the two windows stay in sync via Tauri's cross-window event bus. The Tauri shell is Rust under the hood, but you don't author Rust.
3. **AI is BYOK (Bring Your Own Key), free-tier first.** Default provider is **Google Gemini (free tier)**. The user pastes their own API key, stored securely in the OS keychain. The AI layer is wrapped behind a swappable provider interface so OpenAI/Claude/Groq/etc. can be added later.
4. **The scheduler is hybrid (AI + deterministic).** The LLM does the fuzzy work (task breakdown, effort estimates, priorities, friendly summaries) and returns **structured JSON**. A **deterministic algorithm in Rust** does the actual time-block packing and rescheduling. LLMs are never trusted to do strict time math.
5. **No auth in the MVP.** The app is single-user and local. Accounts/login arrive later, alongside optional cloud sync.
6. **Cloud sync is a future phase, not a dependency.** When multi-device/backup is added, **PostgreSQL** becomes the cloud store and SQLite remains the local source of truth (offline-first sync).

---

# PRIMARY USER FLOW

## Morning

User clicks the pet → pet opens a chat surface. User enters tasks, priorities, deadlines, and available hours.

Example:

```
Today:
- DSA Practice (2 hours)
- EKAM Development (4 hours)
- Assignment (1 hour)

Available time: 9 AM - 8 PM
```

The system generates: a daily timeline, task schedule, milestones, and break recommendations.

## During The Day

Pet remains visible and:

* Reminds the user about upcoming tasks
* Celebrates completed milestones
* Displays emotions and reacts to productivity

The user can open the dashboard at any time.

## End Of Day

Generate: productivity report, completion percentage, focus time, streak updates. Pet performs a celebration animation.

---

# CORE FEATURES

## Feature 1: AI Scheduler

User enters tasks → system produces a timeline with priorities, time blocks, and breaks.

Requirements: handle deadlines, priorities, limited availability, and auto-reschedule missed tasks.

**Implementation note:** The LLM proposes structure; a deterministic packer in Rust lays out the actual non-overlapping blocks within the availability window. See `Scheduling Engine` below.

## Feature 2: Task Breakdown

Large tasks are automatically decomposed into ordered milestones.

Example — *Build Dashboard* → Design UI · Create Components · Connect API · Testing · Deployment.

Each milestone has a status and an XP reward.

## Feature 3: Dashboard

Displays: Today's Schedule, Timeline View, Task Cards, Milestones, Progress Percentage, Current Active Task, Focus Timer, Statistics, Recent Achievements. Premium and modern.

## Feature 4: Desktop Pet (most important)

Pet must be: always-on-top, draggable, transparent background, clickable, lightweight.

**Always-present behavior:** the pet is a **floating overlay** — always visible above other windows while the user works (Shimeji-style). It **auto-starts on login** and lives in the **system tray**, so it's always there and closing the dashboard never kills it. It **auto-hides over fullscreen apps** (games/video) to avoid getting in the way, via a toggle.

Pet states: Idle, Sleeping, Working, Thinking, Happy, Excited, Celebrating, Sad.

Pet reacts to: task completion, missed tasks, long inactivity, schedule completion, daily reports.

**Pet character:** a **dog**. The architecture remains character-agnostic (the Rive file is swappable and `pet_type` is stored in the DB), so additional characters can be added later, but the dog is the default and primary character for art production.

## Feature 5: Notifications

Desktop notifications for: upcoming task, task overdue, milestone completed, daily report available, streak achievements.

**Implementation note:** Reminders are fired by a scheduler loop running in the **always-on pet window** (which stays open the whole time the app runs), so they fire without any window being focused — no custom Rust needed. The pet window is the designated "daemon" so timers never double-fire.

## Feature 6: Gamification

XP, Coins, Levels, Achievements, daily/weekly/monthly streaks, pet growth. Unlockables: hats, accessories, furniture, backgrounds.

## Feature 7: Daily Reports

Generate: completion rate, focus time, tasks completed, tasks missed, AI-generated productivity summary.

## Feature 8: Analytics

Weekly/monthly charts, focus trends, task-completion trends, most-productive hours, streak history.

---

# TECH STACK (revised)

## Desktop Shell — Tauri

Low RAM, native performance, small bundle, fast launch. Avoid Electron. The Rust core hosts all business logic.

## Frontend

React · TypeScript · Vite · Tailwind CSS · shadcn/ui · Framer Motion.

## State Management — Zustand

Lightweight, perfect for Tauri's multi-window model. Stores hydrate from Rust commands and stay in sync via Tauri events. (TanStack Query is only introduced if/when a server is added.)

## Pet Rendering — Rive

State-machine driven animations. States: Idle, Happy, Sleep, Work, Dance, Celebrate, Thinking. Driven by inputs set from the Rust pet state.

## Core / "Backend" — TypeScript + Tauri plugins (no custom Rust)

All logic is TypeScript. Native capabilities come from official Tauri plugins, called from TS:

* `tauri-plugin-sql` — SQLite access + schema migrations (run SQL from TypeScript)
* `tauri-plugin-notification` — desktop notifications
* `tauri-plugin-store` / `tauri-plugin-stronghold` — secure local storage for the BYOK API key
* `@tauri-apps/api/window` — transparency, always-on-top, click-through (`setIgnoreCursorEvents`)
* `tauri-plugin-autostart` — launch on login
* Tauri **system tray** (built-in) — keep the pet alive in the background; tray menu (show dashboard, sleep pet, quit)
* `@tauri-apps/api/event` — cross-window event bus
* `fetch` / `tauri-plugin-http` — outbound Gemini calls

> No custom Rust to write, and no FastAPI / SQLAlchemy / Alembic / Pydantic. The Tauri shell is Rust under the hood, but the app is authored entirely in TypeScript. (A small amount of Rust can be added later if a feature ever demands it.)

## Database — SQLite (local)

Embedded, zero-install, offline. **Future:** PostgreSQL as the cloud store for optional sync/backup.

## Authentication — None (MVP)

Single-user, local. Future: add when cloud sync lands (Clerk/Supabase Auth/WorkOS to be evaluated then).

## AI — Google Gemini (free tier), BYOK

Behind a swappable `LlmProvider` trait. Capabilities: schedule generation, task decomposition, daily summaries, rescheduling, productivity insights, and an intent-classification guardrail (keeps the assistant scoped to productivity). Uses Gemini structured-output (responseSchema) so JSON is always valid.

## Charts — Recharts

## Storage — SQLite (local). Future: S3-compatible object storage (only if media/assets need remote hosting).

---

# DATABASE SCHEMA (SQLite)

> Single local user, so no `users` table is required for MVP; a `profile` row holds the player state. The API key is **never** stored in the DB — it lives in secure local storage (`tauri-plugin-store`/`stronghold`).

### `profile` (single row)
`id, display_name, pet_type (dog|penguin), level, xp, coins, current_streak, longest_streak, last_active_date, created_at`

### `tasks`
`id, title, description, priority (low|medium|high|urgent), deadline (datetime, nullable), estimated_minutes, status (pending|in_progress|done|missed), scheduled_date (date), tags (json), created_at, completed_at`

### `milestones`
`id, task_id (FK→tasks), title, order_index, status (pending|done), estimated_minutes, xp_reward, completed_at`

### `schedules`
`id, date (unique), available_start (time), available_end (time), ai_summary (text), generated_at`

### `schedule_blocks`
`id, schedule_id (FK→schedules), task_id (FK→tasks, nullable), milestone_id (FK→milestones, nullable), block_type (task|break|buffer), start_time (datetime), end_time (datetime), status (scheduled|active|done|skipped)`

### `focus_sessions`
`id, task_id (FK, nullable), started_at, ended_at, duration_seconds`

### `reports`
`id, date (unique), completion_rate (real), focus_minutes (int), tasks_completed (int), tasks_missed (int), ai_summary (text), created_at`

### `pet_state` (single row)
`id, pet_type, current_emotion, growth_stage, last_interaction_at`

### `achievements`
`id, key (unique), name, description, icon, xp_reward, coin_reward, criteria (json)`

### `user_achievements`
`id, achievement_id (FK→achievements), unlocked_at`

### `inventory`
`id, item_type (hat|accessory|furniture|background), name, cost, owned (bool), equipped (bool)`

### `notifications`
`id, type, title, body, related_task_id (FK, nullable), scheduled_for (datetime), fired_at (datetime, nullable), status (pending|fired|dismissed)`

### `activity_log` (for analytics)
`id, type (xp_award|task_done|milestone_done|streak|level_up|...), amount (int), reason, created_at`

### `settings` (key-value)
`key, value` — e.g. theme, default work hours, notification prefs, selected LLM provider.

---

# SERVICE LAYER (TypeScript)

Instead of REST endpoints or Rust commands, application logic is organized into TypeScript **service modules** that operate on SQLite (via `tauri-plugin-sql`). Grouped by domain; each function returns typed data. UI components call services; services read/write SQLite and `emit` Tauri events to notify the other window.

**Tasks & Milestones**
`create_task`, `update_task`, `delete_task`, `list_tasks(date?)`, `complete_task`, `complete_milestone`

**Scheduling**
`generate_schedule(input)`, `get_schedule(date)`, `reschedule(date)`, `get_active_block`

**Focus**
`start_focus_session(task_id)`, `stop_focus_session`

**Reports & Analytics**
`generate_daily_report(date)`, `get_report(date)`, `get_weekly_stats`, `get_monthly_stats`, `get_focus_trends`, `get_productive_hours`, `get_streak_history`

**Gamification**
`get_profile`, `list_achievements`, `get_inventory`, `purchase_item(item_id)`, `equip_item(item_id)`

**Pet**
`get_pet_state`, `set_pet_emotion(emotion)`, `on_pet_click`

**Settings & AI**
`get_settings`, `update_settings`, `set_api_key(key)` (→ secure store), `test_api_key`, `get_provider`, `set_provider`

**Notifications**
`list_notifications`, `dismiss_notification(id)` (notification scheduling runs in the pet-window scheduler loop)

### Events (cross-window, via the Tauri event bus)

`pet_emotion_changed`, `schedule_updated`, `active_block_changed`, `task_reminder`, `milestone_completed`, `level_up`, `achievement_unlocked`, `daily_report_ready`

When a service mutates SQLite it `emit`s the relevant event; both windows `listen` and refresh their Zustand stores. SQLite is the shared source of truth; events are just the change-notification channel between windows.

---

# SCHEDULING ENGINE

Pipeline (`generate_schedule`):

1. **Parse input** — tasks, estimates, deadlines, availability window.
2. **AI breakdown (Gemini, structured)** — decompose large tasks into milestones, refine effort estimates, assign priority weights. Returns validated JSON via responseSchema.
3. **Deterministic packing (TypeScript)** — sort by priority + deadline urgency, then pack non-overlapping blocks into the availability window. Insert breaks (Pomodoro-style rule, e.g. a short break per ~50–90 min of focus) and small buffers. Guarantees: no overlaps, respects window bounds, honors deadlines where feasible; flags infeasible load.
4. **AI summary** — a short friendly natural-language summary of the day.
5. **Persist** — write `schedules` + `schedule_blocks`.

**Reschedule** (`reschedule`): triggered when a block is missed or overruns, or on demand. Re-packs only the remaining/incomplete work into the rest of the day, preserving completed blocks.

---

# AI LAYER

A TypeScript `LlmProvider` interface with methods:

* `breakdownTasks(input): StructuredPlan`
* `generateSummary(context): string`
* `classifyIntent(userMessage): Intent` — **guardrail**: classifies a request as in-scope (scheduling/tasks/productivity) or off-topic; off-topic requests are politely declined so the assistant isn't repurposed as a general chatbot.

`GeminiProvider` is the default implementation (calls the Gemini REST API). The API key is read from secure local storage (`tauri-plugin-store`/`stronghold`) and never hard-coded. Structured outputs use Gemini's `responseSchema`. A strict system prompt reinforces scope. Provider is swappable via `setProvider`.

> Honesty note: with BYOK and no server, a determined user could extract their *own* key — acceptable, since it's their key and their cost.

---

# DESKTOP PET ARCHITECTURE

**Two-window model** (defined in `tauri.conf.json`):

1. **`pet` window** — transparent, frameless, always-on-top, skip-taskbar, no decorations, no shadow (configured in `tauri.conf.json`). Hosts the Rive canvas. Calls `setIgnoreCursorEvents` (from `@tauri-apps/api/window`) for **click-through**: clicks outside the pet's body pass to apps behind it; hit-testing toggles interactivity when hovering the pet. Draggable via window-move on the pet body. This window also runs the **scheduler loop** (reminders) since it's always open.
2. **`dashboard` window** — a normal window with the full productivity UI.

**Chat surface:** clicking the pet opens a small chat input anchored near the pet (lightweight popup) that feeds `generate_schedule` and the assistant. The full conversation/history also lives in the dashboard.

**Persistence (always-present):** the app **auto-starts on login** (`tauri-plugin-autostart`) and runs from the **system tray**. The pet window opens at launch and stays as a floating overlay; the dashboard is a separate window opened on demand (from the pet menu or tray). Closing the dashboard does **not** quit the app — only "Quit" from the tray/pet menu does. The pet **auto-hides when a fullscreen app is detected** (toggleable in settings).

**State flow:** `pet_state` lives in SQLite. When productivity events occur (task done, missed, idle timeout, report ready), the responsible service updates the emotion and `emit`s `pet_emotion_changed`. The pet window maps the emotion → Rive state-machine input → animation. Because both windows are separate JS contexts, **SQLite + the Tauri event bus** are the shared channel between them.

**Idle/inactivity** is tracked by the pet-window scheduler loop (last interaction timestamp) → drives Sleeping/Sad states.

---

# FRONTEND ARCHITECTURE

* **Multi-page Vite build:** `index.html` (dashboard entry) and `pet.html` (pet entry). Each mounts a different root component (`DashboardApp`, `PetApp`) but shares the `api/`, `stores/`, and `components/ui` code.
* **`services/` layer:** TypeScript modules (one per domain) that run SQLite queries via `tauri-plugin-sql` and `emit`/`listen` on the Tauri event bus.
* **Zustand stores:** `useTaskStore`, `useScheduleStore`, `usePetStore`, `useProfileStore` (xp/coins/level/streak), `useSettingsStore`, `useAnalyticsStore`. Stores hydrate from services on mount and subscribe to Tauri events to stay live.
* **Styling:** Tailwind + shadcn/ui components; Framer Motion for transitions/micro-interactions.

---

# COMPONENT HIERARCHY (frontend)

```
PetApp (pet window)
└─ PetCanvas (Rive)            ← emotion → state-machine input
└─ PetChatBubble               ← quick task entry / assistant
└─ PetContextMenu              ← open dashboard, settings, sleep

DashboardApp (dashboard window)
├─ Sidebar / Nav
├─ TodayView
│  ├─ TimelineView
│  │  └─ ScheduleBlock[]
│  ├─ ActiveTaskCard
│  ├─ FocusTimer
│  └─ TaskList
│     └─ TaskCard
│        └─ MilestoneList → MilestoneItem[]
├─ ChatView                    ← schedule generation + assistant
├─ AnalyticsView
│  ├─ WeeklyChart / MonthlyChart (Recharts)
│  ├─ FocusTrend / ProductiveHours
│  └─ StreakHistory
├─ AchievementsView
│  ├─ AchievementGrid
│  └─ ProfilePanel (level/xp/coins/streak)
├─ ShopView (unlockables/inventory)
└─ SettingsView (API key, provider, work hours, notifications, theme, pet type)
```

---

# NON-FUNCTIONAL REQUIREMENTS

* Launch in under 3 seconds
* Minimal RAM; smooth on average laptops
* Persist data locally (SQLite); offline-first (only AI calls need network)
* Remote persistence/sync deferred to a future phase

---

# UI STYLE

Premium · Cute · Modern · Minimal · Friendly.

Inspirations: Finch, Notion, Linear, Arc Browser, Raycast.

Avoid: corporate dashboards, outdated productivity UIs, heavy skeuomorphism.

---

# DEVELOPMENT ROADMAP (revised)

**PHASE 1 — Foundation**
Tauri + React + TS + Vite + Tailwind + shadcn scaffold · two-window setup · SQLite via `tauri-plugin-sql` + migrations · TypeScript service-layer skeleton · settings + BYOK API key (secure store) · Gemini provider stub.

**PHASE 2 — Scheduling & Tasks**
Task CRUD · AI breakdown (structured) · deterministic packing engine · schedule + blocks persistence · dashboard Today/Timeline/Task views.

**PHASE 3 — Desktop Pet**
Transparent always-on-top floating pet window · Rive integration · click-through + drag · emotion ↔ state-machine mapping · pet chat surface · **autostart on login + system tray + fullscreen auto-hide**.

**PHASE 4 — Notifications, Reports, Analytics**
Scheduler loop in the pet window · desktop notifications (`tauri-plugin-notification`) · daily reports (AI summary) · analytics charts.

**PHASE 5 — Gamification**
XP/coins/levels · streaks · achievements · pet growth · shop/inventory + unlockables.

**PHASE 6 — Advanced AI**
Auto-rescheduling refinements · productivity coaching · energy-aware scheduling · provider abstraction extras (OpenAI/Claude/Groq).

**PHASE 7 — Polish & Ship**
Animation polish · performance/RAM optimization · accessibility · testing · packaging & distribution.

**FUTURE — Cloud Sync**
PostgreSQL cloud store · auth · offline-first sync · cross-device.

---

# DETAILED IMPLEMENTATION STEPS (Phase 1–2 first slice)

1. `npm create tauri-app` with the React+TS+Vite template; add Tailwind + shadcn/ui + Framer Motion + Zustand + Recharts.
2. Configure two windows (`dashboard`, `pet`) in `tauri.conf.json`; set pet window transparent/frameless/always-on-top.
3. Set up Vite multi-page (`index.html`, `pet.html`) with `DashboardApp` and `PetApp` roots.
4. Add `tauri-plugin-sql` (SQLite); define the migration set for the schema above; run migrations on startup.
5. Build the TypeScript `db/` helpers (typed query wrappers) and the `services/tasks` module (task CRUD).
6. Build `useTaskStore` (Zustand) over the task service; render `TaskList`/`TaskCard`.
7. Add secure-store-backed `setApiKey`/`testApiKey`; build the Settings view for BYOK + provider selection.
8. Implement the TypeScript `LlmProvider` interface + `GeminiProvider` (REST + structured output) with `breakdownTasks` and `classifyIntent`.
9. Build the deterministic packing engine in TypeScript + `generateSchedule` / `getSchedule` / `reschedule` services.
10. Build `TimelineView` + `ScheduleBlock` + `useScheduleStore`; wire the morning chat flow.
11. Integrate Rive in `PetApp`; map emotions to state-machine inputs; add click-through (`setIgnoreCursorEvents`) + drag. Add `tauri-plugin-autostart`, system tray (with menu), and fullscreen auto-hide; make closing the dashboard keep the app alive.
12. Add the scheduler loop in the pet window + notifications (`tauri-plugin-notification`); `emit` events to sync both windows.

> Design before code is complete. Implementation proceeds phase by phase against this spec.
