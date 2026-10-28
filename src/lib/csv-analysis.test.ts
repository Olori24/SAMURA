import { describe, expect, it } from "vitest";
import { parseCsv, summarizeNumericColumns } from "./csv-analysis";

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

  it("does not classify mixed text-and-number columns as numeric", () => {
    const table = parseCsv("value\n10\nunknown\n20\n");
    expect(summarizeNumericColumns(table)).toEqual([]);
  });
});
