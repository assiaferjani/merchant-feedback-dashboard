import { Fragment, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  displayDate, filterFeedback, getRecentComments, groupByDay, groupByField,
  groupByMonth, parseFeedbackCsv, summarizeFeedback,
} from "./dashboard-data.js";
import {
  filterOverdueFollowups, getFollowupRecords, getOverdueFollowups, previousEquivalentPeriod,
  relativeChange, summarizeCommercialBundle, toCsv, validateCommercialBundle,
} from "./commercial-data.js";
import {
  filterCommercialCsv, groupCommercialCrossTab, groupCommercialCsv, MISSING_RESPONSIBLE_FILTER, parseCommercialCsvFile, resolveCommercialSourceState,
  summarizeCommercialCsv,
} from "./commercial-csv.js";
import { dashboardCsvReducer, importCsvWith, importFinancialCsvWith, importTuitionCsvWith, initialDashboardCsvState, isFinancialCsvConnected, resolveDashboardTheme, toggleDashboardTheme } from "./dashboard-state.js";
import { FINANCIAL_FIELDS, mapFinancialDataset, parseFinancialCsvFile, parseFinancialDate } from "./financial-csv.js";
import { getDateRangeForPage, getDateRangePreset, isValidDateRange } from "./date-filters.js";
import { TUITION_SOURCE_FIELDS, discoverTuitionCsvFile, summarizeStudents, summarizeSchedule, countField, groupTuitionByFormation } from "./tuition-data.js";
import { loadPersistedDashboardSources, saveDashboardSources, clearPersistedDashboardSources } from "./local-source-storage.js";
import { getFinancialFileSignature, refreshLinkedFinancialFile } from "./financial-file-sync.js";

const NAV = [
  { id: "overview", label: "Vue d’ensemble", icon: "dashboard" },
  { id: "pipeline", label: "Pipeline candidats", icon: "pipeline" },
  { id: "revenue", label: "Revenus & inscriptions", icon: "euro" },
  { id: "students", label: "Étudiants & inscriptions", icon: "candidate" },
  { id: "schedule", label: "Échéancier", icon: "followup" },
  { id: "formations", label: "Analyse par formation", icon: "report" },
  { id: "data-sources", label: "Référentiels & paramètres", icon: "dashboard" },
  { id: "followups", label: "Relances à traiter", icon: "followup" },
  { id: "report", label: "Rapport commercial", icon: "report" },
];
const PAGE_TITLES = Object.fromEntries(NAV.map((item) => [item.id, item.label]));
const FINANCIAL_PAGE_IDS = new Set(["revenue", "students", "schedule", "formations", "data-sources"]);
const COMMERCIAL_NAV = NAV.filter((item) => !FINANCIAL_PAGE_IDS.has(item.id));
const FINANCIAL_NAV = NAV.filter((item) => FINANCIAL_PAGE_IDS.has(item.id));
const PAGE_SUBTITLES = {
  students: "Situation individuelle, identifiants distincts et echeances a venir.",
  schedule: "Montants prevus et payes par echeance, selon les dates et statuts fournis.",
  formations: "Comparaison par formation sans melanger les periodes ou les sources.",
  "data-sources": "Imports locaux, mappings de colonnes et controles de qualite.",
  overview: "Vue synthétique des indicateurs commerciaux disponibles.",
  pipeline: "Suivi des candidats et de leurs étapes de traitement.",
  revenue: "Analyse financière basée sur le fichier importé localement.",
  followups: "Priorités de relance définies par les données disponibles.",
  report: "Synthèse commerciale et résultats de la période.",
  feedback: "Avis commerçants, tendances et commentaires récents.",
};
const CHART_COLORS = ["#3B82F6", "#6366F1", "#8B5CF6", "#14B8A6", "#F97373", "#F59E0B", "#94A3B8"];
const FRENCH_NUMBER = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const FRENCH_PERCENT = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });
const fmtCount = (value) => value === null || value === undefined ? "—" : FRENCH_NUMBER.format(value);
const fmtPercent = (value) => value === null || value === undefined ? "—" : FRENCH_PERCENT.format(value);
const fmtCurrency = (value, currency) => {
  if (value === null || value === undefined || !currency) return "—";
  try { return new Intl.NumberFormat("fr-TN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
  catch { return "—"; }
};

function Icon({ name }) {
  const paths = {
    total: <><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 9h8M8 13h8M8 17h4"/></>,
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="14" width="8" height="7" rx="1.5"/></>,
    pipeline: <><circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="12" r="2.2"/><circle cx="6" cy="18" r="2.2"/><path d="M8.3 6h3.2a3 3 0 0 1 3 3v.1M8.3 18h3.2a3 3 0 0 0 3-3v-.1"/></>,
    followup: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M18.5 5.5l1.5-1.5"/></>,
    report: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></>,
    shop: <><path d="M3 10h18l-1.5-6h-15L3 10Z"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    region: <><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.2"/></>,
    comment: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-4-.9L4 20l1.5-3.5A7.3 7.3 0 0 1 4 12c0-4.2 3.6-7.5 8-7.5s8 2.8 8 7Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></>,
    percent: <><path d="m19 5-14 14"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></>,
    euro: <><path d="M18 5a7 7 0 1 0 0 14M4 10h10M4 14h8"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
    moon: <path d="M20.8 14.3A8.5 8.5 0 0 1 9.7 3.2 8.5 8.5 0 1 0 20.8 14.3Z"/>,
    candidate: <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 11a3 3 0 1 0 0-6M18 14c1.9.8 3 2.3 3 4.5"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.total}</svg>;
}

function NavigationButton({ item, active, onNavigate }) {
  const selected = active === item.id;
  return <button type="button" className={`nav-item ${selected ? "active" : ""}`} aria-current={selected ? "page" : undefined} title={item.label} onClick={() => onNavigate(item.id)}><span className="nav-icon"><Icon name={item.icon}/></span><span className="nav-label">{item.label}</span></button>;
}

function Sidebar({ active, onNavigate, feedbackCount }) {
  return <aside className="sidebar">
    <div className="sidebar-brand"><span className="sidebar-brand-icon"><Icon name="dashboard" /></span><span><b>FACULTÉ</b><small>PILOTAGE COMMERCIAL</small></span></div>
    <div className="sidebar-navigation-groups">
      <div className="sidebar-navigation-group"><div className="sidebar-section-label">ESPACE COMMERCIAL</div><nav className="sidebar-nav" aria-label="Navigation commerciale">{COMMERCIAL_NAV.map((item) => <NavigationButton key={item.id} item={item} active={active} onNavigate={onNavigate}/>)}</nav></div>
      <div className="sidebar-navigation-group financial-navigation-group"><div className="sidebar-section-label">FINANCES</div><nav className="sidebar-nav" aria-label="Navigation financière">{FINANCIAL_NAV.map((item) => <NavigationButton key={item.id} item={item} active={active} onNavigate={onNavigate}/>)}</nav></div>
      <div className="sidebar-navigation-group feedback-navigation-group"><div className="sidebar-section-label">SUIVI DES RETOURS</div><button type="button" className={`nav-item ${active === "feedback" ? "active" : ""}`} aria-current={active === "feedback" ? "page" : undefined} title="Retours commerçants" onClick={() => onNavigate("feedback")}><span className="nav-icon"><Icon name="comment"/></span><span className="nav-label">Retours commerçants</span><span className="nav-count">{feedbackCount}</span></button></div>
    </div>
    <div className="sidebar-bottom"><span className="sidebar-avatar">RC</span><span><b>Responsable commercial</b><small>Environnement de développement</small></span></div>
  </aside>;
}

function PeriodControls({ startDate, endDate, setPeriod, setPeriodRange, clearPeriod, financial = false }) {
  const [rangeError, setRangeError] = useState("");
  const currentRange = { startDate, endDate };
  const setField = (field, value) => {
    const next = { ...currentRange, [field]: value };
    if (!isValidDateRange(next)) {
      setRangeError("La date de début doit être antérieure ou égale à la date de fin.");
      return;
    }
    setRangeError("");
    setPeriod(field, value);
  };
  const choosePreset = (event) => {
    if (!event.target.value) return;
    setPeriodRange(getDateRangePreset(event.target.value));
    setRangeError("");
    event.target.value = "";
  };
  return <div className={`period-control-wrap ${financial ? "financial-period-controls" : "commercial-period-controls"}`}>
    <div className="period-controls" aria-label={financial ? "Filtre de période financière" : "Filtre de période commerciale"}>
      <label><span>Du</span><input aria-label="Date de début" type="date" value={startDate} max={endDate || undefined} onChange={(event) => setField("startDate", event.target.value)} /></label>
      <span className="period-separator">—</span>
      <label><span>Au</span><input aria-label="Date de fin" type="date" value={endDate} min={startDate || undefined} onChange={(event) => setField("endDate", event.target.value)} /></label>
      <select className="period-preset" aria-label="Raccourci de période" value="" onChange={choosePreset}>
        <option value="">Période…</option>
        <option value="7-days">7 derniers jours</option>
        <option value="30-days">30 derniers jours</option>
        <option value="month">Mois en cours</option>
        <option value="year">Année en cours</option>
      </select>
      {(startDate || endDate) && <button className="period-clear" type="button" onClick={() => { clearPeriod(); setRangeError(""); }}>Réinitialiser</button>}
    </div>
    {rangeError && <span className="period-range-error" role="alert">{rangeError}</span>}
  </div>;
}

function Header({ active, startDate, endDate, setPeriod, setPeriodRange, clearPeriod, onFeedback, onImport, onFinancialImport, dataState, financialActive, financialPeriodUnavailable = false, financialContext = false, theme = "light", onToggleTheme }) {
  const title = active === "feedback" ? "Retours commerçants" : PAGE_TITLES[active];
  return <header className="app-header">
    <div className="app-header-context"><div className="breadcrumb"><span>Faculté</span><span className="breadcrumb-slash">/</span><b>{title}</b></div><p>{PAGE_SUBTITLES[active] ?? PAGE_SUBTITLES.overview}</p></div>
    <div className="header-tools">{active === "revenue" && financialPeriodUnavailable ? <span className="financial-period-unavailable" title="Le fichier contient des libellés mensuels sans date complète">Période financière : sélection par mois dans le rapport</span> : <PeriodControls startDate={startDate} endDate={endDate} setPeriod={setPeriod} setPeriodRange={setPeriodRange} clearPeriod={clearPeriod} financial={financialContext}/>}<span className={`source-badge ${dataState === "connected" ? "connected" : dataState === "imported" ? "csv-active" : "synthetic"}`} title="Source des avis commerciaux"><i/>{dataState === "imported" ? "Avis commerciaux : CSV importé" : dataState === "connected" ? "Avis commerciaux : source configurée" : "Avis commerciaux : non connecté"}</span><span className={`source-badge ${financialActive ? "csv-active" : "synthetic"}`} title="Source financière indépendante"><i/>{financialActive ? "Finances : CSV importé" : "Finances : non connecté"}</span>{active === "followups" ? <FinancialCsvImportButton onFile={onFinancialImport} label={financialActive ? "Remplacer la synthèse" : "Importer la synthèse financière"}/> : <CsvImportButton onFile={onImport} label="Importer mon CSV"/>}<button type="button" className="theme-toggle" onClick={onToggleTheme} aria-label={`Activer le mode ${theme === "dark" ? "clair" : "sombre"}`} title={`Mode ${theme === "dark" ? "clair" : "sombre"}`}><Icon name={theme === "dark" ? "sun" : "moon"}/><span>{theme === "dark" ? "Clair" : "Sombre"}</span></button><button className="header-feedback-link" onClick={onFeedback}>Aide</button></div>
  </header>;
}

function CsvImportButton({ onFile, label = "Importer mon CSV" }) {
  const inputRef = useRef(null);
  return <><button className="primary-button import-csv-button" type="button" onClick={() => inputRef.current?.click()}>{label}</button><input ref={inputRef} className="visually-hidden-input" type="file" accept=".csv,text/csv" aria-label="Choisir un fichier CSV d’avis local" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ""; }}/></>;
}

function FinancialCsvImportButton({ onFile, label = "Importer le fichier financier" }) {
  const inputRef = useRef(null);
  return <><button className="primary-button financial-import-button" type="button" onClick={() => inputRef.current?.click()}>{label}</button><input ref={inputRef} className="visually-hidden-input" type="file" accept=".csv,text/csv" aria-label="Choisir un fichier financier CSV local" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ""; }}/></>;
}

function PageTitle({ eyebrow = "PILOTAGE COMMERCIAL", title, subtitle, badge = "Synthétique" }) {
  return <section className="page-title-row"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div><span className="synthetic-tag"><i/>{badge}</span></section>;
}

function MetricCard({ title, value, helper, icon, unavailable = false, comparison }) {
  return <article className={`commercial-metric ${unavailable ? "unavailable" : ""}`}>
    <div className="commercial-metric-top"><span>{title}</span><span className="commercial-metric-icon"><Icon name={icon}/></span></div>
    <div className="commercial-metric-value">{value}</div>
    <div className="commercial-metric-footer"><span>{helper}</span>{comparison && <b>{comparison}</b>}</div>
  </article>;
}

function Panel({ title, subtitle, action, className = "", children }) {
  return <section className={`commercial-panel ${className}`}><div className="commercial-panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>;
}

function EmptyState({ title = "Données non disponibles", detail, compact = false }) {
  return <div className={`commercial-empty ${compact ? "compact" : ""}`}><span className="empty-icon">⌁</span><b>{title}</b><p>{detail || "La source ne contient pas les champs requis pour calculer cet indicateur."}</p></div>;
}

function SourceAlert({ configError, localCsvActive = false, localCsvSource = null }) {
  const showConfigError = Boolean(configError) && !localCsvActive;
  const title = showConfigError
    ? "Le fichier commercial configuré n’est pas exploitable"
    : localCsvActive
      ? "CSV local chargé — source avis active"
      : "Aucune source commerciale n’est connectée";
  const detail = showConfigError
    || (localCsvActive
      ? `Le CSV local ${localCsvSource?.fileName ? `« ${localCsvSource.fileName} »` : "importé"} (${localCsvSource?.rows?.length ?? 0} lignes) est actif. Il fournit les avis, mais pas les tables ou champs nécessaires pour calculer les activités commerciales, les inscriptions, les revenus, les objectifs ou les échéances de relance.`
      : "Le jeu disponible contient uniquement des champs de retours commerçants. Il ne contient ni activités de prospection, ni statuts candidats confirmés, ni inscriptions, paiements, objectifs ou échéances de relance.");
  return <section className={`source-alert ${showConfigError ? "source-alert-error" : ""}`}>
    <span className="source-alert-icon">{showConfigError ? "!" : "i"}</span>
    <div><b>{title}</b>
      <p>{detail}</p>
      <small>{localCsvActive ? "Les métriques non couvertes restent indisponibles et ne sont pas remplacées par des zéros." : "Les indicateurs commerciaux restent indisponibles jusqu’à la configuration d’une source autorisée conforme au contrat de données. Les cartes ne sont pas affichées à zéro."}</small>
    </div>
  </section>;
}

function ChartEmpty({ children = "Aucune donnée à représenter pour la période choisie." }) { return <div className="chart-empty">{children}</div>; }

