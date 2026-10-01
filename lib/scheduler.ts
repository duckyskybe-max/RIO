export type Verdict = "correct" | "partial" | "wrong";

export const TASKS = [
  "meaning_choice", // box 1
  "meaning_recall", // box 2
  "reading_choice", // box 3
  "word_reading", //   box 4
  "sentence", //       box 5
  "explain", //        box 6 (creature challenge)
] as const;
export type TaskType = (typeof TASKS)[number];

/** Minutes until the next review once a card sits in this box. */
export const BOX_INTERVAL_MIN = [10, 1440, 4320, 10080, 20160, 43200];
export const MAX_BOX = 6;

/** Answering faster than this counts as "fluent". */
export const FAST_MS: Record<TaskType, number> = {
  meaning_choice: 8000,
  meaning_recall: 20000,
  reading_choice: 8000,
  word_reading: 20000,
  sentence: 40000,
  explain: 90000,
};

export const LLM_TASKS: TaskType[] = ["meaning_recall", "word_reading", "sentence", "explain"];

export const taskForBox = (box: number): TaskType => TASKS[Math.min(Math.max(box, 1), MAX_BOX) - 1];

export interface CardProgress {
  box: number;
  streak: number;
  lapses: number;
}
export interface ReviewOutcome extends CardProgress {
  nextReview: Date;
}

const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

/**
 * Leitner-style update:
 *  - correct and fast  -> up one box, interval of the new box
 *  - correct but slow  -> stay, 75% of the box interval (not yet automatic)
 *  - partial           -> stay, 50% of the box interval
 *  - wrong             -> down two boxes (min 1), lapse recorded
 */
export function review(p: CardProgress, verdict: Verdict, ms: number, now = new Date()): ReviewOutcome {
  const task = taskForBox(p.box);
  let box = p.box;
  let streak = p.streak;
  let lapses = p.lapses;
  let factor = 1;

  if (verdict === "wrong") {
    box = Math.max(1, p.box - 2);
    streak = 0;
    lapses += 1;
  } else if (verdict === "partial") {
    streak = 0;
    factor = 0.5;
  } else if (ms <= FAST_MS[task]) {
    box = Math.min(MAX_BOX, p.box + 1);
    streak += 1;
  } else {
    streak += 1;
    factor = 0.75;
  }

  const minutes = Math.max(BOX_INTERVAL_MIN[0], Math.round(BOX_INTERVAL_MIN[box - 1] * factor));
  return { box, streak, lapses, nextReview: addMinutes(now, minutes) };
}
