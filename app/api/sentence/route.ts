import { askJson, llmEnabled, loadCard, userClient } from "@/lib/server";
import { pickWord } from "@/lib/questions";

export async function POST(req: Request) {
  const sb = await userClient(req);
  if (!sb) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!llmEnabled()) return Response.json({ error: "llm_disabled" }, { status: 503 });
  const { cardId } = await req.json();
  const card = await loadCard(sb, cardId);
  if (!card) return Response.json({ error: "not_found" }, { status: 404 });

  const word = pickWord(card.content) ?? card.content.kanji;
  try {
    const out = await askJson<{ sentence: string }>(
      "You write one short, natural Japanese sentence for a child learning kanji (Kanji Kentei level 10, about age 7). " +
        "Use only very simple vocabulary. Write ONLY the target kanji/word in kanji; every other word may be in hiragana.",
      `Target kanji: ${card.content.kanji}. Preferred word: ${word}. Return {"sentence": "..."} with the target in the sentence.`,
    );
    return Response.json({ sentence: out.sentence });
  } catch {
    return Response.json({ error: "llm_failed" }, { status: 502 });
  }
}
