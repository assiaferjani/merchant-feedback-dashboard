import test from "node:test";
import assert from "node:assert/strict";
import { discoverTuitionCsvText, mapTuitionRows, summarizeStudents, summarizeSchedule, groupTuitionByFormation, tuitionSourceQuality } from "../src/tuition-data.js";
import { parseFinancialCsvText } from "../src/financial-csv.js";

test("discovers a student source after a preamble and maps accented headers", () => {
  const source = discoverTuitionCsvText("Export local\nGénéré pour test\nID Étudiant;Matricule;Nom;Prénom;Formation;Total à payer;Total payé;Reste à payer;Prochaine échéance\nS-1;M-1;Test;Fictif;Sciences;1 200,50;400,50;800,00;2026-09-15\n", "students");
  assert.equal(source.status, "valid");
  assert.equal(source.preambleRows, 2);
  const rows = mapTuitionRows(source);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amountDue, 1200.5);
  assert.equal(rows[0].nextDueDate.toISOString().slice(0, 10), "2026-09-15");
});

test("missing key columns leave student source incomplete and eligible for manual mapping", () => {
  const source = discoverTuitionCsvText("Nom;Formation\nTest;Sciences\n", "students");
  assert.equal(source.status, "incomplete");
  assert.deepEqual(source.missingRequired, ["ID Étudiant ou Matricule"]);
  assert.equal(mapTuitionRows(source).length, 0);
});

test("student counts are distinct and duplicate identifiers suppress potentially double-counted amounts", () => {
  const rows = [
    { studentId: "S1", matricule: "M1", amountDue: 100, amountPaid: 40, amountRemaining: 60 },
    { studentId: "S1", matricule: "M1", amountDue: 100, amountPaid: 40, amountRemaining: 60 },
    { matricule: "M2", amountDue: 200, amountPaid: 100, amountRemaining: 100 },
  ];
  const summary = summarizeStudents(rows);
  assert.equal(summary.distinctStudents, 2);
  assert.equal(summary.duplicateIdentifiers, true);
  assert.equal(summary.amountDue, null);
  assert.equal(summary.amountPaid, null);
});

test("formation counts and overdue student counts use distinct identifiers", () => {
  const rows = [
    { studentId: "S1", formation: "Sciences", daysOverdue: 4, amountDue: 100, amountPaid: 20, amountRemaining: 80 },
    { studentId: "S1", formation: "Sciences", daysOverdue: 2, amountDue: 100, amountPaid: 20, amountRemaining: 80 },
    { studentId: "S2", formation: "Sciences", daysOverdue: 0, amountDue: 200, amountPaid: 50, amountRemaining: 150 },
  ];
  assert.equal(summarizeStudents(rows).overdueStudents, 1);
  assert.equal(groupTuitionByFormation(rows, [])[0].studentCount, 2);
});

test("partial missing financial values make global sums unavailable rather than partial totals", () => {
  const summary = summarizeStudents([
    { studentId: "S1", amountDue: 100, amountPaid: 20, amountRemaining: 80 },
    { studentId: "S2", amountDue: null, amountPaid: 10, amountRemaining: null },
  ]);
  assert.equal(summary.distinctStudents, 2);
  assert.equal(summary.amountDue, null);
  assert.equal(summary.amountPaid, 30);
  assert.equal(summary.amountRemaining, null);
});

test("schedule status values remain raw and student linkage never duplicates payment totals", () => {
  const source = discoverTuitionCsvText("ID Échéance;Matricule;Formation;Date d'échéance;Montant prévu;Montant payé;Statut;Date paiement;Mode règlement;Reste échéance;Jours retard\nE1;M1;Sciences;2026-08-01;500;200;Partiellement réglée;2026-08-02;Carte;300;0\nE2;MISSING;Sciences;2026-09-01;300;0;Échu; ;Virement;300;5\n", "schedule");
  const rows = mapTuitionRows(source);
  const summary = summarizeSchedule(rows, [{ studentId: "S1", matricule: "M1" }]);
  assert.equal(summary.count, 2);
  assert.equal(summary.planned, 800);
  assert.equal(summary.paid, 200);
  assert.equal(summary.linkedRows, 1);
  assert.equal(summary.unlinkedRows, 1);
  assert.deepEqual(summary.statuses.map((row) => row.label).sort(), ["Partiellement réglée", "Échu"].sort());
  assert.equal(groupTuitionByFormation([], rows)[0].scheduleCount, 2);
});

