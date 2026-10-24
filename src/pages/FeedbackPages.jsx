import { searchTableRows } from "../table-data.js";
import { useEffect, useMemo, useState } from "react";
import {
  displayDate,
  filterFeedback,
  getRecentComments,
  getAllComments,
  groupByDay,
  groupByField,
  groupByMonth,
  summarizeFeedback,
} from "../dashboard-data.js";

import {
  filterCommercialCsv,
  groupCommercialCrossTab,
  groupCommercialCsv,
  MISSING_RESPONSIBLE_FILTER,
  summarizeCommercialCsv,
} from "../commercial-csv.js";

import {
  CHART_COLORS,
  fmtCount,
  fmtPercent,
  formatDateFr,
  formatMonthFr,
} from "../dashboard-config.js";
import {
  Icon,
  PageTitle,
  MetricCard,
  Panel,
  ChartEmpty,
  DownloadButton,
  StatusRows,
} from "../components/Ui.jsx";
import DataTable from "../components/DataTable.jsx";
import {
  ResponsibleMixChart,
  FeedbackChart,
  FeedbackBars,
  StatusDonutChart,
} from "../components/LazyCharts.jsx";
export function CsvFiltersBar({
  rows,
  filters,
  setFilters,
  dateRange = { startDate: "", endDate: "" },
}) {
  const options = useMemo(
    () => ({
      establishment: [
        ...new Set(rows.map((row) => row.LIB_ETABLISSEMENT).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b, "fr")),
      region: [
        ...new Set(rows.map((row) => row.LIB_REGION).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b, "fr")),
      category: [
        ...new Set(rows.map((row) => row.LIB_AVIS).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b, "fr")),
      responsible: [
        ...new Set(
          rows
            .map((row) => String(row.RESPONSABLE ?? "").trim())
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "fr")),
      hasMissingResponsible: rows.some(
        (row) => !String(row.RESPONSABLE ?? "").trim(),
      ),
    }),
    [rows],
  );
  const matchingCount = useMemo(
    () => filterCommercialCsv(rows, { ...dateRange, ...filters }).length,
    [rows, dateRange, filters],
  );
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
        const valid =
          !selected ||
          (key === "responsible" &&
            selected === MISSING_RESPONSIBLE_FILTER &&
            options.hasMissingResponsible) ||
          values.includes(selected);
        if (!valid) next = { ...next, [key]: "" };
      }
      return next;
    });
  }, [options, setFilters]);
  const periodLabel =
    dateRange.startDate && dateRange.endDate
      ? `${formatDateFr(dateRange.startDate)} – ${formatDateFr(dateRange.endDate)}`
      : dateRange.startDate
        ? `Depuis le ${formatDateFr(dateRange.startDate)}`
        : dateRange.endDate
          ? `Jusqu’au ${formatDateFr(dateRange.endDate)}`
          : "Toutes les dates";
  return (
    <div className="feedback-filterbar">
      {[
        ["establishment", "Établissement", options.establishment, "Tous"],
        ["region", "Région", options.region, "Toutes"],
        ["category", "Catégorie d’avis", options.category, "Toutes"],
        [
          "responsible",
          "Commercial",
          options.responsible,
          "Tous les commerciaux",
        ],
      ].map(([key, label, values, allLabel]) => (
        <label key={key}>
          <span>{label}</span>
          <select
            aria-label={label}
            value={filters[key] ?? ""}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                [key]: event.target.value,
              }))
            }
          >
            <option value="">{allLabel}</option>
            {values.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
            {key === "responsible" && options.hasMissingResponsible && (
              <option value={MISSING_RESPONSIBLE_FILTER}>Non renseigné</option>
            )}
          </select>
        </label>
      ))}
      <button
        className="outline-button"
        type="button"
        onClick={() =>
          setFilters({
            establishment: "",
            region: "",
            category: "",
            responsible: "",
          })
        }
      >
        Réinitialiser
      </button>
      <div className="filter-result-count" role="status">
        <b>{fmtCount(matchingCount)} avis</b>
        <span>{periodLabel}</span>
      </div>
    </div>
  );
}

