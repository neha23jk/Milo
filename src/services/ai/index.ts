import type { LlmProviderId } from "@/types";
import { getSettings } from "@/services/settings";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import type { LlmProvider } from "./provider";

export * from "./provider";

/** Providers that are fully implemented and selectable in Settings. */
export const SUPPORTED_PROVIDERS: { id: LlmProviderId; label: string }[] = [
  { id: "gemini", label: "Google Gemini" },
  { id: "groq", label: "Groq" },
];

/** Returns the configured LLM provider. */
export async function getProvider(): Promise<LlmProvider> {
  const { provider } = await getSettings();
  return providerFor(provider);
}

export function providerFor(id: LlmProviderId): LlmProvider {
  switch (id) {
    case "groq":
      return new GroqProvider();
    case "gemini":
    // openai / claude implementations land later.
    default:
      return new GeminiProvider();
  }
}
