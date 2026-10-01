"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LLM_TASKS, review, taskForBox, type TaskType, type Verdict } from "@/lib/scheduler";
import { meaningChoice, pickWord, readingChoice, type Card, type ChoiceQuestion } from "@/lib/questions";

interface State { card_id: string; box: number; streak: number; lapses: number; next_review: string; introduced_at: string }
interface Question {
  card: Card;
  state: State;
  task: TaskType;
  choice?: ChoiceQuestion;
  word?: string;
  sentence?: string;
}
interface Result { verdict: Verdict; en: string; ja: string; picked?: string }

const PROMPTS: Record<TaskType, string> = {
  meaning_choice: "Pick the meaning · いみを えらぼう",
  meaning_recall: "What does it mean? · いみは？",
  reading_choice: "Pick a reading · よみを えらぼう",
  word_reading: "How is this word read? · よみは？",
  sentence: "Read the kanji in the sentence, and say what the sentence means",
  explain: "🐉 Creature challenge: tell everything you remember — meaning, readings, a word, or make up a creature!",
};
const BOX_LABEL = ["", "Box 1 · pictures of meaning", "Box 2 · recall", "Box 3 · readings", "Box 4 · in a word", "Box 5 · in a sentence", "Box 6 · creature challenge"];

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

export default function Study() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState("");
  const [name, setName] = useState("");
  const [q, setQ] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doneMsg, setDoneMsg] = useState("");
  const [llm, setLlm] = useState(false);
  const [counts, setCounts] = useState({ done: 0, correct: 0 });

  const cards = useRef<Card[]>([]);
  const states = useRef<Map<string, State>>(new Map());
  const newPerDay = useRef(50);
  const shownAt = useRef(0);
  const last = useRef("");

  const token = async () => (await supabase.auth.getSession()).data.session?.access_token ?? "";
  const api = async (path: string, body: unknown) => {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${await token()}` }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json() };
  };

  const build = useCallback(async (card: Card, state: State): Promise<Question | null> => {
    const task = taskForBox(state.box);
    const base: Question = { card, state, task };
    if (task === "meaning_choice") return { ...base, choice: meaningChoice(card, cards.current) };
    if (task === "reading_choice") return { ...base, choice: readingChoice(card, cards.current) };
    if (task === "word_reading") return { ...base, word: pickWord(card.content) ?? card.content.kanji };
    if (task === "sentence") {
      const { ok, data } = await api("/api/sentence", { cardId: card.id });
      if (!ok) throw new Error("Could not make a sentence. Please try again.");
      return { ...base, sentence: data.sentence };
    }
    return base;
  }, []);

  const next = useCallback(async () => {
    setError(""); setResult(null); setAnswer(""); setQ(null); setBusy(true);
    try {
      const now = Date.now();
      const usable = (s: State) => llm || !LLM_TASKS.includes(taskForBox(s.box));
      const due = [...states.current.values()].filter((s) => new Date(s.next_review).getTime() <= now && usable(s))
        .sort((a, b) => +new Date(a.next_review) - +new Date(b.next_review));
      let pick = due.find((s) => s.card_id !== last.current) ?? due[0];

      if (!pick) {
        const today = startOfToday().getTime();
        const introduced = [...states.current.values()].filter((s) => new Date(s.introduced_at).getTime() >= today).length;
        const fresh = cards.current.find((c) => !states.current.has(c.id));
        if (fresh && introduced < newPerDay.current) {
          const row = { user_id: uid, card_id: fresh.id, box: 1, streak: 0, lapses: 0, next_review: new Date().toISOString() };
          const { data, error } = await supabase.from("card_state").insert(row).select().single();
          if (error) throw error;
          states.current.set(fresh.id, data as State);
          pick = data as State;
        }
      }
      if (!pick) {
        const upcoming = [...states.current.values()].filter(usable).map((s) => +new Date(s.next_review)).sort((a, b) => a - b)[0];
        setDoneMsg(upcoming ? `All done for now! Next review ${new Date(upcoming).toLocaleString()}.` : "All done for today! Come back tomorrow for new kanji.");
        return;
      }
      setDoneMsg("");
      const card = cards.current.find((c) => c.id === pick!.card_id)!;
      const question = await build(card, pick);
      setQ(question);
      shownAt.current = performance.now();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [build, llm, uid]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace("/login");
      setUid(session.user.id);
      const [prof, cs, st, status] = await Promise.all([
        supabase.from("profiles").select("display_name,new_per_day").eq("id", session.user.id).single(),
        supabase.from("cards").select("id,position,level,content").order("position"),
        supabase.from("card_state").select("*").eq("user_id", session.user.id),
        fetch("/api/status").then((r) => r.json()),
      ]);
      setName(prof.data?.display_name ?? "");
      newPerDay.current = prof.data?.new_per_day ?? 50;
      cards.current = (cs.data ?? []) as Card[];
      states.current = new Map(((st.data ?? []) as State[]).map((s) => [s.card_id, s]));
      setLlm(!!status.llm);
      setReady(true);
    })();
  }, [router]);

  useEffect(() => { if (ready) void next(); }, [ready, next]);

  async function record(verdict: Verdict, ms: number, ans: string, extra: { error_type?: string; feedback?: string }) {
    if (!q) return;
    const out = review({ box: q.state.box, streak: q.state.streak, lapses: q.state.lapses }, verdict, ms);
    const upd = { box: out.box, streak: out.streak, lapses: out.lapses, next_review: out.nextReview.toISOString(), updated_at: new Date().toISOString() };
    states.current.set(q.card.id, { ...q.state, ...upd });
    last.current = q.card.id;
    await Promise.all([
      supabase.from("card_state").update(upd).eq("user_id", uid).eq("card_id", q.card.id),
      supabase.from("attempts").insert({
        user_id: uid, card_id: q.card.id, task_type: q.task, answer: ans, verdict,
        error_type: extra.error_type ?? null, feedback: extra.feedback ?? null,
        response_ms: Math.round(ms), box_before: q.state.box, box_after: out.box,
      }),
    ]);
    setCounts((c) => ({ done: c.done + 1, correct: c.correct + (verdict === "correct" ? 1 : 0) }));
  }

  async function pickOption(opt: string) {
    if (!q?.choice || result) return;
    const ms = performance.now() - shownAt.current;
    const verdict: Verdict = opt === q.choice.correct ? "correct" : "wrong";
    setResult({ verdict, en: verdict === "correct" ? "Correct! ⭕" : `Not quite. The answer is: ${q.choice.correct}`, ja: "", picked: opt });
    await record(verdict, ms, opt, {});
  }

  async function submitTyped() {
    if (!q || result) return;
    const ms = performance.now() - shownAt.current;
    setBusy(true); setError("");
    try {
      const { ok, data } = await api("/api/grade", { cardId: q.card.id, taskType: q.task, answer, word: q.word, sentence: q.sentence });
      if (!ok) throw new Error("The grader is unavailable right now. Please try again.");
      setResult({ verdict: data.verdict, en: data.feedback_en, ja: data.feedback_ja });
      await record(data.verdict, ms, answer, { error_type: data.error_type, feedback: data.feedback_en });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main><p className="muted">Loading…</p></main>;

  return (
    <main>
      <nav>
        <span>{name ? `Hi ${name}!` : "漢字 Study"} <span className="muted">· {counts.correct}/{counts.done} ⭕</span></span>
        <span>
          <Link href="/stats">Progress</Link>
          <button onClick={async () => { await supabase.auth.signOut(); router.replace("/login"); }}>Sign out</button>
        </span>
      </nav>

      {doneMsg && <div className="card"><h2 style={{ marginTop: 0 }}>🎉</h2><p>{doneMsg}</p>{!llm && <p className="muted">The AI grader isn&apos;t switched on yet, so typed-answer reviews are paused.</p>}</div>}
      {error && <p className="err">{error} <button className="opt" onClick={() => (q ? setError("") : next())}>Retry</button></p>}
      {busy && !q && !doneMsg && <p className="muted">Loading…</p>}

      {q && (
        <div className="card">
          <span className="tag">{BOX_LABEL[q.state.box]}</span>
          {q.task === "word_reading" ? <div className="kanji" style={{ fontSize: 72 }}>{q.word}</div>
            : q.task === "sentence" ? <div className="sentence">{q.sentence}</div>
            : <div className="kanji">{q.card.content.kanji}</div>}
          <div className="prompt">{PROMPTS[q.task]}</div>
          {q.task === "sentence" && <p className="prompt">Target kanji: <b>{q.card.content.kanji}</b></p>}

          {q.choice ? (
            <div className="opts">
              {q.choice.options.map((o) => (
                <button key={o} className={`opt ${result ? (o === q.choice!.correct ? "right" : o === result.picked ? "wrong" : "") : ""}`}
                  disabled={!!result} onClick={() => pickOption(o)}>{o}</button>
              ))}
            </div>
          ) : (
            <>
              <textarea rows={q.task === "explain" ? 5 : 2} value={answer} disabled={!!result || busy}
                onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer…" />
              {!result && <button className="primary" disabled={busy || !answer.trim()} onClick={submitTyped}>{busy ? "Checking…" : "Check"}</button>}
            </>
          )}

          {result && (
            <>
              <div className={`fb ${result.verdict}`}>
                <div>{result.en}</div>
                {result.ja && <div className="muted">{result.ja}</div>}
              </div>
              <button className="primary" onClick={next}>Next →</button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
