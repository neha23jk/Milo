import { useEffect } from "react";
import { Pause, Play, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFocusStore } from "@/stores/useFocusStore";

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function FocusTimer() {
  const sessionId = useFocusStore((s) => s.sessionId);
  const elapsed = useFocusStore((s) => s.elapsed);
  const start = useFocusStore((s) => s.start);
  const stop = useFocusStore((s) => s.stop);
  const tick = useFocusStore((s) => s.tick);

  const running = sessionId != null;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [running, tick]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm transition-colors",
        running && "border-primary/50 bg-primary/5",
      )}
    >
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-lg",
          running ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Timer className="size-4" />
      </div>
      <div className="flex-1">
        <div className="text-lg font-semibold tabular-nums leading-none">
          {fmt(elapsed)}
        </div>
        <div className="text-xs text-muted-foreground">
          {running ? "Focusing…" : "Focus timer"}
        </div>
      </div>
      <Button
        size="sm"
        variant={running ? "secondary" : "default"}
        onClick={() => void (running ? stop() : start())}
      >
        {running ? (
          <>
            <Pause className="size-4" /> Stop
          </>
        ) : (
          <>
            <Play className="size-4" /> Start
          </>
        )}
      </Button>
    </div>
  );
}
