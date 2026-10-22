import test from "node:test";
import assert from "node:assert/strict";
import { FINANCIAL_FIELDS, mapFinancialDataset, parseFinancialAmount, parseFinancialCsvFile, parseFinancialCsvText, parseFinancialDate } from "../src/financial-csv.js";
import { dashboardCsvReducer, importFinancialCsvWith, initialDashboardCsvState, isFinancialCsvConnected } from "../src/dashboard-state.js";
import { parseCommercialCsvText, REQUIRED_COMMERCIAL_CSV_FIELDS } from "../src/commercial-csv.js";

const FINANCE_CSV = [
  "Somme;Date versement;État;Réf paiement;Dossier;Date inscription;État inscription;Canal",
  "1 250,50;02/03/2025;Réglé;P-1;E-1;2025-03-01;Confirmée;Carte",
  "30,00;2025-03-04;En attente;P-2;E-2;2025-03-02;En cours;Virement",
  "1 250,50;02/03/2025;Réglé;P-1;E-1;2025-03-01;Confirmée;Carte",
].join("\n");

const MAPPING = {
  paymentAmount: "Somme", paymentDate: "Date versement", paymentStatus: "État", paymentId: "Réf paiement",
  enrollmentId: "Dossier", enrollmentDate: "Date inscription", enrollmentStatus: "État inscription", paymentMethod: "Canal",
};

test("financial schema discovery exposes only headers and aggregate completeness", () => {
  const discovered = parseFinancialCsvText(FINANCE_CSV);
  assert.deepEqual(discovered.headers, ["Somme", "Date versement", "État", "Réf paiement", "Dossier", "Date inscription", "État inscription", "Canal"]);
  assert.equal(discovered.rowCount, 3);
  assert.equal(discovered.columnProfile[0].filled, 3);
  assert.equal(JSON.stringify(discovered.columnProfile).includes("1250"), false);
});

const SUMMARY_CSV = [
  "Rapport financier;;;;;;;;;",
  "Généré automatiquement;;;;;;;;;",
  ";;;;;;; ;",
  ";;;;;;; ;",
  ";;;;;;; ;",
  "Payées;Partielles;À venir;En retard;;Mois;Montant prévu;Montant collecté;Ecart;Taux",
  "3;2;1;0;;Mois A;1 000,00;700,00;300,00;70%",
  ";;;; ;Mois B;2 000,00;1 250,00;750,00;62,5%",
  ";;;; ;Total général;3 000,00;1 950,00;1 050,00;65%",
  ";;;; ;;;;;",
  "Filière;Total à payer;Total encaissé;Reste à encaisser;Taux de recouvrement;;;;;",
  "Filière fictive A;1 000,00;700,00;300,00;70%;;;;;",
  "Filière fictive B;2 000,00;1 250,00;750,00;62,5%;;;;;",
  "Total général;3 000,00;1 950,00;1 050,00;65%;;;;;",
].join("\n");

function withProgramGapColumn(header, firstDetailGap = "300,00", secondDetailGap = "750,00") {
  const matrix = SUMMARY_CSV.split("\n").map((line) => line.split(";"));
  const programHeader = matrix.findIndex((row) => row[0]?.startsWith("Fili") && row.some((cell) => cell.includes("Reste")));
  const firstDetail = matrix.findIndex((row) => row[0]?.includes("fictive A"));
  const secondDetail = matrix.findIndex((row) => row[0]?.includes("fictive B"));
  matrix[programHeader][3] = header;
  matrix[firstDetail][3] = firstDetailGap;
  matrix[secondDetail][3] = secondDetailGap;
  return matrix.map((row) => row.join(";")).join("\n");
}

test("summary dashboard CSV skips preamble and discovers monthly, program, and status aggregates", () => {
  const source = parseFinancialCsvText(SUMMARY_CSV);
  assert.equal(source.delimiter, ";");
  assert.equal(source.preambleRows, 5);
  assert.equal(source.headers[4], "Colonne sans nom 5");
  assert.equal(source.reportModel.monthlyRows.length, 2);
  assert.equal(source.reportModel.excludedMonthlyTotalRows, 1);
  assert.equal(source.reportModel.excludedProgramTotalRows, 1);
  assert.equal(source.reportModel.programRows.length, 2);
  assert.equal(source.reportModel.statusTotals.length, 4);
  const mapped = mapFinancialDataset(source);
  assert.equal(mapped.metrics.plannedAmount, 3000);
  assert.equal(mapped.metrics.collectedAmount, 1950);
  assert.equal(mapped.metrics.programCount, 2);
  assert.equal(mapped.metrics.excludedMonthlyTotalRows, 1);
  assert.equal(mapped.metrics.excludedProgramTotalRows, 1);
  assert.equal(mapped.metrics.programRemainingAmount, 1050);
  assert.equal(mapped.metrics.enrollmentCount, null);
  assert.equal(mapped.metrics.confirmedCollectedRevenue, null);
  assert.equal(mapped.statusTotals[0].count, 3);
});

