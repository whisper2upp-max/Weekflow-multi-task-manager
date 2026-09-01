import { useEffect, useMemo, useRef, useState } from "react";
import * as ai from "../../shared/ai-provider";
import * as richText from "../../shared/rich-text";
import type { QuickNote } from "../../shared/types";
import RichTextEditor from "../components/AdvancedRichTextEditor";
import RichTextView from "../components/RichTextView";
import { isEnglish, tConfirm } from "../lib/i18n";
import { useDataStore } from "../store/dataStore";
import { useUiStore } from "../store/uiStore";

function noteTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(isEnglish() ? "en-US" : "zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  });
}

interface ProtectedTable { token: string; html: string }
function prepareAiRewritePayload(originalHtml: string): { text: string; tables: ProtectedTable[] } {
  const template = document.createElement("template");
  template.innerHTML = originalHtml;
  const seed = crypto.randomUUID().replace(/[^a-z0-9]/gi, "").toUpperCase();
  const tables = Array.from(template.content.querySelectorAll("table"))
    .filter((table) => !table.parentElement?.closest("table"))
    .map((table, index) => {
      const token = `[[WEEKFLOW_TABLE_${seed}_${index + 1}]]`;
      const html = richText.sanitizeHtml(table.outerHTML, richText.MAX_NOTE_TEXT);
      const placeholder = document.createElement("p");
      placeholder.textContent = token;
      table.replaceWith(placeholder);
      return { token, html };
    });
  return { text: richText.plainText(template.innerHTML), tables };
}

function restoreAiTables(result: string, tables: ProtectedTable[]): { ok: boolean; html?: string } {
  const rewritten = String(result || "").replace(/\r\n/g, "\n");
  if (!tables.length) return { ok: true, html: richText.fromPlainText(rewritten) };
  const output: string[] = [];
  let cursor = 0;
  for (const table of tables) {
    const position = rewritten.indexOf(table.token, cursor);
    if (position < 0 || rewritten.indexOf(table.token, position + table.token.length) >= 0) return { ok: false };
    output.push(richText.fromPlainText(rewritten.slice(cursor, position)), table.html);
    cursor = position + table.token.length;
  }
  for (let index = 1; index < tables.length; index += 1) {
    if (rewritten.indexOf(tables[index - 1].token) > rewritten.indexOf(tables[index].token)) return { ok: false };
  }
  output.push(richText.fromPlainText(rewritten.slice(cursor)));
  const combined = output.join("");
  if (richText.plainText(combined).length > richText.MAX_NOTE_TEXT) return { ok: false };
  const html = richText.sanitizeHtml(combined, richText.MAX_NOTE_TEXT);
  const verification = document.createElement("template");
  verification.innerHTML = html;
  return verification.content.querySelectorAll("table").length === tables.length ? { ok: true, html } : { ok: false };
}

