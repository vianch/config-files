import { div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";

export const PIXEL = "Silkscreen";
export const chromeIcon = (name) => `mods/workspace-chrome/${name}.svg`;
export const ownIcon = (name) => `mods/jev-decisions/icons/${name}.svg`;

export function alpha(color, byte) {
  return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? `${color}${byte}` : color;
}

export function palette(t, dark) {
  return {
    jev: t.accent,
    overruled: t.blocked,
    rules: t.idle ?? t.muted,
    model: t.working,
    danger: (dark ? t.ansi9 : t.ansi1) ?? t.blocked,
    ok: t.done,
  };
}

export function count(n) {
  return String(n ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export const counted = (n, word) => `${count(n)} ${word}${n === 1 ? "" : "s"}`;

export function score(n) {
  return n == null ? "—" : n.toFixed(2);
}

export function percent(r) {
  return r == null ? "—" : `${Math.round(r * 100)}%`;
}

export function heading(t, text, color) {
  return div().flex_none().font_family(PIXEL).text_size(9.5).text_color(color ?? t.dim).child(text.toUpperCase());
}

export function tag(t, text) {
  return div().flex_none().h(18).px(6).rounded(4).border(1).border_color(t.border).flex().items_center().text_size(10.5).text_color(t.muted).child(text);
}

export function verdictBadge(color, text) {
  return div().flex_none().h(20).px(7).rounded(4).bg(alpha(color, "2e")).border(1).border_color(alpha(color, "80"))
    .flex().items_center().font_family(PIXEL).text_size(9.5).text_color(color).child(text.toUpperCase());
}

export function meter(t, value, color, floor = null, height = 6) {
  const fill = value == null ? 0 : Math.max(0, Math.min(1, value)) * 100;
  return div().relative().w_full().h(height).rounded(height / 2).bg(t.raised)
    .child(div().absolute().left(0).top(0).h_full().w(`${fill}%`).rounded(height / 2).bg(color))
    .when(floor != null, (el) => el.child(div().absolute().top(-2).h(height + 4).w(2).left(`${floor * 100}%`).rounded(1).bg(t.foreground).opacity(0.85)));
}

export function meterRow(t, text, value, color, floor, mono) {
  return h_flex().gap(8).items_center()
    .child(div().w(64).flex_none().truncate().text_size(11).text_color(t.muted).child(text))
    .child(div().flex_1().min_w(0).child(meter(t, value, color, floor)))
    .child(div().w(34).flex_none().text_right().font_family(mono).text_size(11).text_color(value == null ? t.dim : t.foreground).child(score(value)));
}

export function section(t, title, body) {
  return v_flex().gap(5).child(heading(t, title)).child(body);
}

export function para(t, text, color) {
  return div().text_size(12).line_height(1.45).text_color(color ?? t.foreground).child(text);
}

export function bullets(t, items, color) {
  return v_flex().gap(3).children(items.map((item) => h_flex().gap(7).items_start()
    .child(div().mt(6).size(4).flex_none().rounded(2).bg(color))
    .child(div().flex_1().min_w(0).text_size(12).line_height(1.4).child(item))));
}

export function pairs(t, rows) {
  return v_flex().gap(3).children(rows.map(([key, value]) => h_flex().gap(8).items_start()
    .child(div().w(110).flex_none().truncate().text_size(11).text_color(t.dim).child(key))
    .child(div().flex_1().min_w(0).text_size(11.5).line_height(1.4).child(value))));
}

export function outcomeGlyph(t, pal, outcome) {
  const box = () => div().size(14).flex_none().flex().items_center().justify_center();
  if (!outcome) return box().child(div().size(4).rounded(2).bg(t.dim));
  if (outcome.outcome === "aborted") return box().child(svg(chromeIcon("x")).size(13).text_color(pal.danger));
  return box().child(svg(chromeIcon("check")).size(13).text_color(pal.ok));
}

export function forkGlyph(t, fork) {
  const box = div().size(14).flex_none().flex().items_center().justify_center();
  if (fork !== "sharp" && fork !== "split") return box;
  return box.child(svg(ownIcon(fork)).size(12).text_color(fork === "split" ? t.muted : t.dim));
}

export function button(t, id, text, onClick, icon = null) {
  return h_flex().id(id).flex_none().h(26).px(10).gap(6).items_center().rounded(6).border(1).border_color(t.border)
    .text_size(11.5).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(onClick)
    .when(Boolean(icon), (el) => el.child(svg(icon).size(13).flex_none()))
    .child(text);
}