test("monthly grand-total rows are excluded so monthly and by-program aggregates are never double-counted", () => {
  const source = parseFinancialCsvText(SUMMARY_CSV);
  const mapped = mapFinancialDataset(source);
  const monthlyCollected = mapped.monthlyRows.reduce((sum, row) => sum + row.collectedAmount, 0);
  const monthlyPlanned = mapped.monthlyRows.reduce((sum, row) => sum + row.plannedAmount, 0);
  const programCollected = mapped.programRows.reduce((sum, row) => sum + row.collectedAmount, 0);
  const programPlanned = mapped.programRows.reduce((sum, row) => sum + row.plannedAmount, 0);
  assert.equal(monthlyCollected, 1950);
  assert.equal(monthlyPlanned, 3000);
  assert.equal(mapped.monthlyRows.some((row) => /total/i.test(row.period)), false);
  assert.equal(mapped.metrics.collectedAmount, monthlyCollected);
  assert.equal(mapped.metrics.plannedAmount, monthlyPlanned);
  assert.equal(mapped.metrics.collectedAmount + mapped.metrics.programCollectedAmount, 3900);
  assert.equal(programCollected, 1950);
  assert.equal(programPlanned, 3000);
  // The two dimensions independently reconcile here; they are not additive.
  assert.equal(monthlyCollected, programCollected);
  assert.equal(monthlyPlanned, programPlanned);
});

test("accented and padded program Écart column is used directly after arithmetic verification", () => {
  const source = parseFinancialCsvText(withProgramGapColumn("  ÉCART  ", "300,001"));
  const mapped = mapFinancialDataset(source);
  assert.equal(source.reportModel.programRemainingHeader, "ÉCART");
  assert.equal(source.reportModel.programRemainingMeaningConfirmed, true);
  assert.equal(mapped.programRows[0].remainingSourceVerified, true);
  assert.equal(mapped.programRows[0].remainingAmount, 300.001);
  assert.equal(mapped.metrics.programRemainingAmount, 1050.001);
  assert.equal(mapped.metrics.excludedProgramTotalRows, 1);
});

test("an Écart column that does not match payer minus collected falls back to arithmetic", () => {
  const mapped = mapFinancialDataset(parseFinancialCsvText(withProgramGapColumn("Écart", "999,00")));
  assert.equal(mapped.metrics.programRemainingMeaningConfirmed, false);
  assert.equal(mapped.programRows[0].remainingSourceVerified, false);
  assert.equal(mapped.programRows[0].sourceRemainingAmount, 999);
  assert.equal(mapped.programRows[0].remainingAmount, 300);
  assert.equal(mapped.metrics.programRemainingAmount, 1050);
});

test("missing program remainder column calculates only when payer and collected amounts are valid", () => {
  const csv = withProgramGapColumn("Colonne annexe", "999,00", "999,00");
  const source = parseFinancialCsvText(csv);
  const mapped = mapFinancialDataset(source);
  assert.equal(source.reportModel.programRemainingHeader, "");
  assert.equal(mapped.metrics.programRemainingMeaningConfirmed, false);
  assert.equal(mapped.programRows[0].remainingAmount, 300);
  assert.equal(mapped.metrics.programRemainingAmount, 1050);

  const partialRows = withProgramGapColumn("Colonne annexe", "999,00", "").split("\n").map((line) => line.split(";"));
  const partialProgramRow = partialRows.find((row) => row[0]?.includes("fictive B"));
  partialProgramRow[1] = "";
  const partial = parseFinancialCsvText(partialRows.map((row) => row.join(";")).join("\n"));
  const partialMapped = mapFinancialDataset(partial);
  assert.equal(partialMapped.programRows[1].remainingAmount, null);
});

