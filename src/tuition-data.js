import { parseFinancialCsvFile, parseFinancialCsvText, parseFinancialAmount, parseFinancialDate } from "./financial-csv.js";

export const TUITION_SOURCE_FIELDS = {
  students: [
    ["studentId", "ID \u00c9tudiant", true], ["matricule", "Matricule"], ["lastName", "Nom"], ["firstName", "Pr\u00e9nom"],
    ["formation", "Formation"], ["academicYear", "Ann\u00e9e universitaire"], ["campus", "Campus"],
    ["tuitionFee", "Frais scolarit\u00e9", "money"], ["registrationFee", "Frais inscription", "money"], ["discount", "Remise", "money"],
    ["amountDue", "Total \u00e0 payer", "money"], ["amountPaid", "Total pay\u00e9", "money"], ["amountRemaining", "Reste \u00e0 payer", "money"],
    ["recoveryRate", "Taux recouvrement", "number"], ["paymentMethod", "Mode de paiement"], ["installmentCount", "Nb \u00e9ch\u00e9ances", "number"],
    ["nextDueDate", "Prochaine \u00e9ch\u00e9ance", "date"], ["nextDueAmount", "Montant prochaine \u00e9ch\u00e9ance", "money"],
    ["daysOverdue", "Jours de retard", "number"], ["globalStatus", "Statut global"], ["phone", "T\u00e9l\u00e9phone"], ["email", "Email"], ["comment", "Commentaire"],
  ],
  schedule: [
    ["installmentId", "ID \u00c9ch\u00e9ance", true], ["matricule", "Matricule"], ["studentName", "Nom \u00e9tudiant"], ["formation", "Formation"],
    ["installmentNumber", "N\u00b0 \u00e9ch\u00e9ance", "number"], ["dueDate", "Date d'\u00e9ch\u00e9ance", "date"], ["plannedAmount", "Montant pr\u00e9vu", "money"],
    ["paidAmount", "Montant pay\u00e9", "money"], ["status", "Statut"], ["paymentDate", "Date paiement", "date"], ["paymentMethod", "Mode r\u00e8glement"],
    ["remainingAmount", "Reste \u00e9ch\u00e9ance", "money"], ["daysOverdue", "Jours retard", "number"], ["paymentReference", "R\u00e9f\u00e9rence paiement"], ["comment", "Commentaire"],
  ],
  references: [
    ["paymentMethods", "Modes de paiement"], ["installmentStatuses", "Statuts \u00e9ch\u00e9ance"], ["formations", "Formations"],
    ["academicYears", "Ann\u00e9es universitaires"], ["campuses", "Campus"], ["settlementMethods", "Modes r\u00e8glement"],
  ],
};

const normalize = (value) => String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, " ").trim();
const blank = (value) => String(value ?? "").trim() === "";
const isTotal = (value) => /^(total|total general|grand total|sous total)$/i.test(normalize(value));

export function missingRequiredTuitionFields(sourceType, mapping = {}) {
  if (sourceType === "students") return mapping.studentId || mapping.matricule ? [] : ["ID Étudiant ou Matricule"];
  return (TUITION_SOURCE_FIELDS[sourceType] ?? []).filter((field) => field[2] === true && !mapping[field[0]]).map((field) => field[1]);
}

export async function discoverTuitionCsvFile(file, sourceType) {
  const parsed = await parseFinancialCsvFile(file);
  return discoverTuitionCsvTextResult(parsed, sourceType, file.name);
}

export function discoverTuitionCsvText(csvText, sourceType, fileName = "fixture.csv") {
  return discoverTuitionCsvTextResult(parseFinancialCsvText(csvText), sourceType, fileName);
}

function discoverTuitionCsvTextResult(parsed, sourceType, fileName) {
  if (!TUITION_SOURCE_FIELDS[sourceType]) throw new Error("Type de source financière inconnu.");
  const mapping = {};
  const definitions = TUITION_SOURCE_FIELDS[sourceType];
  const normalizedHeaders = parsed.headers.map(normalize);
  for (const [id, label] of definitions) {
    const aliases = new Set([normalize(label), normalize(id)]);
    const index = normalizedHeaders.findIndex((header) => aliases.has(header));
    mapping[id] = index < 0 ? "" : parsed.headers[index];
  }
  const missingRequired = missingRequiredTuitionFields(sourceType, mapping);
  return {
    sourceType, fileName, headers: parsed.headers, rows: parsed.rows, rowCount: parsed.rowCount,
    delimiter: parsed.delimiter, preambleRows: parsed.preambleRows, columnProfile: parsed.columnProfile,
    mapping, missingRequired, status: missingRequired.length || sourceType === "references" && !Object.values(mapping).some(Boolean) ? "incomplete" : "valid",
  };
}

