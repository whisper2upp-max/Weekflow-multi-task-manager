/* 删除分组弹窗（分组内仍有 Task 时）：等价原 app.js requestDeleteCurrentGroup 的
   弹窗部分(3432-3454) / moveTasksAndDeleteGroup(3462) / deleteGroupWithTasks(3550)。 */
import { useEffect, useState } from "react";
import { useDataStore } from "../../store/dataStore";
import { useUiStore } from "../../store/uiStore";
import { useModalDialog } from "../../lib/useModalDialog";
import { tConfirm } from "../../lib/i18n";

export default function DeleteGroupDialog() {
  const dialog = useUiStore((s) => (s.dialog?.type === "deleteGroup" ? s.dialog : null));
  const closeDialog = useUiStore((s) => s.closeDialog);
  const data = useDataStore((s) => s.data);
  const ref = useModalDialog(!!dialog, closeDialog);
  const [targetId, setTargetId] = useState("");

  const groupId = dialog?.groupId;
  const group = groupId ? data?.groups.find((item) => item.id === groupId) : undefined;

  /* 打开时默认选中第一个其他分组（原 DOM select 自动落首项） */
  useEffect(() => {
    if (!dialog) return;
    const current = useDataStore.getState().data;
    const currentGroup = current?.groups.find((item) => item.id === dialog.groupId);
    if (!current || !currentGroup) {
      closeDialog();
      return;
    }
    const firstTarget = current.groups
      .slice()
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .find((item) => item.id !== dialog.groupId);
    setTargetId(firstTarget ? firstTarget.id : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  if (!dialog || !group) return null;

  const tasks = data ? data.tasks.filter((task) => task.groupId === dialog.groupId) : [];
  const flows = data ? data.flows.filter((flow) => flow.groupId === dialog.groupId) : [];
  const otherGroups = (data?.groups ?? [])
    .slice()
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .filter((item) => item.id !== dialog.groupId);

  const onMoveAndDelete = (): void => {
    const target = data?.groups.find((item) => item.id === targetId);
    if (!group || !target) {
      useUiStore.getState().pushToast("无法移动 Task 与 Flow：目标分组不存在。", "error");
      return;
    }
    if (
      !tConfirm(
        "确认将「" +
          group.name +
          "」内的 Task 与 Flow 移动到「" +
          target.name +
          "」并删除原分组？"
      )
    ) {
      return;
    }
    void useDataStore
      .getState()
      .moveTasksAndDeleteGroup(group.id, target.id)
      .then((ok) => {
        if (ok) closeDialog();
      });
  };

  const onDeleteWithTasks = (): void => {
    if (
      !tConfirm(
        "最终确认：删除分组「" +
          group.name +
          "」、其中 " +
          flows.length +
          " 个 Flow 和 " +
          tasks.length +
          " 条 Task？此操作不可恢复。"
      )
    ) {
      return;
    }
    void useDataStore
      .getState()
      .deleteGroupWithTasks(group.id)
      .then((ok) => {
        if (ok) closeDialog();
      });
  };

  return (
    <dialog ref={ref} id="delete-group-dialog" className="modal modal-small">
      <form method="dialog" onSubmit={(event) => event.preventDefault()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">Delete group</p>
            <h2>分组内仍有 Task</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            data-action="cancel-group-delete"
            aria-label="关闭"
            onClick={closeDialog}
          >
            ×
          </button>
        </div>
        <p id="delete-group-message" className="modal-context">
          {"「" +
            group.name +
            "」中有 " +
            tasks.length +
            " 条 Task 和 " +
            flows.length +
            " 个 Flow。移动时会保留 Flow 与步骤顺序。"}
        </p>
        <label className="form-field">
          <span>移动到其他分组</span>
          <select
            id="delete-group-target"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
          >
            {otherGroups.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="choice-actions">
          <button
            className="button button-quiet"
            type="button"
            data-action="cancel-group-delete"
            onClick={closeDialog}
          >
            取消
          </button>
          <button
            className="button button-primary"
            type="button"
            data-action="move-and-delete-group"
            disabled={!otherGroups.length}
            onClick={onMoveAndDelete}
          >
            移动 Task 与 Flow 后删除
          </button>
          <button
            className="button button-danger"
            type="button"
            data-action="delete-group-with-tasks"
            onClick={onDeleteWithTasks}
          >
            同时删除 Task
          </button>
        </div>
      </form>
    </dialog>
  );
}
