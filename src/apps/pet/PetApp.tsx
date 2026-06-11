import { useEffect } from "react";
import { motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Window } from "@tauri-apps/api/window";
import { listenApp } from "@/lib/events";
import { usePetStore } from "@/stores/usePetStore";
import { touchInteraction } from "@/services/pet";
import type { PetEmotion } from "@/types";
import { PetSprite } from "./PetSprite";

async function openDashboard() {
  const main = await Window.getByLabel("main");
  if (main) {
    await main.show();
    await main.unminimize();
    await main.setFocus();
  }
}

export function PetApp() {
  const emotion = usePetStore((s) => s.emotion);
  const load = usePetStore((s) => s.load);
  const applyEmotion = usePetStore((s) => s.applyEmotion);

  useEffect(() => {
    void load();

    const unlistenEmotion = listenApp<PetEmotion>(
      "pet_emotion_changed",
      (e) => applyEmotion(e),
    );
    const unlistenSleep = listenApp("tray://sleep_pet", () =>
      applyEmotion("sleeping"),
    );

    return () => {
      void unlistenEmotion.then((fn) => fn());
      void unlistenSleep.then((fn) => fn());
    };
  }, [load, applyEmotion]);

  const handleClick = async () => {
    await touchInteraction();
    await openDashboard();
  };

  // Drag the whole window when pressing on the pet body.
  const handlePointerDown = async (e: React.PointerEvent) => {
    if (e.button === 0) {
      await getCurrentWindow().startDragging();
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent select-none">
      <motion.div
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        className="cursor-pointer"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="Click me to open Mochi"
      >
        <PetSprite emotion={emotion} />
      </motion.div>
    </div>
  );
}
