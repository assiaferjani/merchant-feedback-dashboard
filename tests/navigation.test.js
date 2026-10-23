import test from "node:test";
import assert from "node:assert/strict";
import {
  NAV,
  dashboardPageFromHash,
  dashboardPageHash,
} from "../src/navigation.js";

test("every dashboard page has a stable reloadable URL", () => {
  for (const page of [...NAV.map(({ id }) => id), "feedback"]) {
    assert.equal(dashboardPageFromHash(dashboardPageHash(page)), page);
  }
});

test("unknown routes fall back to overview without accepting arbitrary page IDs", () => {
  assert.equal(dashboardPageFromHash("#/unknown"), "overview");
  assert.equal(dashboardPageFromHash("#/feedback/unknown"), "overview");
  assert.equal(dashboardPageHash("unknown"), "#/overview");
  assert.equal(dashboardPageFromHash(""), "overview");
});

test("ordinary page anchors keep the current dashboard page", () => {
  assert.equal(dashboardPageFromHash("#main-content"), null);
});
