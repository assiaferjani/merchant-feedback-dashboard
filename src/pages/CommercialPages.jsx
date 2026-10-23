import DataTable from "../components/DataTable.jsx";
import { FeedbackBars } from "../components/LazyCharts.jsx";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  filterOverdueFollowups,
  getFollowupRecords,
  getOverdueFollowups,
  relativeChange,
} from "../commercial-data.js";

import {
  fmtCount,
  fmtPercent,
  fmtCurrency,
  formatDateFr,
  formatMonthFr,
} from "../dashboard-config.js";
import {
  PageTitle,
  MetricCard,
  Panel,
  EmptyState,
  SourceAlert,
  DownloadButton,
  ChartTooltip,
  StatusRows,
  ConversionTable,
  RevenueRows,
} from "../components/Ui.jsx";
import { ImportedCsvPipeline } from "./FeedbackPages.jsx";
import { AggregateReceivablesPanel } from "./FinancialPages.jsx";
export function CommercialOverview({
  summary,
  previousSummary,
  available,
  error,
}) {
  const deltaLabel = (current, previous) => {
    const change = previousSummary?.valid
      ? relativeChange(current, previous)
      : null;
    if (!previousSummary?.valid)
      return "Sélectionnez une période pour comparer";
    if (change === null) return "Comparaison non disponible";
    const sign = change > 0 ? "+" : "";
    return `${sign}${fmtPercent(change)} vs période précédente`;
  };
  const kpis = [
    [
      "Activités commerciales",
      available ? fmtCount(summary.activityCount) : "—",
      "Événements distincts sur la période",
      "total",
      !available,
      available
        ? deltaLabel(summary.activityCount, previousSummary?.activityCount)
        : null,
    ],
    [
      "Revenus encaissés",
      available ? fmtCurrency(summary.collectedRevenue, summary.currency) : "—",
      available && summary.currency
        ? "Paiements encaissés uniques"
        : "Montant et devise à confirmer",
      "euro",
      !available || summary.collectedRevenue === null,
      available
        ? deltaLabel(
            summary.collectedRevenue,
            previousSummary?.collectedRevenue,
          )
        : null,
    ],
    [
      "Inscriptions confirmées",
      available ? fmtCount(summary.confirmedEnrollments) : "—",
      "Références d’inscription uniques",
      "candidate",
      !available,
      available
        ? deltaLabel(
            summary.confirmedEnrollments,
            previousSummary?.confirmedEnrollments,
          )
        : null,
    ],
    [
      "Objectifs mensuels atteints",
      available ? fmtPercent(summary.revenueAchievement) : "—",
      available && summary.remainingRevenueTarget !== null
        ? `Reste ${fmtCurrency(summary.remainingRevenueTarget, summary.currency)}`
        : "Objectif non fourni",
      "target",
      !available || summary.revenueAchievement === null,
    ],
    [
      "Dossiers en retard",
      available ? fmtCount(summary.overdueCandidateCount) : "—",
      "Échéance passée, tâche non terminée",
      "region",
      !available,
    ],
  ];
  return (
    <>
      <PageTitle
        title="Vue d’ensemble"
        subtitle="Activité, inscriptions et revenus sur la période sélectionnée."
        badge={available ? "Source configurée" : "Prototype"}
      />
      {!available && <SourceAlert configError={error} />}
      <div className="commercial-kpi-grid">
        {kpis.map(([title, value, helper, icon, unavailable, comparison]) => (
          <MetricCard
            key={title}
            title={title}
            value={value}
            helper={helper}
            icon={icon}
            unavailable={unavailable}
            comparison={comparison}
          />
        ))}
      </div>
      <div className="commercial-grid overview-grid">
        <Panel
          title="Activités commerciales"
          subtitle="Événements distincts par mois"
          className="panel-span-two"
        >
          {available && summary.monthlyActivities.length ? (
            <ResponsiveContainer width="100%" height={268}>
              <AreaChart
                data={summary.monthlyActivities}
                margin={{ top: 12, right: 10, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.22}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="#e9eef1"
                  strokeDasharray="3 4"
                />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonthFr}
                  tick={{ fill: "#7b8a91", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#7b8a91", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  isAnimationActive={false}
                  dataKey="value"
                  name="Activités"
                  type="monotone"
                  stroke="var(--chart-1)"
                  strokeWidth={2.3}
                  fill="url(#activityFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState compact />
          )}
        </Panel>
        <Panel
          title="Statuts actuels des candidats"
          subtitle="Comptage des dossiers distincts, non des activités"
        >
          {available && summary.statusCounts.length ? (
            <ResponsiveContainer width="100%" height={268}>
              <BarChart
                data={summary.statusCounts}
                layout="vertical"
                margin={{ left: 12, right: 18, top: 3, bottom: 3 }}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="#e9eef1"
                  strokeDasharray="3 4"
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#7b8a91", fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#596c73", fontSize: 11 }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  isAnimationActive={false}
                  dataKey="count"
                  name="Dossiers"
                  fill="#3a9a91"
                  radius={[0, 5, 5, 0]}
                  barSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState compact />
          )}
        </Panel>
        <Panel
          title="Revenus encaissés"
          subtitle="Somme des paiements encaissés uniques par mois"
        >
          {available && summary.monthlyRevenue.length ? (
            <ResponsiveContainer width="100%" height={238}>
              <BarChart data={summary.monthlyRevenue}>
                <CartesianGrid
                  vertical={false}
                  stroke="#e9eef1"
                  strokeDasharray="3 4"
                />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonthFr}
                  tick={{ fill: "#7b8a91", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#7b8a91", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  formatter={(value) => fmtCurrency(value, summary.currency)}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="value"
                  name="Encaissé"
                  fill="#36a097"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              compact
              detail="Paiements, dates, montants et devise confirmée nécessaires."
            />
          )}
        </Panel>
        <Panel
          title="Répartition du pipeline"
          subtitle="Étapes disponibles dans l’historique candidat"
        >
          {available && summary.pipelineConversion.length ? (
            <div className="conversion-list">
              {summary.pipelineConversion.map((step) => (
                <div
                  className="conversion-row"
                  key={`${step?.fromStatus}-${step?.toStatus}`}
                >
                  <span>
                    {step?.fromStatus} <i>→</i> {step?.toStatus}
                  </span>
                  <b>{step ? fmtPercent(step.rate) : "—"}</b>
                  <small>
                    {step
                      ? `${fmtCount(step.converted)} / ${fmtCount(step.entered)} dossiers`
                      : "Étapes à configurer"}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              detail="Une table d’historique des changements de statut et une configuration d’étapes sont nécessaires."
            />
          )}
        </Panel>
      </div>
      <p className="page-footnote">
        Les comparaisons de période précédente s’affichent lorsqu’une source
        historique complète est fournie. Aucun écart n’est estimé à partir du
        jeu de retours.
      </p>
    </>
  );
}

export function PipelinePage({
  summary,
  available,
  error,
  dateRange,
  bundle,
  csvRows,
  csvSourceInfo,
  csvFilters,
  setCsvFilters,
  localCsvActive,
}) {
  if (!available && csvSourceInfo)
    return (
      <ImportedCsvPipeline
        rows={csvRows}
        dateRange={dateRange}
        sourceInfo={csvSourceInfo}
        filters={csvFilters}
        setFilters={setCsvFilters}
      />
    );
  const statuses = available ? summary.statusCounts : [];
  const activityTypes = available
    ? (bundle.activities ?? []).filter(
        (row) =>
          (!dateRange.startDate || row.activity_date >= dateRange.startDate) &&
          (!dateRange.endDate || row.activity_date <= dateRange.endDate),
      )
    : [];
  return (
    <>
      <PageTitle
        title="Pipeline candidats"
        subtitle="États de dossiers et événements commerciaux, suivis séparément."
        badge={available ? "Source configurée" : "Prototype"}
      />
      {!available && (
        <SourceAlert configError={error} localCsvActive={localCsvActive} />
      )}
      <div className="commercial-grid">
        <Panel
          title="Répartition par statut"
          subtitle="Statut actuel par candidat distinct"
          className="panel-span-two"
        >
          {statuses.length ? (
            <ResponsiveContainer width="100%" height={310}>
              <BarChart
                data={statuses}
                layout="vertical"
                margin={{ left: 16, right: 22 }}
              >
                <CartesianGrid horizontal={false} stroke="#e8eef0" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={155}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#53666c", fontSize: 12 }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  isAnimationActive={false}
                  dataKey="count"
                  name="Candidats"
                  fill="var(--chart-2)"
                  radius={[0, 5, 5, 0]}
                  barSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </Panel>
        <Panel
          title="Activités après inscription"
          subtitle="Événements rattachés aux dossiers inscrits"
        >
          {available ? (
            <div className="single-stat">
              <b>{fmtCount(summary.postEnrollmentActivityCount ?? 0)}</b>
              <span>activités identifiées après inscription</span>
              <small>
                Calculé par rapprochement des événements et inscriptions
                confirmées.
              </small>
            </div>
          ) : (
            <EmptyState />
          )}
        </Panel>
        <Panel
          title="Rendez-vous en attente"
          subtitle="Statuts source explicitement configurés"
        >
          {available && summary.pendingAppointments !== null ? (
            <div className="single-stat">
              <b>{fmtCount(summary.pendingAppointments)}</b>
              <span>rendez-vous en attente</span>
              <small>
                Le statut d’attente doit être confirmé par le propriétaire des
                données.
              </small>
            </div>
          ) : (
            <EmptyState
              compact
              detail="Une table de rendez-vous et ses statuts confirmés sont nécessaires."
            />
          )}
        </Panel>
        <Panel
          title="Rendez-vous par statut"
          subtitle="Valeurs source brutes; libellés à confirmer"
        >
          {available && summary.appointmentStatusCounts.length ? (
            <StatusRows
              rows={summary.appointmentStatusCounts.map((row) => ({
                name: row.label,
                count: row.count,
              }))}
            />
          ) : (
            <EmptyState compact />
          )}
        </Panel>
        <Panel
          title="Types d’activité"
          subtitle="Événements distincts, avec filtres de date"
        >
          {activityTypes.length ? (
            <StatusRows
              rows={countBy(activityTypes, "activity_type", "activity_id")}
              empty={false}
            />
          ) : (
            <EmptyState compact />
          )}
        </Panel>
        <Panel
          title="Conversions de parcours"
          subtitle="Cohortes entrées dans l’étape pendant la période"
          className="panel-span-two"
        >
          {available && summary.pipelineConversion.length ? (
            <ConversionTable steps={summary.pipelineConversion} />
          ) : (
            <EmptyState
              compact
              detail="Historique horodaté des transitions requis; les statuts actuels seuls ne suffisent pas."
            />
          )}
        </Panel>
      </div>
    </>
  );
}

export function countBy(rows, field, idField) {
  const seenIds = new Set();
  const counts = new Map();
  rows.forEach((row) => {
    if (!row[idField] || seenIds.has(row[idField])) return;
    seenIds.add(row[idField]);
    const key = row[field] || "Non renseigné";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function RevenuePage({
  summary,
  available,
  error,
  localCsvSource = null,
}) {
  const localCsvActive = Boolean(localCsvSource);
  return (
    <>
      <PageTitle
        title="Revenus & inscriptions"
        subtitle="Encaissements, objectifs et inscriptions confirmées uniquement."
        badge={available ? "Source configurée" : "Prototype"}
      />
      {!available && (
        <SourceAlert
          configError={error}
          localCsvActive={localCsvActive}
          localCsvSource={localCsvSource}
        />
      )}
      <div className="commercial-kpi-grid revenue-kpis">
        <MetricCard
          title="Revenus encaissés"
          value={
            available
              ? fmtCurrency(summary.collectedRevenue, summary.currency)
              : "—"
          }
          helper="Paiements encaissés uniques"
          icon="euro"
          unavailable={!available || summary.collectedRevenue === null}
        />
        <MetricCard
          title="Revenus contractés"
          value={
            available
              ? fmtCurrency(summary.contractedRevenue, summary.currency)
              : "—"
          }
          helper="Statuts contractuels confirmés"
          icon="euro"
          unavailable={!available || summary.contractedRevenue === null}
        />
        <MetricCard
          title="Prévision de revenus"
          value={
            available
              ? fmtCurrency(summary.forecastRevenue, summary.currency)
              : "—"
          }
          helper="Prévisions selon la configuration source"
          icon="target"
          unavailable={!available || summary.forecastRevenue === null}
        />
        <MetricCard
          title="Objectif de revenus"
          value={
            available
              ? fmtCurrency(summary.targetRevenue, summary.currency)
              : "—"
          }
          helper="Mois complets inclus dans la période"
          icon="target"
          unavailable={!available || summary.targetRevenue === null}
        />
        <MetricCard
          title="Objectif atteint"
          value={available ? fmtPercent(summary.revenueAchievement) : "—"}
          helper="Encaissé / objectif"
          icon="percent"
          unavailable={!available || summary.revenueAchievement === null}
        />
        <MetricCard
          title="Inscriptions confirmées"
          value={available ? fmtCount(summary.confirmedEnrollments) : "—"}
          helper="Inscriptions uniques confirmées"
          icon="candidate"
          unavailable={!available}
        />
        <MetricCard
          title="Objectif inscriptions"
          value={available ? fmtCount(summary.enrollmentTarget) : "—"}
          helper="Objectif validé pour la période"
          icon="target"
          unavailable={!available || summary.enrollmentTarget === null}
        />
      </div>
      <div className="commercial-grid">
        <Panel
          title="Évolution mensuelle des encaissements"
          subtitle="Paiements encaissés et objectif mensuel configuré · devise confirmée dans la source"
          className="panel-span-two"
        >
          {available && summary.monthlyRevenueTrend.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={summary.monthlyRevenueTrend}>
                <CartesianGrid
                  vertical={false}
                  stroke="#e8eef0"
                  strokeDasharray="3 4"
                />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonthFr}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip
                  content={<ChartTooltip currency={summary.currency} />}
                />
                <Legend verticalAlign="top" height={25} />
                <Line
                  isAnimationActive={false}
                  dataKey="collected"
                  name="Encaissé"
                  stroke="#258d87"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  isAnimationActive={false}
                  dataKey="contracted"
                  name="Contracté"
                  stroke="var(--chart-1)"
                  strokeWidth={1.7}
                  dot={{ r: 2 }}
                />
                <Line
                  isAnimationActive={false}
                  dataKey="forecast"
                  name="Prévision"
                  stroke="#d29a48"
                  strokeWidth={1.7}
                  strokeDasharray="4 3"
                  dot={false}
                />
                <Line
                  isAnimationActive={false}
                  dataKey="target"
                  name="Objectif mensuel"
                  stroke="#7e91a4"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </Panel>
        <Panel
          title="Confirmées par mois"
          subtitle="Références d’inscription distinctes"
        >
          {available && summary.monthlyEnrollments.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={summary.monthlyEnrollments}>
                <CartesianGrid
                  vertical={false}
                  stroke="#e8eef0"
                  strokeDasharray="3 4"
                />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonthFr}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  isAnimationActive={false}
                  dataKey="value"
                  name="Inscriptions"
                  fill="#3c82b8"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState compact />
          )}
        </Panel>
        <Panel
          title="Inscriptions par spécialité"
          subtitle="Classement par nombre d’inscriptions"
          action={
            <DownloadButton
              label="CSV"
              rows={available ? summary.enrollmentBySpecialty : []}
              columns={[
                { key: "name", label: "Spécialité" },
                { key: "count", label: "Inscriptions" },
              ]}
            />
          }
        >
          {available && summary.enrollmentBySpecialty.length ? (
            <StatusRows rows={summary.enrollmentBySpecialty} />
          ) : (
            <EmptyState compact />
          )}
        </Panel>
        <Panel
          title="Inscriptions par niveau d’étude"
          subtitle="Classement par nombre d’inscriptions"
          action={
            <DownloadButton
              label="CSV"
              rows={available ? summary.enrollmentByStudyLevel : []}
              columns={[
                { key: "name", label: "Niveau d’étude" },
                { key: "count", label: "Inscriptions" },
              ]}
            />
          }
        >
          {available && summary.enrollmentByStudyLevel.length ? (
            <StatusRows rows={summary.enrollmentByStudyLevel} />
          ) : (
            <EmptyState compact />
          )}
        </Panel>
        <Panel
          title="Encaissements par spécialité"
          subtitle={
            summary.currency
              ? `Montants en ${summary.currency}`
              : "Devise non confirmée"
          }
          action={
            <DownloadButton
              label="CSV"
              rows={available ? summary.revenueBySpecialty : []}
              columns={[
                { key: "name", label: "Spécialité" },
                { key: "amount", label: "Montant encaissé" },
              ]}
            />
          }
        >
          {available && summary.revenueBySpecialty.length ? (
            <RevenueRows
              rows={summary.revenueBySpecialty}
              currency={summary.currency}
            />
          ) : (
            <EmptyState
              compact
              detail="Paiements, spécialités et devise homogène nécessaires."
            />
          )}
        </Panel>
        <Panel
          title="Encaissements par niveau"
          subtitle={
            summary.currency
              ? `Montants en ${summary.currency}`
              : "Devise non confirmée"
          }
          action={
            <DownloadButton
              label="CSV"
              rows={available ? summary.revenueByStudyLevel : []}
              columns={[
                { key: "name", label: "Niveau d’étude" },
                { key: "amount", label: "Montant encaissé" },
              ]}
            />
          }
        >
          {available && summary.revenueByStudyLevel.length ? (
            <RevenueRows
              rows={summary.revenueByStudyLevel}
              currency={summary.currency}
            />
          ) : (
            <EmptyState
              compact
              detail="Paiements, niveaux d’étude et devise homogène nécessaires."
            />
          )}
        </Panel>
      </div>
      {available && summary.warnings.length > 0 && (
        <div className="quality-warning">
          {summary.warnings.length} avertissement(s) de qualité des données.
          Vérifiez l’export avant d’utiliser les résultats.
        </div>
      )}
    </>
  );
}

export function FollowupsPage({
  bundle,
  available,
  error,
  filters,
  setFilters,
  dateRange,
  localCsvSource = null,
  financialSource = null,
  financialError = "",
  onFinancialImport,
  fileLinkStatus,
  linkedFinancialFile,
  onLinkFinancialFile,
}) {
  const localCsvActive = Boolean(localCsvSource);
  const overdue = useMemo(
    () =>
      available
        ? filterOverdueFollowups(
            getFollowupRecords(
              bundle.followups,
              dateRange.endDate || new Date().toISOString().slice(0, 10),
            ),
            { ...filters, ...dateRange },
          )
        : [],
    [available, bundle, filters, dateRange],
  );
  const salespeople = available
    ? [
        ...new Set(
          bundle.followups.map((row) => row.salesperson).filter(Boolean),
        ),
      ].sort()
    : [];
  const specialties = available
    ? [
        ...new Set(
          bundle.followups.map((row) => row.specialty).filter(Boolean),
        ),
      ].sort()
    : [];
  const countTasksBy = (field) => {
    const counts = new Map();
    for (const row of overdue) {
      const label = String(row[field] ?? "").trim() || "Non renseigné";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
  };
  const followupsBySalesperson = available ? countTasksBy("salesperson") : [];
  const followupsBySpecialty = available ? countTasksBy("specialty") : [];
  const candidatesInView = new Set(
    overdue.map((row) => row.candidate_id).filter(Boolean),
  ).size;
  const overdueInView = overdue.filter(
    (row) => row.followup_state === "overdue",
  ).length;
  const columns = [
    { key: "candidate_id", label: "Référence candidat" },
    { key: "specialty", label: "Spécialité" },
    { key: "study_level", label: "Niveau" },
    { key: "current_status", label: "Statut source" },
    { key: "last_activity_at", label: "Dernière activité" },
    { key: "next_action", label: "Prochaine action" },
    { key: "due_date", label: "Échéance" },
    { key: "salesperson", label: "Responsable" },
    { key: "followup_state", label: "État de l’échéance" },
    { key: "days_overdue", label: "Jours de retard" },
  ];
  return (
    <>
      <PageTitle
        title="Relances à traiter"
        subtitle="Dossiers en retard selon une échéance explicite et une tâche non terminée."
        badge={available ? "Source configurée" : "Prototype"}
      />
      {!available && (
        <SourceAlert
          configError={error}
          localCsvActive={localCsvActive}
          localCsvSource={localCsvSource}
        />
      )}
      <section className="followup-filters">
        <label>
          <span>Responsable commercial</span>
          <select
            aria-label="Filtrer par responsable commercial"
            value={filters.salesperson}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                salesperson: event.target.value,
              }))
            }
          >
            <option value="">Tous</option>
            {salespeople.map((person) => (
              <option key={person}>{person}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Spécialité</span>
          <select
            value={filters.specialty}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                specialty: event.target.value,
              }))
            }
          >
            <option value="">Toutes</option>
            {specialties.map((specialty) => (
              <option key={specialty}>{specialty}</option>
            ))}
          </select>
        </label>
        <label>
          <span>État de l’échéance</span>
          <select
            value={filters.overdueStatus}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                overdueStatus: event.target.value,
              }))
            }
          >
            <option value="overdue">En retard</option>
            <option value="open">À venir</option>
            <option value="completed">Terminée</option>
            <option value="all">Tous les états</option>
          </select>
        </label>
        <span className="followup-definition">
          En retard = échéance passée et date de fin vide.
        </span>
      </section>
      {available && (
        <>
          <div className="commercial-kpi-grid followup-kpis">
            <MetricCard
              title="Tâches dans la sélection"
              value={fmtCount(overdue.length)}
              helper="Après période et filtres"
              icon="followup"
            />
            <MetricCard
              title="Candidats concernés"
              value={fmtCount(candidatesInView)}
              helper="Références distinctes"
              icon="candidate"
            />
            <MetricCard
              title="Tâches en retard"
              value={fmtCount(overdueInView)}
              helper="Échéance passée, tâche non terminée"
              icon="target"
            />
          </div>
          <div className="commercial-grid followup-chart-grid">
            {followupsBySalesperson.length > 0 && (
              <Panel
                title="Relances par responsable"
                subtitle="Nombre de tâches dans la sélection"
              >
                <FeedbackBars
                  rows={followupsBySalesperson}
                  colors={[
                    "var(--chart-1)",
                    "var(--chart-2)",
                    "var(--chart-3)",
                    "#8B5CF6",
                  ]}
                />
              </Panel>
            )}
            {followupsBySpecialty.length > 0 && (
              <Panel
                title="Relances par formation"
                subtitle="Nombre de tâches dans la sélection"
              >
                <FeedbackBars
                  rows={followupsBySpecialty}
                  colors={[
                    "var(--chart-3)",
                    "#0EA5E9",
                    "var(--chart-2)",
                    "#F59E0B",
                  ]}
                />
              </Panel>
            )}
          </div>
        </>
      )}
      <Panel
        title="Dossiers à traiter"
        subtitle={`${fmtCount(overdue.length)} tâche(s) après filtres`}
        action={
          <DownloadButton
            label="Exporter CSV"
            rows={overdue}
            columns={columns}
            disabled={!available}
          />
        }
      >
        <DataTable
          rows={overdue}
          label="Dossiers à traiter"
          columns={columns.map((column) => ({
            ...column,
            render: (value) =>
              ["last_activity_at", "due_date"].includes(column.key)
                ? formatDateFr(value)
                : column.key === "followup_state"
                  ? ({
                      overdue: "En retard",
                      completed: "Terminée",
                      future: "À venir",
                    }[value] ?? value)
                  : (value ?? "—"),
          }))}
        />
      </Panel>
      <AggregateReceivablesPanel
        source={financialSource}
        error={financialError}
        onImport={onFinancialImport}
        fileLinkStatus={fileLinkStatus}
        linkedFinancialFile={linkedFinancialFile}
        onLinkFinancialFile={onLinkFinancialFile}
      />
    </>
  );
}

export function ReportPage({ summary, available, error, dateRange, bundle }) {
  const dateLabel =
    dateRange.startDate || dateRange.endDate
      ? [
          dateRange.startDate
            ? formatDateFr(dateRange.startDate)
            : `D\u00e9but non d\u00e9fini`,
          dateRange.endDate
            ? formatDateFr(dateRange.endDate)
            : `Fin non d\u00e9finie`,
        ].join(" au ")
      : `Toute la p\u00e9riode disponible`;
  const reportRows = available
    ? [
        { indicateur: "Activités commerciales", valeur: summary.activityCount },
        {
          indicateur: "Inscriptions confirmées",
          valeur: summary.confirmedEnrollments,
        },
        { indicateur: "Dossiers candidats", valeur: summary.candidateCount },
        {
          indicateur: "Dossiers distincts en retard",
          valeur: summary.overdueCandidateCount,
        },
        { indicateur: "Revenus encaissés", valeur: summary.collectedRevenue },
        { indicateur: "Objectif revenu", valeur: summary.targetRevenue },
        {
          indicateur: "Atteinte objectif",
          valeur:
            summary.revenueAchievement === null
              ? "Non disponible"
              : fmtPercent(summary.revenueAchievement),
        },
      ]
    : [];
  const columns = [
    { key: "indicateur", label: "Indicateur" },
    { key: "valeur", label: "Valeur" },
  ];
  const statuses = available ? summary.statusCounts : [];
  const overdue = available
    ? getOverdueFollowups(
        bundle.followups,
        dateRange.endDate || new Date().toISOString().slice(0, 10),
      )
    : [];
  const exportRows = [
    ...reportRows,
    ...statuses.map((row) => ({
      indicateur: `Statut : ${row.label}`,
      valeur: row.count,
    })),
  ];
  return (
    <div className="print-report">
      <PageTitle
        eyebrow="RAPPORT DE GESTION"
        title="Rapport commercial"
        subtitle="Synthèse vérifiable des activités, inscriptions et encaissements."
        badge={available ? "Source configurée" : "Prototype"}
      />
      {!available && <SourceAlert configError={error} />}
      <section className="report-period">
        <span>PÉRIODE COUVERTE</span>
        <b>{dateLabel}</b>
        <small>
          Généré le{" "}
          {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
            new Date(),
          )}
        </small>
      </section>
      <div className="report-actions print-hide">
        <button className="primary-button" onClick={() => window.print()}>
          Imprimer le rapport
        </button>
        <DownloadButton
          label="Exporter la synthèse CSV"
          rows={exportRows}
          columns={columns}
          disabled={!available}
        />
      </div>
      {available ? (
        <>
          <div className="report-stats">
            {reportRows.map((row) => (
              <div key={row.indicateur}>
                <span>{row.indicateur}</span>
                <b>
                  {typeof row.valeur === "number" &&
                  row.indicateur.includes("revenu")
                    ? fmtCurrency(row.valeur, summary.currency)
                    : row.valeur}
                </b>
              </div>
            ))}
          </div>
          <Panel
            title="Répartition actuelle du pipeline"
            subtitle="Dossiers distincts par statut courant"
          >
            <StatusRows rows={statuses} />
          </Panel>
          <div className="commercial-grid report-breakdown-grid">
            <Panel
              title="Inscriptions par spécialité"
              action={
                <DownloadButton
                  label="CSV"
                  rows={summary.enrollmentBySpecialty}
                  columns={[
                    { key: "name", label: "Spécialité" },
                    { key: "count", label: "Inscriptions" },
                  ]}
                />
              }
            >
              {summary.enrollmentBySpecialty.length ? (
                <StatusRows rows={summary.enrollmentBySpecialty} />
              ) : (
                <EmptyState compact />
              )}
            </Panel>
            <Panel
              title="Inscriptions par niveau d’étude"
              action={
                <DownloadButton
                  label="CSV"
                  rows={summary.enrollmentByStudyLevel}
                  columns={[
                    { key: "name", label: "Niveau" },
                    { key: "count", label: "Inscriptions" },
                  ]}
                />
              }
            >
              {summary.enrollmentByStudyLevel.length ? (
                <StatusRows rows={summary.enrollmentByStudyLevel} />
              ) : (
                <EmptyState compact />
              )}
            </Panel>
            <Panel
              title="Revenus par spécialité"
              action={
                <DownloadButton
                  label="CSV"
                  rows={summary.revenueBySpecialty}
                  columns={[
                    { key: "name", label: "Spécialité" },
                    { key: "amount", label: "Encaissé" },
                  ]}
                />
              }
            >
              {summary.revenueBySpecialty.length ? (
                <RevenueRows
                  rows={summary.revenueBySpecialty}
                  currency={summary.currency}
                />
              ) : (
                <EmptyState compact />
              )}
            </Panel>
            <Panel
              title="Revenus par niveau d’étude"
              action={
                <DownloadButton
                  label="CSV"
                  rows={summary.revenueByStudyLevel}
                  columns={[
                    { key: "name", label: "Niveau" },
                    { key: "amount", label: "Encaissé" },
                  ]}
                />
              }
            >
              {summary.revenueByStudyLevel.length ? (
                <RevenueRows
                  rows={summary.revenueByStudyLevel}
                  currency={summary.currency}
                />
              ) : (
                <EmptyState compact />
              )}
            </Panel>
          </div>
          <Panel
            title="Points vérifiables"
            subtitle="Constats calculés à partir des champs configurés"
          >
            <ul className="findings-list">
              <li>
                {fmtCount(summary.activityCount)} événements commerciaux
                distincts sur la période.
              </li>
              <li>
                {fmtCount(summary.confirmedEnrollments)} inscriptions confirmées
                selon le statut configuré.
              </li>
              <li>
                {fmtCount(summary.overdueCandidateCount)} dossiers ont au moins
                une tâche en retard selon les échéances renseignées.
              </li>
              <li>
                {summary.revenueAchievement === null
                  ? "Objectif de revenu ou devise indisponible pour calculer l’atteinte."
                  : `L’objectif de revenu est atteint à ${fmtPercent(summary.revenueAchievement)}.`}
              </li>
            </ul>
          </Panel>
          <Panel
            title="Annexe · relances en retard"
            action={
              <DownloadButton
                label="Exporter les relances"
                rows={overdue}
                columns={[
                  { key: "candidate_id", label: "Référence candidat" },
                  { key: "next_action", label: "Prochaine action" },
                  { key: "due_date", label: "Échéance" },
                  { key: "salesperson", label: "Responsable" },
                  { key: "days_overdue", label: "Jours de retard" },
                ]}
              />
            }
          >
            <DataTable
              rows={overdue}
              label="Relances en retard"
              columns={[
                { key: "candidate_id", label: "Référence candidat" },
                { key: "next_action", label: "Prochaine action" },
                { key: "due_date", label: "Échéance", render: formatDateFr },
                { key: "salesperson", label: "Responsable" },
                {
                  key: "days_overdue",
                  label: "Jours de retard",
                  numeric: true,
                },
              ]}
            />
          </Panel>
        </>
      ) : (
        <EmptyState
          title="Rapport commercial indisponible"
          detail="Aucun indicateur commercial ni constat métier ne sera produit avant l’ajout d’une source conforme."
        />
      )}
    </div>
  );
}
