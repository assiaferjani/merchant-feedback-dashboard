import Papa from "papaparse";
import { MISSING_RESPONSIBLE_FILTER } from "./commercial-csv.js";
import { isValidDateRange } from "./date-filters.js";

export const REQUIRED_FIELDS = [
  "IDENTITE_LEAD",
  "ANNEE_LEAD",
  "MOIS_LEAD",
  "LIB_AVIS",
  "DATE_AVIS",
  "IdxJours",
  "ANNEE_MOIS",
  "ANNEE_AVIS",
  "MOIS_AVIS",
  "RESPONSABLE",
  "LIB_SOURCE_LEAD",
  "COMMENTAIRE_LEAD_AVIS",
  "EST_CLASSER",
  "LIB_ETABLISSEMENT",
  "SEMAINE_AVIS",
  "LIB_REGION",
];

const asDate = (value) => {
  // The CSV timestamps have no timezone. Treat them consistently as UTC for display/filtering.
  const normalized = value?.trim().replace(" ", "T");
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(
    normalized ?? "",
  );
  if (!match) return null;
  const parsed = new Date(`${normalized}Z`);
  if (Number.isNaN(parsed.valueOf())) return null;
  const [, year, month, day, hour, minute, second] = match;
  return parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() + 1 === Number(month) &&
    parsed.getUTCDate() === Number(day) &&
    parsed.getUTCHours() === Number(hour) &&
    parsed.getUTCMinutes() === Number(minute) &&
    parsed.getUTCSeconds() === Number(second)
    ? parsed
    : null;
};

export function parseFeedbackCsv(csvText) {
  const parsed = Papa.parse(csvText.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  if (parsed.errors.length) {
    throw new Error(`CSV parsing failed: ${parsed.errors[0].message}`);
  }
  const headers = parsed.meta.fields ?? [];
  const missing = REQUIRED_FIELDS.filter((field) => !headers.includes(field));
  const unexpected = headers.filter(
    (field) => !REQUIRED_FIELDS.includes(field),
  );
  if (
    missing.length ||
    unexpected.length ||
    headers.length !== REQUIRED_FIELDS.length
  ) {
    throw new Error(
      `CSV schema mismatch. Missing: ${missing.join(", ") || "none"}. Unexpected: ${unexpected.join(", ") || "none"}.`,
    );
  }

  return parsed.data.map((row, index) => {
    const date = asDate(row.DATE_AVIS);
    return {
      ...row,
      DATE_AVIS: date,
      COMMENTAIRE_LEAD_AVIS: (row.COMMENTAIRE_LEAD_AVIS ?? "").trim(),
      LIB_ETABLISSEMENT: (row.LIB_ETABLISSEMENT ?? "").trim(),
      LIB_REGION: (row.LIB_REGION ?? "").trim(),
      LIB_AVIS: (row.LIB_AVIS ?? "").trim(),
    };
  });
}

const dayKey = (date) => date.toISOString().slice(0, 10);
const displayDate = (date, withTime = false) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime
      ? { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }
      : { timeZone: "UTC" }),
  }).format(date);

export function filterFeedback(rows, filters) {
  if (!isValidDateRange(filters)) return [];
  return rows.filter((row) => {
    const validDate =
      row.DATE_AVIS instanceof Date && !Number.isNaN(row.DATE_AVIS.valueOf());
    const day = validDate ? dayKey(row.DATE_AVIS) : "";
    return (
      ((!filters.startDate && !filters.endDate) ||
        (validDate &&
          (!filters.startDate || day >= filters.startDate) &&
          (!filters.endDate || day <= filters.endDate))) &&
      (!filters.establishment ||
        row.LIB_ETABLISSEMENT === filters.establishment) &&
      (!filters.region || row.LIB_REGION === filters.region) &&
      (!filters.category || row.LIB_AVIS === filters.category) &&
      (!filters.responsible ||
        (filters.responsible === MISSING_RESPONSIBLE_FILTER
          ? !String(row.RESPONSABLE ?? "").trim()
          : row.RESPONSABLE === filters.responsible))
    );
  });
}

export function summarizeFeedback(rows) {
  const comments = rows.reduce(
    (count, row) =>
      count + Number(Boolean(String(row.COMMENTAIRE_LEAD_AVIS ?? "").trim())),
    0,
  );
  return {
    total: rows.length,
    establishments: new Set(
      rows.map((row) => row.LIB_ETABLISSEMENT).filter(Boolean),
    ).size,
    regions: new Set(rows.map((row) => row.LIB_REGION).filter(Boolean)).size,
    comments,
    commentCoverage: rows.length ? comments / rows.length : 0,
  };
}

export function groupByDay(rows) {
  const counts = new Map();
  rows.forEach((row) => {
    if (
      !(row.DATE_AVIS instanceof Date) ||
      Number.isNaN(row.DATE_AVIS.valueOf())
    )
      return;
    const key = dayKey(row.DATE_AVIS);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date,
      label: new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(`${date}T00:00:00Z`)),
      count,
    }));
}

export function groupByMonth(rows) {
  const counts = new Map();
  rows.forEach((row) => {
    const date = row.DATE_AVIS;
    if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return;
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      month,
      label: new Intl.DateTimeFormat("fr-FR", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }).format(new Date(`${month}-01T00:00:00Z`)),
      count,
    }));
}

export function groupByField(rows, field) {
  const counts = new Map();
  rows.forEach((row) => {
    const value = row[field] || "Unspecified";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function getAllComments(rows) {
  const timestamp = (value) =>
    value instanceof Date && !Number.isNaN(value.valueOf())
      ? value.valueOf()
      : Number.NEGATIVE_INFINITY;
  return rows
    .filter((row) => String(row.COMMENTAIRE_LEAD_AVIS ?? "").trim())
    .toSorted((a, b) => timestamp(b.DATE_AVIS) - timestamp(a.DATE_AVIS) || 0);
}

export function getRecentComments(rows, limit = 12) {
  return getAllComments(rows)
    .filter(
      (row) =>
        row.DATE_AVIS instanceof Date && !Number.isNaN(row.DATE_AVIS.valueOf()),
    )
    .slice(0, limit);
}

export { displayDate };
