"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Profile { id: string; display_name: string; role: string }
interface Attempt { card_id: string; task_type: string; verdict: string; error_type: string | null; response_ms: number; created_at: string }

export default function Stats() {
  const router = useRouter();
  const [people, setPeople] = useState<Profile[]>([]);
  const [who, setWho] = useState("");
  const [boxes, setBoxes] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [kanji, setKanji] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace("/login");
      const [{ data: profs }, { data: cards }] = await Promise.all([
        supabase.from("profiles").select("id,display_name,role"),
        supabase.from("cards").select("id,content->>kanji"),
      ]);
      setPeople((profs ?? []) as Profile[]);
      setKanji(Object.fromEntries((cards ?? []).map((c: any) => [c.id, c.kanji])));
      setWho(session.user.id);
    })();
  }, [router]);

  useEffect(() => {
    if (!who) return;
    (async () => {
      const [{ data: st }, { data: at }] = await Promise.all([
        supabase.from("card_state").select("box").eq("user_id", who),
        supabase.from("attempts").select("card_id,task_type,verdict,error_type,response_ms,created_at").eq("user_id", who).order("created_at", { ascending: false }).limit(1000),
      ]);
      const b = [0, 0, 0, 0, 0, 0];
      (st ?? []).forEach((s: any) => b[s.box - 1]++);
      setBoxes(b);
      setAttempts((at ?? []) as Attempt[]);
    })();
  }, [who]);

  const total = attempts.length;
  const correct = attempts.filter((a) => a.verdict === "correct").length;
  const avg = total ? Math.round(attempts.reduce((s, a) => s + a.response_ms, 0) / total / 100) / 10 : 0;

  const byCard = new Map<string, { n: number; wrong: number; ms: number }>();
  attempts.forEach((a) => {
    const e = byCard.get(a.card_id) ?? { n: 0, wrong: 0, ms: 0 };
    e.n++; e.ms += a.response_ms; if (a.verdict !== "correct") e.wrong++;
    byCard.set(a.card_id, e);
  });
  const hardest = [...byCard.entries()].filter(([, e]) => e.wrong > 0).sort((a, b) => b[1].wrong / b[1].n - a[1].wrong / a[1].n || b[1].wrong - a[1].wrong).slice(0, 8);

  const byTask = new Map<string, { n: number; ok: number }>();
  attempts.forEach((a) => {
    const e = byTask.get(a.task_type) ?? { n: 0, ok: 0 };
    e.n++; if (a.verdict === "correct") e.ok++;
    byTask.set(a.task_type, e);
  });
  const errs = new Map<string, number>();
  attempts.forEach((a) => { if (a.error_type && a.error_type !== "none") errs.set(a.error_type, (errs.get(a.error_type) ?? 0) + 1); });

  return (
    <main>
      <nav><Link href="/" style={{ marginLeft: 0 }}>← Study</Link>
        {people.length > 1 && (
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            {people.map((p) => <option key={p.id} value={p.id}>{p.display_name || p.role}</option>)}
          </select>
        )}
      </nav>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Boxes</h3>
        <div className="boxes">{boxes.map((n, i) => <div key={i}><b>{n}</b><span className="muted">Box {i + 1}</span></div>)}</div>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Overall</h3>
        <p>{total} answers · {total ? Math.round((correct / total) * 100) : 0}% correct · {avg}s average</p>
        <table><tbody>{[...byTask.entries()].map(([t, e]) => <tr key={t}><td>{t}</td><td>{e.n} tries</td><td>{Math.round((e.ok / e.n) * 100)}%</td></tr>)}</tbody></table>
        {errs.size > 0 && <p className="muted">Mistake types: {[...errs.entries()].map(([k, v]) => `${k} ×${v}`).join(", ")}</p>}
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Needs work</h3>
        {hardest.length === 0 ? <p className="muted">No mistakes yet.</p> : (
          <table><tbody>{hardest.map(([id, e]) => (
            <tr key={id}><td style={{ fontSize: 28 }}>{kanji[id]}</td><td>{e.wrong}/{e.n} missed</td><td>{(e.ms / e.n / 1000).toFixed(1)}s avg</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </main>
  );
}
