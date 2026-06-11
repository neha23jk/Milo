import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Window } from "@tauri-apps/api/window";
import { listenApp } from "@/lib/events";
import { usePetStore } from "@/stores/usePetStore";
import { touchInteraction } from "@/services/pet";
import { startReminderLoop } from "@/services/reminderLoop";
import type { PetEmotion } from "@/types";
import { PetSprite } from "./PetSprite";

// Distance (px) the pointer must travel before we treat the gesture as a drag
// rather than a click.
const DRAG_THRESHOLD = 5;

async function openDashboard() {
  try {
    const main = await Window.getByLabel("main");
    if (main) {
      await main.show();
      await main.unminimize();
      await main.setFocus();
    }
  } catch (err) {
    console.error("Failed to open dashboard from pet:", err);
  }
}

export function PetApp() {
  const emotion = usePetStore((s) => s.emotion);
  const load = usePetStore((s) => s.load);
  const applyEmotion = usePetStore((s) => s.applyEmotion);

  useEffect(() => {
    void load();

    // The always-on pet window owns the reminder scheduler loop (no Rust daemon).
    const stopLoop = startReminderLoop();

    const unlistenEmotion = listenApp<PetEmotion>(
      "pet_emotion_changed",
      (e) => applyEmotion(e),
    );
    const unlistenSleep = listenApp("tray://sleep_pet", () =>
      applyEmotion("sleeping"),
    );
    const unlistenLevel = listenApp("level_up", () => {
      applyEmotion("celebrating");
      setTimeout(() => applyEmotion("idle"), 4000);
    });

    return () => {
      stopLoop();
      void unlistenEmotion.then((fn) => fn());
      void unlistenSleep.then((fn) => fn());
      void unlistenLevel.then((fn) => fn());
    };
  }, [load, applyEmotion]);

  // Track press origin so we can tell a tap (open dashboard) from a drag (move
  // window). Calling startDragging() on every press would swallow the click.
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pressStart.current = { x: e.screenX, y: e.screenY };
    dragging.current = false;
  };

  const handlePointerMove = async (e: React.PointerEvent) => {
    if (!pressStart.current || dragging.current) return;
    const dx = Math.abs(e.screenX - pressStart.current.x);
    const dy = Math.abs(e.screenY - pressStart.current.y);
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
      dragging.current = true;
      try {
        await getCurrentWindow().startDragging();
      } catch (err) {
        console.error("startDragging failed:", err);
      }
    }
  };

  const handlePointerUp = async () => {
    const wasClick = pressStart.current && !dragging.current;
    pressStart.current = null;
    if (wasClick) {
      await touchInteraction();
      await openDashboard();
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent select-none">
      <motion.div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="cursor-pointer"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="Click to open Mochi · drag to move"
      >
        <PetSprite emotion={emotion} />
      </motion.div>
    </div>
  );
}
