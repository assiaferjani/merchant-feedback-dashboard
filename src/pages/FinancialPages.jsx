import { Fragment, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  FINANCIAL_FIELDS,
  mapFinancialDataset,
  parseFinancialDate,
} from "../financial-csv.js";
import {
  TUITION_SOURCE_FIELDS,
  summarizeStudents,
  summarizeSchedule,
  groupTuitionByFormation,
} from "../tuition-data.js";

import {
  CHART_COLORS,
  FRENCH_NUMBER,
  fmtCount,
  formatMonthFr,
} from "../dashboard-config.js";
import {
  Icon,
  FinancialCsvImportButton,
  TuitionCsvImportButton,
  PageTitle,
  MetricCard,
  Panel,
  EmptyState,
  DownloadButton,
  ChartTooltip,
  StatusRows,
} from "../components/Ui.jsx";
import Dialog from "../components/Dialog.jsx";
import DataTable from "../components/DataTable.jsx";
import { usePreference } from "../view-preferences.js";
import {
  useDashboardSettings,
  formatAmount,
} from "../components/SettingsContext.jsx";
export const fmtMoneyUnknownCurrency = (value) =>
  value === null || value === undefined
    ? "Indisponible"
    : `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)} · devise à confirmer`;

export function FinancialPage(props) {
  return props.source?.reportModel ? (
    <FinancialSummaryPage key={props.source.fileName} {...props} />
  ) : (
    <GenericFinancialPage {...props} />
  );
}

