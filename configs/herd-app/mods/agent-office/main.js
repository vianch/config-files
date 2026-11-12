import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, appHome, exec, layout, nextCommand, props, readTextFile, settings, spaces, theme } from "herdr";
import { PIXEL } from "./art.js";
import { BODY_PAD_PX, buildingWidth, claudeCandidates, focusMoved, focusedSession, look, money, normalize, parseHelperOutput, pickSession, pollDelay, roomsOf, shouldNotify, shownInLayout, stepSession } from "./data.js";
import { alpha, banner, chromeIcon, comms, danger, emptyOffice, skills } from "./panels.js";
import { building } from "./scene.js";

const TICK_MS = 1000;
const IDLE_MS = 10000;
const HELPER_TIMEOUT_MS = 10000;
const SAMPLE = "fixtures/demo.json";
const SKIP_MS = 60000;
const WHY = {
  pinned: ["pinned", "you picked this session; focusing another Claude agent switches back to automatic"],
  focused: ["auto · focused", "automatic: follows the Claude agent you focus"],
  kept: ["auto · last focused", "automatic: the Claude agent you focused last, kept while another kind of pane has focus"],
  recent: ["auto · latest", "automatic: the most recently active Claude agent with a transcript"],
  fallback: ["auto", "automatic: no other session could be read"],
};

const modDir = () => `${appHome()}/mods/agent-office`;
const helperPath = () => `${modDir()}/office.py`;
const messageOf = (error) => String(error?.message ?? error ?? "unknown error");
const lastLine = (text) => text.trim().split("\n").pop();

export default class AgentOffice extends View {
  init(_props, cx) {
    this.width = 520;
    this.remembered = localStorage.getItem("session");
    this.following = null;
    this.followingWhy = null;
    this.seenFocus = undefined;
    this.skipped = new Map();
    this.mode = "starting";
    this.snapshot = null;
    this.key = null;
    this.error = null;
    this.address = null;
    this.helper = false;
    this.lastPoll = 0;
    this.lastRender = 0;
    this.selected = null;
    this.promptOpen = false;
    this.allComms = false;
    this.menuOpen = false;
    this.sample = false;
    this.poll(cx);
    this.listen(cx);
    cx.timer.every(TICK_MS, (cx) => {
      if (Date.now() - this.lastPoll >= this.delay()) this.poll(cx);
    });
  }

  listen(cx) {
    cx.spawn(async (cx) => {
      for (;;) {
        const name = await nextCommand();
        if (name === "next-agent") this.selectNext(cx);
        if (name === "auto-session") this.unpin(cx);
        if (name === "toggle-sample") {
          this.sample = !this.sample;
          this.poll(cx);
        }
        const step = name === "next-session" ? 1 : name === "prev-session" ? -1 : 0;
        const address = step && stepSession(this.candidates(), this.current(), step);
        if (address) this.pick(address, cx);
      }
    });
  }

  delay() {
    const shown = shownInLayout(layout(), "agent-office");
    return this.mode === "live" || !shown ? pollDelay(this.snapshot, shown) : IDLE_MS;
  }

  candidates() {
    return claudeCandidates(agents(), spaces());
  }

  followFocus() {
    const focus = focusedSession(this.candidates());
    if (focusMoved(this.seenFocus, focus) && this.remembered && this.remembered !== focus) {
      this.remembered = null;
      localStorage.removeItem("session");
    }
    this.seenFocus = focus;
  }

  choice() {
    const now = Date.now();
    for (const [address, at] of this.skipped) if (now - at > SKIP_MS) this.skipped.delete(address);
    return pickSession(this.candidates(), { pinned: this.remembered, following: this.following, skipped: new Set(this.skipped.keys()) });
  }

  current() {
    return this.choice()?.address ?? null;
  }

  poll(cx) {
    if (this.loading) {
      this.again = true;
      return;
    }
    this.loading = true;
    this.lastPoll = Date.now();
    cx.spawn(async (cx) => {
      try {
        await this.refresh(cx);
      } catch (error) {
        this.show(cx, this.mode, this.address, null, messageOf(error));
      } finally {
        this.loading = false;
        if (this.again) {
          this.again = false;
          this.poll(cx);
        }
      }
    });
  }

  async refresh(cx) {
    const fixture = props()?.fixture;
    if (fixture) return this.loadFixture(cx, fixture, "fixture");
    if (this.sample) return this.loadFixture(cx, SAMPLE, "sample");
    if (!this.helper) this.helper = (await exec("test", ["-f", helperPath()], { timeout: 5000 })).code === 0;
    if (!this.helper) return this.loadFixture(cx, SAMPLE, "sample");
    const tries = this.candidates().length;
    for (let attempt = 0; attempt <= tries; attempt += 1) {
      const choice = this.choice();
      if (!choice) return this.show(cx, "none", null, null, null);
      const { snapshot, error } = await this.readSession(choice.address);
      if (choice.address !== this.current()) return;
      const untried = choice.why === "focused" || choice.why === "recent";
      if (error && untried) {
        this.skipped.set(choice.address, Date.now());
        continue;
      }
      if (!error && choice.why !== "pinned" && choice.why !== "following") {
        this.following = choice.address;
        this.followingWhy = choice.why;
      }
      return this.show(cx, "live", choice.address, snapshot, error);
    }
  }

