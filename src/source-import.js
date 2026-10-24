import { readTabularFile } from "./tabular-file.js";
import { parseCommercialCsvText } from "./commercial-csv.js";
import { parseFinancialCsvText } from "./financial-csv.js";
import { discoverTuitionCsvTextResult } from "./tuition-data.js";
import { validateImportRows } from "./import-limits.js";

const normalize = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const labels = {
  commercial: "des avis commerciaux",
  students: "des dossiers étudiants",
  financial: "une synthèse financière",
  schedule: "un échéancier",
  references: "des listes de référence",
};
export function detectSourceType(parsed) {
  const headers = new Set(parsed.headers.map(normalize));
  if (headers.has("identite lead") && headers.has("lib avis"))
    return "commercial";
  if (
    headers.has("matricule") &&
    (headers.has("nom") || headers.has("id etudiant"))
  )
    return "students";
  if (headers.has("id echeance")) return "schedule";
  if (parsed.reportModel) return "financial";
  if (headers.has("formations") || headers.has("modes de paiement"))
    return "references";
  return null;
}

export async function parseSourceFile(file, requestedType) {
  const { text, ...metadata } = await readTabularFile(file);
  const generic = parseFinancialCsvText(text);
  const detected = detectSourceType(generic);
  const sourceType = requestedType === "auto" ? detected : requestedType;
  if (!sourceType)
    throw new Error(
      "Type de données non reconnu. Choisissez manuellement le contenu du fichier et vérifiez ses en-têtes.",
    );
  if (detected && sourceType !== detected)
    throw new Error(
      `Ce fichier contient ${labels[detected]}. Choisissez le type correspondant ou la détection automatique.`,
    );
  const parsed =
    sourceType === "commercial"
      ? parseCommercialCsvText(text)
      : sourceType === "financial"
        ? generic
        : discoverTuitionCsvTextResult(generic, sourceType, file.name);
  return validateImportRows({
    ...parsed,
    ...metadata,
    detectedSourceType: sourceType,
  });
}
