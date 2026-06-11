import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  Settings as SettingsIcon,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listenApp } from "@/lib/events";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTaskStore } from "@/stores/useTaskStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { TodayView } from "./TodayView";
import { TimelineView } from "./TimelineView";
import { RewardsView } from "./RewardsView";
import { AnalyticsView } from "./AnalyticsView";
import { SettingsView } from "./SettingsView";
import { ProfilePanel } from "./ProfilePanel";
import { RewardToast } from "./RewardToast";

type View = "today" | "schedule" | "insights" | "rewards" | "settings";

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
  const loadProfile = useProfileStore((s) => s.load);

  useEffect(() => {
    void loadSettings();
    void loadTasks();
    void loadProfile();

    // Keep the dashboard in sync when either window changes data.
    const unTasks = listenApp("tasks_changed", () => void loadTasks());
    const unProfile = listenApp("profile_changed", () => void loadProfile());
    const unLevel = listenApp("level_up", () => void loadProfile());
    return () => {
      void unTasks.then((fn) => fn());
      void unProfile.then((fn) => fn());
      void unLevel.then((fn) => fn());
    };
  }, [loadSettings, loadTasks, loadProfile]);

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
            icon={<CalendarClock className="size-4" />}
            label="Schedule"
            active={view === "schedule"}
            onClick={() => setView("schedule")}
          />
          <NavItem
            icon={<BarChart3 className="size-4" />}
            label="Insights"
            active={view === "insights"}
            onClick={() => setView("insights")}
          />
          <NavItem
            icon={<Trophy className="size-4" />}
            label="Rewards"
            active={view === "rewards"}
            onClick={() => setView("rewards")}
          />
          <NavItem
            icon={<SettingsIcon className="size-4" />}
            label="Settings"
            active={view === "settings"}
            onClick={() => setView("settings")}
          />
        </nav>

        <div className="mt-auto">
          <ProfilePanel />
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">
        {view === "today" && <TodayView />}
        {view === "schedule" && <TimelineView />}
        {view === "insights" && <AnalyticsView />}
        {view === "rewards" && <RewardsView />}
        {view === "settings" && <SettingsView />}
      </main>

      <RewardToast />
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
