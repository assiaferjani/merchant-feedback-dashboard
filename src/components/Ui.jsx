import { useRef } from "react";
import { toCsv } from "../commercial-data.js";
import {
  fmtCount,
  fmtPercent,
  fmtCurrency,
  FRENCH_NUMBER,
} from "../dashboard-config.js";
export function Icon({ name }) {
  const paths = {
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M6 18 18 6" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14m-5-5 5 5-5 5" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    total: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M8 9h8M8 13h8M8 17h4" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="11" width="7" height="10" rx="1.5" />
        <rect x="3" y="14" width="8" height="7" rx="1.5" />
      </>
    ),
    pipeline: (
      <>
        <circle cx="6" cy="6" r="2.2" />
        <circle cx="18" cy="12" r="2.2" />
        <circle cx="6" cy="18" r="2.2" />
        <path d="M8.3 6h3.2a3 3 0 0 1 3 3v.1M8.3 18h3.2a3 3 0 0 0 3-3v-.1" />
      </>
    ),
    followup: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2M18.5 5.5l1.5-1.5" />
      </>
    ),
    report: (
      <>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v5h5M9 12h6M9 16h6" />
      </>
    ),
    shop: (
      <>
        <path d="M3 10h18l-1.5-6h-15L3 10Z" />
        <path d="M5 10v10h14V10M9 20v-6h6v6" />
      </>
    ),
    region: (
      <>
        <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
        <circle cx="12" cy="9" r="2.2" />
      </>
    ),
    comment: (
      <>
        <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-4-.9L4 20l1.5-3.5A7.3 7.3 0 0 1 4 12c0-4.2 3.6-7.5 8-7.5s8 2.8 8 7Z" />
        <path d="M8 12h.01M12 12h.01M16 12h.01" />
      </>
    ),
    percent: (
      <>
        <path d="m19 5-14 14" />
        <circle cx="7" cy="7" r="2.5" />
        <circle cx="17" cy="17" r="2.5" />
      </>
    ),
    euro: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="3" />
        <circle cx="12" cy="12" r="3" />
        <path d="M6 10v4M18 10v4" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </>
    ),
    moon: (
      <path d="M20.8 14.3A8.5 8.5 0 0 1 9.7 3.2 8.5 8.5 0 1 0 20.8 14.3Z" />
    ),
    candidate: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 11a3 3 0 1 0 0-6M18 14c1.9.8 3 2.3 3 4.5" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.total}
    </svg>
  );
}

export function CsvImportButton({ onFile, label = "Importer mon CSV" }) {
  const inputRef = useRef(null);
  return (
    <>
      <button
        className="primary-button import-csv-button"
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </button>
      <input
        ref={inputRef}
        className="visually-hidden-input"
        type="file"
        hidden
        tabIndex={-1}
        accept=".csv,text/csv"
        aria-label="Choisir un fichier CSV d’avis local"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
    </>
  );
}

export function FinancialCsvImportButton({
  onFile,
  label = "Importer le fichier financier",
}) {
  const inputRef = useRef(null);
  return (
    <>
      <button
        className="primary-button financial-import-button"
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </button>
      <input
        ref={inputRef}
        className="visually-hidden-input"
        type="file"
        hidden
        tabIndex={-1}
        accept=".csv,text/csv"
        aria-label="Choisir un fichier financier CSV local"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
    </>
  );
}

