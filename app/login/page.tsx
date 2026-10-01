"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { name } } });
    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    if (!res.data.session) return setMsg("Account created. Check the email inbox to confirm, then sign in.");
    router.replace("/");
  }

  return (
    <main>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>漢字 Study</h1>
        <form onSubmit={submit}>
          {mode === "up" && (
            <>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </>
          )}
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>Password</label>
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="primary" disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</button>
        </form>
        {msg && <p className="err">{msg}</p>}
        <p className="muted">
          <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === "in" ? "up" : "in"); }}>
            {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
          </a>
        </p>
      </div>
    </main>
  );
}
