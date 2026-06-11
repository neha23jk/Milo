import type { LlmProviderId } from "@/types";
import { getSettings } from "@/services/settings";
import { GeminiProvider } from "./gemini";
import type { LlmProvider } from "./provider";

export * from "./provider";

/** Returns the configured LLM provider. Only Gemini is wired up for now. */
export async function getProvider(): Promise<LlmProvider> {
  const { provider } = await getSettings();
  return providerFor(provider);
}

export function providerFor(id: LlmProviderId): LlmProvider {
  switch (id) {
    case "gemini":
      return new GeminiProvider();
    // openai / claude / groq implementations land in later phases.
    default:
      return new GeminiProvider();
  }
}
