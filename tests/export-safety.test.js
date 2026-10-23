import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, toCsv } from "../src/commercial-data.js";

test("spreadsheet exports neutralize formula-like untrusted text", () => {
  for (const value of [
    "=1+1",
    "+SUM(1)",
    "-SUM(1)",
    "@SUM(1)",
    "  =1",
    "\n=1",
    "＝1+1",
    "＋1",
    "－1",
    "＠SUM(1)",
  ]) {
    assert.ok(csvCell(value).startsWith('"\t'), JSON.stringify(value));
  }
  assert.equal(csvCell(-123.5), '"-123.5"');
  assert.equal(csvCell("Un commentaire normal"), '"Un commentaire normal"');
});

test("export keeps each quoted field intact across delimiters, quotes, and newlines", () => {
  const text = '=1+1";=2+2\ntexte';
  const result = toCsv(
    [{ comment: text }],
    [{ key: "comment", label: "Commentaire" }],
  );
  assert.equal(result, '"Commentaire"\r\n"\t=1+1"";=2+2\ntexte"');
});