test("summary source activates with its detected mapping and keeps transaction metrics unavailable", () => {
  const source = parseFinancialCsvText(SUMMARY_CSV);
  const state = dashboardCsvReducer(initialDashboardCsvState, { type: "financial-csv-discovered", source, fileName: "synthetic-summary.csv" });
  assert.equal(state.financialCsv.reportModel !== undefined, true);
  assert.equal(state.financialCsv.mapped.metrics.collectedAmount, 1950);
  assert.equal(state.financialCsv.mapped.metrics.distinctPaymentCount, null);
  assert.equal(state.financialCsv.mapping.monthlyPeriod, "Mois");
  assert.equal(state.financialCsv.fileName, "synthetic-summary.csv");
});

test("summary aggregates retain unavailable values without inventing amounts", () => {
  const fixture = SUMMARY_CSV
    .replace("2 000,00;1 250,00;750,00;62,5%", "montant inconnu;1 250,00;750,00;62,5%")
    .replace("Filière fictive B;2 000,00;1 250,00;750,00;62,5%", "Filière fictive B;;;;");
  const mapped = mapFinancialDataset(parseFinancialCsvText(fixture));
  assert.equal(mapped.monthlyRows[1].plannedAmount, null);
  assert.equal(mapped.monthlyRows[1].collectedAmount, 1250);
  assert.equal(mapped.metrics.plannedAmount, 1000);
  assert.equal(mapped.metrics.collectedAmount, 1950);
  assert.equal(mapped.programRows.length, 1);
  assert.equal(mapped.programRows[0].plannedAmount, 1000);
  assert.equal(mapped.metrics.enrollmentCount, null);
});

test("financial file parsing supports UTF-8 and Windows-1252 CSV encodings", async () => {
  const utf8File = new File(["Montant;État\n10;Réglé"], "utf8.csv", { type: "text/csv" });
  const utf8 = await parseFinancialCsvFile(utf8File);
  assert.equal(utf8.headers[1], "État");
  assert.equal(utf8.rows[0].État, "Réglé");

  const cp1252Bytes = new Uint8Array([0x4d,0x6f,0x6e,0x74,0x61,0x6e,0x74,0x3b,0xc9,0x74,0x61,0x74,0x0a,0x31,0x30,0x3b,0x50,0x61,0x79,0xe9]);
  const windowsFile = new File([cp1252Bytes], "windows.csv", { type: "text/csv" });
  const windows = await parseFinancialCsvFile(windowsFile);
  assert.equal(windows.headers[1], "État");
  assert.equal(windows.rows[0].État, "Payé");

  const utf16Body = Buffer.from("Montant;État\n20;Validé", "utf16le");
  const utf16Bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), utf16Body]);
  const utf16File = new File([utf16Bytes], "utf16.csv", { type: "text/csv" });
  const utf16 = await parseFinancialCsvFile(utf16File);
  assert.equal(utf16.rows[0].État, "Validé");
  await assert.rejects(parseFinancialCsvFile(new File([""], "empty.csv")), /vide/i);
  await assert.rejects(parseFinancialCsvFile(new File(["x"], "notes.txt")), /format incorrect/i);
});

test("financial mapping separates recorded amounts from explicitly confirmed collected revenue", () => {
  const dataset = parseFinancialCsvText(FINANCE_CSV);
  const mapped = mapFinancialDataset(dataset, MAPPING, ["Réglé"]);
  assert.equal(mapped.metrics.totalRecordedAmount, 2531);
  assert.equal(mapped.metrics.confirmedCollectedRevenue, 2501);
  assert.equal(mapped.metrics.distinctPaymentCount, 2);
  assert.equal(mapped.metrics.enrollmentCount, 2);
  assert.equal(mapped.paymentStatuses.find((status) => status.name === "En attente").count, 1);
  assert.equal(mapped.monthly.length, 1);
});

test("financial metrics stay unavailable when amount, status confirmation, or identifiers are missing", () => {
  const dataset = parseFinancialCsvText(FINANCE_CSV);
  const mapped = mapFinancialDataset(dataset, { paymentDate: "Date versement", paymentStatus: "État" }, []);
  assert.equal(mapped.metrics.totalRecordedAmount, null);
  assert.equal(mapped.metrics.confirmedCollectedRevenue, null);
  assert.equal(mapped.metrics.distinctPaymentCount, null);
  assert.equal(mapped.metrics.enrollmentCount, null);
});

