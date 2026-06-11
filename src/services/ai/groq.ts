import { fetch } from "@tauri-apps/plugin-http";
import { getApiKey } from "@/lib/secureStore";
import {
  type Intent,
  type LlmProvider,
  type PlannedTask,
  type PlanContext,
  type StructuredPlan,
  MissingApiKeyError,
} from "./provider";
import type { Priority } from "@/types";

// Groq is OpenAI-compatible. Free tier needs no billing and is broadly
// available, which sidesteps Gemini's region-locked free-tier quotas.
const BASE = "https://api.groq.com/openai/v1";
const MODEL = "llama-3.3-70b-versatile";

const SYSTEM_SCOPE = `You are Mochi, a friendly productivity pet assistant.
You ONLY help with productivity: planning the day, breaking tasks into milestones,
estimating effort, scheduling, focus, and motivation. You never act as a general
chatbot. If a request is off-topic, politely decline and steer back to productivity.`;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqResponse {
  choices?: { message?: { content?: string } }[];
}

async function callGroq(
  messages: ChatMessage[],
  jsonMode = false,
): Promise<string> {
  const key = await getApiKey("groq");
  if (!key) throw new MissingApiKeyError("groq");

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: jsonMode ? 0.3 : 0.7,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq request failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as GroqResponse;
  return json.choices?.[0]?.message?.content ?? "";
}

// --- Coercion: LLMs are fuzzy, so validate before trusting the shape ---------

const VALID_PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

function coercePlan(raw: unknown): StructuredPlan {
  const obj = raw as { tasks?: unknown };
  if (!obj || !Array.isArray(obj.tasks)) return { tasks: [] };

  const tasks: PlannedTask[] = obj.tasks
    .map((t): PlannedTask | null => {
      const x = t as Record<string, unknown>;
      const title = typeof x.title === "string" ? x.title.trim() : "";
      if (!title) return null;

      const priority = VALID_PRIORITIES.includes(x.priority as Priority)
        ? (x.priority as Priority)
        : "medium";
      const estimatedMinutes =
        Number.isFinite(x.estimatedMinutes) && (x.estimatedMinutes as number) > 0
          ? Math.round(x.estimatedMinutes as number)
          : 30;

      const milestones = Array.isArray(x.milestones)
        ? x.milestones
            .map((m) => {
              const mm = m as Record<string, unknown>;
              const mTitle = typeof mm.title === "string" ? mm.title.trim() : "";
              if (!mTitle) return null;
              return {
                title: mTitle,
                estimatedMinutes:
                  Number.isFinite(mm.estimatedMinutes) &&
                  (mm.estimatedMinutes as number) > 0
                    ? Math.round(mm.estimatedMinutes as number)
                    : 15,
              };
            })
            .filter((m): m is { title: string; estimatedMinutes: number } => m !== null)
        : [];

      const fixedStart =
        typeof x.fixedStart === "string" && /^\d{1,2}:\d{2}$/.test(x.fixedStart)
          ? x.fixedStart
          : null;

      return {
        title,
        priority,
        estimatedMinutes,
        deadline: typeof x.deadline === "string" ? x.deadline : null,
        fixedStart,
        splittable: x.splittable !== false, // default true unless explicitly false
        milestones,
      };
    })
    .filter((t): t is PlannedTask => t !== null);

  return { tasks };
}

export class GroqProvider implements LlmProvider {
  readonly id = "groq" as const;

  async breakdownTasks(
    input: string,
    ctx: PlanContext,
  ): Promise<StructuredPlan> {
    const prompt = `Date: ${ctx.date}. Available time: ${ctx.availableStart}-${ctx.availableEnd}.
Break the user's plan into tasks with milestones and realistic minute estimates.

Scheduling rules:
- "fixedStart": if the item has a fixed clock time (real contest, meeting, class, exam), set "HH:MM" (24h). Otherwise null.
- "splittable": false if it needs one continuous unbroken sitting (contests, exams, mock interviews, long calls); true for practice/study/chores done in pieces.
- List tasks in the order they should be done (prerequisites first, e.g. practice before a virtual contest).

Respond with ONLY a JSON object of this exact shape:
{
  "tasks": [
    {
      "title": "string",
      "priority": "low" | "medium" | "high" | "urgent",
      "estimatedMinutes": number,
      "deadline": string | null,
      "fixedStart": "HH:MM" | null,
      "splittable": boolean,
      "milestones": [ { "title": "string", "estimatedMinutes": number } ]
    }
  ]
}

User input:
${input}`;

    const text = await callGroq(
      [
        { role: "system", content: SYSTEM_SCOPE },
        { role: "user", content: prompt },
      ],
      true,
    );

    try {
      return coercePlan(JSON.parse(text));
    } catch {
      return { tasks: [] };
    }
  }

  async generateSummary(context: string): Promise<string> {
    const text = await callGroq([
      { role: "system", content: SYSTEM_SCOPE },
      {
        role: "user",
        content: `Write a short, warm 2-3 sentence productivity summary:\n${context}`,
      },
    ]);
    return text.trim();
  }

  async classifyIntent(message: string): Promise<Intent> {
    const text = await callGroq([
      {
        role: "user",
        content: `Classify the request as exactly "productivity" or "off_topic".
Productivity = tasks, planning, scheduling, focus, deadlines, motivation.
Reply with only the single word.\n\nRequest: ${message}`,
      },
    ]);
    return text.toLowerCase().includes("off_topic")
      ? "off_topic"
      : "productivity";
  }
}
