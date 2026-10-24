import { parseSourceFile } from "../source-import.js";

self.onmessage = async ({ data: { file, sourceType } }) => {
  try {
    self.postMessage({
      progress: {
        phase: "validating",
        label: "Analyse des colonnes et vérification des données…",
      },
    });
    self.postMessage({ result: await parseSourceFile(file, sourceType) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "Le fichier n’a pas pu être lu.",
    });
  }
};