function DownloadButton({ label, rows, columns, disabled = false, filename = "rapport-commercial.csv" }) {
  const download = () => {
    if (disabled || !rows.length) return;
    const blob = new Blob([`\uFEFF${toCsv(rows, columns)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
  };
  return <button className="outline-button" onClick={download} disabled={disabled || !rows.length}>↓ {label}</button>;
}

function ChartTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><b>{label}</b>{payload.map((item) => <span key={item.dataKey}><i style={{ background: item.color }}/> {item.name}: {typeof item.value === "number" ? (currency ? fmtCurrency(item.value, currency) : FRENCH_NUMBER.format(item.value)) : item.value}</span>)}</div>;
}

function CommercialOverview({ summary, previousSummary, available, error }) {
  const deltaLabel = (current, previous) => {
    const change = previousSummary?.valid ? relativeChange(current, previous) : null;
    if (!previousSummary?.valid) return "Sélectionnez une période pour comparer";
    if (change === null) return "Comparaison non disponible";
    const sign = change > 0 ? "+" : "";
    return `${sign}${fmtPercent(change)} vs période précédente`;
  };
  const kpis = [
    ["Activités commerciales", available ? fmtCount(summary.activityCount) : "—", "Événements distincts sur la période", "total", !available, available ? deltaLabel(summary.activityCount, previousSummary?.activityCount) : null],
    ["Revenus encaissés", available ? fmtCurrency(summary.collectedRevenue, summary.currency) : "—", available && summary.currency ? "Paiements encaissés uniques" : "Montant et devise à confirmer", "euro", !available || summary.collectedRevenue === null, available ? deltaLabel(summary.collectedRevenue, previousSummary?.collectedRevenue) : null],
    ["Inscriptions confirmées", available ? fmtCount(summary.confirmedEnrollments) : "—", "Références d’inscription uniques", "candidate", !available, available ? deltaLabel(summary.confirmedEnrollments, previousSummary?.confirmedEnrollments) : null],
    ["Objectifs mensuels atteints", available ? fmtPercent(summary.revenueAchievement) : "—", available && summary.remainingRevenueTarget !== null ? `Reste ${fmtCurrency(summary.remainingRevenueTarget, summary.currency)}` : "Objectif non fourni", "target", !available || summary.revenueAchievement === null],
    ["Dossiers en retard", available ? fmtCount(summary.overdueCandidateCount) : "—", "Échéance passée, tâche non terminée", "region", !available],
  ];
  return <>
    <PageTitle title="Vue d’ensemble" subtitle="Activité, inscriptions et revenus sur la période sélectionnée." badge={available ? "Source configurée" : "Prototype"}/>
    {!available && <SourceAlert configError={error}/>}
    <div className="commercial-kpi-grid">{kpis.map(([title, value, helper, icon, unavailable, comparison]) => <MetricCard key={title} title={title} value={value} helper={helper} icon={icon} unavailable={unavailable} comparison={comparison} />)}</div>
    <div className="commercial-grid overview-grid">
      <Panel title="Activités commerciales" subtitle="Événements distincts par mois" className="panel-span-two">
        {available && summary.monthlyActivities.length ? <ResponsiveContainer width="100%" height={268}><AreaChart data={summary.monthlyActivities} margin={{ top: 12, right: 10, left: -16, bottom: 0 }}><defs><linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82b8" stopOpacity={0.22}/><stop offset="100%" stopColor="#3b82b8" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e9eef1" strokeDasharray="3 4"/><XAxis dataKey="month" tickFormatter={formatMonthFr} tick={{ fill: "#7b8a91", fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{ fill: "#7b8a91", fontSize: 11 }} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Area dataKey="value" name="Activités" type="monotone" stroke="#347eb4" strokeWidth={2.3} fill="url(#activityFill)"/></AreaChart></ResponsiveContainer> : <EmptyState compact/>}
      </Panel>
      <Panel title="Statuts actuels des candidats" subtitle="Comptage des dossiers distincts, non des activités" >
        {available && summary.statusCounts.length ? <ResponsiveContainer width="100%" height={268}><BarChart data={summary.statusCounts} layout="vertical" margin={{ left: 12, right: 18, top: 3, bottom: 3 }}><CartesianGrid horizontal={false} stroke="#e9eef1" strokeDasharray="3 4"/><XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#7b8a91", fontSize: 11 }}/><YAxis type="category" dataKey="label" width={120} axisLine={false} tickLine={false} tick={{ fill: "#596c73", fontSize: 11 }}/><Tooltip content={<ChartTooltip/>}/><Bar dataKey="count" name="Dossiers" fill="#3a9a91" radius={[0, 5, 5, 0]} barSize={22}/></BarChart></ResponsiveContainer> : <EmptyState compact/>}
      </Panel>
      <Panel title="Revenus encaissés" subtitle="Somme des paiements encaissés uniques par mois">
        {available && summary.monthlyRevenue.length ? <ResponsiveContainer width="100%" height={238}><BarChart data={summary.monthlyRevenue}><CartesianGrid vertical={false} stroke="#e9eef1" strokeDasharray="3 4"/><XAxis dataKey="month" tickFormatter={formatMonthFr} tick={{ fill: "#7b8a91", fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: "#7b8a91", fontSize: 11 }} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>} formatter={(value) => fmtCurrency(value, summary.currency)}/><Bar dataKey="value" name="Encaissé" fill="#36a097" radius={[5, 5, 0, 0]} maxBarSize={36}/></BarChart></ResponsiveContainer> : <EmptyState compact detail="Paiements, dates, montants et devise confirmée nécessaires."/>}
      </Panel>
      <Panel title="Répartition du pipeline" subtitle="Étapes disponibles dans l’historique candidat">
        {available && summary.pipelineConversion.length ? <div className="conversion-list">{summary.pipelineConversion.map((step) => <div className="conversion-row" key={`${step?.fromStatus}-${step?.toStatus}`}><span>{step?.fromStatus} <i>→</i> {step?.toStatus}</span><b>{step ? fmtPercent(step.rate) : "—"}</b><small>{step ? `${fmtCount(step.converted)} / ${fmtCount(step.entered)} dossiers` : "Étapes à configurer"}</small></div>)}</div> : <EmptyState compact detail="Une table d’historique des changements de statut et une configuration d’étapes sont nécessaires."/>}
      </Panel>
    </div>
    <p className="page-footnote">Les comparaisons de période précédente s’affichent lorsqu’une source historique complète est fournie. Aucun écart n’est estimé à partir du jeu de retours.</p>
  </>;
}

function PipelinePage({ summary, available, error, dateRange, bundle, csvRows, csvSourceInfo, csvFilters, setCsvFilters, localCsvActive }) {
  if (!available && csvSourceInfo) return <ImportedCsvPipeline rows={csvRows} dateRange={dateRange} sourceInfo={csvSourceInfo} filters={csvFilters} setFilters={setCsvFilters}/>;
  const statuses = available ? summary.statusCounts : [];
  const activityTypes = available ? (bundle.activities ?? []).filter((row) => (!dateRange.startDate || row.activity_date >= dateRange.startDate) && (!dateRange.endDate || row.activity_date <= dateRange.endDate)) : [];
  return <>
    <PageTitle title="Pipeline candidats" subtitle="États de dossiers et événements commerciaux, suivis séparément." badge={available ? "Source configurée" : "Prototype"}/>
    {!available && <SourceAlert configError={error} localCsvActive={localCsvActive}/>}
    <div className="commercial-grid">
      <Panel title="Répartition par statut" subtitle="Statut actuel par candidat distinct" className="panel-span-two">
        {statuses.length ? <ResponsiveContainer width="100%" height={310}><BarChart data={statuses} layout="vertical" margin={{ left: 16, right: 22 }}><CartesianGrid horizontal={false} stroke="#e8eef0"/><XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="label" width={155} axisLine={false} tickLine={false} tick={{ fill: "#53666c", fontSize: 12 }}/><Tooltip content={<ChartTooltip/>}/><Bar dataKey="count" name="Candidats" fill="#317db5" radius={[0, 5, 5, 0]} barSize={24}/></BarChart></ResponsiveContainer> : <EmptyState/>}
      </Panel>
      <Panel title="Activités après inscription" subtitle="Événements rattachés aux dossiers inscrits">
        {available ? <div className="single-stat"><b>{fmtCount(summary.postEnrollmentActivityCount ?? 0)}</b><span>activités identifiées après inscription</span><small>Calculé par rapprochement des événements et inscriptions confirmées.</small></div> : <EmptyState/>}
      </Panel>
      <Panel title="Rendez-vous en attente" subtitle="Statuts source explicitement configurés">
        {available && summary.pendingAppointments !== null ? <div className="single-stat"><b>{fmtCount(summary.pendingAppointments)}</b><span>rendez-vous en attente</span><small>Le statut d’attente doit être confirmé par le propriétaire des données.</small></div> : <EmptyState compact detail="Une table de rendez-vous et ses statuts confirmés sont nécessaires."/>}
      </Panel>
      <Panel title="Rendez-vous par statut" subtitle="Valeurs source brutes; libellés à confirmer">
        {available && summary.appointmentStatusCounts.length ? <StatusRows rows={summary.appointmentStatusCounts.map((row) => ({ name: row.label, count: row.count }))}/> : <EmptyState compact/>}
      </Panel>
      <Panel title="Types d’activité" subtitle="Événements distincts, avec filtres de date">
        {activityTypes.length ? <StatusRows rows={countBy(activityTypes, "activity_type", "activity_id")} empty={false}/> : <EmptyState compact/>}
      </Panel>
      <Panel title="Conversions de parcours" subtitle="Cohortes entrées dans l’étape pendant la période" className="panel-span-two">
        {available && summary.pipelineConversion.length ? <ConversionTable steps={summary.pipelineConversion}/> : <EmptyState compact detail="Historique horodaté des transitions requis; les statuts actuels seuls ne suffisent pas."/>}
      </Panel>
    </div>
  </>;
}

function countBy(rows, field, idField) {
  const seenIds = new Set(); const counts = new Map();
  rows.forEach((row) => { if (!row[idField] || seenIds.has(row[idField])) return; seenIds.add(row[idField]); const key = row[field] || "Non renseigné"; counts.set(key, (counts.get(key) ?? 0) + 1); });
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function StatusRows({ rows, empty = true }) {
  if (!rows.length) return empty ? <EmptyState compact/> : null;
  return <div className="status-rows">{rows.map((row, index) => <div className="status-row" key={row.name}><span className="status-index">{String(index + 1).padStart(2, "0")}</span><span>{row.name}</span><b>{fmtCount(row.count)}</b></div>)}</div>;
}

function ConversionTable({ steps }) {
  return <div className="conversion-list">{steps.map((step, index) => <div className="conversion-row" key={`${step?.fromStatus}-${step?.toStatus}-${index}`}><span>{step?.fromStatus || "Étape non configurée"} <i>→</i> {step?.toStatus || "Étape suivante"}</span><b>{step ? fmtPercent(step.rate) : "—"}</b><small>{step ? `${fmtCount(step.converted)} conversions sur ${fmtCount(step.entered)} entrées` : "Mappage de statut requis"}</small></div>)}</div>;
}

function RevenuePage({ summary, available, error, localCsvSource = null }) {
  const localCsvActive = Boolean(localCsvSource);
  return <>
    <PageTitle title="Revenus & inscriptions" subtitle="Encaissements, objectifs et inscriptions confirmées uniquement." badge={available ? "Source configurée" : "Prototype"}/>
    {!available && <SourceAlert configError={error} localCsvActive={localCsvActive} localCsvSource={localCsvSource}/>}
    <div className="commercial-kpi-grid revenue-kpis">
      <MetricCard title="Revenus encaissés" value={available ? fmtCurrency(summary.collectedRevenue, summary.currency) : "—"} helper="Paiements encaissés uniques" icon="euro" unavailable={!available || summary.collectedRevenue === null}/>
      <MetricCard title="Revenus contractés" value={available ? fmtCurrency(summary.contractedRevenue, summary.currency) : "—"} helper="Statuts contractuels confirmés" icon="euro" unavailable={!available || summary.contractedRevenue === null}/>
      <MetricCard title="Prévision de revenus" value={available ? fmtCurrency(summary.forecastRevenue, summary.currency) : "—"} helper="Prévisions selon la configuration source" icon="target" unavailable={!available || summary.forecastRevenue === null}/>
      <MetricCard title="Objectif de revenus" value={available ? fmtCurrency(summary.targetRevenue, summary.currency) : "—"} helper="Mois complets inclus dans la période" icon="target" unavailable={!available || summary.targetRevenue === null}/>
      <MetricCard title="Objectif atteint" value={available ? fmtPercent(summary.revenueAchievement) : "—"} helper="Encaissé / objectif" icon="percent" unavailable={!available || summary.revenueAchievement === null}/>
      <MetricCard title="Inscriptions confirmées" value={available ? fmtCount(summary.confirmedEnrollments) : "—"} helper="Inscriptions uniques confirmées" icon="candidate" unavailable={!available}/>
      <MetricCard title="Objectif inscriptions" value={available ? fmtCount(summary.enrollmentTarget) : "—"} helper="Objectif validé pour la période" icon="target" unavailable={!available || summary.enrollmentTarget === null}/>
    </div>
    <div className="commercial-grid">
      <Panel title="Évolution mensuelle des encaissements" subtitle="Paiements encaissés et objectif mensuel configuré · devise confirmée dans la source" className="panel-span-two">
        {available && summary.monthlyRevenueTrend.length ? <ResponsiveContainer width="100%" height={300}><LineChart data={summary.monthlyRevenueTrend}><CartesianGrid vertical={false} stroke="#e8eef0" strokeDasharray="3 4"/><XAxis dataKey="month" tickFormatter={formatMonthFr} axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip currency={summary.currency}/>}/><Legend verticalAlign="top" height={25}/><Line dataKey="collected" name="Encaissé" stroke="#258d87" strokeWidth={2.5} dot={{ r: 3 }}/><Line dataKey="contracted" name="Contracté" stroke="#347eb4" strokeWidth={1.7} dot={{ r: 2 }}/><Line dataKey="forecast" name="Prévision" stroke="#d29a48" strokeWidth={1.7} strokeDasharray="4 3" dot={false}/><Line dataKey="target" name="Objectif mensuel" stroke="#7e91a4" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls={false}/></LineChart></ResponsiveContainer> : <EmptyState/>}
      </Panel>
      <Panel title="Confirmées par mois" subtitle="Références d’inscription distinctes">
        {available && summary.monthlyEnrollments.length ? <ResponsiveContainer width="100%" height={300}><BarChart data={summary.monthlyEnrollments}><CartesianGrid vertical={false} stroke="#e8eef0" strokeDasharray="3 4"/><XAxis dataKey="month" tickFormatter={formatMonthFr} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Bar dataKey="value" name="Inscriptions" fill="#3c82b8" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer> : <EmptyState compact/>}
      </Panel>
      <Panel title="Inscriptions par spécialité" subtitle="Classement par nombre d’inscriptions" action={<DownloadButton label="CSV" rows={available ? summary.enrollmentBySpecialty : []} columns={[{ key: "name", label: "Spécialité" }, { key: "count", label: "Inscriptions" }]}/> }>
        {available && summary.enrollmentBySpecialty.length ? <StatusRows rows={summary.enrollmentBySpecialty}/> : <EmptyState compact/>}
      </Panel>
      <Panel title="Inscriptions par niveau d’étude" subtitle="Classement par nombre d’inscriptions" action={<DownloadButton label="CSV" rows={available ? summary.enrollmentByStudyLevel : []} columns={[{ key: "name", label: "Niveau d’étude" }, { key: "count", label: "Inscriptions" }]}/> }>
        {available && summary.enrollmentByStudyLevel.length ? <StatusRows rows={summary.enrollmentByStudyLevel}/> : <EmptyState compact/>}
      </Panel>
      <Panel title="Encaissements par spécialité" subtitle={summary.currency ? `Montants en ${summary.currency}` : "Devise non confirmée"} action={<DownloadButton label="CSV" rows={available ? summary.revenueBySpecialty : []} columns={[{ key: "name", label: "Spécialité" }, { key: "amount", label: "Montant encaissé" }]}/> }>
        {available && summary.revenueBySpecialty.length ? <RevenueRows rows={summary.revenueBySpecialty} currency={summary.currency}/> : <EmptyState compact detail="Paiements, spécialités et devise homogène nécessaires."/>}
      </Panel>
      <Panel title="Encaissements par niveau" subtitle={summary.currency ? `Montants en ${summary.currency}` : "Devise non confirmée"} action={<DownloadButton label="CSV" rows={available ? summary.revenueByStudyLevel : []} columns={[{ key: "name", label: "Niveau d’étude" }, { key: "amount", label: "Montant encaissé" }]}/> }>
        {available && summary.revenueByStudyLevel.length ? <RevenueRows rows={summary.revenueByStudyLevel} currency={summary.currency}/> : <EmptyState compact detail="Paiements, niveaux d’étude et devise homogène nécessaires."/>}
      </Panel>
    </div>
    {available && summary.warnings.length > 0 && <div className="quality-warning">{summary.warnings.length} avertissement(s) de qualité des données. Vérifiez l’export avant d’utiliser les résultats.</div>}
  </>;
}

const fmtMoneyUnknownCurrency = (value) => value === null || value === undefined
  ? "Indisponible"
  : `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)} · devise à confirmer`;

function FinancialPage(props) {
  return props.source?.reportModel
    ? <FinancialSummaryPage key={props.source.fileName} {...props}/>
    : <GenericFinancialPage {...props}/>;
}

function TuitionCsvImportButton({ sourceType, onFile, label }) {
  const inputRef = useRef(null);
  return <><button className="primary-button" type="button" onClick={() => inputRef.current?.click()}>{label}</button><input ref={inputRef} className="visually-hidden-input" type="file" accept=".csv,text/csv" aria-label={`Importer la source ${sourceType}`} onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file, sourceType); event.target.value = ""; }}/></>;
}

function FinancialSummaryPage({ source, error, onImport }) {
  const [month, setMonth] = useState("");
  const [program, setProgram] = useState("");
  const mapped = source?.mapped ?? mapFinancialDataset(source, source?.mapping);
  const monthlyRows = mapped.monthlyRows.filter((row) => !month || row.period === month);
  const programRows = mapped.programRows.filter((row) => !program || row.name === program)
    .slice().sort((a, b) => (b.collectedAmount ?? 0) - (a.collectedAmount ?? 0));
  const sum = (rows, key) => {
    const values = rows.map((row) => row[key]).filter((value) => typeof value === "number" && Number.isFinite(value));
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };
  const formatMoney = (value) => value == null ? "Indisponible" : fmtMoneyUnknownCurrency(value);
  const monthlyCollected = sum(monthlyRows, "collectedAmount");
  const monthlyPlanned = sum(monthlyRows, "plannedAmount");
  const programCollected = sum(programRows, "collectedAmount");
  const programRemaining = sum(programRows, "remainingAmount");
  const aggregateTotalsDiffer = [
    [mapped.metrics.plannedAmount, mapped.metrics.programPlannedAmount],
    [mapped.metrics.collectedAmount, mapped.metrics.programCollectedAmount],
  ].some(([monthly, programs]) => monthly !== null && monthly !== undefined && programs !== null && programs !== undefined && Math.abs(monthly - programs) > 0.005);
  const monthlyExport = monthlyRows.map((row) => ({ periode: row.period, montant_prevu: row.plannedAmount, montant_collecte: row.collectedAmount, ecart_source: row.gapAmount, taux_source: row.reportedRate }));
  const programExport = programRows.map((row) => ({ filiere: row.name, montant_prevu: row.plannedAmount, montant_collecte: row.collectedAmount, reste_a_encaisser: row.remainingAmount, taux_source: row.reportedRate }));
  return <>
    <PageTitle eyebrow="SUIVI FINANCIER" title="Revenus & inscriptions" subtitle="Synthèse financière agrégée importée localement. Le fichier ne contient pas de lignes individuelles d’étudiants ou de paiements." badge="Synthèse CSV active"/>
    <div className="financial-source-card"><div><b>Source financière locale active</b><span>{fmtCount(mapped.monthlyRows.length)} périodes mensuelles · {fmtCount(mapped.programRows.length)} agrégats par filière · conservées localement dans ce navigateur</span><small>Les totaux mensuels et par filière sont deux tableaux agrégés distincts dans l’export.</small></div><FinancialCsvImportButton onFile={onImport} label="Remplacer le fichier financier"/></div>
    {error && <div className="csv-import-error" role="alert"><b>Problème de correspondance</b><span>{error}</span></div>}
    <section className="financial-report-filters" aria-label="Filtres financiers">
      <label><span>Mois</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="">Tous les mois</option>{mapped.monthlyRows.map((row, index) => <option value={row.period} key={`${row.period}-${index}`}>{row.period}</option>)}</select></label>
      <label><span>Filière</span><select value={program} onChange={(event) => setProgram(event.target.value)}><option value="">Toutes les filières</option>{mapped.programRows.map((row) => <option value={row.name} key={row.name}>{row.name}</option>)}</select></label>
      {(month || program) && <button type="button" className="outline-button" onClick={() => { setMonth(""); setProgram(""); }}>Réinitialiser</button>}
      <span className="financial-filter-note">Le fichier ne fournit pas de croisement mois × filière. Ses lignes de total sont exclues des sommes pour éviter le double comptage.</span>
    </section>
    {aggregateTotalsDiffer && <div className="quality-warning" role="status"><b>Rapprochement à confirmer.</b> Les sommes des tableaux mensuels et par filière diffèrent. Ces agrégats restent indépendants; leurs définitions et périmètres ne sont pas confirmés et aucune correction automatique n’est appliquée.</div>}
    <div className="commercial-kpi-grid financial-kpis financial-summary-kpis">
      <MetricCard title="Montant prévu · période mensuelle" value={formatMoney(monthlyPlanned)} helper={`${fmtCount(monthlyRows.length)} mois · valeur source`} icon="target" unavailable={monthlyPlanned === null}/>
      <MetricCard title="Montant collecté · période mensuelle" value={formatMoney(monthlyCollected)} helper="Agrégat mensuel fourni dans le fichier" icon="euro" unavailable={monthlyCollected === null}/>
      <MetricCard title="Montant collecté · filières" value={formatMoney(programCollected)} helper={`${fmtCount(programRows.length)} filière(s) · agrégat distinct`} icon="euro" unavailable={programCollected === null}/>
      <MetricCard title="Reste à encaisser · filières" value={formatMoney(programRemaining)} helper={mapped.metrics.programRemainingMeaningConfirmed ? "Écart source vérifié sur les montants à payer et encaissés" : "Calculé par filière : montant à payer − montant collecté"} icon="total" unavailable={programRemaining === null}/>
    </div>
    <div className="commercial-grid financial-summary-grid">
      <Panel title="Évolution mensuelle des montants" subtitle="Montants prévus et collectés tels qu’agrégés dans l’export" className="panel-span-two" action={<DownloadButton label="Exporter CSV" rows={monthlyExport} columns={[{ key: "periode", label: "Période" }, { key: "montant_prevu", label: "Montant prévu" }, { key: "montant_collecte", label: "Montant collecté" }, { key: "ecart_source", label: "Écart source" }, { key: "taux_source", label: "Taux source" }]}/> }>
        {monthlyRows.length ? <ResponsiveContainer width="100%" height={290}><AreaChart data={monthlyRows} margin={{ top: 8, right: 14, left: 8, bottom: 4 }}><CartesianGrid vertical={false} stroke="#e8eef5" strokeDasharray="3 4"/><XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: "#66758a", fontSize: 11 }}/><YAxis axisLine={false} tickLine={false} tick={{ fill: "#66758a", fontSize: 10 }} tickFormatter={(value) => FRENCH_NUMBER.format(value)}/><Tooltip content={<ChartTooltip/>}/><Legend wrapperStyle={{ fontSize: 11 }}/><Area dataKey="plannedAmount" name="Montant prévu" type="monotone" stroke="#6366F1" fill="#6366F1" fillOpacity={0.12} strokeWidth={2.5}/><Area dataKey="collectedAmount" name="Montant collecté" type="monotone" stroke="#14B8A6" fill="#14B8A6" fillOpacity={0.17} strokeWidth={2.5}/></AreaChart></ResponsiveContainer> : <EmptyState compact title="Aucune période sélectionnée"/>}
      </Panel>
      <Panel title="Montants par filière" subtitle="Comparaison des montants prévus, collectés et restant à encaisser" action={<DownloadButton label="Exporter CSV" rows={programExport} columns={[{ key: "filiere", label: "Filière" }, { key: "montant_prevu", label: "Montant à payer" }, { key: "montant_collecte", label: "Montant collecté" }, { key: "reste_a_encaisser", label: "Écart / Reste à encaisser" }, { key: "taux_source", label: "Taux source" }]}/> }>
        {programRows.length ? <ResponsiveContainer width="100%" height={340}><BarChart data={programRows} layout="vertical" margin={{ top: 5, right: 24, left: 12, bottom: 5 }}><CartesianGrid horizontal={false} stroke="#e8eef5" strokeDasharray="3 4"/><XAxis type="number" tick={{ fill: "#66758a", fontSize: 10 }} tickFormatter={(value) => FRENCH_NUMBER.format(value)} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" width={128} tick={{ fill: "#44546b", fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Legend wrapperStyle={{ fontSize: 10 }}/><Bar dataKey="plannedAmount" name="Montant prévu" fill="#6366F1" radius={[0, 5, 5, 0]}/><Bar dataKey="collectedAmount" name="Montant collecté" fill="#14B8A6" radius={[0, 5, 5, 0]}/></BarChart></ResponsiveContainer> : <EmptyState compact title="Aucune filière dans cette sélection"/>}
      </Panel>
      <Panel title="États de paiement fournis par l’export" subtitle="Comptages globaux inclus dans le fichier, sans détail transactionnel">
        {mapped.statusTotals.length ? <div className="financial-summary-status">{mapped.statusTotals.map((row, index) => <div key={row.name}><i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}/><span>{row.name}</span><b>{fmtCount(row.count)}</b></div>)}</div> : <EmptyState compact title="Comptages d’état indisponibles"/>}
      </Panel>
      <Panel title="Détail mensuel" subtitle={`${fmtCount(monthlyRows.length)} période(s) · pas de date complète dans cette synthèse`}>
        {monthlyRows.length ? <div className="table-scroll"><table className="commercial-table financial-data-table"><thead><tr><th>Période source</th><th>Montant prévu</th><th>Montant collecté</th><th>Écart source</th><th>Taux source</th></tr></thead><tbody>{monthlyRows.map((row, index) => <tr key={`${row.period}-${index}`}><td>{row.period}</td><td>{formatMoney(row.plannedAmount)}</td><td>{formatMoney(row.collectedAmount)}</td><td>{formatMoney(row.gapAmount)}</td><td>{row.reportedRate ?? "—"}</td></tr>)}</tbody></table></div> : <EmptyState compact title="Aucune ligne mensuelle"/>}
      </Panel>
      <Panel title="Détail par filière" subtitle={`${fmtCount(programRows.length)} filière(s) · montants à payer et collectés issus du tableau source`}>
        {programRows.length ? <div className="table-scroll"><table className="commercial-table financial-data-table"><thead><tr><th>Filière</th><th>Montant à payer</th><th>Montant collecté</th><th>Écart / Reste à encaisser</th><th>Taux source</th></tr></thead><tbody>{programRows.map((row) => <tr key={row.name}><td>{row.name}</td><td>{formatMoney(row.plannedAmount)}</td><td>{formatMoney(row.collectedAmount)}</td><td>{formatMoney(row.remainingAmount)}</td><td>{row.reportedRate ?? "—"}</td></tr>)}</tbody></table></div> : <EmptyState compact title="Aucune filière dans cette sélection"/>}
      </Panel>
    </div>
    <Panel title="Limites de cette source" subtitle="Indicateurs non calculés faute de données individuelles"><p className="financial-inline-note">Cet export ne permet pas de calculer les étudiants distincts, les inscriptions distinctes, le nombre de paiements, ni un croisement entre mois et filière. La devise n’est pas confirmée. Les montants et états sont affichés selon les agrégats source, sans extrapolation.</p></Panel>
  </>;
}

function GenericFinancialPage({ source, error, onImport, onMapping, period, embedded = false }) {
  const mapping = source?.mapping ?? {};
  const selectedConfirmed = source?.confirmedPaymentStatuses ?? [];
  const periodField = mapping.paymentDate ? "paymentDate" : "";
  const hasPeriodFilter = Boolean(period?.startDate || period?.endDate);
  const periodSource = useMemo(() => {
    if (!source || (!period?.startDate && !period?.endDate) || !periodField) return source;
    const column = mapping[periodField];
    return { ...source, rows: source.rows.filter((row) => {
      const date = parseFinancialDate(row[column]);
      if (!date) return false;
      const day = date.toISOString().slice(0, 10);
      return (!period.startDate || day >= period.startDate) && (!period.endDate || day <= period.endDate);
    }) };
  }, [source, mapping, period?.startDate, period?.endDate, periodField]);
  const result = useMemo(() => periodSource && (!hasPeriodFilter || periodField) ? mapFinancialDataset(periodSource, mapping, selectedConfirmed) : null, [periodSource, mapping, selectedConfirmed, hasPeriodFilter, periodField]);
  const updateMapping = (field, column) => onMapping({ ...mapping, [field]: column || "" }, selectedConfirmed);
  const updateConfirmed = (status, checked) => onMapping(mapping, checked ? [...selectedConfirmed, status] : selectedConfirmed.filter((item) => item !== status));
  const metrics = result?.metrics;
  const amountAvailable = metrics?.totalRecordedAmount !== null && metrics?.totalRecordedAmount !== undefined;
  const collectedAvailable = metrics?.confirmedCollectedRevenue !== null && metrics?.confirmedCollectedRevenue !== undefined;
  const cards = [
    { title: "Montant total enregistré", value: amountAvailable ? fmtMoneyUnknownCurrency(metrics.totalRecordedAmount) : "Indisponible", helper: amountAvailable ? `${fmtCount(metrics.validAmountCount)} montants valides · somme des lignes, sans statut` : "Associez une colonne de montant valide", icon: "euro", unavailable: !amountAvailable },
    { title: "Revenus encaissés confirmés", value: collectedAvailable ? fmtMoneyUnknownCurrency(metrics.confirmedCollectedRevenue) : "Indisponible", helper: collectedAvailable ? `${fmtCount(selectedConfirmed.length)} statut(s) explicitement confirmé(s)` : "Montant + statut + confirmation des statuts requis", icon: "euro", unavailable: !collectedAvailable },
    { title: "Paiements distincts", value: metrics?.distinctPaymentCount == null ? "Indisponible" : fmtCount(metrics.distinctPaymentCount), helper: metrics?.distinctPaymentCount == null ? "Référence de paiement non mappée" : "Identifiants distincts non vides", icon: "total", unavailable: metrics?.distinctPaymentCount == null },
    { title: "Inscriptions distinctes", value: metrics?.enrollmentCount == null ? "Indisponible" : fmtCount(metrics.enrollmentCount), helper: metrics?.enrollmentCount == null ? "Identifiant d’inscription non mappé" : "Identifiants distincts non vides", icon: "candidate", unavailable: metrics?.enrollmentCount == null },
  ];
  return <>
    {!embedded && <PageTitle title="Revenus & inscriptions" subtitle="Source financière locale, indépendante des avis commerciaux. Seules les métriques étayées par le fichier sont calculées." badge={source ? "CSV local en mémoire" : "Source non connectée"}/>}
    {!embedded && !source && error && <div className="csv-import-error" role="alert"><b>Import financier impossible</b><span>{error}</span></div>}
    {!source ? <section className="financial-empty-state"><span className="financial-empty-icon"><Icon name="euro"/></span><div className="eyebrow">SOURCE FINANCIÈRE</div><h2>Aucun fichier financier importé</h2><p>Importez un CSV local pour découvrir ses colonnes et choisir les correspondances. Aucun fichier n’est envoyé ni conservé après fermeture ou actualisation de cette page.</p><FinancialCsvImportButton onFile={onImport}/><small>Les revenus, inscriptions et objectifs restent indisponibles tant que leurs champs ne sont pas présents et mappés.</small></section> : <>
      {!embedded && <div className="financial-source-card"><div><b>Source financière locale active</b><span>{fmtCount(source.rowCount)} lignes importées en mémoire · {source.headers.length} colonnes détectées · données non transmises</span></div><FinancialCsvImportButton onFile={onImport} label="Remplacer le fichier financier"/></div>}
      {(period?.startDate || period?.endDate) && !periodField && <div className="quality-warning">Le filtre de période est actif, mais aucune date de paiement n’est mappée. Les indicateurs financiers sont masqués jusqu’à ce qu’une date soit disponible.</div>}
      {(period?.startDate || period?.endDate) && periodField && <p className="financial-inline-note">Période appliquée à la date de paiement. Les lignes sans date valide sont exclues de cette sélection.</p>}
      {result && <div className="commercial-kpi-grid financial-kpis">{cards.map((card) => <MetricCard key={card.title} {...card}/>)}</div>}
      <Panel title="Découverte et correspondance des colonnes" subtitle="Choisissez un rôle pour chaque champ. L’aperçu ci-dessous ne montre que les noms de colonnes et des volumes de cellules renseignées; aucune valeur de ligne n’est affichée.">
        <div className="financial-mapping-grid">{FINANCIAL_FIELDS.map((field) => <label key={field.id} className="financial-mapping-field"><span>{field.label}</span><select aria-label={field.label} value={mapping[field.id] ?? ""} onChange={(event) => updateMapping(field.id, event.target.value)}><option value="">Non mappé</option>{source.headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div>
        <div className="table-scroll financial-structure-table"><table className="commercial-table"><thead><tr><th>Colonne détectée</th><th>Cellules renseignées</th><th>Cellules vides</th></tr></thead><tbody>{source.columnProfile.map((column) => <tr key={column.header}><td>{column.header}</td><td>{fmtCount(column.filled)}</td><td>{fmtCount(column.blank)}</td></tr>)}</tbody></table></div>
        {error && <div className="csv-import-error" role="alert"><b>Import / correspondance impossible</b><span>{error}</span></div>}
        {result && (metrics.invalidAmountCount > 0 || metrics.invalidPaymentDateCount > 0 || metrics.invalidEnrollmentDateCount > 0) && <div className="quality-warning" role="status">Valeurs ignorées ou non interprétables : {fmtCount(metrics.invalidAmountCount)} montant(s), {fmtCount(metrics.invalidPaymentDateCount)} date(s) de paiement et {fmtCount(metrics.invalidEnrollmentDateCount)} date(s) d’inscription.</div>}
      </Panel>
      {result && mapping.paymentStatus && <Panel title="Statuts de paiement observés" subtitle="Les libellés sont affichés tels que fournis. Cochez uniquement les statuts dont le propriétaire des données confirme qu’ils signifient un paiement encaissé."><div className="financial-status-options">{result.paymentStatuses.map((status) => <label key={status.name}><input type="checkbox" checked={selectedConfirmed.includes(status.name)} onChange={(event) => updateConfirmed(status.name, event.target.checked)}/><span>{status.name}</span><b>{fmtCount(status.count)}</b></label>)}</div>{!selectedConfirmed.length && <p className="financial-inline-note">Aucun statut confirmé : les revenus encaissés restent indisponibles.</p>}</Panel>}
      {result && <div className="commercial-grid financial-chart-grid">
        <Panel title="Évolution mensuelle des montants enregistrés" subtitle="Somme des montants valides par date de paiement · devise non identifiée" className="panel-span-two">{result.monthly.length ? <ResponsiveContainer width="100%" height={270}><AreaChart data={result.monthly}><CartesianGrid vertical={false} stroke="#e8eef0" strokeDasharray="3 4"/><XAxis dataKey="month" tickFormatter={formatMonthFr} axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Area dataKey="recordedAmount" name="Montant enregistré" type="monotone" stroke="#318b91" fill="#d9f0ed" strokeWidth={2}/></AreaChart></ResponsiveContainer> : <EmptyState compact detail="Associez une date et un montant valides pour afficher la tendance."/>}</Panel>
        <Panel title="Montants encaissés confirmés" subtitle="Seulement si un statut a été explicitement confirmé">{collectedAvailable && result.monthly.length ? <ResponsiveContainer width="100%" height={270}><BarChart data={result.monthly}><CartesianGrid vertical={false} stroke="#e8eef0" strokeDasharray="3 4"/><XAxis dataKey="month" tickFormatter={formatMonthFr} axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Bar dataKey="collectedAmount" name="Encaissé confirmé" fill="#4b8fd0" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer> : <EmptyState compact detail="Aucun statut de paiement n’a été confirmé comme encaissé."/>}</Panel>
        <Panel title="Statuts d’inscription" subtitle="Répartition des lignes portant un statut mappé">{result.enrollmentStatuses.length ? <StatusRows rows={result.enrollmentStatuses}/> : <EmptyState compact detail="Champ de statut d’inscription non mappé."/>}</Panel>
        <Panel title="Modes de paiement" subtitle="Répartition selon les valeurs source">{result.paymentMethods.length ? <StatusRows rows={result.paymentMethods}/> : <EmptyState compact detail="Champ de mode de paiement non mappé."/>}</Panel>
        <Panel title="Établissements" subtitle="Lignes par établissement mappé">{result.establishments.length ? <StatusRows rows={result.establishments}/> : <EmptyState compact detail="Aucun champ établissement mappé."/>}</Panel>
        <Panel title="Régions" subtitle="Lignes par région mappée">{result.regions.length ? <StatusRows rows={result.regions}/> : <EmptyState compact detail="Aucun champ région mappé."/>}</Panel>
      </div>}
      <p className="page-footnote">Aucun objectif ni devise n’est supposé. Le montant enregistré inclut tous les statuts; le revenu encaissé n’est calculé qu’avec les statuts cochés et confirmés par l’utilisateur.</p>
    </>}</>;
}

function RevenueRows({ rows, currency }) {
  return <div className="status-rows">{rows.map((row, index) => <div className="status-row" key={row.name}><span className="status-index">{String(index + 1).padStart(2, "0")}</span><span>{row.name}</span><b>{fmtCurrency(row.amount, currency)}</b></div>)}</div>;
}

function FinancialAutoLinkControl({ linked, status, onLink }) {
  const supported = Boolean(globalThis.isSecureContext && typeof window.showOpenFilePicker === "function");
  const label = status === "permission-required" ? "Réautoriser le fichier lié" : linked ? "Relier un autre fichier local" : "Lier un CSV pour actualisation auto";
  const statusLabel = status === "active" ? "Actualisation active · contrôle toutes les 30 s" : status === "updating" ? "Lecture des dernières modifications…" : status === "permission-required" ? "Autorisation de lecture à renouveler" : status === "error" ? "Lecture impossible · vérifiez le fichier" : status === "unsupported" || !supported ? "Liaison automatique disponible sur Chrome/Edge en HTTPS" : "Le fichier local n’est pas lié";
  return <div className="financial-auto-link"><button type="button" className="outline-button" onClick={onLink} disabled={!supported && !linked}>{label}</button><span className={status === "active" ? "is-active" : ""}>{statusLabel}</span></div>;
}

function AggregateReceivablesPanel({ source, error, onImport, fileLinkStatus, linkedFinancialFile, onLinkFinancialFile }) {
  const mapped = source?.mapped?.reportModel ? source.mapped : null;
  const statusRows = mapped?.statusTotals ?? [];
  const overdueRow = statusRows.find((row) => row.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("retard"));
  const programRows = mapped?.programRows ?? [];
  const sortedPrograms = [...programRows].filter((row) => row.remainingAmount !== null).sort((a, b) => b.remainingAmount - a.remainingAmount);
  const columns = [{ key: "name", label: "Filière" }, { key: "plannedAmount", label: "Montant à payer" }, { key: "collectedAmount", label: "Montant collecté" }, { key: "remainingAmount", label: "Reste à examiner" }];
  return <section className="followup-aggregate-section">
    <div className="tuition-section-heading-row"><div><h2>Suivi agrégé des retards et restes · Source C</h2><p>Importez le fichier de synthèse financière ici. Ses valeurs sont agrégées par statut, mois et filière.</p></div><div className="followup-source-actions"><FinancialCsvImportButton onFile={onImport} label={source ? "Remplacer le fichier" : "Importer ce fichier financier"}/><FinancialAutoLinkControl linked={linkedFinancialFile} status={fileLinkStatus} onLink={onLinkFinancialFile}/></div></div>
    {error && <div className="csv-import-error" role="alert">{error}</div>}
    {!source && <div className="source-alert"><span className="source-alert-icon">i</span><div><b>Aucune synthèse financière importée</b><p>Le fichier chargé sur cette page peut fournir un comptage source des échéances en retard et les restes par filière. Ces agrégats ne contiennent pas de dossiers individuels.</p></div></div>}
    {source && !mapped && <div className="quality-warning">Le fichier est chargé, mais ses blocs agrégés n’ont pas été reconnus. Vérifiez le séparateur, l’encodage et les en-têtes dans « Revenus & inscriptions ».</div>}
    {mapped && <>
      <div className="followup-source-meta"><span className="source-state-dot valid"/><b>{source.fileName}</b><span>{fmtCount(programRows.length)} filières · {fmtCount(mapped.monthlyRows.length)} périodes mensuelles · agrégats sans filtre nominatif</span></div>
      <div className="commercial-kpi-grid followup-kpis"><MetricCard title="Échéances en retard · source" value={overdueRow ? fmtCount(overdueRow.count) : "Indisponible"} helper="Comptage repris du bloc de statuts" icon="followup" unavailable={!overdueRow}/><MetricCard title="Reste à examiner · filières" value={mapped.metrics.programRemainingAmount === null ? "Indisponible" : FRENCH_NUMBER.format(mapped.metrics.programRemainingAmount)} helper="Somme des lignes de détail par filière" icon="target" unavailable={mapped.metrics.programRemainingAmount === null}/><MetricCard title="Filières détaillées" value={fmtCount(programRows.length)} helper="Lignes de détail; total général exclu" icon="report"/></div>
      <div className="commercial-grid followup-chart-grid"><Panel title="Reste à examiner par filière" subtitle="Montants source · unité monétaire non confirmée"><div className="followup-aggregate-chart">{sortedPrograms.length ? <ResponsiveContainer width="100%" height={Math.max(230, sortedPrograms.length * 38)}><BarChart data={sortedPrograms} layout="vertical" margin={{ top: 8, right: 22, left: 8, bottom: 4 }}><CartesianGrid horizontal={false} stroke="var(--chart-grid)" strokeDasharray="3 4"/><XAxis type="number" tickFormatter={(value) => FRENCH_NUMBER.format(value)} tick={{ fill: "var(--color-muted)", fontSize: 10 }}/><YAxis type="category" dataKey="name" width={145} tick={{ fill: "var(--color-text)", fontSize: 10 }}/><Tooltip content={<ChartTooltip/>}/><Bar dataKey="remainingAmount" name="Reste à examiner" fill="#F97373" radius={[0, 5, 5, 0]} barSize={22}/></BarChart></ResponsiveContainer> : <EmptyState compact title="Reste par filière indisponible" detail="Les colonnes de montants nécessaires ne sont pas reconnues."/>}</div></Panel><Panel title="Statuts de la synthèse" subtitle="Libellés et comptages fournis par le fichier"><StatusRows rows={statusRows}/></Panel></div>
      <Panel title="Détail des restes par filière" subtitle="Les totaux généraux sont exclus; les tableaux mensuels et par filière ne sont jamais additionnés." action={<DownloadButton label="Exporter CSV" rows={programRows} columns={columns} filename="suivi-reste-filieres.csv"/>}>{programRows.length ? <div className="table-scroll"><table className="commercial-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{programRows.map((row, index) => <tr key={`${row.name}-${index}`}><td>{row.name}</td><td>{row.plannedAmount === null ? "—" : FRENCH_NUMBER.format(row.plannedAmount)}</td><td>{row.collectedAmount === null ? "—" : FRENCH_NUMBER.format(row.collectedAmount)}</td><td>{row.remainingAmount === null ? "—" : FRENCH_NUMBER.format(row.remainingAmount)}</td></tr>)}</tbody></table></div> : <EmptyState compact title="Aucune filière reconnue"/>}</Panel>
      <p className="tuition-quality-note">Ce fichier ne permet pas d’identifier les étudiants ni leurs échéances individuelles. Pour obtenir une liste de personnes à contacter, il faut importer aussi les Sources A (étudiants) et B (échéancier). La synthèse C reste séparée et n’est jamais additionnée aux lignes détaillées.</p>
    </>}
  </section>;
}

function FollowupsPage({ bundle, available, error, filters, setFilters, dateRange, localCsvSource = null, financialSource = null, financialError = "", onFinancialImport, fileLinkStatus, linkedFinancialFile, onLinkFinancialFile }) {
  const localCsvActive = Boolean(localCsvSource);
  const overdue = useMemo(() => available ? filterOverdueFollowups(getFollowupRecords(bundle.followups, dateRange.endDate || new Date().toISOString().slice(0, 10)), { ...filters, ...dateRange }) : [], [available, bundle, filters, dateRange]);
  const salespeople = available ? [...new Set(bundle.followups.map((row) => row.salesperson).filter(Boolean))].sort() : [];
  const specialties = available ? [...new Set(bundle.followups.map((row) => row.specialty).filter(Boolean))].sort() : [];
  const countTasksBy = (field) => {
    const counts = new Map();
    for (const row of overdue) { const label = String(row[field] ?? "").trim() || "Non renseigné"; counts.set(label, (counts.get(label) ?? 0) + 1); }
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
  };
  const followupsBySalesperson = available ? countTasksBy("salesperson") : [];
  const followupsBySpecialty = available ? countTasksBy("specialty") : [];
  const candidatesInView = new Set(overdue.map((row) => row.candidate_id).filter(Boolean)).size;
  const overdueInView = overdue.filter((row) => row.followup_state === "overdue").length;
  const columns = [
    { key: "candidate_id", label: "Référence candidat" }, { key: "specialty", label: "Spécialité" },
    { key: "study_level", label: "Niveau" }, { key: "current_status", label: "Statut source" },
    { key: "last_activity_at", label: "Dernière activité" }, { key: "next_action", label: "Prochaine action" },
    { key: "due_date", label: "Échéance" }, { key: "salesperson", label: "Responsable" }, { key: "followup_state", label: "État de l’échéance" }, { key: "days_overdue", label: "Jours de retard" },
  ];
  return <>
    <PageTitle title="Relances à traiter" subtitle="Dossiers en retard selon une échéance explicite et une tâche non terminée." badge={available ? "Source configurée" : "Prototype"}/>
    {!available && <SourceAlert configError={error} localCsvActive={localCsvActive} localCsvSource={localCsvSource}/>}
    <section className="followup-filters">
      <label><span>Responsable commercial</span><select aria-label="Filtrer par responsable commercial" value={filters.salesperson} onChange={(event) => setFilters((previous) => ({ ...previous, salesperson: event.target.value }))}><option value="">Tous</option>{salespeople.map((person) => <option key={person}>{person}</option>)}</select></label>
      <label><span>Spécialité</span><select value={filters.specialty} onChange={(event) => setFilters((previous) => ({ ...previous, specialty: event.target.value }))}><option value="">Toutes</option>{specialties.map((specialty) => <option key={specialty}>{specialty}</option>)}</select></label>
      <label><span>État de l’échéance</span><select value={filters.overdueStatus} onChange={(event) => setFilters((previous) => ({ ...previous, overdueStatus: event.target.value }))}><option value="overdue">En retard</option><option value="open">À venir</option><option value="completed">Terminée</option><option value="all">Tous les états</option></select></label>
      <span className="followup-definition">En retard = échéance passée et date de fin vide.</span>
    </section>
    {available && <><div className="commercial-kpi-grid followup-kpis"><MetricCard title="Tâches dans la sélection" value={fmtCount(overdue.length)} helper="Après période et filtres" icon="followup"/><MetricCard title="Candidats concernés" value={fmtCount(candidatesInView)} helper="Références distinctes" icon="candidate"/><MetricCard title="Tâches en retard" value={fmtCount(overdueInView)} helper="Échéance passée, tâche non terminée" icon="target"/></div><div className="commercial-grid followup-chart-grid">{followupsBySalesperson.length > 0 && <Panel title="Relances par responsable" subtitle="Nombre de tâches dans la sélection"><FeedbackBars rows={followupsBySalesperson} colors={["#3B82F6", "#6366F1", "#14B8A6", "#8B5CF6"]}/></Panel>}{followupsBySpecialty.length > 0 && <Panel title="Relances par formation" subtitle="Nombre de tâches dans la sélection"><FeedbackBars rows={followupsBySpecialty} colors={["#14B8A6", "#0EA5E9", "#6366F1", "#F59E0B"]}/></Panel>}</div></>}
    <Panel title="Dossiers à traiter" subtitle={`${fmtCount(overdue.length)} tâche(s) après filtres`} action={<DownloadButton label="Exporter CSV" rows={overdue} columns={columns} disabled={!available}/> }>
      {overdue.length ? <div className="table-scroll"><table className="commercial-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{overdue.map((row) => <tr key={row.task_id}><td>{row.candidate_id}</td><td>{row.specialty || "—"}</td><td>{row.study_level || "—"}</td><td><span className="raw-status">{row.current_status || "Non renseigné"}</span></td><td>{formatDateFr(row.last_activity_at)}</td><td>{row.next_action || "—"}</td><td>{formatDateFr(row.due_date)}</td><td>{row.salesperson || "—"}</td><td><span className={row.followup_state === "overdue" ? "overdue-pill" : "raw-status"}>{row.followup_state === "overdue" ? "En retard" : row.followup_state === "completed" ? "Terminée" : "À venir"}</span></td><td>{row.days_overdue ? <span className="overdue-pill">{row.days_overdue} j</span> : "—"}</td></tr>)}</tbody></table></div> : <EmptyState title={available ? "Aucun dossier pour ces filtres" : "Échéances non disponibles"} detail={available ? "Aucune tâche ne correspond aux filtres et à la période choisie." : "Une date d’échéance, une référence candidat et un indicateur de clôture sont nécessaires."}/>}
    </Panel>
    <AggregateReceivablesPanel source={financialSource} error={financialError} onImport={onFinancialImport} fileLinkStatus={fileLinkStatus} linkedFinancialFile={linkedFinancialFile} onLinkFinancialFile={onLinkFinancialFile}/>
  </>;
}

function ReportPage({ summary, available, error, dateRange, bundle }) {
  const dateLabel = dateRange.startDate || dateRange.endDate
    ? [dateRange.startDate ? formatDateFr(dateRange.startDate) : `D\u00e9but non d\u00e9fini`, dateRange.endDate ? formatDateFr(dateRange.endDate) : `Fin non d\u00e9finie`].join(' au ')
    : `Toute la p\u00e9riode disponible`;
  const reportRows = available ? [
    { indicateur: "Activités commerciales", valeur: summary.activityCount },
    { indicateur: "Inscriptions confirmées", valeur: summary.confirmedEnrollments },
    { indicateur: "Dossiers candidats", valeur: summary.candidateCount },
    { indicateur: "Dossiers distincts en retard", valeur: summary.overdueCandidateCount },
    { indicateur: "Revenus encaissés", valeur: summary.collectedRevenue },
    { indicateur: "Objectif revenu", valeur: summary.targetRevenue },
    { indicateur: "Atteinte objectif", valeur: summary.revenueAchievement === null ? "Non disponible" : fmtPercent(summary.revenueAchievement) },
  ] : [];
  const columns = [{ key: "indicateur", label: "Indicateur" }, { key: "valeur", label: "Valeur" }];
  const statuses = available ? summary.statusCounts : [];
  const overdue = available ? getOverdueFollowups(bundle.followups, dateRange.endDate || new Date().toISOString().slice(0, 10)) : [];
  const exportRows = [...reportRows, ...statuses.map((row) => ({ indicateur: `Statut : ${row.label}`, valeur: row.count }))];
  return <div className="print-report">
    <PageTitle eyebrow="RAPPORT DE GESTION" title="Rapport commercial" subtitle="Synthèse vérifiable des activités, inscriptions et encaissements." badge={available ? "Source configurée" : "Prototype"}/>
    {!available && <SourceAlert configError={error}/>}
    <section className="report-period"><span>PÉRIODE COUVERTE</span><b>{dateLabel}</b><small>Généré le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date())}</small></section>
    <div className="report-actions print-hide"><button className="primary-button" onClick={() => window.print()}>Imprimer le rapport</button><DownloadButton label="Exporter la synthèse CSV" rows={exportRows} columns={columns} disabled={!available}/></div>
    {available ? <>
      <div className="report-stats">{reportRows.map((row) => <div key={row.indicateur}><span>{row.indicateur}</span><b>{typeof row.valeur === "number" && row.indicateur.includes("revenu") ? fmtCurrency(row.valeur, summary.currency) : row.valeur}</b></div>)}</div>
      <Panel title="Répartition actuelle du pipeline" subtitle="Dossiers distincts par statut courant"><StatusRows rows={statuses}/></Panel>
      <div className="commercial-grid report-breakdown-grid">
        <Panel title="Inscriptions par spécialité" action={<DownloadButton label="CSV" rows={summary.enrollmentBySpecialty} columns={[{ key: "name", label: "Spécialité" }, { key: "count", label: "Inscriptions" }]}/> }>{summary.enrollmentBySpecialty.length ? <StatusRows rows={summary.enrollmentBySpecialty}/> : <EmptyState compact/>}</Panel>
        <Panel title="Inscriptions par niveau d’étude" action={<DownloadButton label="CSV" rows={summary.enrollmentByStudyLevel} columns={[{ key: "name", label: "Niveau" }, { key: "count", label: "Inscriptions" }]}/> }>{summary.enrollmentByStudyLevel.length ? <StatusRows rows={summary.enrollmentByStudyLevel}/> : <EmptyState compact/>}</Panel>
        <Panel title="Revenus par spécialité" action={<DownloadButton label="CSV" rows={summary.revenueBySpecialty} columns={[{ key: "name", label: "Spécialité" }, { key: "amount", label: "Encaissé" }]}/> }>{summary.revenueBySpecialty.length ? <RevenueRows rows={summary.revenueBySpecialty} currency={summary.currency}/> : <EmptyState compact/>}</Panel>
        <Panel title="Revenus par niveau d’étude" action={<DownloadButton label="CSV" rows={summary.revenueByStudyLevel} columns={[{ key: "name", label: "Niveau" }, { key: "amount", label: "Encaissé" }]}/> }>{summary.revenueByStudyLevel.length ? <RevenueRows rows={summary.revenueByStudyLevel} currency={summary.currency}/> : <EmptyState compact/>}</Panel>
      </div>
      <Panel title="Points vérifiables" subtitle="Constats calculés à partir des champs configurés">
        <ul className="findings-list"><li>{fmtCount(summary.activityCount)} événements commerciaux distincts sur la période.</li><li>{fmtCount(summary.confirmedEnrollments)} inscriptions confirmées selon le statut configuré.</li><li>{fmtCount(summary.overdueCandidateCount)} dossiers ont au moins une tâche en retard selon les échéances renseignées.</li><li>{summary.revenueAchievement === null ? "Objectif de revenu ou devise indisponible pour calculer l’atteinte." : `L’objectif de revenu est atteint à ${fmtPercent(summary.revenueAchievement)}.`}</li></ul>
      </Panel>
      <Panel title="Annexe · relances en retard" action={<DownloadButton label="Exporter les relances" rows={overdue} columns={[{ key: "candidate_id", label: "Référence candidat" }, { key: "next_action", label: "Prochaine action" }, { key: "due_date", label: "Échéance" }, { key: "salesperson", label: "Responsable" }, { key: "days_overdue", label: "Jours de retard" }]}/> }>
        {overdue.length ? <div className="table-scroll"><table className="commercial-table"><thead><tr><th>Référence candidat</th><th>Prochaine action</th><th>Échéance</th><th>Responsable</th><th>Retard</th></tr></thead><tbody>{overdue.map((row) => <tr key={row.task_id}><td>{row.candidate_id}</td><td>{row.next_action || "—"}</td><td>{formatDateFr(row.due_date)}</td><td>{row.salesperson || "—"}</td><td>{row.days_overdue} j</td></tr>)}</tbody></table></div> : <EmptyState compact/>}
      </Panel>
    </> : <EmptyState title="Rapport commercial indisponible" detail="Aucun indicateur commercial ni constat métier ne sera produit avant l’ajout d’une source conforme."/>}
  </div>;
}

function formatDateFr(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(String(value))) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? "—" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function formatMonthFr(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value));
  if (!match) return value;
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}

function CsvFiltersBar({ rows, filters, setFilters, dateRange = { startDate: "", endDate: "" } }) {
  const options = useMemo(() => ({
    establishment: [...new Set(rows.map((row) => row.LIB_ETABLISSEMENT).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    region: [...new Set(rows.map((row) => row.LIB_REGION).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    category: [...new Set(rows.map((row) => row.LIB_AVIS).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    responsible: [...new Set(rows.map((row) => String(row.RESPONSABLE ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    hasMissingResponsible: rows.some((row) => !String(row.RESPONSABLE ?? "").trim()),
  }), [rows]);
  const matchingCount = useMemo(() => filterCommercialCsv(rows, { ...dateRange, ...filters }).length, [rows, dateRange, filters]);
  useEffect(() => {
    setFilters((previous) => {
      const selections = {
        establishment: options.establishment,
        region: options.region,
        category: options.category,
        responsible: options.responsible,
      };
      let next = previous;
      for (const [key, values] of Object.entries(selections)) {
        const selected = previous[key];
        const valid = !selected
          || (key === "responsible" && selected === MISSING_RESPONSIBLE_FILTER && options.hasMissingResponsible)
          || values.includes(selected);
        if (!valid) next = { ...next, [key]: "" };
      }
      return next;
    });
  }, [options, setFilters]);
  const periodLabel = dateRange.startDate && dateRange.endDate
    ? `${formatDateFr(dateRange.startDate)} – ${formatDateFr(dateRange.endDate)}`
    : dateRange.startDate ? `Depuis le ${formatDateFr(dateRange.startDate)}`
      : dateRange.endDate ? `Jusqu’au ${formatDateFr(dateRange.endDate)}` : "Toutes les dates";
  return <div className="feedback-filterbar">
    {[["establishment", "Établissement", options.establishment, "Tous"], ["region", "Région", options.region, "Toutes"], ["category", "Catégorie brute · LIB_AVIS", options.category, "Toutes"], ["responsible", "Commercial", options.responsible, "Tous les commerciaux"]].map(([key, label, values, allLabel]) => <label key={key}><span>{label}</span><select aria-label={label} value={filters[key] ?? ""} onChange={(event) => setFilters((previous) => ({ ...previous, [key]: event.target.value }))}><option value="">{allLabel}</option>{values.map((value) => <option key={value} value={value}>{value}</option>)}{key === "responsible" && options.hasMissingResponsible && <option value={MISSING_RESPONSIBLE_FILTER}>Non renseigné</option>}</select></label>)}
    <button className="outline-button" type="button" onClick={() => setFilters({ establishment: "", region: "", category: "", responsible: "" })}>Réinitialiser</button>
    <div className="filter-result-count" role="status"><b>{fmtCount(matchingCount)} avis</b><span>{periodLabel}</span></div>
  </div>;
}

function ImportedCsvPipeline({ rows, dateRange, sourceInfo, filters, setFilters }) {
  const filtered = useMemo(() => filterCommercialCsv(rows, { ...dateRange, ...filters }), [rows, dateRange, filters]);
  const summary = useMemo(() => summarizeCommercialCsv(filtered), [filtered]);
  return <>
    <PageTitle title="Pipeline candidats" subtitle="Données disponibles dans le CSV local, sans interprétation de LIB_AVIS comme statut candidat." badge="CSV local"/>
    <CsvFiltersBar rows={rows} filters={filters} setFilters={setFilters} dateRange={dateRange}/>
    <section className="source-alert"><span className="source-alert-icon">i</span><div><b>Source CSV active : {sourceInfo.fileName}</b><p>Les catégories et regroupements ci-dessous décrivent les lignes d’avis. Ils ne représentent pas une répartition de pipeline ou des transitions de candidats confirmées.</p></div></section>
    <div className="commercial-kpi-grid imported-kpis"><MetricCard title="Candidats distincts" value={fmtCount(summary.distinctCandidates)} helper="IDENTITE_LEAD renseigné · distinct" icon="candidate"/><MetricCard title="Lignes d’avis" value={fmtCount(summary.totalAvis)} helper="Comptées séparément des candidats" icon="total"/></div>
    <div className="commercial-grid"><Panel title="Valeurs source LIB_AVIS" subtitle="Comptage des lignes; sémantique non confirmée" className="panel-span-two"><StatusRows rows={summary.avisByCategory}/></Panel><Panel title="Responsables" subtitle="Lignes attribuées par valeur source"><StatusRows rows={summary.avisByResponsible}/></Panel></div>
  </>;
}

function ImportedCsvOverview({ rows, dateRange, sourceInfo, filters, setFilters }) {
  const filtered = useMemo(() => filterCommercialCsv(rows, { ...dateRange, ...filters }), [rows, dateRange, filters]);
  const summary = useMemo(() => summarizeCommercialCsv(filtered), [filtered]);
  const monthly = summary.monthlyAvis.map((item) => ({ ...item, label: formatMonthFr(item.month) }));
  const selectCategory = (category) => setFilters((previous) => ({ ...previous, category }));
  return <>
    <PageTitle eyebrow="SOURCE LOCALE · CSV" title="Suivi des avis entrants" subtitle="Import local actif. Les lignes d’avis et les candidats distincts sont comptés séparément." badge="CSV local"/>
    <section className="source-alert"><span className="source-alert-icon">i</span><div><b>Source active : fichier CSV sélectionné sur cet appareil</b><p>{sourceInfo.fileName} · {fmtCount(rows.length)} lignes importées{sourceInfo.invalidDates ? ` · ${fmtCount(sourceInfo.invalidDates)} date(s) invalide(s) dans le fichier, ignorée(s) des graphiques temporels` : ""}.</p><small>Le contenu reste dans la mémoire de cette page. IDENTITE_LEAD sert uniquement au comptage distinct et n’est pas affiché ni journalisé. LIB_AVIS est traité comme une valeur source brute, sans interprétation de statut ou de satisfaction.</small></div></section>
    <CsvFiltersBar rows={rows} filters={filters} setFilters={setFilters} dateRange={dateRange}/>
    {sourceInfo.ignoredColumns.length > 0 && <div className="quality-warning">Colonnes non utilisées ignorées par l’adaptateur : {sourceInfo.ignoredColumns.join(", ")}.</div>}
    <div className="commercial-kpi-grid imported-kpis">
      <MetricCard title="Candidats distincts" value={fmtCount(summary.distinctCandidates)} helper="IDENTITE_LEAD renseigné · distinct" icon="candidate"/>
      <MetricCard title="Avis enregistrés" value={fmtCount(summary.totalAvis)} helper="Nombre de lignes CSV dans la période" icon="total"/>
      <MetricCard title="Dates invalides" value={fmtCount(summary.invalidDates)} helper="Dans la sélection; exclues des graphiques" icon="target" unavailable={summary.invalidDates > 0}/>
    </div>
    <div className="commercial-grid feedback-chart-grid">
      {monthly.length > 0 && <Panel title="Tendance mensuelle des avis" subtitle="DATE_AVIS valide · comptage des lignes par mois" className="panel-span-two"><FeedbackChart data={monthly} type="area"/></Panel>}
      <Panel title="Répartition des valeurs LIB_AVIS" subtitle="Valeurs brutes · sélectionner une légende filtre les données"><StatusDonutChart rows={summary.avisByCategory} selectedCategory={filters.category} onSelectCategory={selectCategory}/></Panel>
      <Panel title="Avis par responsable" subtitle="RESPONSABLE · comptage des lignes"><FeedbackBars rows={summary.avisByResponsible} colors={["#337db4"]}/></Panel>
      <Panel title="Avis par source" subtitle="LIB_SOURCE_LEAD · comptage des lignes"><FeedbackBars rows={summary.avisBySource} colors={["#39a198"]}/></Panel>
      <Panel title="Avis par région" subtitle="LIB_REGION · comptage des lignes"><FeedbackBars rows={summary.avisByRegion} colors={["#8474b6"]}/></Panel>
    </div>
    <p className="page-footnote">Aucun revenu, paiement, objectif, score ou retard n’est déduit de ce fichier. Les indicateurs correspondants restent indisponibles faute de champs source.</p>
  </>;
}

function ImportedCsvReport({ rows, dateRange, sourceInfo, filters, setFilters }) {
  const filtered = useMemo(() => filterCommercialCsv(rows, { ...dateRange, ...filters }), [rows, dateRange, filters]);
  const summary = useMemo(() => summarizeCommercialCsv(filtered), [filtered]);
  const monthly = summary.monthlyAvis.map((item) => ({ ...item, label: formatMonthFr(item.month) }));
  const responsibleMix = useMemo(() => groupCommercialCrossTab(filtered, "RESPONSABLE", "LIB_AVIS"), [filtered]);
  const selectCategory = (category) => setFilters((previous) => ({ ...previous, category }));
  const sortedRows = useMemo(() => filtered.toSorted((a, b) => {
    const aTime = a.DATE_AVIS?.valueOf() ?? Number.NEGATIVE_INFINITY;
    const bTime = b.DATE_AVIS?.valueOf() ?? Number.NEGATIVE_INFINITY;
    return bTime - aTime;
  }), [filtered]);
  const tableRows = sortedRows.slice(0, 100);
  const topCategory = summary.avisByCategory[0];
  const topResponsible = summary.avisByResponsible.find((item) => item.name !== "Non renseigné");
  const periodLabel = dateRange.startDate || dateRange.endDate
    ? `${dateRange.startDate ? formatDateFr(dateRange.startDate) : "Début non défini"} au ${dateRange.endDate ? formatDateFr(dateRange.endDate) : "Fin non définie"}`
    : "Toute la période importée";
  const reportRows = [
    { indicateur: "Candidats distincts renseignés", valeur: summary.distinctCandidates },
    { indicateur: "Avis enregistrés (lignes CSV)", valeur: summary.totalAvis },
    { indicateur: "Avis avec date valide dans la sélection", valeur: summary.totalAvis - summary.invalidDates },
    ...summary.avisByCategory.map((item) => ({ indicateur: `Valeur LIB_AVIS · ${item.name}`, valeur: item.count })),
    ...summary.avisByResponsible.map((item) => ({ indicateur: `RESPONSABLE · ${item.name}`, valeur: item.count })),
    ...monthly.map((item) => ({ indicateur: `Mois · ${item.month}`, valeur: item.count })),
  ];
  const columns = [{ key: "indicateur", label: "Indicateur" }, { key: "valeur", label: "Nombre" }];
  const detailColumns = [
    { key: "date", label: "DATE_AVIS" },
    { key: "category", label: "LIB_AVIS" },
    { key: "responsible", label: "RESPONSABLE" },
    { key: "source", label: "LIB_SOURCE_LEAD" },
    { key: "establishment", label: "LIB_ETABLISSEMENT" },
    { key: "region", label: "LIB_REGION" },
  ];
  const detailExportRows = sortedRows.map((row) => ({
    date: row.DATE_AVIS?.toISOString() ?? "",
    category: row.LIB_AVIS ?? "",
    responsible: row.RESPONSABLE ?? "",
    source: row.LIB_SOURCE_LEAD ?? "",
    establishment: row.LIB_ETABLISSEMENT ?? "",
    region: row.LIB_REGION ?? "",
  }));
  return <div className="print-report">
    <PageTitle eyebrow="ANALYSE COMMERCIALE · CSV LOCAL" title="Rapport des avis" subtitle="Lecture des volumes enregistrés, des valeurs source et des dates disponibles." badge="CSV local"/>
    <section className="report-period"><span>PÉRIODE COUVERTE</span><b>{periodLabel}</b><small>{filters.responsible && filters.responsible !== MISSING_RESPONSIBLE_FILTER ? `Commercial : ${filters.responsible}` : filters.responsible === MISSING_RESPONSIBLE_FILTER ? "Commercial : non renseigné" : "Tous les commerciaux"} · {sourceInfo.fileName}</small></section>
    <div className="print-hide"><CsvFiltersBar rows={rows} filters={filters} setFilters={setFilters} dateRange={dateRange}/></div>
    <div className="report-actions print-hide"><button className="primary-button" onClick={() => window.print()}>Imprimer le rapport</button><DownloadButton label="Exporter la synthèse CSV" rows={reportRows} columns={columns} filename="synthese-avis-importes.csv"/></div>
    <div className="report-story" aria-live="polite"><span className="report-story-mark"><Icon name="report"/></span><p>{topCategory ? <>Sur cette sélection, la valeur brute <b>{topCategory.name}</b> est la plus fréquente ({fmtCount(topCategory.count)} lignes){topResponsible ? <> ; <b>{topResponsible.name}</b> est le commercial associé au plus grand nombre de lignes ({fmtCount(topResponsible.count)}).</> : "."} Ces comptages décrivent les lignes CSV et ne qualifient ni la satisfaction ni la performance individuelle.</> : "Aucune ligne ne correspond aux filtres sélectionnés. Ajustez la période ou les filtres pour afficher le rapport."}</p></div>
    <div className="report-stats">
      <div><span>Avis dans la sélection</span><b>{fmtCount(summary.totalAvis)}</b><small>Lignes CSV, pas des candidats distincts</small></div>
      <div><span>Candidats distincts renseignés</span><b>{fmtCount(summary.distinctCandidates)}</b><small>IDENTITE_LEAD distinct, non affiché</small></div>
      <div><span>Avis avec date valide</span><b>{fmtCount(summary.totalAvis - summary.invalidDates)}</b><small>DATE_AVIS exploitable dans la sélection</small></div>
      <div><span>Commerciaux renseignés</span><b>{fmtCount(summary.avisByResponsible.filter((item) => item.name !== "Non renseigné").length)}</b><small>Valeurs distinctes de RESPONSABLE</small></div>
    </div>
    <div className="commercial-grid report-visual-grid">
      <Panel title="Répartition des valeurs LIB_AVIS" subtitle="Valeurs source brutes · nombre de lignes"><StatusDonutChart rows={summary.avisByCategory} selectedCategory={filters.category} onSelectCategory={selectCategory}/></Panel>
      <Panel title="Avis par commercial" subtitle="RESPONSABLE · comptage des lignes"><FeedbackBars rows={summary.avisByResponsible} colors={["#4867cf"]}/></Panel>
      {monthly.length > 0 && <Panel title="Évolution mensuelle" subtitle="DATE_AVIS · avis datés par mois" className="panel-span-two"><FeedbackChart data={monthly} type="line"/></Panel>}
      {responsibleMix.rows.length > 0 && responsibleMix.series.length > 1 && <Panel title="Ventilation de LIB_AVIS par commercial" subtitle="Comptage filtré · huit premiers commerciaux" className="panel-span-two"><ResponsibleMixChart rows={responsibleMix.rows.slice(0, 8)} series={responsibleMix.series}/></Panel>}
    </div>
    <Panel title="Détail des avis" subtitle={`Lignes filtrées · affichage des ${fmtCount(tableRows.length)} plus récentes sur ${fmtCount(sortedRows.length)} · identifiants et commentaires exclus`} action={<DownloadButton label="Exporter les lignes affichées" rows={detailExportRows} columns={detailColumns} filename="detail-avis-sans-identifiants.csv"/>}>
      {tableRows.length ? <div className="table-scroll report-table-scroll"><table className="commercial-table report-detail-table"><thead><tr>{detailColumns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{tableRows.map((row, index) => <tr key={`${row.DATE_AVIS?.toISOString() ?? "sans-date"}-${index}`}><td>{row.DATE_AVIS ? displayDate(row.DATE_AVIS, true) : "Date non renseignée"}</td><td><span className="raw-status">{row.LIB_AVIS || "Non renseigné"}</span></td><td>{row.RESPONSABLE || "Non renseigné"}</td><td>{row.LIB_SOURCE_LEAD || "Non renseigné"}</td><td>{row.LIB_ETABLISSEMENT || "Non renseigné"}</td><td>{row.LIB_REGION || "Non renseignée"}</td></tr>)}</tbody></table></div> : <EmptyState title="Aucun avis pour cette sélection" detail="Modifiez les filtres pour afficher des lignes dans le rapport."/>}
    </Panel>
    <div className="source-alert"><span className="source-alert-icon">i</span><div><b>Interprétation limitée aux données disponibles</b><p>Les répartitions comptent les lignes du fichier. LIB_AVIS reste une valeur brute dont le sens métier doit être confirmé. Aucun revenu, objectif, taux de conversion, score de satisfaction ou retard de suivi n’est calculé à partir de ces champs.</p></div></div>
  </div>;
}

function FeedbackPage({ rows, loadError, loading, dateRange, imported = false, filters, setFilters }) {
  const filteredRows = useMemo(() => filterFeedback(rows, { ...dateRange, ...filters }), [rows, dateRange, filters]);
  const summary = useMemo(() => summarizeFeedback(filteredRows), [filteredRows]);
  const daily = useMemo(() => groupByDay(filteredRows), [filteredRows]);
  const monthly = useMemo(() => groupByMonth(filteredRows), [filteredRows]);
  const establishments = useMemo(() => groupByField(filteredRows, "LIB_ETABLISSEMENT"), [filteredRows]);
  const categories = useMemo(() => groupByField(filteredRows, "LIB_AVIS"), [filteredRows]);
  const regions = useMemo(() => groupByField(filteredRows, "LIB_REGION"), [filteredRows]);
  const recent = useMemo(() => getRecentComments(filteredRows), [filteredRows]);
  const candidateCount = useMemo(() => new Set(filteredRows.map((row) => row.IDENTITE_LEAD).filter(Boolean)).size, [filteredRows]);
  const cols = [{ key: "DATE_AVIS", label: "Date" }, { key: "LIB_ETABLISSEMENT", label: "Établissement" }, { key: "LIB_AVIS", label: "Catégorie (LIB_AVIS)" }, { key: "COMMENTAIRE_LEAD_AVIS", label: "Commentaire" }];
  const exportRows = recent.map((row) => ({ ...row, DATE_AVIS: row.DATE_AVIS.toISOString() }));
  if (loading) return <div className="loading-state"><div className="loader"/><p>Chargement du jeu de retours…</p></div>;
  if (loadError) return <div className="error-state"><h2>Jeu de retours indisponible</h2><p>{loadError}</p></div>;
  return <>
    <PageTitle eyebrow={imported ? "SOURCE LOCALE · CSV" : "DONNÉES DE DÉVELOPPEMENT"} title="Retours commerçants" subtitle={imported ? "Avis enregistrés dans le CSV local actif; les identifiants sont comptés sans être affichés." : "Vue conservée sur le jeu synthétique existant, indépendante des données commerciales."} badge={imported ? "CSV local" : "Synthétique"}/>
    <CsvFiltersBar rows={rows} filters={filters} setFilters={setFilters} dateRange={dateRange}/>
    <div className="commercial-kpi-grid feedback-kpis">
      <MetricCard title="Total des retours" value={fmtCount(summary.total)} helper="Réponses sur la période" icon="total"/>
      {imported && <MetricCard title="Candidats distincts" value={fmtCount(candidateCount)} helper="IDENTITE_LEAD renseigné · distinct des lignes" icon="candidate"/>}
      <MetricCard title="Établissements distincts" value={fmtCount(summary.establishments)} helper="Valeurs de LIB_ETABLISSEMENT" icon="shop"/>
      <MetricCard title="Régions distinctes" value={fmtCount(summary.regions)} helper="Valeurs de LIB_REGION" icon="region"/>
      <MetricCard title="Avec commentaire" value={fmtCount(summary.comments)} helper="Commentaires non vides" icon="comment"/>
      <MetricCard title="Couverture des commentaires" value={fmtPercent(summary.commentCoverage)} helper="Part des retours commentés" icon="percent"/>
    </div>
    <div className="commercial-grid feedback-chart-grid">
      {daily.length > 0 && <Panel title="Volume des retours" subtitle="Évolution quotidienne · DATE_AVIS" className="panel-span-two"><FeedbackChart data={daily} type="area"/></Panel>}
      <Panel title="Répartition par catégorie" subtitle="Valeurs brutes de LIB_AVIS"><StatusDonutChart rows={categories} selectedCategory={filters.category} onSelectCategory={(category) => setFilters((previous) => ({ ...previous, category }))}/></Panel>
      <Panel title="Valeurs brutes LIB_AVIS" subtitle="Comparaison horizontale ? comptage des lignes"><FeedbackBars rows={categories} colors={CHART_COLORS}/></Panel>
      <Panel title="Retours par établissement" subtitle="Comparaison du volume"><FeedbackBars rows={establishments} colors={["#337db4"]}/></Panel>
      <Panel title="Retours par région" subtitle="Comparaison du volume"><FeedbackBars rows={regions} colors={["#39a198"]}/></Panel>
      {imported && <Panel title="Retours par responsable" subtitle="Comptage par ligne CSV"><FeedbackBars rows={groupCommercialCsv(filteredRows, "RESPONSABLE")} colors={["#8474b6"]}/></Panel>}
      {imported && <Panel title="Retours par source" subtitle="LIB_SOURCE_LEAD · comptage par ligne"><FeedbackBars rows={groupCommercialCsv(filteredRows, "LIB_SOURCE_LEAD")} colors={["#d77968"]}/></Panel>}
      {monthly.length > 0 && <Panel title="Tendance mensuelle" subtitle="Mois dérivé des DATE_AVIS valides"><FeedbackChart data={monthly} type="bar"/></Panel>}
    </div>
    <Panel title="Commentaires récents" subtitle={`${fmtCount(summary.comments)} commentaires non vides sur la sélection`} action={<DownloadButton label="Exporter CSV" rows={exportRows} columns={cols} filename={imported ? "avis-recents-import-local.csv" : "avis-recents-synthetiques.csv"}/> }>
      {recent.length ? <div className="table-scroll"><table className="commercial-table"><thead><tr><th>Date</th><th>Établissement</th><th>Catégorie · LIB_AVIS</th><th>Commentaire</th></tr></thead><tbody>{recent.map((row, index) => <tr key={`${row.DATE_AVIS.toISOString()}-${index}`}><td>{displayDate(row.DATE_AVIS, true)}</td><td>{row.LIB_ETABLISSEMENT}</td><td><span className="raw-status">{row.LIB_AVIS}</span></td><td className="comment-column">{row.COMMENTAIRE_LEAD_AVIS}</td></tr>)}</tbody></table></div> : <EmptyState title="Aucun commentaire sur la période" detail="Les commentaires vides restent comptés parmi le total des retours."/>}
      <div className="table-note">{imported ? "Valeurs chargées depuis un fichier local. Aucun score de satisfaction ni sentiment n’est calculé." : "Les valeurs de cette page sont fictives. Aucun score de satisfaction ni sentiment n’est calculé."}</div>
    </Panel>
  </>;
}

function ResponsibleMixChart({ rows, series }) {
  if (!rows.length || !series.length) return <ChartEmpty/>;
  const palette = ["#3B82F6", "#6366F1", "#8B5CF6", "#14B8A6", "#F97373", "#F59E0B", "#0EA5E9"];
  const colorFor = (label) => {
    if (label === "Autres (affichage)") return "#64748B";
    let hash = 0;
    for (const character of label) hash = (hash * 31 + character.codePointAt(0)) >>> 0;
    return palette[hash % palette.length];
  };
  return <div className="responsible-mix-chart">
    <ResponsiveContainer width="100%" height={Math.max(330, rows.length * 58)}><BarChart data={rows} layout="vertical" margin={{ top: 10, right: 24, bottom: 8, left: 5 }} barCategoryGap="28%">
      <CartesianGrid horizontal={false} stroke="#dfe7f2" strokeDasharray="3 4"/>
      <XAxis type="number" allowDecimals={false} tickFormatter={(value) => FRENCH_NUMBER.format(value)} tick={{ fill: "#475569", fontSize: 11 }} axisLine={{ stroke: "#bdc9d8" }} tickLine={false}/>
      <YAxis type="category" dataKey="name" width={138} tick={{ fill: "#334155", fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false}/>
      <Tooltip shared={false} content={<ResponsibleMixTooltip series={series}/>}/>
      <Legend verticalAlign="top" align="left" height={48} iconType="circle" iconSize={9} formatter={(value) => <span title={value}>{compactLabel(value)}</span>}/>
      {series.map((name) => <Bar key={name} dataKey={name} name={name} stackId="avis" fill={colorFor(name)} stroke="#ffffff" strokeWidth={1.4} barSize={34}/>) }
    </BarChart></ResponsiveContainer>
    <p className="status-chart-note">Valeurs de LIB_AVIS représentées comme catégories brutes. « Autres (affichage) » regroupe les catégories au-delà des six plus fréquentes.</p>
  </div>;
}

function ResponsibleMixTooltip({ active, payload, label, series }) {
  const item = payload?.[0];
  if (!active || !item) return null;
  const row = item.payload ?? {};
  const total = series.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
  const value = Number(item.value) || 0;
  return <div className="chart-tooltip responsible-mix-tooltip"><b>{label}</b><span><i style={{ background: item.color }}/> {item.name}</span><strong>{FRENCH_NUMBER.format(value)} lignes</strong><small>{total ? FRENCH_PERCENT.format(value / total) : "0 %"} des lignes de ce commercial</small></div>;
}

function FeedbackChart({ data, type }) {
  if (!data.length) return <ChartEmpty/>;
  if (type === "area") { const xKey = data[0]?.month ? "label" : "date"; return <ResponsiveContainer width="100%" height={265}><AreaChart data={data} margin={{ top: 12, right: 10, left: -16, bottom: 0 }}><defs><linearGradient id="feedbackFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B82F6" stopOpacity={0.24}/><stop offset="100%" stopColor="#3B82F6" stopOpacity={0.025}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e8eef0" strokeDasharray="3 4"/><XAxis dataKey={xKey} tickFormatter={xKey === "date" ? (value) => new Intl.DateTimeFormat("fr-FR", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : undefined} minTickGap={48} tick={{ fill: "#7b8a91", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tickFormatter={(value) => FRENCH_NUMBER.format(value)} tick={{ fill: "#7b8a91", fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Area dataKey="count" name="Lignes d’avis" type="monotone" stroke="#3B82F6" strokeWidth={2.4} fill="url(#feedbackFill)" activeDot={{ r: 5, fill: "#14B8A6" }}/></AreaChart></ResponsiveContainer>; }
  if (type === "line") return <ResponsiveContainer width="100%" height={280}><LineChart data={data} margin={{ top: 14, right: 18, left: 0, bottom: 3 }}><CartesianGrid vertical={false} stroke="#e8edf4" strokeDasharray="3 4"/><XAxis dataKey="label" tick={{ fill: "#718096", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} width={42} tickFormatter={(value) => FRENCH_NUMBER.format(value)} tick={{ fill: "#718096", fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Line dataKey="count" name="Lignes d’avis" type="monotone" stroke="#4867cf" strokeWidth={2.5} activeDot={{ r: 5 }} dot={{ r: 3, fill: "#168c84", strokeWidth: 0 }}/></LineChart></ResponsiveContainer>;
  return <ResponsiveContainer width="100%" height={265}><BarChart data={data}><CartesianGrid vertical={false} stroke="#e8eef0" strokeDasharray="3 4"/><XAxis dataKey="label" tick={{ fill: "#7b8a91", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{ fill: "#7b8a91", fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Bar dataKey="count" name="Retours" fill="#7fa8c9" radius={[4, 4, 0, 0]} maxBarSize={30}/></BarChart></ResponsiveContainer>;
}

function FeedbackBars({ rows, colors }) {
  if (!rows.length) return <ChartEmpty/>;
  return <ResponsiveContainer width="100%" height={Math.max(250, rows.length * 33)}><BarChart data={rows} layout="vertical" margin={{ left: 10, right: 18, top: 4, bottom: 4 }}><CartesianGrid horizontal={false} stroke="#e8eef0" strokeDasharray="3 4"/><XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#7b8a91", fontSize: 10 }} tickFormatter={(value) => FRENCH_NUMBER.format(value)}/><YAxis type="category" dataKey="name" width={128} axisLine={false} tickLine={false} tick={{ fill: "#52666d", fontSize: 10 }}/><Tooltip content={<ChartTooltip/>}/><Bar dataKey="count" name="Lignes CSV" radius={[0, 4, 4, 0]} barSize={19}>{rows.map((row, index) => <Cell key={row.name} fill={colors[index % colors.length]}/>)}</Bar></BarChart></ResponsiveContainer>;
}

const STATUS_COLORS = CHART_COLORS;
const compactLabel = (value) => String(value).length > 20 ? `${String(value).slice(0, 19)}…` : value;

function DistributionTooltip({ active, payload, total }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const count = Number(row.count) || 0;
  return <div className="chart-tooltip"><b>{row.name}</b><span><i style={{ background: payload[0].color }}/> {FRENCH_NUMBER.format(count)} lignes</span><span>{total ? FRENCH_PERCENT.format(count / total) : "0 %"} du total</span></div>;
}

function StatusDonutChart({ rows, selectedCategory = "", onSelectCategory }) {
  if (!rows.length) return <ChartEmpty/>;
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const visible = rows.slice(0, 6);
  const remainder = rows.slice(6).reduce((sum, row) => sum + row.count, 0);
  const chartRows = [...visible.map((row) => ({ ...row })), ...(remainder ? [{ name: "Autres (visuel)", count: remainder }] : [])];
  const select = (name) => {
    if (name === "Autres (visuel)" || !onSelectCategory) return;
    onSelectCategory(selectedCategory === name ? "" : name);
  };
  return <div className="status-donut-wrap">
    <div className="status-donut-chart">
      <ResponsiveContainer width="100%" height={220}><PieChart>
        <Pie data={chartRows} dataKey="count" nameKey="name" innerRadius="64%" outerRadius="88%" paddingAngle={2} stroke="none" onClick={(entry) => select(entry?.name)}>
          {chartRows.map((row, index) => <Cell key={`${row.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} cursor={row.name === "Autres (visuel)" ? "default" : "pointer"}/>) }
        </Pie>
        <Tooltip content={<DistributionTooltip total={total}/>}/>
      </PieChart></ResponsiveContainer>
      <div className="donut-center" aria-hidden="true"><b>{fmtCount(total)}</b><span>lignes</span></div>
    </div>
    <div className="status-donut-legend" aria-label="Valeurs brutes LIB_AVIS et comptages">
      {rows.map((row, index) => {
        const active = selectedCategory === row.name;
        const item = <><i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}/><span title={row.name}>{row.name}</span><b>{fmtCount(row.count)}</b><small>{total ? FRENCH_PERCENT.format(row.count / total) : "0 %"}</small></>;
        return onSelectCategory
          ? <button type="button" key={`${row.name}-${index}`} className={active ? "selected" : ""} aria-pressed={active} onClick={() => select(row.name)}>{item}</button>
          : <div key={`${row.name}-${index}`}>{item}</div>;
      })}
    </div>
    {remainder > 0 && <p className="status-chart-note">Le secteur « Autres » regroupe uniquement les petites parts à l’écran; la légende conserve chaque valeur et son comptage.</p>}
  </div>;
}

