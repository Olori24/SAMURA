"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Code2, FileJson, FileText, Github, LockKeyhole, Plug, Search, ShieldCheck, Slack, Sparkles, type LucideIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type GitHubProfile = { login: string; name: string | null; avatarUrl: string; profileUrl: string };
type GitHubRepo = { id: number; fullName: string; url: string; description: string | null; language: string | null; stars: number; updatedAt: string };

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
  const [githubProfile, setGithubProfile] = useState<GitHubProfile | null>(null);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [githubBusy, setGithubBusy] = useState(false);
  const [githubNotice, setGithubNotice] = useState("");
  const [inspectingRepo, setInspectingRepo] = useState("");
  const [inspection, setInspection] = useState<{ repository: { fullName: string; url: string; description: string | null; defaultBranch: string; language: string | null; stars: number; updatedAt: string }; files: Array<{ path: string; size: number | null; sha: string }>; readme: { path: string; content: string } | null; truncated: boolean } | null>(null);
  const [inspectionError, setInspectionError] = useState("");

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

  useEffect(() => {
    if (isPending || !session?.user) return;
    let active = true;
    const result = new URLSearchParams(window.location.search).get("github");
    fetch("/api/connectors/github", { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not check GitHub connection.");
        if (!active) return;
        if (result === "connected") setGithubNotice("GitHub connected successfully.");
        else if (result === "setup_required") setGithubNotice("GitHub OAuth is not configured in the production environment yet.");
        else if (result && result !== "connected") setGithubNotice("GitHub connection: " + result.replaceAll("_", " ") + ".");
        setGithubConnected(Boolean(data.connected));
        setGithubProfile(data.account ?? null);
        if (data.needsReauthorization) setGithubNotice("GitHub authorization expired. Reconnect to continue.");
      })
      .catch(e => { if (active) setGithubNotice(e instanceof Error ? e.message : "Could not check GitHub connection."); });
    return () => { active = false; };
  }, [isPending, session?.user]);

  async function loadGithubRepos() {
    setGithubBusy(true); setGithubNotice("");
    try {
      const response = await fetch("/api/connectors/github/repos", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load GitHub repositories.");
      setGithubRepos(data.repositories ?? []);
    } catch (e) {
      setGithubNotice(e instanceof Error ? e.message : "Could not load GitHub repositories.");
    } finally {
      setGithubBusy(false);
    }
  }

  async function inspectGithubRepo(fullName: string) {
    setInspectingRepo(fullName); setInspectionError(""); setInspection(null);
    try {
      const response = await fetch("/api/connectors/github/inspect?repository=" + encodeURIComponent(fullName), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Repository inspection failed.");
      setInspection(data);
    } catch (e) {
      setInspectionError(e instanceof Error ? e.message : "Repository inspection failed.");
    } finally {
      setInspectingRepo("");
    }
  }

  async function disconnectGithub() {
    setGithubBusy(true); setGithubNotice("");
    try {
      const response = await fetch("/api/connectors/github", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not disconnect GitHub.");
      setGithubConnected(false); setGithubProfile(null); setGithubRepos([]);
      setGithubNotice("GitHub disconnected. The stored SAMURA credential was removed.");
    } catch (e) {
      setGithubNotice(e instanceof Error ? e.message : "Could not disconnect GitHub.");
    } finally {
      setGithubBusy(false);
    }
  }

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
        <p className="mt-4 text-sm leading-7 text-slate-400">Explore plugins, inspect permissions, and run available actions. GitHub can be connected with read-only identity access once its production OAuth settings are configured.</p>
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
            <button onClick={()=>{if(connector.id==="github"&&available){window.location.assign("/api/connectors/github/authorize");return;}setSelected(connector);setResult("");setError("");setAction(connector.actions[0] ?? "");setInput("");}} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium transition hover:border-teal-200/30 hover:bg-white/[0.035]">{connector.id==="github"&&available ? <><Github size={15}/> Connect GitHub</> : available ? <><Sparkles size={15}/> Open plugin</> : <><LockKeyhole size={15}/> View setup requirements</>}</button>
          </article>;
        })}
      </div>

      <section className="mt-6 rounded-3xl border border-teal-200/15 bg-teal-200/[0.035] p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-teal-200"><Github size={21}/></div>
            <div>
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">GitHub account</h2><span className={"rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider " + (githubConnected ? "bg-teal-200/10 text-teal-200" : "bg-white/5 text-slate-400")}>{githubConnected ? "Connected" : "Not connected"}</span></div>
              <p className="mt-1 text-sm leading-6 text-slate-400">Connect using GitHub OAuth with read-only identity scopes. SAMURA encrypts the token at rest and currently displays public repositories only.</p>
              {githubProfile && <a href={githubProfile.profileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm text-teal-200 hover:text-white">{githubProfile.name || githubProfile.login} · @{githubProfile.login}</a>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!githubConnected ? <a href="/api/connectors/github/authorize" className="inline-flex items-center gap-2 rounded-xl bg-teal-200 px-4 py-2.5 text-sm font-bold text-[#07120e]"><Github size={15}/> Connect GitHub</a> : <>
              <button disabled={githubBusy} onClick={()=>void loadGithubRepos()} className="rounded-xl bg-teal-200 px-4 py-2.5 text-sm font-bold text-[#07120e] disabled:opacity-50">{githubBusy ? "Loading…" : "Load public repositories"}</button>
              <button disabled={githubBusy} onClick={()=>void disconnectGithub()} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-300 disabled:opacity-50">Disconnect</button>
            </>}
          </div>
        </div>
        {githubNotice && <p role="status" className="mt-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-300">{githubNotice}</p>}
        {githubRepos.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {githubRepos.map(repo => <article key={repo.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <a href={repo.url} target="_blank" rel="noreferrer" className="font-medium text-teal-200 hover:text-white">{repo.fullName}</a>
            <p className="mt-2 text-sm leading-5 text-slate-400">{repo.description || "No description provided."}</p>
            <p className="mt-3 text-xs text-slate-500">{repo.language || "Language not specified"} · {repo.stars} stars</p>
            <button disabled={Boolean(inspectingRepo)} onClick={() => void inspectGithubRepo(repo.fullName)} className="mt-4 rounded-xl border border-teal-200/20 px-3 py-2 text-sm font-medium text-teal-100 disabled:opacity-50">{inspectingRepo === repo.fullName ? "Inspecting…" : "Inspect repository"}</button>
          </article>)}
        </div>}
        {inspectionError && <p role="alert" className="mt-4 rounded-xl border border-amber-200/20 bg-amber-200/5 p-3 text-sm text-amber-100">{inspectionError}</p>}
        {inspection && <section className="mt-5 rounded-2xl border border-teal-200/20 bg-black/20 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wider text-teal-200">Read-only repository inspection</p><h3 className="mt-1 font-semibold">{inspection.repository.fullName}</h3><p className="mt-1 text-xs text-slate-400">Default branch: {inspection.repository.defaultBranch} · {inspection.files.length} files indexed{inspection.truncated ? " (limited listing)" : ""}</p></div>
            <a href={inspection.repository.url} target="_blank" rel="noreferrer" className="text-sm text-teal-200 hover:text-white">Open on GitHub ↗</a>
          </div>
          {inspection.readme && <div className="mt-4"><h4 className="text-sm font-semibold">README · {inspection.readme.path}</h4><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300">{inspection.readme.content}</pre></div>}
          <h4 className="mt-4 text-sm font-semibold">Repository files</h4>
          <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-white/10">{inspection.files.map(file => <div key={file.path} className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2 last:border-b-0"><span className="min-w-0 break-all font-mono text-xs text-slate-300">{file.path}</span><span className="shrink-0 text-[10px] text-slate-500">{file.size === null ? "size n/a" : file.size + " B"}</span></div>)}</div>
          <p className="mt-3 text-xs leading-5 text-slate-500">This first inspection stage is read-only. It does not write files, create branches, or open pull requests.</p>
        </section>}
      </section>

      {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="plugin-title">
        <section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0c111b] p-5 shadow-2xl sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200">SAMURA Connect</p><h2 id="plugin-title" className="mt-2 text-xl font-semibold">{selected.name}</h2></div><button onClick={()=>setSelected(null)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300">Close</button></div>
          {selected.status === "available" && selected.id === "text-tools" ? <form onSubmit={runPlugin} className="mt-5 space-y-4">
            <label className="block text-sm text-slate-300">Action<select value={action} onChange={e=>setAction(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111722] px-3 py-3 text-sm text-white">{selected.actions.map(a=><option key={a} value={a}>{a.replaceAll("_"," ")}</option>)}</select></label>
            <label className="block text-sm text-slate-300">Input<textarea value={input} onChange={e=>setInput(e.target.value)} required maxLength={20000} rows={6} placeholder={action==="format_json" ? '{"name":"SAMURA","plugins":["text tools"]}' : "Paste text to analyze…"} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-white outline-none focus:border-teal-200/40"/></label>
            <button disabled={running || !input.trim()} className="inline-flex items-center gap-2 rounded-xl bg-teal-200 px-4 py-3 text-sm font-bold text-[#07120e] disabled:opacity-40">{running ? "Running…" : <><Code2 size={15}/> Run plugin action</>}</button>
          </form> : selected.id === "github" ? <div className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-200/[0.04] p-4"><p className="flex items-center gap-2 text-sm font-semibold text-amber-100"><LockKeyhole size={16}/> GitHub OAuth configuration not detected</p><p className="mt-2 text-sm leading-6 text-slate-400">The GitHub connection flow is implemented, including OAuth authorization, state validation, encrypted token storage, public repository listing, and disconnect handling. This environment is not reporting all required OAuth settings as configured. Verify GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and SAMURA_CONNECTOR_ENCRYPTION_KEY in Vercel Production, then redeploy. Do not paste secrets into this page.</p><p className="mt-3 text-xs text-slate-500">Requested access: {selected.scopes.join(", ")}</p></div> : <div className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-200/[0.04] p-4"><p className="flex items-center gap-2 text-sm font-semibold text-amber-100"><LockKeyhole size={16}/> External OAuth setup required</p><p className="mt-2 text-sm leading-6 text-slate-400">This integration is listed for planning only. It is not connected, and no external action can run yet. Before enabling it, SAMURA needs registered OAuth credentials, redirect URI configuration, encrypted token storage, scope consent, and revocation handling.</p><p className="mt-3 text-xs text-slate-500">Requested access: {selected.scopes.join(", ")}</p></div>}
          {error && <p role="alert" className="mt-4 rounded-xl border border-amber-200/20 bg-amber-200/5 p-3 text-sm text-amber-100">{error}</p>}
          {result && <div className="mt-4 rounded-2xl border border-teal-200/15 bg-teal-200/[0.04] p-4"><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-100"><CheckCircle2 size={16}/> Action completed</p><pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">{result}</pre></div>}
        </section>
      </div>}

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-200/10 text-teal-200"><ShieldCheck size={19}/></div><div><h2 className="font-semibold">Permission-first by design</h2><p className="mt-2 text-sm leading-6 text-slate-400">Plugin actions are allowlisted on the server, input is schema-validated, and requests require an authenticated SAMURA session. External connectors remain unavailable until their OAuth and token lifecycle are implemented.</p></div></div></section>
    </div>
  </main>;
}
