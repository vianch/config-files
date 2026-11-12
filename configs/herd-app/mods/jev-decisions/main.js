import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, readTextFile, watchFolder, pickFolder, nextCommand, spaces, panes, props, theme, settings } from "herdr";
import { VERDICTS, buildWindow, historyPath, labelSources, matches, parseDiscovery, parseLaya, relTime, repoRoot, sourceLabel, summarize } from "./data.js";
import { alpha, button, chromeIcon, count, heading, palette } from "./ui.js";
import { ALL, FORKS, LIVE_MS, emptySources, filters, note, nowCard, problem, tally } from "./panels.js";
import { row } from "./timeline.js";

const WINDOW_STEP = 600;
// exec caps stdout at 8 MiB and ttg's rows average about 1.6 KB.
const WINDOW_MAX = 4800;
const ROW_STEP = 60;
const DEBOUNCE_MS = 1500;
const FALLBACK_MS = 15000;
const CLOCK_MS = 30000;
const WIDE_PX = 520;

const DISCOVER = `
mode=file
for arg in "$@"; do
  if [ "$arg" = "--" ]; then mode=dir; continue; fi
  if [ "$mode" = file ]; then
    [ -f "$arg" ] && printf '%s\\t%s\\n' "$(stat -f %m "$arg" 2>/dev/null || stat -c %Y "$arg")" "$arg"
    continue
  fi
  dir=$arg
  while [ -n "$dir" ]; do
    f="$dir/.claude/vistack/decision-history.jsonl"
    [ -f "$f" ] && printf '%s\\t%s\\n' "$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f")" "$f"
    [ "$dir" = / ] && break
    dir=$(dirname "$dir")
  done
done
exit 0`;

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

const messageOf = (error) => String(error?.message ?? error ?? "unknown error");

function localDirs() {
  const local = spaces().filter((s) => !s.machine);
  const localTabs = new Set(local.flatMap((s) => (s.tabs ?? []).map((tab) => tab.id)));
  const cwds = panes().filter((p) => localTabs.has(p.tab)).map((p) => p.cwd);
  return [...new Set([...local.map((s) => s.folder), ...cwds].filter((d) => typeof d === "string" && d.startsWith("/")))].sort();
}

function givenPaths() {
  const paths = props()?.paths;
  return Array.isArray(paths) ? paths.filter((p) => typeof p === "string" && p) : [];
}

export default class JevDecisions extends View {
  init(_props, cx) {
    this.sources = [];
    this.source = localStorage.getItem("source");
    this.folders = readJson("folders", []);
    this.filter = { ...ALL, ...readJson("filter", {}) };
    this.limit = WINDOW_STEP;
    this.shown = ROW_STEP;
    this.expanded = new Set();
    this.requestOpen = new Set();
    this.autoFollow = true;
    this.width = 440;
    this.loadedAt = 0;
    this.discover(cx);
    this.listen(cx);
    cx.timer.every(FALLBACK_MS, (cx) => this.load(cx));
    cx.timer.every(CLOCK_MS, (cx) => cx.notify());
  }

  listen(cx) {
    cx.spawn(async (cx) => {
      for (;;) {
        const name = await nextCommand();
        if (this.command(name, cx)) cx.notify();
      }
    });
  }

  command(name, cx) {
    const verdict = /^filter-(all|jev|overruled|rules|model)$/.exec(name)?.[1];
    if (verdict) {
      this.applyFilter({ verdict });
      return true;
    }
    if (name === "open-first") {
      const first = this.filtered()[0];
      if (first) this.expanded.add(first.id);
      return Boolean(first);
    }
    if (name === "source-menu") {
      this.menuOpen = !this.menuOpen;
      return true;
    }
    if (name === "collapse-all") {
      this.expanded.clear();
      this.autoFollow = false;
      this.autoOpen = null;
      return true;
    }
    if (name === "source-next" && this.sources.length > 1) {
      const at = this.sources.findIndex((s) => s.path === this.source);
      this.select(this.sources[(at + 1) % this.sources.length].path, cx);
      return true;
    }
    return false;
  }

  filtered() {
    if (!this.window) return [];
    const filter = this.effectiveFilter(this.stats);
    return this.window.decisions.filter((d) => matches(d, filter));
  }

  scanKey() {
    return JSON.stringify([localDirs(), givenPaths(), this.folders]);
  }

