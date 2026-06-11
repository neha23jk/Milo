import { fetch } from "@tauri-apps/plugin-http";
import { getApiKey } from "@/lib/secureStore";
import {
  type Intent,
  type LlmProvider,
  type PlanContext,
  type StructuredPlan,
  MissingApiKeyError,
} from "./provider";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-2.0-flash";

const SYSTEM_SCOPE = `You are Mochi, a friendly productivity pet assistant.
You ONLY help with productivity: planning the day, breaking tasks into milestones,
estimating effort, scheduling, focus, and motivation. You never act as a general
chatbot. If a request is off-topic, politely decline and steer back to productivity.`;

// JSON schema Gemini must conform to for task breakdown.
const PLAN_SCHEMA = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
          },
          estimatedMinutes: { type: "integer" },
          deadline: { type: "string", nullable: true },
          milestones: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                estimatedMinutes: { type: "integer" },
              },
              required: ["title", "estimatedMinutes"],
            },
          },
        },
        required: ["title", "priority", "estimatedMinutes", "milestones"],
      },
    },
  },
  required: ["tasks"],
};

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function callGemini(
  body: unknown,
): Promise<string> {
  const key = await getApiKey("gemini");
  if (!key) throw new MissingApiKeyError("gemini");

  const res = await fetch(`${BASE}/${MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini request failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as GeminiResponse;
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export class GeminiProvider implements LlmProvider {
  readonly id = "gemini" as const;

  async breakdownTasks(
    input: string,
    ctx: PlanContext,
  ): Promise<StructuredPlan> {
    const prompt = `Date: ${ctx.date}. Available time: ${ctx.availableStart}-${ctx.availableEnd}.
Break the user's plan into tasks with milestones and realistic minute estimates.
User input:\n${input}`;

    const text = await callGemini({
      systemInstruction: { parts: [{ text: SYSTEM_SCOPE }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: PLAN_SCHEMA,
      },
    });

    try {
      return JSON.parse(text) as StructuredPlan;
    } catch {
      return { tasks: [] };
    }
  }

  async generateSummary(context: string): Promise<string> {
    const text = await callGemini({
      systemInstruction: { parts: [{ text: SYSTEM_SCOPE }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Write a short, warm 2-3 sentence productivity summary:\n${context}`,
            },
          ],
        },
      ],
    });
    return text.trim();
  }

  async classifyIntent(message: string): Promise<Intent> {
    const text = await callGemini({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Classify the request as exactly "productivity" or "off_topic".
Productivity = tasks, planning, scheduling, focus, deadlines, motivation.
Reply with only the single word.\n\nRequest: ${message}`,
            },
          ],
        },
      ],
    });
    return text.toLowerCase().includes("off_topic")
      ? "off_topic"
      : "productivity";
  }
}
