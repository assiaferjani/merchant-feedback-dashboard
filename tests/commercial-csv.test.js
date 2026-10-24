import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMERCIAL_CSV_FIELDS,
  MISSING_RESPONSIBLE_FILTER,
  REQUIRED_COMMERCIAL_CSV_FIELDS,
  createImportedCsvSource,
  filterCommercialCsv,
  groupCommercialCrossTab,
  groupCommercialCsv,
  parseCommercialCsvFile,
  parseCommercialDate,
  parseCommercialCsvText,
  resolveCommercialSourceState,
  summarizeCommercialCsv,
} from "../src/commercial-csv.js";

const header = COMMERCIAL_CSV_FIELDS.join(";");
const line = (values) =>
  COMMERCIAL_CSV_FIELDS.map((field) => values[field] ?? "").join(";");

test("semicolon CSV maps approved columns, trims values, and parses French date-times", () => {
  const result = parseCommercialCsvText(
    `${header}\n${line({ IDENTITE_LEAD: "  ref-1 ", ANNEE_LEAD: "2025", MOIS_LEAD: "3", LIB_AVIS: " Avis A ", DATE_AVIS: "15/03/2025 09:30:00", RESPONSABLE: " Équipe A ", COMMENTAIRE_LEAD_AVIS: " Note ", LIB_REGION: " Nord " })}`,
  );
  assert.equal(result.rows.length, 1);
  assert.deepEqual(Object.keys(result.rows[0]), COMMERCIAL_CSV_FIELDS);
  assert.equal(result.rows[0].IDENTITE_LEAD, "ref-1");
  assert.equal(result.rows[0].LIB_AVIS, "Avis A");
  assert.equal(result.rows[0].RESPONSABLE, "Équipe A");
  assert.equal(result.rows[0].ANNEE_LEAD, 2025);
  assert.equal(
    result.rows[0].DATE_AVIS.toISOString(),
    "2025-03-15T09:30:00.000Z",
  );
});

test("commercial import detects comma separators, header preambles, BOM, and padded header labels", () => {
  const fields = REQUIRED_COMMERCIAL_CSV_FIELDS.map((field) =>
    field.replaceAll("_", " ").toLowerCase(),
  );
  const csv = [
    "Export local",
    `\uFEFF${fields.join(",")}`,
    'fixture,2025-03-15,"Avis, à vérifier",équipe a,Web,Oui,Site A,Nord',
  ].join("\n");
  const result = parseCommercialCsvText(csv);
  assert.equal(result.delimiter, ",");
  assert.equal(result.headerRow, 1);
  assert.equal(result.rows[0].IDENTITE_LEAD, "fixture");
  assert.equal(result.rows[0].LIB_AVIS, "Avis, à vérifier");
  assert.equal(result.rows[0].RESPONSABLE, "équipe a");
});

test("commercial file importer decodes Windows-1252 locally", async () => {
  const csv = `${REQUIRED_COMMERCIAL_CSV_FIELDS.join(";")}\nfixture;2025-03-15;Avis;Équipe;Web;Oui;Site A;Nord`;
  const encoded = Buffer.from(csv, "latin1");
  const arrayBuffer = encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength,
  );
  const result = await parseCommercialCsvFile({
    name: "fixture.csv",
    size: encoded.byteLength,
    arrayBuffer: async () => arrayBuffer,
  });
  assert.equal(result.rows[0].RESPONSABLE, "Équipe");
  assert.equal(
    result.rows[0].DATE_AVIS.toISOString().slice(0, 10),
    "2025-03-15",
  );
});

test("the eight confirmed source headers are sufficient when optional mapped columns are absent", () => {
  const values = {
    IDENTITE_LEAD: "ref-8",
    DATE_AVIS: "2025-03-15",
    LIB_AVIS: "À rappeler",
    RESPONSABLE: "Équipe A",
    LIB_SOURCE_LEAD: "Web",
    EST_CLASSER: "Oui",
    LIB_ETABLISSEMENT: "Site A",
    LIB_REGION: "Nord",
  };
  const result = parseCommercialCsvText(
    `${REQUIRED_COMMERCIAL_CSV_FIELDS.join(";")}\n${REQUIRED_COMMERCIAL_CSV_FIELDS.map((field) => values[field]).join(";")}`,
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].IDENTITE_LEAD, "ref-8");
  assert.equal(result.rows[0].COMMENTAIRE_LEAD_AVIS, null);
  assert.equal(result.rows[0].ANNEE_LEAD, null);
});