export function mapTuitionRows(source, mapping = source?.mapping ?? {}) {
  if (!source) return [];
  const fields = TUITION_SOURCE_FIELDS[source.sourceType] ?? [];
  return source.rows.map((raw) => {
    const row = {};
    for (const [id, , kind] of fields) {
      const rawValue = mapping[id] ? String(raw[mapping[id]] ?? "").trim() : "";
      row[id] = !rawValue ? null : kind === "money" || kind === "number" ? parseFinancialAmount(rawValue)
        : kind === "date" ? parseFinancialDate(rawValue) : rawValue;
      if (kind === "date" && row[id]) row[id] = new Date(Date.UTC(row[id].getUTCFullYear(), row[id].getUTCMonth(), row[id].getUTCDate()));
    }
    if (source.sourceType === "students") {
      row.sourceReportedRemaining = row.amountRemaining;
      if (Number.isFinite(row.amountDue) && Number.isFinite(row.amountPaid)) row.amountRemaining = row.amountDue - row.amountPaid;
    }
    if (source.sourceType === "schedule") {
      row.sourceReportedRemaining = row.remainingAmount;
      if (Number.isFinite(row.plannedAmount) && Number.isFinite(row.paidAmount)) row.remainingAmount = row.plannedAmount - row.paidAmount;
    }
    return row;
  }).filter((row) => {
    if (source.sourceType === "references") return Object.values(row).some((value) => !blank(value));
    const key = source.sourceType === "students" ? row.studentId || row.matricule : row.installmentId || row.matricule;
    if (!key || isTotal(key)) return false;
    return Object.values(row).some((value) => value !== null && value !== "");
  });
}

export function tuitionSourceQuality(source, rows = mapTuitionRows(source)) {
  if (!source) return { status: "not-loaded", rowCount: 0, validRows: 0, invalidRows: 0, duplicateIdentifiers: 0 };
  const ids = rows.map((row) => source.sourceType === "students" ? row.studentId || row.matricule : row.installmentId).filter(Boolean);
  const duplicateIdentifiers = ids.length - new Set(ids).size;
  const requiredMapped = source.sourceType === "students" ? Boolean(source.mapping?.studentId || source.mapping?.matricule) : source.sourceType === "references" ? Object.values(source.mapping ?? {}).some(Boolean) : Boolean(source.mapping?.installmentId);
  const dataRows = source.rows.filter((raw) => {
    if (!Object.values(raw).some((value) => !blank(value))) return false;
    const identifier = raw[source.mapping?.installmentId] ?? raw[source.mapping?.studentId] ?? raw[source.mapping?.matricule] ?? Object.values(raw)[0];
    return !isTotal(identifier);
  });
  const invalidRows = Math.max(0, dataRows.length - rows.length);
  let invalidDates = 0; let invalidAmounts = 0;
  for (const [id, , kind] of TUITION_SOURCE_FIELDS[source.sourceType] ?? []) {
    if (kind !== "date" && kind !== "money" && kind !== "number") continue;
    const column = source.mapping?.[id]; if (!column) continue;
    for (const raw of source.rows) {
      const value = String(raw[column] ?? "").trim();
      if (!value) continue;
      const identifier = raw[source.mapping.installmentId] ?? raw[source.mapping.studentId] ?? raw[source.mapping.matricule] ?? Object.values(raw)[0];
      if (isTotal(identifier)) continue;
      if (kind === "date" && !parseFinancialDate(value)) invalidDates += 1;
      if ((kind === "money" || kind === "number") && parseFinancialAmount(value) === null) invalidAmounts += 1;
    }
  }
  const remainingDiscrepancies = rows.filter((row) => Number.isFinite(row.sourceReportedRemaining)
    && Number.isFinite(row.amountRemaining ?? row.remainingAmount)
    && Math.abs(row.sourceReportedRemaining - (row.amountRemaining ?? row.remainingAmount)) > 0.005).length;
  const status = !requiredMapped || invalidRows || duplicateIdentifiers || invalidDates || invalidAmounts || remainingDiscrepancies ? "incomplete" : "valid";
  return { status, rowCount: source.rowCount, validRows: rows.length, invalidRows: Math.max(0, invalidRows), invalidDates, invalidAmounts, duplicateIdentifiers, remainingDiscrepancies };
}

