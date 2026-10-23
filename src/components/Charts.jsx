import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_COLORS,
  FRENCH_NUMBER,
  FRENCH_PERCENT,
  fmtCount,
} from "../dashboard-config.js";
import { ChartTooltip, ChartEmpty } from "./Ui.jsx";
export function ResponsibleMixChart({ rows, series }) {
  if (!rows.length || !series.length) return <ChartEmpty />;
  const palette = CHART_COLORS;
  const colorFor = (label) => {
    if (label === "Autres (affichage)") return "#64748B";
    let hash = 0;
    for (const character of label)
      hash = (hash * 31 + character.codePointAt(0)) >>> 0;
    return palette[hash % palette.length];
  };
  return (
    <div className="responsible-mix-chart">
      <ResponsiveContainer
        width="100%"
        height={Math.max(330, rows.length * 58)}
      >
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 10, right: 24, bottom: 8, left: 5 }}
          barCategoryGap="28%"
        >
          <CartesianGrid
            horizontal={false}
            stroke="#dfe7f2"
            strokeDasharray="3 4"
          />
          <XAxis
            type="number"
            allowDecimals={false}
            tickFormatter={(value) => FRENCH_NUMBER.format(value)}
            tick={{ fill: "#475569", fontSize: 11 }}
            axisLine={{ stroke: "#bdc9d8" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={138}
            tick={{ fill: "#334155", fontSize: 12, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            shared={false}
            content={<ResponsibleMixTooltip series={series} />}
          />
          <Legend
            verticalAlign="top"
            align="left"
            height={48}
            iconType="circle"
            iconSize={9}
            formatter={(value) => (
              <span title={value}>{compactLabel(value)}</span>
            )}
          />
          {series.map((name) => (
            <Bar
              isAnimationActive={false}
              key={name}
              dataKey={name}
              name={name}
              stackId="avis"
              fill={colorFor(name)}
              stroke="#ffffff"
              strokeWidth={1.4}
              barSize={34}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <p className="status-chart-note">
        Catégories telles qu’elles figurent dans le fichier. « Autres
        (affichage) » regroupe les catégories au-delà des six plus fréquentes.
      </p>
    </div>
  );
}

export function ResponsibleMixTooltip({ active, payload, label, series }) {
  const item = payload?.[0];
  if (!active || !item) return null;
  const row = item.payload ?? {};
  const total = series.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
  const value = Number(item.value) || 0;
  return (
    <div className="chart-tooltip responsible-mix-tooltip">
      <b>{label}</b>
      <span>
        <i style={{ background: item.color }} /> {item.name}
      </span>
      <strong>{FRENCH_NUMBER.format(value)} lignes</strong>
      <small>
        {total ? FRENCH_PERCENT.format(value / total) : "0 %"} des lignes de ce
        commercial
      </small>
    </div>
  );
}

export function FeedbackChart({ data, type }) {
  if (!data.length) return <ChartEmpty />;
  if (type === "area") {
    const xKey = data[0]?.month ? "label" : "date";
    return (
      <ResponsiveContainer width="100%" height={265}>
        <AreaChart
          data={data}
          margin={{ top: 12, right: 10, left: -16, bottom: 0 }}
        >
          <defs>
            <linearGradient id="feedbackFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.24} />
              <stop
                offset="100%"
                stopColor="var(--chart-1)"
                stopOpacity={0.025}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#e8eef0"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey={xKey}
            tickFormatter={
              xKey === "date"
                ? (value) =>
                    new Intl.DateTimeFormat("fr-FR", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(`${value}T00:00:00Z`))
                : undefined
            }
            minTickGap={48}
            tick={{ fill: "#7b8a91", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tickFormatter={(value) => FRENCH_NUMBER.format(value)}
            tick={{ fill: "#7b8a91", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            isAnimationActive={false}
            dataKey="count"
            name="Avis enregistrés"
            type="monotone"
            stroke="var(--chart-1)"
            strokeWidth={2.4}
            fill="url(#feedbackFill)"
            activeDot={{ r: 5, fill: "var(--chart-3)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  if (type === "line")
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{ top: 14, right: 18, left: 0, bottom: 3 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="#e8edf4"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "#718096", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            width={42}
            tickFormatter={(value) => FRENCH_NUMBER.format(value)}
            tick={{ fill: "#718096", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} />
          <Line
            isAnimationActive={false}
            dataKey="count"
            name="Avis enregistrés"
            type="monotone"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            activeDot={{ r: 5 }}
            dot={{ r: 3, fill: "#168c84", strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  return (
    <ResponsiveContainer width="100%" height={265}>
      <BarChart data={data}>
        <CartesianGrid
          vertical={false}
          stroke="#e8eef0"
          strokeDasharray="3 4"
        />
        <XAxis
          dataKey="label"
          tick={{ fill: "#7b8a91", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "#7b8a91", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ChartTooltip />} />
        <Bar
          isAnimationActive={false}
          dataKey="count"
          name="Retours"
          fill="var(--chart-3)"
          radius={[4, 4, 0, 0]}
          maxBarSize={30}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FeedbackBars({ rows, colors }) {
  if (!rows.length) return <ChartEmpty />;
  const visible = rows.slice(0, 12);
  return (
    <div className="ranking-chart">
      <ResponsiveContainer
        width="100%"
        height={Math.max(250, visible.length * 33)}
      >
        <BarChart
          data={visible}
          layout="vertical"
          margin={{ left: 10, right: 18, top: 4, bottom: 4 }}
        >
          <CartesianGrid
            horizontal={false}
            stroke="#e8eef0"
            strokeDasharray="3 4"
          />
          <XAxis
            type="number"
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#7b8a91", fontSize: 10 }}
            tickFormatter={(value) => FRENCH_NUMBER.format(value)}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={128}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#52666d", fontSize: 10 }}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar
            isAnimationActive={false}
            dataKey="count"
            name="Avis enregistrés"
            radius={[0, 4, 4, 0]}
            barSize={19}
          >
            {visible.map((row, index) => (
              <Cell key={row.name} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {rows.length > visible.length && (
        <p className="status-chart-note">
          {visible.length} premiers résultats sur{" "}
          {rows.length.toLocaleString("fr-FR")}. Les autres valeurs restent
          disponibles dans les données et les exports.
        </p>
      )}
    </div>
  );
}

export const STATUS_COLORS = CHART_COLORS;

export const compactLabel = (value) =>
  String(value).length > 20 ? `${String(value).slice(0, 19)}…` : value;

export function DistributionTooltip({ active, payload, total }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const count = Number(row.count) || 0;
  return (
    <div className="chart-tooltip">
      <b>{row.name}</b>
      <span>
        <i style={{ background: payload[0].color }} />{" "}
        {FRENCH_NUMBER.format(count)} lignes
      </span>
      <span>
        {total ? FRENCH_PERCENT.format(count / total) : "0 %"} du total
      </span>
    </div>
  );
}

export function StatusDonutChart({
  rows,
  selectedCategory = "",
  onSelectCategory,
}) {
  if (!rows.length) return <ChartEmpty />;
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const visible = rows.slice(0, 6);
  const remainder = rows.slice(6).reduce((sum, row) => sum + row.count, 0);
  const chartRows = [
    ...visible.map((row) => ({ ...row })),
    ...(remainder ? [{ name: "Autres (visuel)", count: remainder }] : []),
  ];
  const legendRows = chartRows;
  const select = (name) => {
    if (name === "Autres (visuel)" || !onSelectCategory) return;
    onSelectCategory(selectedCategory === name ? "" : name);
  };
  return (
    <div className="status-donut-wrap">
      <div className="status-donut-chart">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              isAnimationActive={false}
              data={chartRows}
              dataKey="count"
              nameKey="name"
              innerRadius="64%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="none"
              onClick={(entry) => select(entry?.name)}
            >
              {chartRows.map((row, index) => (
                <Cell
                  key={`${row.name}-${index}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  cursor={
                    row.name === "Autres (visuel)" ? "default" : "pointer"
                  }
                />
              ))}
            </Pie>
            <Tooltip content={<DistributionTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center" aria-hidden="true">
          <b>{fmtCount(total)}</b>
          <span>lignes</span>
        </div>
      </div>
      <div
        className="status-donut-legend"
        aria-label="Valeurs brutes LIB_AVIS et comptages"
      >
        {legendRows.map((row, index) => {
          const active = selectedCategory === row.name;
          const item = (
            <>
              <i
                style={{
                  background: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
              <span title={row.name}>{row.name}</span>
              <b>{fmtCount(row.count)}</b>
              <small>
                {total ? FRENCH_PERCENT.format(row.count / total) : "0 %"}
              </small>
            </>
          );
          return onSelectCategory ? (
            <button
              type="button"
              key={`${row.name}-${index}`}
              className={active ? "selected" : ""}
              aria-pressed={active}
              onClick={() => select(row.name)}
            >
              {item}
            </button>
          ) : (
            <div key={`${row.name}-${index}`}>{item}</div>
          );
        })}
      </div>
      {remainder > 0 && (
        <p className="status-chart-note">
          Le secteur « Autres » regroupe les catégories au-delà des six
          principales. Les filtres et les exports conservent toutes les valeurs.
        </p>
      )}
    </div>
  );
}

export function StatusDistributionChart({ rows }) {
  if (!rows.length) return <ChartEmpty />;
  const chartRows = rows.slice(0, 20).map((row) => ({
    ...row,
    displayName: compactLabel(row.name),
  }));
  return (
    <div
      className="status-distribution-chart"
      role="img"
      aria-label={`Répartition des valeurs brutes LIB_AVIS : ${rows.map((row) => `${row.name}, ${FRENCH_NUMBER.format(row.count)} lignes`).join(" ; ")}`}
    >
      <ResponsiveContainer
        width="100%"
        height={Math.max(250, rows.length * 36)}
      >
        <BarChart
          data={chartRows}
          layout="vertical"
          margin={{ left: 0, right: 38, top: 5, bottom: 5 }}
          barCategoryGap={12}
        >
          <CartesianGrid
            horizontal={false}
            stroke="#e8edf4"
            strokeDasharray="3 4"
          />
          <XAxis
            type="number"
            hide
            domain={[0, (dataMax) => Math.max(1, dataMax * 1.2)]}
          />
          <YAxis
            type="category"
            dataKey="displayName"
            width={132}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#42516a", fontSize: 10 }}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar
            isAnimationActive={false}
            dataKey="count"
            name="Avis enregistrés"
            radius={[0, 5, 5, 0]}
            barSize={18}
          >
            {chartRows.map((row, index) => (
              <Cell
                key={`${row.name}-${index}`}
                fill={STATUS_COLORS[index % STATUS_COLORS.length]}
              />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              formatter={(value) => FRENCH_NUMBER.format(value)}
              fill="#34445f"
              fontSize={10}
              fontWeight={700}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="status-chart-note">
        Comptages de lignes · classement limité aux 20 premières catégories
      </p>
    </div>
  );
}
