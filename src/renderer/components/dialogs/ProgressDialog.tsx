import { useEffect, useMemo, useState } from "react";
import * as richText from "../../../shared/rich-text";
import { useDataStore } from "../../store/dataStore";
import { useUiStore } from "../../store/uiStore";
import { useModalDialog } from "../../lib/useModalDialog";
import { isEnglish, tConfirm } from "../../lib/i18n";
import RichTextEditor from "../RichTextEditor";

function timeLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return isEnglish() ? "Unknown time" : "未知时间";
  return parsed.toLocaleString(isEnglish() ? "en-US" : "zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  });
}

export default function ProgressDialog() {
  const dialog = useUiStore((state) => state.dialog?.type === "progress" ? state.dialog : null);
  const closeDialog = useUiStore((state) => state.closeDialog);
  const data = useDataStore((state) => state.data);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftHtml, setDraftHtml] = useState("");
  const [draftText, setDraftText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const requestClose = (): void => {
    if (dirty && !tConfirm("当前进度记录尚未保存，继续后修改会丢失。仍要继续吗？")) return;
    closeDialog();
  };
  const ref = useModalDialog(Boolean(dialog), requestClose);
  const task = dialog ? data?.tasks.find((item) => item.id === dialog.taskId) : undefined;
  const entries = useMemo(() => richText.sortProgressEntries(task?.progressEntries), [task?.progressEntries]);
  const selected = selectedId ? entries.find((entry) => entry.id === selectedId) || null : null;

  const loadEntry = (id: string | null): void => {
    const entry = id ? entries.find((item) => item.id === id) : null;
    setSelectedId(entry?.id || null);
    setDraftHtml(entry?.contentHtml || "");
    setDraftText(entry?.contentText || "");
    setDirty(false);
  };

  useEffect(() => {
    if (!dialog) return;
    const current = useDataStore.getState().data?.tasks.find((item) => item.id === dialog.taskId);
    if (!current) {
      closeDialog();
      return;
    }
    const latest = richText.latestProgressEntry(current.progressEntries);
    setSelectedId(latest?.id || null);
    setDraftHtml(latest?.contentHtml || "");
    setDraftText(latest?.contentText || "");
    setDirty(false);
    setSaving(false);
  }, [dialog, closeDialog]);

  if (!dialog || !task) return null;

  const selectEntry = (id: string | null): void => {
    if (id === selectedId) return;
    if (dirty && !tConfirm("当前进度记录尚未保存，继续后修改会丢失。仍要继续吗？")) return;
    loadEntry(id);
  };

  const save = (event: React.FormEvent): void => {
    event.preventDefault();
    if (saving || !draftText.trim()) {
      if (!draftText.trim()) useUiStore.getState().pushToast("请输入进度内容。", "error");
      return;
    }
    setSaving(true);
    void useDataStore.getState().saveProgressEntry(task.id, {
      id: selected?.id,
      contentHtml: draftHtml,
      contentText: draftText,
      sourceType: selected?.sourceType || "manual",
      sourceNoteId: selected?.sourceNoteId || null,
      createdAt: selected?.createdAt
    }).then((ok) => {
      setSaving(false);
      if (ok) closeDialog();
    });
  };

  const remove = (): void => {
    if (!selected) return;
    if (!tConfirm("确认删除当前这条进度记录？")) return;
    if (!tConfirm("请再次确认。删除后无法恢复。")) return;
    void useDataStore.getState().deleteProgressEntry(task.id, selected.id).then((ok) => {
      if (!ok) return;
      const current = useDataStore.getState().data?.tasks.find((item) => item.id === task.id);
      const latest = current ? richText.latestProgressEntry(current.progressEntries) : null;
      setSelectedId(latest?.id || null);
      setDraftHtml(latest?.contentHtml || "");
      setDraftText(latest?.contentText || "");
      setDirty(false);
    });
  };

  return (
    <dialog ref={ref} id="progress-dialog" className="modal modal-large progress-dialog">
      <form id="progress-form" method="dialog" noValidate onSubmit={save}>
        <div className="modal-head">
          <div><p className="eyebrow">Progress note</p><h2>编辑进度记录</h2></div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={requestClose}>×</button>
        </div>
        <p id="progress-dialog-task" className="modal-context">
          <span data-user-content="true">{task.name}</span>
          <span>{isEnglish()
            ? " · Each update is stored as an independent timestamped record"
            : " · 每次更新都保存为一条独立的时间戳记录"}</span>
        </p>
        <div className="progress-history-layout">
          <aside className="progress-history-sidebar">
            <button className="button button-quiet button-small" type="button" onClick={() => selectEntry(null)}>＋ 新建记录</button>
            <div id="progress-entry-list" className="progress-entry-list" role="list">
              {entries.length ? entries.map((entry) => (
                <button
                  key={entry.id}
                  className={entry.id === selectedId ? "progress-entry-item is-active" : "progress-entry-item"}
                  type="button"
                  role="listitem"
                  onClick={() => selectEntry(entry.id)}
                >
                  <strong>{timeLabel(entry.updatedAt)}</strong>
                  <span>{entry.contentText.replace(/\s+/g, " ").slice(0, 72)}</span>
                  <small>{entry.sourceType === "quick-note" ? (isEnglish() ? "Quick Note" : "随手记") : (isEnglish() ? "Manual record" : "手动记录")}</small>
                </button>
              )) : <p className="progress-entry-empty">尚无记录</p>}
            </div>
          </aside>
          <section className="progress-entry-editor">
            <RichTextEditor
              key={selectedId || "new"}
              id="progress-note"
              value={draftHtml}
              maxLength={richText.MAX_PROGRESS_TEXT}
              className="progress-note-field"
              placeholder="例如：已完成需求确认和接口联调，当前等待业务方验收。"
              autoFocus
              onChange={({ html, text }) => {
                setDraftHtml(html);
                setDraftText(text);
                setDirty(true);
              }}
            />
            <div className="progress-meta-row">
              <span id="progress-dialog-updated">
                {selected ? "最后编辑：" + timeLabel(selected.updatedAt) : "新记录将在保存时写入时间"}
              </span>
              <span id="progress-character-count">{draftText.length + " / " + richText.MAX_PROGRESS_TEXT}</span>
            </div>
          </section>
        </div>
        <div className="modal-actions split-actions">
          <button className="button button-danger-quiet" type="button" hidden={!selected} onClick={remove}>删除本条</button>
          <span></span>
          <button className="button button-quiet" type="button" onClick={requestClose}>取消</button>
          <button className="button button-primary" type="submit" disabled={saving}>保存进度</button>
        </div>
      </form>
    </dialog>
  );
}
