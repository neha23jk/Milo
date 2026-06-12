# Milo — AI-Powered Desktop Productivity Companion

A lightweight desktop application that combines AI-driven scheduling, task breakdown, and a persistent virtual pet to help users plan their day, maintain focus, and gamify productivity.

**Built with:** Tauri + React + TypeScript | **Database:** SQLite | **AI:** Google Gemini (BYOK)

---

## Overview

Milo is a **two-window Tauri desktop app** featuring:

- **Intelligent Scheduling Engine**: AI breaks tasks into milestones; deterministic packer layouts them into conflict-free time blocks
- **Always-On Desktop Pet**: Floating, transparent window that stays above all apps; reacts to productivity events
- **Local-First Architecture**: All data persists in SQLite; offline-first with optional future cloud sync
- **Gamification System**: XP, coins, streaks, achievements, and pet growth
- **Daily Analytics & Reports**: Focus time tracking, task completion rates, AI-generated summaries

---

## Features

### Core Productivity
- **AI Task Breakdown**: Accepts raw task input and generates structured tasks + estimated milestones
- **Smart Scheduling**: Deterministic time-slot packing respects fixed-time events, task splittability, priority, and deadlines
- **Focus Timer**: Track active work sessions with desktop notifications
- **Rescheduling**: Auto-reflow incomplete work when tasks slip or overrun

### Desktop Pet
- **Persistent Floating Avatar**: Frameless, always-on-top, draggable window; optionally hides on fullscreen
- **Emotion States**: Idle, Working, Thinking, Happy, Celebrating, Sad (powered by Rive animations)
- **Pet Interactions**: Click to open quick task-entry; responds to productivity events
- **System Tray Integration**: Show/hide dashboard, sleep pet, or quit from the tray menu
- **Auto-Start on Login**: Runs in background via `tauri-plugin-autostart`

### Gamification & Engagement
- **XP & Coins**: Awarded for task and milestone completion
- **Streaks**: Daily/weekly/monthly streak tracking with notifications at milestones
- **Achievements**: 8 unlockable achievements (First Steps, On a Roll, Centurion, etc.)
- **Inventory**: Purchase and equip pet accessories, hats, furniture, and backgrounds

### Analytics & Reports
- **Daily Reports**: AI-generated summaries of completion rate, focus time, and productivity insights
- **Weekly/Monthly Charts**: Visualize focus trends, productive hours, and streak history (Recharts)
- **Activity Log**: Track XP awards, task completions, level-ups, and streaks

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Framework** | Tauri v2 (native Rust shell, TypeScript app layer) |
| **Frontend** | React 19 + TypeScript + Vite + Tailwind CSS |
| **UI Components** | shadcn/ui + Radix UI + Lucide Icons |
| **Animation** | Framer Motion + Rive (state-machine pet animations) |
| **State Management** | Zustand (multi-window compatible) |
| **Database** | SQLite (local, embedded) + `tauri-plugin-sql` |
| **Data Visualization** | Recharts |
| **AI Integration** | Google Gemini (free tier, BYOK API key) + `tauri-plugin-http` |
| **Native Capabilities** | Tauri plugins: sql, store, notification, autostart, http, opener |
| **Build Tools** | Vite (multi-page: `index.html` + `pet.html`), TypeScript compiler |

---

## Architecture

### Two-Window Model

```
┌─────────────────────────────────────────┐
│           Dashboard Window              │
│  (main, 1100×720, normal frame)         │
├─────────────────────────────────────────┤
│ • Schedule timeline                     │
│ • Active task card & focus timer        │
│ • Task/milestone management             │
│ • Analytics & achievements              │
│ • Settings & API key management         │
└─────────────────────────────────────────┘

┌──────────────┐
│ Pet Window   │  (pet, 240×240, transparent, always-on-top,
│ (Rive        │   frameless, skip taskbar)
│  Canvas)     │
└──────────────┘
  └─ System Tray Menu
     (Show Dashboard / Sleep Pet / Quit)
```

### Data Flow

```
User Input (Tasks)
    ↓
[AI Provider: Gemini]  (breaks tasks → structured JSON)
    ↓
[Deterministic Packer]  (TypeScript: layouts non-overlapping blocks)
    ↓
[SQLite]  (stores schedules + blocks)
    ↓
[Event Bus]  (emits schedule_updated)
    ↓
[Zustand Stores]  (both windows subscribe)
    ↓
[UI Renders]  (dashboard timeline, pet emotion updates)
```

### Directory Structure

