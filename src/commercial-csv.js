import Papa from "papaparse";
import { isValidDateRange } from "./date-filters.js";

// These are the only source columns retained by the local dashboard adapter.
export const COMMERCIAL_CSV_FIELDS = [
  "IDENTITE_LEAD", "ANNEE_LEAD", "MOIS_LEAD", "LIB_AVIS", "DATE_AVIS",
  "RESPONSABLE", "LIB_SOURCE_LEAD", "COMMENTAIRE_LEAD_AVIS", "EST_CLASSER",
  "LIB_ETABLISSEMENT", "LIB_REGION",
];
export const REQUIRED_COMMERCIAL_CSV_FIELDS = [
  "IDENTITE_LEAD", "DATE_AVIS", "LIB_AVIS", "RESPONSABLE",
  "LIB_SOURCE_LEAD", "EST_CLASSER", "LIB_ETABLISSEMENT", "LIB_REGION",
];

export function createImportedCsvSource(parsed, fileName) {
  return { ...parsed, fileName, kind: "local-csv" };
}

export function resolveCommercialSourceState({ bundle, importedCsv } = {}) {
  if (importedCsv?.kind === "local-csv" && Array.isArray(importedCsv.rows) && importedCsv.rows.length > 0) {
    return { kind: "local-csv", hasSource: true, showNoSourceMessage: false };
  }
  if (bundle) return { kind: "configured", hasSource: true, showNoSourceMessage: false };
  return { kind: "synthetic", hasSource: false, showNoSourceMessage: true };
}

function cleanText(value) {
  const clean = String(value ?? "").replace(/^\uFEFF/, "").trim();
  return clean || null;
}

export function parseCommercialDate(value) {
  const text = cleanText(value);
  if (!text) return null;

  // Explicitly parse common French CSV dates to avoid browser locale ambiguity.
  const french = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
  if (french) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = french;
    const date = new Date(0);
    date.setUTCFullYear(+year, +month - 1, +day);
    date.setUTCHours(+hour, +minute, +second, 0);
    if (date.getUTCFullYear() !== +year || date.getUTCMonth() !== +month - 1 || date.getUTCDate() !== +day
      || +hour > 23 || +minute > 59 || +second > 59) return null;
    return date;
  }

  // Some exports serialize fractional seconds at .NET/SQL precision (for
  // example, seven digits). Date stores milliseconds, so keep the first three
  // digits while accepting and validating the complete source fraction.
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?)?$/i.exec(text);
  if (!iso) return null;
  const [, year, month, day, hour = "0", minute = "0", second = "0", fraction = "0", zone = ""] = iso;
  const calendar = new Date(Date.UTC(+year, +month - 1, +day));
  if (calendar.getUTCFullYear() !== +year || calendar.getUTCMonth() !== +month - 1 || calendar.getUTCDate() !== +day
    || +hour > 23 || +minute > 59 || +second > 59) return null;
  const offset = /^([+-])(\d{2}):(\d{2})$/.exec(zone);
  if (offset && (+offset[2] > 23 || +offset[3] > 59)) return null;
  // Keep the calendar day and wall-clock time written in the source. Applying an
  // ISO offset here can move DATE_AVIS to the preceding/following day and break
  // a date-only business filter. Dates are used as source-local calendar values.
  const date = new Date(0);
  date.setUTCFullYear(+year, +month - 1, +day);
  date.setUTCHours(+hour, +minute, +second, Number(fraction.slice(0, 3).padEnd(3, "0")));
  return Number.isNaN(date.valueOf())
    || date.getUTCFullYear() !== +year || date.getUTCMonth() !== +month - 1 || date.getUTCDate() !== +day
    || date.getUTCHours() !== +hour || date.getUTCMinutes() !== +minute || date.getUTCSeconds() !== +second
    ? null
    : date;
}

function normalizeRows(data) {
  return data.filter((row) => Object.values(row).some((value) => cleanText(value))).map((row) => {
    const normalized = {};
    for (const field of COMMERCIAL_CSV_FIELDS) {
      if (field === "DATE_AVIS") {
        normalized[field] = parseCommercialDate(row[field]);
      } else if (field === "ANNEE_LEAD" || field === "MOIS_LEAD") {
        const value = cleanText(row[field]);
        normalized[field] = value && /^\d+(?:[.,]\d+)?$/.test(value) ? Number(value.replace(",", ".")) : null;
      } else {
        normalized[field] = cleanText(row[field]);
      }
    }
    return normalized;
  });
}

