import test from "node:test";
import assert from "node:assert/strict";
import { readPreference } from "../src/view-preferences.js";

test("corrupt or unavailable preference storage cannot prevent opening the app", () => {
  const fallback = { startDate: "", endDate: "" };
  assert.deepEqual(
    readPreference("period", fallback, {
      getItem() {
        throw Error();
      },
    }),
    fallback,
  );
  assert.deepEqual(
    readPreference("period", fallback, { getItem: () => "invalid JSON" }),
    fallback,
  );
});

test("restored preferences retain only expected fields and value types", () => {
  const result = readPreference(
    "filters",
    { region: "", category: "" },
    {
      getItem: () =>
        JSON.stringify({ region: "Nord", category: 22, unexpected: "ignored" }),
    },
  );
  assert.deepEqual(result, { region: "Nord", category: "" });
});

test("invalid stored date ranges and unsupported currencies restore safely", () => {
  const fallback = { startDate: "", endDate: "" };
  assert.deepEqual(
    readPreference("commercial-period", fallback, {
      getItem: () => JSON.stringify({ startDate: "wrong", endDate: "" }),
    }),
    fallback,
  );
  assert.deepEqual(
    readPreference("financial-period", fallback, {
      getItem: () =>
        JSON.stringify({ startDate: "2026-03-01", endDate: "2026-01-01" }),
    }),
    fallback,
  );
  assert.equal(
    readPreference(
      "settings",
      { currency: "" },
      { getItem: () => JSON.stringify({ currency: "not-a-currency" }) },
    ).currency,
    "",
  );
});
