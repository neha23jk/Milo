// ---------------------------------------------------------------------------
// Domain types for Mochi AI. These mirror the SQLite schema (see db/schema.ts).
// ---------------------------------------------------------------------------

export type Priority = "low" | "medium" | "high" | "urgent";

export type TaskStatus = "pending" | "in_progress" | "done" | "missed";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  priority: Priority;
  /** ISO datetime string, nullable. */
  deadline: string | null;
  estimatedMinutes: number;
  status: TaskStatus;
  /** ISO date (YYYY-MM-DD) the task is scheduled for. */
  scheduledDate: string | null;
  /** JSON-encoded string array of tags. */
  tags: string[];
  createdAt: string;
  completedAt: string | null;
}

export type MilestoneStatus = "pending" | "done";

export interface Milestone {
  id: number;
  taskId: number;
  title: string;
  orderIndex: number;
  status: MilestoneStatus;
  estimatedMinutes: number;
  xpReward: number;
  completedAt: string | null;
}

export type BlockType = "task" | "break" | "buffer";
export type BlockStatus = "scheduled" | "active" | "done" | "skipped";

export interface ScheduleBlock {
  id: number;
  scheduleId: number;
  taskId: number | null;
  milestoneId: number | null;
  blockType: BlockType;
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
  status: BlockStatus;
}

export interface Schedule {
  id: number;
  date: string; // YYYY-MM-DD
  availableStart: string; // HH:MM
  availableEnd: string; // HH:MM
  aiSummary: string | null;
  generatedAt: string;
}

export type PetEmotion =
  | "idle"
  | "sleeping"
  | "working"
  | "thinking"
  | "happy"
  | "excited"
  | "celebrating"
  | "sad";

export type PetType = "dog" | "penguin";

export interface PetState {
  petType: PetType;
  currentEmotion: PetEmotion;
  growthStage: number;
  lastInteractionAt: string | null;
}

export interface Profile {
  id: number;
  displayName: string;
  petType: PetType;
  level: number;
  xp: number;
  coins: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  createdAt: string;
}

export type LlmProviderId = "gemini" | "openai" | "claude" | "groq";

export interface Settings {
  theme: "light" | "dark" | "system";
  provider: LlmProviderId;
  defaultWorkStart: string; // HH:MM
  defaultWorkEnd: string; // HH:MM
  hideOnFullscreen: boolean;
  autostart: boolean;
}
