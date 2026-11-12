import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activityText, duration, advisorAgents, ago, agoPhrase, claudeCandidates, clampText, coordinatorLook, look, money,
  WALL_PX, buildingWidth, compact, modelLabel, normalize, packFloor, suiteStacks, tilesFor, parseHelperOutput, pickSession, focusMoved, focusedSession, pollDelay, roleOf, roomsOf, shouldNotify, shownInLayout, stepSession,
  FLOOR_PROPS, WALL_PROPS, plainText,
} from "./data.js";
import SIZES from "./sprites/sizes.js";

const agent = (over) => ({ id: over.id ?? "a", type: "crew:implementer", status: "running", ...over });

test("departments keep the deck's order, hide empty ones, and leave advisor agents to the advisor seat", () => {
  const rooms = roomsOf([
    agent({ id: "1", type: "general-purpose" }),
    agent({ id: "2", type: "crew:qa-verifier" }),
    agent({ id: "3", type: "crew:analyst" }),
    agent({ id: "4", type: "crew:advisor" }),
    agent({ id: "5", type: "crew:senior-implementer" }),
    agent({ id: "6", type: "crew:implementer" }),
  ]);
  assert.deepEqual(rooms.map((r) => r.label), ["Research", "Architecture", "Engineering", "QA & Review", "Operations"]);
  assert.deepEqual(rooms.find((r) => r.role === "builder").agents.map((a) => a.id), ["6"]);
  assert.deepEqual(advisorAgents([agent({ id: "4", type: "crew:advisor" }), agent({ id: "9" })]).map((a) => a.id), ["4"]);
});

test("a snapshot's own role wins over the type regex, and senior beats implement", () => {
  assert.equal(roleOf({ type: "crew:senior-implementer" }), "wizard");
  assert.equal(roleOf({ type: "crew:devops" }), "helper");
  assert.equal(roleOf({ type: "whatever", role: "critic" }), "critic");
  assert.equal(roleOf({ type: "whatever", role: "nonsense" }), "helper");
  assert.equal(roleOf({}), "helper");
});

test("only Claude Code agents on this machine are session candidates", () => {
  const list = claudeCandidates([
    { address: "t1", app: "claude-code", program: { key: "claude" }, space: "s1", space_name: "bakery", tab_name: "1", title: "Fix login", seq: 3 },
    { address: "t2", app: "codex", program: { key: "codex" }, space: "s1", space_name: "bakery", tab_name: "2", title: "x", seq: 9 },
    { address: "t3", app: null, program: { key: "claude" }, space: "s2", space_name: "shop", tab_name: "review", title: "", seq: 5 },
    { address: "vps/t4", app: "claude-code", program: { key: "claude" }, space: "vps/s9", space_name: "vps", tab_name: "1", title: "", seq: 7 },
    { address: "t5", app: "claude-code", program: { key: "claude", name: "Claude Code" }, space: "s2", space_name: "shop", tab_name: "new rules", title: "✳ Claude Code", seq: 2 },
    { address: "t6", app: "claude-code", program: { key: "claude", name: "Claude Code" }, space: "s2", space_name: "shop", tab_name: "3", title: "⠂ Round totals to cents", seq: 1 },
  ], [{ id: "s1", machine: null }, { id: "s2", machine: null }, { id: "vps/s9", machine: "vps" }]);
  assert.deepEqual(list.map((c) => c.address), ["t1", "t3", "t5", "t6"]);
  assert.equal(list[0].label, "bakery · Fix login");
  assert.equal(list[1].label, "shop · review");
  assert.equal(list[2].label, "shop · new rules");
  assert.equal(list[3].label, "shop · Round totals to cents");
});

test("the session pick: a pin while it exists, then the focused session, then the one already shown, then most recent", () => {
  const c = [
    { address: "t1", seq: 3, focused: false },
    { address: "t3", seq: 5, focused: false },
    { address: "t8", seq: 1, focused: true },
  ];
  const unfocused = c.map((x) => ({ ...x, focused: false }));
  assert.deepEqual(pickSession(c, { pinned: "t3" }), { address: "t3", why: "pinned" });
  assert.deepEqual(pickSession(c, { pinned: "gone" }), { address: "t8", why: "focused" });
  assert.deepEqual(pickSession(unfocused, {}), { address: "t3", why: "recent" });
  assert.deepEqual(pickSession(c, { following: "t1" }), { address: "t8", why: "focused" });
  assert.deepEqual(pickSession(c, { pinned: "gone", following: "t1" }), { address: "t8", why: "focused" });
  assert.deepEqual(pickSession(unfocused, { following: "t1" }), { address: "t1", why: "following" });
  assert.deepEqual(pickSession(c, { following: "gone" }), { address: "t8", why: "focused" });
  assert.equal(pickSession([], { pinned: "t3" }), null);
});