export function ImportedCsvPipeline({
  rows,
  dateRange,
  sourceInfo,
  filters,
  setFilters,
}) {
  const filtered = useMemo(
    () => filterCommercialCsv(rows, { ...dateRange, ...filters }),
    [rows, dateRange, filters],
  );
  const summary = useMemo(() => summarizeCommercialCsv(filtered), [filtered]);
  return (
    <>
      <PageTitle
        title="Pipeline candidats"
        subtitle="Répartition des avis importés. Les catégories ne représentent pas des étapes candidates confirmées."
        badge="Fichier local"
      />
      <CsvFiltersBar
        rows={rows}
        filters={filters}
        setFilters={setFilters}
        dateRange={dateRange}
      />
      <section className="source-alert">
        <span className="source-alert-icon">i</span>
        <div>
          <b>Source active : {sourceInfo.fileName}</b>
          <p>
            Les catégories et regroupements ci-dessous décrivent les lignes
            d’avis. Ils ne représentent pas une répartition de pipeline ou des
            transitions de candidats confirmées.
          </p>
        </div>
      </section>
      <div className="commercial-kpi-grid imported-kpis">
        <MetricCard
          title="Candidats distincts"
          value={fmtCount(summary.distinctCandidates)}
          helper="Références candidates uniques"
          icon="candidate"
        />
        <MetricCard
          title="Avis enregistrés"
          value={fmtCount(summary.totalAvis)}
          helper="Comptées séparément des candidats"
          icon="total"
        />
      </div>
      <div className="commercial-grid">
        <Panel
          title="Catégories d’avis"
          subtitle="Comptage des lignes; sémantique non confirmée"
          className="panel-span-two"
        >
          <StatusRows rows={summary.avisByCategory} />
        </Panel>
        <Panel
          title="Responsables"
          subtitle="Lignes attribuées par valeur source"
        >
          <StatusRows rows={summary.avisByResponsible} />
        </Panel>
      </div>
    </>
  );
}

