import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { FLOOR, PIXEL, WALL, at, box, cell, figure, flipbook, sizeOf, sprite } from "./art.js";
import {
  FLOOR_PROPS, WALL_PROPS, WALL_PX, advisorAgents, ago, agoPhrase, clampText, compact, coordinatorLook, dollars, duration, look,
  modelLabel, packFloor, roleOf, roomsOf, suiteStacks, tilesFor,
} from "./data.js";
import { alpha, chip, detailCard, parties, plaque, statusChip, tag } from "./panels.js";
import FLOOR_BASE from "./sprites/floors.js";

const ROOM_COLOR = {
  exec: "#b362ff",
  advisor: "#c9a227",
  lobby: "#8b5cf6",
  scout: "#2bb3a3",
  scholar: "#7aa2ff",
  wizard: "#7b5cff",
  builder: "#ff8a3d",
  critic: "#e05a7a",
  captain: "#ffd23f",
  helper: "#29d398",
};

const ROOM_ICON = { lobby: "owner", exec: "coordinator", advisor: "advisor" };

const STATION = [34, 25];
const WALL_ROWS = 16;
const DESK_GAP = 6;
const ROOM_PAD = 8;
const WALL_PROPS_MIN_PX = 240;
const SUITE_GROW = { chief: 3, advisor: 2 };

const stationWidth = () => STATION[0] * cell(FLOOR) + 8;
const slotWidth = () => stationWidth() + DESK_GAP;
const roomPad = () => ROOM_PAD * 2 - DESK_GAP + 2;

function wall(t, key, label, extra, width) {
  const color = ROOM_COLOR[key] ?? t.accent;
  const u = cell(WALL);
  return h_flex().flex_none().relative().h(WALL_ROWS * u).px(8).gap(8).items_end().bg(alpha(t.surface, "f2"))
    .child(div().absolute().left(0).right(0).top(0).h(3).bg(color))
    .child(div().absolute().left(0).right(0).bottom(0).h(u * 2).bg(alpha(t.border, "90")))
    .child(plaque(t).mb(u * 3).min_w(0).child(h_flex().gap(6).items_center()
      .child(sprite(`${ROOM_ICON[key] ?? key}-0`, 1))
      .child(div().font_family(PIXEL).text_size(9.5).text_color(t.foreground).child(label.toUpperCase()))
      .children(extra ?? [])))
    .child(div().flex_1())
    .when(width >= WALL_PROPS_MIN_PX, (el) => el.children((WALL_PROPS[key] ?? []).map((name) => sprite(name, WALL).mb(u * 2))));
}

function room(t, { id, key, floorKey, label, extra, body, width }) {
  const tileWidth = sizeOf(`floor-${floorKey}`)[0] * cell(FLOOR);
  const tiles = Array.from({ length: tilesFor(width, tileWidth) }, () => sprite(`floor-${floorKey}`, FLOOR));
  return v_flex().id(id).relative().min_w(0).bg(FLOOR_BASE[floorKey] ?? t.surface)
    .child(wall(t, key, label, extra, width))
    .child(v_flex().flex_1().relative().overflow_hidden()
      .child(h_flex().absolute().left(0).top(0).children(tiles))
      .child(body));
}

function sharedWalls(t, id, rooms) {
  return h_flex().id(id).w_full().items_stretch()
    .children(rooms.map(({ el, grow }, i) => el.flex_basis(0).flex_grow(grow)
      .when(i > 0, (e) => e.border_l(WALL_PX).border_color(t.border))));
}

function nameplate(t, dark, agent, width) {
  return v_flex().w(width).gap(3).items_center()
    .child(plaque(t).max_w(width).items_center()
      .child(div().max_w(width - 12).truncate().text_size(11).font_semibold().text_color(t.foreground).child(agent.nickname || agent.name || agent.id))
      .child(div().max_w(width - 12).truncate().text_size(9.5).text_color(t.dim).child(agent.title || agent.department || "")))
    .child(statusChip(t, dark, agent.status));
}

