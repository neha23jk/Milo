import { execute, query } from "@/db";
import { emitApp } from "@/lib/events";
import { previousDate, todayLocalDate } from "@/lib/datetime";
import type { Achievement, Profile } from "@/types";

// --- Level curve ------------------------------------------------------------

/** XP required to advance *from* `level` to the next. Gentle linear ramp. */
export function xpToNext(level: number): number {
  return 100 + (level - 1) * 50;
}

const TASK_XP = 25;
const TASK_COINS = 5;
const DEFAULT_MILESTONE_XP = 10;
const MILESTONE_COINS = 2;
/** Coins granted each time the player levels up (scales with the new level). */
const levelUpCoins = (level: number) => 20 * level;

// --- Profile ----------------------------------------------------------------

interface ProfileRow {
  id: number;
  display_name: string;
  pet_type: string;
  level: number;
  xp: number;
  coins: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  created_at: string;
}

export interface ProfileView {
  displayName: string;
  level: number;
  /** XP accumulated toward the next level. */
  xp: number;
  /** XP needed to reach the next level. */
  xpToNext: number;
  coins: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

async function readProfile(): Promise<ProfileRow> {
  const rows = await query<ProfileRow>("SELECT * FROM profile WHERE id = 1");
  return rows[0];
}

export async function getProfile(): Promise<ProfileView> {
  const p = await readProfile();
  return {
    displayName: p.display_name,
    level: p.level,
    xp: p.xp,
    xpToNext: xpToNext(p.level),
    coins: p.coins,
    currentStreak: p.current_streak,
    longestStreak: p.longest_streak,
    lastActiveDate: p.last_active_date,
  };
}

// --- Activity log -----------------------------------------------------------

async function logActivity(
  type: string,
  amount: number,
  reason: string,
): Promise<void> {
  await execute(
    "INSERT INTO activity_log (type, amount, reason) VALUES (?, ?, ?)",
    [type, amount, reason],
  );
}

// --- Granting XP / coins ----------------------------------------------------

interface GrantResult {
  leveledUp: boolean;
  level: number;
}

/** Add XP + coins, rolling over level-ups. Emits `level_up` per level gained. */
async function grant(
  xpGain: number,
  coinGain: number,
  reason: string,
): Promise<GrantResult> {
  const p = await readProfile();
  let xp = p.xp + xpGain;
  let coins = p.coins + coinGain;
  let level = p.level;
  let leveledUp = false;

  let needed = xpToNext(level);
  while (xp >= needed) {
    xp -= needed;
    level += 1;
    coins += levelUpCoins(level);
    leveledUp = true;
    needed = xpToNext(level);
  }

  await execute(
    "UPDATE profile SET xp = ?, coins = ?, level = ? WHERE id = 1",
    [xp, coins, level],
  );
  if (xpGain > 0) await logActivity("xp_award", xpGain, reason);

  if (leveledUp) {
    await emitApp("level_up", level);
  }
  return { leveledUp, level };
}

// --- Streaks ----------------------------------------------------------------

interface StreakResult {
  streak: number;
  advanced: boolean;
}

/** Record that the user did something productive today; roll the daily streak. */
async function registerActivity(): Promise<StreakResult> {
  const p = await readProfile();
  const today = todayLocalDate();

  if (p.last_active_date === today) {
    return { streak: p.current_streak, advanced: false };
  }

  const streak =
    p.last_active_date === previousDate(today) ? p.current_streak + 1 : 1;
  const longest = Math.max(streak, p.longest_streak);

  await execute(
    "UPDATE profile SET current_streak = ?, longest_streak = ?, last_active_date = ? WHERE id = 1",
    [streak, longest, today],
  );
  await logActivity("streak", streak, "daily activity");
  return { streak, advanced: true };
}

// --- Achievements -----------------------------------------------------------

interface AchievementRow {
  id: number;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  xp_reward: number;
  coin_reward: number;
  criteria: string | null;
  unlocked_at: string | null;
}

interface Criteria {
  metric: "tasks_completed" | "streak" | "level";
  gte: number;
}

interface AchievementContext {
  level: number;
  currentStreak: number;
  tasksCompleted: number;
}

function meets(criteria: Criteria, ctx: AchievementContext): boolean {
  switch (criteria.metric) {
    case "tasks_completed":
      return ctx.tasksCompleted >= criteria.gte;
    case "streak":
      return ctx.currentStreak >= criteria.gte;
    case "level":
      return ctx.level >= criteria.gte;
    default:
      return false;
  }
}

function mapAchievement(r: AchievementRow): Achievement {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    icon: r.icon,
    xpReward: r.xp_reward,
    coinReward: r.coin_reward,
    unlocked: r.unlocked_at != null,
    unlockedAt: r.unlocked_at,
  };
}

