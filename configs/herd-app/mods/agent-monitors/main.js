import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, appHome, exec, layout, run, settings, theme } from "herdr";
import {
  ENDED_WORDS, KINDS, KIND_ORDER, ago, digest, duration, groupItems, humanCron, nextUp, parseOutput, pollMs, progress,
  sessionLabel, shownInLayout, tickMs, until, urgency,
} from "./data.js";

const PIXEL = "Silkscreen";
const MOD = "agent-monitors";
const HELPER_TIMEOUT_MS = 15000;
const BODY_PAD = 12;
const CARD_PAD = 10;
const ENDED_SHOWN = 8;
const HINTS = {
  monitor: "stream events until they expire",
  loop: "wake themselves up",
  cron: "fire at wall-clock times",
};

const icon = (name) => `mods/${MOD}/icons/${name}.svg`;
const alpha = (color, byte) => (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? `${color}${byte}` : color);
const messageOf = (error) => String(error?.message ?? error ?? "unknown error");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const clock = (at, now) => {
  const d = new Date(at);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return at - now > 20 * 3600000 ? `${MONTHS[d.getMonth()]} ${d.getDate()} ${hm}` : hm;
};
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const isClaude = (a) => (a.app === "claude-code" || a.program?.key === "claude") && !a.address.includes("/");

export default class AgentMonitors extends View {
  init(_props, cx) {
    this.width = 520;
    this.snapshot = null;
    this.key = "";
    this.error = null;
    this.loading = false;
    this.lastPoll = 0;
    this.lastDraw = 0;
    this.endedOpen = this.stored("ended-open") === "1";
    this.poll(cx);
    cx.timer.every(1000, (cx) => {
      const now = Date.now();
      const shown = shownInLayout(layout(), MOD);
      const items = this.snapshot?.items ?? [];
      if (now - this.lastPoll >= pollMs(shown, items.length)) this.poll(cx);
      if (now - this.lastDraw >= tickMs(items, now, shown) - 50) cx.notify();
    });
  }

