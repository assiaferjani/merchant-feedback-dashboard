import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateConversionRate,
  emptyCommercialBundle,
  filterOverdueFollowups,
  getFollowupRecords,
  getOverdueFollowups,
  mapSourceStatus,
  summarizeCommercialBundle,
  previousEquivalentPeriod,
  relativeChange,
  validateCommercialBundle,
} from "../src/commercial-data.js";

const baseBundle = () => ({
  config: {
    currency: "TND",
    collected_payment_statuses: ["paid"],
    confirmed_enrollment_statuses: ["confirmed"],
    contracted_revenue_statuses: ["signed"],
    forecast_revenue_statuses: ["forecast"],
    pending_appointment_statuses: ["pending"],
    status_labels: { contacted_raw: "Contacté" },
    conversion_stages: [{ from: "qualified_raw", to: "enrolled_raw" }],
  },
  candidates: [
    {
      candidate_id: "c-1",
      created_at: "2026-02-02",
      current_status: "contacted_raw",
      specialty: "A",
      study_level: "L1",
      salesperson: "S1",
    },
    {
      candidate_id: "c-2",
      created_at: "2026-02-03",
      current_status: "qualified_raw",
      specialty: "B",
      study_level: "L2",
      salesperson: "S2",
    },
  ],
  activities: [
    {
      activity_id: "a-1",
      candidate_id: "c-1",
      activity_date: "2026-02-02",
      activity_type: "call",
    },
    {
      activity_id: "a-2",
      candidate_id: "c-1",
      activity_date: "2026-02-04",
      activity_type: "meeting",
    },
    {
      activity_id: "a-3",
      candidate_id: "c-1",
      activity_date: "2026-02-08",
      activity_type: "follow-up",
    },
  ],
  payments: [
    {
      payment_id: "p-1",
      candidate_id: "c-1",
      payment_date: "2026-02-05",
      amount: 100,
      payment_status: "paid",
      currency: "TND",
      specialty: "A",
      study_level: "L1",
    },
    {
      payment_id: "p-2",
      candidate_id: "c-1",
      payment_date: "2026-02-12",
      amount: 40,
      payment_status: "paid",
      currency: "TND",
      specialty: "A",
      study_level: "L1",
    },
    {
      payment_id: "p-3",
      candidate_id: "c-2",
      payment_date: "2026-02-15",
      amount: 500,
      payment_status: "pending",
      currency: "TND",
      specialty: "B",
      study_level: "L2",
    },
  ],
  contracts: [
    {
      contract_id: "ct-1",
      candidate_id: "c-1",
      contract_date: "2026-02-03",
      contract_amount: 900,
      contract_status: "signed",
      currency: "TND",
      specialty: "A",
      study_level: "L1",
    },
  ],
  forecasts: [
    {
      forecast_id: "f-1",
      candidate_id: "c-2",
      forecast_date: "2026-02-10",
      amount: 600,
      forecast_status: "forecast",
      currency: "TND",
      specialty: "B",
      study_level: "L2",
    },
  ],
  enrollments: [
    {
      enrollment_id: "e-1",
      candidate_id: "c-1",
      enrollment_date: "2026-02-06",
      enrollment_status: "confirmed",
      specialty: "A",
      study_level: "L1",
    },
  ],
  pipeline_events: [
    {
      event_id: "ev-1",
      candidate_id: "c-1",
      event_date: "2026-02-01",
      status: "qualified_raw",
    },
    {
      event_id: "ev-2",
      candidate_id: "c-1",
      event_date: "2026-02-05",
      status: "enrolled_raw",
    },
    {
      event_id: "ev-3",
      candidate_id: "c-2",
      event_date: "2026-02-02",
      status: "qualified_raw",
    },
  ],
  appointments: [
    {
      appointment_id: "ap-1",
      candidate_id: "c-2",
      appointment_date: "2026-02-11",
      appointment_status: "pending",
      salesperson: "S2",
      completed_at: "",
    },
  ],
  followups: [
    {
      task_id: "t-1",
      candidate_id: "c-1",
      specialty: "A",
      study_level: "L1",
      current_status: "contacted_raw",
      last_activity_at: "2026-02-05",
      next_action: "Call",
      due_date: "2026-02-08",
      salesperson: "S1",
      completed_at: "",
    },
    {
      task_id: "t-2",
      candidate_id: "c-2",
      specialty: "B",
      study_level: "L2",
      current_status: "qualified_raw",
      last_activity_at: "2026-02-06",
      next_action: "Meeting",
      due_date: "2026-02-07",
      salesperson: "S2",
      completed_at: "2026-02-08",
    },
  ],
  targets: [
    { target_month: "2026-02", revenue_target: 200, enrollment_target: 2 },
  ],
});