test("a successfully parsed CSV activates the local source and suppresses the no-source empty state", () => {
  const parsed = parseCommercialCsvText(
    `${REQUIRED_COMMERCIAL_CSV_FIELDS.join(";")}\nref-1;2025-01-01;Avis;Équipe;Web;Oui;Site;Nord`,
  );
  const source = createImportedCsvSource(parsed, "local.csv");
  const state = resolveCommercialSourceState({ importedCsv: source });
  assert.equal(source.kind, "local-csv");
  assert.equal(state.kind, "local-csv");
  assert.equal(state.hasSource, true);
  assert.equal(state.showNoSourceMessage, false);
});

test("the no-source empty state appears only when neither a valid CSV nor bundle is active", () => {
  assert.equal(resolveCommercialSourceState({}).showNoSourceMessage, true);
  assert.equal(
    resolveCommercialSourceState({
      importedCsv: { kind: "local-csv", rows: [] },
    }).showNoSourceMessage,
    true,
  );
  assert.equal(
    resolveCommercialSourceState({ bundle: {} }).showNoSourceMessage,
    false,
  );
});

test("ISO offset dates preserve their written calendar day for business date filters", () => {
  const { rows } = parseCommercialCsvText(
    `${header}\n${line({ DATE_AVIS: "2025-03-15T10:30:00+01:00" })}`,
  );
  assert.equal(rows[0].DATE_AVIS.toISOString(), "2025-03-15T10:30:00.000Z");
  const nextMidnight = parseCommercialCsvText(
    `${header}\n${line({ DATE_AVIS: "2025-03-15T00:15:00+02:00" })}`,
  ).rows[0].DATE_AVIS;
  assert.equal(nextMidnight.toISOString(), "2025-03-15T00:15:00.000Z");
});

test("ISO timestamps with seven fractional-second digits parse without shifting their source day", () => {
  const parsed = parseCommercialDate("2025-03-15 00:04:12.1234567");
  assert.equal(parsed.toISOString(), "2025-03-15T00:04:12.123Z");
  assert.equal(
    parseCommercialDate("2025-03-15 00:04:12.123456789").toISOString(),
    "2025-03-15T00:04:12.123Z",
  );
  assert.equal(parseCommercialDate("2025-03-15 00:04:12.1234567890"), null);
  assert.equal(parseCommercialDate("2025-02-31 00:04:12.1234567"), null);
  assert.equal(parseCommercialDate("2025-03-15 24:04:12.1234567"), null);

  const { rows, invalidDates } = parseCommercialCsvText(
    `${header}\n${line({ IDENTITE_LEAD: "fixture", DATE_AVIS: "2025-03-15 00:04:12.1234567" })}`,
  );
  assert.equal(invalidDates, 0);
  assert.equal(
    filterCommercialCsv(rows, {
      startDate: "2025-03-15",
      endDate: "2025-03-15",
    }).length,
    1,
  );
});

test("French day-month and ISO date-only formats are parsed without rollover", () => {
  const rows = ["15-03-2025", "2025-03-16", "31/02/2025"].map(
    (DATE_AVIS) =>
      parseCommercialCsvText(`${header}\n${line({ DATE_AVIS })}`).rows[0]
        .DATE_AVIS,
  );
  assert.equal(rows[0].toISOString(), "2025-03-15T00:00:00.000Z");
  assert.equal(rows[1].toISOString(), "2025-03-16T00:00:00.000Z");
  assert.equal(rows[2], null);
});