test("general totals are not treated as student or installment details", () => {
  const source = discoverTuitionCsvText("ID Échéance;Matricule;Date d'échéance;Montant prévu;Montant payé\nE1;M1;2026-08-01;100;50\nTotal général;; ;100;50\n", "schedule");
  assert.equal(mapTuitionRows(source).length, 1);
});

test("source C remains a separate aggregate with grand-total rows excluded", () => {
  const csv = "Pay\u00e9es;Mois;Montant pr\u00e9vu;Montant collect\u00e9;\u00c9cart\n2;janv-26;100;40;60\nTotal g\u00e9n\u00e9ral;;100;40;60\n\nFili\u00e8re;Total \u00e0 payer;Total encaiss\u00e9;\u00c9cart\nSciences;100;40;60\nTotal g\u00e9n\u00e9ral;100;40;60";
  const source = parseFinancialCsvText(csv);
  assert.equal(source.reportModel.monthlyRows.length, 1, JSON.stringify({ headers: source.headers, monthly: source.reportModel.monthlyRows.map((row) => row.period), excluded: source.reportModel.excludedMonthlyTotalRows }));
  assert.equal(source.reportModel.programRows.length, 1);
  assert.equal(source.reportModel.excludedMonthlyTotalRows, 1);
  assert.equal(source.reportModel.excludedProgramTotalRows, 1);
});

test("invalid dates and amounts are counted as quality issues without being converted to zero", () => {
  const source = discoverTuitionCsvText("ID Étudiant;Total à payer;Prochaine échéance\nS1;montant inconnu;31/02/2026\n", "students");
  const mapped = mapTuitionRows(source);
  assert.equal(mapped[0].amountDue, null);
  assert.equal(mapped[0].nextDueDate, null);
  const quality = tuitionSourceQuality(source, mapped);
  assert.equal(quality.status, "incomplete");
  assert.equal(quality.invalidAmounts, 1);
  assert.equal(quality.invalidDates, 1);
});

test("duplicate installment identifiers disable sums and distinct count stays deduplicated", () => {
  const summary = summarizeSchedule([
    { installmentId: "E1", plannedAmount: 100, paidAmount: 50, remainingAmount: 50 },
    { installmentId: "E1", plannedAmount: 100, paidAmount: 50, remainingAmount: 50 },
  ]);
  assert.equal(summary.count, 1);
  assert.equal(summary.rowCount, 2);
  assert.equal(summary.duplicateIds, true);
  assert.equal(summary.planned, null);
  assert.equal(summary.paid, null);
});

test("payment method and settlement method reference lists remain separate", () => {
  const source = discoverTuitionCsvText("Modes de paiement;Statuts échéance;Formations;Années universitaires;Campus;Modes règlement\nCarte;Payée;Sciences;2026-2027;Nord;Virement", "references");
  const rows = mapTuitionRows(source);
  assert.equal(rows[0].paymentMethods, "Carte");
  assert.equal(rows[0].settlementMethods, "Virement");
  assert.notEqual(rows[0].paymentMethods, rows[0].settlementMethods);
});

test("unrecognized reference headers can be mapped manually without merging the two payment lists", () => {
  const source = discoverTuitionCsvText(["Modes de règlement proposés;Moyens de paiement", "Virement;Carte"].join("\n"), "references");
  const rows = mapTuitionRows(source, { settlementMethods: "Modes de règlement proposés", paymentMethods: "Moyens de paiement" });
  assert.equal(rows[0].settlementMethods, "Virement");
  assert.equal(rows[0].paymentMethods, "Carte");
  assert.notEqual(rows[0].settlementMethods, rows[0].paymentMethods);
});
