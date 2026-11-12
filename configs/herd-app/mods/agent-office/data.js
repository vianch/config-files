export const DEPARTMENTS = {
  advisor: { label: "Advisor", title: "Board advisor" },
  scout: { label: "Research", title: "Analyst" },
  scholar: { label: "Library", title: "Researcher" },
  wizard: { label: "Architecture", title: "Principal engineer" },
  builder: { label: "Engineering", title: "Engineer" },
  critic: { label: "QA & Review", title: "Reviewer" },
  captain: { label: "Program", title: "Program lead" },
  helper: { label: "Operations", title: "Generalist" },
};

export const DEPARTMENT_ORDER = ["scout", "scholar", "wizard", "builder", "critic", "captain", "helper"];

export const WALL_PROPS = {
  lobby: ["door", "window"],
  exec: ["window", "bookshelf"],
  scout: ["whiteboard"],
  scholar: ["bookshelf"],
  wizard: ["window"],
  builder: ["kanban"],
  critic: ["whiteboard"],
  captain: ["kanban"],
  helper: ["window"],
};

export const FLOOR_PROPS = {
  scout: ["plant"],
  scholar: ["plant"],
  wizard: ["plant"],
  builder: ["cooler"],
  critic: ["plant"],
  captain: ["plant"],
  helper: ["server"],
};

const ROLE_OF = [
  [/advis/, "advisor"],
  [/devops|infra|pipeline|deploy/, "helper"],
  [/research|docs|guide/, "scholar"],
  [/explore|analyst|scout|search/, "scout"],
  [/senior|architect|design-runner/, "wizard"],
  [/implement|builder|code-simplifier|engineer/, "builder"],
  [/review|health|verif|qa|audit|security|critic/, "critic"],
  [/plan|coordinat|groom|pr-author|unblock|orchestr/, "captain"],
];

export const COORDINATOR_LABELS = {
  idle: "idle",
  thinking: "thinking",
  writing: "writing",
  tool: "running a tool",
  delegating: "delegating",
  "waiting-you": "waiting on you",
  "waiting-agents": "waiting on agents",
};

const LIVE = new Set(["running", "pending"]);
const FAST_MS = 2000;
const SLOW_MS = 10000;
const HIDDEN_MS = 30000;
const CLOCK_MS = 30000;

export function roleOf(agent) {
  if (agent?.role && DEPARTMENTS[agent.role]) return agent.role;
  if (agent?.role) return "helper";
  const lower = String(agent?.type ?? "").toLowerCase();
  return ROLE_OF.find(([pattern]) => pattern.test(lower))?.[1] ?? "helper";
}

export const WALL_PX = 2;
export const BODY_PAD_PX = 12;

export function buildingWidth(panelWidth) {
  return Math.max(200, panelWidth - BODY_PAD_PX * 2 - 1);
}
export const SUITE_STACK_PX = 520;

export function suiteStacks(width) {
  return width < SUITE_STACK_PX;
}

export function tilesFor(width, tileWidth) {
  return Math.floor(Math.max(0, width) / tileWidth) + 1;
}

export function packFloor(desks, width, slotPx, padPx) {
  const need = (count) => Math.max(1, count) * slotPx + padPx;
  const rows = [];
  desks.forEach((count, index) => {
    const room = { index, desks: count, need: need(count) };
    const row = rows.at(-1);
    if (row && row.need + WALL_PX + room.need <= width) {
      row.rooms.push(room);
      row.need += WALL_PX + room.need;
    } else {
      rows.push({ rooms: [room], need: room.need });
    }
  });
  return rows.map((row) => {
    const free = width - WALL_PX * (row.rooms.length - 1);
    const total = row.rooms.reduce((sum, r) => sum + r.need, 0);
    let used = 0;
    const rooms = row.rooms.map((r, i) => {
      const share = i === row.rooms.length - 1 ? free - used : Math.floor((free * r.need) / total);
      used += share;
      return { ...r, width: share, perLine: Math.max(1, Math.floor((share - padPx) / slotPx)) };
    });
    return { rooms, lines: Math.max(...rooms.map((r) => Math.ceil(Math.max(1, r.desks) / r.perLine))) };
  });
}