export function ImportedCsvOverview({
  rows,
  dateRange,
  sourceInfo,
  filters,
  setFilters,
}) {
  const filtered = useMemo(
    () => filterCommercialCsv(rows, { ...dateRange, ...filters }),
    [rows, dateRange, filters],
  );
  const summary = useMemo(() => summarizeCommercialCsv(filtered), [filtered]);
  const monthly = summary.monthlyAvis.map((item) => ({
    ...item,
    label: formatMonthFr(item.month),
  }));
  const selectCategory = (category) =>
    setFilters((previous) => ({ ...previous, category }));
  return (
    <>
      <PageTitle
        eyebrow="SOURCE LOCALE · FICHIER"
        title="Suivi des avis entrants"
        subtitle="Import local actif. Les lignes d’avis et les candidats distincts sont comptés séparément."
        badge="Fichier local"
      />
      <section className="source-alert">
        <span className="source-alert-icon">i</span>
        <div>
          <b>Source active : fichier sélectionné sur cet appareil</b>
          <p>
            {sourceInfo.fileName} · {fmtCount(rows.length)} lignes importées
            {sourceInfo.invalidDates
              ? ` · ${fmtCount(sourceInfo.invalidDates)} date(s) invalide(s) dans le fichier, ignorée(s) des graphiques temporels`
              : ""}
            .
          </p>
          <small>
            Le fichier est conservé dans ce navigateur, sur cet appareil. Les
            références candidates servent uniquement au comptage distinct et ne
            sont pas affichées. Les catégories restent des valeurs du fichier,
            sans interprétation de statut ou de satisfaction.
          </small>
        </div>
      </section>
      <CsvFiltersBar
        rows={rows}
        filters={filters}
        setFilters={setFilters}
        dateRange={dateRange}
      />
      {sourceInfo.ignoredColumns.length > 0 && (
        <div className="quality-warning">
          Colonnes non utilisées ignorées par l’adaptateur :{" "}
          {sourceInfo.ignoredColumns.join(", ")}.
        </div>
      )}
      <div className="commercial-kpi-grid imported-kpis">
        <MetricCard
          title="Candidats distincts"
          value={fmtCount(summary.distinctCandidates)}
          helper="Références candidates uniques"
          icon="candidate"
        />
        <MetricCard
          title="Avis enregistrés"
          value={fmtCount(summary.totalAvis)}
          helper="Nombre de lignes du fichier dans la période"
          icon="total"
        />
        <MetricCard
          title="Dates invalides"
          value={fmtCount(summary.invalidDates)}
          helper="Dans la sélection; exclues des graphiques"
          icon="target"
          unavailable={summary.invalidDates > 0}
        />
      </div>
      <div className="commercial-grid feedback-chart-grid">
        {monthly.length > 0 && (
          <Panel
            title="Tendance mensuelle des avis"
            subtitle="Avis datés regroupés par mois"
            className="panel-span-two"
          >
            <FeedbackChart data={monthly} type="area" />
          </Panel>
        )}
        <Panel
          title="Répartition des avis"
          subtitle="Sélectionnez une catégorie pour filtrer les résultats"
        >
          <StatusDonutChart
            rows={summary.avisByCategory}
            selectedCategory={filters.category}
            onSelectCategory={selectCategory}
          />
        </Panel>
        <Panel
          title="Avis par responsable"
          subtitle="Avis attribués par commercial"
        >
          <FeedbackBars rows={summary.avisByResponsible} colors={["#173D53"]} />
        </Panel>
        <Panel title="Avis par source" subtitle="Avis par canal d’origine">
          <FeedbackBars rows={summary.avisBySource} colors={["#568B88"]} />
        </Panel>
        <Panel title="Avis par région" subtitle="Avis par région">
          <FeedbackBars rows={summary.avisByRegion} colors={["#8474b6"]} />
        </Panel>
      </div>
      <p className="page-footnote">
        Aucun revenu, paiement, objectif, score ou retard n’est déduit de ce
        fichier. Les indicateurs correspondants restent indisponibles faute de
        champs source.
      </p>
    </>
  );
}

