import { Coins, Flame } from "lucide-react";
import { useProfileStore } from "@/stores/useProfileStore";

export function ProfilePanel() {
  const profile = useProfileStore((s) => s.profile);
  if (!profile) return null;

  const pct = Math.min(
    100,
    Math.round((profile.xp / Math.max(1, profile.xpToNext)) * 100),
  );

  return (
    <div className="rounded-lg border bg-card/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {profile.level}
          </div>
          <span className="text-xs font-medium">Level {profile.level}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Flame className="size-3 text-orange-500" />
            {profile.currentStreak}
          </span>
          <span className="flex items-center gap-1">
            <Coins className="size-3 text-yellow-500" />
            {profile.coins}
          </span>
        </div>
      </div>

      {/* XP bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-right text-[10px] text-muted-foreground tabular-nums">
        {profile.xp} / {profile.xpToNext} XP
      </div>
    </div>
  );
}