  stored(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  poll(cx) {
    if (this.loading) return;
    this.loading = true;
    this.lastPoll = Date.now();
    const terminals = agents().filter(isClaude).map((a) => a.address).join(",");
    cx.spawn(async (cx) => {
      try {
        const out = await exec("python3", ["-I", `${appHome()}/mods/${MOD}/monitors.py`, "--terminals", terminals], { timeout: HELPER_TIMEOUT_MS });
        const { snapshot, error } = parseOutput(out.stdout);
        this.apply(cx, snapshot ?? this.snapshot, error ?? (out.code ? out.stderr.trim().split("\n").pop() : null));
      } catch (error) {
        this.apply(cx, this.snapshot, messageOf(error));
      } finally {
        this.loading = false;
      }
    });
  }

  apply(cx, snapshot, error) {
    const key = digest(snapshot);
    const changed = key !== this.key || error !== this.error || !this.snapshot;
    this.snapshot = snapshot;
    this.key = key;
    this.error = error;
    if (changed) cx.notify();
  }

  tone(t, item, now) {
    if (item.status === "ended") return /fail|kill|error/.test(item.endedBy ?? "") ? t.ansi9 ?? t.blocked : t.dim;
    const level = urgency(item, now);
    if (level === "critical") return t.ansi9 ?? t.blocked;
    if (level === "warn") return t.blocked;
    return t[KINDS[item.kind].tone] ?? t.accent;
  }

  render() {
    const t = theme();
    const now = Date.now();
    this.lastDraw = now;
    const snap = this.snapshot;
    const items = snap?.items ?? [];
    const groups = groupItems(items);
    const sessions = new Map((snap?.sessions ?? []).map((s) => [s.id, s]));
    const tick = tickMs(items, now, true);
    return v_flex().id("am-root").size_full().min_h(0).bg(t.chrome).text_color(t.foreground).text_size(12.5)
      .on_size_change((size, cx) => {
        const width = size.width / (Number(settings()?.zoom) || 1);
        if (Math.abs(width - this.width) < 1) return;
        this.width = width;
        cx.notify();
      })
      .child(this.header(t, groups))
      .child(v_flex().id("am-body").flex_1().min_h(0).overflow_y_scrollbar().px(BODY_PAD).pt(10).pb(18).gap(16)
        .when(Boolean(this.error), (el) => el.child(this.banner(t, this.error)))
        .when(!snap && !this.error, (el) => el.child(this.scanning(t)))
        .when(Boolean(snap), (el) => el
          .children([this.hero(t, items, sessions, now, tick)].filter(Boolean))
          .children(KIND_ORDER.filter((k) => groups.active[k].length).map((k) => this.section(t, k, groups.active[k], sessions, now, tick)))
          .when(groups.count === 0, (el) => el.child(this.quiet(t)))
          .when(groups.ended.length > 0, (el) => el.child(this.ended(t, groups.ended, sessions, now)))
          .child(this.footer(t, snap, now))));
  }

  header(t, groups) {
    const live = groups.count > 0;
    return h_flex().flex_none().h(40).px(14).gap(8).items_center().border_b(1).border_color(t.border)
      .child(div().font_family(PIXEL).text_size(15).text_color(t.accent).child("MONITORS"))
      .child(div().size(8).flex_none().rounded(4).bg(live ? t.working : t.dim)
        .when(live, (el) => el.loop("opacity", { from: 0.2, to: 1, period: 1100 })))
      .child(div().flex_1())
      .children(KIND_ORDER.map((kind) => {
        const n = groups.active[kind].length;
        const color = n ? t[KINDS[kind].tone] ?? t.accent : t.dim;
        return h_flex().id(`am-pill-${kind}`).flex_none().h(22).px(7).gap(5).items_center().rounded(5)
          .bg(n ? alpha(color, "1c") : t.surface).border(1).border_color(n ? alpha(color, "66") : t.border)
          .tooltip(`${plural(n, KINDS[kind].title.toLowerCase().replace(/s$/, ""))} active`)
          .child(svg(icon(KINDS[kind].icon)).size(12).text_color(color))
          .child(div().font_family(PIXEL).text_size(10).text_color(n ? t.foreground : t.dim).child(String(n)));
      }));
  }

  bar(t, item, now, tick, width, color, scope) {
    const track = Math.max(40, width);
    const id = `am-fill-${scope}-${item.kind}-${item.id}`;
    const indeterminate = item.status === "running" && item.kind !== "monitor";
    const base = div().relative().w(track).h(3).rounded(2).bg(alpha(t.border, "b0")).overflow_hidden();
    if (indeterminate) {
      return base.child(div().id(id).absolute().top(0).h(3).w(track * 0.3).rounded(2).bg(color)
        .loop("left", { from: 0, to: track * 0.7, period: 1600 }));
    }
    const ahead = progress(item, now + tick);
    return base.child(div().id(id).absolute().left(0).top(0).h(3).rounded(2).bg(color).w(track * ahead)
      .transition("width", { duration: tick, easing: "linear" }));
  }

  tile(t, item, color, now) {
    const box = div().relative().size(30).flex_none().rounded(8).bg(alpha(color, "22")).flex().items_center().justify_center();
    if (item.kind === "monitor") {
      return box.child(svg(icon("sweep")).size(24).text_color(color).spin(2600))
        .child(div().absolute().size(4).rounded(2).bg(color));
    }
    if (item.kind === "loop" && item.status === "running") {
      return box.child(svg(icon("orbit")).absolute().size(26).text_color(color).spin(900))
        .child(svg(icon("loop")).size(13).text_color(color));
    }
    if (item.kind === "loop") {
      return box.child(svg(icon(item.status === "sleeping" ? "moon" : "loop")).size(15).text_color(color)
        .loop("opacity", { from: 0.45, to: 1, period: 3200 }));
    }
    const near = item.nextAt && item.nextAt - now < 60000;
    return box.child(svg(icon("alarm")).size(15).text_color(color)
      .when(Boolean(near), (el) => el.loop("opacity", { from: 0.3, to: 1, period: 500 })));
  }

  timing(item, now) {
    if (item.kind === "monitor") {
      if (!item.deadlineAt) return ["∞", "no expiry"];
      return [`${duration(item.deadlineAt - now)} left`, `expires ${clock(item.deadlineAt, now)}`];
    }
    if (item.status === "running") return ["running", "woke up, working"];
    if (item.status === "due") return ["due now", "waits for an idle turn"];
    if (!item.nextAt) return ["armed", ""];
    const verb = item.kind === "loop" && item.via === "wakeup" ? "wakes" : "fires";
    return [until(item.nextAt, now), `${verb} ${clock(item.nextAt, now)}`];
  }

  meta(t, item, session) {
    const parts = [];
    if (item.kind === "monitor") parts.push(item.events ? plural(item.events, "event") : "no events yet");
    if (item.kind === "loop") parts.push(item.via === "wakeup" ? "self-paced" : humanCron(item.schedule));
    if (item.kind === "cron") parts.push(item.recurring ? humanCron(item.schedule) : `once · ${humanCron(item.schedule)}`);
    return h_flex().min_w(0).gap(6).items_center().text_size(10.5).text_color(t.dim)
      .child(h_flex().min_w(0).flex_shrink(1).gap(4).items_center()
        .child(svg(icon("terminal")).size(10).flex_none().text_color(t.dim))
        .child(div().min_w(0).truncate().child(sessionLabel(session, agents()))))
      .children(parts.map((p) => div().flex_none().child(`· ${p}`)));
  }

  card(t, item, sessions, now, tick) {
    const color = this.tone(t, item, now);
    const session = sessions.get(item.session);
    const target = session?.terminal;
    const [primary, secondary] = this.timing(item, now);
    const inner = this.width - 2 * BODY_PAD - 2 * CARD_PAD - 2;
    return v_flex().id(`am-${item.kind}-${item.id}`).flex_none().p(CARD_PAD).gap(8).rounded(9).border(1)
      .border_color(alpha(color, "40")).bg(t.surface)
      .when(Boolean(target), (el) => el.cursor_pointer().tooltip(`Jump to ${sessionLabel(session, agents())}`)
        .hover((s) => s.bg(t.hover).border_color(alpha(color, "a0")))
        .on_click(() => run("pane.focus", { terminal: target })))
      .child(h_flex().gap(10).items_center()
        .child(this.tile(t, item, color, now))
        .child(v_flex().flex_1().min_w(0).gap(3)
          .child(div().min_w(0).truncate().font_medium().child(item.label))
          .child(this.meta(t, item, session)))
        .child(v_flex().flex_none().items_end().gap(2)
          .child(div().font_family(PIXEL).text_size(11).text_color(color)
            .when(item.status === "running" && item.kind !== "monitor", (el) => el.loop("opacity", { from: 0.5, to: 1, period: 900 }))
            .child(primary))
          .child(div().text_size(10).text_color(t.dim).child(secondary))))
      .when(Boolean(item.lastEvent), (el) => el.child(h_flex().gap(6).items_center().px(8).py(5).rounded(6).bg(alpha(color, "12"))
        .child(svg(icon("activity")).size(11).flex_none().text_color(color))
        .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.muted).child(item.lastEvent))
        .child(div().flex_none().text_size(10).text_color(t.dim).child(ago(item.lastEventAt, now)))))
      .child(this.bar(t, item, now, tick, inner, color, "card"));
  }

  hero(t, items, sessions, now, tick) {
    const soon = nextUp(items, now);
    if (!soon) return null;
    const item = soon.item;
    const color = this.tone(t, item, now);
    const left = Math.max(0, soon.at - now);
    const width = this.width - 2 * BODY_PAD - 24 - 2;
    return v_flex().id("am-hero").flex_none().p(12).gap(10).rounded(11).border(1).border_color(alpha(color, "66")).bg(alpha(color, "12"))
      .when(Boolean(sessions.get(item.session)?.terminal), (el) => el.cursor_pointer()
        .on_click(() => run("pane.focus", { terminal: sessions.get(item.session).terminal })))
      .child(h_flex().gap(12).items_center()
        .child(div().relative().size(38).flex_none().rounded(10).bg(alpha(color, "26")).flex().items_center().justify_center()
          .child(div().absolute().inset_0().rounded(10).border(1).border_color(color).loop("opacity", { from: 0.1, to: 0.9, period: 1600 }))
          .child(svg(icon("zap")).size(17).text_color(color)))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(div().font_family(PIXEL).text_size(9).text_color(t.dim).child(`NEXT UP · ${KINDS[item.kind].title.toUpperCase()}`))
          .child(div().min_w(0).truncate().font_medium().text_size(13).child(item.label))
          .child(div().min_w(0).truncate().text_size(10.5).text_color(t.dim).child(sessionLabel(sessions.get(item.session), agents()))))
        .child(v_flex().flex_none().items_end().gap(2)
          .child(div().font_family(PIXEL).text_size(18).text_color(color).child(left < 1000 ? "NOW" : duration(left)))
          .child(div().text_size(10.5).text_color(t.muted).child(`${soon.verb} ${clock(soon.at, now)}`))))
      .child(this.bar(t, item, now, tick, width, color, "hero"));
  }

  section(t, kind, list, sessions, now, tick) {
    const color = t[KINDS[kind].tone] ?? t.accent;
    return v_flex().flex_none().gap(8)
      .child(h_flex().gap(7).items_center()
        .child(svg(icon(KINDS[kind].icon)).size(12).text_color(color))
        .child(div().font_family(PIXEL).text_size(10).text_color(color).child(KINDS[kind].title.toUpperCase()))
        .child(div().px(5).rounded(3).bg(alpha(color, "22")).font_family(PIXEL).text_size(9).text_color(color).child(String(list.length)))
        .child(div().flex_1().h(1).bg(alpha(t.border, "90")))
        .child(div().flex_none().text_size(10.5).text_color(t.dim).child(HINTS[kind])))
      .children(list.map((item) => this.card(t, item, sessions, now, tick)));
  }

  ended(t, list, sessions, now) {
    const open = this.endedOpen;
    return v_flex().flex_none().gap(4)
      .child(h_flex().id("am-ended-toggle").gap(7).items_center().cursor_pointer().text_color(t.dim)
        .hover((s) => s.text_color(t.foreground))
        .on_click((_e, cx) => {
          this.endedOpen = !this.endedOpen;
          try {
            localStorage.setItem("ended-open", this.endedOpen ? "1" : "0");
          } catch {}
          cx.notify();
        })
        .child(svg(icon(open ? "chevron-down" : "chevron-right")).size(12))
        .child(div().font_family(PIXEL).text_size(10).child(`RECENTLY ENDED · ${list.length}`))
        .child(div().flex_1().h(1).bg(alpha(t.border, "70")))
        .child(div().text_size(10.5).child("last 15 min")))
      .when(open, (el) => el.children(list.slice(0, ENDED_SHOWN).map((item) => {
        const color = this.tone(t, item, now);
        const bad = /fail|kill|error/.test(item.endedBy ?? "");
        const good = /complet|fired|finish/.test(item.endedBy ?? "");
        return h_flex().id(`am-ended-${item.kind}-${item.id}`).h(26).px(8).gap(8).items_center().rounded(6)
          .hover((s) => s.bg(t.hover))
          .tooltip(sessionLabel(sessions.get(item.session), agents()))
          .child(svg(icon(bad ? "x" : good ? "check" : "moon")).size(12).flex_none().text_color(bad ? color : good ? t.done : t.dim))
          .child(svg(icon(KINDS[item.kind].icon)).size(11).flex_none().text_color(t.dim))
          .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(item.label))
          .child(div().flex_none().text_size(10.5).text_color(bad ? color : t.dim).child(ENDED_WORDS[item.endedBy] ?? item.endedBy ?? "ended"))
          .child(div().flex_none().w(64).text_size(10.5).text_color(t.dim).child(ago(item.endedAt, now)));
      })));
  }

  quiet(t) {
    return v_flex().flex_none().items_center().py(34).gap(10)
      .child(div().relative().size(84).flex().items_center().justify_center()
        .child(svg(icon("sweep")).absolute().size(84).text_color(alpha(t.accent, "cc")).spin(4200))
        .child(div().size(6).rounded(3).bg(t.accent).loop("opacity", { from: 0.3, to: 1, period: 1400 })))
      .child(div().font_family(PIXEL).text_size(12).text_color(t.accent).child("ALL QUIET"))
      .child(div().max_w(320).text_center().text_size(12).text_color(t.muted).child("No monitors, loops or cron jobs are armed in any live Claude session."))
      .child(div().max_w(320).text_center().text_size(11).text_color(t.dim).child("Start one with /loop, a Monitor or CronCreate and it shows up here within seconds."));
  }

  scanning(t) {
    return h_flex().flex_none().gap(8).items_center().py(20).text_color(t.muted)
      .child(svg(icon("orbit")).size(14).text_color(t.accent).spin(900))
      .child("Reading Claude sessions…");
  }

  banner(t, text) {
    const color = t.ansi9 ?? t.blocked;
    return h_flex().flex_none().gap(8).items_center().p(10).rounded(8).border(1).border_color(alpha(color, "70")).bg(alpha(color, "16"))
      .child(svg(icon("x")).size(13).flex_none().text_color(color))
      .child(div().flex_1().min_w(0).text_size(11.5).text_color(t.foreground).child(`Couldn't read the sessions: ${text}`));
  }

  footer(t, snap, now) {
    const n = snap.sessions.length;
    return div().flex_none().pt(4).text_size(10.5).text_color(t.dim)
      .child(`Watching ${plural(n, "live Claude session")} · read ${ago(snap.at, now)} · click a card to jump to its terminal`);
  }
}
