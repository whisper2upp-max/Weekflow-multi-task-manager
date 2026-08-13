/* Task 弹窗：等价原 app.js openNewTask(3741) / openEditTask(3779) /
   populateTaskFlowSelect(3674) / handleTaskFlowSelection(3698) /
   syncTaskRecurrenceFields(3704) / syncCompletedDate(3809) /
   saveTaskFromForm(3997) / requestDeleteCurrentTask(4189)。
   「＋ 创建新的 Flow…」跳转期间草稿保存在 ./taskDraftStore，返回后原样恢复。 */
import { useEffect, useRef, useState } from "react";
import type { RecurrenceCadence, TaskStatus, Urgency } from "../../../shared/types";
import * as automation from "../../../shared/automation";
import * as dates from "../../../shared/date-utils";
import { forTask } from "../../../shared/materials";
import { useDataStore } from "../../store/dataStore";
import type { MaterialDraft } from "../../store/dataStore";
import { useUiStore } from "../../store/uiStore";
import { useModalDialog } from "../../lib/useModalDialog";
import { useFormErrors } from "./dialogForm";
import MaterialRowsEditor, {
  makeEmptyMaterialDraft,
  validateMaterialRows
} from "./MaterialRowsEditor";
import type { MaterialRowInvalid } from "./MaterialRowsEditor";
import { taskDraftStore } from "./taskDraftStore";
import type { TaskDraftValues } from "./taskDraftStore";

const URGENCY_VALUES: Urgency[] = ["high", "medium", "low"];

