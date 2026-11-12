// Markdown panel: a prompt library and the focused folder's .md files, edited, previewed and saved in place.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState, InputState, Input, TextView } from "gpui-base";
import { spaces, panes, focused, agents, exec, hc, readTextFile, writeTextFile, watchFolder, pickFolder, nextCommand, home, appHome, theme, settings } from "herdr";

const MARKDOWN = /\.(md|mdx|markdown)$/i;
const LIST_LIMIT = 300;
const SKIPPED_FOLDERS = ["node_modules", ".git", "dist", "build", ".next", "target", "vendor"];

function location() {
  const space = spaces().find(s => s.active), f = focused();
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on };
}
const locationKey = () => JSON.stringify(location());
const basename = path => path?.split(/[\\/]/).filter(Boolean).pop() ?? "";
const dirname = path => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
const tilde = path => path && path.startsWith(home()) ? "~" + path.slice(home().length) : path ?? "";
// Host errors read "Error: `herdr.readTextFile`: Text file exceeds 1 MiB"; people need only the last part.
const reason = e => String(e?.message ?? e).replace(/^(Error: )?`?herdr\.\w+`?: */, "");
const fingerprint = text => { let h = 5381; for (let i = 0; i < text.length; i++) h = (h * 33 ^ text.charCodeAt(i)) >>> 0; return `${text.length}:${h}`; };
const two = n => String(n).padStart(2, "0");
const localStamp = d => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
const byDepthThenName = (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b);

