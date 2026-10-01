import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./supabase";
import type { Card } from "./questions";

export const llmEnabled = () => !!process.env.ANTHROPIC_API_KEY;

/** Supabase client acting as the caller (RLS applies); null if the token is missing/invalid. */
export async function userClient(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return null;
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  return error || !data.user ? null : sb;
}

export async function loadCard(sb: NonNullable<Awaited<ReturnType<typeof userClient>>>, id: string) {
  const { data } = await sb.from("cards").select("id,position,level,content").eq("id", id).single();
  return (data as Card | null) ?? null;
}

const MODEL = "claude-haiku-4-5-20251001";

/** One Claude call that must answer with a single JSON object. */
export async function askJson<T>(system: string, user: string): Promise<T> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      system: `${system}\nReply with ONE JSON object and nothing else.`,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const body = await res.json();
  const text: string = body.content?.[0]?.text ?? "";
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(json) as T;
}
