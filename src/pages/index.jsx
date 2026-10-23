import { lazy } from "react";
export const FinancialPage = lazy(() =>
  import("./FinancialPages.jsx").then((module) => ({
    default: module.FinancialPage,
  })),
);
export const TuitionStudentsPage = lazy(() =>
  import("./FinancialPages.jsx").then((module) => ({
    default: module.TuitionStudentsPage,
  })),
);
export const TuitionSchedulePage = lazy(() =>
  import("./FinancialPages.jsx").then((module) => ({
    default: module.TuitionSchedulePage,
  })),
);
export const TuitionRevenuePage = lazy(() =>
  import("./FinancialPages.jsx").then((module) => ({
    default: module.TuitionRevenuePage,
  })),
);
export const TuitionFormationsPage = lazy(() =>
  import("./FinancialPages.jsx").then((module) => ({
    default: module.TuitionFormationsPage,
  })),
);
export const TuitionDataSourcesPage = lazy(() =>
  import("./SourceHub.jsx").then((module) => ({ default: module.default })),
);
export const TuitionOverviewSummary = lazy(() =>
  import("./FinancialPages.jsx").then((module) => ({
    default: module.TuitionOverviewSummary,
  })),
);
export const CommercialOverview = lazy(() =>
  import("./CommercialPages.jsx").then((module) => ({
    default: module.CommercialOverview,
  })),
);
export const PipelinePage = lazy(() =>
  import("./CommercialPages.jsx").then((module) => ({
    default: module.PipelinePage,
  })),
);
export const RevenuePage = lazy(() =>
  import("./CommercialPages.jsx").then((module) => ({
    default: module.RevenuePage,
  })),
);
export const FollowupsPage = lazy(() =>
  import("./CommercialPages.jsx").then((module) => ({
    default: module.FollowupsPage,
  })),
);
export const ReportPage = lazy(() =>
  import("./CommercialPages.jsx").then((module) => ({
    default: module.ReportPage,
  })),
);
export const ImportedCsvOverview = lazy(() =>
  import("./FeedbackPages.jsx").then((module) => ({
    default: module.ImportedCsvOverview,
  })),
);
export const ImportedCsvReport = lazy(() =>
  import("./FeedbackPages.jsx").then((module) => ({
    default: module.ImportedCsvReport,
  })),
);
export const ImportedCsvPipeline = lazy(() =>
  import("./FeedbackPages.jsx").then((module) => ({
    default: module.ImportedCsvPipeline,
  })),
);
export const FeedbackPage = lazy(() =>
  import("./FeedbackPages.jsx").then((module) => ({
    default: module.FeedbackPage,
  })),
);
export const WelcomeOverview = lazy(() =>
  import("./FeedbackPages.jsx").then((module) => ({
    default: module.WelcomeOverview,
  })),
);
