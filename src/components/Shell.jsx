import { useState, useRef } from "react";
import solenLogo from "../assets/solen-digital-transparent.webp";
import {
  COMMERCIAL_NAV,
  FINANCIAL_NAV,
  PAGE_TITLES,
  PAGE_SUBTITLES,
} from "../dashboard-config.js";
import { isValidDateRange, getDateRangePreset } from "../date-filters.js";
import { Icon } from "./Ui.jsx";
export function NavigationButton({ item, active, onNavigate }) {
  const selected = active === item.id;
  return (
    <button
      type="button"
      className={`nav-item ${selected ? "active" : ""}`}
      aria-current={selected ? "page" : undefined}
      title={item.label}
      onClick={() => onNavigate(item.id)}
    >
      <span className="nav-icon">
        <Icon name={item.icon} />
      </span>
      <span className="nav-label">{item.label}</span>
    </button>
  );
}

export function Sidebar({ active, onNavigate, feedbackCount }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = (page) => {
    onNavigate(page);
    setMenuOpen(false);
  };
  return (
    <aside className={`sidebar ${menuOpen ? "menu-open" : ""}`}>
      <svg
        className="brand-filter-definitions"
        aria-hidden="true"
        focusable="false"
        width="0"
        height="0"
      >
        <defs>
          <filter id="solen-logo-inverse" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="-0.21 0 0 0 0.993 -0.42 0 0 0 0.995 -0.93 0 0 0 0.996 0 0 0 1 0"
            />
          </filter>
        </defs>
      </svg>
      <div className="sidebar-brand">
        <button
          type="button"
          className="brand-home"
          aria-label="Solen Digital — Vue d’ensemble"
          onClick={() => navigate("overview")}
        >
          <img src={solenLogo} alt="Solen Digital" width="1618" height="972" />
        </button>
        <button
          type="button"
          className="sidebar-menu-toggle"
          aria-label={
            menuOpen ? "Fermer la navigation" : "Ouvrir la navigation"
          }
          aria-expanded={menuOpen}
          aria-controls="dashboard-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name={menuOpen ? "close" : "menu"} />
        </button>
      </div>
      <div className="workspace-label">
        <span />
        VOTRE ESPACE DE PILOTAGE
      </div>
      <div className="sidebar-navigation-groups" id="dashboard-navigation">
        <div className="sidebar-navigation-group">
          <div className="sidebar-section-label">ESPACE COMMERCIAL</div>
          <nav className="sidebar-nav" aria-label="Navigation commerciale">
            {COMMERCIAL_NAV.map((item) => (
              <NavigationButton
                key={item.id}
                item={item}
                active={active}
                onNavigate={navigate}
              />
            ))}
          </nav>
        </div>
        <div className="sidebar-navigation-group financial-navigation-group">
          <div className="sidebar-section-label">FINANCES</div>
          <nav className="sidebar-nav" aria-label="Navigation financière">
            {FINANCIAL_NAV.map((item) => (
              <NavigationButton
                key={item.id}
                item={item}
                active={active}
                onNavigate={navigate}
              />
            ))}
          </nav>
        </div>
        <div className="sidebar-navigation-group feedback-navigation-group">
          <div className="sidebar-section-label">SUIVI DES RETOURS</div>
          <button
            type="button"
            className={`nav-item ${active === "feedback" ? "active" : ""}`}
            aria-current={active === "feedback" ? "page" : undefined}
            title="Retours commerçants"
            onClick={() => navigate("feedback")}
          >
            <span className="nav-icon">
              <Icon name="comment" />
            </span>
            <span className="nav-label">Retours commerçants</span>
            <span className="nav-count">{feedbackCount}</span>
          </button>
        </div>
      </div>
      <div className="sidebar-bottom">
        <span className="sidebar-avatar">SD</span>
        <span>
          <b>Solen Digital</b>
          <small>Intelligence commerciale</small>
        </span>
      </div>
    </aside>
  );
}

export function PeriodControls({
  startDate,
  endDate,
  setPeriod,
  setPeriodRange,
  clearPeriod,
  financial = false,
}) {
  const [rangeError, setRangeError] = useState("");
  const currentRange = { startDate, endDate };
  const setField = (field, value) => {
    const next = { ...currentRange, [field]: value };
    if (!isValidDateRange(next)) {
      setRangeError(
        "La date de début doit être antérieure ou égale à la date de fin.",
      );
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
  return (
    <div
      className={`period-control-wrap ${financial ? "financial-period-controls" : "commercial-period-controls"}`}
    >
      <div
        className="period-controls"
        aria-label={
          financial
            ? "Filtre de période financière"
            : "Filtre de période commerciale"
        }
      >
        <label>
          <span>Du</span>
          <input
            aria-label="Date de début"
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(event) => setField("startDate", event.target.value)}
          />
        </label>
        <span className="period-separator">—</span>
        <label>
          <span>Au</span>
          <input
            aria-label="Date de fin"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => setField("endDate", event.target.value)}
          />
        </label>
        <select
          className="period-preset"
          aria-label="Raccourci de période"
          value=""
          onChange={choosePreset}
        >
          <option value="">Période…</option>
          <option value="7-days">7 derniers jours</option>
          <option value="30-days">30 derniers jours</option>
          <option value="month">Mois en cours</option>
          <option value="year">Année en cours</option>
        </select>
        {(startDate || endDate) && (
          <button
            className="period-clear"
            type="button"
            onClick={() => {
              clearPeriod();
              setRangeError("");
            }}
          >
            Réinitialiser
          </button>
        )}
      </div>
      {rangeError && (
        <span className="period-range-error" role="alert">
          {rangeError}
        </span>
      )}
    </div>
  );
}

