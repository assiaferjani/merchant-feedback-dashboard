import Papa from "papaparse";
import { MAX_IMPORT_ROWS, validateImportFile } from "./import-limits.js";

function decodeText(bytes) {
  let encoding = "utf-8";
  let offset = 0;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = "utf-16le";
    offset = 2;
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = "utf-16be";
    offset = 2;
  } else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    offset = 3;
  }
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(
      bytes.subarray(offset),
    );
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

// Used in the import Worker: the spreadsheet library is loaded only for workbooks.
// Normalize all formats before the existing business/schema validation runs.
export async function readTabularFile(file) {
  validateImportFile(file);
  if (typeof file.arrayBuffer !== "function")
    throw new Error("Impossible de lire ce fichier sur cet appareil.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = file.name.split(".").pop().toLowerCase();
  if (["csv", "tsv", "txt"].includes(extension)) {
    const text = decodeText(bytes);
    if (/[\x00-\x08\x0e-\x1f]/.test(text))
      throw new Error(
        "Le fichier n’est pas un tableau texte. Choisissez son format d’origine.",
      );
    return { text };
  }

  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf;
  const biff = bytes[0] === 0x09 && [0x00, 0x02, 0x04, 0x08].includes(bytes[1]);
  if (extension === "xls" ? !ole && !biff : !zip)
    throw new Error(
      "Le classeur est invalide ou son extension a été renommée. Exportez-le à nouveau depuis votre tableur.",
    );

  const { read, utils } = await import("xlsx");
  let workbook;
  try {
    workbook = read(bytes, {
      type: "array",
      dense: true,
      cellDates: true,
      cellNF: true,
      sheetRows: MAX_IMPORT_ROWS + 2,
    });
  } catch {
    throw new Error(
      "Impossible de lire ce classeur. Vérifiez qu’il n’est ni corrompu ni protégé par un mot de passe, puis enregistrez-le à nouveau.",
    );
  }
  const sheetName = workbook.SheetNames.find(
    (name, index) =>
      !workbook.Workbook?.Sheets?.[index]?.Hidden &&
      workbook.Sheets[name]?.["!data"]?.some((row) =>
        row?.some(
          (cell) =>
            cell &&
            (cell.f || (cell.v != null && String(cell.v).trim() !== "")),
        ),
      ),
  );
  if (!sheetName)
    throw new Error(
      "Le classeur ne contient aucune feuille visible avec des données.",
    );
  const sheet = workbook.Sheets[sheetName];
  const range = utils.decode_range(sheet["!fullref"] || sheet["!ref"]);
  if (range.e.r - range.s.r > MAX_IMPORT_ROWS)
    throw new Error(
      "Le fichier dépasse 100 000 lignes. Fractionnez votre export avant de l’importer.",
    );
  if (range.e.c - range.s.c >= 512)
    throw new Error(
      "La feuille dépasse 512 colonnes. Conservez uniquement les colonnes utiles à l’analyse.",
    );
  const rows = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell =
        sheet["!data"]?.[r]?.[c] ?? sheet[utils.encode_cell({ r, c })];
      if (cell?.f && cell.v == null)
        throw new Error(
          "Une formule n’a pas de résultat enregistré. Recalculez et enregistrez le classeur dans votre tableur avant l’import.",
        );
      if (cell?.t === "e")
        throw new Error(
          `La feuille « ${sheetName} » contient une erreur de calcul en ${utils.encode_cell({ r, c })}. Corrigez-la avant l’import.`,
        );
      const value = cell?.v;
      row.push(
        value instanceof Date
          ? value.toISOString().slice(0, 10)
          : cell?.t === "n" && /^0+$/.test(cell.z ?? "")
            ? (cell.w ?? String(value).padStart(cell.z.length, "0"))
            : (value ?? ""),
      );
    }
    rows.push(row);
  }
  return {
    text: Papa.unparse(rows, { delimiter: ";", newline: "\n" }),
    sheetName,
    sheetCount: workbook.SheetNames.length,
  };
}
