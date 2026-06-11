import { useEffect, useState } from "react";
import { Coins, Flame, Lock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { listenApp } from "@/lib/events";
import { useProfileStore } from "@/stores/useProfileStore";
import { listAchievements } from "@/services/gamification";
import type { Achievement } from "@/types";

export function RewardsView() {
  const profile = useProfileStore((s) => s.profile);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    const refresh = () => void listAchievements().then(setAchievements);
    refresh();
    const unlisten = listenApp("achievement_unlocked", refresh);
    return () => void unlisten.then((fn) => fn());
  }, []);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Rewards</h1>
        <p className="text-sm text-muted-foreground">
          Level up your pet by staying productive.
        </p>
      </header>

      {/* Profile summary */}
      {profile && (
        <div className="grid grid-cols-3 gap-3">
          <Stat
            label="Level"
            value={profile.level}
            sub={`${profile.xp}/${profile.xpToNext} XP`}
            icon={<Trophy className="size-4 text-primary" />}
          />
          <Stat
            label="Streak"
            value={profile.currentStreak}
            sub={`best ${profile.longestStreak}`}
            icon={<Flame className="size-4 text-orange-500" />}
          />
          <Stat
            label="Coins"
            value={profile.coins}
            sub="spend in shop soon"
            icon={<Coins className="size-4 text-yellow-500" />}
          />
        </div>
      )}

      {/* Achievements */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Achievements · {unlockedCount}/{achievements.length}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {achievements.map((a) => (
            <div
              key={a.id}
              className={cn(
                "rounded-xl border p-4 transition-colors",
                a.unlocked
                  ? "bg-card shadow-sm"
                  : "border-dashed bg-muted/30 opacity-70",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-2xl">
                  {a.unlocked ? a.icon : <Lock className="size-5 text-muted-foreground" />}
                </span>
                {a.xpReward > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    +{a.xpReward} XP
                  </span>
                )}
              </div>
              <div className="text-sm font-medium">{a.name}</div>
              <div className="text-xs text-muted-foreground">
                {a.description}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
