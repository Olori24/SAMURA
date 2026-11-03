import { describe, expect, it } from "vitest";
import { csvEscape, formatAnalysisNumber, parseCsv, summarizeNumericColumns } from "./csv-analysis";

describe("formatAnalysisNumber", () => {
  it("preserves every digit of safe integers while keeping small decimals readable", () => {
    expect(formatAnalysisNumber(1_234_567_891, "en-US")).toBe("1,234,567,891");
    expect(formatAnalysisNumber(-9_876_543_210, "en-US")).toBe("-9,876,543,210");
    expect(formatAnalysisNumber(0.0000123456789, "en-US")).toBe("0.00001234568");
  });
});

describe("parseCsv", () => {
  it("parses CRLF, quoted commas, escaped quotes, and newlines in quoted cells", () => {
    const table = parseCsv('name,amount,note\r\n"Ada, Lovelace",10,"said ""hello"""\r\nGrace,20,"two\nlines"\r\n');
    expect(table.headers).toEqual(["name", "amount", "note"]);
    expect(table.rows).toEqual([
      ["Ada, Lovelace", "10", 'said "hello"'],
      ["Grace", "20", "two\nlines"],
    ]);
  });

  it("removes a BOM and disambiguates duplicate and empty header names", () => {
    const table = parseCsv('\uFEFFname,name,,\nAda,Grace,1,2\n');
    expect(table.headers).toEqual(["name", "name (2)", "Column 3", "Column 4"]);
    expect(table.rows[0]).toEqual(["Ada", "Grace", "1", "2"]);
  });

  it("keeps generated duplicate header names globally unique", () => {
    const table = parseCsv("a,a,a (2)\ntext,10,20\n");
    expect(table.headers).toEqual(["a", "a (2)", "a (2) (2)"]);
    expect(summarizeNumericColumns(table).map(column => column.column)).toEqual(["a (2)", "a (2) (2)"]);
  });

  it("preserves whitespace inside quoted cells", () => {
    const table = parseCsv(`sku,note
" SKU-01 "," keep spaces "
`);
    expect(table.rows).toEqual([[" SKU-01 ", " keep spaces "]]);
  });

  it("preserves explicit empty records but skips blank separator lines", () => {
    const table = parseCsv(`a,b
1,2
,

3,4
`);
    expect(table.rows).toEqual([["1", "2"], ["", ""], ["3", "4"]]);
    expect(summarizeNumericColumns(table).find(column => column.column === "a")?.missing).toBe(1);
  });

  it("rejects files that exceed the parsed-record limit", () => {
    const input = "value\n" + "x\n".repeat(100_001);
    expect(() => parseCsv(input)).toThrow("no more than 100,000 data rows");
  });

  it("rejects an over-limit final record without a trailing newline", () => {
    const input = "value\n" + "x\n".repeat(100_000) + "x";
    expect(() => parseCsv(input)).toThrow("no more than 100,000 data rows");
  });

  it("rejects CSV files that exceed the total-cell budget", () => {
    const input = "a,b,c,d,e,f,g,h,i,j\n" + ("1,2,3,4,5,6,7,8,9,10\n").repeat(25_000);
    expect(() => parseCsv(input)).toThrow("no more than 250,000 cells");
  });

  it("rejects CSV files that exceed the column limit", () => {
    const input = Array.from({ length: 2_001 }, () => "").join(",") + "\n" + Array.from({ length: 2_001 }, () => "x").join(",");
    expect(() => parseCsv(input)).toThrow("no more than 2,000 columns");
  });

  it("rejects unterminated quoted cells", () => {
    expect(() => parseCsv('name,note\nAda,"unfinished')).toThrow("quoted cell was not closed");
  });

  it("rejects quotes inside an unquoted cell", () => {
    expect(() => parseCsv('name,note\nAda,un"closed\n')).toThrow("quote appeared inside an unquoted cell");
  });

  it("rejects inconsistent row widths", () => {
    expect(() => parseCsv("a,b\n1,2\n3")).toThrow("expected 2");
  });

  it("requires a header and at least one data row", () => {
    expect(() => parseCsv("a,b\n")).toThrow("header row and at least one data row");
  });
});

describe("summarizeNumericColumns", () => {
  it("calculates descriptive statistics and counts missing values", () => {
    const table = parseCsv("city,sales\nLagos,10\nIbadan,\nAbuja,30\n");
    expect(summarizeNumericColumns(table)).toEqual([{
      column: "sales",
      count: 2,
      missing: 1,
      mean: 20,
      median: 20,
      min: 10,
      max: 30,
    }]);
  });

  it("keeps means and medians finite for very large finite values", () => {
    const table = parseCsv("value\n1e308\n1e308\n");
    const summary = summarizeNumericColumns(table)[0];
    expect(summary.mean).toBe(1e308);
    expect(summary.median).toBe(1e308);
  });

  it("does not classify mixed text-and-number columns as numeric", () => {
    const table = parseCsv("value\n10\nunknown\n20\n");
    expect(summarizeNumericColumns(table)).toEqual([]);
  });
});


describe("csvEscape", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-1+2", "@SUM(A1)", "\n=cmd", "\r=cmd", "\t=cmd", "  \n=cmd"])(
    "neutralizes formula-like values with leading controls: %j", value => {
      const neutralized = "'" + value;
      expect(csvEscape(value)).toBe(/[\r\n]/.test(value) ? '"' + neutralized + '"' : neutralized);
    },
  );

  it("quotes and escapes ordinary CSV values without changing their content", () => {
    expect(csvEscape('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
});
