/* 进度记录弹窗：等价原 app.js openProgressManager(4206) /
   formatProgressTimestamp(4231) / updateProgressCharacterCount(4243) / saveProgressNote(4248)。
   文案含原版 isEnglish 英文分支。 */
import { useEffect, useRef, useState } from "react";
import { useDataStore } from "../../store/dataStore";
import { useUiStore } from "../../store/uiStore";
import { useModalDialog } from "../../lib/useModalDialog";
import { isEnglish } from "../../lib/i18n";

/** 等价原 formatProgressTimestamp：非法时间显示「未知时间」（英文 Unknown time） */
function formatProgressTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return isEnglish() ? "Unknown time" : "未知时间";
  return parsed.toLocaleString(isEnglish() ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function ProgressDialog() {
  const dialog = useUiStore((s) => (s.dialog?.type === "progress" ? s.dialog : null));
  const closeDialog = useUiStore((s) => s.closeDialog);
  const data = useDataStore((s) => s.data);
  const ref = useModalDialog(!!dialog, closeDialog);

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const task = dialog ? data?.tasks.find((item) => item.id === dialog.taskId) : undefined;

  /* 打开时回填并聚焦到文本末尾（等价 openProgressManager） */
  useEffect(() => {
    if (!dialog) return;
    setSaving(false);
    const editing = useDataStore
      .getState()
      .data?.tasks.find((item) => item.id === dialog.taskId);
    if (!editing) {
      closeDialog();
      return;
    }
    setNote(editing.progressNote || "");
    const timer = setTimeout(() => {
      const textarea = noteRef.current;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  if (!dialog || !task) return null;

  const updatedText = task.progressUpdatedAt
    ? (isEnglish() ? "Last updated: " : "最后更新：") +
      formatProgressTimestamp(task.progressUpdatedAt)
    : isEnglish()
      ? "No progress recorded"
      : "尚未记录进度";

  const onSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    void useDataStore
      .getState()
      .saveProgressNote(dialog.taskId, note)
      .then((ok) => {
        setSaving(false);
        if (ok) closeDialog();
      });
  };

  return (
    <dialog ref={ref} id="progress-dialog" className="modal">
      <form id="progress-form" method="dialog" noValidate onSubmit={onSubmit}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">Progress note</p>
            <h2>编辑进度记录</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            data-action="close-progress-dialog"
            aria-label="关闭"
            onClick={closeDialog}
          >
            ×
          </button>
        </div>
        <p id="progress-dialog-task" className="modal-context">
          {task.name +
            (isEnglish()
              ? " · Record current progress, blockers, or next steps"
              : " · 自由记录当前进展、阻塞事项或下一步计划")}
        </p>
        <label className="form-field progress-note-field">
          <span>进度内容</span>
          <textarea
            id="progress-note"
            rows={10}
            maxLength={4000}
            placeholder={
              "例如：已完成需求确认和接口联调，当前等待业务方验收。\n\n可按日期分段记录，也可以作为持续更新的项目备注。"
            }
            aria-describedby="progress-dialog-updated progress-character-count"
            ref={noteRef}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          ></textarea>
        </label>
        <div className="progress-meta-row">
          <span id="progress-dialog-updated">{updatedText}</span>
          <span id="progress-character-count">{note.length + " / 4000"}</span>
        </div>
        <div className="modal-actions">
          <button
            className="button button-quiet"
            type="button"
            data-action="close-progress-dialog"
            onClick={closeDialog}
          >
            取消
          </button>
          <button
            id="progress-save-button"
            className="button button-primary"
            type="submit"
            disabled={saving}
          >
            保存进度
          </button>
        </div>
      </form>
    </dialog>
  );
}
