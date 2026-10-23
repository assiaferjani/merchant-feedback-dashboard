import { validateImportFile, validateImportRows } from "./import-limits.js";
export * from "./import-limits.js";

// Parsing and schema discovery run off the UI thread. Raw file data stays local.
export async function parseLocalFile(file, sourceType, onProgress = () => {}) {
  validateImportFile(file);
  onProgress({ phase: "reading", label: "Lecture du fichier local…" });
  const worker = new Worker(
    new URL("./workers/csv.worker.js", import.meta.url),
    { type: "module" },
  );
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () =>
        finish(
          new Error(
            "L’import a dépassé deux minutes. Essayez un export plus petit.",
          ),
        ),
      120_000,
    );
    const finish = (error, result) => {
      clearTimeout(timeout);
      worker.terminate();
      if (error) reject(error);
      else resolve(result);
    };
    worker.onmessage = ({ data }) => {
      if (data.progress) {
        onProgress(data.progress);
        return;
      }
      if (data.error) finish(new Error(data.error));
      else {
        try {
          finish(null, validateImportRows(data.result));
        } catch (error) {
          finish(error);
        }
      }
    };
    worker.onerror = () =>
      finish(
        new Error(
          "Lecture impossible. Réessayez ou utilisez un fichier plus petit.",
        ),
      );
    worker.postMessage({ file, sourceType });
  });
}