test("changing the mapped payment-status column clears prior collected-status confirmation", () => {
  const source = parseFinancialCsvText(`${FINANCE_CSV}\n`);
  const discovered = dashboardCsvReducer(initialDashboardCsvState, { type: "financial-csv-discovered", source, fileName: "finance.csv" });
  const confirmed = dashboardCsvReducer(discovered, { type: "financial-csv-mapped", mapping: MAPPING, confirmedPaymentStatuses: ["Réglé"] });
  const changed = dashboardCsvReducer(confirmed, { type: "financial-csv-mapped", mapping: { ...MAPPING, paymentStatus: "État inscription" }, confirmedPaymentStatuses: ["Réglé"] });
  assert.deepEqual(changed.financialCsv.confirmedPaymentStatuses, []);
  assert.equal(changed.financialCsv.mapped.metrics.confirmedCollectedRevenue, null);
});

test("invalid numeric values, dates, empty files, and headers produce safe results or French errors", () => {
  assert.equal(parseFinancialAmount("1.234,50 DT"), 1234.5);
  assert.equal(parseFinancialAmount("non numérique"), null);
  assert.equal(parseFinancialDate("31/02/2025"), null);
  assert.equal(parseFinancialDate("2025-03-03")?.toISOString(), "2025-03-03T00:00:00.000Z");
  const dataset = parseFinancialCsvText("Somme;Date\ntexte;date invalide\n;\n");
  const mapped = mapFinancialDataset(dataset, { paymentAmount: "Somme", paymentDate: "Date" });
  assert.equal(mapped.metrics.invalidAmountCount, 1);
  assert.equal(mapped.metrics.invalidPaymentDateCount, 1);
  assert.equal(mapped.metrics.totalRecordedAmount, null);
  assert.throws(() => parseFinancialCsvText("   "), /vide/i);
  assert.throws(() => parseFinancialCsvText(""), /vide/i);
  assert.throws(() => parseFinancialCsvText("A;B\n;\n"), /aucune ligne/i);
  assert.throws(() => parseFinancialCsvText("A;B\n\"unfinished;value"), /mal formé/i);
  const unnamed = parseFinancialCsvText(";B\n1;2");
  assert.equal(unnamed.headers[0], "Colonne sans nom 1");
});

test("financial and commercial imports, errors, navigation, and replacement remain independent", () => {
  const source = parseFinancialCsvText(FINANCE_CSV);
  const finance = dashboardCsvReducer(initialDashboardCsvState, { type: "financial-csv-discovered", source, fileName: "finance.csv" });
  const mappedFinance = dashboardCsvReducer(finance, { type: "financial-csv-mapped", mapping: MAPPING, confirmedPaymentStatuses: [] });
  const confirmedFinance = dashboardCsvReducer(mappedFinance, { type: "financial-csv-mapped", mapping: MAPPING, confirmedPaymentStatuses: ["Réglé"] });
  const navigate = dashboardCsvReducer(confirmedFinance, { type: "navigate", page: "revenue" });
  const commercialRow = {
    IDENTITE_LEAD: "fake-id", DATE_AVIS: "2025-03-01", LIB_AVIS: "Avis A", RESPONSABLE: "R",
    LIB_SOURCE_LEAD: "S", EST_CLASSER: "Brut", LIB_ETABLISSEMENT: "E", LIB_REGION: "N",
  };
  const commercialParsed = parseCommercialCsvText(`${REQUIRED_COMMERCIAL_CSV_FIELDS.join(";")}\n${REQUIRED_COMMERCIAL_CSV_FIELDS.map((key) => commercialRow[key]).join(";")}`);
  const both = dashboardCsvReducer(navigate, { type: "csv-imported", parsed: commercialParsed, fileName: "commercial.csv" });
  const replacedFinance = dashboardCsvReducer(both, { type: "financial-csv-discovered", source: parseFinancialCsvText("Montant\n50"), fileName: "finance-remplacement.csv" });
  const failedFinanceReplacement = dashboardCsvReducer(replacedFinance, { type: "financial-csv-failed", message: "Fichier invalide." });

  assert.equal(both.activePage, "revenue");
  assert.equal(both.importedCsv.fileName, "commercial.csv");
  assert.equal(both.financialCsv.fileName, "finance.csv");
  assert.equal(both.financialCsv.mapped.metrics.confirmedCollectedRevenue, 2501);
  assert.equal(replacedFinance.activePage, "revenue");
  assert.equal(replacedFinance.importedCsv.fileName, "commercial.csv");
  assert.equal(replacedFinance.financialCsv.fileName, "finance-remplacement.csv");
  assert.equal(failedFinanceReplacement.importedCsv.fileName, "commercial.csv");
  assert.equal(failedFinanceReplacement.activePage, "revenue");
  assert.equal(failedFinanceReplacement.financialImportError, "Fichier invalide.");
  assert.equal(initialDashboardCsvState.financialCsv, null);
  assert.equal(initialDashboardCsvState.importedCsv, null);
  assert.equal(isFinancialCsvConnected(initialDashboardCsvState), false);
  assert.equal(isFinancialCsvConnected(both), true);
  assert.equal(FINANCIAL_FIELDS.length > 0, true);
});

