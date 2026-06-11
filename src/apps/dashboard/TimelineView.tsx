import { useEffect, useMemo } from "react";
import {
  CalendarClock,
  Check,
  Coffee,
  Loader2,
  Pin,
  RotateCcw,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listenApp } from "@/lib/events";
import { useScheduleStore } from "@/stores/useScheduleStore";
import { useTaskStore } from "@/stores/useTaskStore";
import type { Priority } from "@/types";
import type { ScheduleBlockView } from "@/services/schedule";

const todayISO = () => new Date().toISOString().slice(0, 10);

const PRIORITY_BAR: Record<Priority, string> = {
  low: "bg-muted-foreground/40",
  medium: "bg-chart-2",
  high: "bg-accent-foreground",
  urgent: "bg-destructive",
};

function fmtTime(iso: string): string {
  // Stored as "YYYY-MM-DDTHH:MM:00" (local). Parse the clock part directly.
  const t = iso.slice(11, 16);
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function durationMin(b: ScheduleBlockView): number {
  return Math.round(
    (Date.parse(b.endTime) - Date.parse(b.startTime)) / 60000,
  );
}

export function TimelineView() {
  const date = todayISO();
  const blocks = useScheduleStore((s) => s.blocks);
  const overflow = useScheduleStore((s) => s.overflow);
  const generating = useScheduleStore((s) => s.generating);
  const load = useScheduleStore((s) => s.load);
  const generate = useScheduleStore((s) => s.generate);
  const setBlockStatus = useScheduleStore((s) => s.setBlockStatus);
  const tasks = useTaskStore((s) => s.tasks);

  useEffect(() => {
    void load(date);
    const unlisten = listenApp("schedule_updated", () => void load(date));
    return () => void unlisten.then((fn) => fn());
  }, [load, date]);

  const openTaskCount = useMemo(
    () => tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length,
    [tasks],
  );

  const taskBlocks = blocks.filter((b) => b.blockType === "task").length;
  const totalMin = blocks
    .filter((b) => b.blockType === "task")
    .reduce((sum, b) => sum + durationMin(b), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            {taskBlocks > 0 &&
              ` · ${taskBlocks} block${taskBlocks === 1 ? "" : "s"} · ${Math.round(
                totalMin / 60 * 10,
              ) / 10}h planned`}
          </p>
        </div>
        <Button onClick={() => void generate(date)} disabled={generating}>
          {generating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : blocks.length > 0 ? (
            <RotateCcw className="size-4" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {blocks.length > 0 ? "Reflow" : "Generate"}
        </Button>
      </header>

      {blocks.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <CalendarClock className="mx-auto mb-3 size-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            {openTaskCount > 0
              ? `You have ${openTaskCount} open task${openTaskCount === 1 ? "" : "s"}. Hit Generate to lay out your day.`
              : "No tasks to schedule yet. Add some on the Today tab first."}
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {blocks.map((b) => (
            <BlockRow key={b.id} block={b} onStatus={setBlockStatus} />
          ))}
        </ol>
      )}

      {overflow.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="mb-1 text-sm font-medium text-destructive">
            Didn't fit in your window
          </div>
          <ul className="space-y-0.5 text-sm text-muted-foreground">
            {overflow.map((o) => (
              <li key={o.taskId}>
                {o.title} — {o.unscheduledMinutes} min{" "}
                {o.reason === "no_contiguous_gap"
                  ? "(no continuous gap big enough between fixed events)"
                  : "unscheduled"}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Widen your available hours in Settings, or trim estimates.
          </p>
        </div>
      )}
    </div>
  );
}

function BlockRow({
  block,
  onStatus,
}: {
  block: ScheduleBlockView;
  onStatus: (id: number, status: ScheduleBlockView["status"]) => void;
}) {
  const isBreak = block.blockType === "break";
  const done = block.status === "done";
  const skipped = block.status === "skipped";
  const mins = durationMin(block);

  return (
    <li
      className={cn(
        "group flex items-stretch gap-3 rounded-xl border bg-card p-3 shadow-sm transition-colors",
        (done || skipped) && "opacity-55",
      )}
    >
      {/* time column */}
      <div className="w-20 shrink-0 pt-0.5 text-right">
        <div className="text-sm font-medium tabular-nums">
          {fmtTime(block.startTime)}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {mins}m
        </div>
      </div>

      {/* priority / type accent */}
      <div
        className={cn(
          "w-1 shrink-0 rounded-full",
          isBreak
            ? "bg-chart-4/50"
            : block.priority
              ? PRIORITY_BAR[block.priority]
              : "bg-muted-foreground/40",
        )}
      />

      {/* body */}
      <div className="min-w-0 flex-1 self-center">
        <div
          className={cn(
            "flex items-center gap-1.5 truncate text-sm font-medium",
            done && "line-through",
          )}
        >
          {isBreak && <Coffee className="size-3.5 text-muted-foreground" />}
          {block.fixed && <Pin className="size-3.5 text-primary" />}
          {block.title}
          {block.part && (
            <span className="text-xs font-normal text-muted-foreground">
              ({block.part.index}/{block.part.total})
            </span>
          )}
          {block.fixed && (
            <span className="text-xs font-normal text-muted-foreground">
              fixed
            </span>
          )}
        </div>
      </div>

      {/* actions (task blocks only) */}
      {!isBreak && !done && !skipped && (
        <div className="flex items-center gap-1 self-center opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => onStatus(block.id, "skipped")}
            title="Skip"
          >
            <SkipForward className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2"
            onClick={() => onStatus(block.id, "done")}
            title="Mark done"
          >
            <Check className="size-3.5" />
          </Button>
        </div>
      )}
      {done && <Check className="size-4 self-center text-primary" />}
    </li>
  );
}
