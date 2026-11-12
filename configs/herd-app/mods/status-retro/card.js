import { div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { MISSING, asOf, level, markOf, resetText } from "./quota.js";

const PAD = 12;
const BOX_PAD = 10;

function tone(t, left) {
  return { critical: t.ansi9 ?? t.blocked, warn: t.blocked, ok: t.accent }[level(left)] ?? t.dim;
}

function meterRow(t, slot, meter, width, now) {
  return v_flex().gap(5)
    .child(div().font_semibold().text_size(12).child(meter.label))
    .child(div().relative().w(width).h(6).rounded(3).bg(t.border)
      .child(div().id(`fill-${slot.id}-${meter.label}`).absolute().left(0).top(0).h(6).rounded(3).bg(tone(t, meter.left)).w(width * meter.left / 100)
        .transition("width", { duration: 500, easing: "ease-out" })))
    .child(h_flex().justify_between().text_size(11)
      .child(div().text_color(t.foreground).child(meter.leftText))
      .child(div().text_color(t.dim).child(resetText(meter, now) || meter.limitText || "")));
}

function trendRow(t, points, width) {
  const max = Math.max(1, ...points);
  const gap = 2;
  const bar = Math.max(2, (width - gap * (points.length - 1)) / points.length);
  return v_flex().gap(5)
    .child(div().font_semibold().text_size(12).child("Usage trend"))
    .child(h_flex().h(26).gap(gap).items_end()
      .children(points.map((value, i) => div().id(`trend-${i}`).w(bar).h(Math.max(2, (24 * value) / max)).rounded(1)
        .bg(i === points.length - 1 ? t.accent : `${t.accent}66`))));
}

function providerBlock(t, slot, width, now) {
  const inner = width - 2 * PAD - 2 * BOX_PAD - 2;
  const head = h_flex().gap(7).items_center()
    .child(markOf(slot, 15, t.foreground, { svg, image }))
    .child(div().font_semibold().text_size(13).child(slot.name))
    .when(Boolean(slot.plan), (el) => el.child(div().text_size(11).text_color(t.dim).child(slot.plan)))
    .child(div().flex_1())
    .when(Boolean(slot.stale), (el) => el.child(div().px(5).rounded(3).border(1).border_color(t.border).text_size(10).text_color(t.dim).child("as of last run")));
  const box = v_flex().p(BOX_PAD).gap(12).rounded(10).bg(t.surface).border(1).border_color(t.border);
  if (slot.missing) {
    return v_flex().gap(7).child(head).child(box.opacity(0.75)
      .child(div().text_size(11.5).text_color(t.muted).child("No local data."))
      .child(div().text_size(11).text_color(t.dim).child(MISSING[slot.id] ?? "No usage record found on this machine.")));
  }
  return v_flex().gap(7).child(head).child(box
    .children(slot.meters.map((m) => meterRow(t, slot, m, inner, now)))
    .when(slot.meters.length === 0, (el) => el.child(div().text_size(11).text_color(t.dim).child("No plan limits recorded yet.")))
    .when(slot.trend.length > 1, (el) => el.child(trendRow(t, slot.trend, inner)))
    .when(slot.facts.length > 0, (el) => el.child(v_flex().gap(4).pt(2).border_t(1).border_color(t.border)
      .children(slot.facts.map((f) => h_flex().gap(8).justify_between().text_size(11)
        .child(div().flex_none().text_color(t.dim).child(f.label))
        .child(div().min_w(0).truncate().text_color(t.muted).child(f.value)))))));
}

/** The popup the status bar's quota chips open: every provider's meters in full. */
export function usageCard(t, slots, down, now, width) {
  const root = v_flex().id("usage-card").size_full().p(PAD).gap(14).bg(t.popover).text_color(t.foreground).text_size(12)
    .overflow_y_scrollbar();
  if (!slots) {
    return root.child(div().font_semibold().child(down ? "Usage unavailable" : "Reading usage…"))
      .child(div().text_size(11).text_color(t.dim).child(down
        ? "The local reader (mods/status-retro/quota.py) failed. Check that python3 is installed."
        : "Reading local usage files…"));
  }
  return root
    .children(slots.map((slot) => providerBlock(t, slot, width, now)
      .when(Boolean(asOf(slot, now)), (el) => el.child(div().text_size(10).text_color(t.dim).child(asOf(slot, now))))))
    .child(div().text_size(10).text_color(t.dim).child("Read from this machine: the Claude Code statusline and ~/.codex session logs."));
}
