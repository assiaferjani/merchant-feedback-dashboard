import { dashboardPageFromHash, dashboardPageHash } from "./navigation.js";
import { useEffect, useMemo, useReducer, useState, useRef } from "react";
import { parseFeedbackCsv } from "./dashboard-data.js";
import {
  previousEquivalentPeriod,
  summarizeCommercialBundle,
  validateCommercialBundle,
} from "./commercial-data.js";
import { resolveCommercialSourceState } from "./commercial-csv.js";
import {
  dashboardCsvReducer,
  importCsvWith,
  importFinancialCsvWith,
  importTuitionCsvWith,
  initialDashboardCsvState,
  isFinancialCsvConnected,
  resolveDashboardTheme,
  toggleDashboardTheme,
} from "./dashboard-state.js";
import { getDateRangeForPage, isValidDateRange } from "./date-filters.js";
import {
  loadPersistedDashboardSources,
  saveDashboardSources,
  clearPersistedDashboardSources,
} from "./local-source-storage.js";
import {
  getFinancialFileSignature,
  refreshLinkedFinancialFile,
} from "./financial-file-sync.js";

import { Suspense } from "react";
import {
  PAGE_TITLES,
  FINANCIAL_PAGE_IDS,
  fmtCount,
} from "./dashboard-config.js";
import { SetupGuide } from "./components/Ui.jsx";
import ImportDialog from "./components/ImportDialog.jsx";
import { SettingsContext } from "./components/SettingsContext.jsx";
import { usePreference } from "./view-preferences.js";
import { parseLocalFile } from "./import-service.js";
import { Header, Sidebar } from "./components/Shell.jsx";
import {
  FinancialPage,
  TuitionStudentsPage,
  TuitionSchedulePage,
  TuitionRevenuePage,
  TuitionFormationsPage,
  TuitionDataSourcesPage,
  TuitionOverviewSummary,
  CommercialOverview,
  PipelinePage,
  RevenuePage,
  FollowupsPage,
  ReportPage,
  ImportedCsvOverview,
  ImportedCsvReport,
  ImportedCsvPipeline,
  FeedbackPage,
  WelcomeOverview,
} from "./pages/index.jsx";
function App() {
  const [csvDashboard, dispatchCsvDashboard] = useReducer(
    dashboardCsvReducer,
    initialDashboardCsvState,
    (state) => ({
      ...state,
      activePage: dashboardPageFromHash(window.location.hash) ?? "overview",
    }),
  );
  const {
    activePage,
    importedCsv,
    importError,
    financialCsv,
    financialImportError,
  } = csvDashboard;
  const navigateToPage = (page) => {
    const hash = dashboardPageHash(page);
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    dispatchCsvDashboard({
      type: "navigate",
      page: dashboardPageFromHash(hash),
    });
  };
  useEffect(() => {
    const restoreLocation = () => {
      const page = dashboardPageFromHash(window.location.hash);
      if (page) dispatchCsvDashboard({ type: "navigate", page });
    };
    window.addEventListener("popstate", restoreLocation);
    window.addEventListener("hashchange", restoreLocation);
    return () => {
      window.removeEventListener("popstate", restoreLocation);
      window.removeEventListener("hashchange", restoreLocation);
    };
  }, []);
  useEffect(() => {
    document.title = `${activePage === "feedback" ? "Retours commerçants" : PAGE_TITLES[activePage]} | Solen Digital`;
    document.getElementById("main-content")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [activePage]);
  const tuitionSources =
    csvDashboard.tuitionSources ?? initialDashboardCsvState.tuitionSources;
  const tuitionImportErrors =
    csvDashboard.tuitionImportErrors ??
    initialDashboardCsvState.tuitionImportErrors;
  const [feedbackRows, setFeedbackRows] = useState([]);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [bundle, setBundle] = useState(null);
  const [bundleError, setBundleError] = useState("");
  const [bundleLoading, setBundleLoading] = useState(
    Boolean(import.meta.env.VITE_COMMERCIAL_BUNDLE_URL),
  );
  const [period, setPeriod] = usePreference("commercial-period", {
    startDate: "",
    endDate: "",
  });
  const [financialPeriod, setFinancialPeriod] = usePreference(
    "financial-period",
    { startDate: "", endDate: "" },
  );
  const [csvFilters, setCsvFilters] = usePreference("feedback-filters", {
    establishment: "",
    region: "",
    category: "",
    responsible: "",
  });
  const [followupFilters, setFollowupFilters] = usePreference(
    "followup-filters",
    { salesperson: "", specialty: "", overdueStatus: "overdue" },
  );
  const [settings, setSettings] = usePreference("settings", {
    currency: "",
    scope: "combined",
    definitionsReviewed: false,
    totalsReviewed: false,
  });
  const [importDialog, setImportDialog] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const importing = useRef(false);
  const [theme, setTheme] = useState(() => {
    try {
      return resolveDashboardTheme(
        window.localStorage.getItem("merchant-dashboard-theme"),
      );
    } catch {
      return "light";
    }
  });
  const [sourceStorageReady, setSourceStorageReady] = useState(false);
  const [sourceStorageStatus, setSourceStorageStatus] = useState("loading");
  const [linkedFinancialFile, setLinkedFinancialFile] = useState(null);
  const [financialFileSignature, setFinancialFileSignature] = useState("");
  const [financialFileLinkStatus, setFinancialFileLinkStatus] =
    useState("idle");

  useEffect(() => {
    let active = true;
    loadPersistedDashboardSources()
      .then((snapshot) => {
        if (!active || !snapshot) return;
        dispatchCsvDashboard({ type: "restore-sources", snapshot });
        setLinkedFinancialFile(snapshot.financialFileHandle ?? null);
        setFinancialFileSignature(snapshot.financialFileSignature ?? "");
        setFinancialFileLinkStatus(
          snapshot.financialFileHandle ? "checking" : "idle",
        );
      })
      .catch(() => {
        if (active) setSourceStorageStatus("unavailable");
      })
      .finally(() => {
        if (active) {
          setSourceStorageReady(true);
          setSourceStorageStatus((current) =>
            current === "unavailable" ? current : "ready",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!sourceStorageReady) return undefined;
    let active = true;
    saveDashboardSources(csvDashboard, {
      financialFileHandle: linkedFinancialFile,
      financialFileSignature,
    })
      .then(() => {
        if (active) setSourceStorageStatus("saved");
      })
      .catch(() => {
        if (active) setSourceStorageStatus("unavailable");
      });
    return () => {
      active = false;
    };
  }, [
    sourceStorageReady,
    csvDashboard.importedCsv,
    csvDashboard.financialCsv,
    csvDashboard.tuitionSources,
    linkedFinancialFile,
    financialFileSignature,
  ]);

  useEffect(() => {
    if (!sourceStorageReady || !linkedFinancialFile) return undefined;
    let active = true;
    let reading = false;
    const syncLinkedFile = async () => {
      if (reading || document.visibilityState === "hidden") return;
      reading = true;
      try {
        const result = await refreshLinkedFinancialFile(
          linkedFinancialFile,
          financialFileSignature,
          async (file) => {
            if (active) setFinancialFileLinkStatus("updating");
            return importFinancialCsvWith(
              file,
              dispatchCsvDashboard,
              (selected) => parseLocalFile(selected, "financial"),
            );
          },
        );
        if (!active) return;
        if (result.status === "permission-required") {
          setFinancialFileLinkStatus(result.status);
          return;
        }
        if (result.status === "invalid") {
          setFinancialFileLinkStatus("error");
          return;
        }
        if (result.status === "updated")
          setFinancialFileSignature(result.signature);
        setFinancialFileLinkStatus("active");
      } catch {
        if (active) setFinancialFileLinkStatus("error");
      } finally {
        reading = false;
      }
    };
    void syncLinkedFile();
    const interval = window.setInterval(syncLinkedFile, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncLinkedFile();
    };
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
      .then((response) => {
        if (!response.ok) throw new Error(`CSV ${response.status}`);
        return response.text();
      })
      .then((csv) => parseFeedbackCsv(csv))
      .then((rows) => {
        if (active) setFeedbackRows(rows);
      })
      .catch((error) => {
        if (active)
          setFeedbackError(
            `Impossible de charger le CSV synthétique (${error.message}).`,
          );
      })
      .finally(() => {
        if (active) setFeedbackLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const sourceUrl = import.meta.env.VITE_COMMERCIAL_BUNDLE_URL;
    if (!sourceUrl) return undefined;
    let active = true;
    fetch(sourceUrl, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const validation = validateCommercialBundle(data);
        if (!validation.valid) throw new Error(validation.errors.join(" "));
        if (active) setBundle(data);
      })
      .catch((error) => {
        if (active) setBundleError(error.message);
      })
      .finally(() => {
        if (active) setBundleLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(
    () => (bundle ? summarizeCommercialBundle(bundle, period) : null),
    [bundle, period],
  );
  const financialSummary = useMemo(
    () => (bundle ? summarizeCommercialBundle(bundle, financialPeriod) : null),
    [bundle, financialPeriod],
  );
  const previousPeriod = useMemo(
    () => previousEquivalentPeriod(period.startDate, period.endDate),
    [period],
  );
  const previousSummary = useMemo(
    () =>
      bundle && previousPeriod
        ? summarizeCommercialBundle(bundle, previousPeriod)
        : null,
    [bundle, previousPeriod],
  );
  const available = Boolean(summary?.valid);
  const financialBundleAvailable = Boolean(financialSummary?.valid);
  const runImport = async (file, sourceType) => {
    if (importing.current)
      return { ok: false, error: "Un import est déjà en cours." };
    importing.current = true;
    let message = "";
    setImportProgress({ label: "Préparation de l’import…" });
    const parser = async (selected) => {
      try {
        return await parseLocalFile(selected, sourceType, setImportProgress);
      } catch (error) {
        message = error.message;
        throw error;
      }
    };
    try {
      const ok =
        sourceType === "commercial"
          ? await importCsvWith(file, dispatchCsvDashboard, parser)
          : sourceType === "financial"
            ? await importFinancialCsvWith(file, dispatchCsvDashboard, parser)
            : await importTuitionCsvWith(
                file,
                sourceType,
                dispatchCsvDashboard,
                parser,
              );
      if (ok && sourceType === "financial") {
        setLinkedFinancialFile(null);
        setFinancialFileSignature("");
        setFinancialFileLinkStatus("idle");
      }
      if (ok && sourceType !== "commercial" && sourceType !== "references")
        setSettings((previous) => ({ ...previous, totalsReviewed: false }));
      return { ok, error: message };
    } finally {
      importing.current = false;
      setImportProgress(null);
    }
  };
  const handleCsvImport = async (file) =>
    (await runImport(file, "commercial")).ok;
  const handleFinancialImport = async (file) =>
    (await runImport(file, "financial")).ok;
  const handleTuitionImport = async (file, sourceType) =>
    (await runImport(file, sourceType)).ok;
  const importFromDialog = async (file, sourceType) => {
    const result = await runImport(file, sourceType);
    if (result.ok)
      navigateToPage(
        {
          commercial: "feedback",
          financial: "revenue",
          students: "students",
          schedule: "schedule",
          references: "data-sources",
        }[sourceType],
      );
    return result;
  };
  const handleLinkFinancialFile = async () => {
    try {
      let handle = linkedFinancialFile;
      if (!handle) {
        if (
          !window.isSecureContext ||
          typeof window.showOpenFilePicker !== "function"
        ) {
          setFinancialFileLinkStatus("unsupported");
          return;
        }
        [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: "Fichier financier (CSV, Excel ou LibreOffice)",
              accept: {
                "application/octet-stream": [
                  ".csv",
                  ".tsv",
                  ".txt",
                  ".xlsx",
                  ".xls",
                  ".ods",
                ],
              },
            },
          ],
        });
      }
      const permission = await handle.requestPermission({ mode: "read" });
      if (permission !== "granted") {
        setFinancialFileLinkStatus("permission-required");
        return;
      }
      const file = await handle.getFile();
      setFinancialFileLinkStatus("updating");
      const imported = await importFinancialCsvWith(
        file,
        dispatchCsvDashboard,
        (selected) => parseLocalFile(selected, "financial"),
      );
      if (!imported) {
        setFinancialFileLinkStatus("error");
        return;
      }
      setLinkedFinancialFile(handle);
      setFinancialFileSignature(getFinancialFileSignature(file));
      setFinancialFileLinkStatus("active");
    } catch (error) {
      if (error?.name === "AbortError") return;
      setFinancialFileLinkStatus("error");
      dispatchCsvDashboard({
        type: "financial-csv-failed",
        message:
          "Le fichier local n’a pas pu être lu. Vérifiez l’accès au fichier puis réessayez.",
      });
    }
  };
  const handleClearSavedSources = async () => {
    setSourceStorageStatus("clearing");
    try {
      await clearPersistedDashboardSources();
      dispatchCsvDashboard({ type: "clear-sources" });
      setCsvFilters({
        establishment: "",
        region: "",
        category: "",
        responsible: "",
      });
      setSettings((previous) => ({ ...previous, totalsReviewed: false }));
      setLinkedFinancialFile(null);
      setFinancialFileSignature("");
      setFinancialFileLinkStatus("idle");
      setSourceStorageStatus("saved");
      return true;
    } catch {
      setSourceStorageStatus("unavailable");
      return false;
    }
  };
  const updateTuitionMapping = (sourceType, mapping) =>
    dispatchCsvDashboard({ type: "tuition-csv-mapped", sourceType, mapping });
  const updateFinancialMapping = (mapping, confirmedPaymentStatuses) =>
    dispatchCsvDashboard({
      type: "financial-csv-mapped",
      mapping,
      confirmedPaymentStatuses,
    });
  const setRangeField = (setter, field, value) =>
    setter((previous) => {
      const next = { ...previous, [field]: value };
      return isValidDateRange(next) ? next : previous;
    });
  const financialPage = FINANCIAL_PAGE_IDS.has(activePage);
  const activeRange = getDateRangeForPage(
    financialPage ? "revenue" : activePage,
    period,
    financialPeriod,
  );
  const setActiveRangeField = (field, value) =>
    setRangeField(financialPage ? setFinancialPeriod : setPeriod, field, value);
  const setActiveRange = (range) => {
    if (isValidDateRange(range))
      (financialPage ? setFinancialPeriod : setPeriod)(range);
  };
  const clearActiveRange = () =>
    (financialPage ? setFinancialPeriod : setPeriod)({
      startDate: "",
      endDate: "",
    });
  const hasTuitionData = Boolean(
    tuitionSources.students ||
    tuitionSources.schedule ||
    financialCsv?.reportModel,
  );
  const activeFeedbackRows = importedCsv?.rows ?? feedbackRows;
  const sourceState = resolveCommercialSourceState({
    bundle: available ? bundle : null,
    importedCsv,
  });
  const dataState =
    sourceState.kind === "local-csv"
      ? "imported"
      : sourceState.kind === "configured"
        ? "connected"
        : "synthetic";
  const renderPage = () => {
    const needsCommercial =
      !available && !importedCsv && ["pipeline", "report"].includes(activePage);
    const needsFollowups =
      activePage === "followups" && !available && !financialCsv;
    const needsFormations = activePage === "formations" && !hasTuitionData;
    if (needsCommercial || needsFollowups || needsFormations)
      return (
        <SetupGuide
          title={PAGE_TITLES[activePage]}
          detail={
            needsFormations
              ? "Importez vos dossiers étudiants ou votre échéancier pour comparer les formations."
              : needsFollowups
                ? "Importez une synthèse financière pour analyser les montants à suivre. Les tâches de relance individuelles nécessitent une source commerciale configurée."
                : "Importez vos avis pour explorer les catégories et les responsables. Les conversions et activités nécessitent une source commerciale configurée avec son historique."
          }
          onConnect={() =>
            setImportDialog(
              needsFormations
                ? "students"
                : needsFollowups
                  ? "financial"
                  : "commercial",
            )
          }
          onSources={() => navigateToPage("data-sources")}
        />
      );
    if (activePage === "students")
      return (
        <TuitionStudentsPage
          source={tuitionSources.students}
          references={tuitionSources.references}
          error={tuitionImportErrors.students}
          onImport={handleTuitionImport}
          onMapping={updateTuitionMapping}
          dateRange={financialPeriod}
        />
      );
    if (activePage === "schedule")
      return (
        <TuitionSchedulePage
          source={tuitionSources.schedule}
          references={tuitionSources.references}
          error={tuitionImportErrors.schedule}
          onImport={handleTuitionImport}
          onMapping={updateTuitionMapping}
          students={tuitionSources.students?.mappedRows ?? []}
          dateRange={financialPeriod}
        />
      );
    if (activePage === "formations")
      return (
        <TuitionFormationsPage
          students={tuitionSources.students}
          schedule={tuitionSources.schedule}
          aggregate={financialCsv}
          dateRange={financialPeriod}
        />
      );
    if (activePage === "data-sources")
      return (
        <TuitionDataSourcesPage
          commercialSource={importedCsv}
          commercialError={importError}
          onImportType={setImportDialog}
          onNavigate={navigateToPage}
          settings={settings}
          setSettings={setSettings}
          storageStatus={sourceStorageStatus}
          sources={tuitionSources}
          errors={tuitionImportErrors}
          onImport={handleTuitionImport}
          onMapping={updateTuitionMapping}
          financialSource={financialCsv}
          financialError={financialImportError}
          onFinancialImport={handleFinancialImport}
          onClearSaved={handleClearSavedSources}
        />
      );
    if (
      activePage === "revenue" &&
      (tuitionSources.students || tuitionSources.schedule)
    )
      return (
        <TuitionRevenuePage
          sources={tuitionSources}
          aggregate={financialCsv}
          errors={tuitionImportErrors}
          onImport={handleTuitionImport}
          onMapping={updateTuitionMapping}
          financialSource={financialCsv}
          financialError={financialImportError}
          onFinancialImport={handleFinancialImport}
          onFinancialMapping={updateFinancialMapping}
          dateRange={financialPeriod}
        />
      );
    if (activePage === "feedback")
      return (
        <FeedbackPage
          rows={activeFeedbackRows}
          loading={importedCsv ? false : feedbackLoading}
          loadError={importedCsv ? "" : feedbackError}
          dateRange={period}
          imported={Boolean(importedCsv)}
          filters={csvFilters}
          setFilters={setCsvFilters}
        />
      );
    if (activePage === "overview" && importedCsv)
      return (
        <>
          {hasTuitionData && (
            <TuitionOverviewSummary
              sources={tuitionSources}
              aggregate={financialCsv}
              dateRange={financialPeriod}
            />
          )}
          <ImportedCsvOverview
            rows={importedCsv.rows}
            dateRange={period}
            sourceInfo={importedCsv}
            filters={csvFilters}
            setFilters={setCsvFilters}
          />
        </>
      );
    if (activePage === "report" && importedCsv)
      return (
        <ImportedCsvReport
          rows={importedCsv.rows}
          dateRange={period}
          sourceInfo={importedCsv}
          filters={csvFilters}
          setFilters={setCsvFilters}
        />
      );
    if (activePage === "pipeline" && importedCsv)
      return (
        <ImportedCsvPipeline
          rows={importedCsv.rows}
          dateRange={period}
          sourceInfo={importedCsv}
          filters={csvFilters}
          setFilters={setCsvFilters}
        />
      );
    if (activePage === "revenue" && financialCsv)
      return (
        <FinancialPage
          source={financialCsv}
          error={financialImportError}
          onImport={handleFinancialImport}
          onMapping={updateFinancialMapping}
          period={financialPeriod}
        />
      );
    if (bundleLoading)
      return (
        <div className="loading-state">
          <div className="loader" />
          <p>Chargement de la source commerciale configurée…</p>
        </div>
      );
    if (activePage === "overview" && !available && !hasTuitionData)
      return (
        <WelcomeOverview
          rows={feedbackRows}
          loading={feedbackLoading}
          error={feedbackError || bundleError}
          dateRange={period}
          onImport={handleCsvImport}
          onNavigate={navigateToPage}
        />
      );
    if (activePage === "overview")
      return (
        <>
          {hasTuitionData && (
            <TuitionOverviewSummary
              sources={tuitionSources}
              aggregate={financialCsv}
              dateRange={financialPeriod}
            />
          )}
          {available && (
            <CommercialOverview
              summary={summary ?? {}}
              previousSummary={previousSummary}
              available={available}
              error={bundleError}
            />
          )}
        </>
      );
    if (activePage === "pipeline")
      return (
        <PipelinePage
          summary={summary ?? {}}
          available={available}
          error={bundleError}
          dateRange={period}
          bundle={bundle ?? {}}
          csvRows={importedCsv?.rows}
          csvSourceInfo={importedCsv}
          csvFilters={csvFilters}
          setCsvFilters={setCsvFilters}
          localCsvActive={sourceState.kind === "local-csv"}
        />
      );
    if (activePage === "revenue" && financialBundleAvailable)
      return (
        <RevenuePage
          summary={financialSummary ?? {}}
          available={financialBundleAvailable}
          error={bundleError}
        />
      );
    if (activePage === "revenue")
      return (
        <FinancialPage
          source={null}
          error={financialImportError}
          onImport={handleFinancialImport}
          onMapping={updateFinancialMapping}
          period={financialPeriod}
        />
      );
    if (activePage === "followups")
      return (
        <FollowupsPage
          bundle={bundle ?? {}}
          available={available}
          error={bundleError}
          filters={followupFilters}
          setFilters={setFollowupFilters}
          dateRange={period}
          localCsvSource={importedCsv}
          financialSource={financialCsv}
          financialError={financialImportError}
          onFinancialImport={handleFinancialImport}
          fileLinkStatus={financialFileLinkStatus}
          linkedFinancialFile={linkedFinancialFile}
          onLinkFinancialFile={handleLinkFinancialFile}
        />
      );
    return (
      <ReportPage
        summary={summary ?? {}}
        available={available}
        error={bundleError}
        dateRange={period}
        bundle={bundle ?? {}}
      />
    );
  };
  useEffect(() => {
    try {
      window.localStorage.setItem("merchant-dashboard-theme", theme);
    } catch {
      /* Theme preference is optional; imports use local IndexedDB. */
    }
  }, [theme]);
  return (
    <SettingsContext.Provider value={settings}>
      <div className="app-shell commercial-shell" data-theme={theme}>
        <Sidebar
          active={activePage}
          onNavigate={navigateToPage}
          feedbackCount={fmtCount(activeFeedbackRows.length)}
        />
        <div className="main-column">
          <Header
            active={activePage}
            startDate={activeRange.startDate}
            endDate={activeRange.endDate}
            setPeriod={setActiveRangeField}
            setPeriodRange={setActiveRange}
            clearPeriod={clearActiveRange}
            onFeedback={() => navigateToPage("feedback")}
            onImport={handleCsvImport}
            onOpenImport={() =>
              setImportDialog(
                {
                  students: "students",
                  schedule: "schedule",
                  formations: "students",
                  revenue: "financial",
                  followups: "financial",
                }[activePage] ?? "commercial",
              )
            }
            onFinancialImport={handleFinancialImport}
            dataState={dataState}
            financialActive={
              isFinancialCsvConnected(csvDashboard) ||
              Boolean(
                tuitionSources.students ||
                tuitionSources.schedule ||
                tuitionSources.references,
              )
            }
            financialPeriodUnavailable={Boolean(
              financialCsv?.reportModel &&
              !(tuitionSources.students || tuitionSources.schedule),
            )}
            financialContext={financialPage}
            theme={theme}
            onToggleTheme={() =>
              setTheme((current) => toggleDashboardTheme(current))
            }
          />
          {importProgress && (
            <div className="global-import-status" role="status">
              <progress aria-label="Import en cours" />
              <span>{importProgress.label}</span>
            </div>
          )}
          <a className="skip-link" href="#main-content">
            Aller au contenu
          </a>
          <main id="main-content" tabIndex={-1} className="commercial-main">
            {importError && activePage !== "followups" && (
              <div className="csv-import-error" role="alert">
                <b>Import impossible</b>
                <span>{importError}</span>
                <button
                  type="button"
                  aria-label="Fermer le message"
                  onClick={() =>
                    dispatchCsvDashboard({ type: "clear-import-error" })
                  }
                >
                  ×
                </button>
              </div>
            )}
            <Suspense
              fallback={
                <div className="page-loading" role="status">
                  Chargement de votre espace…
                </div>
              }
            >
              {renderPage()}
            </Suspense>
            <footer className="app-footer">
              <span>Solen Digital · Pilotage commercial</span>
              <span>
                {importedCsv
                  ? "Avis : fichier local importé · aucune transmission externe"
                  : available
                    ? "Source commerciale configurée"
                    : "Démonstration · Aucune source commerciale connectée"}{" "}
                ·{" "}
                {sourceStorageStatus === "saved"
                  ? "Imports conservés sur cet appareil"
                  : sourceStorageStatus === "unavailable"
                    ? "Conservation locale indisponible"
                    : sourceStorageStatus === "loading"
                      ? "Restauration des imports…"
                      : "Stockage local prêt"}
              </span>
            </footer>
          </main>
        </div>
        {importDialog && (
          <ImportDialog
            key={importDialog}
            open
            initialType={importDialog}
            onClose={() => setImportDialog(null)}
            onImport={importFromDialog}
            progress={importProgress}
          />
        )}
      </div>
    </SettingsContext.Provider>
  );
}

export default App;