const headerKey = (value) => String(value ?? "").replace(/^\uFEFF/, "").trim().normalize("NFD")
  .replace(/\p{Diacritic}/gu, "").toLocaleUpperCase("fr").replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const knownCommercialHeaders = new Map(COMMERCIAL_CSV_FIELDS.map((field) => [headerKey(field), field]));

function detectCommercialDelimiter(csvText) {
  const candidates = [";", ",", "\t"].map((delimiter) => {
    const result = Papa.parse(csvText, { header: false, delimiter, preview: 40, skipEmptyLines: "greedy" });
    const counts = new Map();
    for (const row of result.data) counts.set(row.length, (counts.get(row.length) ?? 0) + 1);
    const [width, matches] = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0] ?? [1, 0];
    return { delimiter, width, consistency: matches / Math.max(1, result.data.length) };
  });
  return candidates.sort((a, b) => b.width - a.width || b.consistency - a.consistency)[0].delimiter;
}

function parseCommercialCsvContent(csvText) {
  const text = csvText.replace(/^\uFEFF/, "");
  const delimiter = detectCommercialDelimiter(text);
  const parsed = Papa.parse(text, { header: false, delimiter, skipEmptyLines: "greedy" });
  if (parsed.errors.length) throw new Error("Le fichier CSV n’a pas pu être lu correctement. Vérifiez les guillemets et les séparateurs.");
  const candidates = parsed.data.slice(0, 100).map((row, index) => {
    const fields = row.map((value) => String(value ?? "").replace(/^\uFEFF/, "").trim());
    const recognizedCount = fields.reduce((count, field) => count + Number(knownCommercialHeaders.has(headerKey(field))), 0);
    const uniqueCount = new Set(fields.filter(Boolean).map(headerKey)).size;
    const nonNumericCount = fields.filter((field) => field && !/^[-+]?\d+(?:[.,]\d+)?$/.test(field)).length;
    return { index, fields, recognizedCount, uniqueCount, nonNumericCount };
  });
  const header = candidates.filter((row) => row.uniqueCount > 0)
    .sort((a, b) => b.recognizedCount - a.recognizedCount || b.uniqueCount - a.uniqueCount || b.nonNumericCount - a.nonNumericCount || a.index - b.index)[0];
  if (!header || header.fields.length < 2) throw new Error("Le fichier ne contient pas de ligne d’en-têtes CSV reconnue. Vérifiez son séparateur et ses noms de colonnes.");
  const sourceHeaders = header.fields;
  const fieldIndexes = new Map();
  sourceHeaders.forEach((value, index) => {
    const canonical = knownCommercialHeaders.get(headerKey(value));
    if (canonical && !fieldIndexes.has(canonical)) fieldIndexes.set(canonical, index);
  });
  const missing = REQUIRED_COMMERCIAL_CSV_FIELDS.filter((field) => !fieldIndexes.has(field));
  if (missing.length) throw new Error(`Fichier incompatible avec l’import d’avis. Colonnes manquantes : ${missing.join(", ")}. Sélectionnez un export d’avis commerciaux (pas un fichier financier ou de relances).`);
  const rows = parsed.data.slice(header.index + 1).map((values) => Object.fromEntries(COMMERCIAL_CSV_FIELDS.map((field) => [field, fieldIndexes.has(field) ? values[fieldIndexes.get(field)] ?? "" : ""])));
  const normalizedRows = normalizeRows(rows);
  if (!normalizedRows.length) throw new Error("Le fichier CSV ne contient aucune ligne de données.");
  const invalidDates = normalizedRows.reduce((count, row) => count + Number(!row.DATE_AVIS), 0);
  return { rows: normalizedRows, invalidDates, ignoredColumns: sourceHeaders.filter((field) => !knownCommercialHeaders.has(headerKey(field))), delimiter, headerRow: header.index };
}

export function parseCommercialCsvText(text) {
  if (typeof text !== "string" || !text.trim()) throw new Error("Le fichier CSV est vide.");
  return parseCommercialCsvContent(text);
}

export function parseCommercialCsvFile(file) {
  if (!file || !/\.csv$/i.test(file.name ?? "")) return Promise.reject(new Error("Format incorrect : sélectionnez un fichier .csv."));
  if (!file.size) return Promise.reject(new Error("Le fichier CSV est vide."));
  if (typeof file.arrayBuffer !== "function") return Promise.reject(new Error("Impossible de lire ce fichier CSV sur cet appareil."));
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let encoding = "utf-8";
    let offset = 0;
    if (bytes[0] === 0xff && bytes[1] === 0xfe) { encoding = "utf-16le"; offset = 2; }
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) { encoding = "utf-16be"; offset = 2; }
    else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) offset = 3;
    let csvText;
    try { csvText = new TextDecoder(encoding, { fatal: true }).decode(bytes.subarray(offset)); }
    catch {
      try { csvText = new TextDecoder("windows-1252").decode(bytes); }
      catch { throw new Error("Encodage non reconnu. Réexportez le CSV en UTF-8 ou Windows-1252."); }
    }
    return parseCommercialCsvText(csvText);
  }).catch((error) => {
    if (error instanceof Error && /^(?:Le fichier|Fichier incompatible|Colonnes manquantes|Format incorrect|Impossible|Encodage non reconnu)/i.test(error.message)) throw error;
    throw new Error("Impossible de lire ce fichier CSV sur cet appareil.");
  });
}