export function TuitionCsvImportButton({ sourceType, onFile, label }) {
  const inputRef = useRef(null);
  return (
    <>
      <button
        className="primary-button"
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </button>
      <input
        ref={inputRef}
        className="visually-hidden-input"
        type="file"
        hidden
        tabIndex={-1}
        accept=".csv,text/csv"
        aria-label={`Importer la source ${sourceType}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file, sourceType);
          event.target.value = "";
        }}
      />
    </>
  );
}

export function PageTitle({
  eyebrow = "PILOTAGE DE VOTRE ACTIVITÉ",
  title,
  subtitle,
  badge = "Synthétique",
}) {
  return (
    <section className="page-title-row">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <span className="synthetic-tag">
        <i />
        {badge === "valid"
          ? "Source valide"
          : badge === "incomplete"
            ? "À vérifier"
            : badge === "Synthétique"
              ? "Démonstration"
              : badge === "Prototype"
                ? "À configurer"
                : badge}
      </span>
    </section>
  );
}

export function MetricCard({
  title,
  value,
  helper,
  icon,
  unavailable = false,
  comparison,
}) {
  return (
    <article
      className={`commercial-metric ${unavailable ? "unavailable" : ""}`}
    >
      <div className="commercial-metric-top">
        <span>{title}</span>
        <span className="commercial-metric-icon">
          <Icon name={icon} />
        </span>
      </div>
      <div className="commercial-metric-value">{value}</div>
      <div className="commercial-metric-footer">
        <span>{helper}</span>
        {comparison && <b>{comparison}</b>}
      </div>
    </article>
  );
}

export function Panel({ title, subtitle, action, className = "", children }) {
  return (
    <section className={`commercial-panel ${className}`}>
      <div className="commercial-panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  title = "Données non disponibles",
  detail,
  compact = false,
}) {
  return (
    <div className={`commercial-empty ${compact ? "compact" : ""}`}>
      <span className="empty-icon">⌁</span>
      <b>{title}</b>
      <p>
        {detail ||
          "La source ne contient pas les champs requis pour calculer cet indicateur."}
      </p>
    </div>
  );
}

export function SourceAlert({
  configError,
  localCsvActive = false,
  localCsvSource = null,
}) {
  const showConfigError = Boolean(configError) && !localCsvActive;
  const title = showConfigError
    ? "Le fichier commercial configuré n’est pas exploitable"
    : localCsvActive
      ? "CSV local chargé — source avis active"
      : "Aucune source commerciale n’est connectée";
  const detail =
    showConfigError ||
    (localCsvActive
      ? `Le CSV local ${localCsvSource?.fileName ? `« ${localCsvSource.fileName} »` : "importé"} (${localCsvSource?.rows?.length ?? 0} lignes) est actif. Il fournit les avis, mais pas les tables ou champs nécessaires pour calculer les activités commerciales, les inscriptions, les revenus, les objectifs ou les échéances de relance.`
      : "Le jeu disponible contient uniquement des champs de retours commerçants. Il ne contient ni activités de prospection, ni statuts candidats confirmés, ni inscriptions, paiements, objectifs ou échéances de relance.");
  return (
    <section
      className={`source-alert ${showConfigError ? "source-alert-error" : ""}`}
    >
      <span className="source-alert-icon">{showConfigError ? "!" : "i"}</span>
      <div>
        <b>{title}</b>
        <p>{detail}</p>
        <small>
          {localCsvActive
            ? "Les métriques non couvertes restent indisponibles et ne sont pas remplacées par des zéros."
            : "Les indicateurs commerciaux restent indisponibles jusqu’à la configuration d’une source autorisée conforme au contrat de données. Les cartes ne sont pas affichées à zéro."}
        </small>
      </div>
    </section>
  );
}

export function ChartEmpty({
  children = "Aucune donnée à représenter pour la période choisie.",
}) {
  return <div className="chart-empty">{children}</div>;
}

export function DownloadButton({
  label,
  rows,
  columns,
  disabled = false,
  filename = "rapport-commercial.csv",
}) {
  const download = () => {
    if (disabled || !rows.length) return;
    const blob = new Blob([`\uFEFF${toCsv(rows, columns)}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      className="outline-button"
      onClick={download}
      disabled={disabled || !rows.length}
    >
      ↓ {label}
    </button>
  );
}

export function ChartTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <b>{label}</b>
      {payload.map((item) => (
        <span key={item.dataKey}>
          <i style={{ background: item.color }} /> {item.name}:{" "}
          {typeof item.value === "number"
            ? currency
              ? fmtCurrency(item.value, currency)
              : FRENCH_NUMBER.format(item.value)
            : item.value}
        </span>
      ))}
    </div>
  );
}

export function StatusRows({ rows, empty = true }) {
  if (!rows.length) return empty ? <EmptyState compact /> : null;
  return (
    <div className="status-rows">
      {rows.slice(0, 20).map((row, index) => (
        <div className="status-row" key={row.name}>
          <span className="status-index">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span>{row.name}</span>
          <b>{fmtCount(row.count)}</b>
        </div>
      ))}
      {rows.length > 20 && (
        <p className="table-note">
          20 premiers résultats sur {rows.length.toLocaleString("fr-FR")}.
        </p>
      )}
    </div>
  );
}

export function ConversionTable({ steps }) {
  return (
    <div className="conversion-list">
      {steps.map((step, index) => (
        <div
          className="conversion-row"
          key={`${step?.fromStatus}-${step?.toStatus}-${index}`}
        >
          <span>
            {step?.fromStatus || "Étape non configurée"} <i>→</i>{" "}
            {step?.toStatus || "Étape suivante"}
          </span>
          <b>{step ? fmtPercent(step.rate) : "—"}</b>
          <small>
            {step
              ? `${fmtCount(step.converted)} conversions sur ${fmtCount(step.entered)} entrées`
              : "Mappage de statut requis"}
          </small>
        </div>
      ))}
    </div>
  );
}

export function RevenueRows({ rows, currency }) {
  return (
    <div className="status-rows">
      {rows.map((row, index) => (
        <div className="status-row" key={row.name}>
          <span className="status-index">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span>{row.name}</span>
          <b>{fmtCurrency(row.amount, currency)}</b>
        </div>
      ))}
    </div>
  );
}

export function SetupGuide({ title, detail, onConnect, onSources }) {
  return (
    <>
      <PageTitle
        eyebrow="CONFIGURATION DE VOTRE ESPACE"
        title={title}
        subtitle="Connectez une source compatible pour commencer votre analyse."
        badge="Source à connecter"
      />
      <section className="setup-guide">
        <span className="setup-icon">
          <Icon name="dashboard" />
        </span>
        <h2>Une seule étape pour activer cette rubrique</h2>
        <p>{detail}</p>
        <ol>
          <li>
            <b>Préparez votre export</b>
            <span>
              Un fichier CSV avec les colonnes utiles à cette analyse.
            </span>
          </li>
          <li>
            <b>Vérifiez les correspondances</b>
            <span>
              Contrôlez les champs reconnus et les alertes de qualité.
            </span>
          </li>
          <li>
            <b>Rapprochez les résultats</b>
            <span>Comparez les totaux avec votre fichier d’origine.</span>
          </li>
        </ol>
        <div className="setup-actions">
          <button type="button" className="primary-button" onClick={onConnect}>
            Connecter mes données
          </button>
          <button type="button" className="outline-button" onClick={onSources}>
            Voir toutes les sources
          </button>
        </div>
        <small>
          Les indicateurs s’affichent uniquement lorsque les champs nécessaires
          sont disponibles.
        </small>
      </section>
    </>
  );
}
