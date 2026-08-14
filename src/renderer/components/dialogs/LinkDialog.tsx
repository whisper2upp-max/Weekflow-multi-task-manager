/* 相关资料管理弹窗：等价原 app.js openLinkManager(4267) / renderManagedLinks(4285) /
   addManagedLink(4298) / saveManagedLinks(4312)。
   行内「打开」只做预览不落库：URL 与资料库中一致时记录打开次数，否则直接打开。 */
import { useEffect, useState } from "react";
import { forTask } from "../../../shared/materials";
import { isValidUrl } from "../../../shared/utils";
import { useDataStore } from "../../store/dataStore";
import type { MaterialDraft } from "../../store/dataStore";
import { useUiStore } from "../../store/uiStore";
import { useModalDialog } from "../../lib/useModalDialog";
import { isEnglish } from "../../lib/i18n";
import MaterialRowsEditor, {
  makeEmptyMaterialDraft,
  validateMaterialRows
} from "./MaterialRowsEditor";
import type { MaterialRowInvalid } from "./MaterialRowsEditor";

export default function LinkDialog() {
  const dialog = useUiStore((s) => (s.dialog?.type === "link" ? s.dialog : null));
  const closeDialog = useUiStore((s) => s.closeDialog);
  const data = useDataStore((s) => s.data);
  const ref = useModalDialog(!!dialog, closeDialog);

  const [rows, setRows] = useState<MaterialDraft[]>([]);
  const [invalid, setInvalid] = useState<Record<string, MaterialRowInvalid>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const task = dialog ? data?.tasks.find((item) => item.id === dialog.taskId) : undefined;

  /* 打开时把该 Task 关联资料克隆为草稿（等价 openLinkManager） */
  useEffect(() => {
    if (!dialog) return;
    setInvalid({});
    setError("");
    setSaving(false);
    const current = useDataStore.getState().data;
    const editing = current?.tasks.find((item) => item.id === dialog.taskId);
    if (!current || !editing) {
      closeDialog();
      return;
    }
    setRows(
      forTask(current.materials, editing.id).map((material) => ({
        id: material.id,
        title: material.title,
        url: material.url,
        type: material.type,
        createdAt: material.createdAt
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  if (!dialog || !task) return null;

  const addRow = (): void => {
    setRows((prev) => prev.concat(makeEmptyMaterialDraft()));
    setTimeout(() => {
      const inputs = document
        .getElementById("link-manager-rows")
        ?.querySelectorAll<HTMLElement>('[data-material-field="title"]');
      if (inputs && inputs.length) inputs[inputs.length - 1].focus();
    }, 0);
  };

  /* 等价 renderMaterialRows 的 showOpen 分支（app.js:3905-3918） */
  const openRow = (row: MaterialDraft): void => {
    if (!isValidUrl(row.url)) {
      setInvalid((prev) => ({ ...prev, [row.id]: { ...prev[row.id], url: true } }));
      useUiStore.getState().pushToast("请先输入合法的 HTTP/HTTPS 链接。", "error");
      return;
    }
    const saved = useDataStore
      .getState()
      .data?.materials.find((material) => material.id === row.id);
    if (saved && saved.url === row.url.trim()) {
      void useDataStore
        .getState()
        .recordMaterialOpen(saved.id)
        .then(() => {
          void window.weekflow.openExternal(saved.url);
        });
    } else {
      void window.weekflow.openExternal(row.url.trim());
    }
  };

  const onSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (saving) return;
    setError("");
    setInvalid({});
    const result = validateMaterialRows(rows);
    if (!result.valid) {
      setInvalid(result.invalid);
      setError("每条资料都需要链接名称、类型和合法的 HTTP/HTTPS 地址。");
      return;
    }
    setSaving(true);
    void useDataStore
      .getState()
      .saveTaskMaterials(dialog.taskId, result.drafts)
      .then((ok) => {
        setSaving(false);
        if (ok) closeDialog();
      });
  };

  return (
    <dialog ref={ref} id="link-dialog" className="modal">
      <form id="link-form" method="dialog" noValidate onSubmit={onSubmit}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">Related documents</p>
            <h2 id="link-dialog-title">管理相关资料</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            data-action="close-link-dialog"
            aria-label="关闭"
            onClick={closeDialog}
          >
            ×
          </button>
        </div>
        <p id="link-dialog-task" className="modal-context">
          {task.name +
            (isEnglish()
              ? " · Documents are grouped by type; changes sync to the Document Library"
              : " · 资料按类型分组；修改后会同步到资料库")}
        </p>
        <MaterialRowsEditor
          id="link-manager-rows"
          className="link-rows link-manager-rows"
          rows={rows}
          invalid={invalid}
          showOpen
          onChange={setRows}
          onOpenRow={openRow}
        />
        <button
          className="button button-quiet button-small"
          type="button"
          data-action="add-managed-link"
          onClick={addRow}
        >
          ＋ 添加资料
        </button>
        <small id="link-manager-error" className="field-error">
          {error}
        </small>
        <div className="modal-actions">
          <button
            className="button button-quiet"
            type="button"
            data-action="close-link-dialog"
            onClick={closeDialog}
          >
            取消
          </button>
          <button
            id="link-manager-save"
            className="button button-primary"
            type="submit"
            disabled={saving}
          >
            保存资料
          </button>
        </div>
      </form>
    </dialog>
  );
}
