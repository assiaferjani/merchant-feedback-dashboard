/*
 * Normalized adapter contract for a future, owner-authorized commercial source.
 * The current feedback CSV intentionally does not satisfy this schema.
 */

export const COMMERCIAL_TABLE_FIELDS = Object.freeze({
  candidates: [
    "candidate_id",
    "created_at",
    "current_status",
    "specialty",
    "study_level",
    "salesperson",
  ],
  activities: ["activity_id", "candidate_id", "activity_date", "activity_type"],
  payments: [
    "payment_id",
    "candidate_id",
    "payment_date",
    "amount",
    "payment_status",
    "currency",
    "specialty",
    "study_level",
  ],
  contracts: [
    "contract_id",
    "candidate_id",
    "contract_date",
    "contract_amount",
    "contract_status",
    "currency",
    "specialty",
    "study_level",
  ],
  forecasts: [
    "forecast_id",
    "candidate_id",
    "forecast_date",
    "amount",
    "forecast_status",
    "currency",
    "specialty",
    "study_level",
  ],
  enrollments: [
    "enrollment_id",
    "candidate_id",
    "enrollment_date",
    "enrollment_status",
    "specialty",
    "study_level",
  ],
  pipeline_events: ["event_id", "candidate_id", "event_date", "status"],
  appointments: [
    "appointment_id",
    "candidate_id",
    "appointment_date",
    "appointment_status",
    "salesperson",
    "completed_at",
  ],
  followups: [
    "task_id",
    "candidate_id",
    "specialty",
    "study_level",
    "current_status",
    "last_activity_at",
    "next_action",
    "due_date",
    "salesperson",
    "completed_at",
  ],
  targets: ["target_month", "revenue_target", "enrollment_target"],
});

const COLLECTIONS = Object.keys(COMMERCIAL_TABLE_FIELDS);
const VALID_ID = (value) =>
  value !== null && value !== undefined && String(value).trim() !== "";
const finiteNumber = (value) =>
  value !== "" &&
  value !== null &&
  value !== undefined &&
  Number.isFinite(Number(value));

export function emptyCommercialBundle() {
  return Object.fromEntries(COLLECTIONS.map((name) => [name, []]));
}

