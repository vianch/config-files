import { div, image } from "gpui-kit";
import { settings } from "herdr";
import SIZES from "./sprites/sizes.js";

export const PIXEL = "Silkscreen";
export const FLOOR = 3;
export const WALL = 2;

// Opacity clamps to 0..1, so a steep linear loop past both ends holds each frame and swaps in a blink.
const SWAP = { from: 6, to: -5, easing: "linear" };
const SWAP_BACK = { from: -5, to: 6, easing: "linear" };

export const path = (name) => `mods/agent-office/sprites/${name}.svg`;

export function cell(scale = FLOOR) {
  return scale / (Number(settings()?.zoom) || 1);
}

export function sizeOf(name) {
  return SIZES[name] ?? SIZES[`${name}-0`] ?? [16, 16];
}

export function sprite(name, scale = FLOOR) {
  const [w, h] = sizeOf(name);
  const u = cell(scale);
  return image(path(name)).w(w * u).h(h * u).flex_none();
}

export function flipbook(id, name, scale, period) {
  const [w, h] = sizeOf(`${name}-0`);
  const u = cell(scale);
  const frame = (i, policy) => image(path(`${name}-${i}`)).absolute().left(0).top(0).w(w * u).h(h * u).loop("opacity", { ...policy, period });
  return div().id(id).relative().w(w * u).h(h * u).flex_none().child(frame(0, SWAP)).child(frame(1, SWAP_BACK));
}

export function figure(id, name, scale, live, dim = false) {
  const [w, h] = sizeOf(`${name}-0`);
  const u = cell(scale);
  const frame = div().id(`${id}-at`).relative().w(w * u).h(h * u).flex_none();
  if (!live) return frame.child(sprite(`${name}-0`, scale).opacity(dim ? 0.55 : 1));
  return frame.child(flipbook(id, name, scale, 560).absolute().left(0).top(0).loop("top", { from: 0, to: -u, period: 900 }));
}

export function at(el, x, y, scale = FLOOR) {
  const u = cell(scale);
  return el.absolute().left(x * u).top(y * u);
}

export function box(id, w, h, scale = FLOOR) {
  const u = cell(scale);
  return div().id(id).relative().w(w * u).h(h * u).flex_none();
}
