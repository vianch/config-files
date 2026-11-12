import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { JEV_FLOOR, firstLine, relTime, shortType } from "./data.js";
import { alpha, bullets, count, forkGlyph, meter, meterRow, outcomeGlyph, pairs, para, percent, score, section } from "./ui.js";

const REQUEST_LINES = 12;
const REQUEST_CHARS = 1400;
const REQUEST_FULL_LINES = 400;

const shortModel = (id) => id.replace(/^claude-/, "");

export function row(view, t, pal, mono, d, now, wide) {
  const open = view.expanded.has(d.id);
  const color = pal[d.verdict];
  const o = d.outcome;
  const jev = d.jev;
  const confidence = jev && !jev.unavailable ? jev.confidence : d.confidence;
  const sub = d.role ?? (d.tier && d.tier !== d.action ? d.tier : null);
  const ran = [o?.actual ? shortModel(o.actual) : null, o && o.spendUsd > 0 ? `${o.running ? "agent " : ""}$${o.spendUsd.toFixed(2)}` : null].filter(Boolean).join(" · ");
  return v_flex().id(`jd-row-${d.id}`).flex_none().rounded(8).overflow_hidden().border(1)
    .border_color(open ? alpha(color, "80") : alpha(t.border, "73")).bg(open ? t.surface : alpha(t.surface, "59"))
    .child(h_flex().id(`jd-head-${d.id}`).items_stretch().cursor_pointer().hover((el) => el.bg(t.hover)).on_click((_e, cx) => view.toggle(d.id, cx))
      .child(div().w(3).flex_none().bg(color))
      .child(v_flex().flex_1().min_w(0).pl(9).pr(10).py(7).gap(3)
        .child(h_flex().gap(7).items_center()
          .child(div().w(wide ? 66 : 54).flex_none().truncate().font_family("Silkscreen").text_size(8.5).text_color(t.dim).child(shortType(d.type).toUpperCase()))
          .child(div().flex_none().max_w(wide ? 220 : 130).truncate().text_size(13).font_semibold().child(d.action))
          .when(Boolean(sub), (el) => el.child(div().min_w(0).truncate().text_size(11.5).text_color(t.muted).child(`→ ${sub}`)))
          .child(div().flex_1())
          .child(div().id(`jd-conf-${d.id}`).w(36).flex_none().tooltip(`${jev && !jev.unavailable ? "Jev" : "Confidence"} ${score(confidence)}`)
            .child(meter(t, confidence, color, jev ? jev.floor : null, 4)))
          .child(forkGlyph(t, d.fork))
          .child(outcomeGlyph(t, pal, o))
          .child(div().w(26).flex_none().text_right().text_size(10.5).text_color(t.dim).child(relTime(d.at, now))))
        .child(h_flex().gap(8).items_center().text_size(11)
          .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(firstLine(d.request) || "—"))
          .when(Boolean(ran), (el) => el.child(div().flex_none().text_color(t.muted).child(ran))))))
    .when(open, (el) => el.child(detail(view, t, pal, mono, d, color)));
}

export function ladder(t, pal, mono, d, color) {
  const rows = [];
  if (d.verdict === "jev") {
    rows.push(meterRow(t, "jev", d.jev?.confidence, color, d.jev?.floor ?? JEV_FLOOR, mono));
    const model = d.outputs.find(([key]) => key === "backend_model")?.[1];
    rows.push(div().text_size(11).text_color(t.muted).child(`accepted${model ? ` · ${model}` : ""}`));
  }
  for (const rung of d.ladder) {
    const model = rung.model ? `${rung.model} · ` : "";
    if (rung.unavailable) {
      rows.push(h_flex().gap(8).items_start()
        .child(div().w(64).flex_none().truncate().text_size(11).text_color(t.muted).child(rung.backend))
        .child(div().flex_1().min_w(0).text_size(11).line_height(1.35).text_color(t.dim).child(`${model}unavailable · ${rung.reason}`)));
      continue;
    }
    rows.push(meterRow(t, rung.backend, rung.confidence, rung.backend === "jev" ? color : pal.model, rung.floor, mono));
    const stance = rung.stance ? `${rung.stance} → ${rung.wanted} · ` : "";
    rows.push(div().pl(72).text_size(11).text_color(rung.stance === "dissents" ? color : t.muted)
      .child(`${model}${stance}floor ${score(rung.floor)}`));
  }
  if (d.verdict === "overruled" && !d.ladder.some((r) => r.backend === "jev")) {
    rows.push(meterRow(t, "jev", d.jev?.confidence, color, d.jev?.floor ?? JEV_FLOOR, mono));
  }
  if (d.margins.length) rows.push(div().text_size(11).text_color(t.muted).child(`margins: ${d.margins.map(([k, m]) => `${k} ${score(m)}`).join(", ")}`));
  if (d.fallbackReason) rows.push(div().mt(2).px(8).py(6).rounded(6).bg(t.background).font_family(mono).text_size(10.5).line_height(1.4).text_color(t.dim).child(d.fallbackReason));
  return v_flex().gap(6).children(rows);
}