export function validateCommercialBundle(bundle) {
  const errors = [];
  const warnings = [];
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    return {
      valid: false,
      errors: ["Commercial bundle must be a JSON object."],
      warnings,
    };
  }
  if (
    bundle.config !== undefined &&
    (!bundle.config ||
      typeof bundle.config !== "object" ||
      Array.isArray(bundle.config))
  )
    errors.push("config must be an object when present.");
  for (const name of [
    "collected_payment_statuses",
    "confirmed_enrollment_statuses",
    "conversion_stages",
  ]) {
    if (
      bundle.config?.[name] !== undefined &&
      !Array.isArray(bundle.config[name])
    )
      errors.push(`config.${name} must be an array.`);
  }
  if (
    bundle.config?.status_labels !== undefined &&
    (!bundle.config.status_labels ||
      typeof bundle.config.status_labels !== "object" ||
      Array.isArray(bundle.config.status_labels))
  )
    errors.push("config.status_labels must be an object.");
  for (const [index, step] of (
    bundle.config?.conversion_stages ?? []
  ).entries()) {
    if (!VALID_ID(step?.from) || !VALID_ID(step?.to))
      errors.push(
        `config.conversion_stages[${index}] needs confirmed from/to source statuses.`,
      );
  }
  for (const table of COLLECTIONS) {
    if (!Array.isArray(bundle[table])) {
      errors.push(
        `${table} must be present as an array, including when it has no rows.`,
      );
      continue;
    }
    const required = COMMERCIAL_TABLE_FIELDS[table];
    for (const [index, row] of bundle[table].entries()) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        errors.push(`${table}[${index}] must be an object.`);
        continue;
      }
      const missing = required.filter((field) => !(field in row));
      if (missing.length)
        errors.push(
          `${table}[${index}] is missing fields: ${missing.join(", ")}.`,
        );
      const unexpected = Object.keys(row).filter(
        (field) => !required.includes(field),
      );
      if (unexpected.length)
        errors.push(
          `${table}[${index}] has unsupported fields (${unexpected.join(", ")}); strip them in the adapter before loading.`,
        );
      const idField = required.find((field) => field.endsWith("_id"));
      if (idField && !VALID_ID(row[idField]))
        errors.push(`${table}[${index}] has an empty ${idField}.`);
      if (
        [
          "activities",
          "payments",
          "contracts",
          "forecasts",
          "enrollments",
          "pipeline_events",
          "appointments",
          "followups",
        ].includes(table) &&
        !VALID_ID(row.candidate_id)
      )
        errors.push(`${table}[${index}] has an empty candidate_id.`);
    }
  }
  for (const table of [
    "candidates",
    "activities",
    "payments",
    "contracts",
    "forecasts",
    "enrollments",
    "pipeline_events",
    "appointments",
    "followups",
  ]) {
    const idField = COMMERCIAL_TABLE_FIELDS[table].find((field) =>
      field.endsWith("_id"),
    );
    const seen = new Set();
    for (const row of bundle[table] ?? []) {
      const id = row?.[idField];
      if (!VALID_ID(id)) continue;
      if (seen.has(String(id)))
        warnings.push(
          `Duplicate ${table}.${idField} detected; calculations count the first row only.`,
        );
      seen.add(String(id));
    }
  }
  for (const table of [
    "candidates",
    "activities",
    "payments",
    "contracts",
    "forecasts",
    "enrollments",
    "pipeline_events",
    "appointments",
    "followups",
  ]) {
    const dateField = {
      candidates: "created_at",
      activities: "activity_date",
      payments: "payment_date",
      contracts: "contract_date",
      forecasts: "forecast_date",
      enrollments: "enrollment_date",
      pipeline_events: "event_date",
      appointments: "appointment_date",
      followups: "due_date",
    }[table];
    for (const [index, row] of (bundle[table] ?? []).entries()) {
      if (row?.[dateField] && !isValidDate(row[dateField]))
        warnings.push(
          `${table}[${index}].${dateField} is invalid and will be excluded from date-based metrics.`,
        );
      if (
        table === "followups" &&
        row?.completed_at &&
        !isValidDate(row.completed_at)
      )
        warnings.push(
          `followups[${index}].completed_at is invalid; completion timing cannot be verified.`,
        );
    }
  }
  for (const [index, row] of (bundle.payments ?? []).entries()) {
    if (row?.amount !== undefined && !finiteNumber(row.amount))
      warnings.push(
        `payments[${index}].amount is not numeric and will be excluded from revenue.`,
      );
    else if (row?.amount !== undefined && Number(row.amount) < 0)
      warnings.push(
        `payments[${index}].amount is negative; confirm whether refunds use a separate documented rule.`,
      );
  }
  for (const [table, amountField] of [
    ["contracts", "contract_amount"],
    ["forecasts", "amount"],
  ]) {
    for (const [index, row] of (bundle[table] ?? []).entries()) {
      if (row?.[amountField] !== undefined && !finiteNumber(row[amountField]))
        warnings.push(`${table}[${index}].${amountField} is not numeric.`);
      else if (row?.[amountField] !== undefined && Number(row[amountField]) < 0)
        warnings.push(
          `${table}[${index}].${amountField} is negative; confirm its business definition.`,
        );
    }
  }
  for (const [index, row] of (bundle.targets ?? []).entries()) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row?.target_month ?? ""))
      warnings.push(
        `targets[${index}].target_month is invalid and will be excluded.`,
      );
    for (const field of ["revenue_target", "enrollment_target"]) {
      if (row?.[field] !== undefined && !finiteNumber(row[field]))
        warnings.push(`targets[${index}].${field} is not numeric.`);
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function isValidDate(value) {
  if (value instanceof Date) return Number.isFinite(value.valueOf());
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value))
    return false;
  const time = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (!Number.isFinite(time)) return false;
  const datePart = value.slice(0, 10);
  return (
    new Date(`${datePart}T00:00:00Z`).toISOString().slice(0, 10) === datePart
  );
}

export function mapSourceStatus(rawStatus, statusLabels = {}) {
  if (!VALID_ID(rawStatus)) return "Non renseigné";
  return statusLabels[rawStatus] || `À confirmer : ${rawStatus}`;
}

function inPeriod(value, startDate, endDate) {
  if (!isValidDate(value)) return false;
  const date = String(value).slice(0, 10);
  return (!startDate || date >= startDate) && (!endDate || date <= endDate);
}