  discover(cx) {
    this.scanned = this.scanKey();
    if (this.discovering) {
      this.rediscover = true;
      return;
    }
    this.discovering = true;
    const files = [...new Set([...givenPaths(), ...this.folders].map(historyPath).concat(this.source ? [this.source] : []))];
    cx.spawn(async (cx) => {
      try {
        const result = await exec("sh", ["-c", DISCOVER, "sh", ...files, "--", ...localDirs()], { timeout: 10000 });
        const found = parseDiscovery(result.stdout);
        const labels = labelSources(found.map((s) => s.path));
        const sources = found.map((s, i) => ({ ...s, label: labels[i] }));
        const changed = JSON.stringify(sources) !== JSON.stringify(this.sources) || !this.discovered;
        this.sources = sources;
        this.discovered = true;
        const current = sources.find((s) => s.path === this.source);
        const remembered = sources.find((s) => s.path === localStorage.getItem("source"));
        this.select((current ?? remembered ?? sources[0])?.path ?? null, cx, false);
        if (changed) cx.notify();
      } catch (error) {
        this.discovered = true;
        this.error = `Could not look for decision history: ${messageOf(error)}`;
        cx.notify();
      } finally {
        this.discovering = false;
        if (this.rediscover) {
          this.rediscover = false;
          this.discover(cx);
        }
      }
    });
  }

  select(path, cx, remember = true) {
    if (remember && path) localStorage.setItem("source", path);
    if (path === this.source && (this.window || this.loading)) return;
    this.source = path;
    this.window = null;
    this.stats = null;
    this.total = null;
    this.laya = null;
    this.error = null;
    this.signature = null;
    this.limit = WINDOW_STEP;
    this.shown = ROW_STEP;
    this.expanded.clear();
    this.requestOpen.clear();
    this.autoFollow = true;
    this.autoOpen = null;
    this.load(cx);
  }

  load(cx) {
    const path = this.source;
    if (!path) return;
    if (this.loading) {
      this.again = true;
      return;
    }
    this.loading = true;
    const limit = this.limit;
    cx.spawn(async (cx) => {
      try {
        const [tail, lines, layaText] = await Promise.all([
          exec("tail", ["-n", String(limit), path], { timeout: 20000 }),
          exec("wc", ["-l", path], { timeout: 10000 }),
          readTextFile(`${repoRoot(path)}/.claude/vistack/laya.json`).catch(() => null),
        ]);
        if (path !== this.source || limit !== this.limit) {
          this.again = true;
          return;
        }
        if (tail.code !== 0) throw new Error(tail.stderr.trim() || `tail exited with ${tail.code}`);
        const total = Number.parseInt(lines.stdout.trim(), 10);
        const laya = parseLaya(layaText);
        const signature = `${tail.stdout.length}:${tail.stdout.slice(-512)}`;
        const changed = signature !== this.signature || total !== this.total || JSON.stringify(laya) !== JSON.stringify(this.laya) || Boolean(this.error);
        if (signature !== this.signature) this.ingest(buildWindow(tail.stdout));
        this.signature = signature;
        this.total = Number.isFinite(total) ? total : null;
        this.laya = laya;
        this.error = null;
        this.watch(path.slice(0, path.lastIndexOf("/")), cx);
        if (changed) cx.notify();
      } catch (error) {
        if (path === this.source) {
          this.error = messageOf(error);
          cx.notify();
        }
      } finally {
        this.loading = false;
        this.loadedAt = Date.now();
        if (this.again) {
          this.again = false;
          this.load(cx);
        }
      }
    });
  }

  ingest(window) {
    const previous = this.window?.decisions[0]?.id;
    this.window = window;
    this.stats = summarize(window.decisions);
    const newest = window.decisions[0]?.id;
    if (!newest || newest === previous || !this.autoFollow) return;
    if (this.autoOpen) this.expanded.delete(this.autoOpen);
    this.expanded.add(newest);
    this.autoOpen = newest;
  }

  watch(dir, cx) {
    if (this.watched === dir || this.watchFailed === dir) return;
    this.watched = dir;
    const token = {};
    this.watchToken = token;
    cx.spawn(async (cx) => {
      try {
        while (this.watchToken === token) {
          await watchFolder(dir);
          if (this.watchToken !== token) return;
          const wait = DEBOUNCE_MS - (Date.now() - this.loadedAt);
          if (wait > 0) await cx.sleep(wait);
          if (this.watchToken === token) this.load(cx);
        }
      } catch {
        if (this.watchToken !== token) return;
        this.watched = null;
        this.watchFailed = dir;
      }
    });
  }

  addFolder(cx) {
    this.menuOpen = false;
    cx.spawn(async (cx) => {
      const folder = await pickFolder({ prompt: "Add" });
      if (!folder) return;
      const path = historyPath(folder);
      if (!this.folders.includes(path)) this.folders = [...this.folders, path];
      localStorage.setItem("folders", JSON.stringify(this.folders));
      localStorage.setItem("source", path);
      this.source = null;
      this.discover(cx);
      cx.notify();
    });
  }

