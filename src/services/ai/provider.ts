import type { LlmProviderId, Priority } from "@/types";

// --- Structured output the scheduler relies on (LLM does the fuzzy part) ---

export interface PlannedMilestone {
  title: string;
  estimatedMinutes: number;
}

export interface PlannedTask {
  title: string;
  priority: Priority;
  estimatedMinutes: number;
  deadline?: string | null;
  /** "HH:MM" if the event has a fixed start time (contest, meeting, class). */
  fixedStart?: string | null;
  /** False if the task needs one continuous block (contest, exam, deep call). */
  splittable?: boolean;
  milestones: PlannedMilestone[];
}

export interface StructuredPlan {
  tasks: PlannedTask[];
}

export interface PlanContext {
  /** ISO date the plan is for. */
  date: string;
  availableStart: string; // HH:MM
  availableEnd: string; // HH:MM
}

/** Guardrail result — keeps the assistant scoped to productivity. */
export type Intent = "productivity" | "off_topic";

/**
 * Swappable LLM provider. Gemini is the default; OpenAI/Claude/Groq can be
 * added later by implementing this interface.
 */
export interface LlmProvider {
  readonly id: LlmProviderId;

  /** Decompose raw user input into structured tasks + milestones. */
  breakdownTasks(input: string, ctx: PlanContext): Promise<StructuredPlan>;

  /** A short, friendly natural-language summary of a day/report. */
  generateSummary(context: string): Promise<string>;

  /** Classify whether a request is in-scope before answering. */
  classifyIntent(message: string): Promise<Intent>;
}

export class MissingApiKeyError extends Error {
  constructor(public providerId: LlmProviderId) {
    super(
      `No API key set for "${providerId}". Add your key in Settings to enable AI features.`,
    );
    this.name = "MissingApiKeyError";
  }
}