function StatusDistributionChart({ rows }) {
  if (!rows.length) return <ChartEmpty/>;
  const chartRows = rows.map((row) => ({ ...row, displayName: compactLabel(row.name) }));
  return <div className="status-distribution-chart" role="img" aria-label={`Répartition des valeurs brutes LIB_AVIS : ${rows.map((row) => `${row.name}, ${FRENCH_NUMBER.format(row.count)} lignes`).join(" ; ")}`}>
    <ResponsiveContainer width="100%" height={Math.max(250, rows.length * 36)}><BarChart data={chartRows} layout="vertical" margin={{ left: 0, right: 38, top: 5, bottom: 5 }} barCategoryGap={12}>
      <CartesianGrid horizontal={false} stroke="#e8edf4" strokeDasharray="3 4"/>
      <XAxis type="number" hide domain={[0, (dataMax) => Math.max(1, dataMax * 1.2)]}/>
      <YAxis type="category" dataKey="displayName" width={132} axisLine={false} tickLine={false} tick={{ fill: "#42516a", fontSize: 10 }}/>
      <Tooltip content={<ChartTooltip/>}/>
      <Bar dataKey="count" name="Lignes CSV" radius={[0, 5, 5, 0]} barSize={18}>
        {chartRows.map((row, index) => <Cell key={`${row.name}-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]}/>)}
        <LabelList dataKey="count" position="right" formatter={(value) => FRENCH_NUMBER.format(value)} fill="#34445f" fontSize={10} fontWeight={700}/>
      </Bar>
    </BarChart></ResponsiveContainer>
    <p className="status-chart-note">Comptages de lignes · catégorie source brute, sans interprétation métier</p>
  </div>;
}

const TUITION_LABELS = { students: "Étudiants & inscriptions", schedule: "Échéancier", references: "Référentiels" };
const TUITION_DATE_FIELDS = { students: ["nextDueDate"], schedule: ["dueDate", "paymentDate"] };
const tuitionDateKey = (value) => value instanceof Date && !Number.isNaN(value.valueOf()) ? value.toISOString().slice(0, 10) : "";
const tuitionInRange = (value, range) => { const key = tuitionDateKey(value); return (!range?.startDate || (key && key >= range.startDate)) && (!range?.endDate || (key && key <= range.endDate)); };
const fmtTuitionMoney = (value) => value === null || value === undefined ? "Indisponible" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
const displayTuitionDate = (value) => value instanceof Date && !Number.isNaN(value.valueOf()) ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(value) : "—";
const tuitionOptions = (rows, key) => [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
const tuitionReferenceOptions = (source, key, fallback) => {
  const values = (source?.mappedRows ?? []).map((row) => row[key]).filter((value) => String(value ?? "").trim()).map(String);
  return values.length ? [...new Set(values)].sort((a, b) => a.localeCompare(b, "fr")) : fallback;
};

function TuitionSourceCard({ sourceType, source, error, onImport, onMapping }) {
  const fields = TUITION_SOURCE_FIELDS[sourceType] ?? [];
  const mapped = source?.mappedRows ?? [];
  const status = source ? source.quality?.status ?? "incomplete" : "not-loaded";
  const label = sourceType === "references" ? "référentiels" : TUITION_LABELS[sourceType]?.toLowerCase();
  return <section className="tuition-source-card">
    <div className="tuition-source-heading"><div><span className={`source-state-dot ${status}`}/><h2>{TUITION_LABELS[sourceType] ?? "Référentiels & paramètres"}</h2><p>{source ? `${source.fileName} · ${fmtCount(source.rowCount)} lignes détectées · séparateur ${source.delimiter === "\t" ? "tabulation" : source.delimiter}` : `Aucune source ${label} importée. Sélectionnez un CSV local pour commencer.`}</p></div><TuitionCsvImportButton sourceType={sourceType} onFile={onImport} label={source ? "Remplacer le CSV" : `Importer ${sourceType === "references" ? "les référentiels" : "le fichier"}`}/></div>
    {error && <div className="csv-import-error" role="alert">{error}</div>}
    {source && <>
      {source.missingRequired?.length > 0 && <div className="quality-warning">Colonnes d’identification non reconnues : {source.missingRequired.join(", ")}. Associez manuellement les colonnes ci-dessous.</div>}
      {source.quality?.duplicateIdentifiers > 0 && <div className="quality-warning">{fmtCount(source.quality.duplicateIdentifiers)} identifiant(s) répété(s). Les décomptes distincts restent séparés des lignes; les sommes individuelles sont à contrôler.</div>}
      <details className="tuition-mapping"><summary>Vérifier le mapping des colonnes</summary><div className="financial-mapping-grid">{fields.map(([id, title, kind]) => <label className="financial-mapping-field" key={id}><span>{title}{kind === true ? " · requis" : ""}</span><select aria-label={`${title} — colonne source`} value={source.mapping?.[id] ?? ""} onChange={(event) => onMapping(sourceType, { ...source.mapping, [id]: event.target.value })}><option value="">Non mappé</option>{source.headers.map((header) => <option value={header} key={header}>{header}</option>)}</select></label>)}</div></details>
      {sourceType === "references" && <div className="reference-values-grid">{fields.map(([id, title]) => <div key={id}><b>{title}</b><span>{(source.mappedRows ?? []).map((row) => row[id]).filter(Boolean).join(" · ") || "Colonne absente ou vide"}</span></div>)}</div>}
      <p className="tuition-quality-note">État : <b>{status === "valid" ? "valide" : status === "incomplete" ? "incomplet — mapping ou contrôle requis" : "non chargé"}</b> · {fmtCount(mapped.length)} ligne(s) exploitables · contenu conservé localement dans IndexedDB sur cet appareil.</p>
      {(source.quality?.invalidDates > 0 || source.quality?.invalidAmounts > 0 || source.quality?.remainingDiscrepancies > 0) && <p className="tuition-quality-note">{fmtCount(source.quality?.invalidDates)} date(s) invalide(s) ? {fmtCount(source.quality?.invalidAmounts)} valeur(s) num?rique(s) invalide(s) ? {fmtCount(source.quality?.remainingDiscrepancies)} ?cart(s) sur le reste calcul?.</p>}
    </>}
  </section>;
}

function TuitionDataTable({ rows, columns, empty = "Aucune ligne pour cette sélection." }) {
  const renderValue = (value, format) => value instanceof Date ? displayTuitionDate(value)
    : value === null || value === undefined || value === "" ? "—"
      : format === "money" ? fmtTuitionMoney(value)
        : format === "number" ? FRENCH_NUMBER.format(value) : value;
  return rows.length ? <div className="table-scroll"><table className="commercial-table tuition-table"><thead><tr>{columns.map(([key, label, format]) => <th className={format ? "numeric-cell" : ""} key={key}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.studentId ?? row.installmentId ?? row.matricule ?? "row"}-${index}`}>{columns.map(([key, , format]) => <td className={format ? "numeric-cell" : ""} key={key}>{renderValue(row[key], format)}</td>)}</tr>)}</tbody></table></div> : <EmptyState compact title="Aucune donnée dans cette sélection" detail={empty}/>;
}

