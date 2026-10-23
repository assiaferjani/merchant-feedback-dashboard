export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 100_000;
export const IMPORT_LIMIT_LABEL = "20 Mo · 100 000 lignes maximum";

export function validateImportFile(file) {
  if (!file || !/\.csv$/i.test(file.name ?? ""))
    throw new Error(
      "Format non pris en charge : choisissez un fichier CSV (.csv). Pour un classeur Excel ou Numbers, exportez d’abord la feuille en CSV UTF-8.",
    );
  if (!file.size) throw new Error("Le fichier CSV est vide.");
  if (file.size > MAX_IMPORT_BYTES)
    throw new Error(
      "Le fichier dépasse 20 Mo. Fractionnez votre export avant de l’importer.",
    );
}

export function validateImportRows(result) {
  const count = result.rowCount ?? result.rows?.length ?? 0;
  if (count > MAX_IMPORT_ROWS)
    throw new Error(
      "Le fichier dépasse 100 000 lignes. Fractionnez votre export avant de l’importer.",
    );
  return result;
}
