function element(kind, path = null) {
  const node = { kind, path, calls: [], kids: [] };
  const proxy = new Proxy(node, {
    get(target, prop) {
      if (prop === "node") return target;
      if (prop === "then") return undefined;
      if (prop === "child") return (kid) => {
        if (kid != null && kid !== false) target.kids.push(kid);
        return proxy;
      };
      if (prop === "children") return (list) => {
        for (const kid of list ?? []) if (kid != null && kid !== false) target.kids.push(kid);
        return proxy;
      };
      if (prop === "when") return (condition, build) => (condition ? build(proxy) : proxy);
      return (...args) => {
        target.calls.push([prop, args]);
        return proxy;
      };
    },
  });
  return proxy;
}

export const div = () => element("div");
export const h_flex = () => element("h_flex");
export const v_flex = () => element("v_flex");
export const image = (path) => element("image", path);
export const svg = (path) => element("svg", path);
export class View {}

export const settings = () => ({ zoom: 1, dark: true });
export const theme = () => new Proxy({}, { get: (_target, key) => (typeof key === "string" ? "#808080" : undefined) });