  async readSession(address) {
    const result = await exec("python3", ["-I", helperPath(), "--terminal", address], { timeout: HELPER_TIMEOUT_MS })
      .catch((error) => ({ code: -1, stdout: "", stderr: messageOf(error) }));
    const parsed = parseHelperOutput(result.stdout);
    const error = parsed.error && !result.stdout.trim() && result.stderr.trim() ? lastLine(result.stderr) : parsed.error;
    return { snapshot: parsed.snapshot ?? null, error: error ?? null };
  }

  async loadFixture(cx, file, mode) {
    const path = file.startsWith("/") ? file : `${modDir()}/${file}`;
    const text = await readTextFile(path);
    if (text == null) return this.show(cx, mode, path, null, `no fixture at ${path}`);
    this.show(cx, mode, path, normalize(JSON.parse(text)), null);
  }

  show(cx, mode, address, snapshot, error) {
    const moved = address !== this.address || mode !== this.mode;
    if (moved) {
      this.snapshot = null;
      this.key = null;
      this.selected = null;
    }
    this.mode = mode;
    this.address = address;
    const errorChanged = error !== this.error;
    this.error = error;
    if (!snapshot) {
      if (moved || errorChanged) cx.notify();
      return;
    }
    const key = JSON.stringify({ ...snapshot, at: 0, ms: 0 });
    const moving = mode === "live" && pollDelay(snapshot) < IDLE_MS;
    const notify = moved || errorChanged || shouldNotify(this.key, key, moving, Date.now() - this.lastRender);
    this.snapshot = snapshot;
    this.key = key;
    if (notify) cx.notify();
  }

  selectNext(cx) {
    const ids = roomsOf(this.snapshot?.agents ?? []).flatMap((r) => r.agents.map((a) => a.id));
    const at = ids.indexOf(this.selected);
    this.selected = at + 1 < ids.length ? ids[at + 1] : null;
    cx.notify();
  }

  unpin(cx) {
    this.remembered = null;
    localStorage.removeItem("session");
    this.following = null;
    this.followingWhy = null;
    this.skipped.clear();
    this.menuOpen = false;
    this.sample = false;
    this.poll(cx);
    cx.notify();
  }

  pick(address, cx) {
    this.remembered = address;
    localStorage.setItem("session", address);
    this.menuOpen = false;
    this.sample = false;
    this.poll(cx);
    cx.notify();
  }

  render(cx) {
    this.lastRender = Date.now();
    const t = theme();
    const dark = settings()?.dark !== false;
    const snap = this.snapshot;
    this.now = snap?.at || Date.now();
    this.followFocus();
    if (this.mode === "live" && this.address && this.address !== this.current()) this.poll(cx);
    else if (Date.now() - this.lastPoll >= this.delay()) this.poll(cx);
    return v_flex().id("ao-root").size_full().min_h(0).bg(t.chrome).text_color(t.foreground).text_size(12.5)
      .on_size_change((size, cx) => {
        const width = size.width / (Number(settings()?.zoom) || 1);
        if (Math.abs(width - this.width) < 1) return;
        this.width = width;
        cx.notify();
      })
      .child(this.header(t, dark, snap))
      .child(this.switcher(t))
      .when(this.menuOpen, (el) => el.child(this.menu(t)))
      .child(v_flex().id("ao-body").flex_1().min_h(0).overflow_y_scrollbar().px(BODY_PAD_PX).pt(4).pb(18).gap(14)
        .children(this.body(t, dark, snap)));
  }

  header(t, dark, snap) {
    const busy = snap && snap.coordinator.state !== "idle" && (this.mode !== "live" || snap.session.live);
    const dot = busy ? t.working : snap?.session.live ? t.idle : t.dim;
    const agentsList = snap?.agents ?? [];
    const live = agentsList.filter((a) => look(a.status).animate).length;
    const cost = snap ? money(snap.totals) : null;
    const teammates = agentsList.filter((a) => a.kind === "teammate").length;
    const costTip = cost?.estimated ? "estimated from token counts"
      : cost?.crew ? `crew total: lead + ${teammates} teammate${teammates === 1 ? "" : "s"}, from the engine's own counts`
        : "the lead session's engine total";
    return h_flex().flex_none().h(40).px(14).gap(8).items_center().border_b(1).border_color(t.border)
      .child(div().font_family(PIXEL).text_size(15).text_color(t.accent).child("OFFICE"))
      .child(div().size(8).flex_none().rounded(4).bg(dot).when(Boolean(busy), (el) => el.loop("opacity", { from: 0.2, to: 1, period: 900 })))
      .child(div().flex_1())
      .when(Boolean(snap), (el) => el
        .child(div().flex_none().text_size(11).text_color(t.muted).child(`${live} live · ${agentsList.length} on staff`))
        .child(h_flex().flex_none().gap(4).items_center().px(7).h(22).rounded(5).bg(t.surface).border(1).border_color(t.border)
          .tooltip(costTip)
          .child(div().font_family(PIXEL).text_size(10).text_color(t.foreground).child(cost.text))
          .child(div().text_size(10).text_color(t.dim).child(cost.estimated ? "est." : cost.crew ? "crew" : "lead"))));
  }

