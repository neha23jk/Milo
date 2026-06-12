# Milo — AI-Powered Desktop Productivity Companion

[![Tauri](https://img.shields.io/badge/Tauri-2-24292E?style=for-the-badge&logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7.0-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.0-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com)
[![Zustand](https://img.shields.io/badge/Zustand-5.0-222222?style=for-the-badge)](https://github.com/pmndrs/zustand)
[![SQLite](https://img.shields.io/badge/SQLite-embedded-003B57?style=for-the-badge&logo=sqlite)](https://www.sqlite.org)
[![Gemini](https://img.shields.io/badge/Gemini-2.0%20Flash-EA4335?style=for-the-badge&logo=google)](https://ai.google.dev)
[![Recharts](https://img.shields.io/badge/Recharts-2.15-8884D8?style=for-the-badge)](https://recharts.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

A lightweight desktop application combining AI-driven scheduling, deterministic task packing, and a persistent virtual pet to help you plan your day, maintain focus, and gamify productivity.

> **Status**: MVP Phase (Phases 1–5 feature-complete)  
> ⚠️ **Note**: Tauri runtime not yet tested locally. Frontend builds successfully; Rust toolchain integration pending.

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/neha23jk/Milo.git
cd Milo && npm install

# Run desktop app (requires Rust + Tauri)
npm run tauri dev

# Frontend-only preview (browser, no Tauri APIs)
npm run dev
npm run build  # Production bundle
```

**Setup Help**: See [Installation](#installation) for platform-specific details.

---

## Overview

Milo is a **two-window Tauri desktop application** merging intelligent scheduling, event-driven state sync, and an always-on virtual pet:

- **Hybrid Scheduler**: AI (Gemini) handles subjective task decomposition; pure TypeScript deterministic packer handles exact time-slot layout
- **Always-On Pet**: Floating, transparent window reacts to productivity events with emotion states
- **Local-First**: SQLite embedded database; offline-ready; optional future cloud sync via PostgreSQL
- **Gamification**: XP, coins, levels, streaks, 8 achievements, pet growth
- **Analytics**: Focus tracking, daily AI-generated reports, Recharts weekly/monthly trends

**Core Innovation**: Separates fuzzy (AI) logic from exact (deterministic) logic for reproducible, testable scheduling.

---

## Features

### Productivity ✅
- **AI Task Breakdown**: Gemini parses free-form input → structured tasks with milestones and time estimates
- **Smart Scheduling**: Deterministic packer respects fixed-time events, priorities, deadlines, task splittability
- **Task Management**: Full CRUD with real-time multi-window sync via Tauri events
- **Focus Timer**: Track work sessions with live stopwatch; persists to database
- **Rescheduling**: Auto-reflow incomplete work when tasks slip

### Desktop Pet ✅ / 🟡
- **Persistent Floating Avatar**: 240×240 frameless, always-on-top, draggable, skip-taskbar window
- **Emotion States**: 8 states (Idle, Working, Thinking, Happy, Celebrating, Sad, Sleeping)
- **Pet Interactions**: Click to open task-entry dialog; responds to productivity events
- **System Tray**: Show/hide dashboard, sleep pet, quit (app stays alive in background)
- **Auto-Start**: Launches on login via `tauri-plugin-autostart`
- **Rive Animations** 🟡: Scaffolded; emoji placeholder active (Rive canvas integration pending)

### Gamification ✅
- **XP & Coins**: Awarded for task completion (+25 XP / +5 coins per task) and milestones (variable XP)
- **Levels**: Dynamic curve (100 + (level-1)×50 XP per level); level-up triggers celebration + bonus coins
- **Streaks**: Daily streak tracking (current/longest); milestone notifications at 3/7/30 day streaks
- **Achievements**: 8 seeded achievements (First Steps, Getting Going, Centurion, On a Roll, Unstoppable, Dedicated, Rising Star, Pro)
- **Profile**: Live profile panel with level ring, XP bar, streak counter, coin balance
- **Inventory** ⬜: Tables seeded; shop UI not yet implemented

### Analytics & Reports ✅
- **Daily Reports**: AI-generated summaries; deterministic fallback when offline
- **Focus Analytics**: Focus time by hour-of-day, 7-day focus trends, completion rate
- **Charting**: Recharts area + bar charts (Insights tab)
- **Activity Log**: Track XP awards, task completions, level-ups, streaks

### Notifications & Reminders ✅ / 🟡
- **Desktop Notifications**: Via `tauri-plugin-notification` for task reminders
- **Reminder Loop**: 30-second poller in pet window (stays active even if dashboard minimized)
- **Per-Block Reminders**: One notification per scheduled task block at start time
- **Smart Reminders** 🟡: Deadline-based reminders and snooze pending

---

## Architecture

### Two-Window Model

```
┌─────────────────────────────────────┐       ┌──────────────────┐
│         Dashboard Window            │       │   Pet Window     │
│      (1100×720, normal frame)       │◄─────►│  (240×240,       │
├─────────────────────────────────────┤ Events│  transparent,    │
│ • Schedule timeline & task cards    │       │  always-on-top,  │
│ • Settings & API key management     │       │  frameless)      │
│ • Analytics & achievements          │       │                  │
│ • Focus timer                       │       │ • Pet canvas     │
│ • Daily reports                     │       │ • Emotion state  │
└─────────────────────────────────────┘       │ • Reminder loop  │
          │                                   └──────────────────┘
          └──► System Tray (Show / Sleep / Quit)
               ↓
          SQLite Database (local, shared)
```

### Data Flow

```
User Input (Tasks)
    ↓
┌─────────────────────────────────────────┐
│ AI Provider: Gemini LLM (Fuzzy)         │
│ • Parse free-form input                 │
│ • Break into ordered milestones         │
│ • Estimate time, assign priority        │
│ • Detect fixed-time events              │
│ • Return: structured JSON (schema-safe) │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Deterministic Packer (Pure TypeScript)  │
│ • Sort flexible tasks by priority/date  │
│ • Pin fixed-time events at exact times  │
│ • Compute free gaps                     │
│ • Flow tasks into gaps                  │
│ • Insert Pomodoro breaks (50+10 min)    │
│ • Return: blocks + overflow list        │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ SQLite Local Database                   │
│ • Upsert schedules & blocks             │
│ • Emit schedule_updated event           │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Zustand Stores (Both Windows)           │
│ • useScheduleStore                      │
│ • useTaskStore                          │
│ • usePetStore                           │
│ • useProfileStore                       │
└─────────────────────────────────────────┘
    ↓
React UI Renders (Dashboard + Pet)
```

### Directory Structure

```
src/
├── apps/
│   ├── dashboard/
│   │   ├── DashboardApp.tsx      # Shell + nav routing
│   │   ├── TodayView.tsx         # Day planning + task mgmt
│   │   ├── TimelineView.tsx      # Schedule visualization
│   │   ├── AnalyticsView.tsx     # Charts + reports
│   │   ├── RewardsView.tsx       # Achievements + profile
│   │   └── SettingsView.tsx      # API key, preferences
│   └── pet/
│       └── PetApp.tsx            # Floating window, emotion, tray
├── components/                   # Reusable React components
├── db/
│   ├── schema.ts                 # SQLite schema (14 tables)
│   └── index.ts                  # execute/query helpers
├── services/                     # Business logic modules
│   ├── ai/
│   │   ├── provider.ts           # LlmProvider interface
│   │   ├── gemini.ts             # Gemini (active)
│   │   ├── groq.ts               # Groq (partial)
│   │   └── index.ts              # Factory
│   ├── scheduler/
│   │   └── packer.ts             # Deterministic packing (pure)
│   ├── tasks.ts                  # Task CRUD
│   ├── schedule.ts               # Schedule generation
│   ├── milestones.ts             # Milestone ops
│   ├── focus.ts                  # Focus session tracking
│   ├── gamification.ts           # XP, coins, levels, streaks
│   ├── reports.ts                # Daily reports, analytics
│   ├── notifications.ts          # Notification scheduling
│   ├── reminderLoop.ts           # 30s scheduler in pet window
│   ├── pet.ts                    # Pet state mgmt
│   └── settings.ts               # Settings persistence
├── stores/                       # Zustand state (7 stores)
├── lib/
│   ├── events.ts                 # Typed Tauri event bus
│   ├── secureStore.ts            # OS keychain API key storage
│   └── datetime.ts               # Local time helpers
├── types.ts                      # Domain TypeScript types
└── index.css                     # Tailwind + globals

src-tauri/
├── src/lib.rs                    # Entry: plugins, tray, events
├── tauri.conf.json               # Window + build config
├── capabilities/default.json     # Security permissions (Tauri v2)
└── Cargo.toml                    # Rust dependencies
```

---

## Tech Stack

| Component | Tech | Version | Purpose |
|-----------|------|---------|---------|
| **Desktop** | Tauri | 2 | Native shell, minimal footprint |
| **Frontend** | React + TypeScript + Vite | 19 / 5.8 / 7 | Reactive UI, type-safe, fast bundling |
| **Styling** | Tailwind CSS | 4 | Utility-first CSS |
| **Components** | shadcn/ui + Radix UI | Latest | Accessible, pre-built components |
| **Icons** | Lucide React | 0.469+ | Consistent icon set |
| **Animation** | Framer Motion | 12 | Micro-interactions |
| **Pet Rendering** | Rive | Scaffolded | State-machine animations (pending) |
| **State** | Zustand | 5 | Lightweight, multi-window sync |
| **Database** | SQLite | Embedded | Local-first, offline |
| **DB Plugin** | tauri-plugin-sql | 2 | SQL from TypeScript |
| **Charts** | Recharts | 2.15 | React charting |
| **HTTP** | tauri-plugin-http | 2 | Outbound calls (Gemini) |
| **Notifications** | tauri-plugin-notification | 2 | OS desktop notifications |
| **Storage** | tauri-plugin-store | 2 | Secure keychain storage |
| **Auto-Start** | tauri-plugin-autostart | 2 | Launch on login |

---

## Scheduling Engine: The Core

The hybrid scheduler separates **fuzzy** (subjective) work from **exact** (deterministic) work.

### Phase 1: AI Breakdown (Fuzzy)

Gemini LLM handles subjective decisions:

**Input:**
```
DSA practice (2 hrs), EKAM development (4 hrs), writeup (1 hr)
Available: 9 AM – 8 PM
```

**Output (JSON-validated):**
```json
{
  "tasks": [
    {
      "title": "DSA Practice",
      "priority": "high",
      "estimatedMinutes": 120,
      "milestones": [
        { "title": "Review concepts", "estimatedMinutes": 30 },
        { "title": "Solve problems", "estimatedMinutes": 60 },
        { "title": "Review solutions", "estimatedMinutes": 30 }
      ]
    },
    ...
  ]
}
```

### Phase 2: Deterministic Packing (Exact)

Pure TypeScript algorithm ensures reproducible, conflict-free schedules. **No database access; fully testable.**

**Algorithm:**
1. Sort flexible tasks by priority, deadline, input order
2. Pin fixed-time events (contests, meetings) at exact times
3. Compute free gaps around anchored events
4. Flow flexible tasks into gaps:
   - **Non-splittable** (exam, contest): requires one contiguous gap or overflow
   - **Splittable** (study, chores): broken into 50-min focus chunks with 10-min breaks
5. Return non-overlapping blocks + overflow list

**Output:**
```
9:00–9:10     Break
9:10–10:00    DSA Part 1/3
10:00–10:10   Break
10:10–11:00   DSA Part 2/3
11:00–12:00   EKAM Part 1/4
12:00–13:00   Lunch Break
...
```

**Code**: [`src/services/scheduler/packer.ts`](src/services/scheduler/packer.ts) (pure) + [`src/services/schedule.ts`](src/services/schedule.ts) (orchestration)

---

## AI Integration

### Provider Interface

```typescript
interface LlmProvider {
  readonly id: LlmProviderId;
  breakdownTasks(input: string, ctx: PlanContext): Promise<StructuredPlan>;
  generateSummary(context: string): Promise<string>;
  classifyIntent(message: string): Promise<Intent>;
}
```

### Implemented Providers

| Provider | Status | Details |
|----------|--------|---------|
| **Gemini** | ✅ | Default; free tier; schema-validated structured output |
| **Groq** | 🟡 | Scaffolded; partial implementation |
| **OpenAI** | ⬜ | Interface-ready; implementation pending |
| **Claude** | ⬜ | Interface-ready; implementation pending |

### Guardrails

- **Intent Classification**: Classifies input as "productivity" or "off_topic" before answering
- **Structured Output**: JSON schema enforcement ensures valid task structure
- **Scope Limiting**: System prompt keeps responses productivity-focused

### Security

- **API Keys**: Stored in OS keychain via `tauri-plugin-store` (never disk-persisted)
- **BYOK Model**: Users bring their own free-tier API keys
- **Test Function**: Settings panel includes key verification before saving

---

## Installation

### Prerequisites

- **Node.js** 16+, npm
- **Rust toolchain** (via [rustup](https://rustup.rs/))
- **WebView2** runtime (Windows 11+; auto-handled on macOS/Linux)
- **MSVC linker** (Windows only)

### Setup: Windows

```powershell
# Install MSVC build tools
winget install --id Microsoft.VisualStudio.2022.BuildTools `
  --override "--quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

# Install Rust
winget install --id Rustlang.Rustup
# Restart PowerShell for PATH updates

# Clone & install
git clone https://github.com/neha23jk/Milo.git
cd Milo && npm install
```

### Setup: macOS

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

git clone https://github.com/neha23jk/Milo.git
cd Milo && npm install
```

### Setup: Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y build-essential curl libssl-dev libgtk-3-dev libayatana-appindicator3-dev

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

git clone https://github.com/neha23jk/Milo.git
cd Milo && npm install
```

---

## Usage

### Run Full App

```bash
npm run tauri dev
```

Launches both windows. On first run:
- SQLite creates `mochi.db` in app data dir
- Schema + seed data applied automatically
- Pet appears on desktop

### Frontend Development

```bash
npm run dev              # Vite dev server (browser preview)
npm run build            # Production bundle
npm run preview          # Preview build
```

**Note**: Browser mode stubs Tauri APIs (database, notifications are no-ops).

### First-Time Setup

1. **Settings** → Paste Google Gemini API key ([get free tier](https://aistudio.google.com))
2. **Test Key** → Verify connectivity
3. **Show Pet** → Click or use system tray
4. **Click Pet** → Opens task-entry dialog
5. **Enter Day's Tasks** → "DSA 2 hrs, Homework 1 hr"
6. **Generate Schedule** → AI breaks down, packer lays out timeline
7. **Start Focus** → Reminders fire at block start times
8. **Daily Report** → View AI summary + stats at day's end

---

## Database Schema

14 tables (single-user, local-first):

| Table | Purpose |
|-------|---------|
| `profile` | User level, XP, coins, streaks, pet type |
| `tasks` | Task definitions, status, priority, deadline, fixed times |
| `milestones` | Task decomposition, XP rewards |
| `schedules` | Daily schedule metadata (date, availability window) |
| `schedule_blocks` | Time slots (task / break / buffer) |
| `focus_sessions` | Work sessions (start, end, duration) |
| `reports` | Daily productivity reports + AI summaries |
| `pet_state` | Pet emotion, growth stage, last interaction |
| `achievements` | Achievements catalog (8 seeded) |
| `user_achievements` | Unlocked achievements + timestamps |
| `inventory` | Pet accessories, hats, furniture, backgrounds |
| `notifications` | Pending/fired desktop notifications |
| `activity_log` | XP awards, task/milestone completions, level-ups, streaks |
| `settings` | Key-value config (theme, work hours, provider, etc.) |

---

## Development Status

### Phases Complete

| Phase | Status | Notes |
|-------|--------|-------|
| 1 | ✅ | Tauri scaffold, React + TS + Vite, SQLite, Zustand |
| 2 | ✅ | Task CRUD, AI breakdown, deterministic packer, Schedule UI |
| 3 | 🟡 | Pet window (floating, draggable, emoji sprite ✅; Rive pending) |
| 4 | ✅ | Notifications, reminder loop (30s), cross-window sync |
| 5 | ✅ | Gamification (XP, levels, streaks, 8 achievements, profile UI) |
| 6 | 🟡 | Advanced AI (intent guardrail ✅; provider expansion ready) |
| 7 | ⬜ | Polish, performance, accessibility, test suite |

### Known Limitations

⚠️ **Tauri Runtime Not Tested**: Code builds and type-checks; actual Tauri dev server never run (Rust toolchain setup pending).

| Feature | Status | Notes |
|---------|--------|-------|
| Rive Animations | 🟡 | Canvas scaffolded; emoji sprite active |
| Click-Through Pet | 🟡 | `setIgnoreCursorEvents` not yet enabled |
| Fullscreen Auto-Hide | 🟡 | Setting exists; logic pending |
| Inventory / Shop | ⬜ | Tables seeded; UI not built |
| Pet Growth Stages | ⬜ | Not tied to level yet |
| Multi-Device Sync | ⬜ | Planned: PostgreSQL + offline replication |
| Authentication | ⬜ | Single-user local MVP |

---

## Implementation Highlights

### Deterministic Packing

Located in [`src/services/scheduler/packer.ts`](src/services/scheduler/packer.ts):

- **Pure**: No DB access, no Tauri calls, fully testable
- **Reproducible**: Same input → same output
- **Fair**: Respects priorities, deadlines, task splittability
- **Overflow Aware**: Reports unscheduled work with reason (no_room vs. no_contiguous_gap)

### Cross-Window Sync

- **Source of Truth**: SQLite
- **Change Notification**: Tauri event bus + custom events
- **State Management**: Zustand subscribers in both windows
- **Consistency**: Eventual consistency via event-driven updates
- **No Polling**: All updates are push-based

### Pet Window Always-On

- **Window Config**: transparent + always-on-top + skip-taskbar + no-focus
- **System Tray**: Keeps app alive when dashboard closed
- **Reminder Loop**: 30-second poller (runs in pet window, fires desktop notifications)
- **Auto-Start**: Launches on login

---

## Contributing

1. Fork repo
2. Create feature branch (`git checkout -b feature/xyz`)
3. Make changes; ensure types pass (`npm run build`)
4. Commit with clear messages
5. Open PR with description

**Architecture Principles**:
- TypeScript-first; minimal Rust
- Local-first; offline-ready
- Pure functions where possible (packer is fully pure)
- Event-driven state sync (no polling)
- Secure by default (keychain-backed API keys)

---

## Files & References

| File | Purpose |
|------|---------|
| [`idea.md`](idea.md) | Full specification + design rationale |
| [`SETUP.md`](SETUP.md) | Detailed platform-specific setup |
| [`work.md`](work.md) | Implementation status + next steps |
| [`package.json`](package.json) | npm dependencies |
| [`src-tauri/Cargo.toml`](src-tauri/Cargo.toml) | Rust dependencies |
| [`vite.config.ts`](vite.config.ts) | Vite config (multi-page build) |

---

## FAQ

**Q: Do I need Rust installed to develop?**  
A: No for frontend-only work (`npm run dev`). Yes for full app testing (`npm run tauri dev`).

**Q: Is my data secure?**  
A: Yes. SQLite is local; API keys stored in OS keychain. No data leaves your machine without explicit action.

**Q: Can I use a different LLM?**  
A: Yes. The `LlmProvider` interface supports it. Only Gemini is wired; adding others is straightforward.

**Q: Will this support multi-device sync?**  
A: Planned. Future phase includes PostgreSQL backend + offline-first replication.

**Q: Mobile support?**  
A: Not in MVP scope. Tauri can target iOS/Android later.

---

## License

MIT – See [`LICENSE`](LICENSE)

---

**Built for focus and productivity.**
