import { test } from "node:test";
import assert from "node:assert/strict";
import { asOf, digestUsage, headline, level, parseGpu, parseUsage, resetText, short, span, tooltip } from "./quota.js";

const NOW = Date.parse("2026-11-12T10:10:00Z");
const SAMPLE = [
  { providerId: "claude", displayName: "Claude", plan: "Team 5x", fetchedAt: "2026-11-12T10:08:12Z", lines: [
    { type: "progress", label: "Session", used: 2, limit: 100, format: { kind: "percent" }, resetsAt: "2026-11-12T14:52:00Z", periodDurationMs: 18000000 },
    { type: "progress", label: "Weekly", used: 27, limit: 100, format: { kind: "percent" }, resetsAt: "2026-11-14T06:10:00Z" },
    { type: "progress", label: "Extra usage spent", used: 0, limit: 100, format: { kind: "dollars" } },
    { type: "text", label: "Today", value: "$3.59 · 6.2M tokens" },
    { type: "barChart", label: "Usage Trend", points: [{ value: 1 }, { value: 4 }] },
  ] },
  { providerId: "codex", displayName: "Codex", plan: "Go", source: "last Codex turn", fetchedAt: "2026-11-12T09:00:00Z", lines: [
    { type: "progress", label: "Session", used: 22, limit: 100, format: { kind: "percent" }, resetsAt: "2026-12-03T11:50:34Z" },
  ] },
];

test("every wanted provider gets a slot, and a missing one says so", () => {
  const slots = parseUsage(SAMPLE, NOW);
  assert.deepEqual(slots.map((s) => [s.id, s.missing]), [["claude", false], ["codex", false], ["grok", true]]);
  assert.match(tooltip(slots[2], NOW), /nothing local to read/);
  assert.equal(parseUsage(null, NOW).every((s) => s.missing), true);
});

test("meters read as what is left, like the menu bar app", () => {
  const [claude] = parseUsage(SAMPLE, NOW);
  assert.deepEqual(claude.meters.map((m) => m.leftText), ["98% left", "73% left", "$100.00 left"]);
  assert.equal(claude.meters[2].limitText, "$100 limit");
  assert.deepEqual(headline(claude).map((m) => short(m.label)), ["S", "W"]);
  assert.equal(resetText(claude.meters[0], NOW), "Resets in 4h 42m");
  assert.equal(resetText(claude.meters[1], NOW), "Resets in 1d 20h");
  assert.deepEqual(claude.trend, [1, 4]);
  assert.deepEqual(claude.facts, [{ label: "Today", value: "$3.59 · 6.2M tokens" }]);
});

test("old data is marked stale and says where and when it was read", () => {
  const [claude, codex] = parseUsage(SAMPLE, NOW);
  assert.equal(claude.stale, false);
  assert.equal(codex.stale, true);
  assert.match(tooltip(codex, NOW), /from last Codex turn, 1h 10m ago/);
  assert.equal(asOf(parseUsage([], NOW)[0], NOW), "");
  assert.equal(short("Monthly"), "M");
});

test("levels warn at 30% left and turn critical at 10%", () => {
  assert.equal(level(73), "ok");
  assert.equal(level(30), "warn");
  assert.equal(level(9), "critical");
  assert.equal(level(null), "none");
  assert.equal(span(59 * 60000), "59m");
  assert.equal(span(21 * 86400000 + 3600000), "21d 1h");
});

test("the GPU reading comes from the accelerator's utilization", () => {
  assert.equal(parseGpu('"PerformanceStatistics" = {"Renderer Utilization %"=27,"Device Utilization %"=28}'), 28);
  assert.equal(parseGpu("nothing"), null);
  assert.notEqual(digestUsage(parseUsage(SAMPLE, NOW)), digestUsage(parseUsage([], NOW)));
});
