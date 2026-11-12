export const JEV_FLOOR = 0.65;
export const VERDICTS = ["jev", "overruled", "rules", "model"];
export const VERDICT_LABEL = { jev: "Jev decided", overruled: "Jev overruled", rules: "Rules only", model: "Other model" };
export const HISTORY_SUFFIX = "/.claude/vistack/decision-history.jsonl";

const RUNG_HEAD = /^([A-Za-z][\w-]*)(?::(\S+))? unavailable or rejected: ([\s\S]*)$/;
const BELOW_FLOOR = /confidence (\d*\.?\d+) is below (\d*\.?\d+)/;
const STANCE = /^(agrees|dissents): (.+)$/;
const NAMES_JEV = /\bjev\b/i;
const REQUEST_LIMIT = 20000;
const SHORT_TYPE = {
  "tier-selection": "tier", "playbook-selection": "playbook", "intake-analysis": "intake", "model-selection": "model",
  "dispatch-readiness": "dispatch", "runtime-progress": "progress", "skill-improvement": "skill", "tool-selection": "tool",
  "file-selection": "file", verification: "verify", decomposition: "decompose", grooming: "groom",
};
const OUTPUT_ORDER = [
  "role", "tier", "model", "backend_model", "playbook", "classification", "readiness", "route_source",
  "mechanical_signals", "complex_signals", "signals", "flags", "dissent", "corroborated_by", "tier_mismatch", "pattern", "slice_like",
];
const OUTPUTS_SHOWN_ELSEWHERE = new Set(["fallback", "margins"]);
const OUTPUT_TEXT_LIMIT = 240;

const str = (value) => (typeof value === "string" ? value : value == null ? "" : String(value));
const num = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const strings = (value) => (Array.isArray(value) ? value.map(str).filter(Boolean) : []);
const lastSegment = (path) => path.split("/").filter(Boolean).pop() ?? path;

export function parseRows(text) {
  const rows = [];
  let bad = 0;
  let lines = 0;
  for (const line of str(text).split("\n")) {
    if (!line.trim()) continue;
    lines++;
    try {
      rows.push(JSON.parse(line));
    } catch {
      bad++;
    }
  }
  return { rows, bad, lines };
}

export function parseLadder(reason) {
  if (typeof reason !== "string" || !reason) return [];
  const rungs = [];
  for (const part of reason.split("; ")) {
    const head = RUNG_HEAD.exec(part);
    if (head) {
      rungs.push(rungOf(head[1], head[2] ?? null, head[3]));
      continue;
    }
    const current = rungs.at(-1);
    if (!current) continue;
    const stance = STANCE.exec(part);
    if (stance && !current.stance) {
      current.stance = stance[1];
      current.wanted = stance[2].trim();
      continue;
    }
    current.reason += `; ${part}`;
  }
  return rungs;
}

function rungOf(backend, model, reason) {
  const below = BELOW_FLOOR.exec(reason);
  return {
    backend, model, reason,
    confidence: below ? Number(below[1]) : null,
    floor: below ? Number(below[2]) : null,
    stance: null, wanted: null,
    unavailable: !below,
  };
}

function namesJev(decision) {
  const outputs = decision?.outputs ?? {};
  if (NAMES_JEV.test(str(decision?.fallback_reason))) return true;
  if (Array.isArray(outputs.dissent) && outputs.dissent.includes("jev")) return true;
  return num(outputs.margins?.jev) !== null;
}

export function classify(decision) {
  const backend = str(decision?.backend);
  if (backend === "jev") return "jev";
  if (namesJev(decision)) return "overruled";
  if (!backend || backend.startsWith("deterministic")) return "rules";
  return "model";
}

function jevView(decision, ladder, verdict) {
  if (verdict === "jev") {
    return { confidence: num(decision.confidence), floor: JEV_FLOOR, stance: null, wanted: str(decision.action) || null, unavailable: false, reason: null };
  }
  if (verdict !== "overruled") return null;
  const rung = ladder.find((r) => r.backend === "jev");
  const outputs = decision.outputs ?? {};
  const margin = num(outputs.margins?.jev);
  const dissents = Array.isArray(outputs.dissent) && outputs.dissent.includes("jev");
  if (rung) return { confidence: rung.confidence, floor: rung.floor ?? JEV_FLOOR, stance: rung.stance, wanted: rung.wanted, unavailable: rung.unavailable, reason: rung.reason };
  return { confidence: margin, floor: JEV_FLOOR, stance: dissents ? "dissents" : null, wanted: null, unavailable: margin === null, reason: str(decision.fallback_reason) || null };
}