export function roomsOf(agents) {
  return DEPARTMENT_ORDER
    .map((role) => ({ role, ...DEPARTMENTS[role], agents: agents.filter((a) => roleOf(a) === role) }))
    .filter((room) => room.agents.length > 0);
}

export function advisorAgents(agents) {
  return agents.filter((a) => roleOf(a) === "advisor");
}

const GENERIC_TITLE = /^(claude( code)?)?$/i;

function sessionTitle(agent) {
  const title = String(agent.title ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
  return GENERIC_TITLE.test(title) || title === agent.program?.name ? agent.tab_name : title;
}

export function claudeCandidates(list, spaceList) {
  const remote = new Set((spaceList ?? []).filter((s) => s.machine).map((s) => s.id));
  return (list ?? [])
    .filter((a) => (a.app === "claude-code" || a.program?.key === "claude") && !remote.has(a.space) && !a.address.includes("/"))
    .map((a) => ({ ...a, label: `${a.space_name} · ${sessionTitle(a)}` }));
}

function automaticOrder(candidates) {
  const focused = candidates.filter((c) => c.focused);
  const rest = candidates.filter((c) => !c.focused).sort((a, b) => (b.seq ?? 0) - (a.seq ?? 0));
  return [...focused, ...rest];
}

export function focusedSession(candidates) {
  return candidates.find((c) => c.focused)?.address ?? null;
}

export function focusMoved(seen, focus) {
  return seen !== undefined && focus !== null && focus !== seen;
}

export function pickSession(candidates, { pinned = null, following = null, skipped = new Set() } = {}) {
  if (!candidates.length) return null;
  const has = (address) => address && candidates.some((c) => c.address === address);
  if (has(pinned)) return { address: pinned, why: "pinned" };
  const focus = candidates.find((c) => c.focused && !skipped.has(c.address));
  if (focus) return { address: focus.address, why: "focused" };
  if (has(following)) return { address: following, why: "following" };
  const order = automaticOrder(candidates);
  const usable = order.find((c) => !skipped.has(c.address));
  if (!usable) return { address: order[0].address, why: "fallback" };
  return { address: usable.address, why: usable.focused ? "focused" : "recent" };
}

export function stepSession(candidates, address, step) {
  if (!candidates.length) return null;
  const at = candidates.findIndex((c) => c.address === address);
  if (at < 0) return candidates[0].address;
  return candidates[(at + step + candidates.length) % candidates.length].address;
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

export function pollDelay(snapshot, shown = true) {
  if (!shown) return HIDDEN_MS;
  if (!snapshot?.session?.live) return SLOW_MS;
  const moving = (snapshot.coordinator?.state ?? "idle") !== "idle"
    || (snapshot.agents ?? []).some((a) => LIVE.has(a.status) || a.status === "waiting");
  return moving ? FAST_MS : SLOW_MS;
}

export function shouldNotify(previousKey, nextKey, live, sinceRender) {
  return previousKey !== nextKey || live || sinceRender >= CLOCK_MS;
}

export function money(totals) {
  const crew = totals?.usdEngineTeam;
  if (typeof crew === "number") return { text: dollars(crew), estimated: false, crew: true };
  const lead = totals?.usdEngine;
  if (typeof lead === "number") return { text: dollars(lead), estimated: false, crew: false };
  return { text: dollars(totals?.usdEstimate ?? 0), estimated: true, crew: true };
}

export function dollars(usd) {
  return `$${(Number(usd) || 0).toFixed(2)}`;
}

export function look(status) {
  if (LIVE.has(status)) return { animate: true, mark: null, still: false };
  if (status === "waiting") return { animate: false, mark: "wait", still: false };
  if (status === "completed") return { animate: false, mark: "done", still: true };
  if (status === "failed" || status === "killed") return { animate: false, mark: "fail", still: true };
  return { animate: false, mark: null, still: true };
}

export function coordinatorLook(state) {
  const key = COORDINATOR_LABELS[state] ? state : "idle";
  return { label: COORDINATOR_LABELS[key], warn: key === "waiting-you", busy: key !== "idle" };
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
const tokens = (t) => ({ in: num(t?.in), out: num(t?.out), cr: num(t?.cr), cw: num(t?.cw) });

export function normalize(raw) {
  const s = obj(raw);
  const session = obj(s.session);
  const owner = obj(s.owner);
  const coordinator = obj(s.coordinator);
  const advisor = obj(s.advisor);
  return {
    v: num(s.v),
    at: num(s.at),
    session: { ...session, live: session.live === true, title: session.title ?? "" },
    owner: { ...owner, prompt: owner.prompt ?? "", asks: num(owner.asks), interrupted: owner.interrupted === true, at: owner.at ?? null },
    coordinator: {
      ...coordinator,
      state: coordinator.state ?? "idle",
      tokens: tokens(coordinator.tokens),
      usd: num(coordinator.usd),
      tools: num(coordinator.tools),
      codeWrites: Array.isArray(coordinator.codeWrites) ? coordinator.codeWrites : [],
    },
    advisor: { ...advisor, consults: num(advisor.consults), usd: num(advisor.usd), last: advisor.last && typeof advisor.last === "object" ? advisor.last : null },
    agents: arr(s.agents).map((a) => ({ ...a, id: String(a.id ?? ""), status: a.status ?? "idle", tokens: tokens(a.tokens), usd: num(a.usd) })),
    comms: arr(s.comms),
    skills: arr(s.skills),
    totals: obj(s.totals),
  };
}

export function parseHelperOutput(stdout) {
  const lines = String(stdout ?? "").split("\n").map((l) => l.trim()).filter((l) => l.startsWith("{"));
  for (const line of lines.reverse()) {
    try {
      const data = JSON.parse(line);
      if (data?.error) return { error: String(data.error) };
      return { snapshot: normalize(data) };
    } catch {
      continue;
    }
  }
  return { error: "the helper printed no snapshot" };
}

export function duration(ms) {
  const s = Math.max(0, Math.floor(num(ms) / 1000));
  if (s < 1) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d`;
}

export function ago(at, now) {
  if (!(typeof at === "number" && at > 0)) return "";
  return duration(now - at);
}

export function agoPhrase(at, now) {
  const text = ago(at, now);
  if (!text) return "";
  return text === "now" ? "just now" : `${text} ago`;
}

export function activityText(activity) {
  const kind = activity?.kind;
  if (!kind || kind === "idle") return "nothing right now";
  const detail = String(activity.detail ?? "").trim();
  return !detail || detail === kind ? kind : `${kind}: ${detail}`;
}

export function plainText(text) {
  return String(text ?? "")
    .replace(/\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?/g, " ")
    .replace(/\*\*|__|`/g, "")
    .replace(/(^|\s)#{1,6}\s+/g, "$1")
    .replace(/\s*\|\s*/g, " · ")
    .replace(/(\s*·\s*)+/g, " · ")
    .replace(/^\s*·\s*|\s*·\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function clampText(text, chars) {
  const s = String(text ?? "");
  return s.length <= chars ? s : `${s.slice(0, Math.max(0, chars - 1)).trimEnd()}…`;
}

export function compact(n) {
  const v = num(n);
  if (v < 1000) return String(Math.round(v));
  if (v < 1e6) return `${(v / 1000).toFixed(v < 1e4 ? 1 : 0)}k`;
  return `${(v / 1e6).toFixed(1)}M`;
}

export function modelLabel(model) {
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d+))?/.exec(String(model ?? "").toLowerCase());
  if (!m) return model ? String(model) : "";
  const family = m[1][0].toUpperCase() + m[1].slice(1);
  return m[3] && m[3].length < 3 ? `${family} ${m[2]}.${m[3]}` : `${family} ${m[2]}`;
}