function uniqueFirst(rows = [], key) {
  const seen = new Set();
  return rows.filter((row) => {
    const value = row?.[key];
    if (!VALID_ID(value) || seen.has(String(value))) return false;
    seen.add(String(value));
    return true;
  });
}

function monthKey(value) {
  return String(value).slice(0, 7);
}

function isFullTargetMonth(month, startDate, endDate) {
  if (!/^\d{4}-\d{2}$/.test(month)) return false;
  const first = `${month}-01`;
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const last = new Date(Date.UTC(year, monthNumber, 0))
    .toISOString()
    .slice(0, 10);
  return (!startDate || startDate <= first) && (!endDate || endDate >= last);
}

function aggregateByMonth(rows, dateField, valueFn) {
  const totals = new Map();
  for (const row of rows) {
    if (!inPeriod(row[dateField])) continue;
    const value = valueFn(row);
    if (!Number.isFinite(value)) continue;
    const key = monthKey(row[dateField]);
    totals.set(key, (totals.get(key) ?? 0) + value);
  }
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, value }));
}

function groupCount(rows, field, idField) {
  const groups = new Map();
  for (const row of uniqueFirst(rows, idField)) {
    const name = VALID_ID(row[field]) ? String(row[field]) : "Non renseigné";
    groups.set(name, (groups.get(name) ?? 0) + 1);
  }
  return [...groups]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function filterRowsByPeriod(
  rows = [],
  dateField,
  startDate = "",
  endDate = "",
) {
  return rows.filter((row) => inPeriod(row[dateField], startDate, endDate));
}

export function previousEquivalentPeriod(startDate, endDate) {
  if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate)
    return null;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const dayCount = Math.floor((end - start) / 86400000) + 1;
  const previousEnd = new Date(start - 86400000).toISOString().slice(0, 10);
  const previousStart = new Date(start - dayCount * 86400000)
    .toISOString()
    .slice(0, 10);
  return { startDate: previousStart, endDate: previousEnd };
}

export function relativeChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0)
    return null;
  return (current - previous) / Math.abs(previous);
}

export function calculateConversionRate(
  events = [],
  fromStatus,
  toStatus,
  startDate = "",
  endDate = "",
) {
  if (!fromStatus || !toStatus) return null;
  const rows = uniqueFirst(events, "event_id").filter((row) =>
    isValidDate(row.event_date),
  );
  const entries = new Map();
  for (const row of rows) {
    const timestamp = Date.parse(row.event_date);
    if (
      row.status === fromStatus &&
      inPeriod(row.event_date, startDate, endDate) &&
      (!entries.has(row.candidate_id) ||
        timestamp < entries.get(row.candidate_id))
    ) {
      entries.set(row.candidate_id, timestamp);
    }
  }
  if (!entries.size) return null;
  const converted = new Set(
    rows
      .filter((row) => row.status === toStatus)
      .filter(
        (row) =>
          entries.has(row.candidate_id) &&
          Date.parse(row.event_date) >= entries.get(row.candidate_id),
      )
      .map((row) => row.candidate_id),
  );
  return {
    fromStatus,
    toStatus,
    entered: entries.size,
    converted: converted.size,
    rate: converted.size / entries.size,
  };
}

export function getOverdueFollowups(
  rows = [],
  asOf = new Date().toISOString().slice(0, 10),
) {
  return getFollowupRecords(rows, asOf).filter(
    (row) => row.followup_state === "overdue",
  );
}

export function getFollowupRecords(
  rows = [],
  asOf = new Date().toISOString().slice(0, 10),
) {
  if (!isValidDate(asOf)) return [];
  return uniqueFirst(rows, "task_id")
    .filter((row) => isValidDate(row.due_date))
    .map((row) => {
      const completedByAsOf =
        isValidDate(row.completed_at) &&
        String(row.completed_at).slice(0, 10) <= asOf;
      const isOverdue =
        !completedByAsOf && String(row.due_date).slice(0, 10) < asOf;
      return {
        ...row,
        followup_state: completedByAsOf
          ? "completed"
          : isOverdue
            ? "overdue"
            : "open",
        days_overdue: isOverdue
          ? Math.floor(
              (Date.parse(`${asOf}T00:00:00Z`) -
                Date.parse(`${String(row.due_date).slice(0, 10)}T00:00:00Z`)) /
                86400000,
            )
          : 0,
      };
    })
    .sort((a, b) => b.days_overdue - a.days_overdue);
}