export function ImportedCsvReport({
  rows,
  dateRange,
  sourceInfo,
  filters,
  setFilters,
}) {
  const filtered = useMemo(
    () => filterCommercialCsv(rows, { ...dateRange, ...filters }),
    [rows, dateRange, filters],
  );
  const summary = useMemo(() => summarizeCommercialCsv(filtered), [filtered]);
  const monthly = summary.monthlyAvis.map((item) => ({
    ...item,
    label: formatMonthFr(item.month),
  }));
  const responsibleMix = useMemo(
    () => groupCommercialCrossTab(filtered, "RESPONSABLE", "LIB_AVIS"),
    [filtered],
  );
  const selectCategory = (category) =>
    setFilters((previous) => ({ ...previous, category }));
  const sortedRows = useMemo(
    () =>
      filtered.toSorted((a, b) => {
        const aTime = a.DATE_AVIS?.valueOf() ?? Number.NEGATIVE_INFINITY;
        const bTime = b.DATE_AVIS?.valueOf() ?? Number.NEGATIVE_INFINITY;
        return bTime - aTime;
      }),
    [filtered],
  );
  const topCategory = summary.avisByCategory[0];
  const topResponsible = summary.avisByResponsible.find(
    (item) => item.name !== "Non renseigné",
  );
  const periodLabel =
    dateRange.startDate || dateRange.endDate
      ? `${dateRange.startDate ? formatDateFr(dateRange.startDate) : "Début non défini"} au ${dateRange.endDate ? formatDateFr(dateRange.endDate) : "Fin non définie"}`
      : "Toute la période importée";
  const reportRows = [
    {
      indicateur: "Candidats distincts renseignés",
      valeur: summary.distinctCandidates,
    },
    {
      indicateur: "Avis enregistrés (lignes du fichier)",
      valeur: summary.totalAvis,
    },
    {
      indicateur: "Avis avec date valide dans la sélection",
      valeur: summary.totalAvis - summary.invalidDates,
    },
    ...summary.avisByCategory.map((item) => ({
      indicateur: `Catégorie · ${item.name}`,
      valeur: item.count,
    })),
    ...summary.avisByResponsible.map((item) => ({
      indicateur: `Commercial · ${item.name}`,
      valeur: item.count,
    })),
    ...monthly.map((item) => ({
      indicateur: `Mois · ${item.month}`,
      valeur: item.count,
    })),
  ];
  const columns = [
    { key: "indicateur", label: "Indicateur" },
    { key: "valeur", label: "Nombre" },
  ];
  const detailColumns = [
    { key: "date", label: "Date" },
    { key: "category", label: "Catégorie d’avis" },
    { key: "responsible", label: "Commercial" },
    { key: "source", label: "Canal d’origine" },
    { key: "establishment", label: "Établissement" },
    { key: "region", label: "Région" },
  ];
  const detailExportRows = sortedRows.map((row) => ({
    date: row.DATE_AVIS?.toISOString() ?? "",
    category: row.LIB_AVIS ?? "",
    responsible: row.RESPONSABLE ?? "",
    source: row.LIB_SOURCE_LEAD ?? "",
    establishment: row.LIB_ETABLISSEMENT ?? "",
    region: row.LIB_REGION ?? "",
  }));
  return (
    <div className="print-report">
      <PageTitle
        eyebrow="ANALYSE COMMERCIALE · FICHIER LOCAL"
        title="Rapport des avis"
        subtitle="Lecture des volumes enregistrés, des valeurs source et des dates disponibles."
        badge="Fichier local"
      />
      <section className="report-period">
        <span>PÉRIODE COUVERTE</span>
        <b>{periodLabel}</b>
        <small>
          {filters.responsible &&
          filters.responsible !== MISSING_RESPONSIBLE_FILTER
            ? `Commercial : ${filters.responsible}`
            : filters.responsible === MISSING_RESPONSIBLE_FILTER
              ? "Commercial : non renseigné"
              : "Tous les commerciaux"}{" "}
          · {sourceInfo.fileName}
        </small>
      </section>
      <div className="print-hide">
        <CsvFiltersBar
          rows={rows}
          filters={filters}
          setFilters={setFilters}
          dateRange={dateRange}
        />
      </div>
      <div className="report-actions print-hide">
        <button className="primary-button" onClick={() => window.print()}>
          Imprimer le rapport
        </button>
        <DownloadButton
          label="Exporter la synthèse CSV"
          rows={reportRows}
          columns={columns}
          filename="synthese-avis-importes.csv"
        />
      </div>
      <div className="report-story" aria-live="polite">
        <span className="report-story-mark">
          <Icon name="report" />
        </span>
        <p>
          {topCategory ? (
            <>
              Sur cette sélection, la valeur brute <b>{topCategory.name}</b> est
              la plus fréquente ({fmtCount(topCategory.count)} lignes)
              {topResponsible ? (
                <>
                  {" "}
                  ; <b>{topResponsible.name}</b> est le commercial associé au
                  plus grand nombre de lignes ({fmtCount(topResponsible.count)}
                  ).
                </>
              ) : (
                "."
              )}{" "}
              Ces comptages décrivent les lignes du fichier et ne qualifient ni
              la satisfaction ni la performance individuelle.
            </>
          ) : (
            "Aucune ligne ne correspond aux filtres sélectionnés. Ajustez la période ou les filtres pour afficher le rapport."
          )}
        </p>
      </div>
      <div className="report-stats">
        <div>
          <span>Avis dans la sélection</span>
          <b>{fmtCount(summary.totalAvis)}</b>
          <small>Avis enregistrés, pas des candidats distincts</small>
        </div>
        <div>
          <span>Candidats distincts renseignés</span>
          <b>{fmtCount(summary.distinctCandidates)}</b>
          <small>Références candidates uniques, non affichées</small>
        </div>
        <div>
          <span>Avis avec date valide</span>
          <b>{fmtCount(summary.totalAvis - summary.invalidDates)}</b>
          <small>Dates exploitables dans la sélection</small>
        </div>
        <div>
          <span>Commerciaux renseignés</span>
          <b>
            {fmtCount(
              summary.avisByResponsible.filter(
                (item) => item.name !== "Non renseigné",
              ).length,
            )}
          </b>
          <small>Commerciaux distincts renseignés</small>
        </div>
      </div>
      <div className="commercial-grid report-visual-grid">
        <Panel
          title="Répartition des avis"
          subtitle="Répartition des catégories enregistrées"
        >
          <StatusDonutChart
            rows={summary.avisByCategory}
            selectedCategory={filters.category}
            onSelectCategory={selectCategory}
          />
        </Panel>
        <Panel
          title="Avis par commercial"
          subtitle="Avis attribués par commercial"
        >
          <FeedbackBars rows={summary.avisByResponsible} colors={["#4867cf"]} />
        </Panel>
        {monthly.length > 0 && (
          <Panel
            title="Évolution mensuelle"
            subtitle="Avis regroupés par mois"
            className="panel-span-two"
          >
            <FeedbackChart data={monthly} type="line" />
          </Panel>
        )}
        {responsibleMix.rows.length > 0 && responsibleMix.series.length > 1 && (
          <Panel
            title="Répartition des avis par commercial"
            subtitle="Comptage filtré · huit premiers commerciaux"
            className="panel-span-two"
          >
            <ResponsibleMixChart
              rows={responsibleMix.rows.slice(0, 8)}
              series={responsibleMix.series}
            />
          </Panel>
        )}
      </div>
      <Panel
        title="Détail des avis"
        subtitle={`${fmtCount(sortedRows.length)} avis filtrés · identifiants et commentaires exclus`}
        action={
          <DownloadButton
            label="Exporter tous les avis filtrés"
            rows={detailExportRows}
            columns={detailColumns}
            filename="detail-avis-sans-identifiants.csv"
          />
        }
      >
        <DataTable
          rows={detailExportRows}
          columns={detailColumns}
          label="Avis du rapport"
        />
      </Panel>
      <div className="source-alert">
        <span className="source-alert-icon">i</span>
        <div>
          <b>Interprétation limitée aux données disponibles</b>
          <p>
            Les répartitions comptent les lignes du fichier. Le sens métier des
            catégories doit être confirmé par le responsable des données. Aucun
            revenu, objectif, taux de conversion, score de satisfaction ou
            retard de suivi n’est calculé à partir de ces champs.
          </p>
        </div>
      </div>
    </div>
  );
}