function TuitionStudentsPage({ source, references, error, onImport, onMapping, dateRange }) {
  const [search, setSearch] = useState(""); const [formation, setFormation] = useState(""); const [campus, setCampus] = useState(""); const [year, setYear] = useState(""); const [status, setStatus] = useState(""); const [paymentMethod, setPaymentMethod] = useState(""); const [selected, setSelected] = useState(null); const [page, setPage] = useState(0);
  const rows = source?.mappedRows ?? [];
  const filtered = rows.filter((row) => (!search || `${row.matricule ?? ""} ${row.lastName ?? ""} ${row.firstName ?? ""}`.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr"))) && (!formation || row.formation === formation) && (!campus || row.campus === campus) && (!year || row.academicYear === year) && (!status || row.globalStatus === status) && (!paymentMethod || row.paymentMethod === paymentMethod) && tuitionInRange(row.nextDueDate, dateRange));
  useEffect(() => setPage(0), [search, formation, campus, year, status, paymentMethod, dateRange.startDate, dateRange.endDate]);
  const pageRows = filtered.slice(page * 25, (page + 1) * 25);
  const summary = summarizeStudents(filtered);
  const unique = new Map(); for (const row of filtered) { const key = row.studentId || row.matricule; if (key && !unique.has(key)) unique.set(key, row); }
  const cleanForMoney = unique.size === filtered.filter((row) => row.studentId || row.matricule).length;
  const columns = [["matricule", "Matricule"], ["lastName", "Nom"], ["firstName", "Prénom"], ["formation", "Formation"], ["academicYear", "Année"], ["campus", "Campus"], ["amountDue", "À payer", true], ["amountPaid", "Payé", true], ["amountRemaining", "Reste", true], ["globalStatus", "Statut"]];
  return <><PageTitle eyebrow="SUIVI DES SCOLARITÉS" title="Étudiants & inscriptions" subtitle="Situation individuelle selon le fichier étudiant importé; une ligne n’est pas automatiquement une inscription distincte." badge={source ? source.quality?.status ?? "CSV local" : "Source requise"}/>
    {!source ? <TuitionSourceCard sourceType="students" source={null} error={error} onImport={onImport} onMapping={onMapping}/> : <>
      <TuitionSourceCard sourceType="students" source={source} error={error} onImport={onImport} onMapping={onMapping}/>
      <div className="commercial-kpi-grid tuition-kpis"><MetricCard title="Étudiants distincts" value={fmtCount(summary.distinctStudents)} helper="ID Étudiant prioritaire, Matricule en repli" icon="candidate"/><MetricCard title="Montant à payer" value={cleanForMoney ? fmtTuitionMoney(summary.amountDue) : "À contrôler"} helper={cleanForMoney ? "Somme source · lignes identifiées" : "Identifiants répétés : agrégat suspendu"} icon="target" unavailable={!cleanForMoney || summary.amountDue === null}/><MetricCard title="Montant payé" value={cleanForMoney ? fmtTuitionMoney(summary.amountPaid) : "À contrôler"} helper="Champ Total payé" icon="euro" unavailable={!cleanForMoney || summary.amountPaid === null}/><MetricCard title="Reste à payer" value={cleanForMoney ? fmtTuitionMoney(summary.amountRemaining) : "À contrôler"} helper="Champ source Reste à payer" icon="total" unavailable={!cleanForMoney || summary.amountRemaining === null}/><MetricCard title="Étudiants en retard" value={fmtCount(summary.overdueStudents)} helper="Jours de retard renseignés" icon="followup"/></div>
      <div className="tuition-filterbar"><label>Recherche<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Matricule, nom ou prénom"/></label>{[["Formation", formation, setFormation, tuitionReferenceOptions(references, "formations", tuitionOptions(rows, "formation"))],["Campus", campus, setCampus, tuitionReferenceOptions(references, "campuses", tuitionOptions(rows, "campus"))],["Année universitaire", year, setYear, tuitionReferenceOptions(references, "academicYears", tuitionOptions(rows, "academicYear"))],["Statut global", status, setStatus, tuitionOptions(rows, "globalStatus")],["Mode de paiement", paymentMethod, setPaymentMethod, tuitionReferenceOptions(references, "paymentMethods", tuitionOptions(rows, "paymentMethod"))]].map(([label, value, setter, options]) => <label key={label}>{label}<select value={value} onChange={(event) => setter(event.target.value)}><option value="">Tous</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>)}<button className="outline-button" onClick={() => { setSearch(""); setFormation(""); setCampus(""); setYear(""); setStatus(""); setPaymentMethod(""); }}>Réinitialiser</button></div>
      <Panel title="Dossiers étudiants" subtitle={`${fmtCount(filtered.length)} ligne(s) · ${fmtCount(summary.distinctStudents)} identifiant(s) distinct(s)`}><div className="table-scroll"><table className="commercial-table tuition-table"><thead><tr>{columns.map(([key, label, numeric]) => <th key={key} className={numeric ? "numeric-cell" : ""}>{label}</th>)}<th>Détail</th></tr></thead><tbody>{pageRows.map((row, index) => <tr key={`${row.studentId ?? row.matricule}-${index + page * 25}`}>{columns.map(([key, , numeric]) => <td key={key} className={numeric ? "numeric-cell" : ""}>{row[key] instanceof Date ? displayTuitionDate(row[key]) : key.startsWith("amount") ? fmtTuitionMoney(row[key]) : row[key] ?? "—"}</td>)}<td><button className="outline-button" onClick={() => setSelected(row)}>Consulter</button></td></tr>)}</tbody></table></div><div className="tuition-pagination"><span>{filtered.length ? `${page * 25 + 1}–${Math.min((page + 1) * 25, filtered.length)} sur ${filtered.length}` : "0 ligne"}</span><button className="outline-button" type="button" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Précédent</button><button className="outline-button" type="button" disabled={(page + 1) * 25 >= filtered.length} onClick={() => setPage((current) => current + 1)}>Suivant</button></div></Panel>
      {selected && <div className="tuition-modal-backdrop" role="presentation" onClick={() => setSelected(null)}><section className="tuition-student-dialog" role="dialog" aria-modal="true" aria-label="Détail étudiant" onClick={(event) => event.stopPropagation()}><button className="tuition-dialog-close" aria-label="Fermer" onClick={() => setSelected(null)}>×</button><h2>{[selected.firstName, selected.lastName].filter(Boolean).join(" ") || "Détail étudiant"}</h2><p>Matricule · {selected.matricule ?? "—"}</p><dl>{Object.entries(selected).filter(([, value]) => value !== null).map(([key, value]) => <Fragment key={key}><dt>{key}</dt><dd>{value instanceof Date ? displayTuitionDate(value) : String(value)}</dd></Fragment>)}</dl></section></div>}
    </>}
  </>;
}

function TuitionSchedulePage({ source, references, error, onImport, onMapping, students, dateRange }) {
  const [status, setStatus] = useState(""); const [formation, setFormation] = useState(""); const [method, setMethod] = useState("");
  const rows = source?.mappedRows ?? [];
  const filtered = rows.filter((row) => (!status || row.status === status) && (!formation || row.formation === formation) && (!method || row.paymentMethod === method) && tuitionInRange(row.dueDate ?? row.paymentDate, dateRange));
  const summary = summarizeSchedule(filtered, students ?? []);
  const monthMap = new Map(); for (const row of filtered) { const due = tuitionDateKey(row.dueDate).slice(0, 7); const paid = tuitionDateKey(row.paymentDate).slice(0, 7); if (due) { const item = monthMap.get(due) ?? { month: due, planned: null, collected: null }; if (Number.isFinite(row.plannedAmount)) item.planned = (item.planned ?? 0) + row.plannedAmount; monthMap.set(due, item); } if (paid) { const item = monthMap.get(paid) ?? { month: paid, planned: null, collected: null }; if (Number.isFinite(row.paidAmount)) item.collected = (item.collected ?? 0) + row.paidAmount; monthMap.set(paid, item); } }
  const monthly = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));
  const columns = [["installmentId", "ID échéance"], ["matricule", "Matricule"], ["studentName", "Étudiant"], ["formation", "Formation"], ["installmentNumber", "N°", "number"], ["dueDate", "Échéance"], ["plannedAmount", "Prévu", "money"], ["paidAmount", "Payé", "money"], ["remainingAmount", "Reste", "money"], ["status", "Statut"], ["paymentDate", "Date paiement"], ["paymentMethod", "Mode règlement"], ["daysOverdue", "Retard (j)", "number"]];
  return <><PageTitle eyebrow="CALENDRIER DES VERSEMENTS" title="Échéancier" subtitle="Échéances et règlements selon les lignes réellement présentes dans la source." badge={source ? source.quality?.status ?? "CSV local" : "Source requise"}/>
    {!source ? <TuitionSourceCard sourceType="schedule" source={null} error={error} onImport={onImport} onMapping={onMapping}/> : <><TuitionSourceCard sourceType="schedule" source={source} error={error} onImport={onImport} onMapping={onMapping}/>
      <div className="commercial-kpi-grid tuition-kpis"><MetricCard title="Échéances filtrées" value={fmtCount(summary.count)} helper="Lignes de source, pas étudiants" icon="total"/><MetricCard title="Montant prévu" value={fmtTuitionMoney(summary.planned)} helper="Montant prévu · échéancier" icon="target" unavailable={summary.planned === null}/><MetricCard title="Montant payé" value={fmtTuitionMoney(summary.paid)} helper="Somme des montants payés renseignés" icon="euro" unavailable={summary.paid === null}/><MetricCard title="Reste des échéances" value={fmtTuitionMoney(summary.remaining)} helper="Champ source uniquement" icon="total" unavailable={summary.remaining === null}/><MetricCard title="En retard" value={fmtCount(summary.overdue)} helper="Jours de retard strictement positifs" icon="followup"/></div>
      <div className="tuition-filterbar">{[["Statut", status, setStatus, tuitionReferenceOptions(references, "installmentStatuses", tuitionOptions(rows, "status"))],["Formation", formation, setFormation, tuitionReferenceOptions(references, "formations", tuitionOptions(rows, "formation"))],["Mode règlement", method, setMethod, tuitionReferenceOptions(references, "settlementMethods", tuitionOptions(rows, "paymentMethod"))]].map(([label, value, setter, options]) => <label key={label}>{label}<select value={value} onChange={(event) => setter(event.target.value)}><option value="">Tous</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>)}<button className="outline-button" onClick={() => { setStatus(""); setFormation(""); setMethod(""); }}>Réinitialiser</button><span className="tuition-filter-count">{fmtCount(filtered.length)} lignes</span></div>
      <div className="commercial-grid"><Panel title="Statuts source des échéances" subtitle="Valeurs réellement présentes dans le champ Statut">{summary.statuses.length ? <div className="tuition-status-donut" role="img" aria-label="Repartition par statut source des echeances"><ResponsiveContainer width="100%" height={265}><PieChart><Pie data={summary.statuses.map(({ label, count }) => ({ name: label, value: count }))} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="72%" paddingAngle={2}>{summary.statuses.map((row, index) => <Cell key={row.label} fill={CHART_COLORS[index % CHART_COLORS.length]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div> : <EmptyState compact title="Aucun statut renseigne"/>}</Panel><Panel title="Prévu et payé par mois" subtitle="Prévu regroupé par date d’échéance; payé par date de paiement" className="panel-span-two">{monthly.length ? <ResponsiveContainer width="100%" height={270}><AreaChart data={monthly}><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 4"/><XAxis dataKey="month" tickFormatter={formatMonthFr}/><YAxis tickFormatter={(value) => FRENCH_NUMBER.format(value)}/><Tooltip content={<ChartTooltip/>}/><Legend/><Area dataKey="planned" name="Prévu" stroke="#6366F1" fill="#6366F1" fillOpacity={.12} connectNulls={false}/><Area dataKey="collected" name="Payé" stroke="#14B8A6" fill="#14B8A6" fillOpacity={.15} connectNulls={false}/></AreaChart></ResponsiveContainer> : <EmptyState compact title="Dates exploitables insuffisantes"/>}</Panel></div>
      <Panel title="Échéances détaillées" subtitle={`${fmtCount(filtered.length)} échéance(s) · données financières locales`}><TuitionDataTable rows={filtered} columns={columns}/></Panel>
    </>}
  </>;
}

function TuitionRevenuePage({ sources, aggregate, errors, onImport, onMapping, financialSource, financialError, onFinancialImport, onFinancialMapping, dateRange }) {
  const students = sources.students; const schedule = sources.schedule;
  const studentRows = (students?.mappedRows ?? []).filter((row) => tuitionInRange(row.nextDueDate, dateRange));
  const scheduleRows = (schedule?.mappedRows ?? []).filter((row) => tuitionInRange(row.dueDate, dateRange));
  const studentSummary = summarizeStudents(studentRows); const scheduleSummary = summarizeSchedule(scheduleRows, studentRows);
  const aggregateData = aggregate?.mapped;
  return <><PageTitle eyebrow="PILOTAGE DES FRAIS DE SCOLARITÉ" title="Revenus & encaissements" subtitle="Chaque indicateur reste rattaché à sa source; les lignes détaillées et les tableaux agrégés ne sont jamais additionnés." badge="Sources indépendantes"/>
    <div className="tuition-source-grid"><TuitionSourceCard sourceType="students" source={students} error={errors.students} onImport={onImport} onMapping={onMapping}/><TuitionSourceCard sourceType="schedule" source={schedule} error={errors.schedule} onImport={onImport} onMapping={onMapping}/></div>
    {(students || schedule) ? <><h2 className="tuition-section-heading">Données détaillées · périmètres distincts</h2><p className="tuition-section-note">Les montants étudiants viennent de Source A; les paiements et échéances viennent de Source B. Aucun total combiné n’est calculé.</p><div className="commercial-kpi-grid tuition-kpis">{students && <><MetricCard title="Étudiants distincts · Source A" value={fmtCount(studentSummary.distinctStudents)} helper="Identifiants distincts" icon="candidate"/><MetricCard title="À payer · Source A" value={fmtTuitionMoney(studentSummary.amountDue)} helper="Total à payer étudiant" icon="target" unavailable={studentSummary.amountDue === null}/><MetricCard title="Payé · Source A" value={fmtTuitionMoney(studentSummary.amountPaid)} helper="Total payé étudiant" icon="euro" unavailable={studentSummary.amountPaid === null}/><MetricCard title="Reste · Source A" value={fmtTuitionMoney(studentSummary.amountRemaining)} helper="Reste à payer étudiant" icon="total" unavailable={studentSummary.amountRemaining === null}/></>}{schedule && <><MetricCard title="Échéances · Source B" value={fmtCount(scheduleSummary.count)} helper="Lignes d’échéancier" icon="total"/><MetricCard title="Prévu · Source B" value={fmtTuitionMoney(scheduleSummary.planned)} helper="Montant prévu" icon="target" unavailable={scheduleSummary.planned === null}/><MetricCard title="Payé · Source B" value={fmtTuitionMoney(scheduleSummary.paid)} helper="Montant payé sur échéances" icon="euro" unavailable={scheduleSummary.paid === null}/><MetricCard title="Reste échéances · Source B" value={fmtTuitionMoney(scheduleSummary.remaining)} helper="Reste échéance fourni" icon="total" unavailable={scheduleSummary.remaining === null}/></>}</div></> : <section className="financial-empty-state"><span className="financial-empty-icon"><Icon name="euro"/></span><div className="eyebrow">SOURCES DÉTAILLÉES</div><h2>Aucun fichier étudiant ou échéancier importé</h2><p>Importez Source A et/ou Source B pour afficher les indicateurs individuels. L’import se fait localement et chaque source peut être chargée séparément.</p></section>}
    <section className="tuition-aggregate-section"><div className="tuition-section-heading-row"><div><h2>{financialSource && !aggregateData?.reportModel ? "Source financière importée · mapping requis" : "Synthèse financière agrégée · Source C"}</h2><p>{financialSource && !aggregateData?.reportModel ? "Le fichier importé ne correspond pas au format agrégé Source C. Son mapping reste indépendant des sources détaillées." : "Source de contrôle indépendante, sans addition avec les lignes détaillées."}</p></div><FinancialCsvImportButton onFile={onFinancialImport} label={financialSource ? "Remplacer le CSV financier" : "Importer la synthèse agrégée"}/></div>{financialError && <div className="csv-import-error" role="alert">{financialError}</div>}{aggregateData?.reportModel ? <div className="commercial-grid"><Panel title="Montants par filière · Source C" subtitle="Agrégats tels que fournis; totaux généraux exclus"><TuitionDataTable rows={aggregateData.programRows} columns={[["name", "Filière"],["plannedAmount", "À payer", "money"],["collectedAmount", "Encaissé", "money"],["remainingAmount", "Reste", "money"],["reportedRate", "Taux source"]]}/></Panel><Panel title="Contrôle des périmètres" subtitle="Les tableaux mensuels et par filière sont des agrégats indépendants"><div className="source-alert"><span className="source-alert-icon">i</span><div><b>Ne pas additionner les tableaux</b><p>Les totaux peuvent diverger entre vues fournies par le fichier. Ils restent affichés séparément; les écarts ne sont ni corrigés ni masqués.</p></div></div><p className="tuition-quality-note">Source agrégée · {fmtCount(aggregateData.monthlyRows.length)} périodes · {fmtCount(aggregateData.programRows.length)} filières · sommes de lignes détaillées disponibles dans l’onglet Revenus & inscriptions existant.</p></Panel></div> : financialSource ? <GenericFinancialPage embedded source={financialSource} error="" onImport={onFinancialImport} onMapping={onFinancialMapping} period={dateRange}/> : <p className="tuition-quality-note">Aucune synthèse agrégée importée.</p>}</section>
  </>;
}

function TuitionFormationsPage({ students, schedule, aggregate, dateRange }) {
  const studentRows = (students?.mappedRows ?? []).filter((row) => tuitionInRange(row.nextDueDate, dateRange));
  const scheduleRows = (schedule?.mappedRows ?? []).filter((row) => tuitionInRange(row.dueDate, dateRange));
  const rows = groupTuitionByFormation(studentRows, scheduleRows);
  const aggregateRows = aggregate?.mapped?.programRows ?? [];
  const chartRows = rows.filter((row) => Number.isFinite(row.amountDue));
  return <><PageTitle eyebrow="ANALYSE FINANCIÈRE" title="Analyse par formation" subtitle="Les lignes par formation sont affichées par source; les agrégats fournis restent distincts des données détaillées." badge="Périmètre source"/>
    {chartRows.length > 0 && <Panel title={"Classement par montant à payer ? Source A"} subtitle="Sommes d?taill?es compl?tes par formation"><ResponsiveContainer width="100%" height={Math.max(240, chartRows.length * 34)}><BarChart data={chartRows} layout="vertical" margin={{ left: 5, right: 28 }}><CartesianGrid horizontal={false} stroke="var(--chart-grid)" strokeDasharray="3 4"/><XAxis type="number" tickFormatter={(value) => FRENCH_NUMBER.format(value)}/><YAxis type="category" dataKey="formation" width={140}/><Tooltip content={<ChartTooltip/>}/><Bar dataKey="amountDue" name={"Montant à payer"} fill="#6366F1" radius={[0,5,5,0]} barSize={22}/></BarChart></ResponsiveContainer></Panel>}
    {rows.length ? <Panel title="Formation · données détaillées" subtitle="Montants étudiants Source A; nombre d’échéances Source B, sans jointure des montants"><div className="table-scroll"><table className="commercial-table tuition-table"><thead><tr><th>Formation</th><th className="numeric-cell">Étudiants distincts · A</th><th className="numeric-cell">Échéances · B</th><th className="numeric-cell">À payer · A</th><th className="numeric-cell">Payé · A</th><th className="numeric-cell">Reste · A</th></tr></thead><tbody>{rows.map((row) => <tr key={row.formation}><td>{row.formation}</td><td className="numeric-cell">{row.studentCount ?? "—"}</td><td className="numeric-cell">{row.scheduleCount ?? "—"}</td><td className="numeric-cell">{fmtTuitionMoney(row.amountDue)}</td><td className="numeric-cell">{fmtTuitionMoney(row.amountPaid)}</td><td className="numeric-cell">{fmtTuitionMoney(row.amountRemaining)}</td></tr>)}</tbody></table></div></Panel> : <EmptyState title="Aucune donnée détaillée par formation" detail="Importez un fichier étudiant ou d’échéancier contenant une colonne Formation."/>}
    <Panel title="Agrégat filière · Source C" subtitle="Tableau indépendant fourni par la synthèse financière">{aggregateRows.length ? <TuitionDataTable rows={aggregateRows} columns={[["name", "Filière"],["plannedAmount", "À payer", "money"],["collectedAmount", "Encaissé", "money"],["remainingAmount", "Reste", "money"],["reportedRate", "Taux source"]]}/> : <EmptyState compact title="Aucun agrégat par filière reconnu"/>}</Panel>
  </>;
}

function TuitionDataSourcesPage({ sources, errors, onImport, onMapping, financialSource, financialError, onFinancialImport, onClearSaved }) {
  return <><PageTitle eyebrow="CONFIGURATION LOCALE" title="Référentiels & paramètres" subtitle="État des sources, correspondance des colonnes et qualité de données. Les imports sont conservés localement dans ce navigateur." badge="Données locales"/>
    <div className="tuition-source-grid"><TuitionSourceCard sourceType="students" source={sources.students} error={errors.students} onImport={onImport} onMapping={onMapping}/><TuitionSourceCard sourceType="schedule" source={sources.schedule} error={errors.schedule} onImport={onImport} onMapping={onMapping}/><TuitionSourceCard sourceType="references" source={sources.references} error={errors.references} onImport={onImport} onMapping={onMapping}/></div>
    <div className="local-import-retention"><div><b>Imports gardés sur cet appareil</b><span>Les données importées sont enregistrées dans IndexedDB pour les retrouver après fermeture du navigateur. Elles ne sont ni incluses dans GitHub Pages ni envoyées à un serveur.</span></div><button type="button" className="outline-button" onClick={onClearSaved}>Effacer les imports enregistrés</button></div>
    <section className="tuition-source-card"><div className="tuition-source-heading"><div><span className={`source-state-dot ${financialSource ? "valid" : "not-loaded"}`}/><h2>Synthèse agrégée · Source C</h2><p>{financialSource ? `${financialSource.fileName} · ${fmtCount(financialSource.rowCount)} lignes source · tableau agrégé` : "Aucune synthèse agrégée importée."}</p></div><FinancialCsvImportButton onFile={onFinancialImport} label={financialSource ? "Remplacer Source C" : "Importer Source C"}/></div>{financialError && <div className="csv-import-error" role="alert">{financialError}</div>}</section>
    <Panel title="Qualité structurelle" subtitle="Les contrôles n’affichent aucune valeur personnelle ni ligne de paiement"><div className="source-quality-grid">{["students","schedule","references"].map((type) => { const source = sources[type]; return <div key={type}><b>{TUITION_LABELS[type]}</b><span>{source ? `${source.quality?.status === "valid" ? "Valide" : "Incomplet"} · ${fmtCount(source.quality?.validRows)} ligne(s) exploitables · ${fmtCount(source.quality?.invalidRows)} ignorée(s)` : "Non chargé"}</span>{source?.quality?.duplicateIdentifiers > 0 && <small>{fmtCount(source.quality.duplicateIdentifiers)} identifiants dupliqués</small>}</div>; })}</div><p className="tuition-quality-note">Modes de paiement et modes de règlement restent deux champs séparés. Aucun état de paiement ou d’échéance n’est normalisé sans valeurs de source vérifiées.</p></Panel>
  </>;
}

function TuitionOverviewSummary({ sources, aggregate, dateRange }) {
  const students = (sources.students?.mappedRows ?? []).filter((row) => tuitionInRange(row.nextDueDate, dateRange));
  const schedule = (sources.schedule?.mappedRows ?? []).filter((row) => tuitionInRange(row.dueDate, dateRange));
  const studentSummary = summarizeStudents(students); const scheduleSummary = summarizeSchedule(schedule, students);
  const formations = groupTuitionByFormation(students, schedule).filter((row) => row.amountDue !== null).slice(0, 8);
  const statusRows = scheduleSummary.statuses;
  const aggregateData = aggregate?.mapped?.reportModel ? aggregate.mapped : null;
  return <section className="tuition-overview-block"><div className="tuition-section-heading-row"><div><h2>Situation des frais de scolarité</h2><p>Indicateurs séparés par source; aucun rapprochement n’additionne étudiants, échéances et agrégats.</p></div><span className="tuition-local-pill">Données locales</span></div>
    <div className="commercial-kpi-grid tuition-kpis">{sources.students && <><MetricCard title="Étudiants distincts · A" value={fmtCount(studentSummary.distinctStudents)} helper="Identifiants distincts" icon="candidate"/><MetricCard title="À payer · A" value={fmtTuitionMoney(studentSummary.amountDue)} helper="Source étudiants" icon="target" unavailable={studentSummary.amountDue === null}/><MetricCard title="Payé · A" value={fmtTuitionMoney(studentSummary.amountPaid)} helper="Source étudiants" icon="euro" unavailable={studentSummary.amountPaid === null}/></>}{sources.schedule && <><MetricCard title="Échéances · B" value={fmtCount(scheduleSummary.count)} helper="Lignes d’échéancier" icon="total"/><MetricCard title="En retard · B" value={fmtCount(scheduleSummary.overdue)} helper="Retard fourni supérieur à zéro" icon="followup"/></>}</div>
    {aggregateData && <><div className="tuition-section-heading-row"><div><h3>Synthèse agrégée · Source C</h3><p>Valeurs source affichées séparément des lignes étudiantes et des échéances; le filtre temporel A/B ne s’applique pas à ces agrégats sans dates complètes.</p></div></div><div className="commercial-kpi-grid tuition-kpis"><MetricCard title="À payer · C mensuel" value={fmtTuitionMoney(aggregateData.metrics.plannedAmount)} helper="Somme du tableau mensuel source" icon="target" unavailable={aggregateData.metrics.plannedAmount == null}/><MetricCard title="Encaissé · C mensuel" value={fmtTuitionMoney(aggregateData.metrics.collectedAmount)} helper="Somme du tableau mensuel source" icon="euro" unavailable={aggregateData.metrics.collectedAmount == null}/><MetricCard title="Reste · C filières" value={fmtTuitionMoney(aggregateData.metrics.programRemainingAmount)} helper="Somme des lignes par filière" icon="total" unavailable={aggregateData.metrics.programRemainingAmount == null}/></div><div className="commercial-grid">{aggregateData.monthlyRows.length > 0 && <Panel title="Prévu et encaissé par mois · Source C" subtitle="Série agrégée du fichier, sans raccord aux échéances détaillées" className="panel-span-two"><ResponsiveContainer width="100%" height={260}><AreaChart data={aggregateData.monthlyRows}><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 4"/><XAxis dataKey="period"/><YAxis tickFormatter={(value) => FRENCH_NUMBER.format(value)}/><Tooltip content={<ChartTooltip/>}/><Legend/><Area dataKey="plannedAmount" name="Prévu" stroke="#6366F1" fill="#6366F1" fillOpacity={.12}/><Area dataKey="collectedAmount" name="Encaissé" stroke="#14B8A6" fill="#14B8A6" fillOpacity={.15}/></AreaChart></ResponsiveContainer></Panel>}{aggregateData.programRows.length > 0 && <Panel title="Reste par filière · Source C" subtitle="Lignes de détail; total général exclu"><ResponsiveContainer width="100%" height={Math.max(220, aggregateData.programRows.length * 32)}><BarChart data={aggregateData.programRows.slice().sort((a, b) => (b.remainingAmount ?? -Infinity) - (a.remainingAmount ?? -Infinity))} layout="vertical" margin={{ left: 4, right: 20 }}><CartesianGrid horizontal={false} stroke="var(--chart-grid)" strokeDasharray="3 4"/><XAxis type="number" tickFormatter={(value) => FRENCH_NUMBER.format(value)}/><YAxis type="category" dataKey="name" width={130}/><Tooltip content={<ChartTooltip/>}/><Bar dataKey="remainingAmount" name="Reste source" fill="#F97373" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer></Panel>}{aggregateData.statusTotals.length > 0 && <Panel title="États source · C" subtitle="Comptages fournis par la synthèse"><StatusRows rows={aggregateData.statusTotals}/></Panel>}</div></>}
    <div className="commercial-grid">{formations.length > 0 && <Panel title="Formations · Source A" subtitle="Montant à payer par formation; valeurs inconnues omises"><ResponsiveContainer width="100%" height={250}><BarChart data={formations} layout="vertical" margin={{ left: 5, right: 24 }}><CartesianGrid horizontal={false} stroke="var(--chart-grid)" strokeDasharray="3 4"/><XAxis type="number" tickFormatter={(value) => FRENCH_NUMBER.format(value)}/><YAxis type="category" dataKey="formation" width={130}/><Tooltip content={<ChartTooltip/>}/><Bar dataKey="amountDue" name="À payer" fill="#6366F1" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer></Panel>}{statusRows.length > 0 && <Panel title="Statuts · Source B" subtitle="Libellés bruts du fichier échéancier"><StatusRows rows={statusRows.map(({ label, count }) => ({ name: label, count }))}/></Panel>}{!formations.length && !statusRows.length && <Panel title="Sources de suivi" subtitle="Aperçu de disponibilité"><div className="source-quality-grid"><div><b>Source A · Étudiants</b><span>{sources.students ? `${fmtCount(students.length)} lignes mappées` : "En attente d’import"}</span></div><div><b>Source B · Échéancier</b><span>{sources.schedule ? `${fmtCount(schedule.length)} lignes mappées` : "En attente d’import"}</span></div><div><b>Source C · Agrégats</b><span>{aggregate ? "Importée séparément" : "En attente d’import"}</span></div></div></Panel>}</div>
  </section>;
}

function App() {
  const [csvDashboard, dispatchCsvDashboard] = useReducer(dashboardCsvReducer, initialDashboardCsvState);
  const { activePage, importedCsv, importError, financialCsv, financialImportError } = csvDashboard;
  const tuitionSources = csvDashboard.tuitionSources ?? initialDashboardCsvState.tuitionSources;
  const tuitionImportErrors = csvDashboard.tuitionImportErrors ?? initialDashboardCsvState.tuitionImportErrors;
  const [feedbackRows, setFeedbackRows] = useState([]);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [bundle, setBundle] = useState(null);
  const [bundleError, setBundleError] = useState("");
  const [bundleLoading, setBundleLoading] = useState(Boolean(import.meta.env.VITE_COMMERCIAL_BUNDLE_URL));
  const [period, setPeriod] = useState({ startDate: "", endDate: "" });
  const [financialPeriod, setFinancialPeriod] = useState({ startDate: "", endDate: "" });
  const [csvFilters, setCsvFilters] = useState({ establishment: "", region: "", category: "" });
  const [followupFilters, setFollowupFilters] = useState({ salesperson: "", specialty: "", overdueStatus: "overdue" });
  const [theme, setTheme] = useState(() => { try { return resolveDashboardTheme(window.localStorage.getItem("merchant-dashboard-theme")); } catch { return "light"; } });
  const [sourceStorageReady, setSourceStorageReady] = useState(false);
  const [sourceStorageStatus, setSourceStorageStatus] = useState("loading");
  const [linkedFinancialFile, setLinkedFinancialFile] = useState(null);
  const [financialFileSignature, setFinancialFileSignature] = useState("");
  const [financialFileLinkStatus, setFinancialFileLinkStatus] = useState("idle");

  useEffect(() => {
    let active = true;
    loadPersistedDashboardSources()
      .then((snapshot) => {
        if (!active || !snapshot) return;
        dispatchCsvDashboard({ type: "restore-sources", snapshot });
        setLinkedFinancialFile(snapshot.financialFileHandle ?? null);
        setFinancialFileSignature(snapshot.financialFileSignature ?? "");
        setFinancialFileLinkStatus(snapshot.financialFileHandle ? "checking" : "idle");
      })
      .catch(() => { if (active) setSourceStorageStatus("unavailable"); })
      .finally(() => { if (active) { setSourceStorageReady(true); setSourceStorageStatus((current) => current === "unavailable" ? current : "ready"); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sourceStorageReady) return undefined;
    let active = true;
    saveDashboardSources(csvDashboard, { financialFileHandle: linkedFinancialFile, financialFileSignature })
      .then(() => { if (active) setSourceStorageStatus("saved"); })
      .catch(() => { if (active) setSourceStorageStatus("unavailable"); });
    return () => { active = false; };
  }, [sourceStorageReady, csvDashboard.importedCsv, csvDashboard.financialCsv, csvDashboard.tuitionSources, linkedFinancialFile, financialFileSignature]);

  useEffect(() => {
    if (!sourceStorageReady || !linkedFinancialFile) return undefined;
    let active = true;
    let reading = false;
    const syncLinkedFile = async () => {
      if (reading || document.visibilityState === "hidden") return;
      reading = true;
      try {
        const result = await refreshLinkedFinancialFile(linkedFinancialFile, financialFileSignature, async (file) => {
          if (active) setFinancialFileLinkStatus("updating");
          return importFinancialCsvWith(file, dispatchCsvDashboard, parseFinancialCsvFile);
        });
        if (!active) return;
        if (result.status === "permission-required") { setFinancialFileLinkStatus(result.status); return; }
        if (result.status === "invalid") { setFinancialFileLinkStatus("error"); return; }
        if (result.status === "updated") setFinancialFileSignature(result.signature);
        setFinancialFileLinkStatus("active");
      } catch {
        if (active) setFinancialFileLinkStatus("error");
      } finally {
        reading = false;
      }
    };
    void syncLinkedFile();
    const interval = window.setInterval(syncLinkedFile, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") void syncLinkedFile(); };
    window.addEventListener("focus", syncLinkedFile);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", syncLinkedFile);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sourceStorageReady, linkedFinancialFile, financialFileSignature]);

  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.BASE_URL}merchant_feedback_synthetic.csv`)
      .then((response) => { if (!response.ok) throw new Error(`CSV ${response.status}`); return response.text(); })
      .then((csv) => parseFeedbackCsv(csv))
      .then((rows) => { if (active) setFeedbackRows(rows); })
      .catch((error) => { if (active) setFeedbackError(`Impossible de charger le CSV synthétique (${error.message}).`); })
      .finally(() => { if (active) setFeedbackLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const sourceUrl = import.meta.env.VITE_COMMERCIAL_BUNDLE_URL;
    if (!sourceUrl) return undefined;
    let active = true;
    fetch(sourceUrl, { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then((data) => {
        const validation = validateCommercialBundle(data);
        if (!validation.valid) throw new Error(validation.errors.join(" "));
        if (active) setBundle(data);
      })
      .catch((error) => { if (active) setBundleError(error.message); })
      .finally(() => { if (active) setBundleLoading(false); });
    return () => { active = false; };
  }, []);

  const summary = useMemo(() => bundle ? summarizeCommercialBundle(bundle, period) : null, [bundle, period]);
  const financialSummary = useMemo(() => bundle ? summarizeCommercialBundle(bundle, financialPeriod) : null, [bundle, financialPeriod]);
  const previousPeriod = useMemo(() => previousEquivalentPeriod(period.startDate, period.endDate), [period]);
  const previousSummary = useMemo(() => bundle && previousPeriod ? summarizeCommercialBundle(bundle, previousPeriod) : null, [bundle, previousPeriod]);
  const available = Boolean(summary?.valid);
  const financialBundleAvailable = Boolean(financialSummary?.valid);
  const handleCsvImport = (file) => importCsvWith(file, dispatchCsvDashboard, parseCommercialCsvFile);
  const handleFinancialImport = async (file) => {
    const imported = await importFinancialCsvWith(file, dispatchCsvDashboard, parseFinancialCsvFile);
    if (imported) {
      setLinkedFinancialFile(null);
      setFinancialFileSignature("");
      setFinancialFileLinkStatus("idle");
    }
    return imported;
  };
  const handleLinkFinancialFile = async () => {
    try {
      let handle = linkedFinancialFile;
      if (!handle) {
        if (!window.isSecureContext || typeof window.showOpenFilePicker !== "function") {
          setFinancialFileLinkStatus("unsupported");
          return;
        }
        [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [{ description: "Fichier CSV financier", accept: { "text/csv": [".csv"] } }],
        });
      }
      const permission = await handle.requestPermission({ mode: "read" });
      if (permission !== "granted") {
        setFinancialFileLinkStatus("permission-required");
        return;
      }
      const file = await handle.getFile();
      setFinancialFileLinkStatus("updating");
      const imported = await importFinancialCsvWith(file, dispatchCsvDashboard, parseFinancialCsvFile);
      if (!imported) { setFinancialFileLinkStatus("error"); return; }
      setLinkedFinancialFile(handle);
      setFinancialFileSignature(getFinancialFileSignature(file));
      setFinancialFileLinkStatus("active");
    } catch (error) {
      if (error?.name === "AbortError") return;
      setFinancialFileLinkStatus("error");
      dispatchCsvDashboard({ type: "financial-csv-failed", message: "Le fichier local n’a pas pu être lu. Vérifiez l’accès au fichier puis réessayez." });
    }
  };
  const handleTuitionImport = (file, sourceType) => importTuitionCsvWith(file, sourceType, dispatchCsvDashboard, discoverTuitionCsvFile);
  const handleClearSavedSources = async () => {
    if (!window.confirm("Effacer tous les fichiers importés et enregistrés dans ce navigateur ? Cette action ne peut pas être annulée.")) return;
    dispatchCsvDashboard({ type: "clear-sources" });
    setLinkedFinancialFile(null);
    setFinancialFileSignature("");
    setFinancialFileLinkStatus("idle");
    try { await clearPersistedDashboardSources(); setSourceStorageStatus("saved"); }
    catch { setSourceStorageStatus("unavailable"); }
  };
  const updateTuitionMapping = (sourceType, mapping) => dispatchCsvDashboard({ type: "tuition-csv-mapped", sourceType, mapping });
  const updateFinancialMapping = (mapping, confirmedPaymentStatuses) => dispatchCsvDashboard({ type: "financial-csv-mapped", mapping, confirmedPaymentStatuses });
  const setRangeField = (setter, field, value) => setter((previous) => {
    const next = { ...previous, [field]: value };
    return isValidDateRange(next) ? next : previous;
  });
  const financialPage = FINANCIAL_PAGE_IDS.has(activePage);
  const activeRange = getDateRangeForPage(financialPage ? "revenue" : activePage, period, financialPeriod);
  const setActiveRangeField = (field, value) => setRangeField(financialPage ? setFinancialPeriod : setPeriod, field, value);
  const setActiveRange = (range) => {
    if (isValidDateRange(range)) (financialPage ? setFinancialPeriod : setPeriod)(range);
  };
  const clearActiveRange = () => (financialPage ? setFinancialPeriod : setPeriod)({ startDate: "", endDate: "" });
  const hasTuitionData = Boolean(tuitionSources.students || tuitionSources.schedule || financialCsv?.reportModel);
  const activeFeedbackRows = importedCsv?.rows ?? feedbackRows;
  const sourceState = resolveCommercialSourceState({ bundle: available ? bundle : null, importedCsv });
  const dataState = sourceState.kind === "local-csv" ? "imported" : sourceState.kind === "configured" ? "connected" : "synthetic";
  const renderPage = () => {
    if (activePage === "students") return <TuitionStudentsPage source={tuitionSources.students} references={tuitionSources.references} error={tuitionImportErrors.students} onImport={handleTuitionImport} onMapping={updateTuitionMapping} dateRange={financialPeriod}/>;
    if (activePage === "schedule") return <TuitionSchedulePage source={tuitionSources.schedule} references={tuitionSources.references} error={tuitionImportErrors.schedule} onImport={handleTuitionImport} onMapping={updateTuitionMapping} students={tuitionSources.students?.mappedRows ?? []} dateRange={financialPeriod}/>;
    if (activePage === "formations") return <TuitionFormationsPage students={tuitionSources.students} schedule={tuitionSources.schedule} aggregate={financialCsv} dateRange={financialPeriod}/>;
    if (activePage === "data-sources") return <TuitionDataSourcesPage sources={tuitionSources} errors={tuitionImportErrors} onImport={handleTuitionImport} onMapping={updateTuitionMapping} financialSource={financialCsv} financialError={financialImportError} onFinancialImport={handleFinancialImport} onClearSaved={handleClearSavedSources}/>;
    if (activePage === "revenue" && (tuitionSources.students || tuitionSources.schedule)) return <TuitionRevenuePage sources={tuitionSources} aggregate={financialCsv} errors={tuitionImportErrors} onImport={handleTuitionImport} onMapping={updateTuitionMapping} financialSource={financialCsv} financialError={financialImportError} onFinancialImport={handleFinancialImport} onFinancialMapping={updateFinancialMapping} dateRange={financialPeriod}/>;
    if (activePage === "feedback") return <FeedbackPage rows={activeFeedbackRows} loading={importedCsv ? false : feedbackLoading} loadError={importedCsv ? "" : feedbackError} dateRange={period} imported={Boolean(importedCsv)} filters={csvFilters} setFilters={setCsvFilters}/>;
    if (activePage === "overview" && importedCsv) return <>{hasTuitionData && <TuitionOverviewSummary sources={tuitionSources} aggregate={financialCsv} dateRange={financialPeriod}/>}<ImportedCsvOverview rows={importedCsv.rows} dateRange={period} sourceInfo={importedCsv} filters={csvFilters} setFilters={setCsvFilters}/></>;
    if (activePage === "report" && importedCsv) return <ImportedCsvReport rows={importedCsv.rows} dateRange={period} sourceInfo={importedCsv} filters={csvFilters} setFilters={setCsvFilters}/>;
    if (activePage === "pipeline" && importedCsv) return <ImportedCsvPipeline rows={importedCsv.rows} dateRange={period} sourceInfo={importedCsv} filters={csvFilters} setFilters={setCsvFilters}/>;
    if (activePage === "revenue" && financialCsv) return <FinancialPage source={financialCsv} error={financialImportError} onImport={handleFinancialImport} onMapping={updateFinancialMapping} period={financialPeriod}/>;
    if (bundleLoading) return <div className="loading-state"><div className="loader"/><p>Chargement de la source commerciale configurée…</p></div>;
    if (activePage === "overview") return <>{hasTuitionData && <TuitionOverviewSummary sources={tuitionSources} aggregate={financialCsv} dateRange={financialPeriod}/>}<CommercialOverview summary={summary ?? {}} previousSummary={previousSummary} available={available} error={bundleError}/></>;
    if (activePage === "pipeline") return <PipelinePage summary={summary ?? {}} available={available} error={bundleError} dateRange={period} bundle={bundle ?? {}} csvRows={importedCsv?.rows} csvSourceInfo={importedCsv} csvFilters={csvFilters} setCsvFilters={setCsvFilters} localCsvActive={sourceState.kind === "local-csv"}/>;
    if (activePage === "revenue" && financialBundleAvailable) return <RevenuePage summary={financialSummary ?? {}} available={financialBundleAvailable} error={bundleError}/>;
    if (activePage === "revenue") return <FinancialPage source={null} error={financialImportError} onImport={handleFinancialImport} onMapping={updateFinancialMapping} period={financialPeriod}/>;
    if (activePage === "followups") return <FollowupsPage bundle={bundle ?? {}} available={available} error={bundleError} filters={followupFilters} setFilters={setFollowupFilters} dateRange={period} localCsvSource={importedCsv} financialSource={financialCsv} financialError={financialImportError} onFinancialImport={handleFinancialImport} fileLinkStatus={financialFileLinkStatus} linkedFinancialFile={linkedFinancialFile} onLinkFinancialFile={handleLinkFinancialFile}/>;
    return <ReportPage summary={summary ?? {}} available={available} error={bundleError} dateRange={period} bundle={bundle ?? {}}/>;
  };
  useEffect(() => { try { window.localStorage.setItem("merchant-dashboard-theme", theme); } catch { /* Only theme preference is persisted; CSV contents remain in memory. */ } }, [theme]);
  return <div className="app-shell commercial-shell" data-theme={theme}>
    <Sidebar active={activePage} onNavigate={(page) => dispatchCsvDashboard({ type: "navigate", page })} feedbackCount={fmtCount(activeFeedbackRows.length)}/>
    <div className="main-column">
      <Header active={activePage} startDate={activeRange.startDate} endDate={activeRange.endDate} setPeriod={setActiveRangeField} setPeriodRange={setActiveRange} clearPeriod={clearActiveRange} onFeedback={() => dispatchCsvDashboard({ type: "navigate", page: "feedback" })} onImport={handleCsvImport} onFinancialImport={handleFinancialImport} dataState={dataState} financialActive={isFinancialCsvConnected(csvDashboard) || Boolean(tuitionSources.students || tuitionSources.schedule || tuitionSources.references)} financialPeriodUnavailable={Boolean(financialCsv?.reportModel && !(tuitionSources.students || tuitionSources.schedule))} financialContext={financialPage} theme={theme} onToggleTheme={() => setTheme((current) => toggleDashboardTheme(current))}/>
      <main className="commercial-main">{importError && activePage !== "followups" && <div className="csv-import-error" role="alert"><b>Import impossible</b><span>{importError}</span><button type="button" aria-label="Fermer le message" onClick={() => dispatchCsvDashboard({ type: "clear-import-error" })}>×</button></div>}{renderPage()}
        <footer className="app-footer"><span>CAP · Pilotage commercial</span><span>{importedCsv ? "Avis : CSV local importé · aucune transmission externe" : available ? "Source commerciale configurée" : "Aucune donnée commerciale réelle connectée · Prototype de développement"} · {sourceStorageStatus === "saved" ? "Imports conservés sur cet appareil" : sourceStorageStatus === "unavailable" ? "Conservation locale indisponible" : sourceStorageStatus === "loading" ? "Restauration des imports…" : "Stockage local prêt"}</span></footer>
      </main>
    </div>
  </div>;
}

export default App;
