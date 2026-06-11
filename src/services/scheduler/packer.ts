// ---------------------------------------------------------------------------
// Deterministic schedule packer.
//
// The LLM is only ever trusted for the *fuzzy* parts (what the tasks are, rough
// minute estimates, milestone breakdown, whether something is fixed/continuous).
// The actual placement of work into non-overlapping time blocks is done HERE, in
// plain TypeScript, so the math is exact and reproducible.
//
// Placement model:
//   1. Anchored tasks (fixedStart, e.g. a real contest at 20:00) are pinned at
//      their times — immovable.
//   2. The remaining window is split into the free gaps around those anchors.
//   3. Flexible tasks are flowed into the gaps in order. Non-splittable tasks
//      (a contest, an exam) require one contiguous gap big enough to hold them;
//      splittable tasks fill gaps in focus-sized chunks with breaks between.
//
// Pure module: no DB, no Tauri, no clock reads beyond what's passed in.
// ---------------------------------------------------------------------------

import type { BlockType, Priority } from "@/types";

const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export interface PackTask {
  id: number;
  title: string;
  priority: Priority;
  estimatedMinutes: number;
  /** ISO datetime, used as a tie-breaker (earlier deadline first). */
  deadline?: string | null;
  /** "HH:MM" anchored start for fixed events; null/undefined = flexible. */
  fixedStart?: string | null;
  /** When false, the task must be placed as one continuous block. Default true. */
  splittable?: boolean;
}

export interface PackOptions {
  /** Minutes of focused work before a break is inserted. */
  focusBeforeBreak: number;
  /** Length of an inserted break, in minutes. */
  breakMinutes: number;
  /** Don't bother placing a work chunk smaller than this. */
  minChunkMinutes: number;
}

export const DEFAULT_PACK_OPTIONS: PackOptions = {
  focusBeforeBreak: 50,
  breakMinutes: 10,
  minChunkMinutes: 10,
};

export interface PackedBlock {
  taskId: number | null;
  blockType: BlockType;
  /** Minute offset from midnight (local). */
  startMinute: number;
  endMinute: number;
  title: string;
  /** True for pinned fixed-time events. */
  fixed?: boolean;
  /** Present when a task was split across multiple blocks. */
  part?: { index: number; total: number };
}

export interface PackOverflow {
  taskId: number;
  title: string;
  /** Minutes of this task that didn't fit in the window. */
  unscheduledMinutes: number;
  /** Why it didn't fit, for a clearer UI message. */
  reason: "no_room" | "no_contiguous_gap";
}

export interface PackResult {
  blocks: PackedBlock[];
  overflow: PackOverflow[];
}

/** "HH:MM" -> minutes since midnight. Clamped to a valid day. */
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map((n) => parseInt(n, 10));
  const total = (h || 0) * 60 + (m || 0);
  return Math.max(0, Math.min(24 * 60, total));
}

/** Minutes since midnight -> "HH:MM" (24h, zero-padded). */
export function minutesToHm(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(total)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Combine a YYYY-MM-DD date with a minute-of-day into a local ISO datetime. */
export function dateAtMinute(date: string, minute: number): string {
  return `${date}T${minutesToHm(minute)}:00`;
}

/**
 * Order flexible tasks: higher priority first, then earlier deadline, then the
 * input order (which reflects the AI's intended sequence — prerequisites first).
 */
function orderFlexible(tasks: PackTask[]): PackTask[] {
  return tasks
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const p = PRIORITY_RANK[a.t.priority] - PRIORITY_RANK[b.t.priority];
      if (p !== 0) return p;
      const da = a.t.deadline ? Date.parse(a.t.deadline) : Infinity;
      const db = b.t.deadline ? Date.parse(b.t.deadline) : Infinity;
      if (da !== db) return da - db;
      return a.i - b.i; // preserve AI ordering
    })
    .map((x) => x.t);
}

interface Interval {
  start: number;
  end: number;
}

/** Free gaps within [start,end] after removing the occupied (anchored) ranges. */
function freeIntervals(
  start: number,
  end: number,
  occupied: Interval[],
): Interval[] {
  const merged: Interval[] = [];
  for (const o of [...occupied].sort((a, b) => a.start - b.start)) {
    const s = Math.max(start, o.start);
    const e = Math.min(end, o.end);
    if (e <= s) continue; // outside the window
    const last = merged[merged.length - 1];
    if (last && s <= last.end) last.end = Math.max(last.end, e);
    else merged.push({ start: s, end: e });
  }

  const free: Interval[] = [];
  let cursor = start;
  for (const m of merged) {
    if (m.start > cursor) free.push({ start: cursor, end: m.start });
    cursor = Math.max(cursor, m.end);
  }
  if (cursor < end) free.push({ start: cursor, end });
  return free;
}