  applyFilter(patch) {
    this.filter = { ...this.filter, ...patch };
    localStorage.setItem("filter", JSON.stringify(this.filter));
    this.shown = ROW_STEP;
  }

  setFilter(patch, cx) {
    this.applyFilter(patch);
    cx.notify();
  }

  toggle(id, cx) {
    if (id === this.autoOpen) {
      this.autoFollow = false;
      this.autoOpen = null;
    }
    if (this.expanded.has(id)) this.expanded.delete(id);
    else this.expanded.add(id);
    cx.notify();
  }

  loadOlder(cx) {
    this.limit = Math.min(this.limit + WINDOW_STEP, WINDOW_MAX);
    this.load(cx);
    cx.notify();
  }

  render(cx) {
    if (this.scanKey() !== this.scanned) this.discover(cx);
    const t = theme();
    const pal = palette(t, settings()?.dark !== false);
    const mono = settings()?.font_family ?? "JetBrains Mono";
    const now = Date.now();
    const wide = this.width >= WIDE_PX;
    return v_flex().id("jd-root").size_full().min_h(0).bg(t.chrome).text_color(t.foreground).text_size(12.5)
      .on_size_change((size, cx) => {
        if (Math.abs(size.width - this.width) < 1) return;
        this.width = size.width;
        cx.notify();
      })
      .child(this.header(t, now))
      .child(this.sourceBar(t, pal))
      .when(Boolean(this.menuOpen), (el) => el.child(this.sourceMenu(t, now)))
      .child(v_flex().id("jd-body").flex_1().min_h(0).overflow_y_scrollbar().px(12).pt(2).pb(16).gap(12)
        .children(this.body(t, pal, mono, now, wide)));
  }

  header(t, now) {
    const newest = this.window?.decisions[0];
    const age = newest?.at == null ? Infinity : now - newest.at;
    const live = age < LIVE_MS
      ? h_flex().gap(6).items_center()
        .child(div().size(8).rounded(4).bg(t.working).loop("opacity", { from: 0.2, to: 1, period: 900 }))
        .child(div().text_size(11).text_color(t.working).child("deciding…"))
      : h_flex().gap(6).items_center()
        .child(div().size(7).rounded(4).bg(t.dim))
        .child(div().text_size(11).text_color(t.dim).child(newest ? `last fork ${relTime(newest.at, now)} ago` : "idle"));
    return h_flex().flex_none().h(42).px(14).gap(8).items_center().border_b(1).border_color(t.border)
      .child(div().font_family("Silkscreen").text_size(15).text_color(t.accent).child("JEV"))
      .child(div().mt(2).font_family("Silkscreen").text_size(9.5).text_color(t.dim).child("DECISIONS"))
      .child(div().flex_1())
      .when(Boolean(this.loading && !this.window && this.source), (el) => el.child(svg(chromeIcon("spinner")).size(12).text_color(t.dim).spin(900)))
      .child(live);
  }

  sourceBar(t, pal) {
    const current = this.sources.find((s) => s.path === this.source);
    const label = current?.label ?? (this.source ? sourceLabel(this.source) : "No source");
    const laya = this.laya;
    const layaText = laya == null ? "no laya.json" : laya.enabled === false ? "laya off" : `laya on${laya.model ? ` · ${laya.model}` : ""}`;
    const layaColor = laya?.enabled ? pal.ok : t.dim;
    return h_flex().flex_none().px(12).py(8).gap(8).items_center()
      .child(h_flex().id("jd-source").min_w(0).h(26).px(8).gap(6).items_center().rounded(6).border(1)
        .border_color(this.menuOpen ? t.accent : t.border).bg(t.surface).cursor_pointer().hover((s) => s.bg(t.hover))
        .tooltip(this.source ?? "No decision history found")
        .on_click((_e, cx) => {
          this.menuOpen = !this.menuOpen;
          if (this.menuOpen) this.discover(cx);
          cx.notify();
        })
        .child(svg(chromeIcon("folder")).size(13).flex_none().text_color(t.muted))
        .child(div().min_w(0).truncate().font_medium().child(label))
        .when(this.sources.length > 1, (el) => el.child(div().flex_none().px(4).rounded(3).bg(t.raised).text_size(10).text_color(t.muted).child(String(this.sources.length))))
        .child(svg(chromeIcon("chevron-down")).size(11).flex_none().text_color(t.dim)))
      .when(Boolean(this.source), (el) => el.child(h_flex().id("jd-laya").flex_none().h(22).px(7).gap(5).items_center().rounded(11)
        .bg(alpha(layaColor, "1f")).tooltip(`${repoRoot(this.source)}/.claude/vistack/laya.json`)
        .child(div().size(6).rounded(3).bg(layaColor))
        .child(div().text_size(10.5).text_color(laya?.enabled ? t.foreground : t.dim).child(layaText))))
      .child(div().flex_1())
      .when(this.total != null && Boolean(this.window), (el) => el.child(div().flex_none().text_size(10.5).text_color(t.dim)
        .child(`${count(Math.min(this.window.lines, this.total))} / ${count(this.total)} lines`)));
  }

