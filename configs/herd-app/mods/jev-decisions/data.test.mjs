import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  buildWindow, classify, firstLine, historyPath, labelSources, matches, parseDiscovery, parseLadder,
  parseLaya, parseOutcomeEvidence, relTime, sourceLabel, summarize,
} from "./data.js";

let failed = 0;
function test(name, body) {
  try {
    body();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failed++;
    console.log(`  FAIL ${name}\n       ${error.message.split("\n").join("\n       ")}`);
  }
}

const decisionRow = (id, decision, extra = {}) => JSON.stringify({
  kind: "decision", decision_id: id, timestamp: extra.timestamp ?? "2026-11-11T14:25:19Z",
  context: { decision_type: decision.decision_type ?? "tier-selection", metadata: { source: "main-turn" }, task: { request: extra.request ?? "do it" } },
  decision: { decision_id: id, decision_type: "tier-selection", action: "complex", confidence: 0.6, fork: "split", outputs: {}, ...decision },
});
const outcomeRow = (id, outcome, evidence, timestamp = "2026-11-11T14:26:00Z") =>
  JSON.stringify({ kind: "outcome", decision_id: id, outcome, evidence: [evidence], timestamp });

const LADDER = "jev unavailable or rejected: confidence 0.460 is below 0.650; agrees: complex; cloudflare:clef-flash unavailable or rejected: confidence 0.005 is below 0.850; dissents: mechanical; ollama:clef-flash unavailable or rejected: Ollama is not reachable at http://127.0.0.1:11434 ([Errno 61] Connection refused); start it with `ollama serve`";

console.log("fixtures");

test("a multi-backend fallback reason splits into one rung per backend, keeping free-text tails", () => {
  const rungs = parseLadder(LADDER);
  assert.deepEqual(rungs.map((r) => [r.backend, r.model]), [["jev", null], ["cloudflare", "clef-flash"], ["ollama", "clef-flash"]]);
  assert.deepEqual([rungs[0].confidence, rungs[0].floor, rungs[0].stance, rungs[0].wanted], [0.46, 0.65, "agrees", "complex"]);
  assert.deepEqual([rungs[1].confidence, rungs[1].floor, rungs[1].stance, rungs[1].wanted], [0.005, 0.85, "dissents", "mechanical"]);
  assert.equal(rungs[2].unavailable, true);
  assert.equal(rungs[2].confidence, null);
  assert.match(rungs[2].reason, /start it with `ollama serve`$/);
});