/**
 * Fill one free interval with chunks of a splittable task, inserting breaks
 * between focus chunks. Mutates `blocks` and the interval; returns leftover
 * minutes that didn't fit in this interval.
 */
function fillInterval(
  interval: Interval,
  task: PackTask,
  remaining: number,
  opts: PackOptions,
  blocks: PackedBlock[],
): number {
  let cursor = interval.start;
  let sinceBreak = 0;

  while (remaining > 0 && cursor < interval.end) {
    let avail = interval.end - cursor;
    if (avail < opts.minChunkMinutes && avail < remaining) break;

    if (
      sinceBreak >= opts.focusBeforeBreak &&
      avail > opts.breakMinutes + opts.minChunkMinutes
    ) {
      blocks.push({
        taskId: null,
        blockType: "break",
        startMinute: cursor,
        endMinute: cursor + opts.breakMinutes,
        title: "Break",
      });
      cursor += opts.breakMinutes;
      sinceBreak = 0;
      avail = interval.end - cursor;
    }

    const chunk = Math.min(remaining, opts.focusBeforeBreak - sinceBreak, avail);
    if (chunk <= 0 || (chunk < opts.minChunkMinutes && chunk < remaining)) break;

    blocks.push({
      taskId: task.id,
      blockType: "task",
      startMinute: cursor,
      endMinute: cursor + chunk,
      title: task.title,
    });
    cursor += chunk;
    sinceBreak += chunk;
    remaining -= chunk;
  }

  interval.start = cursor; // consumed portion of this gap
  return remaining;
}

/** Re-number task blocks that ended up split into "part i of n". */
function numberParts(blocks: PackedBlock[]): void {
  const counts = new Map<number, number>();
  for (const b of blocks) {
    if (b.blockType === "task" && b.taskId != null && !b.fixed) {
      counts.set(b.taskId, (counts.get(b.taskId) ?? 0) + 1);
    }
  }
  const seen = new Map<number, number>();
  for (const b of blocks) {
    if (b.blockType !== "task" || b.taskId == null || b.fixed) continue;
    const total = counts.get(b.taskId) ?? 1;
    if (total <= 1) continue;
    const idx = (seen.get(b.taskId) ?? 0) + 1;
    seen.set(b.taskId, idx);
    b.part = { index: idx, total };
  }
}

export function packSchedule(
  tasks: PackTask[],
  availableStart: string,
  availableEnd: string,
  options: Partial<PackOptions> = {},
): PackResult {
  const opts = { ...DEFAULT_PACK_OPTIONS, ...options };
  const startMin = hmToMinutes(availableStart);
  const endMin = hmToMinutes(availableEnd);

  const blocks: PackedBlock[] = [];
  const overflow: PackOverflow[] = [];

  // --- 1. Pin anchored (fixed-time) tasks -------------------------------------
  const anchored = tasks.filter((t) => t.fixedStart && t.estimatedMinutes > 0);
  const flexible = tasks.filter((t) => !t.fixedStart && t.estimatedMinutes > 0);
  const occupied: Interval[] = [];

  for (const a of anchored) {
    const s = hmToMinutes(a.fixedStart!);
    const e = s + a.estimatedMinutes;
    blocks.push({
      taskId: a.id,
      blockType: "task",
      startMinute: s,
      endMinute: e,
      title: a.title,
      fixed: true,
    });
    occupied.push({ start: s, end: e });
  }

  // --- 2. Compute free gaps and flow flexible tasks into them -----------------
  const gaps = freeIntervals(startMin, endMin, occupied);

  for (const task of orderFlexible(flexible)) {
    const duration = task.estimatedMinutes;

    if (task.splittable === false) {
      // Needs one contiguous gap big enough to hold the whole thing.
      const gap = gaps.find((g) => g.end - g.start >= duration);
      if (!gap) {
        overflow.push({
          taskId: task.id,
          title: task.title,
          unscheduledMinutes: duration,
          reason: "no_contiguous_gap",
        });
        continue;
      }
      blocks.push({
        taskId: task.id,
        blockType: "task",
        startMinute: gap.start,
        endMinute: gap.start + duration,
        title: task.title,
      });
      gap.start += duration;
    } else {
      // Splittable: flow across gaps in focus-sized chunks.
      let remaining = duration;
      for (const gap of gaps) {
        if (remaining <= 0) break;
        if (gap.end - gap.start < opts.minChunkMinutes) continue;
        remaining = fillInterval(gap, task, remaining, opts, blocks);
      }
      if (remaining > 0) {
        overflow.push({
          taskId: task.id,
          title: task.title,
          unscheduledMinutes: remaining,
          reason: "no_room",
        });
      }
    }
  }

  blocks.sort((a, b) => a.startMinute - b.startMinute);
  numberParts(blocks);
  return { blocks, overflow };
}