export default function NotesView() {
  const view = useUiStore((state) => state.view);
  const data = useDataStore((state) => state.data);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "favorites">("all");
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [aiOriginalHtml, setAiOriginalHtml] = useState<string | null>(null);
  const [aiSettingsVersion, setAiSettingsVersion] = useState(0);
  const rewriteOperationRef = useRef<{ id: string; noteId: string; isNew: boolean; originalHtml: string } | null>(null);
  const activeNoteRef = useRef({ selectedId, isNew, html });
  activeNoteRef.current = { selectedId, isNew, html };

  const selected = selectedId ? data?.notes.find((note) => note.id === selectedId) || null : null;
  const notes = useMemo(() => (data?.notes || []).slice()
    .filter((note) => scope === "all" || note.favorite)
    .filter((note) => !search.trim() || `${note.title}\n${note.contentText}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()), [data?.notes, search, scope]);

  const markDirty = (): void => {
    setDirty(true);
    useUiStore.getState().setNoteDirty(true);
  };
  const markClean = (): void => {
    setDirty(false);
    useUiStore.getState().setNoteDirty(false);
  };

  const load = (note: QuickNote | null, nextIsNew = false): void => {
    rewriteOperationRef.current = null;
    setRewriting(false);
    setAiOriginalHtml(null);
    setSelectedId(note?.id || null);
    setIsNew(nextIsNew);
    setTitle(note?.title || "");
    setHtml(note?.contentHtml || "");
    setText(note?.contentText || "");
    markClean();
  };

  useEffect(() => {
    if (!data || dirty || isNew) return;
    if (selectedId) {
      const current = data.notes.find((note) => note.id === selectedId);
      if (current) {
        setTitle(current.title);
        setHtml(current.contentHtml);
        setText(current.contentText);
        return;
      }
    }
    const first = data.notes.filter((note) => scope === "all" || note.favorite).slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] || null;
    load(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.notes, selectedId, scope]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      if (!useUiStore.getState().noteDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  if (!data) return null;
  const editing = Boolean(selected || isNew);
  const save = async (silent = false): Promise<string | null> => {
    if (saving) return null;
    if (!title.trim()) {
      if (!silent) useUiStore.getState().pushToast("请输入笔记标题。", "error");
      return null;
    }
    setSaving(true);
    const id = await useDataStore.getState().saveQuickNote({
      id: selected?.id,
      title,
      contentHtml: html,
      contentText: text
    });
    setSaving(false);
    if (id) {
      setSelectedId(id);
      setIsNew(false);
      markClean();
    }
    return id;
  };

  const ensureSaved = async (): Promise<string | null> => {
    if (selected && !dirty && !isNew) return selected.id;
    return save(true);
  };

  const requestSelect = (note: QuickNote): void => {
    if (note.id === selectedId && !isNew) return;
    if (dirty && !tConfirm("当前笔记尚未保存，继续后修改会丢失。仍要继续吗？")) return;
    load(note);
  };

  const newNote = (): void => {
    if (dirty && !tConfirm("当前笔记尚未保存，继续后修改会丢失。仍要继续吗？")) return;
    load(null, true);
  };

  const changeScope = (nextScope: "all" | "favorites"): void => {
    if (nextScope === scope) return;
    if (dirty && !tConfirm("当前笔记尚未保存，继续后修改会丢失。仍要继续吗？")) return;
    setScope(nextScope);
    if (nextScope === "favorites" && selected && !selected.favorite) load(null);
  };

  const toggleFavorite = (note: QuickNote): void => {
    const removingSelectedFromFavorites = scope === "favorites" && note.id === selectedId && note.favorite;
    void useDataStore.getState().toggleQuickNoteFavorite(note.id).then((ok) => {
      if (ok && removingSelectedFromFavorites) load(null);
    });
  };

  const currentAiSettings = ai.getSettings();
  void aiSettingsVersion;
  const toggleNoteAi = (enabled: boolean): void => {
    ai.saveSettings({ ...currentAiSettings, noteAiEnabled: enabled });
    setAiSettingsVersion((version) => version + 1);
    useUiStore.getState().pushToast(enabled ? "已开启随手记 AI 转换" : "已关闭随手记 AI 转换");
  };

  const rewrite = async (): Promise<void> => {
    if (rewriting) return;
    const editor = document.getElementById("note-editor");
    const originalHtml = richText.sanitizeHtml(editor?.innerHTML || html, richText.MAX_NOTE_TEXT);
    const payload = prepareAiRewritePayload(originalHtml);
    if (!payload.text.trim()) return void useUiStore.getState().pushToast("笔记内容为空，无法改写。", "warning");
    const settings = ai.getSettings();
    if (!ai.isEnabled(settings)) return void useUiStore.getState().pushToast("请先在 AI 设置中接入并启用 AI。", "warning");
    if (!settings.noteAiEnabled) return void useUiStore.getState().pushToast("请在随手记界面开启 AI 转换。", "warning");
    if (!tConfirm("AI 将改写当前笔记内容，原意不变，但表达会被结构化。是否继续？")) return;
    const operation = { id: crypto.randomUUID(), noteId: selectedId || "", isNew, originalHtml };
    rewriteOperationRef.current = operation;
    setRewriting(true);
    try {
      const result = await ai.rewriteNote(payload.text, settings);
      const active = activeNoteRef.current;
      const currentHtml = richText.sanitizeHtml(document.getElementById("note-editor")?.innerHTML || active.html, richText.MAX_NOTE_TEXT);
      if (rewriteOperationRef.current !== operation || (active.selectedId || "") !== operation.noteId || active.isNew !== operation.isNew || currentHtml !== operation.originalHtml) {
        useUiStore.getState().pushToast("AI 改写期间笔记内容或当前笔记已变化，本次结果未应用。", "warning", 6000);
        return;
      }
      const restored = restoreAiTables(result, payload.tables);
      if (!restored.ok || !restored.html) {
        useUiStore.getState().pushToast("AI 未完整保留表格及其位置，本次改写已取消，原笔记未发生变化。", "warning", 7000);
        return;
      }
      setAiOriginalHtml(originalHtml);
      setHtml(restored.html);
      setText(richText.plainText(restored.html));
      markDirty();
      useUiStore.getState().pushToast("AI 改写完成，请检查后保存。");
    } catch (error) {
      useUiStore.getState().pushToast(`AI 改写失败：${ai.errorMessage(error, isEnglish())}`, "error", 7000);
    } finally {
      if (rewriteOperationRef.current === operation) rewriteOperationRef.current = null;
      setRewriting(false);
    }
  };

  const restoreOriginal = (): void => {
    if (!aiOriginalHtml) return;
    setHtml(aiOriginalHtml);
    setText(richText.plainText(aiOriginalHtml));
    setAiOriginalHtml(null);
    markDirty();
    useUiStore.getState().pushToast("已恢复为改写前原文。");
  };

  const remove = (): void => {
    if (!selected) return;
    if (!tConfirm(`确认删除笔记「${selected.title}」？已转换的 Task 和进度记录不会删除。`)) return;
    if (!tConfirm("请再次确认删除这条笔记。删除后无法恢复。")) return;
    void useDataStore.getState().deleteQuickNote(selected.id).then((ok) => {
      if (ok) load(null);
    });
  };

  const convert = async (type: "progress" | "task"): Promise<void> => {
    const noteId = await ensureSaved();
    if (!noteId) return;
    useUiStore.getState().openDialog(type === "progress"
      ? { type: "noteProgress", noteId }
      : { type: "taskDrafts", noteId });
  };

  const progressConversions = selected?.conversions.filter((item) => item.type === "progress").length || 0;
  const taskConversions = selected?.conversions.filter((item) => item.type === "task").reduce((total, item) => total + item.taskIds.length, 0) || 0;

  return (
    <section id="notes-view" className="view-panel notes-view" aria-labelledby="notes-heading" hidden={view !== "notes"}>
      <div className="view-toolbar notes-toolbar">
        <div><h1 id="notes-heading">随手记</h1><p>{data.notes.length} 条笔记 · 记录临时想法，再转为进度或 Task 草稿</p></div>
        <button className="button button-primary" type="button" onClick={newNote}><span aria-hidden="true">＋</span> 新建笔记</button>
      </div>
      <div className="notes-workspace">
        <aside className="notes-sidebar" aria-label="笔记列表">
          <div className="note-scope-tabs" role="tablist" aria-label="笔记范围">
            <button className={scope === "all" ? "is-active" : ""} type="button" role="tab" aria-selected={scope === "all"} onClick={() => changeScope("all")}>全部 <span>{data.notes.length}</span></button>
            <button className={scope === "favorites" ? "is-active" : ""} type="button" role="tab" aria-selected={scope === "favorites"} onClick={() => changeScope("favorites")}>收藏夹 <span>{data.notes.filter((note) => note.favorite).length}</span></button>
          </div>
          <label className="notes-search" htmlFor="note-search"><span aria-hidden="true">⌕</span>
            <input id="note-search" type="search" autoComplete="off" placeholder="搜索标题或正文" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <div id="note-list" className="note-list" role="list">
            {!notes.length ? <p className="note-list-empty">{data.notes.length ? (scope === "favorites" ? "收藏夹中没有符合当前搜索的笔记。" : "没有符合搜索的笔记。") : "保存后的笔记会显示在这里。"}</p> : notes.map((note) => (
              <div key={note.id} className="note-list-row" role="listitem">
                <button className={note.id === selectedId ? "note-list-item is-active" : "note-list-item"} type="button" onClick={() => requestSelect(note)}>
                  <strong>{note.title}</strong>
                  <span>{note.contentText ? note.contentText.replace(/\s+/g, " ").slice(0, 72) : "空白笔记"}</span>
                  <small>{noteTime(note.updatedAt)}</small>
                </button>
                <button className={`note-favorite-button${note.favorite ? " is-favorite" : ""}`} type="button" aria-label={`${note.favorite ? "取消收藏" : "收藏笔记"}：${note.title}`} title={note.favorite ? "取消收藏" : "收藏笔记"} onClick={() => toggleFavorite(note)}>{note.favorite ? "★" : "☆"}</button>
              </div>
            ))}
          </div>
        </aside>
        <section className="note-editor-panel" aria-live="polite">
          {!editing ? (
            <div className="notes-empty-state"><span className="empty-icon" aria-hidden="true">✎</span><h2>写下第一条随手记</h2><p>保存后可以把内容添加为 Task 进度记录，或转换成一个或多个 Task 草稿。</p><button className="button button-primary" type="button" onClick={newNote}>新建笔记</button></div>
          ) : (
            <div className="note-editor-shell">
              <div className="note-title-row">
                <input maxLength={160} autoComplete="off" placeholder="笔记标题" aria-label="笔记标题" value={title} onChange={(event) => { setTitle(event.target.value); markDirty(); }} />
                {selected ? <button className={`note-favorite-toggle${selected.favorite ? " is-favorite" : ""}`} type="button" aria-label={selected.favorite ? "取消收藏" : "收藏笔记"} title={selected.favorite ? "取消收藏" : "收藏笔记"} onClick={() => toggleFavorite(selected)}><span aria-hidden="true">{selected.favorite ? "★" : "☆"}</span></button> : null}
                <span className={dirty ? "is-dirty" : ""}>{dirty ? "有未保存修改" : selected ? "已保存" : "尚未保存"}</span>
              </div>
              <div className={`note-editor-comparison${aiOriginalHtml ? " is-comparing" : ""}`}>
                <RichTextEditor key={selectedId || "new"} id="note-editor" value={html} maxLength={richText.MAX_NOTE_TEXT} className="note-editor" placeholder="在这里记录工作想法、会议要点或 SharePoint 链接…" allowTables onChange={(next) => { setHtml(next.html); setText(next.text); markDirty(); }} />
                {aiOriginalHtml ? <aside className="note-ai-original-panel"><div><strong>AI 改写前原文</strong><button className="button button-quiet" type="button" onClick={restoreOriginal}>恢复原文</button></div><RichTextView className="note-ai-original-content" html={aiOriginalHtml} /></aside> : null}
              </div>
              <div className="note-meta-row"><span>{selected ? "最后更新：" + noteTime(selected.updatedAt) : "尚未保存"}</span><span>{text.length} / {richText.MAX_NOTE_TEXT}</span></div>
              {selected && (progressConversions || taskConversions) ? <div className="note-conversion-summary">已完成一次性转换：{progressConversions} 条进度记录 · {taskConversions} 个 Task</div> : null}
              <div className="note-actions">
                <button className="button button-danger-quiet" type="button" hidden={!selected} onClick={remove}>删除笔记</button><span></span>
                <button className="button button-quiet" type="button" onClick={() => void convert("progress")}>添加到进度记录</button>
                <label className="note-ai-toggle"><input type="checkbox" checked={currentAiSettings.noteAiEnabled} disabled={!ai.isEnabled(currentAiSettings)} onChange={(event) => toggleNoteAi(event.target.checked)} /><span>AI 转换</span></label>
                <button className="button button-quiet" type="button" disabled={rewriting || !(ai.isEnabled(currentAiSettings) && currentAiSettings.noteAiEnabled)} onClick={() => void rewrite()}>{rewriting ? "AI 改写中…" : "AI 改写"}</button>
                <button className="button button-quiet" type="button" onClick={() => void convert("task")}>转换为 Task 草稿</button>
                <button className="button button-primary" type="button" disabled={saving} onClick={() => void save(false)}>保存笔记</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
