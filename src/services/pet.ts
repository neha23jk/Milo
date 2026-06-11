import { execute, query } from "@/db";
import { emitApp } from "@/lib/events";
import type { PetEmotion, PetState, PetType } from "@/types";

interface PetRow {
  pet_type: string;
  current_emotion: string;
  growth_stage: number;
  last_interaction_at: string | null;
}

export async function getPetState(): Promise<PetState> {
  const rows = await query<PetRow>("SELECT * FROM pet_state WHERE id = 1");
  const r = rows[0];
  return {
    petType: (r?.pet_type as PetType) ?? "dog",
    currentEmotion: (r?.current_emotion as PetEmotion) ?? "idle",
    growthStage: r?.growth_stage ?? 0,
    lastInteractionAt: r?.last_interaction_at ?? null,
  };
}

/** Sets the pet's emotion and broadcasts it to all windows. */
export async function setEmotion(emotion: PetEmotion): Promise<void> {
  await execute("UPDATE pet_state SET current_emotion = ? WHERE id = 1", [
    emotion,
  ]);
  await emitApp<PetEmotion>("pet_emotion_changed", emotion);
}

export async function touchInteraction(): Promise<void> {
  await execute(
    "UPDATE pet_state SET last_interaction_at = datetime('now') WHERE id = 1",
  );
}