function outputText(value) {
  if (Array.isArray(value)) return value.map((v) => (typeof v === "object" && v ? JSON.stringify(v) : str(v))).join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : typeof v === "object" && v ? JSON.stringify(v) : str(v)}`).join(" · ");
  }
  if (typeof value === "boolean") return value ? "yes" : "";
  return str(value);
}

function keyOutputs(outputs) {
  const keys = [...OUTPUT_ORDER.filter((k) => k in outputs), ...Object.keys(outputs).filter((k) => !OUTPUT_ORDER.includes(k) && !OUTPUTS_SHOWN_ELSEWHERE.has(k))];
  return keys
    .map((key) => [key, outputText(outputs[key])])
    .filter(([, text]) => text)
    .map(([key, text]) => [key, text.length > OUTPUT_TEXT_LIMIT ? `${text.slice(0, OUTPUT_TEXT_LIMIT)}…` : text]);
}

function toMs(stamp) {
  const ms = Date.parse(str(stamp));
  return Number.isNaN(ms) ? null : ms;
}

export function normalizeDecision(row, seq) {
  const decision = row.decision ?? {};
  const context = row.context ?? {};
  const outputs = decision.outputs && typeof decision.outputs === "object" ? decision.outputs : {};
  const ladder = parseLadder(decision.fallback_reason);
  const verdict = classify(decision);
  const request = str(context.task?.request);
  return {
    id: str(row.decision_id ?? decision.decision_id) || `row-${seq}`,
    seq,
    at: toMs(row.timestamp ?? decision.created_at),
    type: str(decision.decision_type ?? context.decision_type) || "unknown",
    action: str(decision.action) || "—",
    backend: str(decision.backend) || "unknown",
    fork: str(decision.fork) || null,
    confidence: num(decision.confidence),
    verdict,
    jev: jevView({ ...decision, outputs }, ladder, verdict),
    ladder,
    margins: Object.entries(outputs.margins && typeof outputs.margins === "object" ? outputs.margins : {}).filter(([, m]) => num(m) !== null),
    fallbackReason: str(decision.fallback_reason) || null,
    source: str(context.metadata?.source) || null,
    request: request.slice(0, REQUEST_LIMIT),
    requestLength: request.length,
    rationale: str(decision.rationale),
    probabilities: Object.entries(decision.probabilities ?? {}).filter(([, p]) => num(p) !== null).sort((a, b) => b[1] - a[1]),
    alternatives: (Array.isArray(decision.alternatives) ? decision.alternatives : []).map((a) => ({ action: str(a?.action), reason: str(a?.reason) })),
    requiredEvidence: strings(decision.required_evidence),
    risks: strings(decision.risks),
    changeConditions: strings(decision.change_conditions),
    role: str(outputs.role) || null,
    tier: str(outputs.tier) || null,
    outputs: keyOutputs(outputs),
    authority: str(decision.authority) || null,
    outcome: null,
  };
}

export function parseOutcomeEvidence(evidence) {
  const text = strings(evidence).find((e) => e.includes("actual=") || e.includes("usd=")) ?? "";
  const field = (name) => new RegExp(`(?:^|\\s)${name}=(\\S*)`).exec(text)?.[1] ?? null;
  const usd = Number.parseFloat(field("usd"));
  const model = (value) => (value && value !== "?" ? value : null);
  return { actual: model(field("actual")), recommended: model(field("recommended")), usd: Number.isFinite(usd) ? usd : null };
}

const AGENT_SOURCE = "agent-spawn";

// An agent-spawn outcome carries the agent’s running total (register.tsx sums all of its steps); a main-turn outcome carries that turn alone.
function attachOutcome(decision, row) {
  const { actual, recommended, usd } = parseOutcomeEvidence(row.evidence);
  const previous = decision.outcome;
  const running = decision.source === AGENT_SOURCE;
  decision.outcome = {
    outcome: str(row.outcome) || "unknown",
    actual, recommended, usd, running,
    at: toMs(row.timestamp),
    turns: (previous?.turns ?? 0) + 1,
    spendUsd: running ? usd ?? previous?.spendUsd ?? 0 : (previous?.spendUsd ?? 0) + (usd ?? 0),
  };
}

export function buildWindow(text) {
  const { rows, bad, lines } = parseRows(text);
  const byId = new Map();
  const outcomes = [];
  rows.forEach((row, seq) => {
    if (row?.kind === "decision") {
      const decision = normalizeDecision(row, seq);
      byId.delete(decision.id);
      byId.set(decision.id, decision);
    } else if (row?.kind === "outcome") {
      outcomes.push(row);
    }
  });
  let orphans = 0;
  for (const row of outcomes) {
    const decision = byId.get(str(row.decision_id));
    if (decision) attachOutcome(decision, row);
    else orphans++;
  }
  const decisions = [...byId.values()].sort((a, b) => b.seq - a.seq);
  return { decisions, bad, lines, orphans };
}

export function modelAgrees(actual, recommended) {
  return str(actual).toLowerCase().includes(str(recommended).toLowerCase());
}

export function summarize(decisions) {
  const byVerdict = Object.fromEntries(VERDICTS.map((v) => [v, 0]));
  const types = new Map();
  let unavailable = 0, overruledAnswered = 0, jevAnswers = 0, jevConfidenceSum = 0;
  let usd = 0, turns = 0, agentRuns = 0, agentPeakUsd = 0, aborted = 0, answered = 0, pending = 0, compared = 0, agreeing = 0;
  for (const d of decisions) {
    byVerdict[d.verdict] = (byVerdict[d.verdict] ?? 0) + 1;
    types.set(d.type, (types.get(d.type) ?? 0) + 1);
    if (d.jev?.unavailable) unavailable++;
    if (d.verdict === "overruled" && !d.jev?.unavailable) overruledAnswered++;
    if (d.jev && !d.jev.unavailable && d.jev.confidence !== null) {
      jevAnswers++;
      jevConfidenceSum += d.jev.confidence;
    }
    const o = d.outcome;
    if (!o) {
      pending++;
      continue;
    }
    if (o.running) {
      agentRuns++;
      agentPeakUsd = Math.max(agentPeakUsd, o.spendUsd);
    } else {
      usd += o.spendUsd;
      turns += o.turns;
    }
    if (o.outcome === "aborted") aborted++;
    else answered++;
    if (o.actual && o.recommended) {
      compared++;
      if (modelAgrees(o.actual, o.recommended)) agreeing++;
    }
  }
  const asked = byVerdict.jev + overruledAnswered;
  return {
    total: decisions.length,
    byVerdict, unavailable,
    acceptance: asked ? byVerdict.jev / asked : null,
    jevAnswers,
    avgJevConfidence: jevAnswers ? jevConfidenceSum / jevAnswers : null,
    usd, turns, agentRuns, agentPeakUsd, aborted, answered, pending,
    agreement: compared ? agreeing / compared : null,
    compared,
    types: [...types].sort((a, b) => b[1] - a[1]),
  };
}

export function matches(decision, filter) {
  if (filter.verdict !== "all" && decision.verdict !== filter.verdict) return false;
  if (filter.type !== "all" && decision.type !== filter.type) return false;
  return filter.fork === "all" || decision.fork === filter.fork;
}

export function shortType(type) {
  return SHORT_TYPE[type] ?? type;
}

export function firstLine(text) {
  const lines = [];
  for (const raw of str(text).split("\n")) {
    const line = raw.trim();
    if (!line || /^<\/?[\w-]+[^>]*>$/.test(line) || /^`{3,}/.test(line)) continue;
    lines.push(line.replace(/^#+\s*/, ""));
    if (lines.length === 2) break;
  }
  const isLeadIn = lines.length === 2 && lines[0].endsWith(":");
  return lines[isLeadIn ? 1 : 0] ?? "";
}

