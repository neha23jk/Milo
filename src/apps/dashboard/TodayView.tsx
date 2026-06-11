import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/stores/useTaskStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useMilestoneStore } from "@/stores/useMilestoneStore";
import { setEmotion } from "@/services/pet";
import { getProvider, MissingApiKeyError } from "@/services/ai";
import { createTask } from "@/services/tasks";
import { addMilestones } from "@/services/milestones";
import {
  awardMilestoneCompleted,
  awardTaskCompleted,
} from "@/services/gamification";
import { useProfileStore } from "@/stores/useProfileStore";
import { FocusTimer } from "./FocusTimer";
import type { Milestone, Priority, Task } from "@/types";

const todayISO = () => new Date().toISOString().slice(0, 10);

// Stable empty reference: returning a fresh `[]` from a Zustand selector each
// render trips React 19's useSyncExternalStore infinite-loop guard.
const EMPTY_MILESTONES: Milestone[] = [];

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-chart-2/15 text-chart-2",
  high: "bg-accent/40 text-accent-foreground",
  urgent: "bg-destructive/15 text-destructive",
};

export function TodayView() {
  const tasks = useTaskStore((s) => s.tasks);
  const add = useTaskStore((s) => s.add);
  const complete = useTaskStore((s) => s.complete);
  const remove = useTaskStore((s) => s.remove);
  const settings = useSettingsStore((s) => s.settings);
  const loadMilestones = useMilestoneStore((s) => s.load);

  const [quickTitle, setQuickTitle] = useState("");
  const [planInput, setPlanInput] = useState("");
  const [planning, setPlanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const date = todayISO();

  // Keep milestones loaded for the visible tasks.
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  useEffect(() => {
    void loadMilestones(taskIds);
  }, [loadMilestones, taskIds]);
  const completed = useMemo(
    () => tasks.filter((t) => t.status === "done").length,
    [tasks],
  );
  const pct = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;

  const onQuickAdd = async () => {
    const title = quickTitle.trim();
    if (!title) return;
    await add({ title, scheduledDate: date });
    setQuickTitle("");
  };

  const onComplete = async (id: number) => {
    await complete(id);
    await awardTaskCompleted();
    await useProfileStore.getState().load();
    await setEmotion("celebrating");
    setTimeout(() => void setEmotion("idle"), 3000);
  };

  const onPlanDay = async () => {
    const input = planInput.trim();
    if (!input) return;
    setPlanning(true);
    setMessage(null);
    await setEmotion("thinking");
    try {
      const provider = await getProvider();
      const plan = await provider.breakdownTasks(input, {
        date,
        availableStart: settings?.defaultWorkStart ?? "09:00",
        availableEnd: settings?.defaultWorkEnd ?? "20:00",
      });
      for (const t of plan.tasks) {
        const taskId = await createTask({
          title: t.title,
          priority: t.priority,
          estimatedMinutes: t.estimatedMinutes,
          deadline: t.deadline ?? null,
          fixedStart: t.fixedStart ?? null,
          splittable: t.splittable !== false,
          scheduledDate: date,
        });
        if (t.milestones?.length) {
          await addMilestones(
            taskId,
            t.milestones.map((m) => ({
              title: m.title,
              estimatedMinutes: m.estimatedMinutes,
            })),
          );
        }
      }
      await useTaskStore.getState().load();
      setPlanInput("");
      setMessage(`Added ${plan.tasks.length} task(s) to today.`);
      await setEmotion("happy");
      setTimeout(() => void setEmotion("idle"), 3000);
    } catch (err) {
      await setEmotion("sad");
      setTimeout(() => void setEmotion("idle"), 3000);
      if (err instanceof MissingApiKeyError) {
        setMessage("Add your Gemini API key in Settings to use AI planning.");
      } else {
        setMessage(
          err instanceof Error ? err.message : "Something went wrong.",
        );
      }
    } finally {
      setPlanning(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          {tasks.length > 0 && ` · ${pct}% complete`}
        </p>
      </header>

      <FocusTimer />

      {/* AI plan my day */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="size-4 text-primary" /> Plan my day
          </CardTitle>
          <CardDescription>
            Tell Mochi what's on your plate — it breaks it into tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={planInput}
            onChange={(e) => setPlanInput(e.target.value)}
            placeholder={"DSA practice 2h\nEKAM development 4h\nAssignment 1h"}
            rows={4}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {message ?? "Available: " +
                (settings?.defaultWorkStart ?? "09:00") +
                "–" +
                (settings?.defaultWorkEnd ?? "20:00")}
            </span>
            <Button onClick={onPlanDay} disabled={planning}>
              {planning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick add */}
      <div className="flex gap-2">
        <Input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onQuickAdd()}
          placeholder="Add a task…"
        />
        <Button variant="secondary" onClick={onQuickAdd}>
          <Plus className="size-4" /> Add
        </Button>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {tasks.length === 0 && (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No tasks yet. Plan your day above ✨
          </div>
        )}
        {tasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            onComplete={onComplete}
            onRemove={remove}
          />
        ))}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onComplete,
  onRemove,
}: {
  task: Task;
  onComplete: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const milestones = useMilestoneStore(
    (s) => s.byTask[task.id] ?? EMPTY_MILESTONES,
  );
  const toggleMilestone = useMilestoneStore((s) => s.toggle);
  const [expanded, setExpanded] = useState(false);

  const doneCount = milestones.filter((m) => m.status === "done").length;
  const hasMilestones = milestones.length > 0;
  const isDone = task.status === "done";

  const onToggleMilestone = async (milestoneId: number, xpReward: number) => {
    const next = await toggleMilestone(task.id, milestoneId);
    if (next === "done") {
      await awardMilestoneCompleted(xpReward);
      await useProfileStore.getState().load();
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-card shadow-sm transition-colors",
        task.status === "done" && "opacity-60",
      )}
    >
      <div className="group flex items-center gap-3 p-3">
        <button
          onClick={() => !isDone && onComplete(task.id)}
          disabled={isDone}
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
            isDone
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/40 hover:border-primary",
          )}
        >
          {isDone && <Check className="size-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "truncate text-sm font-medium",
              task.status === "done" && "line-through",
            )}
          >
            {task.title}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{task.estimatedMinutes} min</span>
            {hasMilestones && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-0.5 hover:text-foreground"
              >
                {expanded ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
                {doneCount}/{milestones.length} steps
              </button>
            )}
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            PRIORITY_STYLES[task.priority],
          )}
        >
          {task.priority}
        </span>
        <button
          onClick={() => onRemove(task.id)}
          className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {hasMilestones && expanded && (
        <ul className="space-y-1 border-t px-3 py-2 pl-12">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <button
                onClick={() => void onToggleMilestone(m.id, m.xpReward)}
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                  m.status === "done"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40 hover:border-primary",
                )}
              >
                {m.status === "done" && <Check className="size-3" />}
              </button>
              <span
                className={cn(
                  "flex-1 text-xs",
                  m.status === "done" && "text-muted-foreground line-through",
                )}
              >
                {m.title}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {m.estimatedMinutes}m
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
