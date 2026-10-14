"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type Repo = {
  id: number; name: string; fullName: string; url: string; description: string | null;
  defaultBranch: string; isPrivate: boolean; permissions: { read: boolean; write: boolean; admin: boolean };
};
type GitHubAccount = { login: string; name: string | null; avatarUrl: string; profileUrl: string };
type Change = { path: string; operation: "add" | "modify"; content: string; originalContent?: string | null };
type Patch = {
  title: string; body: string; plan: string[]; risks: string[]; tests: string[];
  changes: Change[]; repository: string; baseBranch: string; baseCommit: string; provider: string; model: string;
  validated: boolean; published: boolean; note: string;
};
type PublishResult = {
  verified: boolean; branch: string; baseBranch: string; commitSha: string; commitUrl: string;
  pullRequestUrl: string; pullRequestNumber: number; changedFiles: string[]; message: string;
};

export default function GitHubEngineeringPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [githubAccount, setGithubAccount] = useState<GitHubAccount | null>(null);
  const [repository, setRepository] = useState("");
  const [baseBranch, setBaseBranch] = useState("");
  const [task, setTask] = useState("");
  const [patch, setPatch] = useState<Patch | null>(null);
  const [approved, setApproved] = useState(false);
  const [publishKey, setPublishKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PublishResult | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) { router.replace("/login"); return; }
    let active = true;
    fetch("/api/connectors/github/repos", { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load GitHub repositories.");
        if (!active) return;
        const list: Repo[] = data.repositories ?? [];
        setGithubAccount(data.account ?? null);
        setRepos(list);
        const first = list.find(repo => repo.permissions?.write);
        if (first) { setRepository(first.fullName); setBaseBranch(first.defaultBranch); }
      })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load GitHub repositories."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isPending, session?.user, router]);

  const writableRepos = useMemo(() => repos.filter(repo => repo.permissions?.write), [repos]);
  const selectedRepo = repos.find(repo => repo.fullName === repository);

  async function generate() {
    setGenerating(true); setError(""); setPatch(null); setResult(null); setApproved(false); setPublishKey("");
    try {
      const response = await fetch("/api/connectors/github/engine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repository, baseBranch, task }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not generate a patch.");
      setPatch(data as Patch);
      setPublishKey(crypto.randomUUID());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate a patch.");
    } finally { setGenerating(false); }
  }

  function editChange(index: number, content: string) {
    setPatch(current => current ? {
      ...current,
      changes: current.changes.map((change, i) => i === index ? { ...change, content } : change),
    } : current);
    setApproved(false);
    setPublishKey(crypto.randomUUID());
    setResult(null);
  }

  async function publish() {
    if (!patch || !approved) return;
    setPublishing(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/connectors/github/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository: patch.repository, baseBranch: patch.baseBranch, expectedBaseCommit: patch.baseCommit, title: patch.title, body: patch.body,
          approved: true, idempotencyKey: publishKey,
          changes: patch.changes.map(({ path, operation, content }) => ({ path, operation, content })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "GitHub publishing failed.");
      setResult(data as PublishResult);
      setApproved(false);
    } catch (e) { setError(e instanceof Error ? e.message : "GitHub publishing failed."); }
    finally { setPublishing(false); }
  }

  if (isPending || loading) return <main className="grid min-h-screen place-items-center bg-[#080b12] text-slate-400">Loading engineering workspace…</main>;
  if (!session?.user) return null;

  return <main className="min-h-screen bg-[#080b12] px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-6xl">
      <Link href="/studio" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16}/> Back to Studio</Link>
      <header className="mb-8 mt-7">
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200"><Sparkles size={21}/></div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-200">SAMURA · Engineering</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">From repository context to a reviewed pull request.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">SAMURA reads bounded files from the selected GitHub branch, asks the configured AI provider for a structured patch, validates paths, and lets you edit and approve the exact content before publishing. Generated code is not executed; suggested tests are not claimed as run.</p>
      </header>

      {error && <p role="alert" className="mb-4 rounded-xl border border-amber-200/20 bg-amber-200/5 p-4 text-sm text-amber-100">{error}</p>}

      {githubAccount && <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><img src={githubAccount.avatarUrl} alt="" className="h-10 w-10 rounded-full" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">Connected as @{githubAccount.login}</p><p className="text-xs text-slate-400">{githubAccount.name ?? "GitHub account"} · repository permissions checked per request</p></div><a href={githubAccount.profileUrl} target="_blank" rel="noreferrer" className="text-xs text-teal-200 underline">View profile ↗</a></div>}
      <section className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-300">Authorized GitHub repository
            <select value={repository} onChange={e => {
              const repo = repos.find(item => item.fullName === e.target.value);
              setRepository(e.target.value); setBaseBranch(repo?.defaultBranch ?? "");
              setPatch(null); setApproved(false); setResult(null);
            }} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111722] px-3 py-3 text-white">
              <option value="">Select repository</option>
              {writableRepos.map(repo => <option key={repo.id} value={repo.fullName}>{repo.fullName}{repo.isPrivate ? " · private" : ""}</option>)}
            </select>
          </label>
          <label className="block text-sm text-slate-300">Base branch
            <input value={baseBranch} onChange={e => { setBaseBranch(e.target.value); setPatch(null); setApproved(false); setResult(null); }} maxLength={250} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 font-mono text-sm text-white"/>
          </label>
        </div>
        {selectedRepo && <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
          <p className="font-medium">{selectedRepo.fullName}</p>
          <p className="mt-1 text-xs text-slate-400">Default branch: {selectedRepo.defaultBranch} · {selectedRepo.isPrivate ? "Private" : "Public"} repository</p>
          <p className="mt-1 text-xs text-teal-200">GitHub reports effective write access</p>
          <a href={selectedRepo.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-slate-300 underline">Open repository ↗</a>
        </div>}
        {writableRepos.length === 0 && <p className="text-sm text-slate-400">No repository with effective write access is available. Reconnect GitHub and grant repository access, or select a repository where your account can write.</p>}
        <label className="block text-sm text-slate-300">Engineering task
          <textarea value={task} onChange={e => { setTask(e.target.value); setPatch(null); setApproved(false); setResult(null); }} maxLength={6000} rows={5} placeholder="Example: Add a small /api/version endpoint that returns the app version, follow the existing route conventions, and add focused tests." className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white"/>
        </label>
        <button onClick={() => void generate()} disabled={generating || !repository || !baseBranch.trim() || task.trim().length < 8} className="inline-flex items-center gap-2 rounded-xl bg-teal-200 px-5 py-3 text-sm font-bold text-[#07120e] disabled:cursor-not-allowed disabled:opacity-40">
          {generating ? <LoaderCircle size={16} className="animate-spin"/> : <Sparkles size={16}/>}
          {generating ? "Inspecting repository and generating…" : "Inspect repository & generate patch"}
        </button>
        <p className="text-xs leading-5 text-slate-500">The request uses the configured server-side provider and real GitHub repository content. Repository files are treated as untrusted input. No repository code is executed.</p>
      </section>

      {patch && <section className="mt-5 space-y-5 rounded-3xl border border-teal-200/20 bg-teal-200/[0.035] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">Review required · not published</p><h2 className="mt-2 text-xl font-semibold">Proposed engineering change</h2></div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">{patch.provider} · {patch.model}</span>
        </div>
        <label className="block text-sm text-slate-300">Pull request title
          <input value={patch.title} onChange={e => { setPatch({ ...patch, title: e.target.value }); setApproved(false); setPublishKey(crypto.randomUUID()); setResult(null); }} maxLength={120} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white"/>
        </label>
        <label className="block text-sm text-slate-300">Pull request description
          <textarea value={patch.body} onChange={e => { setPatch({ ...patch, body: e.target.value }); setApproved(false); setPublishKey(crypto.randomUUID()); setResult(null); }} maxLength={8000} rows={3} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-white"/>
        </label>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4"><h3 className="text-sm font-semibold">Plan</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-300">{patch.plan.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4"><h3 className="text-sm font-semibold">Risks</h3>{patch.risks.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-amber-100">{patch.risks.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p className="mt-2 text-xs text-slate-500">No risks listed by the model; review the patch yourself.</p>}</div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4"><h3 className="text-sm font-semibold">Suggested checks</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-300">{patch.tests.map((item, i) => <li key={i}>{item}</li>)}</ul><p className="mt-2 text-[11px] text-slate-500">Not executed by this workflow.</p></div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">File changes ({patch.changes.length})</h3>
          {patch.changes.map((change, index) => <article key={change.path} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
              <span className="break-all font-mono text-sm">{change.path}</span>
              <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-slate-400">{change.operation}</span>
            </header>
            {change.operation === "modify" && <details className="border-b border-white/10 p-4"><summary className="cursor-pointer text-xs text-slate-400">View original file content</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-500">{change.originalContent ?? "Original content was not included in the inspection context."}</pre></details>}
            <label className="block p-4 text-xs text-slate-300">Proposed full file content — edit before approval
              <textarea value={change.content} onChange={e => editChange(index, e.target.value)} maxLength={150000} rows={Math.min(24, Math.max(8, change.content.split("\n").length))} spellCheck={false} className="mt-2 w-full rounded-xl border border-white/10 bg-[#070a10] p-3 font-mono text-xs leading-5 text-slate-100"/>
            </label>
          </article>)}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-slate-400">
          <p><strong className="text-slate-200">Inspected repository:</strong> {patch.repository} · base branch <code>{patch.baseBranch}</code></p>
          <p className="mt-1">{patch.note}</p>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-teal-200/20 bg-teal-200/[0.04] p-4 text-sm leading-6 text-slate-200">
          <input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} className="mt-1 accent-teal-200"/>
          <span>I reviewed the pull request title, description, plan, risks, and exact content of every file. I authorize SAMURA to create a new branch and a draft pull request. I understand tests have not been run.</span>
        </label>
        <button onClick={() => void publish()} disabled={!approved || publishing || !publishKey || !patch.changes.length || patch.title.trim().length < 5} className="inline-flex items-center gap-2 rounded-xl bg-teal-200 px-5 py-3 text-sm font-bold text-[#07120e] disabled:cursor-not-allowed disabled:opacity-40">
          {publishing ? <LoaderCircle size={16} className="animate-spin"/> : <ShieldCheck size={16}/>}
          {publishing ? "Publishing and verifying…" : "Approve & publish branch"}
        </button>
      </section>}

      {result && <section className="mt-5 rounded-3xl border border-teal-200/20 bg-teal-200/[0.04] p-5 sm:p-7">
        <p className="flex items-center gap-2 font-semibold text-teal-100"><CheckCircle2 size={18}/>{result.verified ? "GitHub commit verified" : "Publishing needs review"}</p>
        <p className="mt-2 text-sm text-slate-300">{result.message}</p>
        <dl className="mt-4 space-y-3 text-sm">
          <div><dt className="text-xs text-slate-500">Branch</dt><dd className="mt-1 break-all font-mono">{result.branch}</dd></div>
          <div><dt className="text-xs text-slate-500">Commit SHA</dt><dd className="mt-1 break-all font-mono">{result.commitSha}</dd></div>
          <div><dt className="text-xs text-slate-500">Verified changed files</dt><dd className="mt-1 break-all font-mono">{result.changedFiles.join(", ")}</dd></div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-3"><a href={result.commitUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm hover:bg-white/5">Inspect commit ↗</a><a href={result.pullRequestUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-teal-200 px-4 py-2.5 text-sm font-bold text-[#07120e]">Open draft pull request ↗</a></div>
      </section>}
    </div>
  </main>;
}