export function FinancialSummaryPage({ source, error, onImport }) {
  const fmtMoneyUnknownCurrency = useMoney();
  const [month, setMonth] = usePreference("finance-summary-month", "");
  const [program, setProgram] = usePreference("finance-summary-program", "");
  const mapped = source?.mapped ?? mapFinancialDataset(source, source?.mapping);
  const monthlyRows = mapped.monthlyRows.filter(
    (row) => !month || row.period === month,
  );
  const programRows = mapped.programRows
    .filter((row) => !program || row.name === program)
    .slice()
    .sort((a, b) => (b.collectedAmount ?? 0) - (a.collectedAmount ?? 0));
  const sum = (rows, key) => {
    const values = rows
      .map((row) => row[key])
      .filter((value) => typeof value === "number" && Number.isFinite(value));
    return values.length
      ? values.reduce((total, value) => total + value, 0)
      : null;
  };
  const formatMoney = (value) =>
    value == null ? "Indisponible" : fmtMoneyUnknownCurrency(value);
  const monthlyCollected = sum(monthlyRows, "collectedAmount");
  const monthlyPlanned = sum(monthlyRows, "plannedAmount");
  const programCollected = sum(programRows, "collectedAmount");
  const programRemaining = sum(programRows, "remainingAmount");
  const aggregateTotalsDiffer = [
    [mapped.metrics.plannedAmount, mapped.metrics.programPlannedAmount],
    [mapped.metrics.collectedAmount, mapped.metrics.programCollectedAmount],
  ].some(
    ([monthly, programs]) =>
      monthly !== null &&
      monthly !== undefined &&
      programs !== null &&
      programs !== undefined &&
      Math.abs(monthly - programs) > 0.005,
  );
  const monthlyExport = monthlyRows.map((row) => ({
    periode: row.period,
    montant_prevu: row.plannedAmount,
    montant_collecte: row.collectedAmount,
    ecart_source: row.gapAmount,
    taux_source: row.reportedRate,
  }));
  const programExport = programRows.map((row) => ({
    filiere: row.name,
    montant_prevu: row.plannedAmount,
    montant_collecte: row.collectedAmount,
    reste_a_encaisser: row.remainingAmount,
    taux_source: row.reportedRate,
  }));
  return (
    <>
      <PageTitle
        eyebrow="SUIVI FINANCIER"
        title="Revenus & inscriptions"
        subtitle="Synthèse financière agrégée importée localement. Le fichier ne contient pas de lignes individuelles d’étudiants ou de paiements."
        badge="Synthèse active"
      />
      <div className="financial-source-card">
        <div>
          <b>Source financière locale active</b>
          <span>
            {fmtCount(mapped.monthlyRows.length)} périodes mensuelles ·{" "}
            {fmtCount(mapped.programRows.length)} agrégats par filière ·
            conservées localement dans ce navigateur
          </span>
          <small>
            Les totaux mensuels et par filière sont deux tableaux agrégés
            distincts dans l’export.
          </small>
        </div>
        <FinancialCsvImportButton
          onFile={onImport}
          label="Remplacer le fichier financier"
        />
      </div>
      {error && (
        <div className="csv-import-error" role="alert">
          <b>Problème de correspondance</b>
          <span>{error}</span>
        </div>
      )}
      <section
        className="financial-report-filters"
        aria-label="Filtres financiers"
      >
        <label>
          <span>Mois</span>
          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          >
            <option value="">Tous les mois</option>
            {mapped.monthlyRows.map((row, index) => (
              <option value={row.period} key={`${row.period}-${index}`}>
                {row.period}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Filière</span>
          <select
            value={program}
            onChange={(event) => setProgram(event.target.value)}
          >
            <option value="">Toutes les filières</option>
            {mapped.programRows.map((row) => (
              <option value={row.name} key={row.name}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        {(month || program) && (
          <button
            type="button"
            className="outline-button"
            onClick={() => {
              setMonth("");
              setProgram("");
            }}
          >
            Réinitialiser
          </button>
        )}
        <span className="financial-filter-note">
          Le fichier ne fournit pas de croisement mois × filière. Ses lignes de
          total sont exclues des sommes pour éviter le double comptage.
        </span>
      </section>
      {aggregateTotalsDiffer && (
        <div className="quality-warning" role="status">
          <b>Rapprochement à confirmer.</b> Les sommes des tableaux mensuels et
          par filière diffèrent. Ces agrégats restent indépendants; leurs
          définitions et périmètres ne sont pas confirmés et aucune correction
          automatique n’est appliquée.
        </div>
      )}
      <div className="commercial-kpi-grid financial-kpis financial-summary-kpis">
        <MetricCard
          title="Montant prévu · période mensuelle"
          value={formatMoney(monthlyPlanned)}
          helper={`${fmtCount(monthlyRows.length)} mois · valeur source`}
          icon="target"
          unavailable={monthlyPlanned === null}
        />
        <MetricCard
          title="Montant collecté · période mensuelle"
          value={formatMoney(monthlyCollected)}
          helper="Agrégat mensuel fourni dans le fichier"
          icon="euro"
          unavailable={monthlyCollected === null}
        />
        <MetricCard
          title="Montant collecté · filières"
          value={formatMoney(programCollected)}
          helper={`${fmtCount(programRows.length)} filière(s) · agrégat distinct`}
          icon="euro"
          unavailable={programCollected === null}
        />
        <MetricCard
          title="Reste à encaisser · filières"
          value={formatMoney(programRemaining)}
          helper={
            mapped.metrics.programRemainingMeaningConfirmed
              ? "Écart source vérifié sur les montants à payer et encaissés"
              : "Calculé par filière : montant à payer − montant collecté"
          }
          icon="total"
          unavailable={programRemaining === null}
        />
      </div>
      <div className="commercial-grid financial-summary-grid">
        <Panel
          title="Évolution mensuelle des montants"
          subtitle="Montants prévus et collectés tels qu’agrégés dans l’export"
          className="panel-span-two"
          action={
            <DownloadButton
              label="Exporter CSV"
              rows={monthlyExport}
              columns={[
                { key: "periode", label: "Période" },
                { key: "montant_prevu", label: "Montant prévu" },
                { key: "montant_collecte", label: "Montant collecté" },
                { key: "ecart_source", label: "Écart source" },
                { key: "taux_source", label: "Taux source" },
              ]}
            />
          }
        >
          {monthlyRows.length ? (
            <ResponsiveContainer width="100%" height={290}>
              <AreaChart
                data={monthlyRows}
                margin={{ top: 8, right: 14, left: 8, bottom: 4 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#e8eef5"
                  strokeDasharray="3 4"
                />
                <XAxis
                  dataKey="period"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#66758a", fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#66758a", fontSize: 10 }}
                  tickFormatter={(value) => FRENCH_NUMBER.format(value)}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  isAnimationActive={false}
                  dataKey="plannedAmount"
                  name="Montant prévu"
                  type="monotone"
                  stroke="var(--chart-2)"
                  fill="var(--chart-2)"
                  fillOpacity={0.12}
                  strokeWidth={2.5}
                />
                <Area
                  isAnimationActive={false}
                  dataKey="collectedAmount"
                  name="Montant collecté"
                  type="monotone"
                  stroke="var(--chart-3)"
                  fill="var(--chart-3)"
                  fillOpacity={0.17}
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState compact title="Aucune période sélectionnée" />
          )}
        </Panel>
        <Panel
          title="Montants par filière"
          subtitle="Comparaison des montants prévus, collectés et restant à encaisser"
          action={
            <DownloadButton
              label="Exporter CSV"
              rows={programExport}
              columns={[
                { key: "filiere", label: "Filière" },
                { key: "montant_prevu", label: "Montant à payer" },
                { key: "montant_collecte", label: "Montant collecté" },
                {
                  key: "reste_a_encaisser",
                  label: "Écart / Reste à encaisser",
                },
                { key: "taux_source", label: "Taux source" },
              ]}
            />
          }
        >
          {programRows.length ? (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                data={programRows}
                layout="vertical"
                margin={{ top: 5, right: 24, left: 12, bottom: 5 }}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="#e8eef5"
                  strokeDasharray="3 4"
                />
                <XAxis
                  type="number"
                  tick={{ fill: "#66758a", fontSize: 10 }}
                  tickFormatter={(value) => FRENCH_NUMBER.format(value)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={128}
                  tick={{ fill: "#44546b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar
                  isAnimationActive={false}
                  dataKey="plannedAmount"
                  name="Montant prévu"
                  fill="var(--chart-2)"
                  radius={[0, 5, 5, 0]}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="collectedAmount"
                  name="Montant collecté"
                  fill="var(--chart-3)"
                  radius={[0, 5, 5, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState compact title="Aucune filière dans cette sélection" />
          )}
        </Panel>
        <Panel
          title="États de paiement fournis par l’export"
          subtitle="Comptages globaux inclus dans le fichier, sans détail transactionnel"
        >
          {mapped.statusTotals.length ? (
            <div className="financial-summary-status">
              {mapped.statusTotals.map((row, index) => (
                <div key={row.name}>
                  <i
                    style={{
                      background: CHART_COLORS[index % CHART_COLORS.length],
                    }}
                  />
                  <span>{row.name}</span>
                  <b>{fmtCount(row.count)}</b>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState compact title="Comptages d’état indisponibles" />
          )}
        </Panel>
        <Panel
          title="Détail mensuel"
          subtitle={`${fmtCount(monthlyRows.length)} période(s) · pas de date complète dans cette synthèse`}
        >
          <TuitionDataTable
            rows={monthlyRows}
            columns={[
              ["period", "Période"],
              ["plannedAmount", "Montant prévu", "money"],
              ["collectedAmount", "Montant collecté", "money"],
              ["gapAmount", "Écart source", "money"],
              ["reportedRate", "Taux source"],
            ]}
          />
        </Panel>
        <Panel
          title="Détail par filière"
          subtitle={`${fmtCount(programRows.length)} filière(s) · montants à payer et collectés issus du tableau source`}
        >
          <TuitionDataTable
            rows={programRows}
            columns={[
              ["name", "Formation"],
              ["plannedAmount", "Montant à payer", "money"],
              ["collectedAmount", "Montant collecté", "money"],
              ["remainingAmount", "Reste", "money"],
              ["reportedRate", "Taux source"],
            ]}
          />
        </Panel>
      </div>
      <Panel
        title="Limites de cette source"
        subtitle="Indicateurs non calculés faute de données individuelles"
      >
        <p className="financial-inline-note">
          Cet export ne permet pas de calculer les étudiants distincts, les
          inscriptions distinctes, le nombre de paiements, ni un croisement
          entre mois et filière. Confirmez la devise dans Sources & paramètres.
          Les montants et états sont affichés selon les agrégats source, sans
          extrapolation.
        </p>
      </Panel>
    </>
  );
}

export function GenericFinancialPage({
  source,
  error,
  onImport,
  onMapping,
  period,
  embedded = false,
}) {
  const fmtMoneyUnknownCurrency = useMoney();
  const mapping = source?.mapping ?? {};
  const selectedConfirmed = source?.confirmedPaymentStatuses ?? [];
  const periodField = mapping.paymentDate ? "paymentDate" : "";
  const hasPeriodFilter = Boolean(period?.startDate || period?.endDate);
  const periodSource = useMemo(() => {
    if (!source || (!period?.startDate && !period?.endDate) || !periodField)
      return source;
    const column = mapping[periodField];
    return {
      ...source,
      rows: source.rows.filter((row) => {
        const date = parseFinancialDate(row[column]);
        if (!date) return false;
        const day = date.toISOString().slice(0, 10);
        return (
          (!period.startDate || day >= period.startDate) &&
          (!period.endDate || day <= period.endDate)
        );
      }),
    };
  }, [source, mapping, period?.startDate, period?.endDate, periodField]);
  const result = useMemo(
    () =>
      periodSource && (!hasPeriodFilter || periodField)
        ? mapFinancialDataset(periodSource, mapping, selectedConfirmed)
        : null,
    [periodSource, mapping, selectedConfirmed, hasPeriodFilter, periodField],
  );
  const updateMapping = (field, column) =>
    onMapping({ ...mapping, [field]: column || "" }, selectedConfirmed);
  const updateConfirmed = (status, checked) =>
    onMapping(
      mapping,
      checked
        ? [...selectedConfirmed, status]
        : selectedConfirmed.filter((item) => item !== status),
    );
  const metrics = result?.metrics;
  const amountAvailable =
    metrics?.totalRecordedAmount !== null &&
    metrics?.totalRecordedAmount !== undefined;
  const collectedAvailable =
    metrics?.confirmedCollectedRevenue !== null &&
    metrics?.confirmedCollectedRevenue !== undefined;
  const cards = [
    {
      title: "Montant total enregistré",
      value: amountAvailable
        ? fmtMoneyUnknownCurrency(metrics.totalRecordedAmount)
        : "Indisponible",
      helper: amountAvailable
        ? `${fmtCount(metrics.validAmountCount)} montants valides · somme des lignes, sans statut`
        : "Associez une colonne de montant valide",
      icon: "euro",
      unavailable: !amountAvailable,
    },
    {
      title: "Revenus encaissés confirmés",
      value: collectedAvailable
        ? fmtMoneyUnknownCurrency(metrics.confirmedCollectedRevenue)
        : "Indisponible",
      helper: collectedAvailable
        ? `${fmtCount(selectedConfirmed.length)} statut(s) explicitement confirmé(s)`
        : "Montant + statut + confirmation des statuts requis",
      icon: "euro",
      unavailable: !collectedAvailable,
    },
    {
      title: "Paiements distincts",
      value:
        metrics?.distinctPaymentCount == null
          ? "Indisponible"
          : fmtCount(metrics.distinctPaymentCount),
      helper:
        metrics?.distinctPaymentCount == null
          ? "Référence de paiement non mappée"
          : "Identifiants distincts non vides",
      icon: "total",
      unavailable: metrics?.distinctPaymentCount == null,
    },
    {
      title: "Inscriptions distinctes",
      value:
        metrics?.enrollmentCount == null
          ? "Indisponible"
          : fmtCount(metrics.enrollmentCount),
      helper:
        metrics?.enrollmentCount == null
          ? "Identifiant d’inscription non mappé"
          : "Identifiants distincts non vides",
      icon: "candidate",
      unavailable: metrics?.enrollmentCount == null,
    },
  ];
  return (
    <>
      {!embedded && (
        <PageTitle
          title="Revenus & inscriptions"
          subtitle="Source financière locale, indépendante des avis commerciaux. Seules les métriques étayées par le fichier sont calculées."
          badge={source ? "Fichier local enregistré" : "Source non connectée"}
        />
      )}
      {!embedded && !source && error && (
        <div className="csv-import-error" role="alert">
          <b>Import financier impossible</b>
          <span>{error}</span>
        </div>
      )}
      {!source ? (
        <section className="financial-empty-state">
          <span className="financial-empty-icon">
            <Icon name="euro" />
          </span>
          <div className="eyebrow">SOURCE FINANCIÈRE</div>
          <h2>Aucun fichier financier importé</h2>
          <p>
            Importez un fichier local pour découvrir ses colonnes et choisir les
            correspondances. Les données restent sur cet appareil et sont
            conservées dans ce navigateur après fermeture ou actualisation. Vous
            pouvez les effacer dans Sources & paramètres.
          </p>
          <FinancialCsvImportButton onFile={onImport} />
          <small>
            Les revenus, inscriptions et objectifs restent indisponibles tant
            que leurs champs ne sont pas présents et mappés.
          </small>
        </section>
      ) : (
        <>
          {!embedded && (
            <div className="financial-source-card">
              <div>
                <b>Source financière locale active</b>
                <span>
                  {fmtCount(source.rowCount)} lignes conservées sur cet appareil
                  · {source.headers.length} colonnes détectées · données non
                  transmises
                </span>
              </div>
              <FinancialCsvImportButton
                onFile={onImport}
                label="Remplacer le fichier financier"
              />
            </div>
          )}
          {(period?.startDate || period?.endDate) && !periodField && (
            <div className="quality-warning">
              Le filtre de période est actif, mais aucune date de paiement n’est
              mappée. Les indicateurs financiers sont masqués jusqu’à ce qu’une
              date soit disponible.
            </div>
          )}
          {(period?.startDate || period?.endDate) && periodField && (
            <p className="financial-inline-note">
              Période appliquée à la date de paiement. Les lignes sans date
              valide sont exclues de cette sélection.
            </p>
          )}
          {result && (
            <div className="commercial-kpi-grid financial-kpis">
              {cards.map((card) => (
                <MetricCard key={card.title} {...card} />
              ))}
            </div>
          )}
          <Panel
            title="Découverte et correspondance des colonnes"
            subtitle="Choisissez un rôle pour chaque champ. L’aperçu ci-dessous ne montre que les noms de colonnes et des volumes de cellules renseignées; aucune valeur de ligne n’est affichée."
          >
            <div className="financial-mapping-grid">
              {FINANCIAL_FIELDS.map((field) => (
                <label key={field.id} className="financial-mapping-field">
                  <span>{field.label}</span>
                  <select
                    aria-label={field.label}
                    value={mapping[field.id] ?? ""}
                    onChange={(event) =>
                      updateMapping(field.id, event.target.value)
                    }
                  >
                    <option value="">Non mappé</option>
                    {source.headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <DataTable
              rows={source.columnProfile}
              label="Structure du fichier"
              columns={[
                { key: "header", label: "Colonne détectée" },
                { key: "filled", label: "Cellules renseignées", numeric: true },
                { key: "blank", label: "Cellules vides", numeric: true },
              ]}
            />

            {error && (
              <div className="csv-import-error" role="alert">
                <b>Import / correspondance impossible</b>
                <span>{error}</span>
              </div>
            )}
            {result &&
              (metrics.invalidAmountCount > 0 ||
                metrics.invalidPaymentDateCount > 0 ||
                metrics.invalidEnrollmentDateCount > 0) && (
                <div className="quality-warning" role="status">
                  Valeurs ignorées ou non interprétables :{" "}
                  {fmtCount(metrics.invalidAmountCount)} montant(s),{" "}
                  {fmtCount(metrics.invalidPaymentDateCount)} date(s) de
                  paiement et {fmtCount(metrics.invalidEnrollmentDateCount)}{" "}
                  date(s) d’inscription.
                </div>
              )}
          </Panel>
          {result && mapping.paymentStatus && (
            <Panel
              title="Statuts de paiement observés"
              subtitle="Les libellés sont affichés tels que fournis. Cochez uniquement les statuts dont le propriétaire des données confirme qu’ils signifient un paiement encaissé."
            >
              <div className="financial-status-options">
                {result.paymentStatuses.map((status) => (
                  <label key={status.name}>
                    <input
                      type="checkbox"
                      checked={selectedConfirmed.includes(status.name)}
                      onChange={(event) =>
                        updateConfirmed(status.name, event.target.checked)
                      }
                    />
                    <span>{status.name}</span>
                    <b>{fmtCount(status.count)}</b>
                  </label>
                ))}
              </div>
              {!selectedConfirmed.length && (
                <p className="financial-inline-note">
                  Aucun statut confirmé : les revenus encaissés restent
                  indisponibles.
                </p>
              )}
            </Panel>
          )}
          {result && (
            <div className="commercial-grid financial-chart-grid">
              <Panel
                title="Évolution mensuelle des montants enregistrés"
                subtitle="Somme des montants valides par date de paiement · devise non identifiée"
                className="panel-span-two"
              >
                {result.monthly.length ? (
                  <ResponsiveContainer width="100%" height={270}>
                    <AreaChart data={result.monthly}>
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
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        isAnimationActive={false}
                        dataKey="recordedAmount"
                        name="Montant enregistré"
                        type="monotone"
                        stroke="#318b91"
                        fill="#d9f0ed"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    compact
                    detail="Associez une date et un montant valides pour afficher la tendance."
                  />
                )}
              </Panel>
              <Panel
                title="Montants encaissés confirmés"
                subtitle="Seulement si un statut a été explicitement confirmé"
              >
                {collectedAvailable && result.monthly.length ? (
                  <ResponsiveContainer width="100%" height={270}>
                    <BarChart data={result.monthly}>
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
                      <Tooltip content={<ChartTooltip />} />
                      <Bar
                        isAnimationActive={false}
                        dataKey="collectedAmount"
                        name="Encaissé confirmé"
                        fill="#4b8fd0"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    compact
                    detail="Aucun statut de paiement n’a été confirmé comme encaissé."
                  />
                )}
              </Panel>
              <Panel
                title="Statuts d’inscription"
                subtitle="Répartition des lignes portant un statut mappé"
              >
                {result.enrollmentStatuses.length ? (
                  <StatusRows rows={result.enrollmentStatuses} />
                ) : (
                  <EmptyState
                    compact
                    detail="Champ de statut d’inscription non mappé."
                  />
                )}
              </Panel>
              <Panel
                title="Modes de paiement"
                subtitle="Répartition selon les valeurs source"
              >
                {result.paymentMethods.length ? (
                  <StatusRows rows={result.paymentMethods} />
                ) : (
                  <EmptyState
                    compact
                    detail="Champ de mode de paiement non mappé."
                  />
                )}
              </Panel>
              <Panel
                title="Établissements"
                subtitle="Lignes par établissement mappé"
              >
                {result.establishments.length ? (
                  <StatusRows rows={result.establishments} />
                ) : (
                  <EmptyState
                    compact
                    detail="Aucun champ établissement mappé."
                  />
                )}
              </Panel>
              <Panel title="Régions" subtitle="Lignes par région mappée">
                {result.regions.length ? (
                  <StatusRows rows={result.regions} />
                ) : (
                  <EmptyState compact detail="Aucun champ région mappé." />
                )}
              </Panel>
            </div>
          )}
          <p className="page-footnote">
            Aucun objectif ni devise n’est supposé. Le montant enregistré inclut
            tous les statuts; le revenu encaissé n’est calculé qu’avec les
            statuts cochés et confirmés par l’utilisateur.
          </p>
        </>
      )}
    </>
  );
}

export function FinancialAutoLinkControl({ linked, status, onLink }) {
  const supported = Boolean(
    globalThis.isSecureContext &&
    typeof window.showOpenFilePicker === "function",
  );
  const label =
    status === "permission-required"
      ? "Réautoriser le fichier lié"
      : linked
        ? "Relier un autre fichier local"
        : "Lier un fichier pour actualisation auto";
  const statusLabel =
    status === "active"
      ? "Actualisation active · contrôle toutes les 30 s"
      : status === "updating"
        ? "Lecture des dernières modifications…"
        : status === "permission-required"
          ? "Autorisation de lecture à renouveler"
          : status === "error"
            ? "Lecture impossible · vérifiez le fichier"
            : status === "unsupported" || !supported
              ? "Liaison automatique disponible sur Chrome/Edge en HTTPS"
              : "Le fichier local n’est pas lié";
  return (
    <div className="financial-auto-link">
      <button
        type="button"
        className="outline-button"
        onClick={onLink}
        disabled={!supported && !linked}
      >
        {label}
      </button>
      <span className={status === "active" ? "is-active" : ""}>
        {statusLabel}
      </span>
    </div>
  );
}

export function AggregateReceivablesPanel({
  source,
  error,
  onImport,
  fileLinkStatus,
  linkedFinancialFile,
  onLinkFinancialFile,
}) {
  const mapped = source?.mapped?.reportModel ? source.mapped : null;
  const statusRows = mapped?.statusTotals ?? [];
  const overdueRow = statusRows.find((row) =>
    row.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .includes("retard"),
  );
  const programRows = mapped?.programRows ?? [];
  const sortedPrograms = [...programRows]
    .filter((row) => row.remainingAmount !== null)
    .sort((a, b) => b.remainingAmount - a.remainingAmount);
  const columns = [
    { key: "name", label: "Filière" },
    { key: "plannedAmount", label: "Montant à payer" },
    { key: "collectedAmount", label: "Montant collecté" },
    { key: "remainingAmount", label: "Reste à examiner" },
  ];
  return (
    <section className="followup-aggregate-section">
      <div className="tuition-section-heading-row">
        <div>
          <h2>Suivi agrégé des retards et restes · Synthèse financière</h2>
          <p>
            Importez le fichier de synthèse financière ici. Ses valeurs sont
            agrégées par statut, mois et filière.
          </p>
        </div>
        <div className="followup-source-actions">
          <FinancialCsvImportButton
            onFile={onImport}
            label={
              source ? "Remplacer le fichier" : "Importer ce fichier financier"
            }
          />
          <FinancialAutoLinkControl
            linked={linkedFinancialFile}
            status={fileLinkStatus}
            onLink={onLinkFinancialFile}
          />
        </div>
      </div>
      {error && (
        <div className="csv-import-error" role="alert">
          {error}
        </div>
      )}
      {!source && (
        <div className="source-alert">
          <span className="source-alert-icon">i</span>
          <div>
            <b>Aucune synthèse financière importée</b>
            <p>
              Le fichier chargé sur cette page peut fournir un comptage source
              des échéances en retard et les restes par filière. Ces agrégats ne
              contiennent pas de dossiers individuels.
            </p>
          </div>
        </div>
      )}
      {source && !mapped && (
        <div className="quality-warning">
          Le fichier est chargé, mais ses blocs agrégés n’ont pas été reconnus.
          Vérifiez le séparateur, l’encodage et les en-têtes dans « Revenus &
          inscriptions ».
        </div>
      )}
      {mapped && (
        <>
          <div className="followup-source-meta">
            <span className="source-state-dot valid" />
            <b>{source.fileName}</b>
            <span>
              {fmtCount(programRows.length)} filières ·{" "}
              {fmtCount(mapped.monthlyRows.length)} périodes mensuelles ·
              agrégats sans filtre nominatif
            </span>
          </div>
          <div className="commercial-kpi-grid followup-kpis">
            <MetricCard
              title="Échéances en retard · source"
              value={overdueRow ? fmtCount(overdueRow.count) : "Indisponible"}
              helper="Comptage repris du bloc de statuts"
              icon="followup"
              unavailable={!overdueRow}
            />
            <MetricCard
              title="Reste à examiner · filières"
              value={
                mapped.metrics.programRemainingAmount === null
                  ? "Indisponible"
                  : FRENCH_NUMBER.format(mapped.metrics.programRemainingAmount)
              }
              helper="Somme des lignes de détail par filière"
              icon="target"
              unavailable={mapped.metrics.programRemainingAmount === null}
            />
            <MetricCard
              title="Filières détaillées"
              value={fmtCount(programRows.length)}
              helper="Lignes de détail; total général exclu"
              icon="report"
            />
          </div>
          <div className="commercial-grid followup-chart-grid">
            <Panel
              title="Reste à examiner par filière"
              subtitle="Montants source · unité monétaire non confirmée"
            >
              <div className="followup-aggregate-chart">
                {sortedPrograms.length ? (
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(230, sortedPrograms.length * 38)}
                  >
                    <BarChart
                      data={sortedPrograms}
                      layout="vertical"
                      margin={{ top: 8, right: 22, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid
                        horizontal={false}
                        stroke="var(--chart-grid)"
                        strokeDasharray="3 4"
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(value) => FRENCH_NUMBER.format(value)}
                        tick={{ fill: "var(--color-muted)", fontSize: 10 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={145}
                        tick={{ fill: "var(--color-text)", fontSize: 10 }}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar
                        isAnimationActive={false}
                        dataKey="remainingAmount"
                        name="Reste à examiner"
                        fill="#F97373"
                        radius={[0, 5, 5, 0]}
                        barSize={22}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    compact
                    title="Reste par filière indisponible"
                    detail="Les colonnes de montants nécessaires ne sont pas reconnues."
                  />
                )}
              </div>
            </Panel>
            <Panel
              title="Statuts de la synthèse"
              subtitle="Libellés et comptages fournis par le fichier"
            >
              <StatusRows rows={statusRows} />
            </Panel>
          </div>
          <Panel
            title="Détail des restes par filière"
            subtitle="Les totaux généraux sont exclus; les tableaux mensuels et par filière ne sont jamais additionnés."
            action={
              <DownloadButton
                label="Exporter CSV"
                rows={programRows}
                columns={columns}
                filename="suivi-reste-filieres.csv"
              />
            }
          >
            <TuitionDataTable
              rows={programRows}
              columns={[
                ["name", "Formation"],
                ["plannedAmount", "Montant à payer", "money"],
                ["collectedAmount", "Montant collecté", "money"],
                ["remainingAmount", "Reste", "money"],
              ]}
            />
          </Panel>
          <p className="tuition-quality-note">
            Ce fichier ne permet pas d’identifier les étudiants ni leurs
            échéances individuelles. Pour obtenir une liste de personnes à
            contacter, importez aussi les dossiers étudiants et les échéances
            détaillées. La synthèse financière reste séparée et n’est jamais
            additionnée aux lignes détaillées.
          </p>
        </>
      )}
    </section>
  );
}

export const TUITION_LABELS = {
  students: "Étudiants & inscriptions",
  schedule: "Échéancier",
  references: "Référentiels",
};

export const TUITION_DATE_FIELDS = {
  students: ["nextDueDate"],
  schedule: ["dueDate", "paymentDate"],
};

export const tuitionDateKey = (value) =>
  value instanceof Date && !Number.isNaN(value.valueOf())
    ? value.toISOString().slice(0, 10)
    : "";

export const tuitionInRange = (value, range) => {
  const key = tuitionDateKey(value);
  return (
    (!range?.startDate || (key && key >= range.startDate)) &&
    (!range?.endDate || (key && key <= range.endDate))
  );
};

const useMoney = () => {
  const { currency } = useDashboardSettings();
  return (value) => formatAmount(value, currency);
};

export const displayTuitionDate = (value) =>
  value instanceof Date && !Number.isNaN(value.valueOf())
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(value)
    : "—";

export const tuitionOptions = (rows, key) =>
  [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );

export const tuitionReferenceOptions = (source, key, fallback) => {
  const values = (source?.mappedRows ?? [])
    .map((row) => row[key])
    .filter((value) => String(value ?? "").trim())
    .map(String);
  return values.length
    ? [...new Set(values)].sort((a, b) => a.localeCompare(b, "fr"))
    : fallback;
};

export function TuitionSourceCard({
  sourceType,
  source,
  error,
  onImport,
  onMapping,
}) {
  const fields = TUITION_SOURCE_FIELDS[sourceType] ?? [];
  const mapped = source?.mappedRows ?? [];
  const status = source
    ? (source.quality?.status ?? "incomplete")
    : "not-loaded";
  const label =
    sourceType === "references"
      ? "référentiels"
      : TUITION_LABELS[sourceType]?.toLowerCase();
  return (
    <section className="tuition-source-card">
      <div className="tuition-source-heading">
        <div>
          <span className={`source-state-dot ${status}`} />
          <h2>{TUITION_LABELS[sourceType] ?? "Sources & paramètres"}</h2>
          <p>
            {source
              ? `${source.fileName} · ${fmtCount(source.rowCount)} lignes détectées · séparateur ${source.delimiter === "\t" ? "tabulation" : source.delimiter}`
              : `Aucune source ${label} importée. Sélectionnez un fichier local pour commencer.`}
          </p>
        </div>
        <TuitionCsvImportButton
          sourceType={sourceType}
          onFile={onImport}
          label={
            source
              ? "Remplacer le fichier"
              : `Importer ${sourceType === "references" ? "les référentiels" : "le fichier"}`
          }
        />
      </div>
      {error && (
        <div className="csv-import-error" role="alert">
          {error}
        </div>
      )}
      {source && (
        <>
          {source.missingRequired?.length > 0 && (
            <div className="quality-warning">
              Colonnes d’identification non reconnues :{" "}
              {source.missingRequired.join(", ")}. Associez manuellement les
              colonnes ci-dessous.
            </div>
          )}
          {source.quality?.duplicateIdentifiers > 0 && (
            <div className="quality-warning">
              {fmtCount(source.quality.duplicateIdentifiers)} identifiant(s)
              répété(s). Les décomptes distincts restent séparés des lignes; les
              sommes individuelles sont à contrôler.
            </div>
          )}
          <details className="tuition-mapping">
            <summary>Vérifier les correspondances des colonnes</summary>
            <div className="financial-mapping-grid">
              {fields.map(([id, title, kind]) => (
                <label className="financial-mapping-field" key={id}>
                  <span>
                    {title}
                    {kind === true ? " · requis" : ""}
                  </span>
                  <select
                    aria-label={`${title} — colonne source`}
                    value={source.mapping?.[id] ?? ""}
                    onChange={(event) =>
                      onMapping(sourceType, {
                        ...source.mapping,
                        [id]: event.target.value,
                      })
                    }
                  >
                    <option value="">Non mappé</option>
                    {source.headers.map((header) => (
                      <option value={header} key={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </details>
          {sourceType === "references" && (
            <div className="reference-values-grid">
              {fields.map(([id, title]) => (
                <div key={id}>
                  <b>{title}</b>
                  <span>
                    {(source.mappedRows ?? [])
                      .map((row) => row[id])
                      .filter(Boolean)
                      .join(" · ") || "Colonne absente ou vide"}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="tuition-quality-note">
            État :{" "}
            <b>
              {status === "valid"
                ? "valide"
                : status === "incomplete"
                  ? "incomplet — correspondances ou contrôle à vérifier"
                  : "non chargé"}
            </b>{" "}
            · {fmtCount(mapped.length)} ligne(s) exploitables · données
            conservées dans ce navigateur, sur cet appareil.
          </p>
          {(source.quality?.invalidDates > 0 ||
            source.quality?.invalidAmounts > 0 ||
            source.quality?.remainingDiscrepancies > 0) && (
            <p className="tuition-quality-note">
              {fmtCount(source.quality?.invalidDates)} date(s) invalide(s) ·{" "}
              {fmtCount(source.quality?.invalidAmounts)} valeur(s) numérique(s)
              invalide(s) · {fmtCount(source.quality?.remainingDiscrepancies)}{" "}
              écart(s) sur le reste calculé.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function TuitionDataTable({
  rows,
  columns,
  empty = "Aucune ligne pour cette sélection.",
}) {
  const fmtTuitionMoney = useMoney();
  const definitions = columns.map(([key, label, format]) => ({
    key,
    label,
    numeric: format === "money" || format === "number",
    render: (value) =>
      value instanceof Date
        ? displayTuitionDate(value)
        : value == null || value === ""
          ? "—"
          : format === "money"
            ? fmtTuitionMoney(value)
            : format === "number"
              ? FRENCH_NUMBER.format(value)
              : String(value),
  }));
  return rows.length ? (
    <DataTable rows={rows} columns={definitions} label="Données financières" />
  ) : (
    <EmptyState
      compact
      title="Aucune donnée dans cette sélection"
      detail={empty}
    />
  );
}

export function TuitionStudentsPage({
  source,
  references,
  error,
  onImport,
  onMapping,
  dateRange,
}) {
  const fmtTuitionMoney = useMoney();
  const [search, setSearch] = useState("");
  const [formation, setFormation] = usePreference("students-formation", "");
  const [campus, setCampus] = usePreference("students-campus", "");
  const [year, setYear] = usePreference("students-year", "");
  const [status, setStatus] = usePreference("students-status", "");
  const [paymentMethod, setPaymentMethod] = usePreference(
    "students-paymentMethod",
    "",
  );
  const [selected, setSelected] = useState(null);
  const rows = source?.mappedRows ?? [];
  const filtered = rows.filter(
    (row) =>
      (!search ||
        `${row.matricule ?? ""} ${row.lastName ?? ""} ${row.firstName ?? ""}`
          .toLocaleLowerCase("fr")
          .includes(search.toLocaleLowerCase("fr"))) &&
      (!formation || row.formation === formation) &&
      (!campus || row.campus === campus) &&
      (!year || row.academicYear === year) &&
      (!status || row.globalStatus === status) &&
      (!paymentMethod || row.paymentMethod === paymentMethod) &&
      tuitionInRange(row.nextDueDate, dateRange),
  );
  const summary = summarizeStudents(filtered);
  const unique = new Map();
  for (const row of filtered) {
    const key = row.studentId || row.matricule;
    if (key && !unique.has(key)) unique.set(key, row);
  }
  const cleanForMoney =
    unique.size ===
    filtered.filter((row) => row.studentId || row.matricule).length;
  const columns = [
    ["matricule", "Matricule"],
    ["lastName", "Nom"],
    ["firstName", "Prénom"],
    ["formation", "Formation"],
    ["academicYear", "Année"],
    ["campus", "Campus"],
    ["amountDue", "À payer", true],
    ["amountPaid", "Payé", true],
    ["amountRemaining", "Reste", true],
    ["globalStatus", "Statut"],
  ];
  return (
    <>
      <PageTitle
        eyebrow="SUIVI DES SCOLARITÉS"
        title="Étudiants & inscriptions"
        subtitle="Situation individuelle selon le fichier étudiant importé; une ligne n’est pas automatiquement une inscription distincte."
        badge={
          source
            ? (source.quality?.status ?? "Fichier local")
            : "Source requise"
        }
      />
      {!source ? (
        <TuitionSourceCard
          sourceType="students"
          source={null}
          error={error}
          onImport={onImport}
          onMapping={onMapping}
        />
      ) : (
        <>
          <TuitionSourceCard
            sourceType="students"
            source={source}
            error={error}
            onImport={onImport}
            onMapping={onMapping}
          />
          <div className="commercial-kpi-grid tuition-kpis">
            <MetricCard
              title="Étudiants distincts"
              value={fmtCount(summary.distinctStudents)}
              helper="Étudiants identifiés par référence ou matricule"
              icon="candidate"
            />
            <MetricCard
              title="Montant à payer"
              value={
                cleanForMoney
                  ? fmtTuitionMoney(summary.amountDue)
                  : "À contrôler"
              }
              helper={
                cleanForMoney
                  ? "Somme source · lignes identifiées"
                  : "Identifiants répétés : agrégat suspendu"
              }
              icon="target"
              unavailable={!cleanForMoney || summary.amountDue === null}
            />
            <MetricCard
              title="Montant payé"
              value={
                cleanForMoney
                  ? fmtTuitionMoney(summary.amountPaid)
                  : "À contrôler"
              }
              helper="Montants payés du fichier étudiant"
              icon="euro"
              unavailable={!cleanForMoney || summary.amountPaid === null}
            />
            <MetricCard
              title="Reste à payer"
              value={
                cleanForMoney
                  ? fmtTuitionMoney(summary.amountRemaining)
                  : "À contrôler"
              }
              helper="Différence entre les montants à payer et payés"
              icon="total"
              unavailable={!cleanForMoney || summary.amountRemaining === null}
            />
            <MetricCard
              title="Étudiants en retard"
              value={fmtCount(summary.overdueStudents)}
              helper="Jours de retard renseignés"
              icon="followup"
            />
          </div>
          <div className="tuition-filterbar">
            <label>
              Recherche
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Matricule, nom ou prénom"
              />
            </label>
            {[
              [
                "Formation",
                formation,
                setFormation,
                tuitionReferenceOptions(
                  references,
                  "formations",
                  tuitionOptions(rows, "formation"),
                ),
              ],
              [
                "Campus",
                campus,
                setCampus,
                tuitionReferenceOptions(
                  references,
                  "campuses",
                  tuitionOptions(rows, "campus"),
                ),
              ],
              [
                "Année universitaire",
                year,
                setYear,
                tuitionReferenceOptions(
                  references,
                  "academicYears",
                  tuitionOptions(rows, "academicYear"),
                ),
              ],
              [
                "Statut global",
                status,
                setStatus,
                tuitionOptions(rows, "globalStatus"),
              ],
              [
                "Mode de paiement",
                paymentMethod,
                setPaymentMethod,
                tuitionReferenceOptions(
                  references,
                  "paymentMethods",
                  tuitionOptions(rows, "paymentMethod"),
                ),
              ],
            ].map(([label, value, setter, options]) => (
              <label key={label}>
                {label}
                <select
                  value={value}
                  onChange={(event) => setter(event.target.value)}
                >
                  <option value="">Tous</option>
                  {options.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            ))}
            <button
              className="outline-button"
              onClick={() => {
                setSearch("");
                setFormation("");
                setCampus("");
                setYear("");
                setStatus("");
                setPaymentMethod("");
              }}
            >
              Réinitialiser
            </button>
          </div>
          <Panel
            title="Dossiers étudiants"
            subtitle={`${fmtCount(filtered.length)} ligne(s) · ${fmtCount(summary.distinctStudents)} étudiant(s) distinct(s)`}
          >
            <DataTable
              rows={filtered}
              label="Dossiers étudiants"
              columns={[
                ...columns.map(([key, label, numeric]) => ({
                  key,
                  label,
                  numeric,
                  render: (value) =>
                    value instanceof Date
                      ? displayTuitionDate(value)
                      : key.startsWith("amount")
                        ? fmtTuitionMoney(value)
                        : (value ?? "—"),
                })),
                {
                  key: "actions",
                  label: "Détail",
                  sortable: false,
                  render: (_, row) => (
                    <button
                      type="button"
                      className="outline-button"
                      onClick={() => setSelected(row)}
                    >
                      Consulter
                    </button>
                  ),
                },
              ]}
            />
          </Panel>
          {selected && (
            <Dialog
              open
              onClose={() => setSelected(null)}
              title="Détail étudiant"
              className="student-detail-dialog"
            >
              <h3>
                {[selected.firstName, selected.lastName]
                  .filter(Boolean)
                  .join(" ")}
              </h3>
              <p>Matricule · {selected.matricule ?? "—"}</p>
              <dl>
                {Object.entries(selected)
                  .filter(([, value]) => value !== null)
                  .map(([key, value]) => (
                    <Fragment key={key}>
                      <dt>
                        {Object.fromEntries(
                          TUITION_SOURCE_FIELDS.students.map(([id, label]) => [
                            id,
                            label,
                          ]),
                        )[key] ??
                          (key === "sourceReportedRemaining"
                            ? "Reste déclaré dans le fichier"
                            : "Information complémentaire")}
                      </dt>
                      <dd>
                        {value instanceof Date
                          ? displayTuitionDate(value)
                          : String(value)}
                      </dd>
                    </Fragment>
                  ))}
              </dl>
            </Dialog>
          )}
        </>
      )}
    </>
  );
}

export function TuitionSchedulePage({
  source,
  references,
  error,
  onImport,
  onMapping,
  students,
  dateRange,
}) {
  const fmtTuitionMoney = useMoney();
  const [status, setStatus] = usePreference("schedule-status", "");
  const [formation, setFormation] = usePreference("schedule-formation", "");
  const [method, setMethod] = usePreference("schedule-method", "");
  const rows = source?.mappedRows ?? [];
  const filtered = rows.filter(
    (row) =>
      (!status || row.status === status) &&
      (!formation || row.formation === formation) &&
      (!method || row.paymentMethod === method) &&
      tuitionInRange(row.dueDate ?? row.paymentDate, dateRange),
  );
  const summary = summarizeSchedule(filtered, students ?? []);
  const monthMap = new Map();
  for (const row of filtered) {
    const due = tuitionDateKey(row.dueDate).slice(0, 7);
    const paid = tuitionDateKey(row.paymentDate).slice(0, 7);
    if (due) {
      const item = monthMap.get(due) ?? {
        month: due,
        planned: null,
        collected: null,
      };
      if (Number.isFinite(row.plannedAmount))
        item.planned = (item.planned ?? 0) + row.plannedAmount;
      monthMap.set(due, item);
    }
    if (paid) {
      const item = monthMap.get(paid) ?? {
        month: paid,
        planned: null,
        collected: null,
      };
      if (Number.isFinite(row.paidAmount))
        item.collected = (item.collected ?? 0) + row.paidAmount;
      monthMap.set(paid, item);
    }
  }
  const monthly = [...monthMap.values()].sort((a, b) =>
    a.month.localeCompare(b.month),
  );
  const columns = [
    ["installmentId", "ID échéance"],
    ["matricule", "Matricule"],
    ["studentName", "Étudiant"],
    ["formation", "Formation"],
    ["installmentNumber", "N°", "number"],
    ["dueDate", "Échéance"],
    ["plannedAmount", "Prévu", "money"],
    ["paidAmount", "Payé", "money"],
    ["remainingAmount", "Reste", "money"],
    ["status", "Statut"],
    ["paymentDate", "Date paiement"],
    ["paymentMethod", "Mode règlement"],
    ["daysOverdue", "Retard (j)", "number"],
  ];
  return (
    <>
      <PageTitle
        eyebrow="CALENDRIER DES VERSEMENTS"
        title="Échéancier"
        subtitle="Échéances et règlements selon les lignes réellement présentes dans la source."
        badge={
          source
            ? (source.quality?.status ?? "Fichier local")
            : "Source requise"
        }
      />
      {!source ? (
        <TuitionSourceCard
          sourceType="schedule"
          source={null}
          error={error}
          onImport={onImport}
          onMapping={onMapping}
        />
      ) : (
        <>
          <TuitionSourceCard
            sourceType="schedule"
            source={source}
            error={error}
            onImport={onImport}
            onMapping={onMapping}
          />
          <div className="commercial-kpi-grid tuition-kpis">
            <MetricCard
              title="Échéances filtrées"
              value={fmtCount(summary.count)}
              helper="Lignes de source, pas étudiants"
              icon="total"
            />
            <MetricCard
              title="Montant prévu"
              value={fmtTuitionMoney(summary.planned)}
              helper="Montant prévu · échéancier"
              icon="target"
              unavailable={summary.planned === null}
            />
            <MetricCard
              title="Montant payé"
              value={fmtTuitionMoney(summary.paid)}
              helper="Somme des montants payés renseignés"
              icon="euro"
              unavailable={summary.paid === null}
            />
            <MetricCard
              title="Reste des échéances"
              value={fmtTuitionMoney(summary.remaining)}
              helper="Champ source uniquement"
              icon="total"
              unavailable={summary.remaining === null}
            />
            <MetricCard
              title="En retard"
              value={fmtCount(summary.overdue)}
              helper="Jours de retard strictement positifs"
              icon="followup"
            />
          </div>
          <div className="tuition-filterbar">
            {[
              [
                "Statut",
                status,
                setStatus,
                tuitionReferenceOptions(
                  references,
                  "installmentStatuses",
                  tuitionOptions(rows, "status"),
                ),
              ],
              [
                "Formation",
                formation,
                setFormation,
                tuitionReferenceOptions(
                  references,
                  "formations",
                  tuitionOptions(rows, "formation"),
                ),
              ],
              [
                "Mode règlement",
                method,
                setMethod,
                tuitionReferenceOptions(
                  references,
                  "settlementMethods",
                  tuitionOptions(rows, "paymentMethod"),
                ),
              ],
            ].map(([label, value, setter, options]) => (
              <label key={label}>
                {label}
                <select
                  value={value}
                  onChange={(event) => setter(event.target.value)}
                >
                  <option value="">Tous</option>
                  {options.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            ))}
            <button
              className="outline-button"
              onClick={() => {
                setStatus("");
                setFormation("");
                setMethod("");
              }}
            >
              Réinitialiser
            </button>
            <span className="tuition-filter-count">
              {fmtCount(filtered.length)} lignes
            </span>
          </div>
          <div className="commercial-grid">
            <Panel
              title="Statuts source des échéances"
              subtitle="Valeurs réellement présentes dans le champ Statut"
            >
              {summary.statuses.length ? (
                <div
                  className="tuition-status-donut"
                  role="img"
                  aria-label="Repartition par statut source des echeances"
                >
                  <ResponsiveContainer width="100%" height={265}>
                    <PieChart>
                      <Pie
                        isAnimationActive={false}
                        data={summary.statuses.map(({ label, count }) => ({
                          name: label,
                          value: count,
                        }))}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="48%"
                        outerRadius="72%"
                        paddingAngle={2}
                      >
                        {summary.statuses.map((row, index) => (
                          <Cell
                            key={row.label}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState compact title="Aucun statut renseigne" />
              )}
            </Panel>
            <Panel
              title="Prévu et payé par mois"
              subtitle="Prévu regroupé par date d’échéance; payé par date de paiement"
              className="panel-span-two"
            >
              {monthly.length ? (
                <ResponsiveContainer width="100%" height={270}>
                  <AreaChart data={monthly}>
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--chart-grid)"
                      strokeDasharray="3 4"
                    />
                    <XAxis dataKey="month" tickFormatter={formatMonthFr} />
                    <YAxis
                      tickFormatter={(value) => FRENCH_NUMBER.format(value)}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Area
                      isAnimationActive={false}
                      dataKey="planned"
                      name="Prévu"
                      stroke="var(--chart-2)"
                      fill="var(--chart-2)"
                      fillOpacity={0.12}
                      connectNulls={false}
                    />
                    <Area
                      isAnimationActive={false}
                      dataKey="collected"
                      name="Payé"
                      stroke="var(--chart-3)"
                      fill="var(--chart-3)"
                      fillOpacity={0.15}
                      connectNulls={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState compact title="Dates exploitables insuffisantes" />
              )}
            </Panel>
          </div>
          <Panel
            title="Échéances détaillées"
            subtitle={`${fmtCount(filtered.length)} échéance(s) · données financières locales`}
          >
            <TuitionDataTable rows={filtered} columns={columns} />
          </Panel>
        </>
      )}
    </>
  );
}

export function TuitionRevenuePage({
  sources,
  aggregate,
  errors,
  onImport,
  onMapping,
  financialSource,
  financialError,
  onFinancialImport,
  onFinancialMapping,
  dateRange,
}) {
  const fmtTuitionMoney = useMoney();
  const students = sources.students;
  const schedule = sources.schedule;
  const studentRows = (students?.mappedRows ?? []).filter((row) =>
    tuitionInRange(row.nextDueDate, dateRange),
  );
  const scheduleRows = (schedule?.mappedRows ?? []).filter((row) =>
    tuitionInRange(row.dueDate, dateRange),
  );
  const studentSummary = summarizeStudents(studentRows);
  const scheduleSummary = summarizeSchedule(scheduleRows, studentRows);
  const aggregateData = aggregate?.mapped;
  return (
    <>
      <PageTitle
        eyebrow="PILOTAGE DES FRAIS DE SCOLARITÉ"
        title="Revenus & encaissements"
        subtitle="Chaque indicateur reste rattaché à sa source; les lignes détaillées et les tableaux agrégés ne sont jamais additionnés."
        badge="Sources indépendantes"
      />
      <div className="tuition-source-grid">
        <TuitionSourceCard
          sourceType="students"
          source={students}
          error={errors.students}
          onImport={onImport}
          onMapping={onMapping}
        />
        <TuitionSourceCard
          sourceType="schedule"
          source={schedule}
          error={errors.schedule}
          onImport={onImport}
          onMapping={onMapping}
        />
      </div>
      {students || schedule ? (
        <>
          <h2 className="tuition-section-heading">
            Données détaillées · périmètres distincts
          </h2>
          <p className="tuition-section-note">
            Les montants étudiants viennent de Dossiers étudiants; les paiements
            et échéances viennent de Échéancier. Aucun total combiné n’est
            calculé.
          </p>
          <div className="commercial-kpi-grid tuition-kpis">
            {students && (
              <>
                <MetricCard
                  title="Étudiants distincts · Dossiers étudiants"
                  value={fmtCount(studentSummary.distinctStudents)}
                  helper="Identifiants distincts"
                  icon="candidate"
                />
                <MetricCard
                  title="À payer · Dossiers étudiants"
                  value={fmtTuitionMoney(studentSummary.amountDue)}
                  helper="Total à payer étudiant"
                  icon="target"
                  unavailable={studentSummary.amountDue === null}
                />
                <MetricCard
                  title="Payé · Dossiers étudiants"
                  value={fmtTuitionMoney(studentSummary.amountPaid)}
                  helper="Total payé étudiant"
                  icon="euro"
                  unavailable={studentSummary.amountPaid === null}
                />
                <MetricCard
                  title="Reste · Dossiers étudiants"
                  value={fmtTuitionMoney(studentSummary.amountRemaining)}
                  helper="Reste à payer étudiant"
                  icon="total"
                  unavailable={studentSummary.amountRemaining === null}
                />
              </>
            )}
            {schedule && (
              <>
                <MetricCard
                  title="Échéances · Échéancier"
                  value={fmtCount(scheduleSummary.count)}
                  helper="Lignes d’échéancier"
                  icon="total"
                />
                <MetricCard
                  title="Prévu · Échéancier"
                  value={fmtTuitionMoney(scheduleSummary.planned)}
                  helper="Montant prévu"
                  icon="target"
                  unavailable={scheduleSummary.planned === null}
                />
                <MetricCard
                  title="Payé · Échéancier"
                  value={fmtTuitionMoney(scheduleSummary.paid)}
                  helper="Montant payé sur échéances"
                  icon="euro"
                  unavailable={scheduleSummary.paid === null}
                />
                <MetricCard
                  title="Reste échéances · Échéancier"
                  value={fmtTuitionMoney(scheduleSummary.remaining)}
                  helper="Reste échéance fourni"
                  icon="total"
                  unavailable={scheduleSummary.remaining === null}
                />
              </>
            )}
          </div>
        </>
      ) : (
        <section className="financial-empty-state">
          <span className="financial-empty-icon">
            <Icon name="euro" />
          </span>
          <div className="eyebrow">SOURCES DÉTAILLÉES</div>
          <h2>Aucun fichier étudiant ou échéancier importé</h2>
          <p>
            Importez Dossiers étudiants et/ou Échéancier pour afficher les
            indicateurs individuels. L’import se fait localement et chaque
            source peut être chargée séparément.
          </p>
        </section>
      )}
      <section className="tuition-aggregate-section">
        <div className="tuition-section-heading-row">
          <div>
            <h2>
              {financialSource && !aggregateData?.reportModel
                ? "Source financière importée · mapping requis"
                : "Synthèse financière agrégée · Synthèse financière"}
            </h2>
            <p>
              {financialSource && !aggregateData?.reportModel
                ? "Le fichier importé ne correspond pas au format agrégé Synthèse financière. Son mapping reste indépendant des sources détaillées."
                : "Source de contrôle indépendante, sans addition avec les lignes détaillées."}
            </p>
          </div>
          <FinancialCsvImportButton
            onFile={onFinancialImport}
            label={
              financialSource
                ? "Remplacer le fichier financier"
                : "Importer la synthèse agrégée"
            }
          />
        </div>
        {financialError && (
          <div className="csv-import-error" role="alert">
            {financialError}
          </div>
        )}
        {aggregateData?.reportModel ? (
          <div className="commercial-grid">
            <Panel
              title="Montants par filière · Synthèse financière"
              subtitle="Agrégats tels que fournis; totaux généraux exclus"
            >
              <TuitionDataTable
                rows={aggregateData.programRows}
                columns={[
                  ["name", "Filière"],
                  ["plannedAmount", "À payer", "money"],
                  ["collectedAmount", "Encaissé", "money"],
                  ["remainingAmount", "Reste", "money"],
                  ["reportedRate", "Taux source"],
                ]}
              />
            </Panel>
            <Panel
              title="Contrôle des périmètres"
              subtitle="Les tableaux mensuels et par filière sont des agrégats indépendants"
            >
              <div className="source-alert">
                <span className="source-alert-icon">i</span>
                <div>
                  <b>Ne pas additionner les tableaux</b>
                  <p>
                    Les totaux peuvent diverger entre vues fournies par le
                    fichier. Ils restent affichés séparément; les écarts ne sont
                    ni corrigés ni masqués.
                  </p>
                </div>
              </div>
              <p className="tuition-quality-note">
                Source agrégée · {fmtCount(aggregateData.monthlyRows.length)}{" "}
                périodes · {fmtCount(aggregateData.programRows.length)} filières
                · sommes de lignes détaillées disponibles dans l’onglet Revenus
                & inscriptions existant.
              </p>
            </Panel>
          </div>
        ) : financialSource ? (
          <GenericFinancialPage
            embedded
            source={financialSource}
            error=""
            onImport={onFinancialImport}
            onMapping={onFinancialMapping}
            period={dateRange}
          />
        ) : (
          <p className="tuition-quality-note">
            Aucune synthèse agrégée importée.
          </p>
        )}
      </section>
    </>
  );
}

export function TuitionFormationsPage({
  students,
  schedule,
  aggregate,
  dateRange,
}) {
  const studentRows = (students?.mappedRows ?? []).filter((row) =>
    tuitionInRange(row.nextDueDate, dateRange),
  );
  const scheduleRows = (schedule?.mappedRows ?? []).filter((row) =>
    tuitionInRange(row.dueDate, dateRange),
  );
  const rows = groupTuitionByFormation(studentRows, scheduleRows);
  const aggregateRows = aggregate?.mapped?.programRows ?? [];
  const chartRows = rows.filter((row) => Number.isFinite(row.amountDue));
  return (
    <>
      <PageTitle
        eyebrow="ANALYSE FINANCIÈRE"
        title="Analyse par formation"
        subtitle="Les lignes par formation sont affichées par source; les agrégats fournis restent distincts des données détaillées."
        badge="Périmètre source"
      />
      {chartRows.length > 0 && (
        <Panel
          title={"Classement par montant à payer · Dossiers étudiants"}
          subtitle="Sommes détaillées complètes par formation"
        >
          <ResponsiveContainer
            width="100%"
            height={Math.max(240, chartRows.length * 34)}
          >
            <BarChart
              data={chartRows}
              layout="vertical"
              margin={{ left: 5, right: 28 }}
            >
              <CartesianGrid
                horizontal={false}
                stroke="var(--chart-grid)"
                strokeDasharray="3 4"
              />
              <XAxis
                type="number"
                tickFormatter={(value) => FRENCH_NUMBER.format(value)}
              />
              <YAxis type="category" dataKey="formation" width={140} />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                isAnimationActive={false}
                dataKey="amountDue"
                name={"Montant à payer"}
                fill="var(--chart-2)"
                radius={[0, 5, 5, 0]}
                barSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}
      {rows.length ? (
        <Panel
          title="Formation · données détaillées"
          subtitle="Montants étudiants Dossiers étudiants; nombre d’échéances Échéancier, sans jointure des montants"
        >
          <TuitionDataTable
            rows={rows}
            columns={[
              ["formation", "Formation"],
              ["studentCount", "Étudiants distincts", "number"],
              ["scheduleCount", "Échéances", "number"],
              ["amountDue", "À payer", "money"],
              ["amountPaid", "Payé", "money"],
              ["amountRemaining", "Reste", "money"],
            ]}
          />
        </Panel>
      ) : (
        <EmptyState
          title="Aucune donnée détaillée par formation"
          detail="Importez un fichier étudiant ou d’échéancier contenant une colonne Formation."
        />
      )}
      <Panel
        title="Agrégat filière · Synthèse financière"
        subtitle="Tableau indépendant fourni par la synthèse financière"
      >
        {aggregateRows.length ? (
          <TuitionDataTable
            rows={aggregateRows}
            columns={[
              ["name", "Filière"],
              ["plannedAmount", "À payer", "money"],
              ["collectedAmount", "Encaissé", "money"],
              ["remainingAmount", "Reste", "money"],
              ["reportedRate", "Taux source"],
            ]}
          />
        ) : (
          <EmptyState compact title="Aucun agrégat par filière reconnu" />
        )}
      </Panel>
    </>
  );
}

export function TuitionOverviewSummary({ sources, aggregate, dateRange }) {
  const fmtTuitionMoney = useMoney();
  const students = (sources.students?.mappedRows ?? []).filter((row) =>
    tuitionInRange(row.nextDueDate, dateRange),
  );
  const schedule = (sources.schedule?.mappedRows ?? []).filter((row) =>
    tuitionInRange(row.dueDate, dateRange),
  );
  const studentSummary = summarizeStudents(students);
  const scheduleSummary = summarizeSchedule(schedule, students);
  const formations = groupTuitionByFormation(students, schedule)
    .filter((row) => row.amountDue !== null)
    .slice(0, 8);
  const statusRows = scheduleSummary.statuses;
  const aggregateData = aggregate?.mapped?.reportModel
    ? aggregate.mapped
    : null;
  return (
    <section className="tuition-overview-block">
      <div className="tuition-section-heading-row">
        <div>
          <h2>Situation des frais de scolarité</h2>
          <p>
            Indicateurs séparés par source; aucun rapprochement n’additionne
            étudiants, échéances et agrégats.
          </p>
        </div>
        <span className="tuition-local-pill">Données locales</span>
      </div>
      <div className="commercial-kpi-grid tuition-kpis">
        {sources.students && (
          <>
            <MetricCard
              title="Étudiants distincts · étudiants"
              value={fmtCount(studentSummary.distinctStudents)}
              helper="Identifiants distincts"
              icon="candidate"
            />
            <MetricCard
              title="À payer · étudiants"
              value={fmtTuitionMoney(studentSummary.amountDue)}
              helper="Source étudiants"
              icon="target"
              unavailable={studentSummary.amountDue === null}
            />
            <MetricCard
              title="Payé · étudiants"
              value={fmtTuitionMoney(studentSummary.amountPaid)}
              helper="Source étudiants"
              icon="euro"
              unavailable={studentSummary.amountPaid === null}
            />
          </>
        )}
        {sources.schedule && (
          <>
            <MetricCard
              title="Échéances · échéancier"
              value={fmtCount(scheduleSummary.count)}
              helper="Lignes d’échéancier"
              icon="total"
            />
            <MetricCard
              title="En retard · échéancier"
              value={fmtCount(scheduleSummary.overdue)}
              helper="Retard fourni supérieur à zéro"
              icon="followup"
            />
          </>
        )}
      </div>
      {aggregateData && (
        <>
          <div className="tuition-section-heading-row">
            <div>
              <h3>Synthèse agrégée · Synthèse financière</h3>
              <p>
                Valeurs source affichées séparément des lignes étudiantes et des
                échéances; le filtre temporel A/B ne s’applique pas à ces
                agrégats sans dates complètes.
              </p>
            </div>
          </div>
          <div className="commercial-kpi-grid tuition-kpis">
            <MetricCard
              title="À payer · synthèse mensuelle"
              value={fmtTuitionMoney(aggregateData.metrics.plannedAmount)}
              helper="Somme du tableau mensuel source"
              icon="target"
              unavailable={aggregateData.metrics.plannedAmount == null}
            />
            <MetricCard
              title="Encaissé · synthèse mensuelle"
              value={fmtTuitionMoney(aggregateData.metrics.collectedAmount)}
              helper="Somme du tableau mensuel source"
              icon="euro"
              unavailable={aggregateData.metrics.collectedAmount == null}
            />
            <MetricCard
              title="Reste · synthèse par formation"
              value={fmtTuitionMoney(
                aggregateData.metrics.programRemainingAmount,
              )}
              helper="Somme des lignes par filière"
              icon="total"
              unavailable={aggregateData.metrics.programRemainingAmount == null}
            />
          </div>
          <div className="commercial-grid">
            {aggregateData.monthlyRows.length > 0 && (
              <Panel
                title="Prévu et encaissé par mois · Synthèse financière"
                subtitle="Série agrégée du fichier, sans raccord aux échéances détaillées"
                className="panel-span-two"
              >
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={aggregateData.monthlyRows}>
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--chart-grid)"
                      strokeDasharray="3 4"
                    />
                    <XAxis dataKey="period" />
                    <YAxis
                      tickFormatter={(value) => FRENCH_NUMBER.format(value)}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Area
                      isAnimationActive={false}
                      dataKey="plannedAmount"
                      name="Prévu"
                      stroke="var(--chart-2)"
                      fill="var(--chart-2)"
                      fillOpacity={0.12}
                    />
                    <Area
                      isAnimationActive={false}
                      dataKey="collectedAmount"
                      name="Encaissé"
                      stroke="var(--chart-3)"
                      fill="var(--chart-3)"
                      fillOpacity={0.15}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>
            )}
            {aggregateData.programRows.length > 0 && (
              <Panel
                title="Reste par filière · Synthèse financière"
                subtitle="Lignes de détail; total général exclu"
              >
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(220, aggregateData.programRows.length * 32)}
                >
                  <BarChart
                    data={aggregateData.programRows
                      .slice()
                      .sort(
                        (a, b) =>
                          (b.remainingAmount ?? -Infinity) -
                          (a.remainingAmount ?? -Infinity),
                      )}
                    layout="vertical"
                    margin={{ left: 4, right: 20 }}
                  >
                    <CartesianGrid
                      horizontal={false}
                      stroke="var(--chart-grid)"
                      strokeDasharray="3 4"
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(value) => FRENCH_NUMBER.format(value)}
                    />
                    <YAxis type="category" dataKey="name" width={130} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      isAnimationActive={false}
                      dataKey="remainingAmount"
                      name="Reste source"
                      fill="#F97373"
                      radius={[0, 5, 5, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            )}
            {aggregateData.statusTotals.length > 0 && (
              <Panel
                title="États source · C"
                subtitle="Comptages fournis par la synthèse"
              >
                <StatusRows rows={aggregateData.statusTotals} />
              </Panel>
            )}
          </div>
        </>
      )}
      <div className="commercial-grid">
        {formations.length > 0 && (
          <Panel
            title="Formations · Dossiers étudiants"
            subtitle="Montant à payer par formation; valeurs inconnues omises"
          >
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={formations}
                layout="vertical"
                margin={{ left: 5, right: 24 }}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="var(--chart-grid)"
                  strokeDasharray="3 4"
                />
                <XAxis
                  type="number"
                  tickFormatter={(value) => FRENCH_NUMBER.format(value)}
                />
                <YAxis type="category" dataKey="formation" width={130} />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  isAnimationActive={false}
                  dataKey="amountDue"
                  name="À payer"
                  fill="var(--chart-2)"
                  radius={[0, 5, 5, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        )}
        {statusRows.length > 0 && (
          <Panel
            title="Statuts · Échéancier"
            subtitle="Libellés bruts du fichier échéancier"
          >
            <StatusRows
              rows={statusRows.map(({ label, count }) => ({
                name: label,
                count,
              }))}
            />
          </Panel>
        )}
        {!formations.length && !statusRows.length && (
          <Panel title="Sources de suivi" subtitle="Aperçu de disponibilité">
            <div className="source-quality-grid">
              <div>
                <b>Dossiers étudiants · Étudiants</b>
                <span>
                  {sources.students
                    ? `${fmtCount(students.length)} lignes mappées`
                    : "En attente d’import"}
                </span>
              </div>
              <div>
                <b>Échéancier · Échéancier</b>
                <span>
                  {sources.schedule
                    ? `${fmtCount(schedule.length)} lignes mappées`
                    : "En attente d’import"}
                </span>
              </div>
              <div>
                <b>Synthèse financière · étudiantsgrégats</b>
                <span>
                  {aggregate ? "Importée séparément" : "En attente d’import"}
                </span>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </section>
  );
}
