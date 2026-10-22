import Papa from "papaparse";

export const FINANCIAL_FIELDS = [
  { id: "paymentAmount", label: "Montant de paiement / revenu" },
  { id: "paymentDate", label: "Date de paiement" },
  { id: "paymentStatus", label: "Statut de paiement" },
  { id: "paymentId", label: "Référence de paiement (facultatif)" },
  { id: "enrollmentId", label: "Identifiant d’inscription" },
  { id: "enrollmentDate", label: "Date d’inscription" },
  { id: "enrollmentStatus", label: "Statut d’inscription" },
  { id: "paymentMethod", label: "Mode de paiement" },
  { id: "establishment", label: "Établissement" },
  { id: "region", label: "Région" },
];

export const FINANCIAL_REPORT_FIELDS = [
  { id: "monthlyPeriod", label: "Période mensuelle", group: "monthly" },
  { id: "monthlyPlanned", label: "Montant prévu (mois)", group: "monthly" },
  { id: "monthlyCollected", label: "Montant collecté (mois)", group: "monthly" },
  { id: "monthlyGap", label: "Écart source (mois)", group: "monthly" },
  { id: "programName", label: "Filière", group: "program" },
  { id: "programPlanned", label: "Total à payer (filière)", group: "program" },
  { id: "programCollected", label: "Total encaissé (filière)", group: "program" },
  { id: "programRemaining", label: "Reste à encaisser (filière)", group: "program" },
];

const text = (value) => String(value ?? "").replace(/^\uFEFF/, "").trim();

