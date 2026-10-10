"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AudioWaveform, LoaderCircle, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">(params.get("mode") === "signup" ? "signup" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const result = mode === "signup"
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim().toLowerCase(), password })
        : await authClient.signIn.email({ email: email.trim().toLowerCase(), password });
      if (result.error) { setError("We couldn't authenticate those details. Check them and try again."); return; }
      router.replace("/chat"); router.refresh();
    } catch {
      setError("Authentication is temporarily unavailable. Please try again.");
    } finally { setBusy(false); }
  }

  return <main className="flex min-h-screen items-center justify-center px-5 py-12">
    <div className="w-full max-w-md">
      <Link href="/" className="mb-10 flex items-center justify-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-[var(--accent)]"><AudioWaveform size={22}/></span><span className="font-[family-name:var(--font-space)] text-xl tracking-[0.2em]">SAMURA</span></Link>
      <section className="rounded-3xl border border-white/10 bg-[var(--surface)] p-7 shadow-2xl sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">{mode === "signup" ? "Start your journey" : "Welcome back"}</p>
        <h1 className="mt-3 font-[family-name:var(--font-space)] text-3xl">{mode === "signup" ? "Create your account" : "Sign in to SAMURA"}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Your conversations are private to your account.</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          {mode === "signup" && <label className="block text-sm text-slate-300">Name<input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} maxLength={100} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[var(--accent)]" /></label>}
          <label className="block text-sm text-slate-300">Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[var(--accent)]" /></label>
          <label className="block text-sm text-slate-300">Password<input required type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 12 : 1} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[var(--accent)]" />{mode === "signup" && <span className="mt-1 block text-xs text-slate-500">Use at least 12 characters.</span>}</label>
          {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3.5 font-semibold text-[#07120e] transition hover:bg-white disabled:opacity-60">{busy && <LoaderCircle className="animate-spin" size={17}/ >}{mode === "signup" ? "Create account" : "Sign in"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">{mode === "signup" ? "Already have an account?" : "New to SAMURA?"} <button onClick={()=>{setMode(mode === "signup" ? "login" : "signup");setError("");}} className="font-semibold text-[var(--accent)] hover:underline">{mode === "signup" ? "Sign in" : "Create account"}</button></p>
        <div className="mt-7 flex items-center justify-center gap-2 border-t border-white/10 pt-5 text-xs text-slate-500"><ShieldCheck size={15}/> Protected by server-side authentication</div>
      </section>
      <p className="mt-6 text-center text-xs text-slate-600">SAMURA AI · Built with purpose, measured by proof.</p>
    </div>
  </main>;
}