test("a timeout or HTTP error is an unavailable rung with no confidence", () => {
  const [timeout] = parseLadder("jev unavailable or rejected: inference exceeded 8000 ms");
  assert.deepEqual([timeout.backend, timeout.unavailable, timeout.confidence], ["jev", true, null]);
  const [http] = parseLadder('jev unavailable or rejected: jev returned HTTP 503: {"detail":{"error_type":"system_overloaded","message":"We are busy; retry"}}');
  assert.equal(http.unavailable, true);
  assert.match(http.reason, /retry"}}$/);
});

test("every fork lands in exactly one verdict class", () => {
  assert.equal(classify({ backend: "jev", fork: "sharp" }), "jev");
  assert.equal(classify({ backend: "deterministic-fallback", fallback_reason: "jev unavailable or rejected: confidence 0.080 is below 0.650" }), "overruled");
  assert.equal(classify({ backend: "deterministic-fallback", fallback_reason: null, outputs: { dissent: ["jev"] } }), "overruled");
  assert.equal(classify({ backend: "deterministic-fallback", fallback_reason: null, outputs: { margins: { jev: 0.2 } } }), "overruled");
  assert.equal(classify({ backend: "deterministic", fork: "sharp" }), "rules");
  assert.equal(classify({ backend: "cloudflare", fork: "sharp" }), "model");
  assert.equal(classify({}), "rules");
});

test("an overruled row reads Jev's confidence from the reason, not the rules' confidence", () => {
  const text = decisionRow("dec_a", { backend: "deterministic-fallback", confidence: 0.6, fallback_reason: "jev unavailable or rejected: confidence 0.080 is below 0.650; dissents: mechanical", outputs: { dissent: ["jev"], margins: { jev: 0.08 } } });
  const [d] = buildWindow(text).decisions;
  assert.equal(d.verdict, "overruled");
  assert.deepEqual([d.confidence, d.jev.confidence, d.jev.floor, d.jev.stance, d.jev.wanted], [0.6, 0.08, 0.65, "dissents", "mechanical"]);
});

test("the window orders by file position, joins outcomes, and drops outcomes whose decision is outside it", () => {
  const text = [
    outcomeRow("dec_gone", "answer", "actual=claude-opus-5-5 recommended=opus usd=9.0000"),
    decisionRow("dec_old", { backend: "deterministic", fork: "sharp" }),
    decisionRow("dec_new", { backend: "jev", fork: "sharp", confidence: 0.7 }),
    outcomeRow("dec_old", "answer", "actual=claude-opus-5-5 recommended=opus usd=1.2500"),
    outcomeRow("dec_old", "aborted", "actual=claude-sonnet-5-5 recommended= usd=0.5000"),
    '{"kind": "decision", "decision_id": "dec_cut", "context": {"task": {"requ',
  ].join("\n");
  const window = buildWindow(text);
  assert.deepEqual(window.decisions.map((d) => d.id), ["dec_new", "dec_old"]);
  assert.equal(window.bad, 1);
  assert.equal(window.orphans, 1);
  const old = window.decisions[1];
  assert.deepEqual([old.outcome.outcome, old.outcome.actual, old.outcome.recommended, old.outcome.turns, old.outcome.usd, old.outcome.spendUsd, old.outcome.running], ["aborted", "claude-sonnet-5-5", null, 2, 0.5, 1.75, false]);
  assert.equal(window.decisions[0].outcome, null);
});

test("stats count decisions, exclude an unavailable Jev from acceptance and the average, and sum every turn's usd", () => {
  const text = [
    decisionRow("d1", { backend: "jev", fork: "sharp", confidence: 0.8 }),
    decisionRow("d2", { backend: "deterministic-fallback", fallback_reason: "jev unavailable or rejected: confidence 0.400 is below 0.650" }),
    decisionRow("d3", { backend: "deterministic-fallback", fallback_reason: "jev unavailable or rejected: inference exceeded 8000 ms" }),
    decisionRow("d4", { backend: "deterministic", fork: "sharp" }),
    outcomeRow("d1", "answer", "actual=claude-opus-5-5 recommended=opus usd=1.0000"),
    outcomeRow("d1", "answer", "actual=claude-opus-5-5 recommended=opus usd=2.0000"),
    outcomeRow("d2", "answer", "actual=claude-sonnet-5-5 recommended=opus usd=0.5000"),
    outcomeRow("d4", "aborted", "actual=claude-sonnet-5-5 recommended= usd=0.0000"),
  ].join("\n");
  const s = summarize(buildWindow(text).decisions);
  assert.deepEqual(s.byVerdict, { jev: 1, overruled: 2, rules: 1, model: 0 });
  assert.equal(s.unavailable, 1);
  assert.equal(s.acceptance, 0.5);
  assert.ok(Math.abs(s.avgJevConfidence - 0.6) < 1e-9, String(s.avgJevConfidence));
  assert.equal(s.usd, 3.5);
  assert.equal(s.turns, 4);
  assert.equal(s.aborted, 1);
  assert.equal(s.pending, 1);
  assert.deepEqual([s.agreement, s.compared], [0.5, 2]);
});

test("an agent's outcomes report its running total: the latest is its spend, and turn spend leaves it out", () => {
  const agentRow = (id) => decisionRow(id, { backend: "deterministic", fork: "sharp" }).replace('"source":"main-turn"', '"source":"agent-spawn"');
  const text = [
    agentRow("a1"),
    decisionRow("m1", { backend: "deterministic", fork: "sharp" }),
    outcomeRow("a1", "answer", "actual=claude-opus-5-5 recommended=opus usd=30.0000"),
    outcomeRow("m1", "answer", "actual=claude-opus-5-5 recommended=opus usd=0.5000"),
    outcomeRow("a1", "answer", "actual=claude-opus-5-5 recommended=opus usd=42.0000"),
  ].join("\n");
  const { decisions } = buildWindow(text);
  const agent = decisions.find((d) => d.id === "a1");
  assert.deepEqual([agent.outcome.running, agent.outcome.turns, agent.outcome.spendUsd], [true, 2, 42]);
  const s = summarize(decisions);
  assert.deepEqual([s.usd, s.turns, s.agentRuns, s.agentPeakUsd], [0.5, 1, 1, 42]);
});

test("outcome evidence parses actual, recommended and usd, treating blanks and ? as missing", () => {
  assert.deepEqual(parseOutcomeEvidence(["actual=claude-sonnet-5-5 recommended=sonnet usd=0.5982"]), { actual: "claude-sonnet-5-5", recommended: "sonnet", usd: 0.5982 });
  assert.deepEqual(parseOutcomeEvidence(["actual=? recommended= usd=0.0000"]), { actual: null, recommended: null, usd: 0 });
  assert.deepEqual(parseOutcomeEvidence([]), { actual: null, recommended: null, usd: null });
});

test("filters combine verdict, type and fork", () => {
  const d = { verdict: "overruled", type: "tier-selection", fork: "split" };
  assert.equal(matches(d, { verdict: "all", type: "all", fork: "all" }), true);
  assert.equal(matches(d, { verdict: "overruled", type: "tier-selection", fork: "split" }), true);
  assert.equal(matches(d, { verdict: "jev", type: "all", fork: "all" }), false);
  assert.equal(matches(d, { verdict: "all", type: "grooming", fork: "all" }), false);
  assert.equal(matches(d, { verdict: "all", type: "all", fork: "sharp" }), false);
});

test("sources resolve repo roots and read as repo or repo · worktree", () => {
  const ttg = "/Users/example/projects/ttg/.claude/vistack/decision-history.jsonl";
  assert.equal(historyPath("/Users/example/projects/ttg/"), ttg);
  assert.equal(historyPath(ttg), ttg);
  assert.equal(sourceLabel(ttg), "ttg");
  assert.equal(sourceLabel("/x/ttg/repos/portal/.claude/worktrees/transactions-search-states/.claude/vistack/decision-history.jsonl"), "portal · transactions-search-states");
  assert.equal(sourceLabel("/Users/v/.herdr/worktrees/portal/fix-login/.claude/vistack/decision-history.jsonl"), "portal · fix-login");
  const labels = labelSources(["/a/app/.claude/vistack/decision-history.jsonl", "/b/app/.claude/vistack/decision-history.jsonl"]);
  assert.deepEqual(labels, ["a/app", "b/app"]);
});

test("discovery output dedupes paths and sorts newest first", () => {
  const found = parseDiscovery("100\t/a.jsonl\n300\t/b.jsonl\n200\t/a.jsonl\nnoise\n");
  assert.deepEqual(found, [{ path: "/b.jsonl", mtime: 300000 }, { path: "/a.jsonl", mtime: 200000 }]);
});

test("laya.json reads the switch and the Ollama model, and tolerates junk", () => {
  assert.deepEqual(parseLaya('{"enabled": true, "ollama_model": "nimble", "schema_version": 1}'), { enabled: true, model: "nimble" });
  assert.equal(parseLaya("{"), null);
  assert.equal(parseLaya(null), null);
});

test("a request's first line skips wrapper tags, code fences and a colon lead-in", () => {
  assert.equal(firstLine('\n\n<pasted_content id="da62">\n````markdown\n# Task: Add a rule\n'), "Task: Add a rule");
  assert.equal(firstLine("The coordinator sent a message while you were working:\nOne more step, same worktree"), "One more step, same worktree");
  assert.equal(firstLine("Fix these:"), "Fix these:");
  assert.equal(firstLine(""), "");
});

test("relative time reads now, seconds, minutes, hours, days", () => {
  const now = Date.parse("2026-11-11T14:30:00Z");
  assert.deepEqual([0, 30, 240, 7200, 172800].map((s) => relTime(now - s * 1000, now)), ["now", "30s", "4m", "2h", "2d"]);
  assert.equal(relTime(null, now), "—");
});

const TTG = "/Users/example/projects/ttg/.claude/vistack/decision-history.jsonl";
const FACTS = { "deterministic-fallback/split": 690, "deterministic/sharp": 532, "jev/sharp": 288, "deterministic/split": 86 };

function report(label, text) {
  const started = performance.now();
  const window = buildWindow(text);
  const s = summarize(window.decisions);
  const ms = (performance.now() - started).toFixed(1);
  const forks = {};
  for (const d of window.decisions) forks[`${d.backend}/${d.fork}`] = (forks[`${d.backend}/${d.fork}`] ?? 0) + 1;
  console.log(`\n${label}: ${window.lines} lines, ${window.decisions.length} decisions, ${window.bad} unparsable, ${window.orphans} outcomes outside the window, built in ${ms} ms`);
  console.log(`  verdicts      ${JSON.stringify(s.byVerdict)}  (Jev unavailable: ${s.unavailable})`);
  console.log(`  backend/fork  ${JSON.stringify(forks)}`);
  console.log(`  types         ${JSON.stringify(Object.fromEntries(s.types))}`);
  console.log(`  acceptance    ${(s.acceptance * 100).toFixed(1)}%   avg Jev confidence ${s.avgJevConfidence?.toFixed(3)} over ${s.jevAnswers} answers`);
  console.log(`  outcomes      turn spend $${s.usd.toFixed(2)} over ${s.turns} main turns; ${s.agentRuns} agent runs kept apart (largest running total $${s.agentPeakUsd.toFixed(2)}); ${s.aborted} aborted, ${s.pending} without outcome, model match ${(s.agreement * 100).toFixed(1)}% of ${s.compared}`);
  console.log(`  newest        ${window.decisions[0]?.id}  ${window.decisions[0]?.verdict}  ${window.decisions[0]?.action}`);
  return { window, s, forks };
}

console.log("\nreal file");
const newestByGrep = JSON.parse(execFileSync("sh", ["-c", `tail -n 50 "$1" | grep '"kind": "decision"' | tail -1`, "sh", TTG], { encoding: "utf8" })).decision_id;
const tail600 = report("tail -n 600", execFileSync("tail", ["-n", "600", TTG], { encoding: "utf8", maxBuffer: 64 << 20 }));
const whole = report("whole file", execFileSync("cat", [TTG], { encoding: "utf8", maxBuffer: 64 << 20 }));

for (const [label, run] of [["tail -n 600", tail600], ["whole file", whole]]) {
  test(`${label}: verdict classes sum to the decision count`, () => {
    assert.equal(Object.values(run.s.byVerdict).reduce((a, b) => a + b, 0), run.window.decisions.length);
  });
  test(`${label}: newest decision matches the grep (${newestByGrep})`, () => {
    assert.equal(run.window.decisions[0].id, newestByGrep);
  });
  test(`${label}: every fallback that names jev is overruled, every jev backend is decided`, () => {
    for (const d of run.window.decisions) {
      if (d.backend === "jev") assert.equal(d.verdict, "jev", d.id);
      if (/\bjev\b/.test(d.fallbackReason ?? "")) assert.equal(d.verdict, "overruled", d.id);
    }
  });
}
test("whole file: backend/fork counts are at least the counted facts (the file only grows)", () => {
  for (const [key, count] of Object.entries(FACTS)) assert.ok((whole.forks[key] ?? 0) >= count, `${key}: ${whole.forks[key]} < ${count}`);
});

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exitCode = failed ? 1 : 0;
