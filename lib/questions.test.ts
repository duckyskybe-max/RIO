import { describe, expect, it } from "vitest";
import { firstSense, readings, pickWord, meaningChoice, readingChoice, type Card } from "./questions";
import data from "../data/kanji.json";

const cards: Card[] = (data as any[])
  .filter((c) => c.kanken_level === "10")
  .map((c) => ({ id: String(c.position), position: c.position, level: "10", content: c }));
const by = (k: string) => cards.find((c) => c.content.kanji === k)!;

describe("parsing", () => {
  it("firstSense strips markers and header lines", () => {
    expect(firstSense(by("水").content.meaning_ja)).toMatch(/^みず。/);
    expect(firstSense(by("雨").content.meaning_ja)).toMatch(/^あめ。/);
  });
  it("readings joins okurigana and splits on both yomi", () => {
    const r = readings(by("学").content);
    expect(r).toContain("ガク");
    expect(r).toContain("まなぶ");
  });
  it("pickWord prefers compounds", () => {
    expect(["森林"]).toContain(pickWord(by("森").content));
    expect(pickWord(by("川").content)).toContain("川");
  });
});

describe("choices", () => {
  it("every kanji yields 4 distinct options containing the answer", () => {
    for (const c of cards) {
      for (const q of [meaningChoice(c, cards), readingChoice(c, cards)]) {
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options).size).toBe(4);
        expect(q.options).toContain(q.correct);
      }
    }
  });
  it("reading distractors are never valid readings of the kanji", () => {
    const c = by("森");
    const own = readings(c.content);
    const q = readingChoice(c, cards);
    expect(q.options.filter((o) => own.includes(o))).toEqual([q.correct]);
  });
});