```
src/
├── apps/
│   ├── dashboard/          # Main productivity UI
│   └── pet/                # Floating pet window
├── components/             # React components (shared)
├── db/                     # SQLite schema + query helpers
│   ├── index.ts           # DB init, execute/query wrappers
│   └── schema.ts          # Schema statements (run on startup)
├── lib/                    # Utilities
│   ├── events.ts          # Tauri event bus wrapper
│   └── secureStore.ts     # API key storage (OS keychain)
├── services/               # Business logic (domain modules)
│   ├── ai/                # LLM providers (Gemini, Groq, etc.)
│   │   ├── provider.ts    # Interface + types
│   │   ├── gemini.ts      # Gemini implementation
│   │   └── groq.ts        # Groq implementation
│   ├── scheduler/          # Scheduling engine
│   │   └── packer.ts      # Deterministic time-slot packing
│   ├── tasks.ts           # Task CRUD
│   ├── schedule.ts        # Schedule generation & retrieval
│   ├── milestones.ts      # Milestone management
│   ├── focus.ts           # Focus session tracking
│   ├── gamification.ts    # XP, coins, levels, achievements
│   ├── reports.ts         # Daily/weekly reports, analytics
│   ├── notifications.ts   # Notification scheduling
│   ├── pet.ts             # Pet state management
│   ├── reminderLoop.ts    # Reminder scheduler (runs in pet window)
│   └── settings.ts        # User settings
├── stores/                 # Zustand stores (state subscriptions)
│   ├── useTaskStore.ts
│   ├── useScheduleStore.ts
│   ├── usePetStore.ts
│   ├── useProfileStore.ts
│   ├── useMilestoneStore.ts
│   ├── useFocusStore.ts
│   └── useSettingsStore.ts
├── types.ts               # TypeScript domain types (mirror DB schema)
└── index.css              # Global styles + Tailwind directives

src-tauri/
├── src/
│   └── lib.rs            # Rust entry point (plugins, tray, window events)
├── tauri.conf.json       # Window config, build settings
├── capabilities/         # Security permissions
└── Cargo.toml            # Rust dependencies
```

---

## Scheduling Engine

The **hybrid scheduler** combines AI and deterministic logic:

1. **AI Phase** (Gemini LLM):
   - Parses user input (e.g., "DSA 2 hrs, Assignment 1 hr, EKAM 4 hrs")
   - Breaks tasks into milestones with estimated time, priority, deadline
   - Returns structured JSON adhering to a schema

2. **Packing Phase** (TypeScript, pure):
   - Anchors fixed-time events (contests, meetings, exams) at their clock times
   - Computes free gaps in the availability window
   - Flows flexible tasks into gaps, respecting priority, deadline, splittability
   - Inserts Pomodoro-style breaks (50 min focus → 10 min break)
   - Returns conflict-free schedule or overflow list

3. **Persistence**:
   - Writes `schedules` and `schedule_blocks` rows to SQLite
   - Emits cross-window event (`schedule_updated`)
   - Both windows re-render via Zustand subscription

---

## AI Integration

### Providers

The app uses a swappable **`LlmProvider`** interface:

```typescript
interface LlmProvider {
  breakdownTasks(input: string, ctx: PlanContext): Promise<StructuredPlan>;
  generateSummary(context: string): Promise<string>;
  classifyIntent(message: string): Promise<Intent>;
}
```

**Implemented:**
- **Gemini** (default): Free tier, BYOK
- **Groq** (partial): Quick LLM calls

### Guardrails

- **Intent Classification**: Classifies user requests as "productivity" or "off_topic"
- **Structured Output**: Enforces JSON schema for task breakdown
- **Scope Limiting**: System prompt keeps responses focused on productivity

### Security

- **API Key Storage**: Stored in OS keychain via `tauri-plugin-store`
- **Never Hard-Coded**: Key is fetched at runtime from secure store
- **User-Owned Keys**: Users manage their own API credentials

---

## Installation

### Prerequisites

