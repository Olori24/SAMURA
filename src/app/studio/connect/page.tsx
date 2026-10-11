"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Code2, FileJson, FileText, Github, LockKeyhole, Plug, Search, ShieldCheck, Slack, Sparkles, type LucideIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type Connector = {
  id: string;
  name: string;
  category: "productivity" | "developer" | "utility";
  description: string;
  status: "available" | "setup_required";
  auth: "none" | "oauth";
  scopes: string[];
  actions: string[];
};

const iconFor: Record<string, LucideIcon> = {
  "text-tools": FileText,
  github: Github,
  "google-drive": FileJson,
  slack: Slack,
};

export default function ConnectPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Connector | null>(null);
  const [input, setInput] = useState("");
  const [action, setAction] = useState("word_count");
  const [result, setResult] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) { router.replace("/login"); return; }
    let active = true;
    fetch("/api/connectors", { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load connectors.");
        if (active) setConnectors(data.connectors);
      })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load connectors."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isPending, session?.user, router]);

  async function runPlugin(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setRunning(true); setError(""); setResult("");
    try {
      const response = await fetch("/api/connectors/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorId: selected.id, action, text: input }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Plugin action failed.");
      setResult(JSON.stringify(data.result, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plugin action failed.");
    } finally {
      setRunning(false);
    }
  }

  const visible = connectors.filter(c => (c.name + " " + c.description + " " + c.category).toLowerCase().includes(query.toLowerCase()));

  if (isPending || loading) return <main className="grid min-h-screen place-items-center bg-[#080b12] text-slate-400">Loading Connect…</main>;
  if (!session?.user) return null;

  return <main className="min-h-screen bg-[#080b12] px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-6xl">
      <Link href="/studio" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16}/> Back to Studio</Link>
      <header className="mb-8 mt-8 max-w-3xl">
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200"><Plug size={21}/></div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-200">SAMURA Connect</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Your tools, under your control.</h1>
        <p className="mt-4 text-sm leading-7 text-slate-400">Explore plugins, inspect permissions, and run available actions. External account connections stay disabled until their OAuth credentials and consent flows are configured.</p>
      </header>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search connectors and plugins" className="w-full rounded-xl border border-white/10 bg-white/[0.035] py-3 pl-9 pr-3 text-sm outline-none focus:border-teal-200/40"/></div>
        <p className="text-xs text-slate-500">{connectors.filter(c=>c.status==="available").length} available · {connectors.filter(c=>c.status==="setup_required").length} require setup</p>
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl border border-amber-200/20 bg-amber-200/5 p-3 text-sm text-amber-100">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {visible.map(connector => {
          const Icon = iconFor[connector.id] ?? Plug;
          const available = connector.status === "available";
          return <article key={connector.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-teal-200"><Icon size={22}/></div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{connector.name}</h2><span className={"rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider " + (available ? "bg-teal-200/10 text-teal-200" : "bg-white/5 text-slate-400")}>{available ? "Available" : "Setup required"}</span></div><p className="mt-2 text-sm leading-6 text-slate-400">{connector.description}</p></div>
            </div>
            <div className="mt-5 border-t border-white/10 pt-4"><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300"><ShieldCheck size={14}/> Permissions / data access</p><ul className="space-y-1">{connector.scopes.map(scope=><li key={scope} className="text-xs leading-5 text-slate-500">• {scope}</li>)}</ul></div>
            <div className="mt-4 flex flex-wrap gap-2">{connector.actions.map(a=><span key={a} className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-slate-400">{a.replaceAll("_"," ")}</span>)}</div>
            <button onClick={()=>{setSelected(connector);setResult("");setError("");setAction(connector.actions[0] ?? "");setInput("");}} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium transition hover:border-teal-200/30 hover:bg-white/[0.035]">{available ? <><Sparkles size={15}/> Open plugin</> : <><LockKeyhole size={15}/> View setup requirements</>}</button>
          </article>;
        })}
      </div>

      {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="plugin-title">
        <section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0c111b] p-5 shadow-2xl sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200">SAMURA Connect</p><h2 id="plugin-title" className="mt-2 text-xl font-semibold">{selected.name}</h2></div><button onClick={()=>setSelected(null)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300">Close</button></div>
          {selected.status === "available" && selected.id === "text-tools" ? <form onSubmit={runPlugin} className="mt-5 space-y-4">
            <label className="block text-sm text-slate-300">Action<select value={action} onChange={e=>setAction(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111722] px-3 py-3 text-sm text-white">{selected.actions.map(a=><option key={a} value={a}>{a.replaceAll("_"," ")}</option>)}</select></label>
            <label className="block text-sm text-slate-300">Input<textarea value={input} onChange={e=>setInput(e.target.value)} required maxLength={20000} rows={6} placeholder={action==="format_json" ? '{"name":"SAMURA","plugins":["text tools"]}' : "Paste text to analyze…"} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-white outline-none focus:border-teal-200/40"/></label>
            <button disabled={running || !input.trim()} className="inline-flex items-center gap-2 rounded-xl bg-teal-200 px-4 py-3 text-sm font-bold text-[#07120e] disabled:opacity-40">{running ? "Running…" : <><Code2 size={15}/> Run plugin action</>}</button>
          </form> : <div className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-200/[0.04] p-4"><p className="flex items-center gap-2 text-sm font-semibold text-amber-100"><LockKeyhole size={16}/> External OAuth setup required</p><p className="mt-2 text-sm leading-6 text-slate-400">This integration is listed for planning only. It is not connected, and no external action can run yet. Before enabling it, SAMURA needs registered OAuth credentials, redirect URI configuration, encrypted token storage, scope consent, and revocation handling.</p><p className="mt-3 text-xs text-slate-500">Requested access: {selected.scopes.join(", ")}</p></div>}
          {error && <p role="alert" className="mt-4 rounded-xl border border-amber-200/20 bg-amber-200/5 p-3 text-sm text-amber-100">{error}</p>}
          {result && <div className="mt-4 rounded-2xl border border-teal-200/15 bg-teal-200/[0.04] p-4"><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-100"><CheckCircle2 size={16}/> Action completed</p><pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">{result}</pre></div>}
        </section>
      </div>}

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-200/10 text-teal-200"><ShieldCheck size={19}/></div><div><h2 className="font-semibold">Permission-first by design</h2><p className="mt-2 text-sm leading-6 text-slate-400">Plugin actions are allowlisted on the server, input is schema-validated, and requests require an authenticated SAMURA session. External connectors remain unavailable until their OAuth and token lifecycle are implemented.</p></div></div></section>
    </div>
  </main>;
}
