/* 添加/编辑资料弹窗：链接名称/类型/链接地址/备注 + 三级级联关联选择器
   （1 分组多选 → 勾选后解锁 2 相关 Flow / 3 相关 Task；每个 fieldset 带实时搜索）。
   等价原 app.js:4442 openMaterialDialog、4376 renderMaterialRelationOptions、
   4366 setMaterialRelationStepState、4467 handleMaterialRelationSearch、4482 handleMaterialRelationChange、
   4529 saveMaterialFromForm、4580 deleteCurrentMaterial。
   关联压缩（compactMaterialRelations）在 store 侧完成，这里把勾选的 id 直接传给 saveMaterial。 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";
import * as materialTools from "../../../shared/materials";
import * as utils from "../../../shared/utils";
import type { Flow, Group, MaterialType, Task, WeekflowData } from "../../../shared/types";
import { useDataStore } from "../../store/dataStore";
import { useUiStore } from "../../store/uiStore";
import { useModalDialog } from "../../lib/useModalDialog";
import { tConfirm } from "../../lib/i18n";

type RelationKind = "group" | "flow" | "task";

interface RelationOptionItem {
  id: string;
  label: string;
}

/* 等价 app.js:1005 getSortedGroups */
function sortedGroups(data: WeekflowData): Group[] {
  return data.groups.slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

/* 等价 app.js:1011 getSortedFlows()（不限分组：先按分组 order，再按 Flow 自身 order） */
function sortedFlows(data: WeekflowData): Flow[] {
  const groupOrder = new Map(data.groups.map((group) => [group.id, Number(group.order || 0)]));
  return data.flows.slice().sort((left, right) => {
    if (left.groupId !== right.groupId) {
      const difference =
        (groupOrder.get(left.groupId) || 0) - (groupOrder.get(right.groupId) || 0);
      if (difference) return difference;
    }
    return Number(left.order || 0) - Number(right.order || 0);
  });
}

/* 等价 app.js:4332 relationOptionLabel */
function relationOptionLabel(
  kind: RelationKind,
  item: Group | Flow | Task,
  data: WeekflowData
): string {
  if (kind === "group") return (item as Group).name;
  if (kind === "flow") {
    const flow = item as Flow;
    const group = data.groups.find((itemGroup) => itemGroup.id === flow.groupId);
    return [group && group.name, flow.name].filter(Boolean).join(" / ");
  }
  const task = item as Task;
  const group = data.groups.find((itemGroup) => itemGroup.id === task.groupId);
  const flow = data.flows.find((itemFlow) => itemFlow.id === task.flowId);
  return [group && group.name, flow && flow.name, task.name].filter(Boolean).join(" / ");
}

/* 等价 app.js:4345 renderRelationOptions + 4467 handleMaterialRelationSearch（hidden 过滤） */
function RelationOptions(props: {
  containerId: string;
  kind: RelationKind;
  items: RelationOptionItem[];
  selectedIds: string[];
  search: string;
  emptyMessage: string;
  onToggle: (id: string) => void;
}) {
  const needle = utils.normalizeText(props.search);
  return (
    <div id={props.containerId} className="relation-options">
      {props.items.length === 0 ? (
        <p className="relation-empty">{props.emptyMessage}</p>
      ) : (
        props.items.map((item) => {
          const normalizedLabel = utils.normalizeText(item.label);
          return (
            <label
              key={item.id}
              className="relation-option"
              data-relation-label={normalizedLabel}
              hidden={Boolean(needle && !normalizedLabel.includes(needle))}
            >
              <input
                type="checkbox"
                value={item.id}
                data-relation-type={props.kind}
                checked={props.selectedIds.includes(item.id)}
                onChange={() => props.onToggle(item.id)}
              />
              <span>{item.label}</span>
            </label>
          );
        })
      )}
    </div>
  );
}

export default function MaterialDialog() {
  const dialog = useUiStore((s) =>
    s.dialog && s.dialog.type === "material" ? s.dialog : null
  );
  const data = useDataStore((s) => s.data);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const ref = useModalDialog(Boolean(dialog), closeDialog);
  if (!dialog || !data) return null;
  return (
    <MaterialDialogInner
      key={dialog.materialId || "new"}
      data={data}
      materialId={dialog.materialId || null}
      dialogRef={ref}
    />
  );
}

interface MaterialDialogInnerProps {
  data: WeekflowData;
  materialId: string | null;
  dialogRef: RefObject<HTMLDialogElement>;
}

function MaterialDialogInner({ data, materialId, dialogRef }: MaterialDialogInnerProps) {
  const closeDialog = useUiStore((s) => s.closeDialog);
  const material = materialId
    ? data.materials.find((item) => item.id === materialId) || null
    : null;

  const [title, setTitle] = useState(material ? material.title : "");
  const [type, setType] = useState<MaterialType>(material ? material.type : "document");
  const [url, setUrl] = useState(material ? material.url : "");
  const [note, setNote] = useState(material ? material.note : "");
  /* 编辑时初始勾选 = resolveRelations 展开后的关联（含 Task 隐含的 Flow/分组），
     保存时 store 的 compactMaterialRelations 会把隐含关联重新剔除。 */
  const initialRelations = useMemo(
    () =>
      material
        ? materialTools.resolveRelations(material, data)
        : { taskIds: [] as string[], flowIds: [] as string[], groupIds: [] as string[] },
    // 仅在弹窗挂载时取一次（每次打开都会重新挂载）
    []
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(
    initialRelations.groupIds
  );
  const [selectedFlowIds, setSelectedFlowIds] = useState<string[]>(initialRelations.flowIds);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(initialRelations.taskIds);
  const [groupSearch, setGroupSearch] = useState("");
  const [flowSearch, setFlowSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({});
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  /* 等价原版 openMaterialDialog 的 setTimeout 聚焦（编辑时全选名称） */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (titleRef.current) {
        titleRef.current.focus();
        if (material) titleRef.current.select();
      }
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedValidGroupIds = useMemo(
    () =>
      materialTools
        .uniqueIds(selectedGroupIds)
        .filter((id) => data.groups.some((group) => group.id === id)),
    [selectedGroupIds, data]
  );
  const hasSelectedGroups = selectedValidGroupIds.length > 0;

  const groupOptions = useMemo(
    () =>
      sortedGroups(data).map((group) => ({
        id: group.id,
        label: relationOptionLabel("group", group, data)
      })),
    [data]
  );

  const flowOptions = useMemo(() => {
    if (!hasSelectedGroups) return [];
    return sortedFlows(data)
      .filter((flow) => selectedValidGroupIds.includes(flow.groupId))
      .map((flow) => ({ id: flow.id, label: relationOptionLabel("flow", flow, data) }));
  }, [data, hasSelectedGroups, selectedValidGroupIds]);

  const taskOptions = useMemo(() => {
    if (!hasSelectedGroups) return [];
    return data.tasks
      .filter((task) => selectedValidGroupIds.includes(task.groupId))
      .slice()
      .sort((left, right) =>
        relationOptionLabel("task", left, data).localeCompare(
          relationOptionLabel("task", right, data),
          "zh-CN",
          { numeric: true }
        )
      )
      .map((task) => ({ id: task.id, label: relationOptionLabel("task", task, data) }));
  }, [data, hasSelectedGroups, selectedValidGroupIds]);

  /* 等价 app.js:4482 handleMaterialRelationChange + 4376 的分组勾选重渲染：
     剔除不再可选的 Flow/Task 勾选，并清空三个搜索框。 */
  const toggleGroup = (id: string): void => {
    const nextGroupIds = selectedGroupIds.includes(id)
      ? selectedGroupIds.filter((item) => item !== id)
      : materialTools.uniqueIds(selectedGroupIds.concat(id));
    const availableFlowIds = new Set(
      data.flows
        .filter((flow) => nextGroupIds.includes(flow.groupId))
        .map((flow) => flow.id)
    );
    const availableTaskIds = new Set(
      data.tasks
        .filter((task) => nextGroupIds.includes(task.groupId))
        .map((task) => task.id)
    );
    setSelectedGroupIds(nextGroupIds);
    setSelectedFlowIds((prev) => prev.filter((flowId) => availableFlowIds.has(flowId)));
    setSelectedTaskIds((prev) => prev.filter((taskId) => availableTaskIds.has(taskId)));
    setGroupSearch("");
    setFlowSearch("");
    setTaskSearch("");
  };

  const toggleFlow = (id: string): void => {
    setSelectedFlowIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : materialTools.uniqueIds(prev.concat(id))
    );
  };

  const toggleTask = (id: string): void => {
    setSelectedTaskIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : materialTools.uniqueIds(prev.concat(id))
    );
  };

  /* 等价 app.js:4529 saveMaterialFromForm */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();
    const nextErrors: { title?: string; url?: string } = {};
    if (!trimmedTitle) nextErrors.title = "请输入链接名称。";
    if (!utils.isValidUrl(trimmedUrl)) nextErrors.url = "请输入合法的 HTTP/HTTPS 链接地址。";
    setErrors(nextErrors);
    if (nextErrors.title || nextErrors.url) {
      const firstInvalid = nextErrors.title ? titleRef.current : urlRef.current;
      if (firstInvalid) firstInvalid.focus();
      return;
    }
    setSaving(true);
    const saved = await useDataStore.getState().saveMaterial({
      id: material ? material.id : undefined,
      title: trimmedTitle,
      url: trimmedUrl,
      type,
      taskIds: selectedTaskIds,
      flowIds: selectedFlowIds,
      groupIds: selectedGroupIds,
      note
    });
    setSaving(false);
    if (saved) closeDialog();
  };

  /* 等价 app.js:4580 deleteCurrentMaterial */
  const handleDelete = async (): Promise<void> => {
    if (!material) return;
    if (
      !tConfirm("确认删除资料「" + material.title + "」？所有 Task 中的关联也会移除。")
    ) {
      return;
    }
    const deleted = await useDataStore.getState().deleteMaterial(material.id);
    if (deleted) closeDialog();
  };

  return (
    <dialog id="material-dialog" className="modal modal-large" ref={dialogRef}>
      <form id="material-form" method="dialog" noValidate onSubmit={(event) => void handleSubmit(event)}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">Document details</p>
            <h2 id="material-dialog-title">{material ? "编辑资料" : "添加资料"}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            data-action="close-material-dialog"
            aria-label="关闭"
            onClick={closeDialog}
          >
            ×
          </button>
        </div>
        <input id="material-id" type="hidden" value={material ? material.id : ""} readOnly />
        <div className="form-grid material-form-grid">
          <label className="form-field material-field-title">
            <span>
              链接名称 <em>*</em>
            </span>
            <input
              id="material-title"
              maxLength={160}
              required
              autoComplete="off"
              ref={titleRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={errors.title ? "is-invalid" : ""}
            />
            <small className="field-error" data-error-for="material-title">
              {errors.title || null}
            </small>
          </label>
          <label className="form-field material-field-type">
            <span>类型</span>
            <select
              id="material-type"
              value={type}
              onChange={(event) => setType(event.target.value as MaterialType)}
            >
              <option value="document">说明文档</option>
              <option value="deliverable">交付物</option>
              <option value="control">控制表</option>
              <option value="folder">文件夹</option>
            </select>
          </label>
          <label className="form-field material-field-url">
            <span>
              链接地址 <em>*</em>
            </span>
            <input
              id="material-url"
              type="url"
              maxLength={3000}
              required
              placeholder="https://"
              ref={urlRef}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className={errors.url ? "is-invalid" : ""}
            />
            <small className="field-error" data-error-for="material-url">
              {errors.url || null}
            </small>
          </label>
          <label className="form-field material-field-note">
            <span>备注</span>
            <textarea
              id="material-note"
              rows={1}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>

        <div className="material-relation-grid">
          <fieldset className="relation-fieldset relation-step relation-step-group">
            <legend>
              <span>1</span> 分组（可多选）
            </legend>
            <input
              className="relation-search"
              type="search"
              data-relation-search="group"
              placeholder="搜索分组"
              autoComplete="off"
              value={groupSearch}
              onChange={(event) => setGroupSearch(event.target.value)}
            />
            <RelationOptions
              containerId="material-group-options"
              kind="group"
              items={groupOptions}
              selectedIds={selectedGroupIds}
              search={groupSearch}
              emptyMessage="还没有可选分组"
              onToggle={toggleGroup}
            />
          </fieldset>
          <fieldset
            className={
              "relation-fieldset relation-step relation-step-flow" +
              (hasSelectedGroups ? "" : " is-locked")
            }
          >
            <legend>
              <span>2</span> 相关 Flow（可多选）
            </legend>
            <input
              className="relation-search"
              type="search"
              data-relation-search="flow"
              placeholder={hasSelectedGroups ? "搜索 Flow" : "请先选择分组"}
              autoComplete="off"
              disabled={!hasSelectedGroups}
              value={flowSearch}
              onChange={(event) => setFlowSearch(event.target.value)}
            />
            <RelationOptions
              containerId="material-flow-options"
              kind="flow"
              items={flowOptions}
              selectedIds={selectedFlowIds}
              search={flowSearch}
              emptyMessage={hasSelectedGroups ? "所选分组暂无 Flow" : "请先选择分组"}
              onToggle={toggleFlow}
            />
          </fieldset>
          <fieldset
            className={
              "relation-fieldset relation-step relation-step-task" +
              (hasSelectedGroups ? "" : " is-locked")
            }
          >
            <legend>
              <span>3</span> 相关 Task（可多选）
            </legend>
            <input
              className="relation-search"
              type="search"
              data-relation-search="task"
              placeholder={hasSelectedGroups ? "搜索 Task" : "请先选择分组"}
              autoComplete="off"
              disabled={!hasSelectedGroups}
              value={taskSearch}
              onChange={(event) => setTaskSearch(event.target.value)}
            />
            <RelationOptions
              containerId="material-task-options"
              kind="task"
              items={taskOptions}
              selectedIds={selectedTaskIds}
              search={taskSearch}
              emptyMessage={hasSelectedGroups ? "所选分组暂无 Task" : "请先选择分组"}
              onToggle={toggleTask}
            />
          </fieldset>
        </div>
        <p className="material-relation-note">
          先选择分组，再从所选分组内勾选 Flow 和 Task；所有选项都来自时间轴看板。
        </p>

        <div className="modal-actions split-actions">
          <button
            id="material-delete-button"
            className="button button-danger-quiet"
            type="button"
            data-action="delete-material"
            hidden={!material}
            onClick={() => void handleDelete()}
          >
            删除资料
          </button>
          <span></span>
          <button
            className="button button-quiet"
            type="button"
            data-action="close-material-dialog"
            onClick={closeDialog}
          >
            取消
          </button>
          <button
            id="material-save-button"
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
