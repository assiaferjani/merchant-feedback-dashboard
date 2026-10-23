import { lazy, Suspense } from "react";
const chart = (name) => {
  const Chart = lazy(() =>
    import("./Charts.jsx").then((module) => ({ default: module[name] })),
  );
  return function LazyChart(props) {
    return (
      <Suspense
        fallback={
          <div className="chart-skeleton" role="status">
            Chargement du graphique…
          </div>
        }
      >
        <Chart {...props} />
      </Suspense>
    );
  };
};
export const ResponsibleMixChart = chart("ResponsibleMixChart");
export const FeedbackChart = chart("FeedbackChart");
export const FeedbackBars = chart("FeedbackBars");
export const StatusDonutChart = chart("StatusDonutChart");
export const StatusDistributionChart = chart("StatusDistributionChart");
