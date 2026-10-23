import test from "node:test";
import assert from "node:assert/strict";
import {
  validateImportFile,
  validateImportRows,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
} from "../src/import-limits.js";

test("imports reject empty, unsupported, and oversized files before parsing", () => {
  assert.throws(
    () => validateImportFile({ name: "file.xlsx", size: 100 }),
    /CSV/,
  );
  assert.throws(
    () => validateImportFile({ name: "file.csv", size: 0 }),
    /vide/,
  );
  assert.throws(
    () => validateImportFile({ name: "file.csv", size: MAX_IMPORT_BYTES + 1 }),
    /20 Mo/,
  );
  assert.doesNotThrow(() =>
    validateImportFile({ name: "file.csv", size: MAX_IMPORT_BYTES }),
  );
});

test("row limit accepts supported sources and rejects excessive rows", () => {
  const result = { rowCount: MAX_IMPORT_ROWS, rows: [] };
  assert.equal(validateImportRows(result), result);
  assert.throws(
    () => validateImportRows({ rowCount: MAX_IMPORT_ROWS + 1 }),
    /100 000/,
  );
});

test("CSV support is case-insensitive and independent of OS-specific MIME labels", () => {
  for (const type of [
    "text/csv",
    "application/vnd.ms-excel",
    "application/octet-stream",
    "",
  ]) {
    assert.doesNotThrow(() =>
      validateImportFile({ name: "export.CSV", size: 100, type }),
    );
  }
  for (const name of [
    "export.xlsx",
    "export.xls",
    "export.numbers",
    "report.pdf",
    "image.png",
    "file.csv.xlsx",
  ]) {
    assert.throws(
      () => validateImportFile({ name, size: 100 }),
      /choisissez un fichier CSV/,
    );
  }
});
