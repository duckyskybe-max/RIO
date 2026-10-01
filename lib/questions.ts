export interface Content {
  kanji: string;
  on_yomi: string;
  kun_yomi: string;
  stroke_count: number | null;
  radical: string;
  meaning_ja: string;
  words: string;
}
export interface Card {
  id: string;
  position: number;
  level: string | null;
  content: Content;
}

const CIRCLED = /^[①-⑳【A-C】\s]+/;

/** First usable sense of the Japanese definition, e.g. "みず。透明な液体。一般に、液体。" */
export function firstSense(meaning: string): string {
  const lines = meaning
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^【[^】]*】[^。]*$/.test(l));
  const line = (lines[0] ?? meaning).replace(/^[①-⑳]\s*/, "").replace(/^【[^】]*】/, "");
  return line.length > 48 ? line.slice(0, 47) + "…" : line;
}

/** All readings of a kanji, okurigana joined: まな（ぶ） -> まなぶ. */
export function readings(c: Content): string[] {
  const out = new Set<string>();
  for (const line of `${c.on_yomi}\n${c.kun_yomi}`.split("\n")) {
    const body = line.replace(/^［[^］]*］/, "");
    for (const raw of body.split(/[、,]/)) {
      const r = raw.replace(/[（(]([^）)]*)[）)]/g, "$1").trim();
      if (r) out.add(r);
    }
  }
  return [...out];
}

/** Words grouped by the deck's school-level tag: ［小］ elementary, ［中］ junior high, ... */
function wordsByTier(c: Content): Record<string, string[]> {
  const tiers: Record<string, string[]> = {};
  let tag = "";
  for (const line of c.words.split("\n")) {
    const m = line.trim().match(/^［(.)］$/);
    if (m) {
      tag = m[1];
      continue;
    }
    const ws = line
      .split("・")
      .map((w) => w.replace(/[（(][^）)]*[）)]/g, "").trim())
      .filter((w) => w.includes(c.kanji));
    (tiers[tag] ??= []).push(...ws);
  }
  return tiers;
}

/** A word containing the kanji: easiest tier first, compounds (森林) preferred over bare forms. */
export function pickWord(c: Content, rng: () => number = Math.random): string | null {
  const tiers = wordsByTier(c);
  for (const tag of ["小", "中", "高", "外", ""]) {
    const ws = tiers[tag] ?? [];
    const compounds = ws.filter((w) => w.length >= 2 && w.length <= 4);
    const pool = compounds.length ? compounds : ws;
    if (pool.length) return pool[Math.floor(rng() * pool.length)];
  }
  return null;
}

export function shuffle<T>(xs: T[], rng: () => number = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface ChoiceQuestion {
  options: string[];
  correct: string;
}

export function meaningChoice(card: Card, pool: Card[], rng: () => number = Math.random): ChoiceQuestion {
  const correct = firstSense(card.content.meaning_ja);
  const wrong = new Set<string>();
  for (const c of shuffle(pool, rng)) {
    const s = firstSense(c.content.meaning_ja);
    if (c.id !== card.id && s !== correct) wrong.add(s);
    if (wrong.size === 3) break;
  }
  return { correct, options: shuffle([correct, ...wrong], rng) };
}

export function readingChoice(card: Card, pool: Card[], rng: () => number = Math.random): ChoiceQuestion {
  const own = readings(card.content);
  const correct = own[Math.floor(rng() * own.length)];
  const wrong = new Set<string>();
  for (const c of shuffle(pool, rng)) {
    if (c.id === card.id) continue;
    const rs = readings(c.content).filter((r) => !own.includes(r));
    if (rs.length) wrong.add(rs[Math.floor(rng() * rs.length)]);
    if (wrong.size === 3) break;
  }
  return { correct, options: shuffle([correct, ...wrong], rng) };
}
