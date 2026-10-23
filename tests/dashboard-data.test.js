import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  filterFeedback,
  getRecentComments,
  groupByDay,
  groupByField,
  groupByMonth,
  parseFeedbackCsv,
  summarizeFeedback,
} from "../src/dashboard-data.js";

const csv = readFileSync(
  resolve("data/merchant_feedback_synthetic.csv"),
  "utf8",
);
const rows = parseFeedbackCsv(csv);

test("synthetic CSV loads with the expected source schema and baseline counts", () => {
  assert.equal(rows.length, 720);
  assert.equal(summarizeFeedback(rows).establishments, 12);
  assert.equal(summarizeFeedback(rows).regions, 6);
  assert.equal(summarizeFeedback(rows).comments, 694);
  assert.equal(summarizeFeedback(rows).commentCoverage, 694 / 720);
});

test("comment coverage uses nonblank comments while retaining blank rows in total", () => {
  const filtered = rows.filter((row) => row.COMMENTAIRE_LEAD_AVIS.trim());
  const summary = summarizeFeedback(filtered);
  assert.equal(summary.total, summary.comments);
  assert.equal(summary.commentCoverage, 1);
});

test("filters combine dates, establishment, region, and raw feedback category", () => {
  const match = rows[0];
  const selected = filterFeedback(rows, {
    startDate: match.DATE_AVIS.toISOString().slice(0, 10),
    endDate: match.DATE_AVIS.toISOString().slice(0, 10),
    establishment: match.LIB_ETABLISSEMENT,
    region: match.LIB_REGION,
    category: match.LIB_AVIS,
  });
  assert.ok(selected.length > 0);
  assert.ok(
    selected.every((row) =>
      row.DATE_AVIS.toISOString().startsWith(
        match.DATE_AVIS.toISOString().slice(0, 10),
      ),
    ),
  );
  assert.ok(
    selected.every(
      (row) =>
        row.LIB_ETABLISSEMENT === match.LIB_ETABLISSEMENT &&
        row.LIB_REGION === match.LIB_REGION &&
        row.LIB_AVIS === match.LIB_AVIS,
    ),
  );
});

test("commercial responsible filter applies alongside shared period and handles missing values", () => {
  const sample = [
    {
      ...rows[0],
      DATE_AVIS: new Date("2025-03-01T00:00:00Z"),
      RESPONSABLE: "Équipe A",
    },
    {
      ...rows[1],
      DATE_AVIS: new Date("2025-03-02T00:00:00Z"),
      RESPONSABLE: "Équipe B",
    },
    {
      ...rows[2],
      DATE_AVIS: new Date("2025-04-01T00:00:00Z"),
      RESPONSABLE: "Équipe A",
    },
    {
      ...rows[3],
      DATE_AVIS: new Date("2025-03-03T00:00:00Z"),
      RESPONSABLE: null,
    },
  ];
  const selected = filterFeedback(sample, {
    startDate: "2025-03-01",
    endDate: "2025-03-31",
    responsible: "Équipe B",
  });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].RESPONSABLE, "Équipe B");
  const missing = filterFeedback(sample, {
    startDate: "2025-03-01",
    endDate: "2025-03-31",
    responsible: "__MISSING_RESPONSABLE__",
  });
  assert.equal(missing.length, 1);
  assert.equal(missing[0].RESPONSABLE, null);
});

test("synthetic CSV parser safely retains missing or impossible dates as null", () => {
  const malformedDateCsv = csv.replace(
    /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
    "2025-02-31 12:00:00",
  );
  const parsed = parseFeedbackCsv(malformedDateCsv);
  assert.equal(parsed.length, 720);
  assert.equal(parsed[0].DATE_AVIS, null);
  assert.equal(
    groupByMonth(parsed).reduce((total, bucket) => total + bucket.count, 0),
    719,
  );
});

test("chart groups preserve totals and sort categories by volume", () => {
  assert.equal(
    groupByDay(rows).reduce((sum, bucket) => sum + bucket.count, 0),
    rows.length,
  );
  assert.equal(
    groupByMonth(rows).reduce((sum, bucket) => sum + bucket.count, 0),
    rows.length,
  );
  const categories = groupByField(rows, "LIB_AVIS");
  assert.equal(
    categories.reduce((sum, bucket) => sum + bucket.count, 0),
    rows.length,
  );
  assert.ok(categories[0].count >= categories.at(-1).count);
});

test("recent-comments table excludes blanks and sorts newest first", () => {
  const recent = getRecentComments(rows, 12);
  assert.equal(recent.length, 12);
  assert.ok(recent.every((row) => row.COMMENTAIRE_LEAD_AVIS.trim()));
  assert.ok(
    recent.every(
      (row, index) =>
        index === 0 || recent[index - 1].DATE_AVIS >= row.DATE_AVIS,
    ),
  );
});

test("CSV schema mismatch is rejected", () => {
  assert.throws(
    () => parseFeedbackCsv("wrong,headers\na,b\n"),
    /schema mismatch/i,
  );
});

test("partially mapped imported rows with missing comments or invalid dates do not break dashboard sections", () => {
  const imported = [
    {
      DATE_AVIS: null,
      COMMENTAIRE_LEAD_AVIS: null,
      LIB_ETABLISSEMENT: "Site A",
      LIB_REGION: "Nord",
      LIB_AVIS: "À traiter",
    },
    {
      DATE_AVIS: new Date("2025-02-03T10:00:00Z"),
      COMMENTAIRE_LEAD_AVIS: null,
      LIB_ETABLISSEMENT: "Site A",
      LIB_REGION: "Nord",
      LIB_AVIS: "À traiter",
    },
  ];
  assert.equal(summarizeFeedback(imported).total, 2);
  assert.equal(summarizeFeedback(imported).comments, 0);
  assert.equal(
    groupByDay(imported).reduce((total, row) => total + row.count, 0),
    1,
  );
  assert.equal(
    groupByMonth(imported).reduce((total, row) => total + row.count, 0),
    1,
  );
  assert.equal(getRecentComments(imported).length, 0);
  assert.equal(
    filterFeedback(imported, { startDate: "2025-02-01", endDate: "2025-02-28" })
      .length,
    1,
  );
});

test("all-comments export retains comments with missing dates while recent dated comments stay separate", async () => {
  const { getAllComments, getRecentComments } =
    await import("../src/dashboard-data.js");
  const rows = [
    { DATE_AVIS: null, COMMENTAIRE_LEAD_AVIS: "Sans date" },
    { DATE_AVIS: new Date("2026-01-01"), COMMENTAIRE_LEAD_AVIS: "Daté" },
    { DATE_AVIS: null, COMMENTAIRE_LEAD_AVIS: " " },
  ];
  assert.equal(getAllComments(rows).length, 2);
  assert.equal(getRecentComments(rows).length, 1);
  assert.equal(getAllComments(rows)[1].COMMENTAIRE_LEAD_AVIS, "Sans date");
});
