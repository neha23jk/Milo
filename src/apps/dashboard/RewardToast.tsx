import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { listenApp } from "@/lib/events";
import type { Achievement } from "@/types";

interface Toast {
  id: number;
  icon: string;
  title: string;
  subtitle: string;
}

let nextId = 1;

export function RewardToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const push = (t: Omit<Toast, "id">) => {
      const id = nextId++;
      setToasts((cur) => [...cur, { ...t, id }]);
      setTimeout(
        () => setToasts((cur) => cur.filter((x) => x.id !== id)),
        4500,
      );
    };

    const unLevel = listenApp<number>("level_up", (level) =>
      push({
        icon: "🎉",
        title: `Level ${level}!`,
        subtitle: "Your pet is proud of you.",
      }),
    );
    const unAch = listenApp<Achievement>("achievement_unlocked", (a) =>
      push({
        icon: a.icon ?? "🏅",
        title: a.name,
        subtitle: a.description ?? "Achievement unlocked",
      }),
    );

    return () => {
      void unLevel.then((fn) => fn());
      void unAch.then((fn) => fn());
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="flex items-center gap-3 rounded-xl border bg-card p-3 pr-5 shadow-lg"
          >
            <span className="text-2xl">{t.icon}</span>
            <div>
              <div className="text-sm font-semibold">{t.title}</div>
              <div className="text-xs text-muted-foreground">{t.subtitle}</div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