export function station(view, t, dark, agent) {
  const lk = look(agent.status);
  const role = roleOf(agent);
  const id = agent.id;
  const u = cell(FLOOR);
  const width = STATION[0] * u;
  const selected = view.selected === id;
  const scene = box(`ao-st-${id}`, STATION[0], STATION[1])
    .when(lk.animate, (el) => el.child(at(div().w(14 * u).h(10 * u).rounded(u * 2).bg(alpha(t.working, "50")), 21, 4)
      .loop("opacity", { from: 0.1, to: 0.7, period: 1400 })))
    .when(lk.mark === "done", (el) => el.child(at(sprite("coffee-0"), 0, 7)))
    .child(at(figure(`ao-fig-${id}`, role, FLOOR, lk.animate, lk.mark === "fail"), 9, 3))
    .child(at(lk.animate ? flipbook(`ao-mon-${id}`, "monitor-on", FLOOR, 1600) : sprite(lk.mark === "wait" ? "monitor-on-0" : "monitor-off"), 22, 5))
    .child(at(sprite("desk"), 1, 16))
    .when(lk.mark === "wait", (el) => el.child(at(sprite("bubble-wait-l"), 0, 1)))
    .when(lk.mark === "done", (el) => el.child(at(sprite("badge-done"), 1, 0)))
    .when(lk.mark === "fail", (el) => el.child(at(sprite("badge-fail"), 1, 0)))
    .when(agent.status === "idle", (el) => el.child(at(sprite("bubble-idle-l"), 0, 0)));
  return v_flex().id(`ao-desk-${id}`).flex_none().w(width + 8).py(4).gap(4).items_center().rounded(8).cursor_pointer()
    .bg(selected ? alpha(t.accent, "26") : "#00000000")
    .border(1).border_color(selected ? alpha(t.accent, "a0") : "#00000000")
    .hover((s) => s.bg(alpha(t.hover, "c0")))
    .tooltip(agent.description || agent.type || "")
    .on_click((_e, cx) => {
      view.selected = selected ? null : id;
      cx.notify();
    })
    .child(scene)
    .child(nameplate(t, dark, agent, width + 4));
}

function floorProp(name, live, id) {
  if (name === "server" && live) return flipbook(id, "server", FLOOR, 900);
  if (name === "server") return sprite("server-0");
  return sprite(name);
}

function hasSpareSpot(packed, rowLines) {
  const lines = Math.ceil(Math.max(1, packed.desks) / packed.perLine);
  const onLastLine = packed.desks - (lines - 1) * packed.perLine;
  const spare = packed.width - roomPad() - onLastLine * slotWidth();
  return lines < rowLines || spare >= 20 * cell(FLOOR);
}

function departmentRoom(view, t, dark, r, packed, rowLines) {
  const live = r.agents.filter((a) => look(a.status).animate).length;
  const extra = [
    div().text_size(10.5).text_color(t.muted).child(String(r.agents.length)),
    ...(live ? [div().text_size(10).text_color(t.working).child(`${live} live`)] : []),
  ];
  const props = hasSpareSpot(packed, rowLines) ? FLOOR_PROPS[r.role] ?? [] : [];
  const body = h_flex().relative().p(ROOM_PAD).flex_wrap().gap(DESK_GAP).items_end()
    .children(r.agents.map((a) => station(view, t, dark, a)))
    .children(props.map((name) => floorProp(name, live > 0, `ao-prop-${r.role}-${name}`).mb(cell(FLOOR) * 12)));
  return room(t, { id: `ao-room-${r.role}`, key: r.role, floorKey: r.role, label: r.label, extra, body, width: packed.width });
}

function floorSections(view, t, dark, agents, width) {
  const rooms = roomsOf(agents);
  if (!rooms.length) {
    const body = div().p(12).text_size(11.5).text_color(t.dim).child("No agents hired yet. Departments open when the chief of staff delegates.");
    return [room(t, { id: "ao-room-empty", key: "helper", floorKey: "helper", label: "The floor", extra: [], body, width })];
  }
  const rows = packFloor(rooms.map((r) => r.agents.length), width, slotWidth(), roomPad());
  return rows.flatMap((row, i) => {
    const line = sharedWalls(t, `ao-floor-row-${i}`, row.rooms.map((packed) => ({
      el: departmentRoom(view, t, dark, rooms[packed.index], packed, row.lines),
      grow: packed.need,
    })));
    const selected = row.rooms.flatMap((packed) => rooms[packed.index].agents).find((a) => a.id === view.selected);
    return selected ? [line, div().id("ao-detail-strip").w_full().p(8).bg(t.surface).child(detailCard(view, t, dark, selected, view.now))] : [line];
  });
}