test("financial import workflow activates and replaces only its own source without navigating", async () => {
  let state = dashboardCsvReducer(initialDashboardCsvState, { type: "navigate", page: "feedback" });
  const dispatch = (action) => { state = dashboardCsvReducer(state, action); };
  const parse = async (file) => file.content;
  assert.equal(await importFinancialCsvWith({ name: "financial-one.csv", content: parseFinancialCsvText(FINANCE_CSV) }, dispatch, parse), true);
  const commercial = parseCommercialCsvText(`${REQUIRED_COMMERCIAL_CSV_FIELDS.join(";")}\n${REQUIRED_COMMERCIAL_CSV_FIELDS.map((key) => ({ IDENTITE_LEAD: "ref", DATE_AVIS: "2025-03-01", LIB_AVIS: "Avis", RESPONSABLE: "R", LIB_SOURCE_LEAD: "S", EST_CLASSER: "Raw", LIB_ETABLISSEMENT: "E", LIB_REGION: "N" })[key]).join(";")}`);
  dispatch({ type: "csv-imported", parsed: commercial, fileName: "commercial.csv" });
  dispatch({ type: "navigate", page: "report" });
  assert.equal(await importFinancialCsvWith({ name: "financial-two.csv", content: parseFinancialCsvText("Montant\n25") }, dispatch, parse), true);
  assert.equal(state.activePage, "report");
  assert.equal(state.financialCsv.fileName, "financial-two.csv");
  assert.equal(state.importedCsv.fileName, "commercial.csv");
  assert.equal(isFinancialCsvConnected(state), true);

  assert.equal(await importFinancialCsvWith({ name: "invalid.csv" }, dispatch, async () => { throw new Error("Fichier vide."); }), false);
  assert.equal(state.activePage, "report");
  assert.equal(state.financialCsv.fileName, "financial-two.csv");
  assert.equal(state.importedCsv.fileName, "commercial.csv");
  assert.equal(state.financialImportError, "Fichier vide.");
});

test("Source C can be imported from the follow-up page without replacing the commercial source", async () => {
  let state = dashboardCsvReducer(initialDashboardCsvState, { type: "navigate", page: "followups" });
  const dispatch = (action) => { state = dashboardCsvReducer(state, action); };
  const commercial = parseCommercialCsvText(`${REQUIRED_COMMERCIAL_CSV_FIELDS.join(";")}\n${REQUIRED_COMMERCIAL_CSV_FIELDS.map((key) => ({ IDENTITE_LEAD: "ref", DATE_AVIS: "2025-03-01", LIB_AVIS: "Avis", RESPONSABLE: "R", LIB_SOURCE_LEAD: "S", EST_CLASSER: "Raw", LIB_ETABLISSEMENT: "E", LIB_REGION: "N" })[key]).join(";")}`);
  dispatch({ type: "csv-imported", parsed: commercial, fileName: "commercial-fixture.csv" });
  const aggregate = parseFinancialCsvText(SUMMARY_CSV);
  assert.equal(await importFinancialCsvWith({ name: "synthetic-source-c.csv", source: aggregate }, dispatch, async (file) => file.source), true);
  assert.equal(state.activePage, "followups");
  assert.equal(state.importedCsv.fileName, "commercial-fixture.csv");
  assert.equal(state.financialCsv.fileName, "synthetic-source-c.csv");
  assert.equal(state.financialCsv.mapped.reportModel, true);
  assert.equal(state.financialCsv.mapped.programRows.length, 2);
});
