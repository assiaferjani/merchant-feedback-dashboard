export const NAV = [
  { id: "overview", label: "Vue d’ensemble", icon: "dashboard" },
  { id: "pipeline", label: "Pipeline candidats", icon: "pipeline" },
  { id: "revenue", label: "Revenus & inscriptions", icon: "euro" },
  { id: "students", label: "Étudiants & inscriptions", icon: "candidate" },
  { id: "schedule", label: "Échéancier", icon: "followup" },
  { id: "formations", label: "Analyse par formation", icon: "report" },
  { id: "data-sources", label: "Sources & paramètres", icon: "dashboard" },
  { id: "followups", label: "Relances à traiter", icon: "followup" },
  { id: "report", label: "Rapport commercial", icon: "report" },
];

const PAGE_IDS = new Set([...NAV.map(({ id }) => id), "feedback"]);

export function dashboardPageFromHash(hash = "") {
  if (!hash || hash === "#") return "overview";
  // Leave ordinary in-page anchors (including the skip link) to the browser.
  if (!hash.startsWith("#/")) return null;
  const page = hash.slice(2);
  return PAGE_IDS.has(page) ? page : "overview";
}

export function dashboardPageHash(page) {
  return `#/${PAGE_IDS.has(page) ? page : "overview"}`;
}
