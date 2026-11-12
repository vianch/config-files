import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ago, cronPeriod, digest, duration, groupItems, humanCron, nextMoment, nextUp, parseOutput, pollMs, progress,
  sessionLabel, shownInLayout, tickMs, until, urgency,
} from "./data.js";

const T = 1794470000000;
const monitor = (over = {}) => ({ id: "m", kind: "monitor", status: "running", startedAt: T, deadlineAt: T + 1800000, ...over });
const cron = (over = {}) => ({ id: "c", kind: "cron", status: "armed", startedAt: T, nextAt: T + 600000, recurring: false, ...over });
const wake = (over = {}) => ({ id: "w", kind: "loop", via: "wakeup", status: "sleeping", startedAt: T, nextAt: T + 300000, ...over });

test("durations read like a clock a person glances at", () => {
  assert.equal(duration(42000), "42s");
  assert.equal(duration(252000), "4m 12s");
  assert.equal(duration(12 * 60000 + 5000), "12m");
  assert.equal(duration(2 * 3600000 + 5 * 60000), "2h 05m");
  assert.equal(duration(3 * 86400000 + 4 * 3600000), "3d 4h");
  assert.equal(until(T + 500, T), "now");
  assert.equal(until(T + 90000, T), "in 1m 30s");
  assert.equal(ago(T - 1000, T), "just now");
});

test("cron expressions become words where the shape is common, else stay as written", () => {
  assert.equal(humanCron("*/5 * * * *"), "every 5 min");
  assert.equal(humanCron("7 * * * *"), "hourly at :07");
  assert.equal(humanCron("3 9 * * *"), "daily 09:03");
  assert.equal(humanCron("57 8 * * 1-5"), "weekdays 08:57");
  assert.equal(humanCron("7 9 25 12 *"), "Dec 25 · 09:07");
  assert.equal(humanCron("0 */2 * * *"), "every 2h at :00");
  assert.equal(humanCron("1,31 * * * *"), "1,31 * * * *");
  assert.equal(cronPeriod("*/5 * * * *"), 300000);
  assert.equal(cronPeriod("3 9 * * *"), 86400000);
  assert.equal(cronPeriod("3 9 * * 1-5"), null);
});

test("each kind names its next moment: monitors expire, wakeups wake, crons fire", () => {
  assert.deepEqual(nextMoment(monitor()), { at: T + 1800000, verb: "expires" });
  assert.equal(nextMoment(monitor({ deadlineAt: null, persistent: true })), null);
  assert.deepEqual(nextMoment(wake()), { at: T + 300000, verb: "wakes" });
  assert.equal(nextMoment(wake({ status: "running" })), null);
  assert.deepEqual(nextMoment(cron()), { at: T + 600000, verb: "fires" });
  assert.equal(nextMoment(cron({ status: "ended" })), null);
});

test("monitors drain toward expiry while wakeups and crons fill toward their fire time", () => {
  assert.equal(progress(monitor(), T + 900000), 0.5);
  assert.equal(progress(monitor({ deadlineAt: null }), T), 1);
  assert.equal(progress(wake(), T + 150000), 0.5);
  assert.equal(progress(cron({ recurring: true, schedule: "*/10 * * * *", nextAt: T + 300000 }), T), 0.5);
  assert.equal(progress(cron(), T + 9e9), 1);
});

test("a monitor close to expiry warns, then turns critical", () => {
  assert.equal(urgency(monitor(), T), "calm");
  assert.equal(urgency(monitor(), T + 1800000 - 4 * 60000), "warn");
  assert.equal(urgency(monitor(), T + 1800000 - 60000), "critical");
  assert.equal(urgency(cron(), T), "calm");
});

test("items group by kind, soonest first, with ended ones apart and newest first", () => {
  const items = [cron({ id: "c2", nextAt: T + 900000 }), cron({ id: "c1" }), monitor(), wake(),
    monitor({ id: "old", status: "ended", endedAt: T + 10 }), monitor({ id: "new", status: "ended", endedAt: T + 20 })];
  const { active, ended, count } = groupItems(items);
  assert.deepEqual(active.cron.map((i) => i.id), ["c1", "c2"]);
  assert.deepEqual(ended.map((i) => i.id), ["new", "old"]);
  assert.equal(count, 4);
  assert.equal(nextUp(items, T).item.id, "w");
  assert.equal(nextUp([], T), null);
});

test("clocks tick every second only when something is near and the panel is shown", () => {
  assert.equal(tickMs([wake()], T, true), 1000);
  assert.equal(tickMs([cron({ nextAt: T + 3600000 })], T, true), 15000);
  assert.equal(tickMs([wake()], T, false), 30000);
  assert.equal(pollMs(true, 2), 4000);
  assert.equal(pollMs(false, 2), 30000);
});

test("the helper's output parses, and failures read as a sentence", () => {
  assert.deepEqual(parseOutput('{"v":1,"at":1,"sessions":[],"items":[]}').snapshot.items, []);
  assert.equal(parseOutput('{"v":1,"error":"boom"}').error, "boom");
  assert.equal(parseOutput("").error, "the helper printed nothing");
  assert.equal(parseOutput("{").error, "unreadable helper output");
});

test("sessions are named by their Herdr space and title, else their folder", () => {
  const agents = [{ address: "t8", space_name: "herdr-app" }];
  assert.equal(sessionLabel({ terminal: "t8", title: "Fix login", cwd: "/x/y" }, agents), "herdr-app · Fix login");
  assert.equal(sessionLabel({ terminal: null, title: null, cwd: "/Users/me/shop" }, agents), "shop");
});

test("the panel knows when its stack hides it", () => {
  const tree = { type: "stack", active: "office", children: [{ id: "office", content: { mod: "agent-office" } }, { id: "monitors", content: { mod: "agent-monitors" } }] };
  assert.equal(shownInLayout(tree, "agent-monitors"), false);
  assert.equal(shownInLayout({ ...tree, active: "monitors" }, "agent-monitors"), true);
  assert.notEqual(digest({ items: [monitor()], sessions: [] }), digest({ items: [], sessions: [] }));
});
