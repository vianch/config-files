import assert from "node:assert/strict";
import { register } from "node:module";

const ELEMENT = `
const texts = (globalThis.__jdTexts ??= []);
const collect = (child) => {
  if (child === null || child === undefined || typeof child === "boolean") throw new Error("a child is " + child);
  if (typeof child === "string" || typeof child === "number") texts.push(String(child));
};
export const el = () => {
  const node = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === "when") return (condition, branch) => (condition ? branch(node) : node);
      if (prop === "child") return (child) => (collect(child), node);
      if (prop === "children") return (list) => (list.forEach(collect), node);
      if (prop === "hover") return (style) => (style(node), node);
      if (prop === "tooltip") return (text) => (texts.push(text), node);
      return () => node;
    },
  });
  return node;
};`;
const THEME = Object.fromEntries(["background", "canvas", "chrome", "surface", "popover", "raised", "hover", "selected", "border", "input",
  "foreground", "muted", "dim", "accent", "accent_foreground", "solid", "solid_foreground", "working", "blocked", "done", "idle", "unknown",
  ...Array.from({ length: 16 }, (_, i) => `ansi${i}`)].map((name, i) => [name, `#${(0x202020 + i * 0x050505).toString(16)}`]));
const STUBS = {
  "gpui-kit": `${ELEMENT}\nexport class View {}\nexport const div = el, svg = el, image = el;`,
  "gpui-base": `${ELEMENT}\nexport const h_flex = el, v_flex = el;`,
  herdr: `const none = async () => null;
export const exec = none, readTextFile = none, watchFolder = none, pickFolder = none, nextCommand = none;
export const spaces = () => [], panes = () => [], props = () => ({});
export const theme = () => (${JSON.stringify(THEME)});
export const settings = () => ({ dark: true, font_family: "JetBrains Mono" });`,
};
const hooks = `const STUBS = ${JSON.stringify(STUBS)};
export async function resolve(specifier, context, next) {
  if (specifier in STUBS) return { url: "data:text/javascript," + encodeURIComponent(STUBS[specifier]), shortCircuit: true };
  return next(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(hooks)}`);

const { default: JevDecisions } = await import("./main.js");
const { buildWindow, summarize } = await import("./data.js");

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

const iso = (secondsAgo) => new Date(Date.now() - secondsAgo * 1000).toISOString().replace(/\.\d+Z$/, "Z");
const decision = (id, secondsAgo, source, decisionPatch, request) => JSON.stringify({
  kind: "decision", decision_id: id, timestamp: iso(secondsAgo),
  context: { decision_type: "tier-selection", metadata: { source }, task: { request } },
  decision: {
    decision_id: id, decision_type: "tier-selection", action: "complex", backend: "deterministic", fork: "sharp", confidence: 0.6,
    rationale: "No pattern is evidenced.", probabilities: { complex: 0.6, mechanical: 0.4 },
    alternatives: [{ action: "mechanical", reason: "Use once a named pattern covers the whole slice." }],
    required_evidence: ["the pattern to follow"], risks: ["A mechanical owner would copy a pattern."], change_conditions: ["Change if a pattern appears."],
    outputs: { role: "senior-implementer", tier: "complex", signals: { refactor: ["rename"] } }, authority: "advisory-only", ...decisionPatch,
  },
});
const outcome = (id, secondsAgo, result, evidence) => JSON.stringify({ kind: "outcome", decision_id: id, outcome: result, evidence: [evidence], timestamp: iso(secondsAgo) });
const LONG_REQUEST = ["Fix the flaky checkout test", "", ...Array.from({ length: 30 }, (_, i) => `step ${i + 1}`)].join("\n");
const FIXTURE = [
  decision("d_aborted", 900, "main-turn", {}, "Rename the docs"),
  outcome("d_aborted", 880, "aborted", "actual=claude-sonnet-5-5 recommended= usd=0.0000"),
  decision("d_answered", 600, "main-turn", {}, "Rename the KeyNames docs"),
  outcome("d_answered", 560, "answer", "actual=claude-sonnet-5-5 recommended=sonnet usd=0.6012"),
  decision("d_cloudflare", 300, "agent-spawn", { backend: "cloudflare", confidence: 0.91, outputs: { backend_model: "clef-flash" } }, "Implement the seat guard"),
  outcome("d_cloudflare", 240, "answer", "actual=claude-opus-5-5 recommended=sonnet usd=1.2000"),
  outcome("d_cloudflare", 120, "answer", "actual=claude-opus-5-5 recommended=sonnet usd=3.4000"),
  decision("d_timeout", 4, "main-turn", { backend: "deterministic-fallback", fork: "split", fallback_used: true, fallback_reason: "jev unavailable or rejected: inference exceeded 8000 ms" }, LONG_REQUEST),
  '{"kind": "decision", "decision_id": "d_cut", "context": {"task": {"requ',
].join("\n");