export function FeedbackPage({
  rows,
  loadError,
  loading,
  dateRange,
  imported = false,
  filters,
  setFilters,
}) {
  const filteredRows = useMemo(
    () => filterFeedback(rows, { ...dateRange, ...filters }),
    [rows, dateRange, filters],
  );
  const summary = useMemo(
    () => summarizeFeedback(filteredRows),
    [filteredRows],
  );
  const daily = useMemo(() => groupByDay(filteredRows), [filteredRows]);
  const monthly = useMemo(() => groupByMonth(filteredRows), [filteredRows]);
  const establishments = useMemo(
    () => groupByField(filteredRows, "LIB_ETABLISSEMENT"),
    [filteredRows],
  );
  const categories = useMemo(
    () => groupByField(filteredRows, "LIB_AVIS"),
    [filteredRows],
  );
  const regions = useMemo(
    () => groupByField(filteredRows, "LIB_REGION"),
    [filteredRows],
  );
  const comments = useMemo(() => getAllComments(filteredRows), [filteredRows]);
  const candidateCount = useMemo(
    () =>
      new Set(filteredRows.map((row) => row.IDENTITE_LEAD).filter(Boolean))
        .size,
    [filteredRows],
  );
  const cols = [
    { key: "DATE_AVIS", label: "Date" },
    { key: "LIB_ETABLISSEMENT", label: "Établissement" },
    { key: "LIB_AVIS", label: "Catégorie d’avis" },
    { key: "COMMENTAIRE_LEAD_AVIS", label: "Commentaire" },
  ];
  const [commentSearch, setCommentSearch] = useState("");
  const commentsForExport = useMemo(
    () => searchTableRows(comments, cols, commentSearch),
    [comments, commentSearch],
  );
  const recent = useMemo(
    () => getRecentComments(commentsForExport),
    [commentsForExport],
  );
  const exportRows = recent.map((row) => ({
    ...row,
    DATE_AVIS:
      row.DATE_AVIS instanceof Date && !Number.isNaN(row.DATE_AVIS.valueOf())
        ? row.DATE_AVIS.toISOString()
        : "",
  }));
  if (loading)
    return (
      <div className="loading-state">
        <div className="loader" />
        <p>Chargement du jeu de retours…</p>
      </div>
    );
  if (loadError)
    return (
      <div className="error-state">
        <h2>Jeu de retours indisponible</h2>
        <p>{loadError}</p>
      </div>
    );
  return (
    <>
      <PageTitle
        eyebrow={
          imported ? "SOURCE LOCALE · FICHIER" : "DONNÉES DE DÉVELOPPEMENT"
        }
        title="Retours commerçants"
        subtitle={
          imported
            ? "Avis enregistrés dans le fichier local actif; les identifiants sont comptés sans être affichés."
            : "Explorez les tendances, la répartition des avis et les derniers commentaires."
        }
        badge={imported ? "Fichier local" : "Synthétique"}
      />
      <CsvFiltersBar
        rows={rows}
        filters={filters}
        setFilters={setFilters}
        dateRange={dateRange}
      />
      <div className="commercial-kpi-grid feedback-kpis">
        <MetricCard
          title="Total des retours"
          value={fmtCount(summary.total)}
          helper="Réponses sur la période"
          icon="total"
        />
        {imported && (
          <MetricCard
            title="Candidats distincts"
            value={fmtCount(candidateCount)}
            helper="Références candidates uniques"
            icon="candidate"
          />
        )}
        <MetricCard
          title="Établissements distincts"
          value={fmtCount(summary.establishments)}
          helper="Établissements représentés"
          icon="shop"
        />
        <MetricCard
          title="Régions distinctes"
          value={fmtCount(summary.regions)}
          helper="Régions représentées"
          icon="region"
        />
        <MetricCard
          title="Avec commentaire"
          value={fmtCount(summary.comments)}
          helper="Commentaires non vides"
          icon="comment"
        />
        <MetricCard
          title="Couverture des commentaires"
          value={fmtPercent(summary.commentCoverage)}
          helper="Part des retours commentés"
          icon="percent"
        />
      </div>
      <div className="commercial-grid feedback-chart-grid">
        {daily.length > 0 && (
          <Panel
            title="Volume des retours"
            subtitle="Nombre d’avis enregistrés chaque jour"
            className="panel-span-two"
          >
            <FeedbackChart data={daily} type="area" />
          </Panel>
        )}
        <Panel
          title="Répartition par catégorie"
          subtitle="Part de chaque catégorie dans les retours"
        >
          <StatusDonutChart
            rows={categories}
            selectedCategory={filters.category}
            onSelectCategory={(category) =>
              setFilters((previous) => ({ ...previous, category }))
            }
          />
        </Panel>
        <Panel
          title="Volume par catégorie"
          subtitle="Comparaison des catégories · comptage des avis"
        >
          <FeedbackBars rows={categories} colors={CHART_COLORS} />
        </Panel>
        <Panel
          title="Retours par établissement"
          subtitle="Comparaison du volume"
        >
          <FeedbackBars rows={establishments} colors={["#173D53"]} />
        </Panel>
        <Panel title="Retours par région" subtitle="Comparaison du volume">
          <FeedbackBars rows={regions} colors={["#568B88"]} />
        </Panel>
        {imported && (
          <Panel
            title="Retours par responsable"
            subtitle="Comptage par ligne du fichier"
          >
            <FeedbackBars
              rows={groupCommercialCsv(filteredRows, "RESPONSABLE")}
              colors={["#8474b6"]}
            />
          </Panel>
        )}
        {imported && (
          <Panel
            title="Retours par source"
            subtitle="Avis regroupés par canal d’origine"
          >
            <FeedbackBars
              rows={groupCommercialCsv(filteredRows, "LIB_SOURCE_LEAD")}
              colors={["#d77968"]}
            />
          </Panel>
        )}
        {monthly.length > 0 && (
          <Panel
            title="Tendance mensuelle"
            subtitle="Nombre d’avis enregistrés par mois"
          >
            <FeedbackChart data={monthly} type="bar" />
          </Panel>
        )}
      </div>
      <Panel
        title="Commentaires"
        subtitle={`${fmtCount(summary.comments)} commentaires non vides sur la sélection`}
        action={
          <div className="export-actions">
            <DownloadButton
              label={`Exporter les ${fmtCount(recent.length)} plus récents`}
              rows={exportRows}
              columns={cols}
              filename="commentaires-recents.csv"
            />
            <DownloadButton
              label={`Exporter tous les ${fmtCount(commentsForExport.length)} commentaires filtrés`}
              rows={commentsForExport.map((row) => ({
                ...row,
                DATE_AVIS:
                  row.DATE_AVIS instanceof Date &&
                  !Number.isNaN(row.DATE_AVIS.valueOf())
                    ? row.DATE_AVIS.toISOString()
                    : "",
              }))}
              columns={cols}
              filename="commentaires-filtres.csv"
            />
          </div>
        }
      >
        <DataTable
          rows={comments}
          searchValue={commentSearch}
          onSearchChange={setCommentSearch}
          label="Commentaires filtrés"
          initialSort={{ key: "DATE_AVIS", direction: "desc" }}
          columns={[
            {
              key: "DATE_AVIS",
              label: "Date",
              render: (value) =>
                value instanceof Date && !Number.isNaN(value.valueOf())
                  ? displayDate(value, true)
                  : "Date non renseignée",
            },
            { key: "LIB_ETABLISSEMENT", label: "Établissement" },
            { key: "LIB_AVIS", label: "Catégorie d’avis" },
            { key: "COMMENTAIRE_LEAD_AVIS", label: "Commentaire" },
          ]}
        />
        <div className="table-note">
          {imported
            ? "Valeurs chargées depuis un fichier local. Aucun score de satisfaction ni sentiment n’est calculé."
            : "Les valeurs de cette page sont fictives. Aucun score de satisfaction ni sentiment n’est calculé."}
        </div>
      </Panel>
    </>
  );
}

