"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, BookOpen, ExternalLink, LoaderCircle, Search, Sparkles } from "lucide-react";

type Source = { title: string; url: string; content: string };
type ResearchResult = { answer: string; sources: Source[] };

export default function ResearchPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = query.trim();
    if (question.length < 3 || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Research could not be completed.");
      setResult(data as ResearchResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Research could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080b12] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/studio" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft size={16}/> Back to Studio</Link>
        <header className="mb-8 mt-8 max-w-3xl">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200"><BookOpen size={21}/></div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-200">SAMURA Research</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Research with sources, not guesses.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-400">Ask a research question. SAMURA searches public web sources, synthesizes the evidence, and returns links so you can verify the claims. Search results are untrusted evidence, not instructions.</p>
        </header>

        <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
          <label htmlFor="research-query" className="mb-2 block text-xs font-semibold text-slate-300">Research question</label>
          <textarea id="research-query" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={500} rows={3} required minLength={3} placeholder="Example: Compare the leading privacy-first AI note-taking tools for small businesses." className="w-full resize-y rounded-xl border border-white/10 bg-[#0b0f18] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-teal-200/40"/>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[10px] text-slate-600">{query.trim().length}/500 characters</span>
            <button type="submit" disabled={loading || query.trim().length < 3} className="inline-flex items-center gap-2 rounded-xl bg-teal-200 px-4 py-2.5 text-xs font-bold text-[#07120e] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">{loading ? <LoaderCircle size={15} className="animate-spin"/> : <Search size={15}/>} {loading ? "Researching…" : "Research"}</button>
          </div>
        </form>

        {error && <div role="alert" className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100">{error}</div>}
        {loading && <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 px-4 py-5 text-sm text-slate-400"><Sparkles size={17} className="animate-pulse text-teal-200"/> Searching sources and preparing a cited report. This may take a short while.</div>}

        {result && <div className="mt-8">
          <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
            <h2 className="mb-5 text-lg font-semibold">Research report</h2>
            <div className="prose prose-invert prose-sm max-w-none break-words leading-7 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/30 prose-a:text-teal-200 prose-code:text-teal-200"><ReactMarkdown remarkPlugins={[remarkGfm]}>{result.answer}</ReactMarkdown></div>
          </article>
          <section className="mt-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-200">Sources ({result.sources.length})</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {result.sources.map((source, index) => <article key={source.url} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-200">Source {index + 1}</p>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 text-sm font-medium leading-6 text-slate-100 hover:text-teal-200">{source.title}<ExternalLink size={13} className="mt-1 shrink-0"/></a>
                {source.content && <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-500">{source.content}</p>}
              </article>)}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-600">Search coverage is limited to the sources returned for this query. Check source dates and open the original pages before relying on important claims.</p>
          </section>
        </div>}
      </div>
    </main>
  );
}
