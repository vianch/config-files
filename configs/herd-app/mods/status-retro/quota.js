export const STALE_MS = 20 * 60000;

export const PROVIDERS = [
  { id: "claude", name: "Claude", icon: "icons/claude.svg", tint: true, color: "#d97757" },
  { id: "codex", name: "Codex", icon: "icons/codex.svg", tint: false, color: null },
  { id: "grok", name: "Grok", icon: "icons/grok.svg", tint: true, color: null },
];

const MINUTE = 60000;

export const MISSING = {
  claude: "no limits recorded yet — they appear once a Claude Code session's statusline refreshes",
  codex: "no Codex session with rate limits found in ~/.codex/sessions",
  grok: "Grok keeps no usage record on this machine, so there is nothing local to read",
};

export function span(ms) {
  const m = Math.max(0, Math.round(ms / MINUTE));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

const money = (n) => `$${Number(n).toFixed(2)}`;
const time = (stamp) => {
  const at = Date.parse(stamp ?? "");
  return Number.isFinite(at) ? at : null;
};

function meterOf(line) {
  const limit = Number(line.limit);
  const used = Number(line.used);
  if (!(limit > 0) || !Number.isFinite(used)) return null;
  const dollars = line.format?.kind === "dollars";
  const left = Math.max(0, Math.min(100, Math.round((100 * (limit - used)) / limit)));
  return {
    label: line.label,
    left,
    dollars,
    leftText: dollars ? `${money(limit - used)} left` : `${left}% left`,
    limitText: dollars ? `$${limit} limit` : null,
    resetsAt: time(line.resetsAt),
    periodMs: Number(line.periodDurationMs) || null,
  };
}

/** Turns quota.py's list (shaped like OpenUsage's /v1/usage) into one slot per wanted provider, missing ones included. */
export function parseUsage(list, now) {
  const byId = new Map((Array.isArray(list) ? list : []).map((p) => [p.providerId, p]));
  return PROVIDERS.map((wanted) => {
    const raw = byId.get(wanted.id);
    if (!raw) return { ...wanted, missing: true, meters: [], facts: [], trend: [] };
    const lines = Array.isArray(raw.lines) ? raw.lines : [];
    const meters = lines.filter((l) => l.type === "progress").map(meterOf).filter(Boolean);
    const fetchedAt = time(raw.fetchedAt);
    return {
      ...wanted,
      name: raw.displayName || wanted.name,
      plan: raw.plan ?? null,
      source: raw.source ?? null,
      missing: false,
      fetchedAt,
      stale: fetchedAt == null || now - fetchedAt > STALE_MS,
      meters,
      facts: lines.filter((l) => l.type === "text" && l.value).map((l) => ({ label: l.label, value: String(l.value) })),
      trend: (lines.find((l) => l.type === "barChart")?.points ?? []).map((p) => Number(p.value) || 0),
    };
  });
}

/** The meters a status bar has room for: the percent ones, session first. */
export function headline(provider) {
  return provider.meters.filter((m) => !m.dollars).slice(0, 2);
}

export function short(label) {
  const word = String(label ?? "").toLowerCase();
  if (word.startsWith("session")) return "S";
  if (word.startsWith("week")) return "W";
  if (word.startsWith("month")) return "M";
  return String(label ?? "").slice(0, 1).toUpperCase();
}

export function level(left) {
  if (left == null) return "none";
  if (left <= 10) return "critical";
  if (left <= 30) return "warn";
  return "ok";
}

export function asOf(provider, now) {
  if (provider.missing || provider.fetchedAt == null) return "";
  const age = now - provider.fetchedAt;
  const when = age < MINUTE ? "just now" : `${span(age)} ago`;
  return `${provider.source ? `from ${provider.source}, ` : ""}${when}`;
}

export function resetText(meter, now) {
  return meter.resetsAt ? `Resets in ${span(meter.resetsAt - now)}` : "";
}

export function tooltip(provider, now) {
  if (provider.missing) return `${provider.name}: ${MISSING[provider.id] ?? "no local usage record found"}`;
  const parts = provider.meters.map((m) => `${m.label} ${m.leftText}${m.resetsAt ? ` · resets in ${span(m.resetsAt - now)}` : ""}`);
  const head = provider.plan ? `${provider.name} (${provider.plan})` : provider.name;
  return [head, ...parts, asOf(provider, now)].filter(Boolean).join("\n");
}

export function digestUsage(slots) {
  return JSON.stringify(slots.map((s) => [s.id, s.missing, s.stale, s.plan, s.meters.map((m) => [m.left, m.resetsAt && Math.round(m.resetsAt / MINUTE)])]));
}

/** "Device Utilization %"=28 from `ioreg -r -d 1 -c IOAccelerator`. */
export function parseGpu(text) {
  const match = /"Device Utilization %"\s*=\s*(\d+)/.exec(text ?? "");
  return match ? Math.min(100, Number(match[1])) : null;
}

/** A provider's mark: one-color glyphs take the text color, pictures keep their own. */
export function markOf(slot, size, color, el) {
  return slot.tint ? el.svg(slot.icon).size(size).text_color(slot.color ?? color) : el.image(slot.icon).size(size);
}