export function filterOverdueFollowups(
  rows,
  {
    salesperson = "",
    specialty = "",
    startDate = "",
    endDate = "",
    overdueStatus = "overdue",
  } = {},
) {
  return rows.filter(
    (row) =>
      (!salesperson || row.salesperson === salesperson) &&
      (!specialty || row.specialty === specialty) &&
      (!overdueStatus ||
        overdueStatus === "all" ||
        row.followup_state === overdueStatus) &&
      inPeriod(row.due_date, startDate, endDate),
  );
}

export function summarizeCommercialBundle(bundle, options = {}) {
  const {
    startDate = "",
    endDate = "",
    asOf = endDate || new Date().toISOString().slice(0, 10),
    collectedPaymentStatuses = bundle?.config?.collected_payment_statuses,
    confirmedEnrollmentStatuses = bundle?.config?.confirmed_enrollment_statuses,
    statusLabels = bundle?.config?.status_labels ?? {},
    conversionStages = bundle?.config?.conversion_stages ?? [],
  } = options;
  const report = validateCommercialBundle(bundle);
  if (!report.valid)
    return { valid: false, errors: report.errors, warnings: report.warnings };

  const candidates = uniqueFirst(bundle.candidates, "candidate_id");
  const periodCandidates = candidates.filter((row) =>
    inPeriod(row.created_at, startDate, endDate),
  );
  const activities = uniqueFirst(bundle.activities, "activity_id").filter(
    (row) => inPeriod(row.activity_date, startDate, endDate),
  );
  // Each unique payment id is one payment/installment. Distinct partial payments for a candidate are all included.
  const hasCollectedStatuses =
    Array.isArray(collectedPaymentStatuses) &&
    collectedPaymentStatuses.length > 0;
  const hasConfirmedEnrollmentStatuses =
    Array.isArray(confirmedEnrollmentStatuses) &&
    confirmedEnrollmentStatuses.length > 0;
  const contractedStatuses = bundle.config?.contracted_revenue_statuses;
  const forecastStatuses = bundle.config?.forecast_revenue_statuses;
  const pendingAppointmentStatuses =
    bundle.config?.pending_appointment_statuses;
  const hasContractedStatuses =
    Array.isArray(contractedStatuses) && contractedStatuses.length > 0;
  const hasForecastStatuses =
    Array.isArray(forecastStatuses) && forecastStatuses.length > 0;
  const hasPendingAppointmentStatuses =
    Array.isArray(pendingAppointmentStatuses) &&
    pendingAppointmentStatuses.length > 0;
  const allPayments = uniqueFirst(bundle.payments, "payment_id");
  const payments = allPayments.filter(
    (row) =>
      inPeriod(row.payment_date, startDate, endDate) &&
      hasCollectedStatuses &&
      collectedPaymentStatuses.includes(row.payment_status) &&
      finiteNumber(row.amount) &&
      Number(row.amount) >= 0,
  );
  const contracts = uniqueFirst(bundle.contracts, "contract_id").filter(
    (row) =>
      inPeriod(row.contract_date, startDate, endDate) &&
      hasContractedStatuses &&
      contractedStatuses.includes(row.contract_status) &&
      finiteNumber(row.contract_amount) &&
      Number(row.contract_amount) >= 0,
  );
  const forecasts = uniqueFirst(bundle.forecasts, "forecast_id").filter(
    (row) =>
      inPeriod(row.forecast_date, startDate, endDate) &&
      hasForecastStatuses &&
      forecastStatuses.includes(row.forecast_status) &&
      finiteNumber(row.amount) &&
      Number(row.amount) >= 0,
  );
  const enrollments = uniqueFirst(bundle.enrollments, "enrollment_id").filter(
    (row) =>
      inPeriod(row.enrollment_date, startDate, endDate) &&
      hasConfirmedEnrollmentStatuses &&
      confirmedEnrollmentStatuses.includes(row.enrollment_status),
  );
  const appointmentsAll = uniqueFirst(
    bundle.appointments,
    "appointment_id",
  ).filter((row) => inPeriod(row.appointment_date, startDate, endDate));
  const appointments = hasPendingAppointmentStatuses
    ? appointmentsAll.filter((row) =>
        pendingAppointmentStatuses.includes(row.appointment_status),
      )
    : [];
  const followups = filterOverdueFollowups(
    getOverdueFollowups(bundle.followups, asOf),
    { startDate, endDate },
  );
  const targets = bundle.targets.filter((row) =>
    isFullTargetMonth(row.target_month, startDate, endDate),
  );
  const monetaryRows = [
    ...allPayments,
    ...uniqueFirst(bundle.contracts, "contract_id"),
    ...uniqueFirst(bundle.forecasts, "forecast_id"),
  ];
  const currencyCodes = [
    ...new Set(
      (bundle.config?.currency
        ? [bundle.config.currency]
        : monetaryRows.map((row) => String(row.currency ?? "").trim())
      ).filter(Boolean),
    ),
  ];
  const currency =
    currencyCodes.length === 1 &&
    monetaryRows.every(
      (row) => !row.currency || row.currency === currencyCodes[0],
    )
      ? currencyCodes[0]
      : null;
  const collectedRevenue =
    currency && hasCollectedStatuses
      ? payments.reduce((sum, row) => sum + Number(row.amount), 0)
      : null;
  const contractedRevenue =
    currency && hasContractedStatuses
      ? contracts.reduce((sum, row) => sum + Number(row.contract_amount), 0)
      : null;
  const forecastRevenue =
    currency && hasForecastStatuses
      ? forecasts.reduce((sum, row) => sum + Number(row.amount), 0)
      : null;
  const targetRevenue =
    targets.length &&
    targets.every(
      (row) =>
        finiteNumber(row.revenue_target) && Number(row.revenue_target) >= 0,
    )
      ? targets.reduce((sum, row) => sum + Number(row.revenue_target), 0)
      : null;
  const targetMonths = new Set(
    targetRevenue !== null ? targets.map((row) => row.target_month) : [],
  );
  const revenueForTargetMonths = payments
    .filter((row) => targetMonths.has(monthKey(row.payment_date)))
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const confirmedCount = enrollments.length;
  const enrollmentTarget =
    targets.length &&
    targets.every(
      (row) =>
        finiteNumber(row.enrollment_target) &&
        Number(row.enrollment_target) >= 0,
    )
      ? targets.reduce((sum, row) => sum + Number(row.enrollment_target), 0)
      : null;
  const statusCounts = groupCount(
    periodCandidates,
    "current_status",
    "candidate_id",
  ).map((item) => ({
    ...item,
    label: mapSourceStatus(item.name, statusLabels),
  }));
  const candidateIdsWithFollowup = new Set(
    followups.map((row) => row.candidate_id),
  );
  const enrollmentDateByCandidate = new Map();
  enrollments.forEach((row) => {
    if (!row.candidate_id || !isValidDate(row.enrollment_date)) return;
    const known = enrollmentDateByCandidate.get(row.candidate_id);
    if (!known || row.enrollment_date < known)
      enrollmentDateByCandidate.set(row.candidate_id, row.enrollment_date);
  });
  return {
    valid: true,
    warnings: report.warnings,
    activityCount: activities.length,
    collectedRevenue,
    targetRevenue,
    currency,
    revenueAchievement:
      targetRevenue > 0 && collectedRevenue !== null
        ? revenueForTargetMonths / targetRevenue
        : null,
    remainingRevenueTarget:
      targetRevenue > 0 && collectedRevenue !== null
        ? Math.max(0, targetRevenue - revenueForTargetMonths)
        : null,
    contractedRevenue,
    forecastRevenue,
    confirmedEnrollments: hasConfirmedEnrollmentStatuses
      ? confirmedCount
      : null,
    pendingAppointments: hasPendingAppointmentStatuses
      ? appointments.length
      : null,
    appointmentStatusCounts: groupCount(
      appointmentsAll,
      "appointment_status",
      "appointment_id",
    ).map((item) => ({
      ...item,
      label: mapSourceStatus(item.name, statusLabels),
    })),
    enrollmentTarget,
    enrollmentAchievement:
      enrollmentTarget > 0 ? confirmedCount / enrollmentTarget : null,
    monthlyRevenue: currency
      ? aggregateByMonth(payments, "payment_date", (row) => Number(row.amount))
      : [],
    monthlyContractedRevenue: currency
      ? aggregateByMonth(contracts, "contract_date", (row) =>
          Number(row.contract_amount),
        )
      : [],
    monthlyForecastRevenue: currency
      ? aggregateByMonth(forecasts, "forecast_date", (row) =>
          Number(row.amount),
        )
      : [],
    monthlyRevenueTargets: targets.map((row) => ({
      month: row.target_month,
      value: finiteNumber(row.revenue_target)
        ? Number(row.revenue_target)
        : null,
    })),
    monthlyRevenueTrend: [
      ...new Set([
        ...payments.map((row) => monthKey(row.payment_date)),
        ...contracts.map((row) => monthKey(row.contract_date)),
        ...forecasts.map((row) => monthKey(row.forecast_date)),
        ...targets.map((row) => row.target_month),
      ]),
    ]
      .sort()
      .map((month) => ({
        month,
        collected:
          hasCollectedStatuses && currency
            ? payments
                .filter((row) => monthKey(row.payment_date) === month)
                .reduce((sum, row) => sum + Number(row.amount), 0)
            : null,
        contracted:
          currency && hasContractedStatuses
            ? contracts
                .filter((row) => monthKey(row.contract_date) === month)
                .reduce((sum, row) => sum + Number(row.contract_amount), 0)
            : null,
        forecast:
          currency && hasForecastStatuses
            ? forecasts
                .filter((row) => monthKey(row.forecast_date) === month)
                .reduce((sum, row) => sum + Number(row.amount), 0)
            : null,
        target:
          currency &&
          targetRevenue !== null &&
          targets.some((row) => row.target_month === month)
            ? targets
                .filter((row) => row.target_month === month)
                .reduce((sum, row) => sum + Number(row.revenue_target), 0)
            : null,
      })),
    monthlyActivities: aggregateByMonth(activities, "activity_date", () => 1),
    postEnrollmentActivityCount: hasConfirmedEnrollmentStatuses
      ? activities.filter(
          (row) =>
            enrollmentDateByCandidate.has(row.candidate_id) &&
            row.activity_date >=
              enrollmentDateByCandidate.get(row.candidate_id),
        ).length
      : null,
    monthlyEnrollments: aggregateByMonth(
      enrollments,
      "enrollment_date",
      () => 1,
    ),
    enrollmentBySpecialty: groupCount(
      enrollments,
      "specialty",
      "enrollment_id",
    ),
    enrollmentByStudyLevel: groupCount(
      enrollments,
      "study_level",
      "enrollment_id",
    ),
    revenueBySpecialty: groupCount(payments, "specialty", "payment_id")
      .map((entry) => ({
        ...entry,
        amount: payments
          .filter((row) => (row.specialty || "Non renseigné") === entry.name)
          .reduce((sum, row) => sum + Number(row.amount), 0),
      }))
      .sort((a, b) => b.amount - a.amount),
    revenueByStudyLevel: groupCount(payments, "study_level", "payment_id")
      .map((entry) => ({
        ...entry,
        amount: payments
          .filter((row) => (row.study_level || "Non renseigné") === entry.name)
          .reduce((sum, row) => sum + Number(row.amount), 0),
      }))
      .sort((a, b) => b.amount - a.amount),
    statusCounts,
    overdueFollowups: followups,
    overdueCandidateCount: candidateIdsWithFollowup.size,
    pipelineConversion: conversionStages.map(({ from, to }) =>
      calculateConversionRate(
        bundle.pipeline_events,
        from,
        to,
        startDate,
        endDate,
      ),
    ),
    candidateCount: periodCandidates.length,
    period: { startDate, endDate },
  };
}

export function csvCell(value) {
  let text = String(value ?? "");
  // Finite numeric values remain numeric; untrusted formula-like text is inert
  // in the spreadsheet export. Delimiters and quotes are escaped separately.
  if (
    typeof value !== "number" &&
    (/^[\s\u0000-\u001f]*[=+\-@＝＋－＠]/u.test(text) || /^[\t\r\n]/.test(text))
  )
    text = `\t${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(rows, columns) {
  const quote = csvCell;
  return [
    columns.map((column) => quote(column.label)).join(";"),
    ...rows.map((row) =>
      columns.map((column) => quote(row[column.key])).join(";"),
    ),
  ].join("\r\n");
}