export function parseFinancialAmount(value) {
  const raw = text(value);
  if (!raw) return null;
  let normalized = raw.replace(/[\s\u00a0\u202f]/g, "").replace(/[\p{Sc}]/gu, "").replace(/(?:TND|DT|EUR|USD|GBP|MAD|DZD|CAD|CHF)/gi, "");
  if (/^\(.*\)$/.test(normalized)) normalized = `-${normalized.slice(1, -1)}`;
  if (normalized.includes(",") && normalized.includes(".")) {
    const decimal = normalized.lastIndexOf(",") > normalized.lastIndexOf(".") ? "," : ".";
    const grouping = decimal === "," ? /\./g : /,/g;
    normalized = normalized.replace(grouping, "").replace(decimal, ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseFinancialDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const fr = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw);
  if (fr) {
    const [, d, m, y, h = "0", min = "0", s = "0"] = fr;
    const date = new Date(Date.UTC(+y, +m - 1, +d, +h, +min, +s));
    return date.getUTCFullYear() === +y && date.getUTCMonth() === +m - 1 && date.getUTCDate() === +d
      && +h < 24 && +min < 60 && +s < 60 ? date : null;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?)?$/i.exec(raw);
  if (!iso) return null;
  const [, y, m, d, h = "0", min = "0", s = "0", fraction = "0", zone = ""] = iso;
  const date = new Date(Date.UTC(+y, +m - 1, +d, +h, +min, +s, Number(fraction.padEnd(3, "0"))));
  if (date.getUTCFullYear() !== +y || date.getUTCMonth() !== +m - 1 || date.getUTCDate() !== +d
    || +h >= 24 || +min >= 60 || +s >= 60) return null;
  if (zone && zone.toUpperCase() !== "Z") {
    const [offsetHours, offsetMinutes] = zone.slice(1).split(":").map(Number);
    if (offsetHours > 23 || offsetMinutes > 59) return null;
  }
  const zoned = zone ? new Date(raw.replace(" ", "T")) : date;
  return Number.isNaN(zoned.valueOf()) ? null : zoned;
}

const normalizeHeader = (value) => text(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr").replace(/\s+/g, " ");
const isAggregateTotalLabel = (value) => /^(?:total(?: (?:general|annuel|global))?|totaux|sous[- ]?total|grand total)$/.test(normalizeHeader(value));

function detectDelimiter(csvText) {
  return [";", ",", "\t"].map((delimiter) => {
    const parsed = Papa.parse(csvText, { header: false, delimiter, preview: 80, skipEmptyLines: "greedy" });
    const widths = new Map();
    for (const row of parsed.data) widths.set(row.length, (widths.get(row.length) ?? 0) + 1);
    const mode = [...widths].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0] ?? [1, 0];
    return { delimiter, width: mode[0], consistency: mode[1] / Math.max(1, parsed.data.length) };
  }).sort((a, b) => b.width - a.width || b.consistency - a.consistency)[0].delimiter;
}

function findHeaderRow(matrix) {
  let bestIndex = -1;
  let bestScore = -Infinity;
  matrix.slice(0, 60).forEach((row, index) => {
    const cells = row.map(text).filter(Boolean);
    if (cells.length < 1) return;
    const unique = new Set(cells.map(normalizeHeader)).size;
    if (unique < Math.max(1, Math.ceil(cells.length * 0.7))) return;
    const numericLike = cells.filter((cell) => parseFinancialAmount(cell) !== null).length;
    if (numericLike === cells.length) return;
    const score = cells.length * 100 + unique * 5 - numericLike * 12 - index * 0.01;
    if (score > bestScore) { bestScore = score; bestIndex = index; }
  });
  return bestIndex;
}

function makeUniqueHeaders(rawHeaders) {
  const used = new Map();
  return rawHeaders.map((raw, index) => {
    const original = text(raw) || `Colonne sans nom ${index + 1}`;
    const count = (used.get(original) ?? 0) + 1;
    used.set(original, count);
    return count === 1 ? original : `${original} (${count})`;
  });
}

function discoverMonthlyReport(headers, matrix) {
  const normalized = headers.map(normalizeHeader);
  const find = (predicate) => normalized.findIndex(predicate);
  const monthIndex = find((name) => ["mois", "periode", "period"].includes(name));
  const plannedIndex = find((name) => /montant prevu|montant planifie/.test(name));
  const collectedIndex = find((name) => /montant collecte/.test(name));
  const gapIndex = find((name) => name === "ecart" || /reste a encaisser/.test(name));
  const rateIndex = find((name) => name === "taux" || name.includes("taux "));
  if (monthIndex < 0 || plannedIndex < 0 || collectedIndex < 0) return null;

  const statusIndexes = normalized.map((name, index) => ({ name, index }))
    .filter(({ name }) => ["payees", "partielles", "a venir", "en retard"].includes(name));
  const programSectionStart = matrix.findIndex((row) => {
    const labels = row.slice(0, 5).map(normalizeHeader);
    return Boolean(labels[0]?.includes("filiere") && labels.some((name) => name.includes("total a payer"))
      && labels.some((name) => name.includes("total encaisse")));
  });
  const monthlyRows = [];
  const statusTotals = [];
  let excludedMonthlyTotalRows = 0;
  const monthlySection = programSectionStart < 0 ? matrix : matrix.slice(0, programSectionStart);
  for (const row of monthlySection) {
    const period = text(row[monthIndex]);
    if (isAggregateTotalLabel(period) || isAggregateTotalLabel(row[0])) { excludedMonthlyTotalRows += 1; continue; }
    const planned = parseFinancialAmount(row[plannedIndex]);
    const collected = parseFinancialAmount(row[collectedIndex]);
    if (!period || (planned === null && collected === null)) continue;
    monthlyRows.push({
      period, plannedAmount: planned, collectedAmount: collected,
      gapAmount: gapIndex < 0 ? null : parseFinancialAmount(row[gapIndex]),
      reportedRate: rateIndex < 0 ? null : text(row[rateIndex]) || null,
    });
    if (!statusTotals.length && statusIndexes.length && statusIndexes.every(({ index }) => parseFinancialAmount(row[index]) !== null)) {
      for (const { index } of statusIndexes) statusTotals.push({ name: headers[index], count: parseFinancialAmount(row[index]) });
    }
  }

  let programHeaders = [];
  let programRows = [];
  let excludedProgramTotalRows = 0;
  let programRemainingHeader = "";
  let programRemainingMeaningConfirmed = false;
  for (let index = 0; index < matrix.length; index += 1) {
    const row = matrix[index];
    const labels = row.slice(0, 5).map(normalizeHeader);
    if (!labels[0]?.includes("filiere") || !labels.some((name) => name.includes("total a payer"))
      || !labels.some((name) => name.includes("total encaisse"))) continue;
    programHeaders = row.slice(0, 5).map((value, i) => text(value) || `Champ filiere ${i + 1}`);
    const programHeaderNames = row.map(normalizeHeader);
    const programNameIndex = programHeaderNames.findIndex((name) => name.includes("filiere"));
    const programPlannedIndex = programHeaderNames.findIndex((name) => name.includes("total a payer"));
    const programCollectedIndex = programHeaderNames.findIndex((name) => name.includes("total encaisse"));
    const programRemainingIndex = programHeaderNames.findIndex((name) => name === "ecart" || name.includes("reste a encaisser"));
    programRemainingHeader = programRemainingIndex < 0 ? "" : text(row[programRemainingIndex]);
    const candidates = matrix.slice(index + 1).flatMap((values) => {
      const name = text(values[programNameIndex]);
      if (!name) return [];
      if (isAggregateTotalLabel(name)) { excludedProgramTotalRows += 1; return []; }
      const plannedAmount = parseFinancialAmount(values[programPlannedIndex]);
      const collectedAmount = parseFinancialAmount(values[programCollectedIndex]);
      const sourceRemainingAmount = programRemainingIndex < 0 ? null : parseFinancialAmount(values[programRemainingIndex]);
      const rateIndex = programHeaderNames.findIndex((header) => header.startsWith("taux"));
      const reportedRate = rateIndex < 0 ? null : text(values[rateIndex]) || null;
      if (plannedAmount === null && collectedAmount === null && sourceRemainingAmount === null) return [];
      return [{ name, plannedAmount, collectedAmount, sourceRemainingAmount, reportedRate }];
    });
    const comparableRows = candidates.filter((candidate) => candidate.sourceRemainingAmount !== null
      && candidate.plannedAmount !== null && candidate.collectedAmount !== null);
    const differenceConfirmed = comparableRows.length > 0 && comparableRows.every((candidate) =>
      Math.abs(candidate.sourceRemainingAmount - (candidate.plannedAmount - candidate.collectedAmount)) <= 0.005);
    programRemainingMeaningConfirmed = differenceConfirmed;
    programRows = candidates.map((candidate) => ({
      ...candidate,
      remainingSourceVerified: candidate.sourceRemainingAmount !== null && programRemainingMeaningConfirmed,
      remainingAmount: candidate.sourceRemainingAmount !== null && programRemainingMeaningConfirmed
        ? candidate.sourceRemainingAmount
        : candidate.plannedAmount !== null && candidate.collectedAmount !== null
          ? candidate.plannedAmount - candidate.collectedAmount : null,
    }));
    break;
  }
  if (!monthlyRows.length) return null;
  return { monthlyRows, programHeaders, programRows, statusTotals, excludedMonthlyTotalRows, excludedProgramTotalRows, programRemainingHeader, programRemainingMeaningConfirmed };
}

export function parseFinancialCsvText(csvText) {
  if (typeof csvText !== "string" || !csvText.trim()) throw new Error("Le fichier financier est vide.");
  const cleanCsv = csvText.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(cleanCsv);
  const parsed = Papa.parse(cleanCsv, { header: false, delimiter, skipEmptyLines: false });
  if (parsed.errors.length) throw new Error("Le fichier CSV est mal form\u00e9. V\u00e9rifiez les guillemets et les s\u00e9parateurs.");
  const matrix = parsed.data;
  const headerIndex = findHeaderRow(matrix);
  if (headerIndex < 0) throw new Error("En-t\u00eates introuvables. V\u00e9rifiez que le fichier contient une ligne de noms de colonnes.");
  const headers = makeUniqueHeaders(matrix[headerIndex]);
  const rawRows = matrix.slice(headerIndex + 1).filter((row) => row.some((value) => text(value)));
  if (!rawRows.length) throw new Error("Le fichier financier ne contient aucune ligne de donn\u00e9es.");
  if (rawRows.some((row) => row.length > headers.length)) throw new Error("Le fichier CSV contient des lignes dont le nombre de colonnes ne correspond pas aux en-t\u00eates.");
  const rows = rawRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, text(row[index]) || null])));
  const columnProfile = headers.map((header) => ({
    header,
    filled: rows.reduce((count, row) => count + Number(Boolean(text(row[header]))), 0),
    blank: rows.reduce((count, row) => count + Number(!text(row[header])), 0),
  }));
  const reportModel = discoverMonthlyReport(headers, rawRows);
  const normalized = headers.map(normalizeHeader);
  const mapHeader = (predicate) => headers[normalized.findIndex(predicate)] ?? "";
  const defaultMapping = reportModel ? {
    monthlyPeriod: mapHeader((name) => ["mois", "periode", "period"].includes(name)),
    monthlyPlanned: mapHeader((name) => /montant prevu|montant planifie/.test(name)),
    monthlyCollected: mapHeader((name) => /montant collecte/.test(name)),
    monthlyGap: mapHeader((name) => name === "ecart" || /reste a encaisser/.test(name)),
    programName: reportModel.programHeaders[0] ?? "",
    programPlanned: reportModel.programHeaders[1] ?? "",
    programCollected: reportModel.programHeaders[2] ?? "",
    programRemaining: reportModel.programHeaders[3] ?? "",
  } : {};
  return {
    headers, rows, rowCount: rows.length, columnProfile, delimiter, preambleRows: headerIndex,
    ...(reportModel ? { reportModel: { ...reportModel, monthlyHeaders: headers, defaultMapping } } : {}),
  };
}

