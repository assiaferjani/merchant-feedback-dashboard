import test from "node:test";
import assert from "node:assert/strict";
import { getDateRangeForPage, getDateRangePreset, isValidDateKey, isValidDateRange } from "../src/date-filters.js";

test("date ranges accept valid one-sided bounds and reject impossible or reversed ranges", () => {
  assert.equal(isValidDateRange({ startDate: "2025-01-01", endDate: "2025-01-31" }), true);
  assert.equal(isValidDateRange({ startDate: "2025-01-01" }), true);
  assert.equal(isValidDateRange({ endDate: "2025-01-31" }), true);
  assert.equal(isValidDateRange({}), true);
  assert.equal(isValidDateKey("2025-02-31"), false);
  assert.equal(isValidDateRange({ startDate: "2025-02-02", endDate: "2025-02-01" }), false);
  assert.equal(isValidDateRange({ startDate: "not-a-date" }), false);
});

test("period shortcuts use local calendar dates and inclusive day counts", () => {
  const now = new Date(2025, 0, 3, 23, 45, 0);
  assert.deepEqual(getDateRangePreset("7-days", now), { startDate: "2024-12-28", endDate: "2025-01-03" });
  assert.deepEqual(getDateRangePreset("30-days", now), { startDate: "2024-12-05", endDate: "2025-01-03" });
  assert.deepEqual(getDateRangePreset("month", now), { startDate: "2025-01-01", endDate: "2025-01-03" });
  assert.deepEqual(getDateRangePreset("year", now), { startDate: "2025-01-01", endDate: "2025-01-03" });
  assert.equal(getDateRangePreset("unknown", now), null);
});

test("30-day shortcut handles month lengths and leap dates", () => {
  assert.deepEqual(getDateRangePreset("30-days", new Date(2024, 2, 1)), { startDate: "2024-02-01", endDate: "2024-03-01" });
});

test("commercial and financial pages keep independent period selections", () => {
  const commercial = { startDate: "2025-01-01", endDate: "2025-01-31" };
  const financial = { startDate: "2025-03-01", endDate: "2025-03-31" };
  assert.equal(getDateRangeForPage("overview", commercial, financial), commercial);
  assert.equal(getDateRangeForPage("pipeline", commercial, financial), commercial);
  assert.equal(getDateRangeForPage("feedback", commercial, financial), commercial);
  assert.equal(getDateRangeForPage("report", commercial, financial), commercial);
  assert.equal(getDateRangeForPage("revenue", commercial, financial), financial);
});
