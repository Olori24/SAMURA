"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowLeft, FilePlus2, FileText, LockKeyhole, Save, Sparkles, Trash2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { countWords, MAX_DOCUMENT_CHARACTERS, safeDocumentFilename, type DocumentFormat } from "@/lib/document-utils";
import posthog from "posthog-js";

type DocumentSummary = { id: string; title: string; format: DocumentFormat; createdAt: string; updatedAt: string };
type SavedDocument = DocumentSummary & { content: string };

const emptyTitle = "Untitled document";
const emptyContent = "# Untitled document\n\nStart writing here…";

export default function DocumentsPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [title, setTitle] = useState(emptyTitle);
  const [format, setFormat] = useState<DocumentFormat>("markdown");
  const [content, setContent] = useState(emptyContent);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [drafting, setDrafting] = useState(false);

  const wordCount = useMemo(() => countWords(content), [content]);
  const characterCount = content.length;

  const loadDocuments = useCallback(async () => {
    setLoadingDocuments(true);
    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      const payload = await response.json() as { documents?: DocumentSummary[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not load your documents.");
      setDocuments(payload.documents ?? []);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your documents.");
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;
    Promise.resolve().then(async () => {
      try {
        const response = await fetch("/api/documents", { cache: "no-store" });
        const payload = await response.json() as { documents?: DocumentSummary[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Could not load your documents.");
        if (!cancelled) {
          setDocuments(payload.documents ?? []);
          setError("");
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load your documents.");
      }
    });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  function startNewDocument() {
    if (dirty && !window.confirm("You have unsaved changes. Discard them and start a new document?")) return;
    setDocumentId(null);
    setTitle(emptyTitle);
    setFormat("markdown");
    setContent(emptyContent);
    setDirty(true);
    setNotice("New draft. Save it to keep it in your SAMURA account.");
    setError("");
  }

  async function openDocument(id: string) {
    if (dirty && !window.confirm("You have unsaved changes. Discard them and open another document?")) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/documents/" + encodeURIComponent(id), { cache: "no-store" });
      const payload = await response.json() as { document?: SavedDocument; error?: string };
      if (!response.ok || !payload.document) throw new Error(payload.error || "Could not open this document.");
      const saved = payload.document;
      setDocumentId(saved.id);
      setTitle(saved.title);
      setFormat(saved.format);
      setContent(saved.content);
      setDirty(false);
      setNotice("Document loaded from your SAMURA account.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open this document.");
    }
  }

  async function saveDocument() {
    if (!title.trim()) { setError("Give your document a title before saving."); return; }
    const isNewDocument = !documentId;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(documentId ? "/api/documents/" + encodeURIComponent(documentId) : "/api/documents", {
        method: documentId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), format, content }),
      });
      const payload = await response.json() as { document?: SavedDocument; error?: string };
      if (!response.ok || !payload.document) throw new Error(payload.error || "Could not save this document.");
      const saved = payload.document;
      setDocumentId(saved.id);
      setTitle(saved.title);
      setFormat(saved.format);
      setContent(saved.content);
      setDirty(false);
      setNotice("Saved securely to your SAMURA account.");
      posthog.capture(isNewDocument ? "document_created" : "document_updated", { document_format: saved.format });
      await loadDocuments();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this document.");
    } finally {
      setSaving(false);
    }
  }

  async function generateDraft() {
    if (!aiPrompt.trim()) { setError("Describe what you want SAMURA to draft."); return; }
    setDrafting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/documents/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          title: title.trim() || emptyTitle,
          format,
          existingContent: content.slice(0, 16_000),
        }),
      });
      const payload = await response.json() as { content?: string; error?: string; note?: string };
      if (!response.ok || typeof payload.content !== "string") throw new Error(payload.error || "Could not generate a draft.");
      setContent(payload.content.slice(0, MAX_DOCUMENT_CHARACTERS));
      setDirty(true);
      posthog.capture("document_draft_generated", { document_format: format });
      setNotice((payload.note || "AI draft generated.") + " Review the result, then save it to your account.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not generate a draft.");
    } finally {
      setDrafting(false);
    }
  }

  async function deleteDocument() {
    if (!documentId || !window.confirm(dirty ? "Permanently delete this saved document and discard your unsaved edits?" : "Permanently delete this document from your account?")) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/documents/" + encodeURIComponent(documentId), { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not delete this document.");
      setDocumentId(null);
      setTitle(emptyTitle);
      setFormat("markdown");
      setContent(emptyContent);
      setDirty(true);
      setNotice("Document deleted. Start a new draft or open another document.");
      posthog.capture("document_deleted");
      await loadDocuments();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this document.");
    } finally {
      setDeleting(false);
    }
  }

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
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setNotice(dirty ? "Export downloaded. Remember to save this draft to your SAMURA account as well." : "Export downloaded to your device.");
  }

  if (isPending) return <main className="grid min-h-screen place-items-center bg-[#080b12] text-slate-400">Loading your workspace…</main>;
  if (!session?.user) { router.replace("/login"); return null; }

  return <main className="min-h-screen bg-[#080b12] px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-7xl">
      <Link href="/studio" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft size={16}/> Back to Studio</Link>
      <header className="mb-8 mt-8">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200"><FileText size={21}/></div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-200">SAMURA Documents</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Your documents, saved with your account.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Create and edit Markdown or plain text, save drafts to your account, reopen them on another device, and export copies locally. Documents are scoped to your signed-in user.</p>
      </header>

      <section className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.035] p-4">
          <button type="button" onClick={startNewDocument} disabled={saving || drafting || deleting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-200 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-100"><FilePlus2 size={17}/> New document</button>
          <div className="mb-3 mt-6 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-100">Your library</h2><span className="text-xs text-slate-500">{documents.length}/100</span></div>
          {loadingDocuments && <p className="py-3 text-xs text-slate-500">Loading your documents…</p>}
          {!loadingDocuments && documents.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs leading-5 text-slate-500">Your saved documents will appear here.</p>}
          <div className="space-y-2">
            {documents.map(item => <button key={item.id} type="button" onClick={() => void openDocument(item.id)} disabled={saving || drafting || deleting} className={"block w-full rounded-xl border p-3 text-left transition " + (documentId === item.id ? "border-teal-200/40 bg-teal-200/[0.07]" : "border-white/10 bg-black/10 hover:bg-white/[0.04]")}>
              <span className="block truncate text-sm font-medium text-slate-100">{item.title}</span>
              <span className="mt-1 block text-[11px] uppercase tracking-wide text-slate-500">{item.format} · {new Date(item.updatedAt).toLocaleDateString()}</span>
            </button>)}
          </div>
          <p className="mt-5 flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-400"><LockKeyhole size={15} className="mt-0.5 shrink-0 text-teal-200"/> Only your authenticated account can read or change its documents. The server enforces ownership.</p>
        </aside>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
            <div><p className="text-sm font-medium text-slate-100">Editor</p><p className="mt-1 text-xs text-slate-500">{documentId ? "Saved document" : "New draft"} · {dirty ? "Unsaved changes" : "All changes saved"}</p></div>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{format === "markdown" ? "Markdown" : "Plain text"}</span>
          </div>
          <div className="border-b border-white/10 bg-teal-200/[0.025] p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2"><Sparkles size={17} className="text-teal-200"/><h2 className="text-sm font-semibold text-slate-100">AI document assistant</h2><span className="rounded-full border border-teal-200/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-teal-100">Preview</span></div>
            <label htmlFor="document-ai-prompt" className="mb-2 block text-xs font-medium text-slate-300">What should SAMURA write or improve?</label>
            <textarea id="document-ai-prompt" disabled={drafting || saving} value={aiPrompt} onChange={event => setAiPrompt(event.target.value.slice(0, 4000))} maxLength={4000} rows={3} placeholder="Example: Turn these notes into a clear project proposal with goals, milestones, budget assumptions, and risks…" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-teal-200/40"/>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-xs leading-5 text-slate-500">AI output replaces the editor text but does not save automatically. Review the draft, then choose Save to account. Provider usage limits and charges may apply.</p><button type="button" disabled={drafting || saving || !aiPrompt.trim()} onClick={() => void generateDraft()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200/25 bg-teal-200/[0.08] px-4 py-2.5 text-sm font-semibold text-teal-100 transition hover:bg-teal-200/[0.13] disabled:cursor-not-allowed disabled:opacity-50"><Sparkles size={15}/>{drafting ? "Drafting…" : "Generate draft"}</button></div>
          </div>
          <div className="grid gap-4 border-b border-white/10 p-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:px-5">
            <div><label htmlFor="document-title" className="mb-2 block text-sm font-medium text-slate-200">Document title</label><input id="document-title" disabled={saving || drafting} value={title} onChange={event => { setTitle(event.target.value.slice(0, 120)); setDirty(true); }} maxLength={120} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none focus:border-teal-200/50" /></div>
            <div><label htmlFor="document-format" className="mb-2 block text-sm font-medium text-slate-200">Format</label><select id="document-format" disabled={saving || drafting} value={format} onChange={event => { setFormat(event.target.value as DocumentFormat); setDirty(true); }} className="w-full rounded-xl border border-white/10 bg-[#111722] px-3 py-3 text-sm text-white outline-none focus:border-teal-200/50"><option value="markdown">Markdown (.md)</option><option value="text">Plain text (.txt)</option></select></div>
          </div>
          <textarea aria-label="Document content" disabled={saving || drafting} value={content} onChange={event => { setContent(event.target.value.slice(0, MAX_DOCUMENT_CHARACTERS)); setDirty(true); setNotice(""); }} maxLength={MAX_DOCUMENT_CHARACTERS} spellCheck className="min-h-[52vh] w-full resize-y bg-transparent p-4 font-mono text-sm leading-7 text-slate-100 outline-none placeholder:text-slate-600 sm:p-6" placeholder="Write your document…" />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-xs text-slate-500 sm:px-5"><span>{wordCount.toLocaleString()} words · {characterCount.toLocaleString()} / {MAX_DOCUMENT_CHARACTERS.toLocaleString()} characters</span><span>Save before leaving to keep your latest edits.</span></div>
          <div className="flex flex-wrap gap-2 p-4 sm:px-5">
            <button type="button" disabled={saving || drafting || !dirty} onClick={() => void saveDocument()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-200 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"><Save size={16}/>{saving ? "Saving…" : documentId ? "Save changes" : "Save to account"}</button>
            <button type="button" onClick={download} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.04]"><ArrowDownToLine size={16}/> Export file</button>
            {documentId && <button type="button" disabled={deleting || saving || drafting} onClick={() => void deleteDocument()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/20 px-4 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-300/[0.06] disabled:opacity-50"><Trash2 size={16}/>{deleting ? "Deleting…" : "Delete"}</button>}
          </div>
          {error && <p role="alert" className="mx-4 mb-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.05] p-3 text-sm leading-5 text-rose-100 sm:mx-5">{error}</p>}
          {notice && <p role="status" className="mx-4 mb-4 rounded-xl border border-teal-200/15 bg-teal-200/[0.05] p-3 text-sm leading-5 text-teal-100 sm:mx-5">{notice}</p>}
        </div>
      </section>
    </div>
  </main>;
}