export const MISSING_RESPONSIBLE_FILTER = "__MISSING_RESPONSABLE__";

export function filterCommercialCsv(rows, { startDate = "", endDate = "", establishment = "", region = "", category = "", responsible = "" } = {}) {
  if (!isValidDateRange({ startDate, endDate })) return [];
  return rows.filter((row) => {
    const validDate = row.DATE_AVIS instanceof Date && !Number.isNaN(row.DATE_AVIS.valueOf());
    const day = validDate ? row.DATE_AVIS.toISOString().slice(0, 10) : "";
    const inDates = (!startDate && !endDate) || (validDate
      && (!startDate || day >= startDate)
      && (!endDate || day <= endDate));
    return inDates
      && (!establishment || row.LIB_ETABLISSEMENT === establishment)
      && (!region || row.LIB_REGION === region)
      && (!category || row.LIB_AVIS === category)
      && (!responsible || (responsible === MISSING_RESPONSIBLE_FILTER
        ? !String(row.RESPONSABLE ?? "").trim()
        : row.RESPONSABLE === responsible));
  });
}

export function groupCommercialCsv(rows, field, { uniqueCandidates = false } = {}) {
  const counts = new Map();
  const seen = new Set();
  for (const row of rows) {
    const identity = uniqueCandidates ? row.IDENTITE_LEAD : null;
    if (uniqueCandidates && (!identity || seen.has(identity))) continue;
    if (identity) seen.add(identity);
    const label = row[field] || "Non renseigné";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
}

// Cross-tabulate source-row counts for a stacked chart. Small categories may be
// combined into a display-only series; source rows and the regular summaries
// remain untouched.
export function groupCommercialCrossTab(rows, groupField, seriesField, seriesLimit = 6) {
  const seriesTotals = new Map();
  for (const row of rows) {
    const label = row[seriesField] || "Non renseigné";
    seriesTotals.set(label, (seriesTotals.get(label) ?? 0) + 1);
  }
  const orderedSeries = [...seriesTotals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
  const visible = new Set(orderedSeries.slice(0, Math.max(1, seriesLimit)).map(([name]) => name));
  const series = orderedSeries.slice(0, Math.max(1, seriesLimit)).map(([name]) => name);
  if (orderedSeries.length > visible.size) series.push("Autres (affichage)");

  const grouped = new Map();
  for (const row of rows) {
    const name = row[groupField] || "Non renseigné";
    const rawSeries = row[seriesField] || "Non renseigné";
    const key = visible.has(rawSeries) ? rawSeries : "Autres (affichage)";
    const values = grouped.get(name) ?? Object.fromEntries(series.map((item) => [item, 0]));
    values[key] = (values[key] ?? 0) + 1;
    grouped.set(name, values);
  }
  return {
    series,
    rows: [...grouped].map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => series.reduce((sum, key) => sum + b[key], 0) - series.reduce((sum, key) => sum + a[key], 0)
        || a.name.localeCompare(b.name, "fr")),
  };
}

export function summarizeCommercialCsv(rows) {
  const candidates = new Set(rows.map((row) => row.IDENTITE_LEAD).filter(Boolean));
  const dates = rows.map((row) => row.DATE_AVIS)
    .filter((date) => date instanceof Date && !Number.isNaN(date.valueOf()));
  const months = new Map();
  for (const date of dates) {
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    months.set(month, (months.get(month) ?? 0) + 1);
  }
  return {
    distinctCandidates: candidates.size,
    totalAvis: rows.length,
    invalidDates: rows.length - dates.length,
    monthlyAvis: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
    avisByCategory: groupCommercialCsv(rows, "LIB_AVIS"),
    avisByResponsible: groupCommercialCsv(rows, "RESPONSABLE"),
    avisBySource: groupCommercialCsv(rows, "LIB_SOURCE_LEAD"),
    avisByRegion: groupCommercialCsv(rows, "LIB_REGION"),
  };
}