async function listMarkdown(folder, on) {
  const git = await exec("git", ["ls-files", "-z", "-co", "--exclude-standard", "--", "*.md", "*.mdx", "*.markdown"], { cwd: folder, on }).catch(() => null);
  let files;
  if (git?.code === 0) files = git.stdout.split("\0");
  else {
    const pruned = SKIPPED_FOLDERS.flatMap((name, i) => [...(i ? ["-o"] : []), "-name", name]);
    const found = await exec("find", [".", "-maxdepth", "4", "(", ...pruned, ")", "-prune", "-o", "-type", "f",
      "(", "-name", "*.md", "-o", "-name", "*.mdx", "-o", "-name", "*.markdown", ")", "-print0"], { cwd: folder, on });
    if (found.code !== 0 && !found.stdout) throw new Error(found.stderr.trim() || "Cannot list this folder");
    files = found.stdout.split("\0").map(file => file.replace(/^\.\//, ""));
  }
  files = files.filter(Boolean).sort(byDepthThenName);
  return { files: files.slice(0, LIST_LIMIT), more: files.length > LIST_LIMIT };
}

export default class Markdown extends View {
  init(_props, cx) {
    const t = theme();
    this.handle = cx.focus_handle();
    this.folder = localStorage.getItem("folder") || `${appHome()}/prompts`;
    this.drafts = new Set(JSON.parse(localStorage.getItem("drafts") ?? "[]"));
    this.prompts = { files: [] };
    this.here = { files: [] };
    this.file = null;
    this.mode = "edit";
    const look = { font_family: settings().font_family, font_size: 13, soft_wrap: true, line_numbers: false, folding: false, language: "markdown",
      syntax: { title: t.accent, keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6,
        emphasis: t.ansi3, "emphasis.strong": t.ansi1, link_text: t.ansi4, link_uri: t.ansi6, "text.literal": t.ansi2, "punctuation.special": t.ansi5, "punctuation.list_marker": t.ansi5 } };
    this.editor = EditorState.new(look);
    this.viewer = EditorState.new({ ...look, readonly: true });
    this.editor.on("change", (_e, cx) => this.changed(cx));
    this.input = InputState.new({ placeholder: "Prompt name (optional), ./file.md or ~/path.md" });
    this.input.on("submit", (_e, cx) => this.create(cx));
    this.refresh(cx);
    cx.timer.every(15000, cx => { if (!this.file) this.refresh(cx); });
    const last = JSON.parse(localStorage.getItem("last") ?? "null");
    if (last?.path) this.open(last, cx);
    this.listen(cx);
  }

  // keys.json can bind "markdown.save", "markdown.preview", "markdown.back"; `herdr-app do markdown.open:<name or path>` opens or creates one.
  listen(cx) {
    cx.spawn(async cx => {
      for (;;) {
        const command = await nextCommand();
        if (command === "save") this.save(cx);
        else if (command === "preview") this.toggleMode(cx);
        else if (command === "back" && this.file) this.leave(cx);
        else if (command.startsWith("open:")) this.openOrCreate(command.slice(5), cx);
      }
    });
  }

  toggleMode(cx) {
    if (!this.file || this.file.loading || this.file.error) return;
    this.mode = this.mode === "edit" ? "preview" : "edit";
    cx.notify();
  }

  async close() { this.flush(); }

  refresh(cx) {
    this.watch(cx);
    if (this.listing) return;
    this.listing = true;
    cx.spawn(async cx => {
      try { await this.loadLists(); } finally { this.listing = false; cx.notify(); }
    });
  }

  async loadLists() {
    const where = location(), folder = this.folder;
    this.hereKey = locationKey();
    const [prompts, here] = await Promise.all([
      listMarkdown(this.folder, null).catch(() => ({ files: [], missing: true })),
      where.cwd && where.cwd !== this.folder ? listMarkdown(where.cwd, where.on).catch(e => ({ files: [], error: reason(e) })) : { files: [] },
    ]);
    if (folder !== this.folder) return;
    this.prompts = prompts;
    this.here = { ...here, cwd: where.cwd !== this.folder ? where.cwd : null, on: where.on };
  }

  watch(cx) {
    const folder = this.folder;
    if (this.watching === folder) return;
    this.watching = folder;
    cx.spawn(async cx => {
      try {
        while (this.watching === folder) {
          await watchFolder(folder);
          if (this.watching === folder && !this.file) { await this.loadLists(); cx.notify(); }
        }
      } catch { if (this.watching === folder) this.watching = null; }
    });
  }

  chooseFolder(cx) {
    cx.spawn(async cx => {
      const folder = await pickFolder({ prompt: "Use for prompts" });
      if (!folder) return;
      this.folder = folder; this.watching = null; this.hereKey = null;
      localStorage.setItem("folder", folder);
      cx.notify();
    });
  }

  resolve(raw) {
    let path = raw.trim();
    if (!path) return null;
    const where = location();
    if (path.startsWith("~/")) path = home() + path.slice(1);
    else if (path.startsWith("./") && where.cwd && !where.on) path = `${where.cwd}/${path.slice(2)}`;
    else if (!path.startsWith("/")) path = `${this.folder}/${path}`;
    return MARKDOWN.test(path) || /\.txt$/i.test(path) ? path : `${path}.md`;
  }

  // An empty name still makes a new prompt, named by the time it was started.
  create(cx) {
    const raw = this.input.value().trim() || `prompt-${localStamp(new Date())}`;
    this.input.set_value("");
    this.openOrCreate(raw, cx);
  }

  openOrCreate(raw, cx) {
    const path = this.resolve(raw);
    if (!path) return;
    const file = this.begin({ path, on: null });
    cx.notify();
    cx.spawn(async cx => {
      let created = false;
      try {
        if (await readTextFile(path) === null) {
          await writeTextFile(path, `# ${basename(path).replace(MARKDOWN, "")}\n\n`, null);
          created = true;
        }
      } catch (e) {
        if (this.file === file) { this.file = null; localStorage.removeItem("last"); this.notice = { level: "error", text: reason(e) }; cx.notify(); }
        return;
      }
      await this.load(file, cx);
      if (created && this.file === file && !this.notice) this.notice = { level: "success", text: "New file saved · click below the title and start writing" };
      await this.loadLists();
      cx.notify();
    });
  }

  begin(target) {
    this.flush();
    this.file = { path: target.path, on: target.on ?? null, name: basename(target.path), loading: true };
    this.notice = null; this.conflict = false; this.mode = "edit";
    localStorage.setItem("last", JSON.stringify({ path: target.path, on: target.on ?? null }));
    return this.file;
  }

  open(target, cx) {
    const file = this.begin(target);
    cx.notify();
    cx.spawn(cx => this.load(file, cx));
  }

  async load(file, cx) {
    try {
      const text = await readTextFile(file.path, { on: file.on });
      if (this.file !== file) return;
      if (text === null) { file.error = "This file no longer exists"; return; }
      if (text.includes("\0")) { file.error = "Binary file · nothing to edit"; return; }
      file.readonly = Boolean(file.on);
      if (file.readonly) this.notice = { level: "info", text: "Remote file · read-only" };
      const state = file.readonly ? this.viewer : this.editor;
      this.disk = text;
      state.set_value(text);
      this.baseline = state.value();
      const draft = file.readonly ? null : this.readDraft(file.path);
      if (draft && draft.text !== this.baseline) {
        state.set_value(draft.text);
        file.stale = draft.base !== fingerprint(text);
        this.conflict = file.stale;
        this.notice = file.stale
          ? { level: "error", text: "Restored unsaved changes, but the file changed on disk since. Reload or Overwrite." }
          : { level: "info", text: "Restored unsaved changes" };
      }
      file.dirty = state.value() !== this.baseline;
    } catch (e) {
      if (this.file === file) file.error = `Cannot open this file: ${reason(e)}`;
    } finally {
      if (this.file === file) { file.loading = false; cx.notify(); }
    }
  }

  leave(cx) {
    this.flush();
    this.file = null; this.notice = null; this.conflict = false;
    localStorage.removeItem("last");
    this.refresh(cx);
    cx.notify();
  }

  changed(cx) {
    const file = this.file;
    if (!file || file.loading || file.readonly || file.error) return;
    const dirty = this.editor.value() !== this.baseline;
    if (!dirty) this.setDraft(file.path, null);
    else if (!this.flushQueued) {
      this.flushQueued = true;
      cx.timer.after(500, () => { this.flushQueued = false; this.flush(); });
    }
    if (dirty !== file.dirty) { file.dirty = dirty; cx.notify(); }
  }

  flush() {
    const file = this.file;
    if (!file || file.loading || file.readonly || file.error) return;
    const text = this.editor.value();
    this.setDraft(file.path, text !== this.baseline ? text : null, this.disk);
  }

  // A draft remembers which disk version it was written over, so a later restore can tell the file moved.
  readDraft(path) {
    try { const draft = JSON.parse(localStorage.getItem(`draft:${path}`)); return typeof draft?.text === "string" ? draft : null; }
    catch { return null; }
  }

  setDraft(path, text, disk) {
    const had = this.drafts.has(path);
    if (text === null) { localStorage.removeItem(`draft:${path}`); this.drafts.delete(path); }
    else { localStorage.setItem(`draft:${path}`, JSON.stringify({ text, base: fingerprint(disk ?? "") })); this.drafts.add(path); }
    if (had !== this.drafts.has(path)) localStorage.setItem("drafts", JSON.stringify([...this.drafts]));
  }

  save(cx, overwrite = false) {
    const file = this.file;
    if (!file || file.loading || file.readonly || file.error || this.saving) return;
    if (file.stale && !overwrite) {
      this.conflict = true;
      this.notice = { level: "error", text: "Not saved: the file changed on disk since these edits. Reload or Overwrite." };
      cx.notify();
      return;
    }
    const text = this.editor.value();
    this.saving = true;
    cx.notify();
    cx.spawn(async cx => {
      try {
        const expected = overwrite ? await readTextFile(file.path) : this.disk;
        await writeTextFile(file.path, text, expected);
        if (this.file !== file) {
          const draft = this.readDraft(file.path);
          if (draft) this.setDraft(file.path, draft.text === text ? null : draft.text, text);
          return;
        }
        this.disk = text; this.baseline = text; this.conflict = false; file.stale = false;
        file.dirty = this.editor.value() !== text;
        this.setDraft(file.path, file.dirty ? this.editor.value() : null, text);
        this.notice = { level: "success", text: "Saved" };
        const saved = this.notice;
        cx.timer.after(2000, cx => { if (this.notice === saved) { this.notice = null; cx.notify(); } });
      } catch (e) {
        if (this.file === file) { this.conflict = true; this.notice = { level: "error", text: `Not saved: ${reason(e)}` }; }
      } finally { this.saving = false; cx.notify(); }
    });
  }

  reload(cx) {
    const file = this.file;
    if (!file) return;
    this.setDraft(file.path, null);
    this.file = null;
    this.open({ path: file.path, on: file.on }, cx);
  }

  // Only an agent: `hc send` presses Enter, so a plain shell would run the document line by line.
  sendTarget() {
    const agent = agents().find(a => a.focused);
    return agent ? { address: agent.address, name: agent.program?.name ?? agent.title } : null;
  }

  send(cx) {
    const target = this.sendTarget(), file = this.file;
    const text = (file?.readonly ? this.viewer : this.editor).value().trim();
    if (!target || !text || this.sending) return;
    this.sending = true;
    cx.notify();
    cx.spawn(async cx => {
      try {
        const sent = await hc(["send", "--", target.address, text]);
        this.notice = sent.code === 0 ? { level: "success", text: `Sent to ${target.name}` } : { level: "error", text: sent.stderr.trim() || "Send failed" };
      } catch (e) { this.notice = { level: "error", text: `Send failed: ${reason(e)}` }; }
      finally { this.sending = false; cx.notify(); }
    });
  }

  key(e, cx) {
    if (e.keystroke === "cmd-s") { this.save(cx); cx.stop_propagation(); }
    else if (e.keystroke === "cmd-e") { this.toggleMode(cx); cx.stop_propagation(); }
  }

  button(t, id, label, primary, action) {
    return h_flex().id(id).h(26).px(9).flex_none().items_center().rounded(6).text_size(12).cursor_pointer()
      .border_1().border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised).text_color(primary ? t.solid_foreground : t.foreground)
      .hover(s => s.opacity(0.88)).on_click((_e, cx) => action(cx)).child(div().max_w(150).truncate().child(label));
  }

  link(t, id, label, action) {
    return div().id(id).flex_none().cursor_pointer().text_color(t.muted).hover(s => s.text_color(t.foreground))
      .on_click((_e, cx) => { action(cx); cx.notify(); }).child(label);
  }

  noticeBar(t) {
    const n = this.notice;
    const color = n.level === "error" ? t.ansi1 : n.level === "success" ? t.ansi2 : t.muted;
    return h_flex().flex_none().px(12).py(6).gap(10).items_center().text_size(11.5).bg(t.surface).border_b(1).border_color(t.border)
      .child(div().flex_1().min_w(0).text_color(color).child(n.text))
      .when(this.conflict, el => el.child(this.link(t, "md-reload", "Reload", cx => this.reload(cx)))
        .child(this.link(t, "md-overwrite", "Overwrite", cx => this.save(cx, true))))
      .child(this.link(t, "md-dismiss", "×", () => { this.notice = null; this.conflict = false; }));
  }

  rows(t, list, root, on, prefix) {
    return list.files.map(rel => {
      const path = `${root}/${rel}`;
      return h_flex().id(`md-${prefix}-${rel}`).h(28).flex_none().px(8).gap(7).items_center().rounded(7).cursor_pointer().hover(s => s.bg(t.hover))
        .on_click((_e, cx) => this.open({ path, on }, cx))
        .child(svg("mods/markdown/markdown.svg").size(14).flex_none().text_color(t.muted))
        .child(div().flex_1().min_w(0).truncate().child(basename(rel)))
        .when(Boolean(dirname(rel)), el => el.child(div().flex_none().max_w(96).truncate().text_size(11).text_color(t.dim).child(dirname(rel))))
        .when(!on && this.drafts.has(path), el => el.child(div().size(6).flex_none().rounded(3).bg(t.blocked)));
    });
  }

  library(t) {
    const section = (title, detail, action) => h_flex().h(28).flex_none().px(8).mt(4).gap(6).items_center().text_size(11).text_color(t.dim)
      .child(div().font_semibold().child(title))
      .child(div().flex_1().min_w(0).truncate().child(detail))
      .when(Boolean(action), el => el.child(action));
    const hint = text => div().px(8).py(4).text_size(12).text_color(t.dim).child(text);
    const here = this.here;
    return v_flex().flex_1().min_h(0)
      .child(h_flex().flex_none().p(8).gap(6).items_center().border_b(1).border_color(t.border)
        .child(Input.new(this.input).flex_1().h(30).px(9).rounded(7).border_1().border_color(t.input).bg(t.surface).text_size(12.5).text_color(t.foreground))
        .child(this.button(t, "md-new", "+ New", true, cx => this.create(cx))))
      .when(Boolean(this.notice), el => el.child(this.noticeBar(t)))
      .child(v_flex().id("md-list").flex_1().min_h(0).overflow_y_scrollbar().p(6)
        .child(section("PROMPTS", tilde(this.folder), this.link(t, "md-folder", "Change", cx => this.chooseFolder(cx))))
        .children(this.rows(t, this.prompts, this.folder, null, "p"))
        .when(!this.prompts.files.length, el => el.child(hint(this.listing ? "Loading…" : "No prompts yet · press + New to write one")))
        .when(Boolean(here.cwd), el => el
          .child(section("HERE", tilde(here.cwd)))
          .children(this.rows(t, here, here.cwd, here.on, "h"))
          .when(!here.files.length, el => el.child(hint(here.error || (this.listing ? "Loading…" : "No markdown files in this folder"))))
          .when(Boolean(here.more), el => el.child(hint(`Showing the first ${LIST_LIMIT} files`)))));
  }

  document(t) {
    const file = this.file, target = this.sendTarget(), ready = !file.loading && !file.error;
    const state = file.readonly ? this.viewer : this.editor;
    const segment = (id, label, mode) => div().id(id).h(24).px(9).flex().items_center().rounded(5).text_size(12).cursor_pointer()
      .bg(this.mode === mode ? t.selected : t.background).text_color(this.mode === mode ? t.foreground : t.muted).hover(s => s.text_color(t.foreground))
      .on_click((_e, cx) => { this.mode = mode; cx.notify(); }).child(label);
    const body = !ready
      ? div().p(12).text_color(t.dim).child(file.error ?? "Loading…")
      : this.mode === "preview"
        ? v_flex().id("md-preview-scroll").flex_1().min_h(0).overflow_y_scrollbar().px(16).py(12)
          .child(TextView.markdown("md-preview", state.value()).selectable(true))
        : v_flex().flex_1().min_h(0).pl(12).pr(4).pt(8).child(Editor.new(state).flex_1().min_h(0));
    return v_flex().flex_1().min_h(0)
      .child(h_flex().h(38).flex_none().px(8).gap(4).items_center().border_b(1).border_color(t.border)
        .when(ready, el => el.child(h_flex().p(2).gap(2).rounded(7).bg(t.background).border_1().border_color(t.border)
          .child(segment("md-mode-edit", "Edit", "edit")).child(segment("md-mode-preview", "Preview", "preview"))))
        .child(div().flex_1())
        .when(ready && Boolean(target), el => el.child(this.button(t, "md-send", this.sending ? "Sending…" : `Send to ${target.name}`, false, cx => this.send(cx))))
        .when(ready && !file.readonly, el => el.child(this.button(t, "md-save", this.saving ? "Saving…" : "Save", Boolean(file.dirty), cx => this.save(cx)))))
      .when(Boolean(this.notice), el => el.child(this.noticeBar(t)))
      .child(body);
  }

  render(cx) {
    if (!this.file && locationKey() !== this.hereKey) this.refresh(cx);
    const t = theme(), file = this.file;
    return v_flex().id("markdown").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .when(Boolean(file), el => el.child(this.link(t, "md-back", "←", cx => this.leave(cx)).w(20)))
        .child(div().font_semibold().child("Markdown"))
        .child(div().flex_1().min_w(0).truncate().text_right().text_size(12).text_color(t.dim).child(file ? tilde(file.path) : ""))
        .when(Boolean(file?.dirty), el => el.child(div().size(7).flex_none().rounded(4).bg(t.blocked))))
      .child(file ? this.document(t) : this.library(t));
  }
}
