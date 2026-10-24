import test from "node:test";
import assert from "node:assert/strict";
import { parseSourceFile } from "../src/source-import.js";
import {
  dashboardCsvReducer,
  initialDashboardCsvState,
} from "../src/dashboard-state.js";
import {
  mapTuitionRows,
  summarizeStudents,
  tuitionSourceQuality,
} from "../src/tuition-data.js";

const header =
  "ID Étudiant;Matricule;Nom;Prénom;Formation;Année universitaire;Total à payer;Total payé;Reste à payer;Taux recouvrement;Jours de retard";
const students = (year) =>
  `${header}\nL1;M001;Fictif;A;Gestion;${year};1 200,50 DT;400,25 DT;800,25 DT;33,34%;0\nL1;M002;Fictif;B;Gestion;${year};900 DT;100 DT;800 DT;11,1%;2\n;M099;;;;;;;;0\n`;
const file = (text, name = "source.csv") => new File([text], name);

test("detects student exports, remaps study levels and excludes template and dashboard footer rows", async () => {
  const source = await parseSourceFile(
    file(
      students("2026/2027") +
        "Total à encaisser;Total encaissé;;;Reste à encaisser\n2100,50;500,25;;;1600,25\nFilière;Total à payer;Total encaissé\nGestion;2100,50;500,25",
    ),
    "auto",
  );
  assert.equal(source.detectedSourceType, "students");
  assert.equal(source.mapping.studentId, "");
  assert.equal(source.mapping.studyLevel, "ID Étudiant");
  assert.equal(source.excludedSummaryRows, 4);
  assert.equal(source.excludedTemplateRows, 1);
  const rows = mapTuitionRows(source);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].studyLevel, "L1");
  assert.ok(Math.abs(rows[0].recoveryRate - 0.3334) < 1e-10);
  assert.equal(summarizeStudents(rows).amountDue, 2100.5);
  assert.equal(tuitionSourceQuality(source).status, "valid");
});

test("annual student files coexist, reimport updates one year, and returning matricules do not duplicate dossiers", async () => {
  const older = await parseSourceFile(
    file(students("2025/2026"), "older.csv"),
    "auto",
  );
  const newer = await parseSourceFile(
    file(students("2026/2027"), "newer.csv"),
    "auto",
  );
  let state = dashboardCsvReducer(initialDashboardCsvState, {
    type: "tuition-csv-discovered",
    source: older,
  });
  state = dashboardCsvReducer(state, {
    type: "tuition-csv-discovered",
    source: newer,
  });
  assert.equal(state.tuitionSources.students.datasets.length, 2);
  assert.equal(state.tuitionSources.students.mappedRows.length, 4);
  assert.equal(
    summarizeStudents(state.tuitionSources.students.mappedRows).amountDue,
    4201,
  );
  assert.equal(state.tuitionSources.students.quality.duplicateIdentifiers, 0);
  const updated = await parseSourceFile(
    file(
      students("2026-2027").replace("1 200,50 DT", "1 300,50 DT"),
      "updated.csv",
    ),
    "auto",
  );
  state = dashboardCsvReducer(state, {
    type: "tuition-csv-discovered",
    source: updated,
  });
  assert.equal(state.tuitionSources.students.datasets.length, 2);
  assert.equal(state.tuitionSources.students.mappedRows.length, 4);
  assert.equal(
    summarizeStudents(state.tuitionSources.students.mappedRows).amountDue,
    4301,
  );
  assert.equal(state.tuitionSources.students.quality.remainingDiscrepancies, 1);
  assert.equal(state.tuitionSources.students.excludedTemplateRows, 2);
});

test("genuine repeated identifiers within one year still block double-counted totals", async () => {
  const source = await parseSourceFile(
    file(students("2026/2027").replace("M002", "M001")),
    "auto",
  );
  assert.equal(summarizeStudents(mapTuitionRows(source)).amountDue, null);
  assert.equal(tuitionSourceQuality(source).duplicateIdentifiers, 1);
});

test("recognizes financial dashboards and feedback exports and explains a mismatched manual selection", async () => {
  const financial = file(
    "Mois;Montant prévu;Montant collecté;Écart\noctobre 2026;100;40;60\n",
    "dashboard.csv",
  );
  assert.equal(
    (await parseSourceFile(financial, "auto")).detectedSourceType,
    "financial",
  );
  await assert.rejects(
    parseSourceFile(financial, "students"),
    /synthèse financière/,
  );
  const feedback = file(
    "IDENTITE_LEAD;DATE_AVIS;LIB_AVIS;RESPONSABLE;LIB_SOURCE_LEAD;EST_CLASSER;LIB_ETABLISSEMENT;LIB_REGION\nREF1;2026-01-01;Avis;Équipe;Web;Oui;Site;Nord",
  );
  assert.equal(
    (await parseSourceFile(feedback, "auto")).detectedSourceType,
    "commercial",
  );
  await assert.rejects(
    parseSourceFile(file("Inconnu;Valeur\nA;1"), "auto"),
    /Type de données non reconnu/,
  );
});
