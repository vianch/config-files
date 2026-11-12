import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { layout, props, run, theme } from "herdr";

const PIXEL = "Silkscreen";
const STACK = "right-stack";
const LABELS = { office: "Office", decisions: "Decisions", monitors: "Monitors" };

function findNode(node, id) {
  if (!node || typeof node !== "object") return null;
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

const labelOf = (id) => LABELS[id] ?? id.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export default class PanelTabs extends View {
  render() {
    const t = theme();
    const stackId = props()?.stack ?? STACK;
    const stack = findNode(layout(), stackId);
    const children = (stack?.children ?? []).map((c) => c.id).filter(Boolean);
    const active = stack?.active ?? children[0];
    return h_flex().id("pt-root").size_full().px(8).gap(2).items_end().bg(t.chrome).border_b(1).border_color(t.border)
      .children(children.map((id) => {
        const on = id === active;
        return div().id(`pt-${id}`).h_full().px(12).flex().items_center().relative().cursor_pointer()
          .font_family(PIXEL).text_size(10).text_color(on ? t.accent : t.muted)
          .hover((s) => s.text_color(on ? t.accent : t.foreground).bg(t.hover))
          .on_click(() => {
            if (!on) run("layout.select", { stack: stackId, child: id });
          })
          .child(labelOf(id).toUpperCase())
          .child(div().absolute().left(8).right(8).bottom(0).h(2).rounded(1).bg(on ? t.accent : "#00000000"));
      }));
  }
}