- **Node.js** (v16+)
- **Rust toolchain** (via [rustup](https://rustup.rs/))
- **WebView2** (Windows 11+; macOS/Linux via Tauri)
- **Microsoft C++ Build Tools** (Windows only: MSVC linker for Rust)

### Setup (Windows)

```powershell
# Install C++ build tools
winget install --id Microsoft.VisualStudio.2022.BuildTools `
  --override "--quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

# Install Rust
winget install --id Rustlang.Rustup
# Restart shell to update PATH

# Clone and install
git clone https://github.com/neha23jk/Milo.git
cd Milo
npm install
```

### Setup (macOS/Linux)

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Clone and install
git clone https://github.com/neha23jk/Milo.git
cd Milo
npm install
```

---

## Usage

### Run Desktop App

```bash
npm run tauri dev
```

Launches both windows:
- **Dashboard** (main): Productivity UI
- **Pet** (floating overlay): Always-on-top virtual companion

On first launch, SQLite creates `mochi.db` in the app data directory and applies the schema.

### Development (Browser Preview)

```bash
npm run dev              # Type-check + run Vite dev server
npm run build            # Production bundle (both windows)
```

**Note:** In browser mode, Tauri APIs are no-ops (file access, notifications, database calls do nothing).

### First Time

1. Open dashboard → go to **Settings**
2. Paste your **Google Gemini API key** (free tier from [Google AI Studio](https://aistudio.google.com))
3. Click "Show Pet" or access via system tray
4. Click pet to open task-entry dialog
5. Enter your day's tasks; AI will break them down and generate a schedule

---

## Project Structure at a Glance

| File/Folder | Purpose |
|-------------|---------|
| `src/db/schema.ts` | SQLite schema + seed data (achievements, settings) |
| `src/db/index.ts` | Query wrappers (`execute`, `query`) |
| `src/services/schedule.ts` | Schedule generation, packing, block updates |
| `src/services/scheduler/packer.ts` | Deterministic time-slot packing algorithm |
| `src/services/ai/gemini.ts` | Gemini LLM integration (task breakdown, summaries) |
| `src/services/gamification.ts` | XP, coins, levels, achievements, inventory |
| `src/services/reports.ts` | Daily reports, analytics calculations |
| `src/stores/` | Zustand stores (sync UI state with SQLite) |
| `src/apps/dashboard/` | React components for main window |
| `src/apps/pet/` | React components for floating pet |
| `src-tauri/src/lib.rs` | Tauri setup: plugins, tray, window events |
| `src-tauri/tauri.conf.json` | Window sizes, transparency, always-on-top |

---

## Key Implementation Details

### Deterministic Packing

The packer ensures **reproducible, conflict-free schedules** without database mutations:

- Sorts flexible tasks by priority, deadline, and input order
- Pins anchored (fixed-time) tasks first
- Computes free gaps around anchored tasks
- Fills gaps greedily with focus-sized chunks + breaks
- Returns overflow list for UI to show unscheduled work

### Cross-Window Synchronization

- **Event Bus**: `tauri-plugin-notification` + custom Tauri events
- **Source of Truth**: SQLite (both windows query and write)
- **Eventual Consistency**: Services emit events; Zustand stores subscribe
- **No Polling**: Changes propagate via event listeners

### Pet Window Always-On

- **Window Config**: `transparent: true`, `alwaysOnTop: true`, `skipTaskbar: true`, `focus: false`
- **System Tray**: Keeps the app alive; tray menu shows/hides dashboard or quits
- **Auto-Start**: `tauri-plugin-autostart` enables launch-on-login
- **Reminder Loop**: Scheduler running in pet window fires notifications without focus

---

## Database Schema

Single-user, local-first design:

| Table | Purpose |
|-------|---------|
| `profile` | User level, XP, coins, streaks |
| `tasks` | Task definitions (title, priority, deadline, status) |
| `milestones` | Task decomposition with XP rewards |
| `schedules` | Daily schedule metadata |
| `schedule_blocks` | Time slots (task, break, or buffer) |
| `focus_sessions` | Active work session tracking |
| `reports` | Daily productivity reports |
| `pet_state` | Pet emotion, growth stage, last interaction |
| `achievements` | Unlockable achievements catalog |
| `user_achievements` | User's unlocked achievements |
| `inventory` | Pet accessories, hats, furniture |
| `notifications` | Pending/fired desktop notifications |
| `activity_log` | XP awards, task completions (analytics) |
| `settings` | Key-value configuration |

---

## Development Roadmap

| Phase | Focus |
|-------|-------|
| **Phase 1** | Tauri + React scaffold, SQLite schema, TypeScript services |
| **Phase 2** | Task CRUD, AI breakdown, deterministic packing, dashboard views |
| **Phase 3** | Transparent pet window, Rive integration, click-through, system tray |
| **Phase 4** | Notifications, daily reports, analytics charts |
| **Phase 5** | Gamification (XP, levels, streaks, achievements) |
| **Phase 6** | Advanced AI (auto-reschedule, energy-aware scheduling, provider options) |
| **Phase 7** | Polish, performance, accessibility, testing |
| **Future** | Cloud sync, PostgreSQL backend, cross-device |

---

## Known Limitations & Future Improvements

### Current
- **No Authentication**: Single-user, local-only (MVP)
- **AI Provider**: Gemini only (Groq scaffolded; OpenAI/Claude planned)
- **Pet Animation**: Rive canvas not yet integrated
- **Reminder Loop**: Partial implementation
- **Mobile**: Desktop only (Tauri could support iOS/Android later)

### Planned
- Multi-device sync via PostgreSQL + offline-first SQLite replication
- Energy-aware scheduling (productivity curves, break recommendations)
- Expanded pet animations and customization
- Browser extension for quick task capture
- Export/import for portability

---

## License

MIT – See LICENSE file for details.

---

## Notes for Developers

- **TypeScript-First**: Minimal Rust; all logic in TypeScript via Tauri plugins
- **Local-First**: No server dependency; works offline
- **Deterministic Scheduling**: Packer is pure, testable, reproducible
- **Event-Driven Sync**: Zustand + Tauri events keep multi-window state in sync
- **Secure by Default**: API keys stored in OS keychain, never persisted to disk

---

**Questions?** Open an issue or check the project specification in `idea.md`.