test("a focused session that can't be read falls back to the one already shown", () => {
  const c = [
    { address: "t1", seq: 3, focused: false },
    { address: "t8", seq: 1, focused: true },
  ];
  assert.deepEqual(pickSession(c, { following: "t1", skipped: new Set(["t8"]) }), { address: "t1", why: "following" });
});

test("a pick from the list holds until focus moves to a different Claude session", () => {
  assert.equal(focusMoved(undefined, "t8"), false);
  assert.equal(focusMoved("t8", "t8"), false);
  assert.equal(focusMoved("t8", null), false);
  assert.equal(focusMoved("t8", "t3"), true);
  assert.equal(focusMoved(null, "t3"), true);
  assert.equal(focusedSession([{ address: "t1", focused: false }, { address: "t3", focused: true }]), "t3");
  assert.equal(focusedSession([{ address: "t1", focused: false }]), null);
});

test("the automatic pick skips sessions whose snapshot failed, unless none is left", () => {
  const c = [
    { address: "t1", seq: 3, focused: false },
    { address: "t3", seq: 5, focused: false },
    { address: "t8", seq: 1, focused: true },
  ];
  assert.deepEqual(pickSession(c, { skipped: new Set(["t8"]) }), { address: "t3", why: "recent" });
  assert.deepEqual(pickSession(c, { skipped: new Set(["t8", "t3"]) }), { address: "t1", why: "recent" });
  assert.deepEqual(pickSession(c, { skipped: new Set(["t8", "t3", "t1"]) }), { address: "t8", why: "fallback" });
  assert.deepEqual(pickSession(c, { pinned: "t8", skipped: new Set(["t8"]) }), { address: "t8", why: "pinned" });
});

test("cycling sessions wraps both ways", () => {
  const c = [{ address: "t1" }, { address: "t3" }, { address: "t8" }];
  assert.equal(stepSession(c, "t3", 1), "t8");
  assert.equal(stepSession(c, "t8", 1), "t1");
  assert.equal(stepSession(c, "t1", -1), "t8");
  assert.equal(stepSession(c, "gone", 1), "t1");
  assert.equal(stepSession([], "t1", 1), null);
});

test("poll fast while anything moves, slow when the office is quiet", () => {
  assert.equal(pollDelay(null), 10000);
  assert.equal(pollDelay({ session: { live: true }, coordinator: { state: "thinking" }, agents: [] }), 2000);
  assert.equal(pollDelay({ session: { live: true }, coordinator: { state: "idle" }, agents: [{ status: "waiting" }] }), 2000);
  assert.equal(pollDelay({ session: { live: true }, coordinator: { state: "idle" }, agents: [{ status: "completed" }, { status: "idle" }] }), 10000);
  assert.equal(pollDelay({ session: { live: false }, coordinator: { state: "thinking" }, agents: [] }), 10000);
});

test("the crew's engine total wins, then the lead's, then the estimate (marked)", () => {
  assert.deepEqual(money({ usdEngineTeam: 67.95, usdEngine: 12.75, usdEstimate: 67.41 }), { text: "$67.95", estimated: false, crew: true });
  assert.deepEqual(money({ usdEngineTeam: null, usdEngine: 8.1409079, usdEstimate: 7.2 }), { text: "$8.14", estimated: false, crew: false });
  assert.deepEqual(money({ usdEngine: null, usdEstimate: 7.256 }), { text: "$7.26", estimated: true, crew: true });
  assert.deepEqual(money({}), { text: "$0.00", estimated: true, crew: true });
  assert.deepEqual(money(undefined), { text: "$0.00", estimated: true, crew: true });
});

test("each status has one look: only live agents animate", () => {
  assert.deepEqual(look("running"), { animate: true, mark: null, still: false });
  assert.deepEqual(look("pending"), { animate: true, mark: null, still: false });
  assert.deepEqual(look("waiting"), { animate: false, mark: "wait", still: false });
  assert.deepEqual(look("idle"), { animate: false, mark: null, still: true });
  assert.deepEqual(look("completed"), { animate: false, mark: "done", still: true });
  assert.deepEqual(look("failed"), { animate: false, mark: "fail", still: true });
  assert.deepEqual(look("killed"), { animate: false, mark: "fail", still: true });
  assert.deepEqual(look("mystery"), { animate: false, mark: null, still: true });
});

test("coordinator states use the deck's labels; waiting on you warns", () => {
  assert.deepEqual(coordinatorLook("waiting-you"), { label: "waiting on you", warn: true, busy: true });
  assert.deepEqual(coordinatorLook("tool"), { label: "running a tool", warn: false, busy: true });
  assert.deepEqual(coordinatorLook("idle"), { label: "idle", warn: false, busy: false });
  assert.deepEqual(coordinatorLook(undefined), { label: "idle", warn: false, busy: false });
});

