import { View, div, image, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, theme, run, window, keys, layout, exec, props, openOverlay, appHome } from "herdr";
import { digestUsage, headline, level, markOf, parseGpu, parseUsage, short, tooltip } from "./quota.js";
import { usageCard } from "./card.js";

const GB = 1024 ** 3;
const USAGE_EVERY_MS = 30000;
const CARD_SIZE = { width: 330, height: 600 };

function findNode(node, id) {
  if (!node || typeof node !== "object") return null;
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function parseDarwinCpu(out) {
  const lines = out.split("\n").filter((l) => l.startsWith("CPU usage:"));
  const idle = /([\d.]+)% idle/.exec(lines[lines.length - 1] ?? "");
  return idle ? 100 - Number(idle[1]) : null;
}

function parseDarwinMem(vm, total) {
  const page = Number(/page size of (\d+) bytes/.exec(vm)?.[1]);
  const pages = (name) => Number(new RegExp(`${name}:\\s+(\\d+)`).exec(vm)?.[1] ?? 0);
  if (!page) return null;
  const anon = pages("Anonymous pages");
  const wired = pages("Pages wired down");
  const comp = pages("Pages occupied by compressor");
  const used = anon
    ? (anon - pages("Pages purgeable") + wired + comp) * page
    : (pages("Pages active") + wired + comp) * page;
  return { used, total };
}

function parseProcStat(text) {
  const f = (text.split("\n")[0] ?? "").trim().split(/\s+/).slice(1).map(Number);
  if (f.length < 5) return null;
  return { idle: f[3] + f[4], total: f.reduce((a, b) => a + b, 0) };
}

function parseMeminfo(text) {
  const kb = (k) => Number(new RegExp(`${k}:\\s+(\\d+)`).exec(text)?.[1]);
  const total = kb("MemTotal") * 1024;
  const avail = kb("MemAvailable") * 1024;
  return total && avail ? { used: total - avail, total } : null;
}


export default class WorkspaceStatus extends View {
  // The palette key as actually bound, not a hardcoded one; without a
  // binding the hint stays useful ("commands") instead of lying.
  hint(t) {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
    const b = keys().find((k) => k.section === "global" && k.action === "app.palette");
    const parts = b && b.keys.endsWith("--") ? [...b.keys.slice(0, -2).split("-"), "-"] : b?.keys.split("-");
    const key = parts && parts.map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
    return key ? `${key}  commands` : "commands";
  }

  init(_props, cx) {
    this.cpu = null;
    this.mem = null;
    this.gpu = null;
    this.slots = null;
    this.usageDown = false;
    this.usageKey = "";
    this.busy = false;
    this.prevStat = null;
    this.os = window()?.platform;
    this.card = Boolean(props()?.card || props()?.overlay);
    this.fetchUsage(cx);
    cx.timer.every(this.card ? 30000 : USAGE_EVERY_MS, (cx) => this.fetchUsage(cx));
    if (this.card || (this.os !== "macos" && this.os !== "linux")) return;
    cx.timer.every(3000, (cx) => this.sample(cx));
    this.sample(cx);
  }

  fetchUsage(cx) {
    cx.spawn(async (cx) => {
      let slots = null;
      try {
        const out = await exec("python3", ["-I", `${appHome()}/mods/status-retro/quota.py`], { timeout: 10000 });
        slots = parseUsage(JSON.parse(out.stdout), Date.now());
      } catch {
        slots = null;
      }
      const key = slots ? digestUsage(slots) : "down";
      this.slots = slots;
      this.usageDown = !slots;
      if (key !== this.usageKey) {
        this.usageKey = key;
        cx.notify();
      }
    });
  }

  async probe(read) {
    try {
      return await read();
    } catch {
      return null;
    }
  }

  sample(cx) {
    if (this.busy) return;
    this.busy = true;
    cx.spawn(async (cx) => {
      let cpu = null;
      let mem = null;
      let gpu = null;
      if (this.os === "macos") {
        cpu = await this.probe(async () => parseDarwinCpu((await exec("/usr/bin/top", ["-l", "2", "-n", "0", "-s", "1"])).stdout));
        mem = await this.probe(async () => {
          const total = Number((await exec("/usr/sbin/sysctl", ["-n", "hw.memsize"])).stdout);
          return parseDarwinMem((await exec("/usr/bin/vm_stat", [])).stdout, total);
        });
        gpu = await this.probe(async () => parseGpu((await exec("/usr/sbin/ioreg", ["-r", "-d", "1", "-c", "IOAccelerator"])).stdout));
      } else {
        cpu = await this.probe(async () => {
          const stat = parseProcStat((await exec("cat", ["/proc/stat"])).stdout);
          const prev = this.prevStat;
          this.prevStat = stat;
          const dt = stat && prev ? stat.total - prev.total : 0;
          return dt > 0 ? 100 * (1 - (stat.idle - prev.idle) / dt) : null;
        });
        mem = await this.probe(async () => parseMeminfo((await exec("cat", ["/proc/meminfo"])).stdout));
      }
      this.busy = false;
      const nextCpu = cpu == null || Number.isNaN(cpu) ? null : Math.round(cpu);
      const nextMem = mem && mem.total ? { used: Math.round(mem.used / GB * 10) / 10, total: Math.round(mem.total / GB) } : null;
      const changed = nextCpu !== this.cpu || gpu !== this.gpu || nextMem?.used !== this.mem?.used || nextMem?.total !== this.mem?.total;
      this.cpu = nextCpu;
      this.mem = nextMem;
      this.gpu = gpu;
      if (changed) cx.notify();
    });
  }

  meter(t, pct) {
    const warn = pct > 85;
    return div().w(28).h(4).rounded(2).bg(t.border).child(div().h(4).rounded(2).w(28 * Math.min(pct, 100) / 100).bg(warn ? t.blocked : t.accent));
  }

  usage(t, icon, text, pct, tip) {
    return h_flex().id(`use-${icon}`).gap(6).items_center().tooltip(tip)
      .child(svg(`mods/status-retro/${icon}.svg`).size(13))
      .child(div().text_color(pct > 85 ? t.blocked : t.muted).child(text))
      .child(this.meter(t, pct));
  }

  chip(t, child, text, icon, id) {
    const node = findNode(layout(), "jev");
    const stack = findNode(layout(), "right-stack");
    const shown = Boolean(node) && node.hidden !== true;
    const active = shown && stack?.active === child;
    const color = active ? t.accent : node ? t.muted : t.dim;
    return h_flex().id(id).gap(6).items_center().text_color(color)
      .on_click(() => {
        if (!node) return;
        if (active) { run("layout.hide", { id: "jev" }); return; }
        run("layout.show", { id: "jev" });
        run("layout.select", { stack: "right-stack", child });
      })
      .child(svg(icon.includes("/") ? icon : `mods/workspace-chrome/${icon}.svg`).size(13))
      .child(text);
  }

  office(t) { return this.chip(t, "office", "Office", "layers", "office-toggle"); }

  jev(t) { return this.chip(t, "decisions", "Jev", "git-compare", "jev-toggle"); }

  monitors(t) { return this.chip(t, "monitors", "Monitors", "mods/status-retro/radar.svg", "monitors-toggle"); }

  openCard() {
    openOverlay({ mod: "status-retro", kind: "popup", ...CARD_SIZE, props: { card: true } });
  }

  quota(t) {
    const now = Date.now();
    if (this.usageDown || !this.slots) {
      return h_flex().id("quota-down").gap(5).items_center().text_color(t.dim)
        .tooltip("Couldn't read local usage files (mods/status-retro/quota.py)")
        .child(svg("mods/status-retro/gauge.svg").size(13)).child(this.usageDown ? "usage unavailable" : "usage…");
    }
    const tone = (left) => ({ critical: t.ansi9 ?? t.blocked, warn: t.blocked, ok: t.accent }[level(left)] ?? t.dim);
    return h_flex().id("quota").gap(4).items_center()
      .children(this.slots.map((slot) => h_flex().id(`quota-${slot.id}`).h(20).px(6).gap(6).items_center().rounded(5)
        .cursor_pointer().hover((s) => s.bg(t.hover)).tooltip(tooltip(slot, now))
        .when(slot.missing, (el) => el.opacity(0.55))
        .on_click(() => this.openCard())
        .child(markOf(slot, 12, t.foreground, { svg, image }))
        .when(slot.missing, (el) => el.child(div().text_color(t.dim).child("—")))
        .children(headline(slot).map((m) => h_flex().gap(3).items_center()
          .child(div().text_size(10).text_color(t.dim).child(short(m.label)))
          .child(div().w(22).h(4).rounded(2).bg(t.border).child(div().h(4).rounded(2).w(22 * m.left / 100).bg(tone(m.left))))
          .child(div().text_color(level(m.left) === "ok" ? t.muted : tone(m.left)).child(`${m.left}%`))))));
  }

  render() {
    const t = theme();
    if (this.card) {
      return usageCard(t, this.slots, this.usageDown, Date.now(), this.cardWidth ?? CARD_SIZE.width)
        .on_size_change((size, cx) => {
          if (Math.abs(size.width - (this.cardWidth ?? 0)) < 1) return;
          this.cardWidth = size.width;
          cx.notify();
        });
    }
    const space = spaces().find(s => s.active);
    const list = agents();
    const needs = list.filter(a => a.status === "blocked").length;
    const label = (icon, text) => h_flex().gap(6).items_center().child(svg(`mods/workspace-chrome/${icon}.svg`).size(13)).child(text);
    return h_flex().size_full().px(14).gap(16).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .child(label(space?.machine ? "server" : "monitor", space?.machine ?? "This computer"))
      .when(Boolean(space?.branch), el => el.child(label("branch", space.branch)))
      .child(h_flex().gap(6).items_center().child(div().size(6).rounded(3).bg(t.dim)).child(`${list.length} agents`)
        .when(needs > 0, el => el.child(div().text_color(t.blocked).child(`· ${needs} needs you`))))
      .child(div().flex_1())
      .child(this.office(t))
      .child(this.jev(t))
      .child(this.monitors(t))
      .child(div().w(1).h(14).bg(t.border))
      .child(this.quota(t))
      .child(div().w(1).h(14).bg(t.border))
      .when(this.cpu !== null || this.mem !== null || this.gpu !== null, el => el.child(h_flex().gap(16).items_center()
        .when(Boolean(space?.machine), g => g.child(div().text_color(t.dim).child("local")))
        .when(this.cpu !== null, g => g.child(this.usage(t, "cpu", `CPU ${this.cpu}%`, this.cpu, "processor load, all cores")))
        .when(this.gpu !== null, g => g.child(this.usage(t, "gpu", `GPU ${this.gpu}%`, this.gpu, "graphics processor utilization")))
        .when(this.mem !== null, g => g.child(this.usage(t, "memory", `MEM ${this.mem.used}/${this.mem.total} GB`, 100 * this.mem.used / this.mem.total, "memory in use")))))
      .child(div().id("palette").text_color(t.dim).on_click(() => run("app.palette")).child(this.hint(t)));
  }
}
