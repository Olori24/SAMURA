export type CsvTable = { headers: string[]; rows: string[][] };
export type NumericSummary = {
  column: string;
  count: number;
  missing: number;
  mean: number;
  median: number;
  min: number;
  max: number;
};

export function parseCsv(input: string): CsvTable {
  if (input.length > 5_000_000) throw new Error("CSV files must be 5 MB or smaller.");
  const text = input.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (closedQuote && char !== "," && char !== "\r" && char !== "\n" && char !== " " && char !== "\t") {
      throw new Error("Invalid CSV: unexpected characters after a quoted cell.");
    }
    if (char === '"' && cell.length === 0 && !closedQuote) {
      quoted = true;
      continue;
    }
    if (char === '"' && cell.length > 0) {
      throw new Error("Invalid CSV: a quote appeared inside an unquoted cell.");
    }
    if (char === ",") {
      row.push(cell.trim());
      cell = "";
      closedQuote = false;
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(value => value.length > 0)) records.push(row);
      row = [];
      cell = "";
      closedQuote = false;
      continue;
    }
    if (closedQuote && (char === " " || char === "\t")) continue;
    cell += char;
  }

  if (quoted) throw new Error("Invalid CSV: a quoted cell was not closed.");
  if (cell.length > 0 || row.length > 0 || closedQuote) {
    row.push(cell.trim());
    if (row.some(value => value.length > 0)) records.push(row);
  }
  if (records.length < 2) throw new Error("CSV must contain a header row and at least one data row.");

  const rawHeaders = records[0].map((value, index) => value || `Column ${index + 1}`);
  const used = new Set<string>();
  const nextSuffix = new Map<string, number>();
  const headers = rawHeaders.map((value) => {
    let count = nextSuffix.get(value) ?? 1;
    let header = value;
    while (used.has(header)) {
      count += 1;
      header = `${value} (${count})`;
    }
    nextSuffix.set(value, count);
    used.add(header);
    return header;
  });
  const width = headers.length;
  const rows = records.slice(1).map((record, index) => {
    if (record.length !== width) {
      throw new Error(`CSV row ${index + 2} has ${record.length} cells; expected ${width}.`);
    }
    return record;
  });
  return { headers, rows };
}

export function summarizeNumericColumns(table: CsvTable): NumericSummary[] {
  return table.headers.flatMap((column, columnIndex) => {
    const values: number[] = [];
    let missing = 0;
    let invalid = 0;
    for (const row of table.rows) {
      const raw = row[columnIndex]?.trim() ?? "";
      if (!raw) {
        missing += 1;
        continue;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        invalid += 1;
        continue;
      }
      values.push(value);
    }
    if (!values.length || invalid > 0) return [];
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((total, value) => total + value, 0);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    return [{
      column,
      count: values.length,
      missing,
      mean: sum / values.length,
      median,
      min: sorted[0],
      max: sorted[sorted.length - 1],
    }];
  });
}