function lobbyRoom(view, t, snapshot, now, width) {
  const owner = snapshot.owner;
  const u = cell(FLOOR);
  const waiting = snapshot.coordinator.state === "waiting-you";
  const bubbleWidth = Math.max(140, width - 40 * u - 40);
  const budget = Math.max(60, Math.floor(bubbleWidth / 6.4) * 4);
  const text = owner.prompt || "No prompt yet.";
  const long = text.length > budget;
  const shown = view.promptOpen || !long ? text : clampText(text, budget);
  const figureBox = box("ao-owner", 32, 25)
    .child(at(sprite("rug"), 0, 16))
    .child(at(figure("ao-owner-fig", "owner", FLOOR, false), 8, 4))
    .when(waiting, (el) => el.child(at(sprite("bubble-wait"), 19, 0)));
  const bubble = v_flex().id("ao-owner-bubble").flex_1().min_w(0).gap(4)
    .child(v_flex().id("ao-prompt").px(10).py(8).gap(6).rounded(8).bg(t.popover).border(1).border_color(t.border).cursor_pointer()
      .hover((s) => s.border_color(t.accent))
      .on_click((_e, cx) => {
        view.promptOpen = !view.promptOpen;
        cx.notify();
      })
      .child(div().text_size(12).line_height(1.45).text_color(owner.prompt ? t.foreground : t.dim)
        .when(!view.promptOpen, (el) => el.max_h(70).overflow_hidden())
        .child(`“${shown}”`))
      .child(h_flex().gap(6).items_center().flex_wrap()
        .child(tag(t, `asks ${owner.asks}`))
        .when(Boolean(owner.at), (el) => el.child(div().text_size(10.5).text_color(t.dim).child(agoPhrase(owner.at, now))))
        .when(owner.interrupted, (el) => el.child(tag(t, "interrupted", t.blocked)))
        .when(waiting, (el) => el.child(tag(t, "your turn", t.blocked)))
        .child(div().flex_1())
        .when(long, (el) => el.child(div().text_size(10.5).text_color(t.accent).child(view.promptOpen ? "less" : "more")))));
  const body = h_flex().relative().p(10).gap(14).items_start()
    .child(v_flex().flex_none().items_center().gap(2).child(figureBox).child(plaque(t).child(div().text_size(11).font_semibold().child("You · Owner"))))
    .child(bubble);
  return room(t, { id: "ao-lobby", key: "lobby", floorKey: "exec", label: "Lobby", extra: [], body, width });
}

function meta(t, parts) {
  return div().text_size(11).line_height(1.4).text_color(t.muted).child(parts.filter(Boolean).join(" · "));
}

function infoPanel(t) {
  return v_flex().gap(5).px(10).py(8).rounded(6).bg(alpha(t.chrome, "e0")).border(1).border_color(alpha(t.border, "a0"));
}

function chiefRoom(t, snapshot, now, width) {
  const c = snapshot.coordinator;
  const chipLook = coordinatorLook(c.state);
  const typing = ["thinking", "writing", "tool"].includes(c.state);
  const busy = chipLook.busy;
  const color = chipLook.warn ? t.blocked : busy ? t.working : t.idle;
  const u = cell(FLOOR);
  const scene = box("ao-cos", 48, 24)
    .when(busy, (el) => el.child(at(div().w(14 * u).h(10 * u).rounded(u * 2).bg(alpha(t.working, "50")), 29, 2).loop("opacity", { from: 0.1, to: 0.7, period: 1400 })))
    .child(at(figure("ao-cos-fig", "coordinator", FLOOR, typing), 12, 2))
    .child(at(busy ? flipbook("ao-cos-mon", "monitor-on", FLOOR, 1600) : sprite("monitor-off"), 30, 4))
    .child(at(sprite("desk-big"), 2, 15))
    .child(at(sprite("coffee-0"), 4, 7))
    .when(chipLook.warn, (el) => el.child(at(sprite("bubble-wait"), 22, 0)))
    .when(!busy, (el) => el.child(at(sprite("bubble-idle"), 23, 0)));
  const turn = c.turnStartedAt && busy ? `turn ${ago(c.turnStartedAt, now)}` : null;
  const writes = c.codeWrites.length;
  const body = v_flex().relative().p(10).gap(8)
    .child(scene)
    .child(infoPanel(t)
      .child(h_flex().gap(8).items_center().flex_wrap()
        .child(div().text_size(10.5).text_color(t.dim).child("coordinator"))
        .child(div().flex_1())
        .child(chip(t, chipLook.label, color, busy)))
      .child(div().text_size(12).line_height(1.4).text_color(chipLook.warn ? t.blocked : t.foreground)
        .child(`now: ${c.label || chipLook.label}${c.since ? ` (${ago(c.since, now)})` : ""}`))
      .child(meta(t, [c.modelLabel || modelLabel(c.model), turn, dollars(c.usd), `${c.tools} tools`]))
      .child(h_flex().gap(6).flex_wrap()
        .child(writes ? tag(t, `wrote code: ${writes} file${writes === 1 ? "" : "s"}`, t.blocked).tooltip(c.codeWrites.join("\n")) : tag(t, "delegates only", t.done))));
  return room(t, { id: "ao-chief", key: "exec", floorKey: "exec", label: "Chief of Staff", extra: [], body, width });
}

