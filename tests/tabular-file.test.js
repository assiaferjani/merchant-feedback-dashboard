import test from "node:test";
import assert from "node:assert/strict";
import { utils, write } from "xlsx";
import { readTabularFile } from "../src/tabular-file.js";
import { parseCommercialCsvFile } from "../src/commercial-csv.js";
import { parseFinancialCsvFile } from "../src/financial-csv.js";
import { discoverTuitionCsvFile, mapTuitionRows } from "../src/tuition-data.js";

function fileFromWorkbook(workbook, extension = "xlsx") {
  return new File(
    [write(workbook, { type: "buffer", bookType: extension })],
    `données.${extension}`,
  );
}
function workbookWithRows(rows) {
  const workbook = utils.book_new();
  utils.book_append_sheet(
    workbook,
    utils.aoa_to_sheet(rows, { cellDates: true }),
    "Données",
  );
  return workbook;
}
const commercialRows = [
  [
    "IDENTITE_LEAD",
    "DATE_AVIS",
    "LIB_AVIS",
    "RESPONSABLE",
    "LIB_SOURCE_LEAD",
    "EST_CLASSER",
    "LIB_ETABLISSEMENT",
    "LIB_REGION",
  ],
  [
    "00042",
    new Date("2026-10-01T00:00:00Z"),
    "Très bien ; merci",
    "Équipe",
    "Web",
    "Oui",
    "Campus",
    "Nord",
  ],
];

for (const extension of ["xlsx", "xls", "ods"]) {
  test(`${extension} imports commercial feedback with dates, accents and quoted delimiters`, async () => {
    const result = await parseCommercialCsvFile(
      fileFromWorkbook(workbookWithRows(commercialRows), extension),
    );
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].IDENTITE_LEAD, "00042");
    assert.equal(
      result.rows[0].DATE_AVIS.toISOString().slice(0, 10),
      "2026-10-01",
    );
    assert.equal(result.rows[0].LIB_AVIS, "Très bien ; merci");
    assert.equal(result.rows[0].RESPONSABLE, "Équipe");
    assert.equal(result.sheetName, "Données");
  });
  test(`${extension} preserves financial amounts and student mapping`, async () => {
    const workbook = workbookWithRows([
      [
        "ID Étudiant",
        "Nom",
        "Total à payer",
        "Total payé",
        "Prochaine échéance",
      ],
      [
        "S001",
        "Étudiant fictif",
        1234.56,
        200.25,
        new Date("2026-11-15T00:00:00Z"),
      ],
    ]);
    workbook.Sheets.Données.C2.z = '#,##0.00 "€"';
    const source = await discoverTuitionCsvFile(
      fileFromWorkbook(workbook, extension),
      "students",
    );
    const rows = mapTuitionRows(source);
    assert.equal(source.status, "valid");
    assert.equal(source.sheetName, "Données");
    assert.equal(rows[0].amountDue, 1234.56);
    assert.equal(rows[0].amountPaid, 200.25);
    assert.equal(rows[0].amountRemaining, 1034.31);
    assert.equal(rows[0].nextDueDate.toISOString(), "2026-11-15T00:00:00.000Z");
  });
}

for (const extension of ["tsv", "txt"]) {
  test(`${extension} imports tab-delimited exports through both adapters`, async () => {
    const content = commercialRows
      .map((row) =>
        row
          .map((value) => (value instanceof Date ? "2026-10-01" : value))
          .join("\t"),
      )
      .join("\r\n");
    const file = new File([content], `export.${extension}`);
    const commercial = await parseCommercialCsvFile(file);
    assert.equal(commercial.rows.length, 1);
    assert.equal(commercial.rows[0].LIB_AVIS, "Très bien ; merci");
    const financial = await parseFinancialCsvFile(
      new File(["Montant\tStatut\n12.50\tRéglé"], `export.${extension}`),
    );
    assert.equal(financial.rows[0].Montant, "12.50");
  });
}

test("workbooks skip empty and hidden sheets and report the selected sheet", async () => {
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.aoa_to_sheet([]), "Vide");
  utils.book_append_sheet(
    workbook,
    utils.aoa_to_sheet([["Secret"], [42]]),
    "Masquée",
  );
  utils.book_append_sheet(
    workbook,
    utils.aoa_to_sheet(commercialRows, { cellDates: true }),
    "Avis",
  );
  utils.book_append_sheet(
    workbook,
    utils.aoa_to_sheet([["Autre"], [999]]),
    "Ignorée",
  );
  workbook.Workbook = {
    Sheets: [{ Hidden: 0 }, { Hidden: 1 }, { Hidden: 0 }, { Hidden: 0 }],
  };
  const result = await parseCommercialCsvFile(fileFromWorkbook(workbook));
  assert.equal(result.sheetName, "Avis");
  assert.equal(result.sheetCount, 4);
  assert.equal(result.rows.length, 1);
});

test("formatted numeric identifiers retain leading zeroes, cached formula amounts remain numeric", async () => {
  const workbook = workbookWithRows([
    ["Identifiant", "Montant"],
    [42, 12.5],
  ]);
  workbook.Sheets.Données.A2.z = "00000";
  workbook.Sheets.Données.B2.f = "10+2.5";
  const result = await parseFinancialCsvFile(fileFromWorkbook(workbook));
  assert.equal(result.rows[0].Identifiant, "00042");
  assert.equal(result.rows[0].Montant, "12.5");
});

test("formula errors and missing cached results require correction before import", async () => {
  for (const [cell, message] of [
    [{ t: "n", f: "1+2" }, /résultat enregistré/],
    [{ t: "e", v: 7 }, /erreur de calcul/],
  ]) {
    const workbook = workbookWithRows([["Montant"], [1]]);
    workbook.Sheets.Données.A2 = cell;
    await assert.rejects(readTabularFile(fileFromWorkbook(workbook)), message);
  }
});

test("renamed text, corrupt workbooks and binary data posing as CSV are rejected", async () => {
  await assert.rejects(
    readTabularFile(new File(["A;B\n1;2"], "fake.xlsx")),
    /extension/,
  );
  await assert.rejects(
    readTabularFile(
      new File([new Uint8Array([0x50, 0x4b, 3, 4, 0])], "broken.xlsx"),
    ),
    /classeur/,
  );
  await assert.rejects(
    readTabularFile(new File([new Uint8Array([0, 1, 2, 3])], "binary.csv")),
    /tableau texte/,
  );
});

test("oversized worksheet ranges are rejected before conversion", async () => {
  for (const [range, message] of [
    ["A1:A100002", /100 000/],
    ["A1:SS2", /512 colonnes/],
  ]) {
    const workbook = workbookWithRows([["Montant"], [1]]);
    workbook.Sheets.Données["!ref"] = range;
    await assert.rejects(readTabularFile(fileFromWorkbook(workbook)), message);
  }
});
