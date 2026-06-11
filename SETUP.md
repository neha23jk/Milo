# Mochi AI — Local Development

Local-first Tauri v2 desktop app. Authored entirely in **TypeScript** (no hand-written
Rust), but Tauri compiles a small Rust shell, so the Rust toolchain must be installed
to **run/build** the desktop app. Frontend-only work (`npm run build`) does not need Rust.

## Prerequisites (Windows)

1. **Node.js** (installed ✓)
2. **Microsoft C++ Build Tools** — the MSVC linker Rust needs:
   ```powershell
   winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
   ```
   (Or install "Desktop development with C++" via the Visual Studio Installer.)
3. **Rust** (via rustup):
   ```powershell
   winget install --id Rustlang.Rustup
   ```
   Then restart the shell so `cargo` is on PATH.
4. **WebView2** — preinstalled on Windows 11.

## Run

```powershell
npm install          # JS deps (done)
npm run tauri dev    # launches the dashboard + floating pet windows
```

First launch creates `mochi.db` (SQLite) in the app data dir and applies the schema.

## Frontend-only (no Rust needed)

```powershell
npm run build        # type-check + bundle both windows
npm run dev          # Vite dev server (browser preview; Tauri APIs are no-ops here)
```

## Architecture quick map

| Area | Location |
| --- | --- |
| Dashboard window UI | `src/apps/dashboard/` |
| Floating pet window | `src/apps/pet/` |
| SQLite schema (run from TS) | `src/db/schema.ts` |
| DB connection + helpers | `src/db/index.ts` |
| Services (tasks, pet, settings, AI) | `src/services/` |
| Zustand stores | `src/stores/` |
| Cross-window event bus | `src/lib/events.ts` |
| BYOK key (secure store) | `src/lib/secureStore.ts` |
| Tauri shell (plugins, tray) | `src-tauri/src/lib.rs` |
| Window + plugin config | `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json` |

The full design lives in [`idea.md`](./idea.md).
