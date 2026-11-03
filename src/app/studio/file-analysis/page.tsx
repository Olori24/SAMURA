"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, FileSearch, LoaderCircle, Search, Trash2 } from "lucide-react";

type AnalysisResult = {
  answer: string;
  filename: string;
  lineCount: number;
  characters: number;
};

const supportedExtensions = new Set([
  ".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".jsonl",
  ".js", ".jsx", ".ts", ".tsx", ".py", ".html", ".xml", ".yaml",
  ".yml", ".log", ".sql", ".css", ".sh", ".toml", ".ini",
]);

function hasSupportedExtension(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot > 0 && supportedExtensions.has(filename.slice(dot).toLowerCase());
}

export default function FileAnalysisPage() {
  const [filename, setFilename] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [content, setContent] = useState("");
  const [question, setQuestion] = useState("Summarize this file, identify its key points, and flag anything important or unclear.");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [reading, setReading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  async function selectFile(file?: File) {
    if (!file) return;
    setError("");
    setResult(null);
    if (!hasSupportedExtension(file.name)) {
      setError("Choose a text-based file: TXT, Markdown, CSV, JSON, or source code. PDF, Word, and Excel files are not supported yet.");
      return;
    }
    if (file.size > 240_000) {
      setError("The selected file is too large. The current limit is 240 KB.");
      return;
    }
    setReading(true);
    try {
      const extracted = await file.text();
      if (!extracted.trim()) throw new Error("The selected file is empty.");
      if (extracted.includes(String.fromCharCode(0))) throw new Error("This file appears to contain binary data, not readable text.");
      if (extracted.length > 60_000) throw new Error("The extracted text exceeds the 60,000-character limit.");
      const lineCount = extracted.replaceAll(String.fromCharCode(13), "").split(String.fromCharCode(10)).length;
      if (lineCount > 2_000) throw new Error("Files must contain no more than 2,000 lines.");
      setFilename(file.name);
      setMimeType(file.type);
      setContent(extracted);
    } catch (cause) {
      setFilename("");
      setMimeType("");
      setContent("");
      setError(cause instanceof Error ? cause.message : "Could not read this file.");
    } finally {
      setReading(false);
    }
  }

  async function analyze() {
    if (!filename || !content || question.trim().length < 3 || analyzing) return;
    setAnalyzing(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/files/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, mimeType, content, question: question.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "File analysis could not be completed.");
      setResult(data as AnalysisResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "File analysis could not be completed.");
    } finally {
      setAnalyzing(false);
    }
  }

  function clearFile() {
    setFilename("");
    setMimeType("");
    setContent("");
    setResult(null);
    setError("");
  }

  function downloadReport() {
    if (!result) return;
    const blob = new Blob([result.answer], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = (filename.replace(/\\.[^.]+$/, "") || "samura-file-analysis") + "-analysis.md";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className="min-h-screen bg-[#080b12] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/studio" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft size={16}/> Back to Studio</Link>
        <header className="mb-8 mt-8 max-w-3xl">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200"><FileSearch size={21}/></div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-200">SAMURA File Analysis</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Ask questions about your files.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-400">Select a text-based file, ask a question, and receive an evidence-led analysis with source line references. SAMURA does not store the uploaded file.</p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <label htmlFor="analysis-file" className="mb-2 block text-sm font-semibold text-slate-200">Choose a file</label>
          <input
            id="analysis-file"
            type="file"
            accept=".txt,.md,.markdown,.csv,.tsv,.json,.jsonl,.js,.jsx,.ts,.tsx,.py,.html,.xml,.yaml,.yml,.log,.sql,.css,.sh,.toml,.ini,text/plain,text/csv,application/json"
            disabled={reading || analyzing}
            onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void selectFile(file); }}
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-200 file:px-4 file:py-2.5 file:text-xs file:font-bold file:text-slate-950 hover:file:bg-white"
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">Supported: TXT, Markdown, CSV, TSV, JSON, logs, and source-code text. PDF, DOCX, and XLSX extraction is not implemented yet. Maximum 240 KB, 60,000 characters, and 2,000 lines.</p>

          {reading && <p className="mt-4 flex items-center gap-2 text-xs text-slate-400"><LoaderCircle size={14} className="animate-spin"/> Reading file locally…</p>}
          {filename && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200/20 bg-teal-200/[0.05] p-3">
            <div><p className="text-sm font-medium text-teal-100">{filename}</p><p className="mt-1 text-[11px] text-slate-500">{content.length.toLocaleString()} characters · {content.replaceAll(String.fromCharCode(13), "").split(String.fromCharCode(10)).length.toLocaleString()} lines extracted</p></div>
            <button type="button" onClick={clearFile} disabled={analyzing} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.05] disabled:opacity-50"><Trash2 size={13}/> Remove</button>
          </div>}

          {filename && <details className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-300">Preview extracted text</summary>
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-500">{content.slice(0, 6_000)}{content.length > 6_000 ? "\\n… preview truncated …" : ""}</pre>
          </details>}

          <div className="mt-5">
            <label htmlFor="file-analysis-question" className="mb-2 block text-sm font-semibold text-slate-200">What should SAMURA find out?</label>
            <textarea id="file-analysis-question" value={question} onChange={event => setQuestion(event.target.value.slice(0, 4_000))} maxLength={4_000} rows={3} disabled={analyzing} className="w-full resize-y rounded-xl border border-white/10 bg-[#0b0f18] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-teal-200/40" placeholder="Ask a question about the selected file…"/>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-xl text-xs leading-5 text-slate-500">The extracted text is sent to your configured AI provider only when you select Analyze. Do not submit passwords, credentials, or sensitive personal data.</p>
              <button type="button" onClick={() => void analyze()} disabled={!filename || !content || question.trim().length < 3 || analyzing || reading} className="inline-flex items-center gap-2 rounded-xl bg-teal-200 px-4 py-2.5 text-xs font-bold text-[#07120e] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">{analyzing ? <LoaderCircle size={14} className="animate-spin"/> : <Search size={14}/>} {analyzing ? "Analyzing…" : "Analyze file"}</button>
            </div>
          </div>
        </section>

        {error && <div role="alert" className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100">{error}</div>}
        {analyzing && <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 px-4 py-5 text-sm text-slate-400"><LoaderCircle size={17} className="animate-spin text-teal-200"/> Reading the supplied text and preparing cited findings…</div>}

        {result && <article className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-200">Analysis report</p><h2 className="mt-1 text-lg font-semibold">{result.filename}</h2><p className="mt-1 text-xs text-slate-500">{result.lineCount.toLocaleString()} source lines · {result.characters.toLocaleString()} characters</p></div>
            <button type="button" onClick={downloadReport} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.05]">Export report</button>
          </div>
          <div className="prose prose-invert prose-sm max-w-none break-words leading-7 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/30 prose-a:text-teal-200 prose-code:text-teal-200"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: () => null }}>{result.answer}</ReactMarkdown></div>
        </article>}
      </div>
    </main>
  );
}
