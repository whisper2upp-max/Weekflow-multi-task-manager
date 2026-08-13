/* 分组弹窗：等价原 app.js openNewGroup(2975) / openEditGroup(2990) /
   saveGroupFromForm(3007) / requestDeleteCurrentGroup(3391)。
   重名拦截在 dataStore.saveGroup，返回 { ok:false, error } 时显示为字段错误。 */
import { useEffect, useRef, useState } from "react";
import { nextGroupColor } from "../../../shared/schema";
import { useDataStore } from "../../store/dataStore";
import { useUiStore } from "../../store/uiStore";
import { useModalDialog } from "../../lib/useModalDialog";
import { useFormErrors } from "./dialogForm";

export default function GroupDialog() {
  const dialog = useUiStore((s) => (s.dialog?.type === "group" ? s.dialog : null));
  const closeDialog = useUiStore((s) => s.closeDialog);
  const data = useDataStore((s) => s.data);
  const ref = useModalDialog(!!dialog, closeDialog);

  const [name, setName] = useState("");
  const [color, setColor] = useState("#665CFF");
  const [saving, setSaving] = useState(false);
  const { errors, setFieldError, clearFieldErrors, invalidClass } = useFormErrors();
  const nameRef = useRef<HTMLInputElement>(null);

  const groupId = dialog?.groupId;
  const group = groupId ? data?.groups.find((item) => item.id === groupId) : undefined;

  /* 打开时初始化表单（等价 openNewGroup / openEditGroup 的回填与聚焦） */
  useEffect(() => {
    if (!dialog) return;
    clearFieldErrors();
    setSaving(false);
    if (dialog.groupId) {
      const editing = useDataStore
        .getState()
        .data?.groups.find((item) => item.id === dialog.groupId);
      if (!editing) {
        closeDialog();
        return;
      }
      setName(editing.name);
      setColor(editing.color.toUpperCase());
    } else {
      setName("");
      setColor(nextGroupColor(useDataStore.getState().data?.groups));
    }
    const timer = setTimeout(() => {
      nameRef.current?.focus();
      if (dialog.groupId) nameRef.current?.select();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  if (!dialog || (dialog.groupId && !group)) return null;

  const onSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (saving) return;
    clearFieldErrors();
    const trimmed = name.trim();
    if (!trimmed) {
      setFieldError("group-name", "请输入分组名称。");
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    void useDataStore
      .getState()
      .saveGroup({ id: dialog.groupId, name: trimmed, color })
      .then((result) => {
        setSaving(false);
        if (!result.ok) {
          if (result.error) setFieldError("group-name", result.error);
          return;
        }
        closeDialog();
      });
  };

  /* 等价 requestDeleteCurrentGroup：无 Task 一次 confirm 直接删；有 Task 转 deleteGroup 弹窗 */
  const onDelete = (): void => {
    if (!dialog.groupId || !group) return;
    const current = useDataStore.getState().data;
    if (!current) return;
    const taskCount = current.tasks.filter((task) => task.groupId === dialog.groupId).length;
    const flowCount = current.flows.filter((flow) => flow.groupId === dialog.groupId).length;
    if (!taskCount) {
      const message =
        "确认删除分组「" +
        group.name +
        "」" +
        (flowCount ? "及其中 " + flowCount + " 个空 Flow" : "") +
        "？此操作不可恢复。";
      if (!window.confirm(message)) return;
      void useDataStore
        .getState()
        .deleteGroup(dialog.groupId)
        .then((ok) => {
          if (ok) closeDialog();
        });
      return;
    }
    const targetGroupId = dialog.groupId;
    closeDialog();
    useUiStore.getState().openDialog({ type: "deleteGroup", groupId: targetGroupId });
  };

  return (
    <dialog ref={ref} id="group-dialog" className="modal modal-small">
      <form
        id="group-form"
        method="dialog"
        noValidate
        onSubmit={onSubmit}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">Group</p>
            <h2 id="group-dialog-title">{dialog.groupId ? "编辑分组" : "新建分组"}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            data-action="close-group-dialog"
            aria-label="关闭"
            onClick={closeDialog}
          >
            ×
          </button>
        </div>
        <input id="group-id" type="hidden" value={dialog.groupId ?? ""} readOnly />
        <label className="form-field">
          <span>
            分组名称 <em>*</em>
          </span>
          <input
            id="group-name"
            name="name"
            maxLength={80}
            required
            autoComplete="off"
            ref={nameRef}
            value={name}
            className={invalidClass("group-name")}
            onChange={(event) => setName(event.target.value)}
          />
          <small className="field-error" data-error-for="group-name">
            {errors["group-name"] ?? ""}
          </small>
        </label>
        <label className="form-field">
          <span>分组颜色</span>
          <span className="color-field">
            <input
              id="group-color"
              name="color"
              type="color"
              value={color.toLowerCase()}
              onChange={(event) => setColor(event.target.value.toUpperCase())}
            />
            <output id="group-color-value">{color}</output>
          </span>
        </label>
        <div className="modal-actions split-actions">
          <button
            id="group-delete-button"
            className="button button-danger-quiet"
            type="button"
            data-action="delete-group"
            hidden={!dialog.groupId}
            onClick={onDelete}
          >
            删除分组
          </button>
          <span></span>
          <button
            className="button button-quiet"
            type="button"
            data-action="close-group-dialog"
            onClick={closeDialog}
          >
            取消
          </button>
          <button
            id="group-save-button"
            className="button button-primary"
            type="submit"
            disabled={saving}
          >
            保存分组
          </button>
        </div>
      </form>
    </dialog>
  );
}