export default function TaskDialog() {
  const dialog = useUiStore((s) => (s.dialog?.type === "task" ? s.dialog : null));
  const closeDialog = useUiStore((s) => s.closeDialog);
  const data = useDataStore((s) => s.data);
  const isSavingTask = useDataStore((s) => s.isSavingTask);
  const ref = useModalDialog(!!dialog, () => {
    /* Esc 关闭 = 真正关闭，清草稿 */
    taskDraftStore.clear();
    closeDialog();
  });

  const [values, setValues] = useState<TaskDraftValues>({
    name: "",
    groupId: "",
    flowGroupId: "",
    flowId: "",
    ddl: "",
    recurrenceCadence: "none",
    recurrenceStart: "",
    recurrenceEnd: "",
    urgency: "",
    status: "pending",
    completedAt: "",
    reportTo: "",
    managedObject: "",
    deliverable: ""
  });
  const [materials, setMaterials] = useState<MaterialDraft[]>([]);
  const [materialInvalid, setMaterialInvalid] = useState<Record<string, MaterialRowInvalid>>({});
  const [linksError, setLinksError] = useState("");
  const [reportToOptions, setReportToOptions] = useState<string[]>([]);
  const [managedObjectOptions, setManagedObjectOptions] = useState<string[]>([]);
  const { errors, setFieldError, clearFieldErrors, invalidClass, focusFirstInvalid } =
    useFormErrors();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const groups = data?.groups ?? [];
  const flows = data?.flows ?? [];
  const tasks = data?.tasks ?? [];
  const task = dialog?.taskId ? tasks.find((item) => item.id === dialog.taskId) : undefined;

  const patchValues = (patch: Partial<TaskDraftValues>): void => {
    setValues((prev) => ({ ...prev, ...patch }));
  };

  /* 打开时初始化：有匹配草稿（新建 Flow 返回）则恢复，否则新建/编辑回填 */
  useEffect(() => {
    if (!dialog) return;
    clearFieldErrors();
    setLinksError("");
    setMaterialInvalid({});
    const store = useDataStore.getState();
    const current = store.data;
    if (!current) {
      closeDialog();
      return;
    }
    const draft = taskDraftStore.load();
    if (draft && draft.taskId === (dialog.taskId ?? null)) {
      setValues(draft.values);
      setMaterials(draft.materials);
      /* 新建 Flow 返回：把 Flow 下拉切到新 Flow 所在分组并选中（等价原版
         saveFlowFromForm 里的 populateTaskFlowSelect(groupId, flow.id)） */
      const preselect = taskDraftStore.consumePreselectFlow();
      if (preselect) {
        const created = current.flows.find((item) => item.id === preselect);
        if (created) {
          setValues((prev) => ({
            ...prev,
            flowGroupId: created.groupId,
            flowId: created.id
          }));
        }
      }
    } else if (dialog.taskId) {
      const editing = current.tasks.find((item) => item.id === dialog.taskId);
      if (!editing) {
        closeDialog();
        return;
      }
      setValues({
        name: editing.name,
        groupId: editing.groupId,
        flowGroupId: editing.groupId,
        flowId: editing.flowId || "",
        ddl: editing.ddl,
        recurrenceCadence: dates.recurrenceCadence(editing),
        recurrenceStart: editing.recurrenceStart || "",
        recurrenceEnd: editing.recurrenceEnd || "",
        urgency: editing.urgency,
        status: editing.status,
        completedAt: editing.completedAt || "",
        reportTo: editing.reportTo,
        managedObject: editing.managedObject,
        deliverable: editing.deliverable
      });
      setMaterials(
        forTask(current.materials, editing.id).map((material) => ({
          id: material.id,
          title: material.title,
          url: material.url,
          type: material.type,
          createdAt: material.createdAt
        }))
      );
    } else {
      if (!current.groups.length) {
        useUiStore.getState().pushToast("请先新建一个分组，再创建 Task。", "warning");
        useUiStore.getState().openDialog({ type: "group" });
        return;
      }
      const filters = useUiStore.getState().filters;
      const filteredFlow =
        filters.flowId !== "all" && filters.flowId !== "none"
          ? current.flows.find((item) => item.id === filters.flowId)
          : undefined;
      const initialGroupId = filteredFlow
        ? filteredFlow.groupId
        : filters.groupIds.length === 1
          ? filters.groupIds[0]
          : current.groups[0].id;
      setValues({
        name: "",
        groupId: initialGroupId,
        flowGroupId: initialGroupId,
        flowId: filteredFlow ? filteredFlow.id : "",
        ddl: dates.todayISO(),
        recurrenceCadence: "none",
        recurrenceStart: "",
        recurrenceEnd: "",
        urgency: "",
        status: "pending",
        completedAt: "",
        reportTo: "",
        managedObject: "",
        deliverable: ""
      });
      setMaterials([]);
    }
    setReportToOptions(store.getPersonSuggestions("reportTo"));
    setManagedObjectOptions(store.getPersonSuggestions("managedObject"));
    const timer = setTimeout(() => {
      nameRef.current?.focus();
      if (dialog.taskId) nameRef.current?.select();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  /* 表单任何变动都同步草稿（跳去新建 Flow 时不丢） */
  useEffect(() => {
    if (!dialog) return;
    taskDraftStore.save({
      taskId: dialog.taskId ?? null,
      values,
      materials
    });
  }, [dialog, values, materials]);

  if (!dialog || (dialog.taskId && !task)) return null;

  const recurring = automation.isCadence(values.recurrenceCadence);
  const sortedGroups = groups
    .slice()
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const groupFlows = flows
    .filter((item) => item.groupId === values.flowGroupId)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  /* 所选 Flow 不在当前下拉分组内时回退到「不加入 Flow」（等价原版 3695 行回退） */
  const flowSelectValue =
    values.flowId && groupFlows.some((item) => item.id === values.flowId)
      ? values.flowId
      : "";

  /* 等价 syncTaskRecurrenceFields 的文案部分 */
  const cadenceUnit = values.recurrenceCadence === "weekly" ? "周" : "月";
  const recurrenceHelp = recurring
    ? automation.cadenceLabel(values.recurrenceCadence) +
      "显示多个 DDL，但只统计为一个 Task；完成勾选仅对应当前自然" +
      cadenceUnit +
      "。"
    : "不重复的 Task 只在其 DDL 所在周显示一次。";
  const statusHelp = recurring
    ? "周期 Task 的状态由当前自然" + cadenceUnit + "完成记录自动维护，请在时间轴勾选。"
    : "非周期 Task 可在此设置整体完成状态。";

  const onGroupChange = (nextGroupId: string): void => {
    patchValues({ groupId: nextGroupId, flowGroupId: nextGroupId, flowId: "" });
  };

  /* 等价 handleTaskFlowSelection：选「＋ 创建新的 Flow…」→ 回落到空并打开 Flow 弹窗 */
  const onFlowChange = (nextValue: string): void => {
    if (nextValue === "__new_flow__") {
      patchValues({ flowId: "" });
      useUiStore
        .getState()
        .openDialog({ type: "flow", groupId: values.groupId, returnToTask: true });
      return;
    }
    patchValues({ flowId: nextValue });
  };

  const onCadenceChange = (next: RecurrenceCadence): void => {
    const patch: Partial<TaskDraftValues> = { recurrenceCadence: next };
    if (automation.isCadence(next) && !values.recurrenceStart) {
      patch.recurrenceStart = values.ddl || dates.todayISO();
    }
    patchValues(patch);
  };

  /* 等价 syncCompletedDate（周期时完成日期禁用，由周期完成记录维护） */
  const onStatusChange = (next: TaskStatus): void => {
    const patch: Partial<TaskDraftValues> = { status: next };
    if (next === "completed" && !values.completedAt) patch.completedAt = dates.todayISO();
    if (next !== "completed") patch.completedAt = "";
    patchValues(patch);
  };

  const addMaterial = (): void => {
    setMaterials((prev) => prev.concat(makeEmptyMaterialDraft()));
    setTimeout(() => {
      const inputs = document
        .getElementById("task-materials")
        ?.querySelectorAll<HTMLElement>('[data-material-field="title"]');
      if (inputs && inputs.length) inputs[inputs.length - 1].focus();
    }, 0);
  };

  /* 等价 saveTaskFromForm 的校验段（4016-4095，逐条同序） */
  const onSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (useDataStore.getState().isSavingTask) return;
    clearFieldErrors();
    setLinksError("");
    setMaterialInvalid({});
    const name = values.name.trim();
    const groupId = values.groupId;
    const flowId = values.flowId || null;
    const selectedFlow = flowId ? flows.find((item) => item.id === flowId) : null;
    const ddl = dates.formatDate(values.ddl);
    const recurrenceStart = dates.formatDate(values.recurrenceStart);
    const recurrenceEnd = dates.formatDate(values.recurrenceEnd);
    const isRecurring = automation.isCadence(values.recurrenceCadence);
    const reportTo = values.reportTo.trim();
    const deliverable = values.deliverable.trim();
    let isValid = true;
    if (!name) {
      setFieldError("task-name", "请输入 Task name。");
      isValid = false;
    }
    if (!groups.some((item) => item.id === groupId)) {
      setFieldError("task-group", "请选择有效分组。");
      isValid = false;
    }
    if (flowId && (!selectedFlow || selectedFlow.groupId !== groupId)) {
      setFieldError("task-flow", "请选择当前分组下的有效 Flow。");
      isValid = false;
    }
    if (!ddl) {
      setFieldError("task-ddl", "请选择有效 DDL。");
      isValid = false;
    }
    if (values.recurrenceCadence !== "none" && !isRecurring) {
      setFieldError("task-recurrence", "请选择有效的周期。");
      isValid = false;
    }
    if (isRecurring) {
      if (!recurrenceStart) {
        setFieldError("task-recurrence-start", "请选择周期开始日期。");
        isValid = false;
      }
      if (!recurrenceEnd) {
        setFieldError("task-recurrence-end", "请选择周期结束日期。");
        isValid = false;
      }
      if (recurrenceStart && recurrenceEnd && recurrenceStart > recurrenceEnd) {
        setFieldError("task-recurrence-end", "周期结束日期不能早于开始日期。");
        isValid = false;
      }
      if (
        ddl &&
        recurrenceStart &&
        recurrenceEnd &&
        (ddl < recurrenceStart || ddl > recurrenceEnd)
      ) {
        setFieldError("task-ddl", "周期 Task 的 DDL 必须位于周期起止日期内。");
        isValid = false;
      }
      if (
        ddl &&
        recurrenceStart &&
        recurrenceEnd &&
        recurrenceStart <= recurrenceEnd &&
        !dates.getRecurringOccurrences({
          ddl,
          recurrenceCadence: values.recurrenceCadence,
          recurrenceStart,
          recurrenceEnd
        }).length
      ) {
        setFieldError("task-ddl", "当前 DDL 与周期范围无法形成任何周期节点。");
        isValid = false;
      }
    }
    if (!URGENCY_VALUES.includes(values.urgency as Urgency)) {
      setFieldError("task-urgency", "请选择紧急程度。");
      isValid = false;
    }
    if (!reportTo) {
      setFieldError("task-report-to", "请输入或选择汇报对象。");
      isValid = false;
    }
    if (!deliverable) {
      setFieldError("task-deliverable", "请输入交付物。");
      isValid = false;
    }
    const materialResult = validateMaterialRows(materials);
    if (!materialResult.valid) {
      setMaterialInvalid(materialResult.invalid);
      setLinksError("每条资料都需要链接名称、类型和合法的 HTTP/HTTPS 地址。");
      isValid = false;
    }
    if (!isValid) {
      focusFirstInvalid(formRef.current);
      return;
    }
    const status: TaskStatus =
      !isRecurring && values.status === "completed" ? "completed" : "pending";
    void useDataStore
      .getState()
      .saveTask({
        id: dialog.taskId,
        groupId,
        flowId,
        name,
        reportTo,
        managedObject: values.managedObject,
        deliverable,
        ddl,
        urgency: values.urgency as Urgency,
        status,
        completedAt: status === "completed" ? values.completedAt || null : null,
        recurrenceCadence: isRecurring ? values.recurrenceCadence : "none",
        recurrenceStart: isRecurring ? recurrenceStart : null,
        recurrenceEnd: isRecurring ? recurrenceEnd : null,
        materials: materialResult.drafts
      })
      .then((ok) => {
        if (ok) {
          taskDraftStore.clear();
          closeDialog();
        }
      });
  };

  const onDelete = (): void => {
    if (!task) return;
    if (!window.confirm("确认删除 Task「" + task.name + "」？此操作不可恢复。")) return;
    void useDataStore
      .getState()
      .deleteTask(task.id)
      .then((ok) => {
        if (ok) {
          taskDraftStore.clear();
          closeDialog();
        }
      });
  };

  const onCancel = (): void => {
    taskDraftStore.clear();
    closeDialog();
  };

  return (
    <dialog ref={ref} id="task-dialog" className="modal modal-large">
      <form id="task-form" method="dialog" noValidate onSubmit={onSubmit} ref={formRef}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">Task details</p>
            <h2 id="task-dialog-title">{dialog.taskId ? "编辑 Task" : "新建 Task"}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            data-action="close-task-dialog"
            aria-label="关闭"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        <input id="task-id" type="hidden" value={dialog.taskId ?? ""} readOnly />
        <div className="form-grid">
          <label className="form-field form-field-wide">
            <span>
              Task name <em>*</em>
            </span>
            <input
              id="task-name"
              maxLength={160}
              required
              autoComplete="off"
              ref={nameRef}
              value={values.name}
              className={invalidClass("task-name")}
              onChange={(event) => patchValues({ name: event.target.value })}
            />
            <small className="field-error" data-error-for="task-name">
              {errors["task-name"] ?? ""}
            </small>
          </label>
          <label className="form-field">
            <span>
              所属分组 <em>*</em>
            </span>
            <select
              id="task-group"
              required
              value={values.groupId}
              className={invalidClass("task-group")}
              onChange={(event) => onGroupChange(event.target.value)}
            >
              {sortedGroups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <small className="field-error" data-error-for="task-group">
              {errors["task-group"] ?? ""}
            </small>
          </label>
          <label className="form-field">
            <span>所属 Flow（可选）</span>
            <select
              id="task-flow"
              value={flowSelectValue}
              className={invalidClass("task-flow")}
              onChange={(event) => onFlowChange(event.target.value)}
            >
              <option value="">不加入 Flow</option>
              {groupFlows.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name +
                    " · " +
                    tasks.filter((taskItem) => taskItem.flowId === item.id).length +
                    " 个步骤"}
                </option>
              ))}
              <option value="__new_flow__">＋ 创建新的 Flow…</option>
            </select>
            <small>不加入 Flow 时，Task 直接显示在分组下。</small>
            <small className="field-error" data-error-for="task-flow">
              {errors["task-flow"] ?? ""}
            </small>
          </label>
          <label className="form-field">
            <span>
              DDL <em>*</em>
            </span>
            <input
              id="task-ddl"
              type="date"
              required
              value={values.ddl}
              className={invalidClass("task-ddl")}
              onChange={(event) => patchValues({ ddl: event.target.value })}
            />
            <small className="field-error" data-error-for="task-ddl">
              {errors["task-ddl"] ?? ""}
            </small>
          </label>
          <label className="form-field">
            <span>周期生成</span>
            <select
              id="task-recurrence"
              value={values.recurrenceCadence}
              className={invalidClass("task-recurrence")}
              onChange={(event) =>
                onCadenceChange(event.target.value as RecurrenceCadence)
              }
            >
              <option value="none">不重复</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </select>
            <small id="task-recurrence-help">{recurrenceHelp}</small>
            <small className="field-error" data-error-for="task-recurrence">
              {errors["task-recurrence"] ?? ""}
            </small>
          </label>
          <label id="task-recurrence-start-field" className="form-field" hidden={!recurring}>
            <span>
              周期开始日期 <em>*</em>
            </span>
            <input
              id="task-recurrence-start"
              type="date"
              required={recurring}
              value={values.recurrenceStart}
              className={invalidClass("task-recurrence-start")}
              onChange={(event) => patchValues({ recurrenceStart: event.target.value })}
            />
            <small className="field-error" data-error-for="task-recurrence-start">
              {errors["task-recurrence-start"] ?? ""}
            </small>
          </label>
          <label id="task-recurrence-end-field" className="form-field" hidden={!recurring}>
            <span>
              周期结束日期 <em>*</em>
            </span>
            <input
              id="task-recurrence-end"
              type="date"
              required={recurring}
              value={values.recurrenceEnd}
              className={invalidClass("task-recurrence-end")}
              onChange={(event) => patchValues({ recurrenceEnd: event.target.value })}
            />
            <small className="field-error" data-error-for="task-recurrence-end">
              {errors["task-recurrence-end"] ?? ""}
            </small>
          </label>
          <label className="form-field">
            <span>
              紧急程度 <em>*</em>
            </span>
            <select
              id="task-urgency"
              required
              value={values.urgency}
              className={invalidClass("task-urgency")}
              onChange={(event) => patchValues({ urgency: event.target.value as Urgency })}
            >
              <option value="" disabled>
                请选择紧急程度
              </option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
            <small className="field-error" data-error-for="task-urgency">
              {errors["task-urgency"] ?? ""}
            </small>
          </label>
          <label className="form-field">
            <span>完成状态</span>
            <select
              id="task-status"
              value={values.status}
              disabled={recurring}
              onChange={(event) => onStatusChange(event.target.value as TaskStatus)}
            >
              <option value="pending">未完成</option>
              <option value="completed">已完成</option>
            </select>
            <small id="task-status-help">{statusHelp}</small>
          </label>
          <label className="form-field">
            <span>完成日期</span>
            <input
              id="task-completed-at"
              type="date"
              disabled={recurring || values.status !== "completed"}
              value={!recurring && values.status !== "completed" ? "" : values.completedAt}
              onChange={(event) => patchValues({ completedAt: event.target.value })}
            />
            <small>标记完成时自动记录，可按需调整。</small>
          </label>
          <label className="form-field">
            <span>
              汇报对象 <em>*</em>
            </span>
            <input
              id="task-report-to"
              list="task-report-to-options"
              maxLength={120}
              required
              autoComplete="off"
              value={values.reportTo}
              className={invalidClass("task-report-to")}
              onChange={(event) => patchValues({ reportTo: event.target.value })}
            />
            <datalist id="task-report-to-options">
              {reportToOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <small>填写人员姓名；可从历史值中选择，也可输入新值。</small>
            <small className="field-error" data-error-for="task-report-to">
              {errors["task-report-to"] ?? ""}
            </small>
          </label>
          <label className="form-field">
            <span>管理对象</span>
            <input
              id="task-managed-object"
              list="task-managed-object-options"
              maxLength={160}
              autoComplete="off"
              value={values.managedObject}
              onChange={(event) => patchValues({ managedObject: event.target.value })}
            />
            <datalist id="task-managed-object-options">
              {managedObjectOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <small>填写人员姓名；可从历史值中选择，也可输入新值。</small>
          </label>
          <label className="form-field form-field-wide">
            <span>
              交付物 <em>*</em>
            </span>
            <textarea
              id="task-deliverable"
              rows={2}
              maxLength={500}
              required
              value={values.deliverable}
              className={invalidClass("task-deliverable")}
              onChange={(event) => patchValues({ deliverable: event.target.value })}
            ></textarea>
            <small className="field-error" data-error-for="task-deliverable">
              {errors["task-deliverable"] ?? ""}
            </small>
          </label>
        </div>

        <section className="link-editor material-editor" aria-labelledby="task-materials-title">
          <div className="link-editor-head">
            <div>
              <h3 id="task-materials-title">相关资料</h3>
              <p>资料会同步到资料库；支持说明文档、交付物、控制表和文件夹。</p>
            </div>
            <button
              className="button button-quiet button-small"
              type="button"
              data-add-material
              onClick={addMaterial}
            >
              ＋ 添加资料
            </button>
          </div>
          <MaterialRowsEditor
            id="task-materials"
            className="link-rows material-link-rows"
            rows={materials}
            invalid={materialInvalid}
            onChange={setMaterials}
          />
        </section>
        <small id="task-links-error" className="field-error">
          {linksError}
        </small>

        <div className="modal-actions split-actions">
          <button
            id="task-delete-button"
            className="button button-danger-quiet"
            type="button"
            data-action="delete-task"
            hidden={!dialog.taskId}
            onClick={onDelete}
          >
            删除 Task
          </button>
          <span></span>
          <button
            className="button button-quiet"
            type="button"
            data-action="close-task-dialog"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            id="task-save-button"
            className="button button-primary"
            type="submit"
            disabled={isSavingTask}
          >
            保存 Task
          </button>
        </div>
      </form>
    </dialog>
  );
}