/** Full catalog with unlock status, for the Rewards view. */
export async function listAchievements(): Promise<Achievement[]> {
  const rows = await query<AchievementRow>(
    `SELECT a.*, ua.unlocked_at AS unlocked_at
       FROM achievements a
       LEFT JOIN user_achievements ua ON ua.achievement_id = a.id
      ORDER BY a.id ASC`,
  );
  return rows.map(mapAchievement);
}

async function buildContext(level: number, currentStreak: number): Promise<AchievementContext> {
  const rows = await query<{ n: number }>(
    "SELECT COUNT(*) AS n FROM tasks WHERE status = 'done'",
  );
  return { level, currentStreak, tasksCompleted: rows[0]?.n ?? 0 };
}

/** Unlock any newly-earned achievements; grant their rewards. */
async function checkAchievements(
  ctx: AchievementContext,
): Promise<Achievement[]> {
  const rows = await query<AchievementRow>(
    `SELECT a.*, ua.unlocked_at AS unlocked_at
       FROM achievements a
       LEFT JOIN user_achievements ua ON ua.achievement_id = a.id`,
  );

  const newly: Achievement[] = [];
  for (const r of rows) {
    if (r.unlocked_at) continue;
    if (!r.criteria) continue;
    let criteria: Criteria;
    try {
      criteria = JSON.parse(r.criteria) as Criteria;
    } catch {
      continue;
    }
    if (!meets(criteria, ctx)) continue;

    await execute(
      "INSERT INTO user_achievements (achievement_id) VALUES (?)",
      [r.id],
    );
    if (r.xp_reward > 0 || r.coin_reward > 0) {
      await grant(r.xp_reward, r.coin_reward, `achievement:${r.key}`);
    }
    const ach = mapAchievement({ ...r, unlocked_at: new Date().toISOString() });
    newly.push(ach);
    await emitApp("achievement_unlocked", ach);
  }
  return newly;
}

// --- Public award API -------------------------------------------------------

export interface AwardResult {
  xpGained: number;
  coinsGained: number;
  leveledUp: boolean;
  newLevel: number;
  streak: number;
  unlocked: Achievement[];
}

async function award(
  xp: number,
  coins: number,
  reason: string,
): Promise<AwardResult> {
  const g = await grant(xp, coins, reason);
  const s = await registerActivity();
  const ctx = await buildContext(g.level, s.streak);
  const unlocked = await checkAchievements(ctx);
  await emitApp("profile_changed");
  return {
    xpGained: xp,
    coinsGained: coins,
    leveledUp: g.leveledUp,
    newLevel: g.level,
    streak: s.streak,
    unlocked,
  };
}

export function awardTaskCompleted(): Promise<AwardResult> {
  return award(TASK_XP, TASK_COINS, "task_done");
}

export function awardMilestoneCompleted(
  xpReward = DEFAULT_MILESTONE_XP,
): Promise<AwardResult> {
  return award(xpReward, MILESTONE_COINS, "milestone_done");
}

export type { Profile };