test("candidate identities are counted distinctly while avis/status groups count source rows", () => {
  const { rows } = parseCommercialCsvText(
    [
      header,
      line({
        IDENTITE_LEAD: "same",
        LIB_AVIS: "À rappeler",
        DATE_AVIS: "2025-01-01",
        LIB_SOURCE_LEAD: "Web",
      }),
      line({
        IDENTITE_LEAD: "same",
        LIB_AVIS: "Inscription",
        DATE_AVIS: "2025-01-02",
        LIB_SOURCE_LEAD: "Web",
      }),
      line({
        IDENTITE_LEAD: "other",
        LIB_AVIS: "À rappeler",
        DATE_AVIS: "2025-02-02",
        LIB_SOURCE_LEAD: "Salon",
      }),
    ].join("\n"),
  );
  const summary = summarizeCommercialCsv(rows);
  assert.equal(summary.distinctCandidates, 2);
  assert.equal(summary.totalAvis, 3);
  assert.deepEqual(summary.avisByCategory, [
    { name: "À rappeler", count: 2 },
    { name: "Inscription", count: 1 },
  ]);
  assert.deepEqual(summary.avisBySource, [
    { name: "Web", count: 2 },
    { name: "Salon", count: 1 },
  ]);
  assert.equal(
    summary.monthlyAvis.reduce((sum, item) => sum + item.count, 0),
    3,
  );
});

test("commercial/category cross-tab preserves filtered row totals and groups only display overflow", () => {
  const { rows } = parseCommercialCsvText(
    [
      header,
      line({ IDENTITE_LEAD: "a", RESPONSABLE: "Équipe A", LIB_AVIS: "Avis 1" }),
      line({ IDENTITE_LEAD: "b", RESPONSABLE: "Équipe A", LIB_AVIS: "Avis 1" }),
      line({ IDENTITE_LEAD: "c", RESPONSABLE: "Équipe B", LIB_AVIS: "Avis 2" }),
      line({ IDENTITE_LEAD: "d", RESPONSABLE: "Équipe B", LIB_AVIS: "Avis 3" }),
    ].join("\n"),
  );
  const chart = groupCommercialCrossTab(rows, "RESPONSABLE", "LIB_AVIS", 1);
  assert.deepEqual(chart.series, ["Avis 1", "Autres (affichage)"]);
  assert.equal(
    chart.rows.reduce(
      (total, row) =>
        total + chart.series.reduce((sum, key) => sum + row[key], 0),
      0,
    ),
    rows.length,
  );
  assert.deepEqual(
    chart.rows.map((row) => row.name),
    ["Équipe A", "Équipe B"],
  );
  assert.equal(chart.rows[1]["Autres (affichage)"], 2);
});

test("blank identity/date values stay missing and invalid dates are excluded from dated periods", () => {
  const { rows, invalidDates } = parseCommercialCsvText(
    [
      header,
      line({
        IDENTITE_LEAD: "",
        LIB_AVIS: "Classement",
        DATE_AVIS: "31/02/2025",
        LIB_REGION: "Centre",
      }),
      line({
        IDENTITE_LEAD: "x",
        LIB_AVIS: "Contact",
        DATE_AVIS: "2025-02-28",
        LIB_REGION: "Centre",
      }),
    ].join("\n"),
  );
  assert.equal(invalidDates, 1);
  assert.equal(rows[0].IDENTITE_LEAD, null);
  assert.equal(rows[0].DATE_AVIS, null);
  assert.equal(summarizeCommercialCsv(rows).distinctCandidates, 1);
  assert.equal(
    filterCommercialCsv(rows, {
      startDate: "2025-02-01",
      endDate: "2025-02-28",
    }).length,
    1,
  );
});

test("CSV dashboard filters combine the global date with establishment, region, and raw category", () => {
  const { rows } = parseCommercialCsvText(
    [
      header,
      line({
        IDENTITE_LEAD: "a",
        DATE_AVIS: "2025-01-05",
        LIB_ETABLISSEMENT: "Site A",
        LIB_REGION: "Nord",
        LIB_AVIS: "À traiter",
      }),
      line({
        IDENTITE_LEAD: "b",
        DATE_AVIS: "2025-01-06",
        LIB_ETABLISSEMENT: "Site A",
        LIB_REGION: "Sud",
        LIB_AVIS: "À traiter",
      }),
      line({
        IDENTITE_LEAD: "c",
        DATE_AVIS: "2025-02-05",
        LIB_ETABLISSEMENT: "Site B",
        LIB_REGION: "Nord",
        LIB_AVIS: "À traiter",
      }),
    ].join("\n"),
  );
  const selected = filterCommercialCsv(rows, {
    startDate: "2025-01-01",
    endDate: "2025-01-31",
    establishment: "Site A",
    region: "Nord",
    category: "À traiter",
  });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].IDENTITE_LEAD, "a");
});