const SOURCES = [
  { path: "/r/ttg/.claude/vistack/decision-history.jsonl", mtime: Date.now() - 4000, label: "ttg" },
  { path: "/r/ttg/repos/portal/.claude/worktrees/states/.claude/vistack/decision-history.jsonl", mtime: Date.now() - 600000, label: "portal · states" },
];
const cx = { spawn() {}, notify() {}, timer: { every() {} } };

function view(overrides = {}) {
  const window = buildWindow(FIXTURE);
  const v = Object.assign(Object.create(JevDecisions.prototype), {
    sources: SOURCES, source: SOURCES[0].path, folders: [], filter: { verdict: "all", type: "all", fork: "all" },
    limit: 600, shown: 60, expanded: new Set(window.decisions.map((d) => d.id)), requestOpen: new Set(["d_timeout"]),
    autoFollow: true, width: 440, loadedAt: 0, discovered: true, window, stats: summarize(window.decisions), total: 2923,
    laya: { enabled: false, model: "nimble" }, error: null, menuOpen: false,
  }, overrides);
  v.scanned = v.scanKey();
  return v;
}
function rendered(v) {
  globalThis.__jdTexts.length = 0;
  v.render(cx);
  return globalThis.__jdTexts.join("\n");
}
const includes = (text, ...needles) => needles.forEach((needle) => assert.ok(text.includes(needle), `missing: ${needle}`));

console.log("render");

test("every row expanded draws joined outcomes: aborted, answered with a model match, and an agent running total with a mismatch", () => {
  const text = rendered(view());
  includes(text, "aborted", "= recommended sonnet", "≠ recommended sonnet", "$3.40 agent running total after 2 reports", "agent $3.40", "$0.60");
});

test("the newest row with a timed-out Jev reads unavailable in the Now card and the ladder", () => {
  const text = rendered(view());
  includes(text, "Jev unavailable: inference exceeded 8000 ms", "unavailable · inference exceeded 8000 ms", "deciding…", "NOW");
});

test("another backend is its own class, and the tally counts the unparsable line and keeps agents out of turn spend", () => {
  const text = rendered(view());
  includes(text, "Other model", "1 unparsable", "Turn spend", "$0.60", "2 turns · agents apart", "1 agent run (largest $3.40)");
});

test("a full request shows its 'less' toggle; the source bar shows laya off and the line count", () => {
  const text = rendered(view());
  includes(text, "less", "step 30", "laya off", "9 / 2,923 lines");
});

test("the open source menu lists sources and Add folder…", () => {
  includes(rendered(view({ menuOpen: true })), "ttg", "portal · states", "/r/ttg/repos/portal/.claude/worktrees/states", "Add folder…");
});

test("an error after a good load shows above the data, and one before any load replaces it", () => {
  includes(rendered(view({ error: "tail: No such file or directory" })), "tail: No such file or directory", "TIMELINE");
  const before = rendered(view({ error: "tail: No such file or directory", window: null, stats: null }));
  includes(before, "tail: No such file or directory");
  assert.ok(!before.includes("TIMELINE"));
});

test("empty and waiting states: no sources, still looking, still reading, nothing matching", () => {
  includes(rendered(view({ source: null, sources: [], window: null, stats: null })), "NO DECISION HISTORY", "Add folder…", "<repo>/.claude/vistack/decision-history.jsonl");
  includes(rendered(view({ discovered: false })), "Looking for decision history…");
  includes(rendered(view({ window: null, stats: null })), "Reading decisions…");
  includes(rendered(view({ filter: { verdict: "jev", type: "all", fork: "all" } })), "Nothing in this window matches these filters.");
});

test("a narrow panel still renders every block", () => {
  includes(rendered(view({ width: 320 })), "TALLY", "TIMELINE", "Jev accepted");
});

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exitCode = failed ? 1 : 0;
