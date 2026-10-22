import test from "node:test";
import assert from "node:assert/strict";
import { getFinancialFileSignature, refreshLinkedFinancialFile } from "../src/financial-file-sync.js";

test("financial file signature changes when the local CSV is updated", () => {
  assert.equal(getFinancialFileSignature({ name: "source.csv", size: 10, lastModified: 100 }), "source.csv:10:100");
  assert.notEqual(getFinancialFileSignature({ name: "source.csv", size: 11, lastModified: 100 }), getFinancialFileSignature({ name: "source.csv", size: 10, lastModified: 100 }));
  assert.notEqual(getFinancialFileSignature({ name: "source.csv", size: 10, lastModified: 101 }), getFinancialFileSignature({ name: "source.csv", size: 10, lastModified: 100 }));
});

test("unchanged linked source is not reparsed", async () => {
  const file = { name: "source.csv", size: 10, lastModified: 100 };
  let imports = 0;
  const result = await refreshLinkedFinancialFile({ queryPermission: async () => "granted", getFile: async () => file }, "source.csv:10:100", async () => { imports += 1; return true; });
  assert.equal(result.status, "unchanged");
  assert.equal(imports, 0);
});

test("changed file is reimported and accepted signature advances only on success", async () => {
  const file = { name: "source.csv", size: 12, lastModified: 101 };
  let importedFile;
  const result = await refreshLinkedFinancialFile({ queryPermission: async () => "granted", getFile: async () => file }, "source.csv:10:100", async (selected) => { importedFile = selected; return true; });
  assert.equal(result.status, "updated");
  assert.equal(result.signature, "source.csv:12:101");
  assert.equal(importedFile, file);

  const rejected = await refreshLinkedFinancialFile({ queryPermission: async () => "granted", getFile: async () => file }, "source.csv:10:100", async () => false);
  assert.equal(rejected.status, "invalid");
  assert.equal(rejected.signature, "source.csv:10:100");
});

test("revoked file access is surfaced for user reauthorization without reading the CSV", async () => {
  let reads = 0;
  const result = await refreshLinkedFinancialFile({ queryPermission: async () => "prompt", getFile: async () => { reads += 1; } }, "old", async () => true);
  assert.equal(result.status, "permission-required");
  assert.equal(result.signature, "old");
  assert.equal(reads, 0);
});