test("commercial filter combines period and distinct responsible values, including missing values", () => {
  const { rows } = parseCommercialCsvText(
    [
      header,
      line({
        IDENTITE_LEAD: "a",
        DATE_AVIS: "2025-01-05",
        RESPONSABLE: "Équipe A",
        LIB_AVIS: "Avis A",
      }),
      line({
        IDENTITE_LEAD: "b",
        DATE_AVIS: "2025-01-06",
        RESPONSABLE: "Équipe B",
        LIB_AVIS: "Avis B",
      }),
      line({
        IDENTITE_LEAD: "c",
        DATE_AVIS: "2025-02-05",
        RESPONSABLE: "Équipe A",
        LIB_AVIS: "Avis C",
      }),
      line({
        IDENTITE_LEAD: "d",
        DATE_AVIS: "2025-01-08",
        RESPONSABLE: "",
        LIB_AVIS: "Avis D",
      }),
    ].join("\n"),
  );
  assert.equal(
    filterCommercialCsv(rows, {
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      responsible: "Équipe A",
    }).length,
    1,
  );
  assert.equal(
    filterCommercialCsv(rows, {
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      responsible: "Équipe B",
    }).length,
    1,
  );
  const missing = filterCommercialCsv(rows, {
    startDate: "2025-01-01",
    endDate: "2025-01-31",
    responsible: MISSING_RESPONSIBLE_FILTER,
  });
  assert.equal(missing.length, 1);
  assert.equal(missing[0].IDENTITE_LEAD, "d");
});

test("date bounds are inclusive, one-sided periods are explicit, and invalid ranges return no rows", () => {
  const { rows } = parseCommercialCsvText(
    [
      header,
      line({
        IDENTITE_LEAD: "before",
        DATE_AVIS: "2024-12-31T23:59:59",
        RESPONSABLE: "A",
      }),
      line({
        IDENTITE_LEAD: "first",
        DATE_AVIS: "2025-01-01T00:00:00",
        RESPONSABLE: "A",
      }),
      line({
        IDENTITE_LEAD: "last",
        DATE_AVIS: "31/01/2025 23:59:59",
        RESPONSABLE: "A",
      }),
      line({
        IDENTITE_LEAD: "after",
        DATE_AVIS: "2025-02-01T00:00:00",
        RESPONSABLE: "A",
      }),
      line({ IDENTITE_LEAD: "missing", DATE_AVIS: "", RESPONSABLE: "A" }),
    ].join("\n"),
  );
  const january = filterCommercialCsv(rows, {
    startDate: "2025-01-01",
    endDate: "2025-01-31",
  });
  assert.deepEqual(
    january.map((row) => row.IDENTITE_LEAD),
    ["first", "last"],
  );
  assert.deepEqual(
    filterCommercialCsv(rows, {
      startDate: "2024-12-31",
      endDate: "2025-01-01",
    }).map((row) => row.IDENTITE_LEAD),
    ["before", "first"],
  );
  assert.deepEqual(
    filterCommercialCsv(rows, {
      startDate: "2025-01-31",
      endDate: "2025-01-31",
    }).map((row) => row.IDENTITE_LEAD),
    ["last"],
  );
  assert.deepEqual(
    filterCommercialCsv(rows, { startDate: "2025-01-01" }).map(
      (row) => row.IDENTITE_LEAD,
    ),
    ["first", "last", "after"],
  );
  assert.deepEqual(
    filterCommercialCsv(rows, { endDate: "2024-12-31" }).map(
      (row) => row.IDENTITE_LEAD,
    ),
    ["before"],
  );
  assert.deepEqual(
    filterCommercialCsv(rows, {
      startDate: "2025-02-01",
      endDate: "2025-01-01",
    }),
    [],
  );
  assert.deepEqual(
    filterCommercialCsv(rows, {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    }),
    [],
  );
  assert.equal(
    filterCommercialCsv(rows, {}).length,
    5,
    "missing dates remain visible when there is no date constraint",
  );
  const invalidDate = {
    ...rows[0],
    IDENTITE_LEAD: "invalid-date-object",
    DATE_AVIS: new Date(Number.NaN),
  };
  assert.equal(filterCommercialCsv([invalidDate], {}).length, 1);
  assert.deepEqual(
    filterCommercialCsv([invalidDate], { startDate: "2024-01-01" }),
    [],
  );
});