test("empty table bundle is valid, while a missing table is rejected", () => {
  assert.equal(validateCommercialBundle(emptyCommercialBundle()).valid, true);
  const missing = emptyCommercialBundle();
  delete missing.payments;
  assert.equal(validateCommercialBundle(missing).valid, false);
  assert.match(validateCommercialBundle(missing).errors[0], /payments/);
});

test("unsupported fields are rejected so source PII cannot silently enter the view", () => {
  const bundle = baseBundle();
  bundle.candidates[0].extra_name_field = "synthetic test value";
  const report = validateCommercialBundle(bundle);
  assert.equal(report.valid, false);
  assert.ok(
    report.errors.some((error) => error.includes("unsupported fields")),
  );
});

test("an empty but schema-valid source reports factual zeros and unavailable targets", () => {
  const bundle = emptyCommercialBundle();
  bundle.config = {
    currency: "TND",
    collected_payment_statuses: ["paid"],
    confirmed_enrollment_statuses: ["confirmed"],
  };
  const summary = summarizeCommercialBundle(bundle, { asOf: "2026-02-20" });
  assert.equal(summary.valid, true);
  assert.equal(summary.activityCount, 0);
  assert.equal(summary.collectedRevenue, 0);
  assert.equal(summary.confirmedEnrollments, 0);
  assert.equal(summary.targetRevenue, null);
});

test("commercial KPIs count activities separately from candidate statuses", () => {
  const summary = summarizeCommercialBundle(baseBundle(), {
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    asOf: "2026-02-20",
  });
  assert.equal(summary.activityCount, 3);
  assert.equal(summary.candidateCount, 2);
  assert.deepEqual(
    summary.statusCounts.map((status) => status.count).sort(),
    [1, 1],
  );
});

test("collected revenue sums distinct partial payments, excluding pending and duplicate payment ids", () => {
  const bundle = baseBundle();
  bundle.payments.push({ ...bundle.payments[0] });
  const summary = summarizeCommercialBundle(bundle, {
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    asOf: "2026-02-20",
  });
  assert.equal(summary.collectedRevenue, 140);
  assert.equal(summary.revenueAchievement, 0.7);
  assert.equal(summary.remainingRevenueTarget, 60);
  assert.deepEqual(summary.monthlyRevenue, [{ month: "2026-02", value: 140 }]);
  assert.equal(summary.contractedRevenue, 900);
  assert.equal(summary.forecastRevenue, 600);
  assert.equal(summary.pendingAppointments, 1);
});

test("partial-month selections do not compare partial revenue with a full monthly target", () => {
  const summary = summarizeCommercialBundle(baseBundle(), {
    startDate: "2026-02-01",
    endDate: "2026-02-15",
    asOf: "2026-02-15",
  });
  assert.equal(summary.targetRevenue, null);
  assert.equal(summary.revenueAchievement, null);
  assert.ok(
    summary.monthlyRevenueTrend.every((month) => month.target === null),
  );
});

test("mixed currencies make revenue unavailable instead of combining unlike amounts", () => {
  const bundle = baseBundle();
  bundle.payments[1].currency = "EUR";
  const summary = summarizeCommercialBundle(bundle, {
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    asOf: "2026-02-20",
  });
  assert.equal(summary.currency, null);
  assert.equal(summary.collectedRevenue, null);
});

test("unmapped finance and enrollment statuses remain unavailable instead of appearing as zero", () => {
  const bundle = baseBundle();
  delete bundle.config.collected_payment_statuses;
  delete bundle.config.confirmed_enrollment_statuses;
  const summary = summarizeCommercialBundle(bundle, { asOf: "2026-02-20" });
  assert.equal(summary.collectedRevenue, null);
  assert.equal(summary.confirmedEnrollments, null);
  assert.equal(summary.postEnrollmentActivityCount, null);
});