function advisorRoom(t, dark, snapshot, now, width) {
  const a = snapshot.advisor;
  const helpers = advisorAgents(snapshot.agents);
  const advising = helpers.some((h) => look(h.status).animate);
  const last = a.last;
  const who = parties(snapshot);
  const color = advising ? t.working : t.idle;
  const scene = box("ao-owl", 30, 24)
    .child(at(sprite("lamp"), 0, 13))
    .child(at(figure("ao-owl-fig", "advisor", FLOOR, advising), 9, 0))
    .child(at(sprite("books"), 9, 14));
  const outcome = last?.error ? `advisor unavailable (${last.error})` : last?.redacted ? "advice redacted" : last?.advice ? clampText(last.advice, 120) : null;
  const body = v_flex().relative().p(10).gap(8)
    .child(scene)
    .child(infoPanel(t)
      .child(h_flex().gap(8).items_center().flex_wrap()
        .child(div().text_size(10.5).text_color(t.dim).child("board advisor"))
        .child(div().flex_1())
        .child(chip(t, advising ? "advising" : a.available === false ? "off" : "on call", color, advising)))
      .child(meta(t, [`consults ${a.consults}`, last?.endedAt || last?.at ? `last ${agoPhrase(last.endedAt ?? last.at, now)}` : null, a.usd ? dollars(a.usd) : null]))
      .when(Boolean(last), (el) => el.child(meta(t, [
        last.modelLabel || modelLabel(last.model),
        last.in || last.out ? `${compact(last.in)} in / ${compact(last.out)} out` : "tokens not in yet",
        last.usd ? dollars(last.usd) : null,
        last.ms ? `took ${duration(last.ms)}` : null,
        last.by && last.by !== "coordinator" ? `for ${who(last.by).name}` : null,
      ])))
      .when(Boolean(outcome), (el) => el.child(div().text_size(11).text_color(last?.error ? t.blocked : t.dim).child(outcome)))
      .when(helpers.length > 0, (el) => el.child(v_flex().gap(3).children(helpers.map((h) => h_flex().gap(6).items_center()
        .child(sprite("advisor-0", 1))
        .child(div().flex_1().min_w(0).truncate().text_size(11).child(`${h.nickname || h.id} · ${h.description || h.type}`))
        .child(statusChip(t, dark, h.status)))))));
  return room(t, { id: "ao-advisor", key: "advisor", floorKey: "scholar", label: "Advisor", extra: [], body, width });
}

function suiteSections(t, dark, snapshot, now, width) {
  if (suiteStacks(width)) return [chiefRoom(t, snapshot, now, width), advisorRoom(t, dark, snapshot, now, width)];
  const total = SUITE_GROW.chief + SUITE_GROW.advisor;
  const chiefWidth = Math.floor((width * SUITE_GROW.chief) / total);
  return [sharedWalls(t, "ao-suite-row", [
    { el: chiefRoom(t, snapshot, now, chiefWidth), grow: SUITE_GROW.chief },
    { el: advisorRoom(t, dark, snapshot, now, width - chiefWidth), grow: SUITE_GROW.advisor },
  ])];
}

export function building(view, t, dark, snapshot, now, width) {
  const inner = width - 2 * WALL_PX;
  const sections = [
    lobbyRoom(view, t, snapshot, now, inner),
    ...suiteSections(t, dark, snapshot, now, inner),
    ...floorSections(view, t, dark, snapshot.agents, inner),
  ];
  return v_flex().id("ao-building").w_full().rounded(10).overflow_hidden().border(WALL_PX).border_color(t.border)
    .children(sections.map((el, i) => (i === 0 ? el : el.border_t(WALL_PX).border_color(t.border))));
}
