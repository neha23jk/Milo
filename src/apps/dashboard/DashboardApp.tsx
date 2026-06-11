import { useEffect, useState } from "react";
import { CalendarDays, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { listenApp } from "@/lib/events";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTaskStore } from "@/stores/useTaskStore";
import { TodayView } from "./TodayView";
import { SettingsView } from "./SettingsView";

type View = "today" | "settings";

function applyTheme(theme: "light" | "dark" | "system") {
  const root = document.documentElement;
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

export function DashboardApp() {
  const [view, setView] = useState<View>("today");
  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadTasks = useTaskStore((s) => s.load);

  useEffect(() => {
    void loadSettings();
    void loadTasks();

    // Keep the dashboard in sync when the pet window changes data.
    const unlisten = listenApp("tasks_changed", () => void loadTasks());
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [loadSettings, loadTasks]);

  useEffect(() => {
    if (settings) applyTheme(settings.theme);
  }, [settings]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r bg-card/50 p-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-lg">
            🐶
          </div>
          <span className="text-lg font-semibold tracking-tight">Mochi AI</span>
        </div>

        <nav className="flex flex-col gap-1">
          <NavItem
            icon={<CalendarDays className="size-4" />}
            label="Today"
            active={view === "today"}
            onClick={() => setView("today")}
          />
          <NavItem
            icon={<SettingsIcon className="size-4" />}
            label="Settings"
            active={view === "settings"}
            onClick={() => setView("settings")}
          />
        </nav>

        <div className="mt-auto rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 font-medium text-foreground">
            <Sparkles className="size-3" /> Phase 1
          </div>
          Local-first · SQLite · BYOK Gemini
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">
        {view === "today" ? <TodayView /> : <SettingsView />}
      </main>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
