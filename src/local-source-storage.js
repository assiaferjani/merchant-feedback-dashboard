const DATABASE_NAME = "merchant-feedback-dashboard-local";
const DATABASE_VERSION = 1;
const STORE_NAME = "dashboard-sources";
const SNAPSHOT_KEY = "active-imports";

export function createPersistedSourceSnapshot(state, fileLink = {}) {
  return {
    version: 1,
    importedCsv: state?.importedCsv ?? null,
    financialCsv: state?.financialCsv ?? null,
    tuitionSources: state?.tuitionSources ?? {
      students: null,
      schedule: null,
      references: null,
    },
    financialFileHandle: fileLink.financialFileHandle ?? null,
    financialFileSignature: fileLink.financialFileSignature ?? "",
  };
}

export function applyPersistedSourceSnapshot(state, snapshot) {
  if (!snapshot || snapshot.version !== 1) return state;
  return {
    ...state,
    // A file imported while IndexedDB was loading wins over the older snapshot.
    importedCsv: state.importedCsv ?? snapshot.importedCsv ?? null,
    financialCsv: state.financialCsv ?? snapshot.financialCsv ?? null,
    tuitionSources: Object.fromEntries(
      ["students", "schedule", "references"].map((key) => [
        key,
        state.tuitionSources?.[key] ?? snapshot.tuitionSources?.[key] ?? null,
      ]),
    ),
  };
}

function openDatabase(indexedDb = globalThis.indexedDB) {
  if (!indexedDb)
    return Promise.reject(
      new Error("Le stockage local du navigateur n’est pas disponible."),
    );
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("Ouverture du stockage local impossible."),
      );
    request.onblocked = () =>
      reject(new Error("Le stockage local est bloqué par un autre onglet."));
  });
}

export async function loadPersistedDashboardSources(
  indexedDb = globalThis.indexedDB,
) {
  const database = await openDatabase(indexedDb);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(SNAPSHOT_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () =>
        reject(
          request.error ?? new Error("Lecture des imports locaux impossible."),
        );
      transaction.onabort = () =>
        reject(
          transaction.error ??
            new Error("Lecture des imports locaux impossible."),
        );
    });
  } finally {
    database.close();
  }
}

async function saveSnapshot(
  state,
  {
    indexedDb = globalThis.indexedDB,
    financialFileHandle = null,
    financialFileSignature = "",
  } = {},
) {
  const database = await openDatabase(indexedDb);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(
        createPersistedSourceSnapshot(state, {
          financialFileHandle,
          financialFileSignature,
        }),
        SNAPSHOT_KEY,
      );
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () =>
        reject(
          transaction.error ??
            new Error("Écriture des imports locaux impossible."),
        );
      transaction.onabort = () =>
        reject(
          transaction.error ??
            new Error("Écriture des imports locaux impossible."),
        );
    });
  } finally {
    database.close();
  }
}

async function clearSnapshot(indexedDb = globalThis.indexedDB) {
  const database = await openDatabase(indexedDb);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(SNAPSHOT_KEY);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () =>
        reject(
          transaction.error ??
            new Error("Suppression des imports locaux impossible."),
        );
      transaction.onabort = () =>
        reject(
          transaction.error ??
            new Error("Suppression des imports locaux impossible."),
        );
    });
  } finally {
    database.close();
  }
}

let pendingMutation = Promise.resolve();
function serializeMutation(operation) {
  const result = pendingMutation.then(operation, operation);
  pendingMutation = result.catch(() => {});
  return result;
}
export function saveDashboardSources(state, options = {}) {
  return serializeMutation(() => saveSnapshot(state, options));
}
export function clearPersistedDashboardSources(
  indexedDb = globalThis.indexedDB,
) {
  return serializeMutation(() => clearSnapshot(indexedDb));
}