test("confirmed enrollments count unique confirmed enrollment ids only", () => {
  const bundle = baseBundle();
  bundle.enrollments.push({ ...bundle.enrollments[0] });
  const summary = summarizeCommercialBundle(bundle, {
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    asOf: "2026-02-20",
  });
  assert.equal(summary.confirmedEnrollments, 1);
  assert.deepEqual(summary.enrollmentBySpecialty, [{ name: "A", count: 1 }]);
  assert.equal(summary.postEnrollmentActivityCount, 1);
});

test("status values stay raw until an explicit display mapping is configured", () => {
  assert.equal(
    mapSourceStatus("contacted_raw", { contacted_raw: "Contacté" }),
    "Contacté",
  );
  assert.equal(
    mapSourceStatus("unmapped_raw", {}),
    "À confirmer : unmapped_raw",
  );
  assert.equal(mapSourceStatus("", {}), "Non renseigné");
});

test("conversion uses distinct candidates entering a source stage in-period", () => {
  const result = calculateConversionRate(
    baseBundle().pipeline_events,
    "qualified_raw",
    "enrolled_raw",
    "2026-02-01",
    "2026-02-28",
  );
  assert.deepEqual(result, {
    fromStatus: "qualified_raw",
    toStatus: "enrolled_raw",
    entered: 2,
    converted: 1,
    rate: 0.5,
  });
  assert.equal(calculateConversionRate([], "a", "b"), null);
});

test("date filters derive an equal-length prior period and safe comparison rates", () => {
  assert.deepEqual(previousEquivalentPeriod("2026-02-01", "2026-02-28"), {
    startDate: "2026-01-04",
    endDate: "2026-01-31",
  });
  assert.equal(previousEquivalentPeriod("", "2026-02-28"), null);
  assert.equal(relativeChange(12, 10), 0.2);
  assert.equal(relativeChange(12, 0), null);
});

test("overdue means an explicit past due date and no completion timestamp", () => {
  const rows = baseBundle().followups;
  const overdue = getOverdueFollowups(rows, "2026-02-10");
  assert.equal(overdue.length, 1);
  assert.equal(overdue[0].task_id, "t-1");
  assert.equal(overdue[0].days_overdue, 2);
  assert.equal(
    filterOverdueFollowups(overdue, { salesperson: "S1", specialty: "A" })
      .length,
    1,
  );
});

test("a task completed after the report date was still overdue at that report date", () => {
  const task = {
    ...baseBundle().followups[1],
    due_date: "2026-02-03",
    completed_at: "2026-02-18",
  };
  assert.equal(getOverdueFollowups([task], "2026-02-10").length, 1);
  assert.equal(getOverdueFollowups([task], "2026-02-20").length, 0);
});

test("follow-up status filter distinguishes overdue, open, and completed tasks", () => {
  const records = getFollowupRecords(baseBundle().followups, "2026-02-10");
  assert.deepEqual(records.map((row) => row.followup_state).sort(), [
    "completed",
    "overdue",
  ]);
  assert.equal(
    filterOverdueFollowups(records, { overdueStatus: "completed" }).length,
    1,
  );
  assert.equal(
    filterOverdueFollowups(records, { overdueStatus: "all" }).length,
    2,
  );
});

test("invalid dates and malformed amounts are surfaced without crashing calculations", () => {
  const bundle = baseBundle();
  bundle.activities.push({
    ...bundle.activities[0],
    activity_id: "a-invalid",
    activity_date: "not-a-date",
  });
  bundle.payments.push({
    ...bundle.payments[0],
    payment_id: "p-invalid",
    amount: "NaN",
  });
  const quality = validateCommercialBundle(bundle);
  assert.equal(quality.valid, true);
  assert.ok(
    quality.warnings.some((warning) =>
      warning.includes("activity_date is invalid"),
    ),
  );
  assert.ok(
    quality.warnings.some((warning) =>
      warning.includes("amount is not numeric"),
    ),
  );
  const summary = summarizeCommercialBundle(bundle, {
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    asOf: "2026-02-20",
  });
  assert.equal(summary.activityCount, 3);
  assert.equal(summary.collectedRevenue, 140);
});

test("duplicate identifiers are warned and counted once", () => {
  const bundle = baseBundle();
  bundle.activities.push({ ...bundle.activities[0] });
  const report = validateCommercialBundle(bundle);
  assert.ok(
    report.warnings.some((warning) =>
      warning.includes("Duplicate activities.activity_id"),
    ),
  );
  assert.equal(
    summarizeCommercialBundle(bundle, { asOf: "2026-02-20" }).activityCount,
    3,
  );
});
