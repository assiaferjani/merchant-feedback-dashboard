import test from "node:test";
import assert from "node:assert/strict";
import { filterCommercialCsv, REQUIRED_COMMERCIAL_CSV_FIELDS, parseCommercialCsvText, resolveCommercialSourceState } from "../src/commercial-csv.js";
import { dashboardCsvReducer, importCsvWith, importTuitionCsvWith, initialDashboardCsvState, resolveDashboardTheme, toggleDashboardTheme } from "../src/dashboard-state.js";
import { discoverTuitionCsvText } from "../src/tuition-data.js";

function parsedCsv(candidateId, category) {
  const values = {
    IDENTITE_LEAD: candidateId,
    DATE_AVIS: "2025-04-10",
    LIB_AVIS: category,
    RESPONSABLE: "Responsable test",
    LIB_SOURCE_LEAD: "Source test",
    EST_CLASSER: "Valeur brute",
    LIB_ETABLISSEMENT: "Établissement test",
    LIB_REGION: "Région test",
  };
  return parseCommercialCsvText(`${REQUIRED_COMMERCIAL_CSV_FIELDS.join(";")}\n${REQUIRED_COMMERCIAL_CSV_FIELDS.map((field) => values[field]).join(";")}`);
}

test("CSV source, date range, and filtered rows stay coherent across commercial page navigation", () => {
  const imported = dashboardCsvReducer(initialDashboardCsvState, {
    type: "csv-imported", parsed: parsedCsv("ref-a", "Avis A"), fileName: "source-a.csv",
  });
  const feedbackPage = dashboardCsvReducer(imported, { type: "navigate", page: "feedback" });
  const reportPage = dashboardCsvReducer(feedbackPage, { type: "navigate", page: "report" });
  const selectedPeriod = { startDate: "2025-04-10", endDate: "2025-04-10" };
  const reportRows = filterCommercialCsv(reportPage.importedCsv.rows, selectedPeriod);

  assert.equal(reportPage.activePage, "report");
  assert.deepEqual(selectedPeriod, { startDate: "2025-04-10", endDate: "2025-04-10" });
  assert.equal(reportRows.length, 1);
  assert.equal(reportPage.importedCsv.fileName, "source-a.csv");
  assert.equal(reportPage.importedCsv.rows[0].IDENTITE_LEAD, "ref-a");
  assert.equal(resolveCommercialSourceState({ importedCsv: reportPage.importedCsv }).kind, "local-csv");
});

test("replacing the imported CSV updates shared rows without changing the selected page", () => {
  const first = dashboardCsvReducer(initialDashboardCsvState, {
    type: "csv-imported", parsed: parsedCsv("ref-a", "Avis A"), fileName: "first.csv",
  });
  const currentPage = dashboardCsvReducer(first, { type: "navigate", page: "revenue" });
  const replacement = dashboardCsvReducer(currentPage, {
    type: "csv-imported", parsed: parsedCsv("ref-b", "Avis B"), fileName: "replacement.csv",
  });

  assert.equal(replacement.activePage, "revenue");
  assert.equal(replacement.importedCsv.fileName, "replacement.csv");
  assert.equal(replacement.importedCsv.rows[0].IDENTITE_LEAD, "ref-b");
  assert.equal(replacement.importedCsv.rows[0].LIB_AVIS, "Avis B");
  assert.equal(resolveCommercialSourceState({ importedCsv: replacement.importedCsv }).showNoSourceMessage, false);
  assert.equal(filterCommercialCsv(replacement.importedCsv.rows, { startDate: "2025-04-10", endDate: "2025-04-10" }).length, 1);
});

test("failed replacement preserves the previously active source and current page", () => {
  const imported = dashboardCsvReducer(initialDashboardCsvState, {
    type: "csv-imported", parsed: parsedCsv("ref-a", "Avis A"), fileName: "good.csv",
  });
  const selected = dashboardCsvReducer(imported, { type: "navigate", page: "pipeline" });
  const failed = dashboardCsvReducer(selected, { type: "csv-import-failed", message: "Colonnes manquantes." });
  assert.equal(failed.activePage, "pipeline");
  assert.equal(failed.importedCsv.fileName, "good.csv");
  assert.equal(failed.importError, "Colonnes manquantes.");
});

test("the complete import workflow activates a source and replaces it without navigating", async () => {
  let state = dashboardCsvReducer(initialDashboardCsvState, { type: "navigate", page: "report" });
  const dispatch = (action) => { state = dashboardCsvReducer(state, action); };
  const parseFixture = async (file) => parsedCsv(file.candidateId, file.category);

  assert.equal(await importCsvWith({ name: "first.csv", candidateId: "ref-a", category: "Avis A" }, dispatch, parseFixture), true);
  assert.equal(state.activePage, "report");
  assert.equal(state.importedCsv.fileName, "first.csv");
  assert.equal(resolveCommercialSourceState({ importedCsv: state.importedCsv }).kind, "local-csv");

  assert.equal(await importCsvWith({ name: "replacement.csv", candidateId: "ref-b", category: "Avis B" }, dispatch, parseFixture), true);
  assert.equal(state.activePage, "report");
  assert.equal(state.importedCsv.fileName, "replacement.csv");
  assert.equal(state.importedCsv.rows[0].IDENTITE_LEAD, "ref-b");
  assert.equal(state.importError, "");
});

