"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";

type Capability = {
  id: string;
  name: string;
  status: "available" | "needs_configuration" | "planned";
  description: string;
  requirement?: string;
};

const statusCopy = {
  available: { label: "Available", icon: CheckCircle2, style: "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200" },
  needs_configuration: { label: "Setup required", icon: AlertCircle, style: "border-amber-300/20 bg-amber-300/[0.06] text-amber-200" },
  planned: { label: "Not implemented yet", icon: Clock3, style: "border-white/10 bg-white/[0.03] text-slate-400" },
} as const;

export default function CapabilitiesPage() {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/capabilities", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not load capability status.");
      setCapabilities(data.capabilities ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load capability status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="min-h-screen bg-[#080b12] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/studio" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft size={16}/> Back to Studio</Link>
        <header className="mb-8 mt-8 max-w-3xl">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200"><Sparkles size={21}/></div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-200">SAMURA capability status</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">What works today, and what comes next.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-400">This status comes from the server configuration and SAMURA's implementation registry. “Available” means configured in this environment, not a guarantee that every provider request will succeed. Planned features are not presented as working features.</p>
        </header>

        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">{capabilities.length ? capabilities.filter(item => item.status === "available").length + " of " + capabilities.length + " capabilities currently available" : "Live configuration status"}</p>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.05] disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button>
        </div>

        {error && <div role="alert" className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100">{error}</div>}
        {loading && !capabilities.length ? <div className="flex items-center gap-3 py-10 text-sm text-slate-400"><LoaderCircle size={18} className="animate-spin"/> Checking SAMURA configuration…</div> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {capabilities.map((capability) => {
              const status = statusCopy[capability.status];
              const Icon = status.icon;
              return <article key={capability.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold">{capability.name}</h2>
                  <span className={"inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold " + status.style}><Icon size={12}/>{status.label}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{capability.description}</p>
                {capability.requirement && <p className="mt-3 border-t border-white/[0.07] pt-3 text-xs leading-5 text-slate-500">Next step: {capability.requirement}</p>}
              </article>;
            })}
          </div>
        )}
        <p className="mt-8 text-xs leading-5 text-slate-600">This page does not grant access or enable services. External providers may require administrator setup, credentials, usage limits, and separate costs.</p>
      </div>
    </main>
  );
}