export function Header({
  active,
  startDate,
  endDate,
  setPeriod,
  setPeriodRange,
  clearPeriod,
  onFeedback,
  onImport,
  onOpenImport,
  onFinancialImport,
  dataState,
  financialActive,
  financialPeriodUnavailable = false,
  financialContext = false,
  theme = "light",
  onToggleTheme,
}) {
  const title =
    active === "feedback" ? "Retours commerçants" : PAGE_TITLES[active];
  const helpRef = useRef(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  return (
    <>
      <header className="app-header">
        <div className="header-top-row">
          <div className="app-header-context">
            <div className="breadcrumb">
              <span>Solen Digital</span>
              <span className="breadcrumb-slash">/</span>
              <b>{title}</b>
            </div>
            <p>{PAGE_SUBTITLES[active] ?? PAGE_SUBTITLES.overview}</p>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="primary-button"
              onClick={onOpenImport}
            >
              Connecter un fichier
            </button>
            <button
              type="button"
              className="theme-toggle"
              onClick={onToggleTheme}
              aria-label={`Activer le mode ${theme === "dark" ? "clair" : "sombre"}`}
              title={`Mode ${theme === "dark" ? "clair" : "sombre"}`}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
            <button
              type="button"
              className="help-button"
              onClick={() => helpRef.current?.showModal()}
              aria-label="Ouvrir le guide d’utilisation"
            >
              ?
            </button>
          </div>
        </div>
        <button
          type="button"
          className="mobile-filter-toggle"
          aria-controls="shared-period-filters"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <span>Période et sources</span>
          <span>
            {startDate || endDate ? "Période active" : "Toutes les dates"}{" "}
            <span aria-hidden="true">{filtersOpen ? "−" : "+"}</span>
          </span>
        </button>
        <div
          id="shared-period-filters"
          className={`header-toolbar${filtersOpen ? " filters-open" : ""}`}
        >
          <div className="toolbar-period">
            <span className="toolbar-label">PÉRIODE</span>
            {active === "revenue" && financialPeriodUnavailable ? (
              <span className="financial-period-unavailable">
                Sélection par mois dans le rapport
              </span>
            ) : (
              <PeriodControls
                startDate={startDate}
                endDate={endDate}
                setPeriod={setPeriod}
                setPeriodRange={setPeriodRange}
                clearPeriod={clearPeriod}
                financial={financialContext}
              />
            )}
          </div>
          <div className="toolbar-sources">
            <span
              className={`source-badge ${dataState === "connected" || dataState === "imported" ? "connected" : "synthetic"}`}
            >
              <i />
              {dataState === "imported"
                ? "Avis : Fichier local"
                : dataState === "connected"
                  ? "Avis : connectés"
                  : "Avis : démo"}
            </span>
            <span
              className={`source-badge ${financialActive ? "connected" : "synthetic"}`}
            >
              <i />
              {financialActive
                ? "Finances : connectées"
                : "Finances : à connecter"}
            </span>
          </div>
        </div>
      </header>
      <dialog
        ref={helpRef}
        className="help-dialog"
        aria-labelledby="help-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) helpRef.current?.close();
        }}
      >
        <button
          type="button"
          className="dialog-close"
          aria-label="Fermer le guide"
          onClick={() => helpRef.current?.close()}
        >
          ×
        </button>
        <div className="eyebrow">SOLEN DIGITAL · GUIDE</div>
        <h2 id="help-title">Votre tableau de bord, simplement.</h2>
        <ol>
          <li>
            <b>Explorez les retours</b>
            <p>
              Découvrez les graphiques avec le jeu de démonstration, clairement
              identifié comme fictif.
            </p>
          </li>
          <li>
            <b>Importez vos fichiers</b>
            <p>
              Utilisez « Connecter un fichier », choisissez le type de données
              puis importez votre fichier. Sources & paramètres rassemble les
              fichiers et leurs contrôles.
            </p>
          </li>
          <li>
            <b>Affinez votre analyse</b>
            <p>
              Sélectionnez une période et des filtres, puis exportez les
              résultats depuis les rapports.
            </p>
          </li>
        </ol>
        <div className="help-privacy">
          <Icon name="shield" />
          <p>
            Les fichiers importés restent dans ce navigateur, sur cet appareil.
            Vous pouvez les supprimer dans Sources & paramètres.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            helpRef.current?.close();
            onFeedback();
          }}
        >
          Explorer les retours <Icon name="arrow" />
        </button>
      </dialog>
    </>
  );
}