export function relTime(ms, now) {
  if (ms == null) return "—";
  const seconds = Math.max(0, Math.floor((now - ms) / 1000));
  if (seconds < 10) return "now";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function historyPath(entry) {
  const path = str(entry).replace(/\/+$/, "");
  return path.endsWith(".jsonl") ? path : `${path}${HISTORY_SUFFIX}`;
}

export function repoRoot(path) {
  return path.endsWith(HISTORY_SUFFIX) ? path.slice(0, -HISTORY_SUFFIX.length) : path.replace(/\/[^/]*$/, "");
}

export function sourceLabel(path) {
  const root = repoRoot(path);
  const claudeWorktree = /^(.*)\/\.claude\/worktrees\/([^/]+)$/.exec(root);
  if (claudeWorktree) return `${lastSegment(claudeWorktree[1])} · ${claudeWorktree[2]}`;
  const herdrWorktree = /\/\.herdr\/worktrees\/([^/]+)\/(.+)$/.exec(root);
  if (herdrWorktree) return `${herdrWorktree[1]} · ${herdrWorktree[2]}`;
  return lastSegment(root) || root;
}

export function labelSources(paths) {
  const labels = paths.map(sourceLabel);
  return labels.map((label, i) => {
    if (labels.indexOf(label) === labels.lastIndexOf(label)) return label;
    const parts = repoRoot(paths[i]).split("/").filter(Boolean);
    return parts.slice(-2).join("/");
  });
}

export function parseDiscovery(stdout) {
  const newest = new Map();
  for (const line of str(stdout).split("\n")) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const mtime = Number(line.slice(0, tab)) * 1000;
    const path = line.slice(tab + 1).trim();
    if (!path || !Number.isFinite(mtime)) continue;
    newest.set(path, Math.max(mtime, newest.get(path) ?? 0));
  }
  return [...newest].map(([path, mtime]) => ({ path, mtime })).sort((a, b) => b.mtime - a.mtime);
}

export function parseLaya(text) {
  if (typeof text !== "string") return null;
  try {
    const config = JSON.parse(text);
    if (!config || typeof config !== "object") return null;
    return { enabled: typeof config.enabled === "boolean" ? config.enabled : null, model: str(config.ollama_model) || null };
  } catch {
    return null;
  }
}