export function outcome(t, pal, d) {
  const o = d.outcome;
  if (!o) return div().text_size(12).text_color(t.dim).child("No outcome yet: the turn is still running, or never reported one.");
  const agrees = o.actual && o.recommended ? o.actual.toLowerCase().includes(o.recommended.toLowerCase()) : null;
  const aborted = o.outcome === "aborted";
  return h_flex().flex_wrap().gap(6).items_center()
    .child(div().h(20).px(7).rounded(4).flex().items_center().bg(alpha(aborted ? pal.danger : pal.ok, "26")).text_size(11).font_semibold()
      .text_color(aborted ? pal.danger : pal.ok).child(aborted ? "aborted" : o.outcome))
    .child(div().text_size(12).child(o.actual ? `ran ${o.actual}` : "model unknown"))
    .when(Boolean(o.recommended), (el) => el.child(div().text_size(12).text_color(agrees ? pal.ok : t.blocked)
      .child(`${agrees ? "=" : "≠"} recommended ${o.recommended}`)))
    .child(div().text_size(12).text_color(t.muted).child(o.running ? `$${o.spendUsd.toFixed(2)} agent running total${o.turns > 1 ? ` after ${o.turns} reports` : ""}` : `$${o.spendUsd.toFixed(2)}${o.turns > 1 ? ` over ${o.turns} turns` : ""}`));
}

export function request(view, t, mono, d) {
  const open = view.requestOpen.has(d.id);
  const lines = d.request.split("\n");
  let shown = lines.slice(0, open ? REQUEST_FULL_LINES : REQUEST_LINES);
  if (!open) {
    let budget = REQUEST_CHARS;
    shown = shown.map((line) => {
      const kept = line.slice(0, Math.max(0, budget));
      budget -= line.length;
      return kept;
    }).filter((line, i) => i === 0 || line || budget > 0);
  }
  const clipped = !open && (lines.length > REQUEST_LINES || d.request.length > REQUEST_CHARS);
  const truncated = open && (lines.length > REQUEST_FULL_LINES || d.requestLength > d.request.length);
  return v_flex().gap(6)
    .child(v_flex().px(9).py(7).rounded(6).bg(t.background).font_family(mono).text_size(11).line_height(1.45).text_color(t.muted)
      .children(shown.map((line) => div().child(line || " "))))
    .when(clipped || open, (el) => el.child(h_flex().gap(8).items_center()
      .child(div().id(`jd-req-${d.id}`).text_size(11).text_color(t.accent).cursor_pointer()
        .on_click((_e, cx) => {
          if (open) view.requestOpen.delete(d.id);
          else view.requestOpen.add(d.id);
          cx.notify();
        })
        .child(open ? "less" : `more · ${count(lines.length)} lines`))
      .when(truncated, (el) => el.child(div().text_size(10.5).text_color(t.dim).child(`clipped; ${count(d.requestLength)} characters in all`)))));
}

export function detail(view, t, pal, mono, d, color) {
  const blocks = [];
  if (d.rationale) blocks.push(section(t, "Why", para(t, d.rationale)));
  if (d.jev || d.ladder.length || d.fallbackReason) blocks.push(section(t, "Model ladder", ladder(t, pal, mono, d, color)));
  if (d.probabilities.length) {
    blocks.push(section(t, "Probabilities", v_flex().gap(5).children(d.probabilities.map(([label, p]) => h_flex().gap(8).items_center()
      .child(div().w(96).flex_none().truncate().text_size(11.5).text_color(label === d.action ? t.foreground : t.muted).when(label === d.action, (el) => el.font_semibold()).child(label))
      .child(div().flex_1().min_w(0).child(meter(t, p, label === d.action ? color : t.dim, null, 6)))
      .child(div().w(38).flex_none().text_right().font_family(mono).text_size(11).child(percent(p)))))));
  }
  if (d.alternatives.length) {
    blocks.push(section(t, "Alternatives", v_flex().gap(4).children(d.alternatives.map((a) => h_flex().gap(8).items_start()
      .child(div().flex_none().text_size(12).font_semibold().child(a.action || "—"))
      .child(div().flex_1().min_w(0).text_size(12).line_height(1.4).text_color(t.muted).child(a.reason))))));
  }
  if (d.requiredEvidence.length) blocks.push(section(t, "Needs evidence", bullets(t, d.requiredEvidence, t.accent)));
  if (d.risks.length) blocks.push(section(t, "Risks", bullets(t, d.risks, pal.overruled)));
  if (d.changeConditions.length) blocks.push(section(t, "Would change if", bullets(t, d.changeConditions, t.dim)));
  if (d.outputs.length) blocks.push(section(t, "Outputs", pairs(t, d.outputs)));
  blocks.push(section(t, "Outcome", outcome(t, pal, d)));
  if (d.request) blocks.push(section(t, "Request", request(view, t, mono, d)));
  blocks.push(h_flex().flex_wrap().gap_x(10).gap_y(2).font_family(mono).text_size(10).text_color(t.dim)
    .child(d.id)
    .child(`${d.backend}/${d.fork ?? "—"}`)
    .when(Boolean(d.authority), (el) => el.child(d.authority))
    .when(d.at != null, (el) => el.child(new Date(d.at).toISOString().replace(".000Z", "Z"))));
  return v_flex().px(12).pt(10).pb(12).gap(12).border_t(1).border_color(alpha(t.border, "80")).children(blocks);
}
