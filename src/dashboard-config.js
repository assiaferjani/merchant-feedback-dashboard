import { NAV } from "./navigation.js";
export const PAGE_TITLES = Object.fromEntries(
  NAV.map((item) => [item.id, item.label]),
);

export const FINANCIAL_PAGE_IDS = new Set([
  "revenue",
  "students",
  "schedule",
  "formations",
  "data-sources",
]);

export const COMMERCIAL_NAV = NAV.filter(
  (item) => !FINANCIAL_PAGE_IDS.has(item.id),
);

export const FINANCIAL_NAV = NAV.filter((item) =>
  FINANCIAL_PAGE_IDS.has(item.id),
);

export const PAGE_SUBTITLES = {
  students: "Situation individuelle, inscriptions et échéances à venir.",
  schedule: "Montants prévus et réglés, échéances et statuts de paiement.",
  formations: "Comparez les résultats et les montants par formation.",
  "data-sources":
    "Gérez vos fichiers, les correspondances et la qualité des données.",
  overview: "Vue synthétique des indicateurs commerciaux disponibles.",
  pipeline: "Suivi des candidats et de leurs étapes de traitement.",
  revenue: "Analyse financière basée sur le fichier importé localement.",
  followups: "Priorités de relance définies par les données disponibles.",
  report: "Synthèse commerciale et résultats de la période.",
  feedback: "Avis commerçants, tendances et commentaires récents.",
};

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
];

export const FRENCH_NUMBER = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

export const FRENCH_PERCENT = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 1,
});

export const fmtCount = (value) =>
  value === null || value === undefined ? "—" : FRENCH_NUMBER.format(value);

export const fmtPercent = (value) =>
  value === null || value === undefined ? "—" : FRENCH_PERCENT.format(value);

export const fmtCurrency = (value, currency) => {
  if (value === null || value === undefined || !currency) return "—";
  try {
    return new Intl.NumberFormat("fr-TN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return "—";
  }
};

export function formatDateFr(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(String(value))) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.valueOf())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(date);
}

export function formatMonthFr(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value));
  if (!match) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}
