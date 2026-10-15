"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, GitPullRequest, Github, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type Repo = {
  id: number; name: string; fullName: string; url: string; description: string | null;
  defaultBranch: string; isPrivate: boolean; permissions: { read: boolean; write: boolean; admin: boolean };
};
type PublishResult = {
  ok: boolean; verified: boolean; branch: string; baseBranch: string; commitSha: string;
  commitUrl: string; pullRequestUrl: string; pullRequestNumber: number; changedFiles: string[];
  message: string;
};

export default function GitHubPublishPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repoName, setRepoName] = useState("");
  const [baseBranch, setBaseBranch] = useState("");
  const [title, setTitle] = useState("chore: add reviewed SAMURA change");
  const [body, setBody] = useState("## Summary\n- Describe the reviewed change.\n\n## Validation\n- [ ] Tests run");
  const [path, setPath] = useState("docs/samura-change.md");
  const [operation, setOperation] = useState<"add" | "modify">("add");
  const [fileContent, setFileContent] = useState("# Reviewed SAMURA change\n\nDescribe the intended change here.\n");
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PublishResult | null>(null);
  const [scopeMessage, setScopeMessage] = useState("");
  const [inspectedBaseCommit, setInspectedBaseCommit] = useState("");
  const [inspectedBranchKey, setInspectedBranchKey] = useState("");
  const [inspectingBranch, setInspectingBranch] = useState(false);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) { router.replace("/login"); return; }
    let active = true;
    fetch("/api/connectors/github/repos", { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load GitHub repositories.");
      if (!active) return;
      setRepos(data.repositories ?? []);
      if (data.capabilities?.requiresReauthorizationForWrite) {
        setScopeMessage("Reconnect GitHub to approve repository write access before publishing.");
      }
      const first = (data.repositories ?? []).find((r: Repo) => r.permissions?.write);
      if (first) { setRepoName(first.fullName); setBaseBranch(first.defaultBranch); }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load GitHub repositories."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isPending, session?.user, router]);

  useEffect(() => {
    if (!session?.user || !repoName || !baseBranch.trim()) return;
    let active = true;
    const branchKey = `${repoName}:${baseBranch}`;
    Promise.resolve().then(() => {
      if (active) setInspectingBranch(true);
      return fetch("/api/connectors/github/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ repository: repoName }),
      });
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not inspect the selected branch.");
      if (!active) return;
      const branch = (data.branches ?? []).find((item: { name: string; sha: string }) => item.name === baseBranch);
      if (!branch?.sha || !/^[0-9a-f]{40}$/i.test(branch.sha)) {
        setInspectedBaseCommit("");
        setInspectedBranchKey("");
        setError("The selected branch could not be inspected. Choose an existing branch and retry.");
        return;
      }
      setInspectedBaseCommit(branch.sha);
      setInspectedBranchKey(branchKey);
      setError("");
    }).catch(e => {
      if (active) {
        setInspectedBaseCommit("");
        setInspectedBranchKey("");
        setError(e instanceof Error ? e.message : "Could not inspect the selected branch.");
      }
    }).finally(() => { if (active) setInspectingBranch(false); });
    return () => { active = false; };
  }, [session?.user, repoName, baseBranch]);

  const selectedRepo = repos.find(repo => repo.fullName === repoName);
  const currentBranchKey = `${repoName}:${baseBranch}`;
  const verifiedBaseCommit = inspectedBranchKey === currentBranchKey ? inspectedBaseCommit : "";
  const writableRepos = useMemo(() => repos.filter(repo => repo.permissions?.write), [repos]);

  async function publish() {
    setPublishing(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/connectors/github/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository: repoName, baseBranch, expectedBaseCommit: verifiedBaseCommit, title, body, approved: true,
          idempotencyKey: crypto.randomUUID(),
          changes: [{ path, content: fileContent, operation }],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "GitHub publishing failed.");
      setResult(data);
      setApproved(false);
    } catch (e) { setError(e instanceof Error ? e.message : "GitHub publishing failed."); }
    finally { setPublishing(false); }
  }

  if (isPending || loading) return <main className="grid min-h-screen place-items-center bg-[#080b12] text-slate-400">Loading GitHub workspace…</main>;
  if (!session?.user) return null;

  return <main className="min-h-screen bg-[#080b12] px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-4xl">
      <Link href="/studio/connect" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16}/> Back to Connect</Link>
      <header className="mb-8 mt-7">
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200"><GitPullRequest size={21}/></div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-200">GitHub engineering workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Review a patch. Publish a branch.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">This first publishing screen sends a manually prepared file change to a new branch and opens a draft pull request. AI-generated diffs, repository-aware patch generation, and automated test execution are not connected yet.</p>
      </header>

      {error && <p role="alert" className="mb-4 rounded-xl border border-amber-200/20 bg-amber-200/5 p-3 text-sm text-amber-100">{error}</p>}
      {scopeMessage && <div className="mb-4 rounded-xl border border-amber-200/20 bg-amber-200/5 p-4 text-sm text-amber-100">{scopeMessage} <a href="/api/connectors/github/authorize" className="ml-1 underline">Reconnect GitHub</a></div>}

      <section className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-7">
        <label className="block text-sm text-slate-300">Repository
          <select value={repoName} onChange={e => { const repo = repos.find(r => r.fullName === e.target.value); setRepoName(e.target.value); setBaseBranch(repo?.defaultBranch ?? ""); setApproved(false); setInspectingBranch(false); }} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111722] px-3 py-3 text-white">
            <option value="">Select an authorized repository</option>
            {writableRepos.map(repo => <option key={repo.id} value={repo.fullName}>{repo.fullName}{repo.isPrivate ? " · private" : ""}</option>)}
          </select>
        </label>
        {selectedRepo && <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
          <p className="font-medium">{selectedRepo.fullName}</p>
          <p className="mt-1 text-xs text-slate-400">Default branch: {selectedRepo.defaultBranch} · {selectedRepo.isPrivate ? "Private repository" : "Public repository"}</p>
          <p className="mt-1 text-xs text-teal-200">Effective write access reported by GitHub</p>
          <a href={selectedRepo.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-slate-300 underline">Open repository</a>
        </div>}
        {writableRepos.length === 0 && !scopeMessage && <p className="text-sm text-slate-400">No repositories with effective write access were returned. Check the connected account and repository permissions.</p>}
        <label className="block text-sm text-slate-300">Base branch
          <input value={baseBranch} onChange={e => { setBaseBranch(e.target.value); setApproved(false); setInspectingBranch(false); }} maxLength={250} required className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 font-mono text-sm text-white"/>
        </label>
        <label className="block text-sm text-slate-300">Pull request title
          <input value={title} onChange={e => { setTitle(e.target.value); setApproved(false); }} maxLength={120} required className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white"/>
        </label>
        <label className="block text-sm text-slate-300">Pull request description
          <textarea value={body} onChange={e => { setBody(e.target.value); setApproved(false); }} maxLength={10000} rows={4} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-white"/>
        </label>
        <div className="border-t border-white/10 pt-5">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Proposed file operation</h2><span className="text-xs text-slate-500">Single text file · max 200 KB</span></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_2fr]">
            <label className="block text-sm text-slate-300">Operation
              <select value={operation} onChange={e => { setOperation(e.target.value as "add" | "modify"); setApproved(false); }} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111722] px-3 py-3 text-white"><option value="add">Add new file</option><option value="modify">Modify existing file</option></select>
            </label>
            <label className="block text-sm text-slate-300">Repository path
              <input value={path} onChange={e => { setPath(e.target.value); setApproved(false); }} maxLength={500} required placeholder="docs/feature.md" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 font-mono text-sm text-white"/>
            </label>
          </div>
          <label className="mt-4 block text-sm text-slate-300">File content — review the exact content below
            <textarea value={fileContent} onChange={e => { setFileContent(e.target.value); setApproved(false); }} maxLength={200000} rows={14} spellCheck={false} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs leading-5 text-slate-200"/>
          </label>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-teal-200"/> Review summary</p>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-400">
              <li>• Repository: {repoName || "not selected"}</li>
              <li>• Base branch: {baseBranch || "not selected"}</li>
              <li>• Inspected commit: {inspectingBranch ? "refreshing branch state…" : verifiedBaseCommit || "branch not verified — publishing disabled"}</li>
              <li>• Operation: {operation} {path || "(no path)"}</li>
              <li>• Payload size: {new TextEncoder().encode(fileContent).length.toLocaleString()} bytes</li>
              <li>• Publishing creates a new branch and a draft pull request; it does not merge.</li>
              <li>• No repository code is executed by this endpoint.</li>
            </ul>
          </div>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-teal-200/20 bg-teal-200/[0.04] p-4 text-sm leading-6 text-slate-200">
          <input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} className="mt-1 accent-teal-200"/>
          <span>I reviewed the exact file content, repository, target branch, and pull request description. I explicitly authorize SAMURA to publish this change to a new branch and create a draft pull request.</span>
        </label>
        <button onClick={() => void publish()} disabled={publishing || inspectingBranch || !verifiedBaseCommit || !approved || !selectedRepo?.permissions?.write || !repoName || !baseBranch.trim() || title.trim().length < 5 || !path.trim() || !fileContent} className="inline-flex items-center gap-2 rounded-xl bg-teal-200 px-5 py-3 text-sm font-bold text-[#07120e] disabled:cursor-not-allowed disabled:opacity-40">
          <Github size={16}/>{publishing ? "Publishing and verifying…" : "Approve and publish branch"}
        </button>
      </section>

      {result && <section className="mt-5 rounded-3xl border border-teal-200/20 bg-teal-200/[0.04] p-5 sm:p-7">
        <p className="flex items-center gap-2 font-semibold text-teal-100"><CheckCircle2 size={18}/>{result.verified ? "GitHub commit verified" : "Publishing needs review"}</p>
        <p className="mt-2 text-sm text-slate-300">{result.message}</p>
        <dl className="mt-4 space-y-3 text-sm">
          <div><dt className="text-xs text-slate-500">Branch</dt><dd className="mt-1 break-all font-mono">{result.branch}</dd></div>
          <div><dt className="text-xs text-slate-500">Commit SHA</dt><dd className="mt-1 break-all font-mono">{result.commitSha}</dd></div>
          <div><dt className="text-xs text-slate-500">Verified changed files</dt><dd className="mt-1 font-mono">{result.changedFiles.join(", ")}</dd></div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-3"><a href={result.commitUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm hover:bg-white/5">Inspect commit ↗</a><a href={result.pullRequestUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-teal-200 px-4 py-2.5 text-sm font-bold text-[#07120e]">Open draft pull request ↗</a></div>
      </section>}
    </div>
  </main>;
}