test("the import workflow reports parsing failure without clearing source or changing page", async () => {
  let state = dashboardCsvReducer(initialDashboardCsvState, { type: "navigate", page: "pipeline" });
  const dispatch = (action) => { state = dashboardCsvReducer(state, action); };
  const parseFailure = async () => { throw new Error("Colonnes manquantes."); };
  assert.equal(await importCsvWith({ name: "bad.csv" }, dispatch, parseFailure), false);
  assert.equal(state.activePage, "pipeline");
  assert.equal(state.importedCsv, null);
  assert.equal(state.importError, "Colonnes manquantes.");
});

test("student, schedule, aggregate, and commercial sources stay independent across navigation", async () => {
  let state = dashboardCsvReducer(initialDashboardCsvState, { type: "navigate", page: "schedule" });
  const dispatch = (action) => { state = dashboardCsvReducer(state, action); };
  const parse = async (_file, type) => discoverTuitionCsvText(type === "students"
    ? "ID Étudiant;Matricule;Nom\nS1;M1;Fictif"
    : "ID Échéance;Matricule;Statut\nE1;M1;À venir", type, "fixture.csv");
  await importTuitionCsvWith({ name: "students.csv" }, "students", dispatch, parse);
  await importTuitionCsvWith({ name: "schedule.csv" }, "schedule", dispatch, parse);
  state = dashboardCsvReducer(state, { type: "financial-csv-discovered", fileName: "aggregate.csv", source: { headers: ["Mois"], rows: [{ Mois: "janvier" }], rowCount: 1, columnProfile: [], reportModel: null } });
  const commercial = dashboardCsvReducer(state, { type: "csv-imported", fileName: "commercial.csv", parsed: parsedCsv("ref-a", "Avis") });
  const navigated = dashboardCsvReducer(commercial, { type: "navigate", page: "students" });
  assert.equal(navigated.activePage, "students");
  assert.equal(navigated.tuitionSources.students.fileName, "students.csv");
  assert.equal(navigated.tuitionSources.schedule.fileName, "schedule.csv");
  assert.equal(navigated.financialCsv.fileName, "aggregate.csv");
  assert.equal(navigated.importedCsv.fileName, "commercial.csv");
});

test("replacing one tuition source preserves other sources and selected page", async () => {
  let state = dashboardCsvReducer(initialDashboardCsvState, { type: "navigate", page: "formations" });
  const dispatch = (action) => { state = dashboardCsvReducer(state, action); };
  const parse = async (file, type) => discoverTuitionCsvText(type === "students" ? "ID Étudiant;Matricule\nS1;M1" : "ID Échéance;Matricule\nE1;M1", type, file.name);
  await importTuitionCsvWith({ name: "a.csv" }, "students", dispatch, parse);
  await importTuitionCsvWith({ name: "b.csv" }, "schedule", dispatch, parse);
  await importTuitionCsvWith({ name: "a-new.csv" }, "students", dispatch, parse);
  assert.equal(state.activePage, "formations");
  assert.equal(state.tuitionSources.students.fileName, "a-new.csv");
  assert.equal(state.tuitionSources.schedule.fileName, "b.csv");
});

test("manual mapping updates only its source and clears the incomplete identifier warning", () => {
  const discovered = discoverTuitionCsvText("Student Key;Name\nS-1;Fictif", "students", "manual.csv");
  let state = dashboardCsvReducer(initialDashboardCsvState, { type: "tuition-csv-discovered", source: discovered, fileName: "manual.csv" });
  state = dashboardCsvReducer(state, { type: "tuition-csv-discovered", source: discoverTuitionCsvText("ID Échéance;Statut\nE-1;À venir", "schedule"), fileName: "schedule.csv" });
  state = dashboardCsvReducer(state, { type: "tuition-csv-mapped", sourceType: "students", mapping: { ...state.tuitionSources.students.mapping, studentId: "Student Key" } });
  assert.deepEqual(state.tuitionSources.students.missingRequired, []);
  assert.equal(state.tuitionSources.students.mappedRows[0].studentId, "S-1");
  assert.equal(state.tuitionSources.schedule.fileName, "schedule.csv");
});

test("theme preference resolver and toggle stay constrained to light and dark", () => {
  assert.equal(resolveDashboardTheme("unexpected"), "light");
  assert.equal(toggleDashboardTheme("light"), "dark");
  assert.equal(toggleDashboardTheme("dark"), "light");
});
