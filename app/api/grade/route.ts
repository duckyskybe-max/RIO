import { askJson, llmEnabled, loadCard, userClient } from "@/lib/server";
import { readings, firstSense } from "@/lib/questions";
import type { TaskType, Verdict } from "@/lib/scheduler";

const TASK_BRIEF: Record<string, string> = {
  meaning_recall: "The child saw the kanji alone and typed what it means (no choices). Japanese or English is fine.",
  word_reading: "The child was shown a word containing the kanji and typed how the WHOLE word is read (hiragana/katakana/romaji all fine).",
  sentence: "The child read a sentence containing the kanji and typed the reading of the kanji as used there and what the sentence means (Japanese or English).",
  explain: "Creature challenge: the child explained the kanji from memory (meaning, readings, a word, or a made-up creature/story). Judge whether their memory of the kanji's meaning and readings is accurate; creativity is welcome but accuracy matters.",
};

interface Grade {
  verdict: Verdict;
  error_type: string;
  feedback_en: string;
  feedback_ja: string;
}

export async function POST(req: Request) {
  const sb = await userClient(req);
  if (!sb) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!llmEnabled()) return Response.json({ error: "llm_disabled" }, { status: 503 });

  const { cardId, taskType, answer, word, sentence } = (await req.json()) as {
    cardId: string;
    taskType: TaskType;
    answer: string;
    word?: string;
    sentence?: string;
  };
  const brief = TASK_BRIEF[taskType];
  const card = await loadCard(sb, cardId);
  if (!brief || !card) return Response.json({ error: "bad_request" }, { status: 400 });
  if (!answer?.trim()) {
    return Response.json({ verdict: "wrong", error_type: "blank", feedback_en: "No answer given.", feedback_ja: "こたえがありません。" });
  }

  const c = card.content;
  const system =
    "You grade a young child's kanji answers (Kanji Kentei level 10). Be fair and encouraging, never harsh. " +
    "Verdict: 'correct' = right (minor spelling/kana-variant slips are fine); 'partial' = partly right (e.g. one reading right, meaning vague); 'wrong' = incorrect or unrelated. " +
    "error_type is one of: none, reading_confusion, meaning_confusion, similar_kanji, vague, blank, other. " +
    "feedback_en: one short friendly sentence in English that reveals the right answer if the child missed it. " +
    'feedback_ja: the same in very simple Japanese (mostly hiragana). JSON keys: verdict, error_type, feedback_en, feedback_ja.';
  const user = [
    `Task: ${brief}`,
    `Kanji: ${c.kanji}`,
    `Reference meaning (Japanese dictionary): ${firstSense(c.meaning_ja)} | full: ${c.meaning_ja.replace(/\n/g, " ")}`,
    `Valid readings: ${readings(c).join("、")}`,
    word ? `Word shown: ${word}` : "",
    sentence ? `Sentence shown: ${sentence}` : "",
    `Child's answer: ${answer.trim().slice(0, 600)}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const g = await askJson<Grade>(system, user);
    const verdict: Verdict = (["correct", "partial", "wrong"] as const).includes(g.verdict) ? g.verdict : "wrong";
    return Response.json({ ...g, verdict });
  } catch {
    return Response.json({ error: "llm_failed" }, { status: 502 });
  }
}
