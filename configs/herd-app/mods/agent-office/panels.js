import { div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { PIXEL, sprite } from "./art.js";
import { DEPARTMENTS, activityText, ago, agoPhrase, clampText, plainText, compact, dollars, modelLabel, roleOf } from "./data.js";

export const chromeIcon = (name) => `mods/workspace-chrome/${name}.svg`;

export function alpha(color, byte) {
  return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? `${color}${byte}` : color;
}

export function danger(t, dark) {
  return (dark ? t.ansi9 : t.ansi1) ?? t.blocked;
}

const STATUS_WORDS = {
  running: "working",
  pending: "starting",
  waiting: "waiting",
  idle: "idle",
  completed: "done",
  failed: "failed",
  killed: "stopped",
};

export function statusColor(t, dark, status) {
  if (status === "running" || status === "pending") return t.working;
  if (status === "waiting") return t.blocked;
  if (status === "completed") return t.done;
  if (status === "failed" || status === "killed") return danger(t, dark);
  return t.idle ?? t.muted;
}

export function heading(t, text, color) {
  return div().flex_none().font_family(PIXEL).text_size(9.5).text_color(color ?? t.dim).child(text.toUpperCase());
}

export function chip(t, text, color, pulse = false) {
  return h_flex().flex_none().h(18).px(6).gap(5).items_center().rounded(4).bg(alpha(color, "24")).border(1).border_color(alpha(color, "70"))
    .child(div().size(6).rounded(3).bg(color).when(pulse, (el) => el.loop("opacity", { from: 0.25, to: 1, period: 900 })))
    .child(div().font_family(PIXEL).text_size(8.5).text_color(color).child(text.toUpperCase()));
}

export function statusChip(t, dark, status) {
  const live = status === "running" || status === "pending";
  return chip(t, STATUS_WORDS[status] ?? status, statusColor(t, dark, status), live);
}

export function tag(t, text, color) {
  return div().flex_none().h(17).px(5).rounded(3).border(1).border_color(alpha(color ?? t.border, "90")).flex().items_center()
    .text_size(10).text_color(color ?? t.muted).child(text);
}

export function plaque(t) {
  return v_flex().flex_none().px(5).py(2).rounded(4).bg(alpha(t.chrome, "e0")).border(1).border_color(alpha(t.border, "b0"));
}

export function parties(snapshot) {
  const byKey = new Map();
  for (const a of snapshot.agents) {
    const entry = { name: a.nickname || a.name || a.description || a.id, sprite: roleOf(a), agent: a };
    byKey.set(a.id, entry);
    if (a.name) byKey.set(a.name, entry);
  }
  return (key) => {
    if (key === "user") return { name: "You", sprite: "owner" };
    if (key === "coordinator") return { name: "Chief of Staff", sprite: "coordinator" };
    if (key === "advisor") return { name: "Advisor", sprite: "advisor" };
    if (key === "deck") return { name: "Deck", sprite: "helper" };
    return byKey.get(key) ?? { name: String(key ?? "?").split("@")[0], sprite: "helper" };
  };
}

const KIND_COLOR = {
  prompt: "accent",
  answer: "done",
  dispatch: "working",
  report: "done",
  message: "muted",
  question: "blocked",
  advice: "idle",
  action: "dim",
};

function avatar(name) {
  return div().size(20).flex_none().rounded(4).flex().items_center().justify_center().child(sprite(`${name}-0`, 1));
}

export function comms(view, t, snapshot, now) {
  const who = parties(snapshot);
  const all = [...snapshot.comms].sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  const shown = view.allComms ? all : all.slice(0, 8);
  return v_flex().gap(6)
    .child(h_flex().gap(8).items_center()
      .child(heading(t, "Comms"))
      .child(div().text_size(10.5).text_color(t.dim).child(all.length ? `${shown.length} of ${all.length}` : "quiet so far"))
      .child(div().flex_1())
      .when(all.length > 8, (el) => el.child(div().id("ao-comms-more").text_size(11).text_color(t.accent).cursor_pointer()
        .on_click((_e, cx) => {
          view.allComms = !view.allComms;
          cx.notify();
        })
        .child(view.allComms ? "newest 8" : `show all ${all.length}`))))
    .child(v_flex().gap(4).children(shown.map((c, i) => {
      const from = who(c.from);
      const to = who(c.to);
      const color = t[KIND_COLOR[c.kind]] ?? t.muted;
      return h_flex().id(`ao-comm-${i}`).gap(8).items_start().px(8).py(6).rounded(6).bg(t.surface).border(1).border_color(alpha(t.border, "80"))
        .child(avatar(from.sprite))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(h_flex().gap(5).items_center().min_w(0)
            .child(div().flex_none().max_w(120).truncate().text_size(11.5).font_medium().text_color(t.foreground).child(from.name))
            .child(div().flex_none().text_size(10.5).text_color(t.dim).child("→"))
            .child(sprite(`${to.sprite}-0`, 1))
            .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.muted).child(to.name))
            .child(div().flex_none().font_family(PIXEL).text_size(8).text_color(color).child(String(c.kind ?? "").toUpperCase()))
            .child(div().flex_none().min_w(30).text_right().text_size(10).text_color(t.dim).child(ago(c.at, now))))
          .child(div().text_size(11.5).line_height(1.4).text_color(t.foreground).child(clampText(plainText(c.text), 220))));
    })));
}

