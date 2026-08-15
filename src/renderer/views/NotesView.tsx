import { useEffect, useMemo, useState } from "react";
import * as richText from "../../shared/rich-text";
import type { QuickNote } from "../../shared/types";
import RichTextEditor from "../components/RichTextEditor";
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

export default function NotesView() {
  const view = useUiStore((state) => state.view);
  const data = useDataStore((state) => state.data);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = selectedId ? data?.notes.find((note) => note.id === selectedId) || null : null;
  const notes = useMemo(() => (data?.notes || []).slice()
    .filter((note) => !search.trim() || `${note.title}\n${note.contentText}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()), [data?.notes, search]);

  const markDirty = (): void => {
    setDirty(true);
    useUiStore.getState().setNoteDirty(true);
  };
  const markClean = (): void => {
    setDirty(false);
    useUiStore.getState().setNoteDirty(false);
  };

  const load = (note: QuickNote | null, nextIsNew = false): void => {
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
    const first = data.notes.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] || null;
    load(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.notes, selectedId]);

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
          <label className="notes-search" htmlFor="note-search"><span aria-hidden="true">⌕</span>
            <input id="note-search" type="search" autoComplete="off" placeholder="搜索标题或正文" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <div id="note-list" className="note-list" role="list">
            {!notes.length ? <p className="note-list-empty">{data.notes.length ? "没有符合搜索的笔记。" : "保存后的笔记会显示在这里。"}</p> : notes.map((note) => (
              <button key={note.id} className={note.id === selectedId ? "note-list-item is-active" : "note-list-item"} type="button" role="listitem" onClick={() => requestSelect(note)}>
                <strong>{note.title}</strong>
                <span>{note.contentText ? note.contentText.replace(/\s+/g, " ").slice(0, 72) : "空白笔记"}</span>
                <small>{noteTime(note.updatedAt)}</small>
              </button>
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
                <span className={dirty ? "is-dirty" : ""}>{dirty ? "有未保存修改" : selected ? "已保存" : "尚未保存"}</span>
              </div>
              <RichTextEditor key={selectedId || "new"} id="note-editor" value={html} maxLength={richText.MAX_NOTE_TEXT} className="note-editor" placeholder="在这里记录工作想法、会议要点或 SharePoint 链接…" onChange={(next) => { setHtml(next.html); setText(next.text); markDirty(); }} />
              <div className="note-meta-row"><span>{selected ? "最后更新：" + noteTime(selected.updatedAt) : "尚未保存"}</span><span>{text.length} / {richText.MAX_NOTE_TEXT}</span></div>
              {selected && (progressConversions || taskConversions) ? <div className="note-conversion-summary">已完成一次性转换：{progressConversions} 条进度记录 · {taskConversions} 个 Task</div> : null}
              <div className="note-actions">
                <button className="button button-danger-quiet" type="button" hidden={!selected} onClick={remove}>删除笔记</button><span></span>
                <button className="button button-quiet" type="button" onClick={() => void convert("progress")}>添加到进度记录</button>
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
