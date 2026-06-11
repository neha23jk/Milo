import type { PetEmotion } from "@/types";

// Placeholder dog sprite. In Phase 3 this is replaced by a Rive state machine
// (the `emotion` maps directly to a Rive input). For now we use an expressive
// emoji-based dog so the window + state plumbing is fully testable.
const FACE: Record<PetEmotion, string> = {
  idle: "🐶",
  sleeping: "😴",
  working: "🐶",
  thinking: "🤔",
  happy: "😊",
  excited: "🤩",
  celebrating: "🎉",
  sad: "🥺",
};

const BUBBLE: Partial<Record<PetEmotion, string>> = {
  working: "focus!",
  celebrating: "yay!",
  thinking: "...",
  excited: "let's go!",
  sad: "we slipped",
};

export function PetSprite({ emotion }: { emotion: PetEmotion }) {
  return (
    <div className="relative flex flex-col items-center">
      {BUBBLE[emotion] && (
        <div className="mb-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-primary shadow">
          {BUBBLE[emotion]}
        </div>
      )}
      <div className="flex size-28 items-center justify-center rounded-full bg-gradient-to-b from-primary/25 to-accent/40 text-6xl shadow-lg ring-4 ring-white/60 backdrop-blur-sm">
        <span role="img" aria-label={`dog ${emotion}`}>
          {FACE[emotion]}
        </span>
      </div>
    </div>
  );
}
