import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { settings } from "herdr";
import { JEV_FLOOR, VERDICTS, VERDICT_LABEL, firstLine, relTime, shortType } from "./data.js";
import { alpha, button, chromeIcon, count, counted, forkGlyph, heading, meterRow, para, percent, score, tag, verdictBadge } from "./ui.js";

export const LIVE_MS = 60000;
export const ALL = { verdict: "all", type: "all", fork: "all" };
export const FORKS = ["all", "sharp", "split"];

function verdictLine(d) {
  const jev = d.jev;
  if (d.verdict === "jev") return `Jev answered ${score(jev?.confidence)}, at or over the ${score(jev?.floor)} floor`;
  if (d.verdict === "model") return `${d.backend} decided; Jev was not named`;
  if (d.verdict === "rules") return "Rules only: no model was asked";
  if (jev?.unavailable) return `Jev unavailable: ${jev.reason ?? "no answer"}`;
  const stance = jev?.wanted ? `; it ${jev.stance === "agrees" ? "agreed on" : "wanted"} ${jev.wanted}` : "";
  return `Jev answered ${score(jev?.confidence)}, under the ${score(jev?.floor)} floor${stance}`;
}

export function note(t, text, spinning) {
  return h_flex().gap(8).items_center().px(4).py(10).text_size(12).text_color(t.dim)
    .when(spinning, (el) => el.child(svg(chromeIcon("spinner")).size(12).text_color(t.dim).spin(900)))
    .child(text);
}

export function problem(t, pal, text) {
  return div().rounded(8).border(1).border_color(alpha(pal.danger, "80")).bg(alpha(pal.danger, "14")).px(10).py(8)
    .text_size(11.5).text_color(t.foreground).child(text);
}

export function emptySources(view, t) {
  return v_flex().gap(10).p(14).rounded(10).border(1).border_color(t.border).bg(t.surface)
    .child(heading(t, "No decision history", t.accent))
    .child(para(t, "Decisions land in a repo's history file once the fork layer runs there:", t.muted))
    .child(div().px(8).py(6).rounded(6).bg(t.background).font_family(settings()?.font_family ?? "JetBrains Mono").text_size(11).text_color(t.foreground)
      .child("<repo>/.claude/vistack/decision-history.jsonl"))
    .child(para(t, "This panel looks in the layout's paths and walks up from every local space and terminal folder. Open a terminal in such a repo, or add its folder.", t.muted))
    .child(h_flex().child(button(t, "jd-empty-add", "Add folder…", (_e, cx) => view.addFolder(cx), chromeIcon("folder-plus"))));
}

export function nowCard(t, pal, mono, d, now) {
  const color = pal[d.verdict];
  const live = d.at != null && now - d.at < LIVE_MS;
  const jev = d.jev;
  const floor = jev?.floor ?? JEV_FLOOR;
  const meters = [];
  if (jev && !jev.unavailable) meters.push(meterRow(t, "Jev", jev.confidence, color, floor, mono));
  if (d.verdict !== "jev") meters.push(meterRow(t, d.verdict === "model" ? d.backend : "Rules", d.confidence, d.verdict === "overruled" ? pal.rules : color, jev ? null : floor, mono));
  const sub = d.role ?? (d.tier && d.tier !== d.action ? d.tier : null);
  return v_flex().id("jd-now").flex_none().rounded(10).border(1).border_color(live ? color : t.border).bg(t.surface).p(12).gap(9)
    .child(h_flex().gap(6).items_center()
      .child(heading(t, live ? "Now" : "Latest", live ? color : t.dim))
      .child(tag(t, d.type))
      .when(Boolean(d.source), (el) => el.child(tag(t, d.source)))
      .child(div().flex_1())
      .child(div().flex_none().text_size(11).text_color(t.dim).child(relTime(d.at, now))))
    .child(h_flex().gap(8).items_baseline().min_w(0)
      .child(div().min_w(0).truncate().text_size(24).font_semibold().child(d.action))
      .when(Boolean(sub), (el) => el.child(div().min_w(0).truncate().text_size(12.5).text_color(t.muted).child(`→ ${sub}`))))
    .child(h_flex().gap(8).items_center()
      .child(verdictBadge(color, VERDICT_LABEL[d.verdict]))
      .child(div().flex_1().min_w(0).text_size(11.5).line_height(1.35).text_color(t.muted).child(verdictLine(d))))
    .child(v_flex().gap(4).children(meters)
      .when(!jev || !jev.unavailable, (el) => el.child(h_flex().gap(8)
        .child(div().w(64).flex_none())
        .child(div().flex_1().relative().h(12)
          .child(div().absolute().top(0).left(`${floor * 100}%`).ml(-1).whitespace_nowrap().text_size(9.5).text_color(t.dim).child(`▲ floor ${score(floor)}`)))
        .child(div().w(34).flex_none()))))
    .when(Boolean(firstLine(d.request)), (el) => el.child(div().border_t(1).border_color(alpha(t.border, "80")).pt(8)
      .text_size(12).line_height(1.4).text_color(t.muted).max_h(42).overflow_hidden().child(firstLine(d.request))));
}