  sourceMenu(t, now) {
    return v_flex().flex_none().mx(12).mb(8).p(4).rounded(8).border(1).border_color(t.border).bg(t.popover)
      .children(this.sources.map((s, i) => h_flex().id(`jd-src-${i}`).h(30).px(8).gap(8).items_center().rounded(6).cursor_pointer()
        .hover((el) => el.bg(t.hover)).tooltip(s.path)
        .on_click((_e, cx) => {
          this.menuOpen = false;
          this.select(s.path, cx);
          cx.notify();
        })
        .child(div().w(13).flex_none().when(s.path === this.source, (el) => el.child(svg(chromeIcon("check")).size(13).text_color(t.accent))))
        .child(div().flex_none().max_w(200).truncate().font_medium().child(s.label))
        .child(div().flex_1().min_w(0).truncate().text_size(10.5).text_color(t.dim).child(repoRoot(s.path)))
        .child(div().flex_none().text_size(10.5).text_color(t.dim).child(relTime(s.mtime, now)))))
      .when(this.sources.length > 0, (el) => el.child(div().h(1).mx(6).my(4).bg(t.border)))
      .child(h_flex().id("jd-add").h(30).px(8).gap(8).items_center().rounded(6).cursor_pointer().text_color(t.muted)
        .hover((el) => el.bg(t.hover).text_color(t.foreground)).on_click((_e, cx) => this.addFolder(cx))
        .child(svg(chromeIcon("folder-plus")).size(13).flex_none())
        .child("Add folder…"));
  }

  body(t, pal, mono, now, wide) {
    if (!this.discovered) return [note(t, "Looking for decision history…", true)];
    if (!this.source) return [emptySources(this, t)];
    if (this.error && !this.window) return [problem(t, pal, this.error)];
    if (!this.window) return [note(t, "Reading decisions…", true)];
    const { decisions } = this.window;
    if (!decisions.length) return [note(t, `No decisions in the last ${count(this.window.lines)} lines.`, false)];
    const s = this.stats;
    const filter = this.effectiveFilter(s);
    const filtered = this.filtered();
    const visible = filtered.slice(0, this.shown);
    return [
      ...(this.error ? [problem(t, pal, this.error)] : []),
      nowCard(t, pal, mono, decisions[0], now),
      tally(this, t, pal, s, wide),
      filters(this, t, pal, s, filter),
      h_flex().gap(8).items_center()
        .child(heading(t, "Timeline"))
        .child(div().text_size(10.5).text_color(t.dim).child(`${count(visible.length)} of ${count(filtered.length)}`))
        .child(div().flex_1())
        .when(JSON.stringify(filter) !== JSON.stringify(ALL), (el) => el.child(div().id("jd-clear").text_size(11).text_color(t.accent).cursor_pointer()
          .on_click((_e, cx) => this.setFilter(ALL, cx)).child("clear filters"))),
      ...(filtered.length ? visible.map((d) => row(this, t, pal, mono, d, now, wide)) : [note(t, "Nothing in this window matches these filters.", false)]),
      this.footer(t, filtered.length),
    ];
  }

  effectiveFilter(s) {
    const f = this.filter;
    return {
      verdict: VERDICTS.includes(f.verdict) ? f.verdict : "all",
      type: s.types.some(([type]) => type === f.type) ? f.type : "all",
      fork: FORKS.includes(f.fork) ? f.fork : "all",
    };
  }

  footer(t, filteredCount) {
    const rest = filteredCount - this.shown;
    const older = this.total != null && this.window.lines < this.total && this.limit < WINDOW_MAX;
    return h_flex().flex_none().flex_wrap().gap(8).items_center().pt(2)
      .when(rest > 0, (el) => el.child(button(t, "jd-more", `Show ${Math.min(ROW_STEP, rest)} more`, (_e, cx) => {
        this.shown += ROW_STEP;
        cx.notify();
      })))
      .when(older, (el) => el.child(button(t, "jd-older", `Load older · ${count(Math.min(this.limit + WINDOW_STEP, WINDOW_MAX))} lines`, (_e, cx) => this.loadOlder(cx), chromeIcon("clock"))))
      .child(div().flex_1())
      .child(div().text_size(10.5).text_color(t.dim).child(this.total != null ? `last ${count(this.window.lines)} of ${count(this.total)} lines` : ""));
  }
}