export function summarizeStudents(rows) {
  const distinctIds = new Set(rows.map((row) => row.studentId || row.matricule).filter(Boolean));
  const sumKnown = (key) => { const values = rows.map((row) => row[key]).filter((value) => Number.isFinite(value)); return values.length && values.length === rows.length ? values.reduce((total, value) => total + value, 0) : null; };
  const identifiers = rows.map((row) => row.studentId || row.matricule).filter(Boolean);
  const duplicateIdentifiers = identifiers.length !== new Set(identifiers).size;
  const amounts = duplicateIdentifiers ? { amountDue: null, amountPaid: null, amountRemaining: null } : { amountDue: sumKnown("amountDue"), amountPaid: sumKnown("amountPaid"), amountRemaining: sumKnown("amountRemaining") };
  const overdueValues = rows.filter((row) => Number.isFinite(row.daysOverdue));
  const overdueIds = new Set(overdueValues.filter((row) => Number(row.daysOverdue) > 0).map((row) => row.studentId || row.matricule).filter(Boolean));
  return { distinctStudents: distinctIds.size, duplicateIdentifiers, ...amounts, overdueStudents: overdueValues.length ? overdueIds.size : null };
}

export function summarizeSchedule(rows, students = []) {
  const sumKnown = (key) => { const values = rows.map((row) => row[key]).filter((value) => Number.isFinite(value)); return values.length && values.length === rows.length ? values.reduce((total, value) => total + value, 0) : null; };
  const studentByMatricule = new Map();
  for (const student of students) if (student.matricule && !studentByMatricule.has(normalize(student.matricule))) studentByMatricule.set(normalize(student.matricule), student);
  const linked = rows.filter((row) => row.matricule && studentByMatricule.has(normalize(row.matricule))).length;
  const ids = rows.map((row) => row.installmentId).filter(Boolean);
  const duplicateIds = ids.length !== new Set(ids).size;
  const overdueValues = rows.map((row) => row.daysOverdue).filter(Number.isFinite);
  return { count: ids.length ? new Set(ids).size : null, rowCount: rows.length, duplicateIds, planned: duplicateIds ? null : sumKnown("plannedAmount"), paid: duplicateIds ? null : sumKnown("paidAmount"), remaining: duplicateIds ? null : sumKnown("remainingAmount"), statuses: countField(rows, "status"), overdue: overdueValues.length ? rows.filter((row) => Number(row.daysOverdue) > 0).length : null, linkedRows: linked, unlinkedRows: rows.length - linked };
}

export function countField(rows, field) {
  const counts = new Map();
  for (const row of rows) if (row[field]) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"));
}

export function groupTuitionByFormation(studentRows, scheduleRows) {
  const entries = new Map();
  const idsByFormation = new Map();
  const studentIds = studentRows.map((row) => row.studentId || row.matricule).filter(Boolean);
  const hasDuplicateStudents = studentIds.length !== new Set(studentIds).size;
  for (const row of studentRows) if (row.formation) {
    const item = entries.get(row.formation) ?? { formation: row.formation, studentCount: 0, amountDue: null, amountPaid: null, amountRemaining: null, _dueCount: 0, _paidCount: 0, _remainingCount: 0 };
    const identifier = row.studentId || row.matricule;
    if (identifier) {
      const formationIds = idsByFormation.get(row.formation) ?? new Set();
      formationIds.add(identifier);
      idsByFormation.set(row.formation, formationIds);
    }
    if (!hasDuplicateStudents) for (const [target, key, countKey] of [["amountDue", "amountDue", "_dueCount"], ["amountPaid", "amountPaid", "_paidCount"], ["amountRemaining", "amountRemaining", "_remainingCount"]]) if (Number.isFinite(row[key])) { item[target] = (item[target] ?? 0) + row[key]; item[countKey] += 1; }
    entries.set(row.formation, item);
  }
  for (const row of scheduleRows) if (row.formation) {
    const item = entries.get(row.formation) ?? { formation: row.formation, studentCount: null, amountDue: null, amountPaid: null, amountRemaining: null };
    item.scheduleCount = (item.scheduleCount ?? 0) + 1;
    entries.set(row.formation, item);
  }
  return [...entries.values()].map((item) => {
    if (idsByFormation.has(item.formation)) item.studentCount = idsByFormation.get(item.formation).size;
    if (item.studentCount !== null) {
      if (item._dueCount !== item.studentCount) item.amountDue = null;
      if (item._paidCount !== item.studentCount) item.amountPaid = null;
      if (item._remainingCount !== item.studentCount) item.amountRemaining = null;
    }
    delete item._dueCount; delete item._paidCount; delete item._remainingCount;
    return item;
  }).sort((a, b) => (b.amountDue ?? -1) - (a.amountDue ?? -1));
}