export function tally(view, t, pal, s, wide) {
  const verdicts = VERDICTS.filter((v) => v !== "model" || s.byVerdict.model > 0);
  const present = verdicts.filter((v) => s.byVerdict[v] > 0);
  const asked = s.byVerdict.jev + s.byVerdict.overruled - s.unavailable;
  const tiles = [
    ["Jev accepted", percent(s.acceptance), `${count(s.byVerdict.jev)} of ${counted(asked, "answer")}`],
    ["Avg Jev conf", score(s.avgJevConfidence), `floor ${score(JEV_FLOOR)}`],
    ["Turn spend", `$${s.usd.toFixed(2)}`, `${counted(s.turns, "turn")} · agents apart`, `Main-turn cost. An agent reports its running total, so ${counted(s.agentRuns, "agent run")} (largest $${s.agentPeakUsd.toFixed(2)}) show per row, not summed.`],
    ["Aborted", count(s.aborted), `${count(s.pending)} no outcome`],
    ["Model match", percent(s.agreement), `of ${counted(s.compared, "pick")}`],
  ];
  return v_flex().id("jd-tally").flex_none().rounded(10).border(1).border_color(t.border).bg(t.surface).p(12).gap(10)
    .child(h_flex().gap(8).items_center()
      .child(heading(t, "Tally"))
      .child(div().text_size(10.5).text_color(t.dim).child(counted(s.total, "decision")))
      .child(div().flex_1())
      .when(view.window.bad > 0, (el) => el.child(div().text_size(10.5).text_color(pal.danger).child(`${count(view.window.bad)} unparsable`))))
    .child(h_flex().h(10).w_full().gap(2).children(present.map((v) => div().id(`jd-seg-${v}`).h_full().flex_basis(0).flex_grow(s.byVerdict[v])
      .min_w(3).rounded(3).bg(pal[v]).cursor_pointer().tooltip(`${VERDICT_LABEL[v]}: ${count(s.byVerdict[v])}`)
      .on_click((_e, cx) => view.setFilter({ verdict: view.filter.verdict === v ? "all" : v }, cx)))))
    .child(h_flex().flex_wrap().gap_x(14).gap_y(4).children(verdicts.map((v) => h_flex().gap(5).items_center()
      .child(div().size(7).rounded(2).bg(pal[v]))
      .child(div().text_size(11).text_color(t.muted).child(VERDICT_LABEL[v]))
      .child(div().text_size(11).font_semibold().child(count(s.byVerdict[v])))
      .child(div().text_size(10.5).text_color(t.dim).child(percent(s.total ? s.byVerdict[v] / s.total : null))))))
    .child(h_flex().flex_wrap().gap(6).children(tiles.map(([label, value, sub, hint]) => v_flex().id(`jd-tile-${label}`).when(Boolean(hint), (el) => el.tooltip(hint)).flex_grow(1).flex_basis(wide ? "17%" : "30%").min_w(86)
      .rounded(8).bg(alpha(t.background, "b3")).border(1).border_color(alpha(t.border, "66")).px(9).py(7).gap(1)
      .child(div().text_size(10).text_color(t.dim).child(label))
      .child(div().text_size(17).font_semibold().child(value))
      .child(div().truncate().text_size(10).text_color(t.dim).child(sub)))));
}

export function filters(view, t, pal, s, filter) {
  const chip = (id, text, active, color, onClick, dot = false) => h_flex().id(id).flex_none().h(24).px(9).gap(5).items_center().rounded(12).border(1)
    .border_color(active ? color : t.border).bg(active ? alpha(color, "26") : t.surface).text_size(11)
    .text_color(active ? t.foreground : t.muted).cursor_pointer().hover((el) => el.bg(t.hover)).on_click(onClick)
    .when(dot, (el) => el.child(div().size(7).rounded(4).bg(color)))
    .child(text);
  const verdicts = ["all", ...VERDICTS.filter((v) => v !== "model" || s.byVerdict.model > 0)];
  const types = s.types.length > 1 ? ["all", ...s.types.map(([type]) => type)] : [];
  const typeCount = new Map(s.types);
  return v_flex().flex_none().gap(7)
    .child(h_flex().flex_wrap().gap(6).children(verdicts.map((v) => chip(`jd-fv-${v}`,
      v === "all" ? `All ${count(s.total)}` : `${VERDICT_LABEL[v]} ${count(s.byVerdict[v])}`,
      filter.verdict === v, v === "all" ? t.accent : pal[v], (_e, cx) => view.setFilter({ verdict: v }, cx), v !== "all"))))
    .child(h_flex().flex_wrap().gap(6).items_center()
      .children(types.map((type) => chip(`jd-ft-${type}`, type === "all" ? "all types" : `${shortType(type)} ${count(typeCount.get(type))}`,
        filter.type === type, t.accent, (_e, cx) => view.setFilter({ type }, cx))))
      .child(div().flex_1())
      .child(h_flex().flex_none().h(24).p(2).gap(2).rounded(12).border(1).border_color(t.border).bg(t.surface)
        .children(FORKS.map((fork) => h_flex().id(`jd-ff-${fork}`).h_full().px(8).gap(4).items_center().rounded(10)
          .when(filter.fork === fork, (el) => el.bg(t.selected)).text_size(10.5).text_color(filter.fork === fork ? t.foreground : t.muted)
          .cursor_pointer().hover((el) => el.text_color(t.foreground)).on_click((_e, cx) => view.setFilter({ fork }, cx))
          .when(fork !== "all", (el) => el.child(forkGlyph(t, fork)))
          .child(fork === "all" ? "any" : fork)))));
}
