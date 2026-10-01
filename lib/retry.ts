/**
 * Same-session retry queue: a kanji answered wrong comes back after RETRY_GAP other
 * questions (so at most RETRY_GAP + 1 questions later, always within 5).
 */
export const RETRY_GAP = 3;

export interface RetryItem {
  cardId: string;
  wait: number; // questions still to answer before this card is due again
}

/** Queue a card (replacing any existing entry for it). */
export function enqueue(queue: RetryItem[], cardId: string, gap = RETRY_GAP): RetryItem[] {
  return [...queue.filter((r) => r.cardId !== cardId), { cardId, wait: gap }];
}

/** One question was answered: everything except that card moves a step closer. */
export function tick(queue: RetryItem[], answeredCardId: string): RetryItem[] {
  return queue.map((r) => (r.cardId === answeredCardId ? r : { ...r, wait: Math.max(0, r.wait - 1) }));
}

/** Take the first card that is due (or, when `force`, the first one regardless of wait). */
export function takeReady(queue: RetryItem[], force: boolean): { cardId: string; rest: RetryItem[] } | null {
  const i = queue.findIndex((r) => force || r.wait <= 0);
  if (i < 0) return null;
  return { cardId: queue[i].cardId, rest: queue.filter((_, j) => j !== i) };
}
