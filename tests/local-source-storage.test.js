import test from "node:test";
import assert from "node:assert/strict";
import { createPersistedSourceSnapshot, applyPersistedSourceSnapshot } from "../src/local-source-storage.js";
import { dashboardCsvReducer, initialDashboardCsvState } from "../src/dashboard-state.js";

test("persisted snapshot contains only independent imported datasets, not navigation or errors", () => {
  const state = {
    ...initialDashboardCsvState,
    activePage: "followups",
    importError: "temporary error",
    importedCsv: { fileName: "avis.csv", rows: [{ DATE_AVIS: new Date("2026-01-02T00:00:00Z") }] },
    financialCsv: { fileName: "synthese.csv", mapped: { reportModel: true } },
    tuitionSources: { students: { fileName: "students.csv" }, schedule: null, references: { fileName: "refs.csv" } },
  };
  const snapshot = createPersistedSourceSnapshot(state);
  assert.equal(snapshot.importedCsv.fileName, "avis.csv");
  assert.equal(snapshot.financialCsv.fileName, "synthese.csv");
  assert.equal(snapshot.tuitionSources.students.fileName, "students.csv");
  assert.equal(snapshot.tuitionSources.schedule, null);
  assert.equal("activePage" in snapshot, false);
  assert.equal("importError" in snapshot, false);
  assert.equal(structuredClone(snapshot).importedCsv.rows[0].DATE_AVIS.toISOString(), "2026-01-02T00:00:00.000Z");
});

test("restoring saved sources survives refresh while keeping current page and independent source data", () => {
  const snapshot = createPersistedSourceSnapshot({
    importedCsv: { fileName: "avis.csv", rows: [{ id: "synthetic-only" }] },
    financialCsv: { fileName: "source-c.csv", mapped: { metrics: { programRemainingAmount: 240 } } },
    tuitionSources: { students: { fileName: "a.csv" }, schedule: { fileName: "b.csv" }, references: null },
  });
  let state = dashboardCsvReducer(initialDashboardCsvState, { type: "navigate", page: "followups" });
  state = dashboardCsvReducer(state, { type: "restore-sources", snapshot: structuredClone(snapshot) });
  assert.equal(state.activePage, "followups");
  assert.equal(state.importedCsv.fileName, "avis.csv");
  assert.equal(state.financialCsv.fileName, "source-c.csv");
  assert.equal(state.financialCsv.mapped.metrics.programRemainingAmount, 240);
  assert.equal(state.tuitionSources.students.fileName, "a.csv");
  assert.equal(state.tuitionSources.schedule.fileName, "b.csv");
});

test("a new source import during hydration is not overwritten by the older browser snapshot", () => {
  const snapshot = createPersistedSourceSnapshot({ importedCsv: { fileName: "old-avis.csv" }, financialCsv: { fileName: "old-finance.csv" } });
  const state = {
    ...initialDashboardCsvState,
    activePage: "followups",
    financialCsv: { fileName: "new-finance.csv" },
  };
  const restored = applyPersistedSourceSnapshot(state, snapshot);
  assert.equal(restored.activePage, "followups");
  assert.equal(restored.importedCsv.fileName, "old-avis.csv");
  assert.equal(restored.financialCsv.fileName, "new-finance.csv");
});

test("clearing saved sources removes every import while retaining the current page", () => {
  const loaded = dashboardCsvReducer(initialDashboardCsvState, { type: "restore-sources", snapshot: {
    version: 1,
    importedCsv: { fileName: "avis.csv" },
    financialCsv: { fileName: "source-c.csv" },
    tuitionSources: { students: { fileName: "a.csv" }, schedule: { fileName: "b.csv" }, references: { fileName: "d.csv" } },
  } });
  const page = dashboardCsvReducer(loaded, { type: "navigate", page: "followups" });
  const cleared = dashboardCsvReducer(page, { type: "clear-sources" });
  assert.equal(cleared.activePage, "followups");
  assert.equal(cleared.importedCsv, null);
  assert.equal(cleared.financialCsv, null);
  assert.deepEqual(cleared.tuitionSources, { students: null, schedule: null, references: null });
});
