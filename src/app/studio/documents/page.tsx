"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowLeft, FileText, LockKeyhole, RotateCcw } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { countWords, MAX_DOCUMENT_CHARACTERS, safeDocumentFilename, type DocumentFormat } from "@/lib/document-utils";

export default function DocumentsPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [title, setTitle] = useState("Untitled document");
  const [format, setFormat] = useState<DocumentFormat>("markdown");
  const [content, setContent] = useState("# Untitled document\n\nStart writing here…");
  const [notice, setNotice] = useState("");

  const wordCount = useMemo(() => countWords(content), [content]);
  const characterCount = content.length;

  function download() {
    const extension = format === "markdown" ? "md" : "txt";
    const mime = format === "markdown" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8";
    const blob = new Blob([content], { type: mime });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = safeDocumentFilename(title) + "." + extension;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    setNotice("Export prepared. Your draft stays in this browser session; it is not saved to your SAMURA account.");
  }

  function reset() {
    setTitle("Untitled document");
    setFormat("markdown");
    setContent("# Untitled document\n\nStart writing here…");
    setNotice("");
  }

  if (isPending) return <main className="grid min-h-screen place-items-center bg-[#080b12] text-slate-400">Loading your workspace…</main>;
  if (!session?.user) { router.replace("/login"); return null; }

  return <main className="min-h-screen bg-[#080b12] px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-6xl">
      <Link href="/studio" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft size={16}/> Back to Studio</Link>
      <header className="mb-8 mt-8">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200"><FileText size={21}/></div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-200">SAMURA Documents</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Draft, edit, and export.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Create a document in Markdown or plain text and export it to your device. This first version runs locally in your signed-in browser session and does not upload or persist the draft.</p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.035] p-5">
          <label htmlFor="document-title" className="mb-2 block text-sm font-medium text-slate-200">Document title</label>
          <input id="document-title" value={title} onChange={event => setTitle(event.target.value.slice(0, 120))} maxLength={120} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none focus:border-teal-200/50" />
          <label htmlFor="document-format" className="mb-2 mt-5 block text-sm font-medium text-slate-200">Export format</label>
          <select id="document-format" value={format} onChange={event => setFormat(event.target.value as DocumentFormat)} className="w-full rounded-xl border border-white/10 bg-[#111722] px-3 py-3 text-sm text-white outline-none focus:border-teal-200/50">
            <option value="markdown">Markdown (.md)</option>
            <option value="text">Plain text (.txt)</option>
          </select>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-xs text-slate-400">Words</p><p className="mt-1 text-xl font-semibold tabular-nums">{wordCount}</p></div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-xs text-slate-400">Characters</p><p className="mt-1 text-xl font-semibold tabular-nums">{characterCount.toLocaleString()}</p></div>
          </div>
          <button type="button" onClick={download} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-200 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-100"><ArrowDownToLine size={17}/> Export document</button>
          <button type="button" onClick={reset} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.04]"><RotateCcw size={16}/> Reset draft</button>
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-400"><LockKeyhole size={15} className="mt-0.5 shrink-0 text-teal-200"/> Your draft is not sent to a server or stored in your account. Export before leaving or refreshing this page.</div>
          {notice && <p role="status" className="mt-4 rounded-xl border border-teal-200/15 bg-teal-200/[0.05] p-3 text-xs leading-5 text-teal-100">{notice}</p>}
        </aside>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5"><div><p className="text-sm font-medium text-slate-100">Editor</p><p className="mt-1 text-xs text-slate-500">Plain text editing · Markdown supported</p></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{format === "markdown" ? "Markdown" : "Plain text"}</span></div>
          <textarea aria-label="Document content" value={content} onChange={event => { setContent(event.target.value.slice(0, MAX_DOCUMENT_CHARACTERS)); setNotice(""); }} maxLength={MAX_DOCUMENT_CHARACTERS} spellCheck className="min-h-[60vh] w-full resize-y bg-transparent p-4 font-mono text-sm leading-7 text-slate-100 outline-none placeholder:text-slate-600 sm:p-6" placeholder="Write your document…" />
          <div className="border-t border-white/10 px-4 py-3 text-xs text-slate-500 sm:px-5">Maximum draft size: {MAX_DOCUMENT_CHARACTERS.toLocaleString()} characters. Export is generated locally; no file is uploaded.</div>
        </div>
      </section>
    </div>
  </main>;
}
