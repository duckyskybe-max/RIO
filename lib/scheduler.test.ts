import { describe, expect, it } from "vitest";
import { review, taskForBox, BOX_INTERVAL_MIN, FAST_MS } from "./scheduler";

const now = new Date("2026-10-01T00:00:00Z");
const mins = (d: Date) => (d.getTime() - now.getTime()) / 60_000;
const p = (box: number) => ({ box, streak: 0, lapses: 0 });

describe("taskForBox", () => {
  it("maps boxes to the task ladder", () => {
    expect(taskForBox(1)).toBe("meaning_choice");
    expect(taskForBox(3)).toBe("reading_choice");
    expect(taskForBox(6)).toBe("explain");
  });
});

describe("review", () => {
  it("fast correct moves up and uses the new box interval", () => {
    const r = review(p(1), "correct", 3000, now);
    expect(r.box).toBe(2);
    expect(r.streak).toBe(1);
    expect(mins(r.nextReview)).toBe(BOX_INTERVAL_MIN[1]);
  });
  it("slow correct stays with a shorter interval", () => {
    const r = review(p(3), "correct", FAST_MS.reading_choice + 1, now);
    expect(r.box).toBe(3);
    expect(mins(r.nextReview)).toBe(Math.round(BOX_INTERVAL_MIN[2] * 0.75));
  });
  it("partial stays and halves the interval, resetting the streak", () => {
    const r = review({ box: 4, streak: 5, lapses: 0 }, "partial", 1000, now);
    expect(r.box).toBe(4);
    expect(r.streak).toBe(0);
    expect(mins(r.nextReview)).toBe(BOX_INTERVAL_MIN[3] / 2);
  });
  it("wrong drops two boxes (min 1) and counts a lapse", () => {
    expect(review(p(5), "wrong", 1000, now).box).toBe(3);
    const r = review(p(2), "wrong", 1000, now);
    expect(r.box).toBe(1);
    expect(r.lapses).toBe(1);
    expect(mins(r.nextReview)).toBe(10);
  });
  it("box 6 stays at 6 on success", () => {
    const r = review(p(6), "correct", 1000, now);
    expect(r.box).toBe(6);
    expect(mins(r.nextReview)).toBe(BOX_INTERVAL_MIN[5]);
  });
  it("never schedules sooner than 10 minutes", () => {
    expect(mins(review(p(1), "partial", 1000, now).nextReview)).toBe(10);
  });
});
