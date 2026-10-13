"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AudioWaveform, LoaderCircle, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [resetState, setResetState] = useState({ token: "", invalidToken: true });
  const { token, invalidToken } = resetState;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const resetToken = url.searchParams.get("token") ?? "";
    const tokenError = url.searchParams.get("error");
    // Read the one-time token after hydration, then remove it from browser history.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResetState({ token: resetToken, invalidToken: Boolean(tokenError) || !resetToken });
    // Remove the bearer-like reset token from the visible URL/history as soon
    // as it has been captured in memory.
    if (resetToken) {
      url.searchParams.delete("token");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!token || invalidToken) {
      setError("This reset link is missing, invalid, or expired. Request a new one.");
      return;
    }
    if (password.length < 12 || password.length > 128) {
      setError("Your new password must be between 12 and 128 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setResetState(current => ({ ...current, invalidToken: true }));
        setError("This reset link is invalid or expired. Request a new link and try again.");
        return;
      }
      setResetState({ token: "", invalidToken: true });
      setPassword("");
      setConfirmPassword("");
      setDone(true);
    } catch {
      setError("Password reset could not be completed. Request a new link and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center px-5 py-12">
    <div className="w-full max-w-md">
      <Link href="/" className="mb-10 flex items-center justify-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-[var(--accent)]"><AudioWaveform size={22}/></span><span className="font-[family-name:var(--font-space)] text-xl tracking-[0.2em]">SAMURA</span></Link>
      <section className="rounded-3xl border border-white/10 bg-[var(--surface)] p-7 shadow-2xl sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">Account recovery</p>
        <h1 className="mt-3 font-[family-name:var(--font-space)] text-3xl">{done ? "Password updated" : "Choose a new password"}</h1>
        {done ? <div role="status" className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="font-semibold">You can sign in again</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Your password has been changed and existing sessions have been revoked. Sign in using your new password.</p>
          <button onClick={() => router.replace("/login?password-reset=success")} className="mt-5 w-full rounded-xl bg-[var(--accent)] px-4 py-3.5 font-semibold text-[#07120e] hover:bg-white">Continue to sign in</button>
        </div> : <>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Use a unique password with at least 12 characters.</p>
          {invalidToken && <p role="alert" className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">This link is missing, invalid, or expired. You can request another reset link.</p>}
          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block text-sm text-slate-300">New password<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={event=>setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[var(--accent)]" /></label>
            <label className="block text-sm text-slate-300">Confirm new password<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[var(--accent)]" /></label>
            {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
            <button disabled={busy || invalidToken} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3.5 font-semibold text-[#07120e] transition hover:bg-white disabled:opacity-60">{busy && <LoaderCircle className="animate-spin" size={17}/>}Set new password</button>
          </form>
        </>}
        <p className="mt-7 text-center text-sm text-slate-400"><Link href="/forgot-password" className="font-semibold text-[var(--accent)] hover:underline">Request another reset link</Link></p>
        <div className="mt-7 flex items-center justify-center gap-2 border-t border-white/10 pt-5 text-xs text-slate-500"><ShieldCheck size={15}/> Your password is never emailed to you</div>
      </section>
    </div>
  </main>;
}
