"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Download, FileSpreadsheet, Table2 } from "lucide-react";
import { parseCsv, summarizeNumericColumns, type CsvTable } from "@/lib/csv-analysis";

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export default function DataAnalysisPage() {
  const [table, setTable] = useState<CsvTable | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const summaries = table ? summarizeNumericColumns(table) : [];
  const chartSummary = summaries[0];
  const chartColumnIndex = chartSummary && table ? table.headers.indexOf(chartSummary.column) : -1;
  const chartRows = table && chartSummary ? table.rows.slice(0, 20).map((row, index) => ({
    label: row[0]?.trim() || `Row ${index + 1}`,
    value: Number(row[chartColumnIndex]),
  })).filter((row) => Number.isFinite(row.value)) : [];
  const chartScale = Math.max(1, ...chartRows.map((row) => Math.abs(row.value)));

  async function loadFile(file?: File) {
    if (!file) return;
    setError("");
    setTable(null);
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError("Choose a CSV file. Excel files are not supported in this first version.");
      return;
    }
    if (file.size > 5_000_000) {
      setError("CSV files must be 5 MB or smaller.");
      return;
    }
    setBusy(true);
    try {
      const content = await file.text();
      setTable(parseCsv(content));
      setFileName(file.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The CSV file could not be read.");
    } finally {
      setBusy(false);
    }
  }

  function exportSummary() {
    if (!summaries.length) return;
    const rows = [
      ["Column", "Count", "Missing", "Mean", "Median", "Minimum", "Maximum"],
      ...summaries.map((item) => [item.column, item.count, item.missing, item.mean, item.median, item.min, item.max]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "samura-data-summary.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#080b12] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/studio" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Back to Studio</Link>
        <header className="mb-8 mt-8 max-w-3xl">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200"><FileSpreadsheet size={21} /></div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-200">SAMURA Data Analysis</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Understand your CSV data.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-400">Preview rows and calculate basic statistics for numeric columns. Files are read and processed in this browser; they are not uploaded to SAMURA’s server by this tool.</p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
          <label htmlFor="csv-file" className="block text-sm font-semibold">Choose a CSV file (maximum 5 MB)</label>
          <input id="csv-file" type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => loadFile(event.target.files?.[0])} className="mt-3 block w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-teal-200 file:px-4 file:py-2.5 file:text-xs file:font-bold file:text-[#07120e] hover:file:bg-white disabled:opacity-50" />
          {busy && <p className="mt-3 text-sm text-slate-400">Reading and analysing file…</p>}
          {error && <p role="alert" className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm text-amber-100">{error}</p>}
          {fileName && table && <p className="mt-4 text-sm text-slate-300">Loaded <strong>{fileName}</strong> · {table.rows.length} rows · {table.headers.length} columns</p>}
        </section>

        {table && <>
          <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
            <div className="mb-4 flex items-center gap-2"><Table2 size={18} className="text-teal-200" /><h2 className="text-lg font-semibold">Data preview</h2></div>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-white/[0.05] text-slate-200"><tr>{table.headers.map((header, i) => <th key={i} className="whitespace-nowrap px-3 py-3 font-semibold">{header}</th>)}</tr></thead>
                <tbody>{table.rows.slice(0, 25).map((row, i) => <tr key={i} className="border-t border-white/[0.07]">{row.map((cell, j) => <td key={j} className="max-w-xs whitespace-pre-wrap break-words px-3 py-2 text-slate-400">{cell || "—"}</td>)}</tr>)}</tbody>
              </table>
            </div>
            {table.rows.length > 25 && <p className="mt-3 text-xs text-slate-500">Showing the first 25 of {table.rows.length} rows.</p>}
          </section>

          {chartSummary && chartRows.length > 0 && <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
            <h2 className="text-lg font-semibold">Quick chart: {chartSummary.column}</h2>
            <p className="mt-1 text-xs text-slate-500">First 20 rows. Bar length shows absolute magnitude; exact signed values are shown at the right.</p>
            <div className="mt-5 space-y-3">
              {chartRows.map((row, index) => <div key={index} className="grid grid-cols-[minmax(70px,1fr)_2fr_auto] items-center gap-3 text-xs">
                <span className="truncate text-slate-400" title={row.label}>{row.label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]" role="img" aria-label={row.label + ": " + row.value}>
                  <div className="h-full rounded-full bg-teal-200" style={{ width: (Math.abs(row.value) / chartScale * 100) + "%" }} />
                </div>
                <span className="min-w-14 text-right tabular-nums text-slate-200">{row.value.toLocaleString()}</span>
              </div>)}
            </div>
          </section>}

          <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Numeric summary</h2><p className="mt-1 text-xs text-slate-500">Columns containing non-empty text values are excluded from numeric statistics.</p></div><button type="button" onClick={exportSummary} disabled={!summaries.length} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold hover:border-teal-200/30 disabled:opacity-40"><Download size={15} /> Export summary CSV</button></div>
            {summaries.length ? <div className="overflow-x-auto rounded-xl border border-white/10"><table className="min-w-full text-left text-xs"><thead className="bg-white/[0.05] text-slate-200"><tr>{["Column", "Count", "Missing", "Mean", "Median", "Minimum", "Maximum"].map((label) => <th key={label} className="whitespace-nowrap px-3 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{summaries.map((item) => <tr key={item.column} className="border-t border-white/[0.07]">{[item.column, item.count, item.missing, item.mean, item.median, item.min, item.max].map((value, i) => <td key={i} className="whitespace-nowrap px-3 py-3 text-slate-300">{typeof value === "number" ? Number(value.toFixed(4)).toLocaleString() : value}</td>)}</tr>)}</tbody></table></div> : <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-400">No fully numeric columns were found in this dataset.</p>}
          </section>
        </>}
      </div>
    </main>
  );
}
