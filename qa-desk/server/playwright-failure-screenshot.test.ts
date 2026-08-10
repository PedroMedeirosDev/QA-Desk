/**
 * Smoke: findLatestPlaywrightFailureScreenshot picks newest test-failed*.png
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findLatestPlaywrightFailureScreenshot } from "./playwright-run.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "pw-fail-png-"));
const results = path.join(root, "test-results", "suite-a");
fs.mkdirSync(results, { recursive: true });

const older = path.join(results, "test-failed-1.png");
const newer = path.join(results, "test-failed-2.png");
fs.writeFileSync(older, "old");
// ensure newer mtime
fs.writeFileSync(newer, "new");
const t0 = Date.now();
fs.utimesSync(older, new Date(t0 - 10_000), new Date(t0 - 10_000));
fs.utimesSync(newer, new Date(t0), new Date(t0));

assert.equal(findLatestPlaywrightFailureScreenshot(root), newer);
assert.equal(findLatestPlaywrightFailureScreenshot(path.join(root, "missing")), null);

fs.rmSync(root, { recursive: true, force: true });
console.log("playwright failure screenshot helper ok");