test("monthly summary is empty when every source date is invalid or missing", () => {
  const { rows, invalidDates } = parseCommercialCsvText(
    [
      header,
      line({ DATE_AVIS: "31/02/2025", RESPONSABLE: "Équipe A" }),
      line({ DATE_AVIS: "", RESPONSABLE: "Équipe B" }),
    ].join("\n"),
  );
  const summary = summarizeCommercialCsv(rows);
  assert.equal(invalidDates, 2);
  assert.equal(summary.totalAvis, 2);
  assert.deepEqual(summary.monthlyAvis, []);
});

test("unmapped and blank status values remain raw instead of being assigned meaning", () => {
  const { rows } = parseCommercialCsvText(
    [
      header,
      line({ LIB_AVIS: "À classer", DATE_AVIS: "2025-01-01" }),
      line({ LIB_AVIS: "À classer", DATE_AVIS: "2025-01-02" }),
      line({ LIB_AVIS: "", DATE_AVIS: "2025-01-03" }),
    ].join("\n"),
  );
  assert.deepEqual(groupCommercialCsv(rows, "LIB_AVIS"), [
    { name: "À classer", count: 2 },
    { name: "Non renseigné", count: 1 },
  ]);
});

test("empty files, empty data, and missing required columns provide French errors", () => {
  assert.throws(() => parseCommercialCsvText("  "), /vide/i);
  assert.throws(
    () => parseCommercialCsvText(header),
    /aucune ligne de données/i,
  );
  assert.throws(
    () => parseCommercialCsvText("IDENTITE_LEAD;DATE_AVIS\na;2025-01-01"),
    /Colonnes manquantes/i,
  );
});

test("file selection rejects unsupported and zero-byte files before parsing", async () => {
  await assert.rejects(
    parseCommercialCsvFile({ name: "export.pdf", size: 42 }),
    /Format non pris en charge/i,
  );
  await assert.rejects(
    parseCommercialCsvFile({ name: "export.csv", size: 0 }),
    /fichier est vide/i,
  );
});

test("CSV file parsing handles common Windows, macOS, Ubuntu, and UTF-16 exports", async (t) => {
  const values = [
    "ref-1",
    "2026-01-01",
    "Avis",
    "Équipe",
    "Web",
    "Oui",
    "Site A",
    "Nord",
  ];
  const content = (separator, newline) =>
    REQUIRED_COMMERCIAL_CSV_FIELDS.join(separator) +
    newline +
    values.join(separator);
  const utf16 = Buffer.from(content(";", "\r\n"), "utf16le");
  const samples = [
    [
      "Windows UTF-8 BOM and CRLF",
      Buffer.from("\uFEFF" + content(";", "\r\n")),
    ],
    ["macOS UTF-8 comma and LF", Buffer.from(content(",", "\n"))],
    ["Ubuntu UTF-8 semicolon and LF", Buffer.from(content(";", "\n"))],
    [
      "UTF-16 little-endian BOM",
      Buffer.concat([Buffer.from([0xff, 0xfe]), utf16]),
    ],
    [
      "UTF-16 big-endian BOM",
      Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(utf16).swap16()]),
    ],
  ];
  for (const [name, bytes] of samples)
    await t.test(name, async () => {
      const result = await parseCommercialCsvFile(
        new File([bytes], "export.CSV", { type: "application/octet-stream" }),
      );
      assert.equal(result.rows.length, 1);
      assert.equal(result.rows[0].RESPONSABLE, "Équipe");
      assert.equal(
        result.rows[0].DATE_AVIS.toISOString().slice(0, 10),
        "2026-01-01",
      );
    });
});
