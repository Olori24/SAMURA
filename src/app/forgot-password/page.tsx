"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AudioWaveform, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error) {
        setError("Password recovery is temporarily unavailable. Please try again later.");
        return;
      }
      // The message is identical regardless of whether this email belongs to an account.
      setSubmitted(true);
    } catch {
      setError("Password recovery is temporarily unavailable. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center px-5 py-12">
    <div className="w-full max-w-md">
      <Link href="/" className="mb-10 flex items-center justify-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-[var(--accent)]"><AudioWaveform size={22}/></span><span className="font-[family-name:var(--font-space)] text-xl tracking-[0.2em]">SAMURA</span></Link>
      <section className="rounded-3xl border border-white/10 bg-[var(--surface)] p-7 shadow-2xl sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">Account recovery</p>
        <h1 className="mt-3 font-[family-name:var(--font-space)] text-3xl">Forgot your password?</h1>
        {!submitted ? <>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Enter the email address associated with your account. If an account matches, we’ll send a secure reset link.</p>
          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block text-sm text-slate-300">Email address<input required type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} maxLength={254} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[var(--accent)]" /></label>
            {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3.5 font-semibold text-[#07120e] transition hover:bg-white disabled:opacity-60">{busy ? <LoaderCircle className="animate-spin" size={17}/> : <Mail size={17}/>}Send reset link</button>
          </form>
        </> : <div role="status" className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
          <Mail className="text-[var(--accent)]" size={24}/>
          <p className="mt-3 font-semibold">Check your inbox</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">If an account exists for that address, a password-reset link will arrive shortly. Check your spam folder too. The link expires after 60 minutes.</p>
        </div>}
        <p className="mt-7 text-center text-sm text-slate-400"><Link href="/login" className="font-semibold text-[var(--accent)] hover:underline">Back to sign in</Link></p>
        <div className="mt-7 flex items-center justify-center gap-2 border-t border-white/10 pt-5 text-xs text-slate-500"><ShieldCheck size={15}/> Reset links expire and can only be used once</div>
      </section>
    </div>
  </main>;
}
