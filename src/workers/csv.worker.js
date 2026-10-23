import { parseCommercialCsvFile } from "../commercial-csv.js";
import { parseFinancialCsvFile } from "../financial-csv.js";
import { discoverTuitionCsvFile } from "../tuition-data.js";
import { validateImportRows } from "../import-limits.js";

self.onmessage = async ({ data: { file, sourceType } }) => {
  try {
    self.postMessage({
      progress: {
        phase: "validating",
        label: "Analyse des colonnes et vérification des données…",
      },
    });
    const result =
      sourceType === "commercial"
        ? await parseCommercialCsvFile(file)
        : sourceType === "financial"
          ? await parseFinancialCsvFile(file)
          : await discoverTuitionCsvFile(file, sourceType);
    self.postMessage({ result: validateImportRows(result) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "Le fichier n’a pas pu être lu.",
    });
  }
};