  switcher(t) {
    const list = this.candidates();
    const choice = this.choice();
    const chosen = list.find((c) => c.address === choice?.address);
    const label = this.mode === "sample" ? "Sample office" : this.mode === "fixture" ? this.address?.split("/").pop() : chosen?.label ?? "No Claude session";
    const canSwitch = this.mode === "live" || this.mode === "none";
    return h_flex().flex_none().px(12).py(8).gap(8).items_center()
      .child(h_flex().id("ao-switch").flex_1().min_w(0).h(26).px(8).gap(6).items_center().rounded(6).border(1)
        .border_color(this.menuOpen ? t.accent : t.border).bg(t.surface)
        .when(canSwitch && list.length > 0, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => {
          this.menuOpen = !this.menuOpen;
          cx.notify();
        }))
        .child(svg(chromeIcon("terminal")).size(13).flex_none().text_color(t.muted))
        .child(div().flex_1().min_w(0).truncate().font_medium().child(label))
        .when(this.mode === "live" && Boolean(choice), (el) => {
          const why = choice.why === "following" ? (this.followingWhy === "focused" ? "kept" : this.followingWhy) : choice.why;
          const [text, tip] = WHY[why] ?? WHY.fallback;
          return el.child(div().flex_none().px(5).rounded(3).border(1).border_color(t.border)
            .text_size(10).text_color(choice.why === "pinned" ? t.accent : t.dim).tooltip(tip).child(text));
        })
        .when(list.length > 1 && canSwitch, (el) => el.child(div().flex_none().px(4).rounded(3).bg(t.raised).text_size(10).text_color(t.muted).child(String(list.length))))
        .when(canSwitch && list.length > 0, (el) => el.child(svg(chromeIcon("chevron-down")).size(11).flex_none().text_color(t.dim))));
  }

  menu(t) {
    const address = this.current();
    const pinned = this.choice()?.why === "pinned";
    return v_flex().flex_none().mx(12).mb(8).p(4).rounded(8).border(1).border_color(t.border).bg(t.popover)
      .child(h_flex().id("ao-pick-auto").h(30).px(8).gap(8).items_center().rounded(6).cursor_pointer()
        .hover((el) => el.bg(t.hover))
        .on_click((_e, cx) => this.unpin(cx))
        .child(div().w(13).flex_none().when(!pinned, (el) => el.child(svg(chromeIcon("check")).size(13).text_color(t.accent))))
        .child(div().flex_1().min_w(0).truncate().child("Automatic"))
        .child(div().flex_none().text_size(10.5).text_color(t.dim).child("follows focus, else most recent")))
      .children(this.candidates().map((c, i) => h_flex().id(`ao-pick-${i}`).h(30).px(8).gap(8).items_center().rounded(6).cursor_pointer()
        .hover((el) => el.bg(t.hover))
        .on_click((_e, cx) => this.pick(c.address, cx))
        .child(div().w(13).flex_none().when(pinned && c.address === address, (el) => el.child(svg(chromeIcon("check")).size(13).text_color(t.accent))))
        .child(div().size(7).flex_none().rounded(4).bg(t[c.status] ?? t.idle))
        .child(div().flex_1().min_w(0).truncate().child(c.label))
        .child(div().flex_none().text_size(10.5).text_color(t.dim).child(c.address))));
  }

  body(t, dark, snap) {
    const notes = [];
    if (this.mode === "sample") notes.push(banner(t, t.accent, "monitor", "Sample office", this.helper
      ? "A made-up session that shows every desk state. Run agent-office.toggle-sample again for the real one."
      : "The data helper (office.py) isn't installed yet, so this is a made-up session. The real one appears as soon as the helper lands."));
    if (this.error) notes.push(banner(t, danger(t, dark), "x", snap ? "Couldn't refresh; showing the last good view" : "The office couldn't open this session", this.error));
    if (this.mode === "starting") return [...notes, emptyOffice(t, "Opening the office", "Reading the session…")];
    if (this.mode === "none") return [...notes, emptyOffice(t, "No Claude session", "No Claude Code agent is running in Herdr on this machine. Start claude in a terminal and its office opens here.")];
    if (!snap && this.error) return [...notes, emptyOffice(t, "Office closed", "Pick another session above, or wait: a session that just started has no transcript yet.")];
    if (!snap) return [...notes, emptyOffice(t, "Opening the office", "Reading the session…")];
    const width = buildingWidth(this.width);
    return [
      ...notes,
      building(this, t, dark, snap, this.now, width),
      comms(this, t, snap, this.now),
      skills(t, snap, this.now),
    ];
  }
}
