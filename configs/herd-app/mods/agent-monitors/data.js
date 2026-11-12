const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const KINDS = {
  monitor: { title: "Monitors", icon: "radar", tone: "working" },
  loop: { title: "Loops", icon: "loop", tone: "accent" },
  cron: { title: "Cron jobs", icon: "alarm", tone: "done" },
};
export const KIND_ORDER = ["monitor", "loop", "cron"];

export const ENDED_WORDS = {
  completed: "finished", failed: "failed", killed: "killed", stopped: "stopped", error: "errored", timeout: "timed out",
  expired: "expired", cancelled: "canceled", canceled: "canceled", fired: "fired", finished: "finished",
};

export function parseOutput(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    if (parsed?.error) return { error: String(parsed.error) };
    if (!Array.isArray(parsed?.items) || !Array.isArray(parsed?.sessions)) return { error: "unexpected helper output" };
    return { snapshot: parsed };
  } catch {
    return { error: stdout.trim() ? "unreadable helper output" : "the helper printed nothing" };
  }
}

export function duration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 && m < 10 ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

export function until(at, now) {
  return at - now <= 1000 ? "now" : `in ${duration(at - now)}`;
}

export function ago(at, now) {
  return now - at < 5000 ? "just now" : `${duration(now - at)} ago`;
}

const pad = (n) => String(n).padStart(2, "0");

export function humanCron(expression) {
  const f = String(expression ?? "").trim().split(/\s+/);
  if (f.length !== 5) return expression ?? "";
  const [min, hour, dom, mon, dow] = f;
  const plain = (x) => /^\d+$/.test(x);
  const every = /^\*\/(\d+)$/;
  if (every.test(min) && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    const n = Number(every.exec(min)[1]);
    return n === 1 ? "every minute" : `every ${n} min`;
  }
  if (min === "*" && hour === "*" && dom === "*" && mon === "*" && dow === "*") return "every minute";
  if (plain(min) && every.test(hour) && dom === "*" && mon === "*" && dow === "*") return `every ${every.exec(hour)[1]}h at :${pad(min)}`;
  if (plain(min) && hour === "*" && dom === "*" && mon === "*" && dow === "*") return `hourly at :${pad(min)}`;
  if (plain(min) && plain(hour)) {
    const time = `${pad(hour)}:${pad(min)}`;
    if (plain(dom) && plain(mon) && dow === "*") return `${MONTHS[Number(mon) - 1] ?? mon} ${Number(dom)} · ${time}`;
    if (dom === "*" && mon === "*" && dow === "*") return `daily ${time}`;
    if (dom === "*" && mon === "*" && dow === "1-5") return `weekdays ${time}`;
    if (dom === "*" && mon === "*" && plain(dow)) return `${DAYS[Number(dow) % 7]} ${time}`;
  }
  return expression;
}

export function cronPeriod(expression) {
  const f = String(expression ?? "").trim().split(/\s+/);
  if (f.length !== 5 || f.slice(2).some((x) => x !== "*")) return null;
  const every = /^\*\/(\d+)$/;
  if (every.test(f[0]) && f[1] === "*") return Number(every.exec(f[0])[1]) * MINUTE;
  if (f[0] === "*" && f[1] === "*") return MINUTE;
  if (/^\d+$/.test(f[0]) && f[1] === "*") return HOUR;
  if (/^\d+$/.test(f[0]) && every.test(f[1])) return Number(every.exec(f[1])[1]) * HOUR;
  if (/^\d+$/.test(f[0]) && /^\d+$/.test(f[1])) return DAY;
  return null;
}

/** The moment an item next does something on its own, and the verb for it. */
export function nextMoment(item) {
  if (item.status === "ended") return null;
  if (item.kind === "monitor") return item.deadlineAt ? { at: item.deadlineAt, verb: "expires" } : null;
  if (item.kind === "loop" && item.via === "wakeup") return item.status === "sleeping" ? { at: item.nextAt, verb: "wakes" } : null;
  return item.nextAt ? { at: item.nextAt, verb: "fires" } : null;
}

/** How far along the item is toward its next moment, 0..1. Monitors drain; the rest fill. */
export function progress(item, now) {
  const clamp = (x) => Math.min(1, Math.max(0, x));
  if (item.status === "ended") return 0;
  if (item.kind === "monitor") {
    if (!item.deadlineAt) return 1;
    return clamp((item.deadlineAt - now) / Math.max(1, item.deadlineAt - item.startedAt));
  }
  if (!item.nextAt) return item.status === "running" ? 1 : 0;
  const period = item.recurring ? cronPeriod(item.schedule) : null;
  const span = period ?? Math.max(1, item.nextAt - item.startedAt);
  return clamp(1 - (item.nextAt - now) / span);
}

export function urgency(item, now) {
  if (item.kind !== "monitor" || !item.deadlineAt || item.status === "ended") return "calm";
  const left = item.deadlineAt - now;
  if (left < 2 * MINUTE) return "critical";
  if (left < 5 * MINUTE || progress(item, now) < 0.15) return "warn";
  return "calm";
}

export function groupItems(items) {
  const active = Object.fromEntries(KIND_ORDER.map((k) => [k, []]));
  const ended = [];
  for (const item of items ?? []) {
    if (item.status === "ended") ended.push(item);
    else active[item.kind]?.push(item);
  }
  const soonest = (a, b) => (nextMoment(a)?.at ?? Infinity) - (nextMoment(b)?.at ?? Infinity) || b.startedAt - a.startedAt;
  for (const kind of KIND_ORDER) active[kind].sort(soonest);
  ended.sort((a, b) => b.endedAt - a.endedAt);
  return { active, ended, count: KIND_ORDER.reduce((n, k) => n + active[k].length, 0) };
}

export function nextUp(items, now) {
  let best = null;
  for (const item of items ?? []) {
    const moment = nextMoment(item);
    if (moment && moment.at > now - 1000 && (!best || moment.at < best.at)) best = { ...moment, item };
  }
  return best;
}

/** How often the panel redraws its clocks: every second only when a countdown is near. */
export function tickMs(items, now, shown) {
  if (!shown) return 30000;
  const soon = nextUp(items, now);
  return soon && soon.at - now < 10 * MINUTE ? 1000 : 15000;
}

export function pollMs(shown, count) {
  if (!shown) return 30000;
  return count > 0 ? 4000 : 8000;
}

export function sessionLabel(session, agentList) {
  if (!session) return "unknown session";
  const agent = session.terminal ? (agentList ?? []).find((a) => a.address === session.terminal) : null;
  const where = agent?.space_name ?? String(session.cwd ?? "").split("/").filter(Boolean).pop() ?? "~";
  return session.title ? `${where} · ${session.title}` : where;
}

export function shownInLayout(tree, mod) {
  const walk = (node, shown) => {
    if (!node || typeof node !== "object") return null;
    const here = shown && node.hidden !== true;
    if (node.content?.mod === mod) return here;
    for (const child of node.children ?? []) {
      const found = walk(child, here && (node.type !== "stack" || (node.active ?? node.children?.[0]?.id) === child.id));
      if (found !== null) return found;
    }
    return null;
  };
  return walk(tree, true) ?? true;
}

/** A digest of what is on screen, so a poll that changed nothing redraws nothing. */
export function digest(snapshot) {
  if (!snapshot) return "";
  return JSON.stringify([snapshot.items, snapshot.sessions.map((s) => [s.id, s.title, s.terminal])]);
}