test("a partial snapshot normalizes without throwing", () => {
  const s = normalize({ v: 1, at: 5, agents: [{ id: "x" }, null], comms: "nope" });
  assert.equal(s.at, 5);
  assert.deepEqual(s.agents.map((a) => a.id), ["x"]);
  assert.equal(s.agents[0].status, "idle");
  assert.deepEqual(s.comms, []);
  assert.deepEqual(s.skills, []);
  assert.equal(s.owner.asks, 0);
  assert.equal(s.coordinator.state, "idle");
  assert.equal(s.advisor.consults, 0);
  assert.equal(s.session.live, false);
});

test("the helper's last JSON line is the snapshot; an error object or garbage is an error", () => {
  assert.equal(parseHelperOutput('warming up\n{"v":1,"at":7,"agents":[]}\n').snapshot.at, 7);
  assert.equal(parseHelperOutput('{"error":"no session for t9"}').error, "no session for t9");
  assert.match(parseHelperOutput("Traceback (most recent call last)").error, /no snapshot/);
  assert.match(parseHelperOutput("").error, /no snapshot/);
});

test("re-render on change, every poll while live, and at least every 30 s for the clocks", () => {
  assert.equal(shouldNotify("a", "b", false, 0), true);
  assert.equal(shouldNotify("a", "a", true, 0), true);
  assert.equal(shouldNotify("a", "a", false, 5000), false);
  assert.equal(shouldNotify("a", "a", false, 30000), true);
});

test("times read short; text clamps to a budget with an ellipsis", () => {
  assert.equal(ago(1000, 1000), "now");
  assert.equal(ago(1000, 46000), "45s");
  assert.equal(ago(1000, 126000), "2m");
  assert.equal(ago(1000, 2 * 3600000 + 61000), "2h 1m");
  assert.equal(ago(1000, 50 * 3600000), "2d");
  assert.equal(ago(null, 5), "");
  assert.equal(ago(0, 5000), "");
  assert.equal(duration(185403), "3m");
  assert.equal(duration(undefined), "now");
  assert.equal(agoPhrase(1000, 1200), "just now");
  assert.equal(agoPhrase(1000, 126000), "2m ago");
  assert.equal(agoPhrase(null, 5), "");
  assert.equal(activityText({ kind: "thinking", detail: "thinking" }), "thinking");
  assert.equal(activityText({ kind: "tool", detail: "Bash pnpm test" }), "tool: Bash pnpm test");
  assert.equal(activityText({ kind: "idle", detail: "" }), "nothing right now");
  assert.equal(activityText(null), "nothing right now");
  assert.equal(clampText("short", 10), "short");
  assert.equal(clampText("abcdefghijk", 6), "abcde…");
  assert.equal(clampText(null, 6), "");
});

test("models and token counts read like the deck", () => {
  assert.equal(modelLabel("claude-opus-5-5[1m]"), "Opus 5.5");
  assert.equal(modelLabel("claude-fable-5-2"), "Fable 5.2");
  assert.equal(modelLabel("claude-sonnet-4-5-20250929"), "Sonnet 4.5");
  assert.equal(modelLabel("claude-opus-4-20250514"), "Opus 4");
  assert.equal(modelLabel("gpt-x"), "gpt-x");
  assert.equal(modelLabel(null), "");
  assert.equal(compact(812), "812");
  assert.equal(compact(12345), "12k");
  assert.equal(compact(1234), "1.2k");
  assert.equal(compact(193847), "194k");
  assert.equal(compact(2244604), "2.2M");
});

test("the office counts as shown only when no hidden node or other stack child covers it", () => {
  const tree = (hidden, active) => ({ id: "root", type: "row", children: [
    { id: "side", type: "column", hidden, children: [
      { id: "right-stack", type: "stack", active, children: [
        { id: "office", type: "block", content: { mod: "agent-office" } },
        { id: "notes", type: "block", content: { mod: "notes" } },
      ] },
    ] },
  ] });
  assert.equal(shownInLayout(tree(false, "office"), "agent-office"), true);
  assert.equal(shownInLayout(tree(false, "decisions"), "agent-office"), false);
  assert.equal(shownInLayout(tree(true, "office"), "agent-office"), false);
  assert.equal(shownInLayout({ id: "root", type: "row", children: [] }, "agent-office"), true);
  assert.equal(shownInLayout(null, "agent-office"), true);
});

test("a hidden office polls rarely", () => {
  assert.equal(pollDelay({ session: { live: true }, coordinator: { state: "thinking" }, agents: [] }, false), 30000);
});

