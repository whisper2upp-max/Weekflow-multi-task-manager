/* Flow 弹窗：等价原 app.js openNewFlow(3077) / openEditFlow(3108) /
   renderFlowTaskOrder(3139) / moveFlowOrderItem(3233) / refreshFlowOrderLabels(3243) /
   saveFlowFromForm(3257) / requestDeleteCurrentFlow(3357)。
   returnToTask（从 Task 弹窗唤起）时不丢 Task 草稿：见 ./taskDraftStore。 */
import { useEffect, useRef, useState } from "react";
import type { Flow } from "../../../shared/types";
import { COLORS } from "../../../shared/schema";
import { sortFlowTasks } from "../../../shared/stats";
import { useDataStore } from "../../store/dataStore";
import { useUiStore } from "../../store/uiStore";
import { useModalDialog } from "../../lib/useModalDialog";
import { useFormErrors } from "./dialogForm";
import { taskDraftStore } from "./taskDraftStore";

const STATUS_LABELS: Record<string, string> = { pending: "未完成", completed: "已完成" };

function sameOrder(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export default function FlowDialog() {
  const dialog = useUiStore((s) => (s.dialog?.type === "flow" ? s.dialog : null));
  const closeDialog = useUiStore((s) => s.closeDialog);
  const data = useDataStore((s) => s.data);
  const ref = useModalDialog(!!dialog, () => {
    /* Esc 关闭：returnToTask 场景回 Task 弹窗（等价原版 Task 弹窗保持在底层） */
    onCancelRef.current();
  });

  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [colorCustomized, setColorCustomized] = useState(false);
  const [orderTaskIds, setOrderTaskIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { errors, setFieldError, clearFieldErrors, invalidClass } = useFormErrors();
  const nameRef = useRef<HTMLInputElement>(null);

  const groups = data?.groups ?? [];
  const flows = data?.flows ?? [];
  const tasks = data?.tasks ?? [];
  const flow = dialog?.flowId ? flows.find((item) => item.id === dialog.flowId) : undefined;
  const sortedGroups = groups
    .slice()
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  /* 取消/Esc/删除后的关闭：returnToTask 时重开 Task 弹窗（草稿在 taskDraftStore） */
  const closeOrReturnToTask = (): void => {
    const draft = taskDraftStore.load();
    if (dialog?.returnToTask && draft) {
      useUiStore
        .getState()
        .openDialog({ type: "task", taskId: draft.taskId ?? undefined });
    } else {
      closeDialog();
    }
  };
  const onCancelRef = useRef(closeOrReturnToTask);
  onCancelRef.current = closeOrReturnToTask;

  /* 打开时初始化（等价 openNewFlow / openEditFlow 回填与聚焦） */
  useEffect(() => {
    if (!dialog) return;
    clearFieldErrors();
    setSaving(false);
    setDraggingId(null);
    const current = useDataStore.getState().data;
    if (!current) {
      closeDialog();
      return;
    }
    if (dialog.flowId) {
      const editing = current.flows.find((item) => item.id === dialog.flowId);
      if (!editing) {
        closeDialog();
        return;
      }
      setName(editing.name);
      setGroupId(editing.groupId);
      const owner = current.groups.find((item) => item.id === editing.groupId);
      setColorCustomized(
        Boolean(!owner || editing.color.toUpperCase() !== owner.color.toUpperCase())
      );
      setColor(editing.color.toUpperCase());
      setOrderTaskIds(
        sortFlowTasks(
          current.tasks.filter((task) => task.flowId === editing.id),
          new Date()
        ).map((task) => task.id)
      );
    } else {
      if (!current.groups.length) {
        useUiStore.getState().pushToast("请先新建一个分组，再创建 Flow。", "warning");
        useUiStore.getState().openDialog({ type: "group" });
        return;
      }
      setName("");
      setColorCustomized(false);
      setOrderTaskIds([]);
      const filters = useUiStore.getState().filters;
      const activeFlow: Flow | undefined =
        filters.flowId !== "all" && filters.flowId !== "none"
          ? current.flows.find((item) => item.id === filters.flowId)
          : undefined;
      const selectedGroupId =
        dialog.groupId ||
        (activeFlow
          ? activeFlow.groupId
          : filters.groupIds.length === 1
            ? filters.groupIds[0]
            : current.groups[0].id);
      setGroupId(selectedGroupId);
      const owner = current.groups.find((item) => item.id === selectedGroupId);
      setColor((owner ? owner.color : COLORS[0]).toUpperCase());
    }
    const timer = setTimeout(() => {
      nameRef.current?.focus();
      if (dialog.flowId) nameRef.current?.select();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  if (!dialog || (dialog.flowId && !flow)) return null;

  /* 等价 syncFlowColorWithSelectedGroup：未手动改色时跟随分组色 */
  const onGroupChange = (nextGroupId: string): void => {
    setGroupId(nextGroupId);
    if (colorCustomized) return;
    const owner = groups.find((item) => item.id === nextGroupId);
    if (owner) setColor(owner.color.toUpperCase());
  };

  const onColorInput = (value: string): void => {
    setColorCustomized(true);
    setColor(value.toUpperCase());
  };

  const moveItem = (taskId: string, direction: -1 | 1): void => {
    setOrderTaskIds((prev) => {
      const from = prev.indexOf(taskId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = prev.slice();
      next[from] = prev[to];
      next[to] = prev[from];
      return next;
    });
  };

  /* 等价 dragover 里按上下半区 insertBefore 的重排 */
  const onItemDragOver = (event: React.DragEvent<HTMLDivElement>, targetId: string): void => {
    event.preventDefault();
    if (!draggingId || draggingId === targetId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const placeAfter = event.clientY > rect.top + rect.height / 2;
    setOrderTaskIds((prev) => {
      if (!prev.includes(draggingId)) return prev;
      const next = prev.filter((id) => id !== draggingId);
      let to = next.indexOf(targetId);
      if (to < 0) return prev;
      if (placeAfter) to += 1;
      next.splice(to, 0, draggingId);
      return sameOrder(prev, next) ? prev : next;
    });
  };

  const onSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (saving) return;
    clearFieldErrors();
    const trimmed = name.trim();
    if (!trimmed) {
      setFieldError("flow-name", "请输入 Flow 名称。");
      nameRef.current?.focus();
      return;
    }
    if (!groups.some((item) => item.id === groupId)) {
      setFieldError("flow-group", "请选择有效分组。");
      return;
    }
    setSaving(true);
    void useDataStore
      .getState()
      .saveFlow({
        id: dialog.flowId,
        name: trimmed,
        groupId,
        color,
        orderedTaskIds: orderTaskIds
      })
      .then((result) => {
        setSaving(false);
        if (!result.ok) {
          /* 重名显示为字段错误；"Flow 不存在" 由 store toast（与原版一致） */
          if (result.error === "该分组中已有同名 Flow。") {
            setFieldError("flow-name", result.error);
          }
          return;
        }
        if (dialog.returnToTask) {
          /* 让 Task 弹窗选中新保存的 Flow（store 不返回 id，按分组+名称反查） */
          const savedFlow = useDataStore
            .getState()
            .data?.flows.find(
              (item) =>
                item.groupId === groupId &&
                item.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase()
            );
          if (savedFlow) taskDraftStore.setPreselectFlow(savedFlow.id);
        }
        closeOrReturnToTask();
      });
  };

  const onDelete = (): void => {
    if (!flow) return;
    const flowTaskCount = tasks.filter((task) => task.flowId === flow.id).length;
    const message = flowTaskCount
      ? "确认删除 Flow「" +
        flow.name +
        "」？其中 " +
        flowTaskCount +
        " 条 Task 会保留在原分组并取消 Flow 归属。"
      : "确认删除 Flow「" + flow.name + "」？";
    if (!window.confirm(message)) return;
    void useDataStore
      .getState()
      .deleteFlow(flow.id)
      .then((ok) => {
        if (ok) closeOrReturnToTask();
      });
  };

  const orderTasks = orderTaskIds
    .map((taskId) => tasks.find((task) => task.id === taskId))
    .filter((task): task is NonNullable<typeof task> => Boolean(task));

  return (
    <dialog ref={ref} id="flow-dialog" className="modal">
      <form id="flow-form" method="dialog" noValidate onSubmit={onSubmit}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">Workflow</p>
            <h2 id="flow-dialog-title">{dialog.flowId ? "编辑 Flow" : "新建 Flow"}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            data-action="close-flow-dialog"
            aria-label="关闭"
            onClick={closeOrReturnToTask}
          >
            ×
          </button>
        </div>
        <input id="flow-id" type="hidden" value={dialog.flowId ?? ""} readOnly />
        <div className="form-grid flow-form-grid">
          <label className="form-field form-field-wide">
            <span>
              Flow 名称 <em>*</em>
            </span>
            <input
              id="flow-name"
              maxLength={80}
              required
              autoComplete="off"
              ref={nameRef}
              value={name}
              className={invalidClass("flow-name")}
              onChange={(event) => setName(event.target.value)}
            />
            <small className="field-error" data-error-for="flow-name">
              {errors["flow-name"] ?? ""}
            </small>
          </label>
          <label className="form-field">
            <span>
              所属分组 <em>*</em>
            </span>
            <select
              id="flow-group"
              required
              value={groupId}
              className={invalidClass("flow-group")}
              onChange={(event) => onGroupChange(event.target.value)}
            >
              {sortedGroups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <small className="field-error" data-error-for="flow-group">
              {errors["flow-group"] ?? ""}
            </small>
          </label>
          <label className="form-field">
            <span>Flow 颜色</span>
            <span className="color-field">
              <input
                id="flow-color"
                type="color"
                value={color.toLowerCase()}
                onChange={(event) => onColorInput(event.target.value)}
              />
              <output id="flow-color-value">{color}</output>
            </span>
            <small>默认继承所属分组颜色，主动修改后保留自定义颜色。</small>
          </label>
        </div>

        <section id="flow-order-section" className="flow-order-section" aria-labelledby="flow-order-title">
          <div className="flow-order-head">
            <div>
              <h3 id="flow-order-title">工作步骤排序</h3>
              <p>拖动左侧把手调整顺序，也可使用上下移动按钮。</p>
            </div>
            <span id="flow-task-count">{orderTasks.length + " 个步骤"}</span>
          </div>
          <div id="flow-task-order-list" className="flow-task-order-list">
            {!orderTasks.length && (
              <p className="flow-order-empty">
                {dialog.flowId
                  ? "暂无步骤。可在新建或编辑 Task 时把它加入此 Flow。"
                  : "Flow 创建后，可在 Task 中选择加入并在这里拖动排序。"}
              </p>
            )}
            {orderTasks.map((task, index) => (
              <div
                key={task.id}
                className={
                  "flow-order-item" + (draggingId === task.id ? " is-dragging" : "")
                }
                data-task-id={task.id}
                draggable
                onDragStart={(event) => {
                  setDraggingId(task.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", task.id);
                }}
                onDragOver={(event) => onItemDragOver(event, task.id)}
                onDrop={(event) => event.preventDefault()}
                onDragEnd={() => setDraggingId(null)}
              >
                <span className="flow-drag-handle" title="拖动调整顺序" aria-hidden="true">
                  ⠿
                </span>
                <span className="flow-order-number" data-flow-step-number="true">
                  {"STEP " + String(index + 1).padStart(2, "0")}
                </span>
                <span className="flow-order-copy">
                  <strong>{task.name}</strong>
                  <small>{"DDL " + task.ddl + " · " + (STATUS_LABELS[task.status] ?? task.status)}</small>
                </span>
                <span className="flow-order-controls">
                  <button
                    type="button"
                    title="上移"
                    aria-label={"上移 " + task.name}
                    disabled={index === 0}
                    onClick={() => moveItem(task.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    title="下移"
                    aria-label={"下移 " + task.name}
                    disabled={index === orderTasks.length - 1}
                    onClick={() => moveItem(task.id, 1)}
                  >
                    ↓
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="modal-actions split-actions">
          <button
            id="flow-delete-button"
            className="button button-danger-quiet"
            type="button"
            data-action="delete-flow"
            hidden={!dialog.flowId}
            onClick={onDelete}
          >
            删除 Flow
          </button>
          <span></span>
          <button
            className="button button-quiet"
            type="button"
            data-action="close-flow-dialog"
            onClick={closeOrReturnToTask}
          >
            取消
          </button>
          <button
            id="flow-save-button"
            className="button button-primary"
            type="submit"
            disabled={saving}
          >
            保存 Flow
          </button>
        </div>
      </form>
    </dialog>
  );
}
