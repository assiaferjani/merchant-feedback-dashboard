import { createImportedCsvSource } from "./commercial-csv.js";
import { mapFinancialDataset } from "./financial-csv.js";
import { mapTuitionRows, missingRequiredTuitionFields, tuitionSourceQuality } from "./tuition-data.js";
import { applyPersistedSourceSnapshot } from "./local-source-storage.js";

export const initialDashboardCsvState = {
  activePage: "overview",
  importedCsv: null,
  importError: "",
  financialCsv: null,
  financialImportError: "",
  tuitionSources: { students: null, schedule: null, references: null },
  tuitionImportErrors: { students: "", schedule: "", references: "" },
};

export function isFinancialCsvConnected(state) {
  return Boolean(state?.financialCsv?.rowCount > 0 && Array.isArray(state.financialCsv.headers));
}

export function resolveDashboardTheme(value) { return value === "dark" ? "dark" : "light"; }
export function toggleDashboardTheme(value) { return resolveDashboardTheme(value) === "dark" ? "light" : "dark"; }

// Shared top-level UI state: page changes and CSV replacement both preserve the
// other state fields, so navigation never unmounts or discards the active source.
export function dashboardCsvReducer(state = initialDashboardCsvState, action) {
  switch (action.type) {
    case "navigate":
      return { ...state, activePage: action.page };
    case "restore-sources":
      return applyPersistedSourceSnapshot(state, action.snapshot);
    case "clear-sources":
      return {
        ...state,
        importedCsv: null,
        financialCsv: null,
        tuitionSources: { students: null, schedule: null, references: null },
        importError: "",
        financialImportError: "",
        tuitionImportErrors: { students: "", schedule: "", references: "" },
      };
    case "csv-imported":
      return {
        ...state,
        importedCsv: createImportedCsvSource(action.parsed, action.fileName),
        importError: "",
      };
    case "csv-import-failed":
      return { ...state, importError: action.message };
    case "clear-import-error":
      return { ...state, importError: "" };
    case "financial-csv-discovered":
      {
        const mapping = action.source.reportModel?.defaultMapping ?? {};
        let mapped = null;
        try { mapped = mapFinancialDataset(action.source, mapping, []); } catch { /* Keep schema discovery visible; mapping errors remain local. */ }
      return {
        ...state,
        financialCsv: { ...action.source, fileName: action.fileName, mapping, confirmedPaymentStatuses: [], mapped },
        financialImportError: "",
      };
      }
    case "financial-csv-mapped": {
      if (!state.financialCsv) return state;
      try {
        const statusColumnChanged = action.mapping?.paymentStatus !== state.financialCsv.mapping?.paymentStatus;
        const confirmedPaymentStatuses = statusColumnChanged ? [] : (action.confirmedPaymentStatuses ?? []);
        const mapped = mapFinancialDataset(state.financialCsv, action.mapping, confirmedPaymentStatuses);
        return {
          ...state,
          financialCsv: { ...state.financialCsv, mapping: action.mapping, confirmedPaymentStatuses, mapped },
          financialImportError: "",
        };
      } catch (error) {
        return { ...state, financialImportError: error instanceof Error ? error.message : "Correspondance financière invalide." };
      }
    }
    case "financial-csv-failed":
      return { ...state, financialImportError: action.message };
    case "clear-financial-import-error":
      return { ...state, financialImportError: "" };
    case "tuition-csv-discovered": {
      const source = { ...action.source, mapping: action.mapping ?? action.source.mapping, fileName: action.fileName ?? action.source.fileName };
      const rows = mapTuitionRows(source, source.mapping);
      source.mappedRows = rows;
      source.quality = tuitionSourceQuality(source, rows);
      return { ...state, tuitionSources: { ...state.tuitionSources, [source.sourceType]: source }, tuitionImportErrors: { ...state.tuitionImportErrors, [source.sourceType]: "" } };
    }
    case "tuition-csv-mapped": {
      const source = state.tuitionSources?.[action.sourceType];
      if (!source) return state;
      const next = { ...source, mapping: action.mapping, missingRequired: missingRequiredTuitionFields(action.sourceType, action.mapping) };
      next.mappedRows = mapTuitionRows(next, next.mapping);
      next.quality = tuitionSourceQuality(next, next.mappedRows);
      return { ...state, tuitionSources: { ...state.tuitionSources, [action.sourceType]: next }, tuitionImportErrors: { ...state.tuitionImportErrors, [action.sourceType]: "" } };
    }
    case "tuition-csv-failed":
      return { ...state, tuitionImportErrors: { ...state.tuitionImportErrors, [action.sourceType]: action.message } };
    case "clear-tuition-csv-error":
      return { ...state, tuitionImportErrors: { ...state.tuitionImportErrors, [action.sourceType]: "" } };
    default:
      return state;
  }
}

export async function importCsvWith(file, dispatch, parseFile) {
  dispatch({ type: "clear-import-error" });
  try {
    const parsed = await parseFile(file);
    dispatch({ type: "csv-imported", parsed, fileName: file.name });
    return true;
  } catch (error) {
    dispatch({
      type: "csv-import-failed",
      message: error instanceof Error ? error.message : "Impossible de lire ce fichier CSV.",
    });
    return false;
  }
}

export async function importFinancialCsvWith(file, dispatch, parseFile) {
  dispatch({ type: "clear-financial-import-error" });
  try {
    const source = await parseFile(file);
    dispatch({ type: "financial-csv-discovered", source, fileName: file.name });
    return true;
  } catch (error) {
    dispatch({
      type: "financial-csv-failed",
      message: error instanceof Error ? error.message : "Impossible de lire ce fichier financier.",
    });
    return false;
  }
}

export async function importTuitionCsvWith(file, sourceType, dispatch, parseFile) {
  dispatch({ type: "clear-tuition-csv-error", sourceType });
  try {
    const source = await parseFile(file, sourceType);
    dispatch({ type: "tuition-csv-discovered", source, fileName: file.name });
    return true;
  } catch (error) {
    dispatch({ type: "tuition-csv-failed", sourceType, message: error instanceof Error ? error.message : "Impossible de lire ce fichier financier." });
    return false;
  }
}