test("every sprite the scene asks for was generated", () => {
  const roles = ["owner", "coordinator", "advisor", "scout", "scholar", "wizard", "builder", "critic", "captain", "helper"];
  const props = [...Object.values(WALL_PROPS), ...Object.values(FLOOR_PROPS)].flat();
  const fixed = ["desk", "desk-big", "monitor-off", "monitor-on-0", "monitor-on-1", "coffee-0", "rug", "books", "lamp", "door", "plant",
    "bubble-wait", "bubble-wait-l", "bubble-idle", "bubble-idle-l", "badge-done", "badge-fail", "server-0", "server-1"];
  const floors = ["exec", "scout", "scholar", "wizard", "builder", "critic", "captain", "helper"].map((f) => `floor-${f}`);
  const missing = [...roles.flatMap((r) => [`${r}-0`, `${r}-1`]), ...props.map((p) => (SIZES[p] ? p : `${p}-0`)), ...fixed, ...floors].filter((n) => !SIZES[n]);
  assert.deepEqual(missing, []);
});

test("comms text drops markdown noise", () => {
  assert.equal(plainText("**This session** | Your prompt |"), "This session · Your prompt");
  assert.equal(plainText("| Session | What |\n|---|---|\n| a | b |"), "Session · What · a · b");
  assert.equal(plainText("pushed as `a3ca456`"), "pushed as a3ca456");
  assert.equal(plainText("## Result All three threads"), "Result All three threads");
  assert.equal(plainText("issue #4302 stays"), "issue #4302 stays");
  assert.equal(plainText(null), "");
});

const SLOT = 127;
const PAD = 12;
const rowWidth = (row) => row.rooms.reduce((sum, r) => sum + r.width, 0) + WALL_PX * (row.rooms.length - 1);

for (const [label, desks] of [["lead", [1, 3, 3]], ["portal", [1, 1, 6, 1, 1]], ["sample", [2, 2, 3, 2, 1]], ["one room", [1]]]) {
  for (const width of [340, 520, 809, 900, 1000]) {
    test(`packed floor (${label}) at ${width} px: every row fills the width and its rooms share one height`, () => {
      const rows = packFloor(desks, width, SLOT, PAD);
      assert.deepEqual(rows.flatMap((row) => row.rooms.map((r) => r.index)), desks.map((_, i) => i));
      for (const row of rows) {
        assert.equal(rowWidth(row), width);
        for (const room of row.rooms) assert.ok(Math.ceil(room.desks / room.perLine) <= row.lines);
        if (row.rooms.length > 1) for (const room of row.rooms) assert.ok(room.width >= room.need, `${room.width} < ${room.need}`);
      }
      assert.ok(rows.every((row) => row.rooms.length === 1 || row.lines === 1));
    });
  }
}

test("packed floor puts rooms side by side when they fit and wraps the rest", () => {
  assert.deepEqual(packFloor([1, 3, 3], 520, SLOT, PAD).map((row) => row.rooms.map((r) => r.index)), [[0], [1], [2]]);
  assert.deepEqual(packFloor([1, 3, 3], 600, SLOT, PAD).map((row) => row.rooms.map((r) => r.index)), [[0, 1], [2]]);
  assert.deepEqual(packFloor([1, 1, 6, 1, 1], 809, SLOT, PAD).map((row) => row.rooms.map((r) => r.index)), [[0, 1], [2], [3, 4]]);
  assert.deepEqual(packFloor([1, 3, 3], 340, SLOT, PAD).map((row) => row.lines), [1, 2, 2]);
  assert.deepEqual(packFloor([], 520, SLOT, PAD), []);
});

test("the suite stacks its two rooms only when narrow; floor tiles always cover a room", () => {
  assert.equal(suiteStacks(340), true);
  assert.equal(suiteStacks(519), true);
  assert.equal(suiteStacks(520), false);
  assert.equal(tilesFor(100, 533), 1);
  assert.equal(tilesFor(533, 533), 2);
  assert.equal(tilesFor(1000, 533), 2);
  assert.equal(tilesFor(1100, 533), 3);
});

test("at the user's 809 px column the six-desk room fits on one line with no spare spot", () => {
  const zoom = 0.9;
  const slot = (34 * 3) / zoom + 8 + 6;
  const inner = buildingWidth(809) - 2 * WALL_PX;
  assert.ok(inner >= 778 && inner <= 781, `inner ${inner}: the measured building at 809 is 784.4 layout px`);
  const rows = packFloor([1, 1, 6, 1, 1], inner, slot, PAD);
  const engineering = rows[1].rooms[0];
  assert.equal(engineering.perLine, 6);
  assert.equal(rows[1].lines, 1);
  assert.ok(engineering.width - PAD - 6 * slot < 20 * (3 / zoom));
});