export function parseFinancialCsvFile(file) {
  if (!file || !/\.csv$/i.test(file.name ?? "")) return Promise.reject(new Error("Format incorrect : sélectionnez un fichier .csv."));
  if (!file.size) return Promise.reject(new Error("Le fichier financier est vide."));
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
      catch { throw new Error("Encodage non reconnu. Enregistrez le CSV en UTF-8 ou Windows-1252 puis réessayez."); }
    }
    return parseFinancialCsvText(csvText);
  }).catch((error) => {
    if (error instanceof Error && /^(?:Le fichier|En-t\u00eates|Le fichier CSV|Format incorrect|Encodage non reconnu|Aucun tableau)/i.test(error.message)) throw error;
    throw new Error("Impossible de lire ce fichier financier sur cet appareil.");
  });
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) if (row[key]) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
}

export function mapFinancialDataset(source, mapping = {}, confirmedPaymentStatuses = []) {
  if (source?.reportModel) return mapFinancialReportDataset(source, mapping);
  const usedColumns = Object.values(mapping).filter(Boolean);
  if (new Set(usedColumns).size !== usedColumns.length) throw new Error("Chaque colonne source ne peut être associée qu’à un seul champ.");
  for (const column of usedColumns) if (!source.headers.includes(column)) throw new Error("La correspondance sélectionnée n’existe plus dans le fichier.");
  let invalidPaymentDateCount = 0;
  let invalidEnrollmentDateCount = 0;
  const rows = source.rows.map((sourceRow) => {
    const row = {};
    for (const { id } of FINANCIAL_FIELDS) {
      const value = mapping[id] ? text(sourceRow[mapping[id]]) : "";
      row[id] = id === "paymentAmount" ? parseFinancialAmount(value)
        : id === "paymentDate" || id === "enrollmentDate" ? parseFinancialDate(value)
          : value || null;
    }
    if (mapping.paymentDate && text(sourceRow[mapping.paymentDate]) && !row.paymentDate) invalidPaymentDateCount += 1;
    if (mapping.enrollmentDate && text(sourceRow[mapping.enrollmentDate]) && !row.enrollmentDate) invalidEnrollmentDateCount += 1;
    return row;
  });
  const validAmounts = rows.map((row) => row.paymentAmount).filter((value) => value !== null);
  const mappedAmountValues = mapping.paymentAmount ? source.rows.map((row) => text(row[mapping.paymentAmount])).filter(Boolean) : [];
  const mappedPaymentStatuses = Boolean(mapping.paymentStatus);
  const confirmedSet = new Set(confirmedPaymentStatuses.map(text).filter(Boolean));
  const validConfirmedAmounts = rows.filter((row) => confirmedSet.has(row.paymentStatus) && row.paymentAmount !== null);
  const enrollmentIds = new Set(rows.map((row) => row.enrollmentId).filter(Boolean));
  const monthly = new Map();
  for (const row of rows) {
    if (!row.paymentDate || row.paymentAmount === null) continue;
    const month = `${row.paymentDate.getUTCFullYear()}-${String(row.paymentDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const current = monthly.get(month) ?? { month, recordedAmount: 0, collectedAmount: 0 };
    current.recordedAmount += row.paymentAmount;
    if (confirmedSet.has(row.paymentStatus)) current.collectedAmount += row.paymentAmount;
    monthly.set(month, current);
  }
  return {
    mapping,
    rows,
    confirmedPaymentStatuses: [...confirmedSet],
    metrics: {
      totalRows: rows.length,
      totalRecordedAmount: mapping.paymentAmount && validAmounts.length ? validAmounts.reduce((sum, value) => sum + value, 0) : null,
      validAmountCount: validAmounts.length,
      invalidAmountCount: mappedAmountValues.length - validAmounts.length,
      distinctPaymentCount: mapping.paymentId ? new Set(rows.map((row) => row.paymentId).filter(Boolean)).size : null,
      enrollmentCount: mapping.enrollmentId ? enrollmentIds.size : null,
      confirmedCollectedRevenue: mapping.paymentAmount && mappedPaymentStatuses && confirmedSet.size
        && validConfirmedAmounts.length
        ? validConfirmedAmounts.reduce((sum, row) => sum + row.paymentAmount, 0) : null,
      invalidPaymentDateCount,
      invalidEnrollmentDateCount,
    },
    monthly: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)),
    paymentStatuses: mapping.paymentStatus ? countBy(rows, "paymentStatus") : [],
    enrollmentStatuses: mapping.enrollmentStatus ? countBy(rows, "enrollmentStatus") : [],
    paymentMethods: mapping.paymentMethod ? countBy(rows, "paymentMethod") : [],
    establishments: mapping.establishment ? countBy(rows, "establishment") : [],
    regions: mapping.region ? countBy(rows, "region") : [],
  };
}

// Dashboard exports are summaries, not payment ledgers. Keep their two independent
// aggregates separate so month totals are never presented as student/payment rows.
export function mapFinancialReportDataset(source, mapping = source?.reportModel?.defaultMapping ?? {}) {
  const report = source?.reportModel;
  if (!report) throw new Error("Aucun tableau de synthèse financière n’a été détecté.");
  if (!Object.keys(mapping).length) mapping = report.defaultMapping ?? {};
  const monthlyRows = report.monthlyRows.map((row) => ({ ...row }));
  const programRows = report.programRows.map((row) => ({ ...row }));
  const sumIfAvailable = (rows, key) => {
    const values = rows.map((row) => row[key]).filter((value) => typeof value === "number" && Number.isFinite(value));
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  };
  return {
    mapping,
    reportModel: true,
    monthlyRows,
    programRows,
    statusTotals: report.statusTotals.map((row) => ({ ...row })),
    metrics: {
      totalRows: source.rowCount,
      monthlyPeriods: monthlyRows.length,
      programCount: programRows.length || null,
      plannedAmount: sumIfAvailable(monthlyRows, "plannedAmount"),
      collectedAmount: sumIfAvailable(monthlyRows, "collectedAmount"),
      sourceGap: sumIfAvailable(monthlyRows, "gapAmount"),
      programPlannedAmount: sumIfAvailable(programRows, "plannedAmount"),
      programCollectedAmount: sumIfAvailable(programRows, "collectedAmount"),
      programRemainingAmount: sumIfAvailable(programRows, "remainingAmount"),
      excludedMonthlyTotalRows: report.excludedMonthlyTotalRows ?? 0,
      excludedProgramTotalRows: report.excludedProgramTotalRows ?? 0,
      programRemainingMeaningConfirmed: report.programRemainingMeaningConfirmed ?? false,
      totalRecordedAmount: null,
      confirmedCollectedRevenue: null,
      distinctPaymentCount: null,
      enrollmentCount: null,
    },
  };
}