export function WelcomeOverview({
  rows,
  loading,
  error,
  dateRange,
  onImport,
  onNavigate,
}) {
  const filtered = useMemo(
    () => filterFeedback(rows, dateRange),
    [rows, dateRange],
  );
  const summary = useMemo(() => summarizeFeedback(filtered), [filtered]);
  const monthly = useMemo(
    () =>
      groupByMonth(filtered).map((row) => ({
        ...row,
        label: formatMonthFr(row.month),
      })),
    [filtered],
  );
  const categories = useMemo(
    () => groupByField(filtered, "LIB_AVIS"),
    [filtered],
  );
  return (
    <>
      <PageTitle
        eyebrow="VOTRE ESPACE DE DÉCISION"
        title="Vue d’ensemble"
        subtitle="Une vue claire sur vos retours, votre activité et vos résultats."
        badge="Espace de démonstration"
      />
      <section className="overview-start">
        <div>
          <h2>Un espace pour votre activité et vos finances</h2>
          <p>
            Explorez les retours de démonstration ou connectez vos fichiers pour
            travailler sur vos propres résultats.
          </p>
        </div>
        <div className="setup-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => onNavigate("data-sources")}
          >
            Configurer mes sources
          </button>
          <button
            type="button"
            className="outline-button"
            onClick={() => onNavigate("feedback")}
          >
            Explorer les retours
          </button>
        </div>
      </section>
      <div className="workspace-section-heading">
        <div>
          <span className="eyebrow">APERÇU DES RETOURS</span>
          <h2>La performance en un regard</h2>
        </div>
        <span className="demo-note">
          <i />
          Données fictives · selon la période
        </span>
      </div>
      {error ? (
        <div className="csv-import-error" role="alert">
          {error}
        </div>
      ) : loading ? (
        <div className="welcome-loading" role="status">
          Chargement de l’aperçu…
        </div>
      ) : (
        <>
          <div className="commercial-kpi-grid welcome-kpis">
            <MetricCard
              title="Retours enregistrés"
              value={fmtCount(summary.total)}
              helper="Avis sur la période"
              icon="comment"
            />
            <MetricCard
              title="Établissements"
              value={fmtCount(summary.establishments)}
              helper="Établissements représentés"
              icon="shop"
            />
            <MetricCard
              title="Régions couvertes"
              value={fmtCount(summary.regions)}
              helper="Présence géographique"
              icon="region"
            />
            <MetricCard
              title="Retours commentés"
              value={fmtPercent(summary.commentCoverage)}
              helper={`${fmtCount(summary.comments)} commentaires disponibles`}
              icon="percent"
            />
          </div>
          <div className="commercial-grid welcome-chart-grid">
            <Panel
              title="Évolution des retours"
              subtitle="Volume mensuel · données de démonstration"
              action={
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onNavigate("feedback")}
                >
                  Voir les détails <Icon name="arrow" />
                </button>
              }
            >
              {monthly.length ? (
                <FeedbackChart data={monthly} type="area" />
              ) : (
                <ChartEmpty />
              )}
            </Panel>
            <Panel
              title="Répartition des avis"
              subtitle="Catégories présentes dans le jeu de démonstration"
            >
              <StatusDonutChart rows={categories} />
            </Panel>
          </div>
        </>
      )}
      <div className="workspace-section-heading">
        <div>
          <span className="eyebrow">POUR ALLER PLUS LOIN</span>
          <h2>Un espace pour chaque besoin</h2>
        </div>
      </div>
      <div className="workspace-shortcuts">
        {[
          {
            page: "pipeline",
            icon: "pipeline",
            title: "Suivi commercial",
            detail: "Candidats, activités et étapes de traitement.",
            tag: "COMMERCIAL",
          },
          {
            page: "revenue",
            icon: "euro",
            title: "Pilotage financier",
            detail: "Inscriptions, règlements et échéances.",
            tag: "FINANCES",
          },
          {
            page: "data-sources",
            icon: "dashboard",
            title: "Vos sources de données",
            detail: "Imports et qualité des fichiers, au même endroit.",
            tag: "CONFIGURATION",
          },
        ].map((item) => (
          <button
            type="button"
            className="workspace-shortcut"
            key={item.page}
            onClick={() => onNavigate(item.page)}
          >
            <span className="shortcut-icon">
              <Icon name={item.icon} />
            </span>
            <span className="shortcut-tag">{item.tag}</span>
            <b>{item.title}</b>
            <p>{item.detail}</p>
            <span className="shortcut-link">
              Ouvrir l’espace <Icon name="arrow" />
            </span>
          </button>
        ))}
      </div>
      <p className="workspace-data-note">
        <Icon name="shield" />
        Cet aperçu utilise des avis fictifs. Les indicateurs commerciaux et
        financiers s’affichent uniquement avec une source compatible.
      </p>
    </>
  );
}
