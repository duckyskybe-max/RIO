import { describe, expect, it } from "vitest";
import { enqueue, takeReady, tick, RETRY_GAP, type RetryItem } from "./retry";

describe("retry queue", () => {
  it("returns a missed card after RETRY_GAP other questions (<= 5 later)", () => {
    let q: RetryItem[] = enqueue([], "A");
    let asked = 0;
    for (;;) {
      const due = takeReady(q, false);
      if (due) {
        expect(due.cardId).toBe("A");
        break;
      }
      asked++;
      q = tick(q, `other${asked}`);
      expect(asked).toBeLessThan(5);
    }
    expect(asked).toBe(RETRY_GAP);
  });
  it("is not due immediately", () => {
    expect(takeReady(enqueue([], "A"), false)).toBeNull();
  });
  it("force takes the first card even if not due (queue ran dry)", () => {
    expect(takeReady(enqueue([], "A"), true)?.cardId).toBe("A");
  });
  it("re-enqueueing replaces rather than duplicates", () => {
    const q = enqueue(enqueue([], "A"), "A");
    expect(q).toHaveLength(1);
    expect(q[0].wait).toBe(RETRY_GAP);
  });
  it("answering the card itself does not advance its own countdown", () => {
    expect(tick(enqueue([], "A"), "A")[0].wait).toBe(RETRY_GAP);
  });
  it("several missed cards come back in the order they were missed", () => {
    let q = enqueue(enqueue([], "A"), "B");
    q = tick(q, "x"); // A:2 B:3? both decrement
    q = tick(q, "y");
    q = tick(q, "z");
    expect(takeReady(q, false)?.cardId).toBe("A");
  });
});