export function skills(t, snapshot, now) {
  const who = parties(snapshot);
  const list = [...snapshot.skills].sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  return v_flex().gap(6)
    .child(h_flex().gap(8).items_center().child(heading(t, "Skills shelf")).child(div().text_size(10.5).text_color(t.dim).child(list.length ? String(list.length) : "none used yet")))
    .child(h_flex().flex_wrap().gap(6).children(list.map((s, i) => h_flex().id(`ao-skill-${i}`).h(24).px(7).gap(6).items_center().rounded(5)
      .bg(t.surface).border(1).border_color(alpha(t.border, "90"))
      .tooltip(s.agentId ? `${s.skill} · used by ${who(s.agentId).name}` : `${s.skill} · used by the chief of staff`)
      .child(div().size(8).flex_none().rounded(1).bg(alpha(t.accent, "c0")))
      .child(div().max_w(220).truncate().text_size(11).text_color(t.foreground).child(s.skill))
      .child(div().text_size(10).text_color(t.dim).child(ago(s.at, now))))));
}

function pair(t, key, value) {
  return h_flex().gap(8).items_start()
    .child(div().w(76).flex_none().text_size(10.5).text_color(t.dim).child(key))
    .child(div().flex_1().min_w(0).text_size(11.5).line_height(1.4).text_color(t.foreground).child(value));
}

export function detailCard(view, t, dark, agent, now) {
  const tok = agent.tokens;
  const total = tok.in + tok.out + tok.cr + tok.cw;
  const end = agent.endedAt ?? now;
  const act = agent.lastActivity ?? {};
  const dept = DEPARTMENTS[roleOf(agent)];
  return v_flex().id(`ao-detail-${agent.id}`).gap(6).p(10).rounded(8).bg(t.popover).border(1).border_color(alpha(t.accent, "90"))
    .child(h_flex().gap(8).items_center()
      .child(sprite(`${roleOf(agent)}-0`, 2))
      .child(v_flex().flex_1().min_w(0)
        .child(div().truncate().text_size(13).font_semibold().child(agent.nickname || agent.name || agent.id))
        .child(div().truncate().text_size(10.5).text_color(t.dim).child(`${dept.title} · ${dept.label}`)))
      .child(statusChip(t, dark, agent.status))
      .child(div().id("ao-detail-close").size(20).flex_none().rounded(4).flex().items_center().justify_center().cursor_pointer()
        .hover((s) => s.bg(t.hover)).on_click((_e, cx) => {
          view.selected = null;
          cx.notify();
        })
        .child(svg(chromeIcon("x")).size(12).text_color(t.muted))))
    .child(pair(t, "task", agent.description || "—"))
    .child(pair(t, "type", agent.type || "—"))
    .child(pair(t, "kind", agent.kind === "teammate" ? `teammate${agent.name ? ` (${agent.name})` : ""}` : "subagent"))
    .child(pair(t, "model", agent.modelLabel || modelLabel(agent.model) || "—"))
    .child(pair(t, "tokens", total ? `${compact(total)} · in ${compact(tok.in)} · out ${compact(tok.out)} · cache ${compact(tok.cr + tok.cw)}` : "—"))
    .child(pair(t, "cost", `${dollars(agent.usd)}${agent.usdPartial ? " (partial)" : ""}`))
    .child(pair(t, "elapsed", agent.startedAt ? ago(agent.startedAt, end) : "—"))
    .child(pair(t, "last activity", [activityText(act), agoPhrase(act.at, now)].filter(Boolean).join(" · ")))
    .when(Number(agent.toolUses) > 0, (el) => el.child(pair(t, "tools", `${agent.toolUses} calls${agent.advisorConsults ? ` · ${agent.advisorConsults} advisor consults` : ""}`)))
    .when(Boolean(agent.statusReason), (el) => el.child(pair(t, "reason", agent.statusReason)));
}

export function banner(t, color, icon, title, body) {
  return h_flex().flex_none().gap(8).items_start().px(10).py(8).rounded(7).bg(alpha(color, "1c")).border(1).border_color(alpha(color, "70"))
    .child(svg(chromeIcon(icon)).mt(1).size(13).flex_none().text_color(color))
    .child(v_flex().flex_1().min_w(0).gap(2)
      .child(div().text_size(12).font_semibold().text_color(t.foreground).child(title))
      .when(Boolean(body), (el) => el.child(div().text_size(11).line_height(1.4).text_color(t.muted).child(body))));
}

export function emptyOffice(t, title, body) {
  return v_flex().items_center().gap(10).py(36).px(20)
    .child(h_flex().gap(4).items_end().child(sprite("door", 3)).child(sprite("plant", 3)))
    .child(div().font_family(PIXEL).text_size(11).text_color(t.foreground).child(title.toUpperCase()))
    .child(div().max_w(320).text_size(11.5).line_height(1.45).text_color(t.muted).text_center().child(body));
}
