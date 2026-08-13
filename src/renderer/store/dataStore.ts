/* 业务数据 store：WeekflowData 全量持有 + 全部变更 action。
   统一变更管线 persist：syncRecurringTaskStates → schema.validateData →
   set 归一化副本 → window.weekflow.saveData → uiStore.sanitize → toast。
   数据变更逻辑逐条复刻原 js/app.js 对应函数（表单字段级校验在弹窗组件，
   本层接收合法 payload）。 */
import { create } from "zustand";
import type {
  Flow,
  Group,
  Material,
  MaterialType,
  RecurrenceCadence,
  RecurrenceCompletion,
  Task,
  TaskStatus,
  Urgency,
  WeekflowData
} from "../../shared/types";
import * as schema from "../../shared/schema";
import * as utils from "../../shared/utils";
import * as dates from "../../shared/date-utils";
import * as automation from "../../shared/automation";
import * as materialTools from "../../shared/materials";
import type {
  ParsedLink,
  ParsedTaskRow
} from "../../shared/excel-import";
import type { ParsedMaterialRow } from "../../shared/material-excel";
import { useUiStore } from "./uiStore";

/* ------------------------------------------------------------------ */
/* 输入 / 返回类型                                                      */
/* ------------------------------------------------------------------ */

export type ActionResult = { ok: boolean; error?: string };

export type PersonField = "reportTo" | "managedObject";

/** Task 弹窗/资料管理弹窗里的资料草稿（已按行规范化后的形状）。 */
export interface MaterialDraft {
  id: string;
  title: string;
  url: string;
  type: MaterialType;
  createdAt?: string;
}

export interface SaveTaskInput {
  /** 提供 id 为编辑，否则新建 */
  id?: string;
  groupId: string;
  flowId: string | null;
  name: string;
  reportTo: string;
  managedObject: string;
  deliverable: string;
  ddl: string;
  urgency: Urgency;
  /** 仅非周期 Task 生效；周期 Task 状态强制 pending（由完成记录维护） */
  status: TaskStatus;
  /** 仅 status === "completed" 时生效；空串回退今天 */
  completedAt: string | null;
  recurrenceCadence: RecurrenceCadence;
  recurrenceStart: string | null;
  recurrenceEnd: string | null;
  /** 随 Task 一起 reconcile 的资料草稿（Task 弹窗）；不传则不动资料关联 */
  materials?: MaterialDraft[];
}

export interface SaveGroupInput {
  id?: string;
  name: string;
  /** 新建缺省自动取 nextGroupColor */
  color?: string;
}

export interface SaveFlowInput {
  id?: string;
  name: string;
  groupId: string;
  /** 新建缺省继承分组色 */
  color?: string;
  /** Flow 内步骤的拖拽结果（弹窗排序列表的 taskId 顺序），将回写 flowOrder 1 起 */
  orderedTaskIds?: string[];
}

export interface SaveMaterialInput {
  id?: string;
  title: string;
  url: string;
  type: MaterialType;
  taskIds: string[];
  flowIds: string[];
  groupIds: string[];
  note: string;
}

/** 资料库导入行（名称已解析为 id、已检测既有重复地址）。 */
export interface ResolvedMaterialImportRow {
  sourceRow: number;
  title: string;
  url: string;
  type: MaterialType;
  taskIds: string[];
  flowIds: string[];
  groupIds: string[];
  note: string;
  /** append 模式下与本条地址重复的既有资料 id */
  duplicateId: string | null;
}

export interface MaterialImportCounts {
  added: number;
  replaced: number;
  skipped: number;
}

export interface MaterialImportPreview {
  rows: ResolvedMaterialImportRow[];
  errors: string[];
  duplicateCount: number;
}

export interface TaskImportSummary {
  taskCount: number;
  groupCount: number;
  flowCount: number;
  newGroupCount: number;
  newFlowCount: number;
}

/* ------------------------------------------------------------------ */
/* 模块级纯函数（复刻原 app.js 辅助函数）                                */
/* ------------------------------------------------------------------ */

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function findGroup(data: WeekflowData, id: string): Group | undefined {
  return data.groups.find((group) => group.id === id);
}

function findFlow(data: WeekflowData, id: string | null | undefined): Flow | undefined {
  return id ? data.flows.find((flow) => flow.id === id) : undefined;
}

function findTask(data: WeekflowData, id: string | null | undefined): Task | undefined {
  return id ? data.tasks.find((task) => task.id === id) : undefined;
}

function findMaterial(data: WeekflowData, id: string): Material | undefined {
  return data.materials.find((material) => material.id === id);
}

/* 等价 app.js:3625-3647 normalizeTaskSuggestionValue / collectTaskSuggestionValues */
function normalizeSuggestionValue(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function collectSuggestionValues(tasks: Task[], field: PersonField): string[] {
  const seen = new Set<string>();
  return tasks
    .map((task) => normalizeSuggestionValue(task[field]))
    .filter((value) => {
      if (!value) return false;
      const key = value.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) =>
      left.localeCompare(right, "zh-CN", { sensitivity: "base", numeric: true })
    );
}

/* 等价 app.js:3663 canonicalTaskSuggestionValue */
function canonicalSuggestion(tasks: Task[], field: PersonField, value: string): string {
  const normalized = normalizeSuggestionValue(value);
  if (!normalized) return "";
  const key = normalized.toLocaleLowerCase();
  return (
    collectSuggestionValues(tasks, field).find(
      (existing) => existing.toLocaleLowerCase() === key
    ) || normalized
  );
}

/* 等价 app.js:4166 retainRecurringCompletions：编辑周期 Task 时只保留新排期内的期次 */
function retainRecurringCompletions(
  existing: Task | null,
  schedule: dates.RecurrenceConfig
): RecurrenceCompletion[] {
  if (!existing || !dates.isRecurringTask(schedule)) return [];
  const occurrences = new Map(
    dates.getRecurringOccurrences(schedule).map((occurrence) => {
      return [occurrence.periodKey, occurrence.ddl] as [string, string];
    })
  );
  return (Array.isArray(existing.recurrenceCompletions) ? existing.recurrenceCompletions : [])
    .filter((record) => occurrences.has(record.periodKey))
    .map((record) => {
      const occurrenceDdl = occurrences.get(record.periodKey) as string;
      return {
        periodKey: record.periodKey,
        occurrenceDdl,
        completedAt: dates.formatDate(record.completedAt) || occurrenceDdl
      };
    });
}

/* 等价 app.js:3970 reconcileTaskMaterials：先摘除全部资料对该 Task 的关联，
   再逐条 upsert（id 命中复用，否则新建）并回挂 taskIds。 */
function reconcileTaskMaterials(
  data: WeekflowData,
  taskId: string,
  drafts: MaterialDraft[],
  stamp: string
): void {
  data.materials.forEach((material) => {
    material.taskIds = material.taskIds.filter((id) => id !== taskId);
  });
  drafts.forEach((draft) => {
    let material = findMaterial(data, draft.id);
    if (material) {
      material.title = draft.title;
      material.url = draft.url;
      material.type = draft.type;
      material.updatedAt = stamp;
    } else {
      material = materialTools.normalizeMaterial(
        Object.assign({}, draft, {
          id: draft.id || utils.uid("material"),
          createdAt: draft.createdAt || stamp,
          updatedAt: stamp
        })
      );
      data.materials.push(material);
    }
    material.taskIds = materialTools.uniqueIds(material.taskIds.concat(taskId));
  });
}

/* 等价 app.js:4500 compactMaterialRelations：剔除已被 Task 关联隐含的 Flow/分组关联 */
function compactMaterialRelations(
  data: WeekflowData,
  taskIds: string[],
  flowIds: string[],
  groupIds: string[]
): { taskIds: string[]; flowIds: string[]; groupIds: string[] } {
  const taskFlowIds = new Set<string>();
  const derivedGroupIds = new Set<string>();
  taskIds.forEach((taskId) => {
    const task = findTask(data, taskId);
    if (!task) return;
    derivedGroupIds.add(task.groupId);
    if (task.flowId) taskFlowIds.add(task.flowId);
  });
  const explicitFlowIds = flowIds.filter((flowId) => !taskFlowIds.has(flowId));
  Array.from(taskFlowIds)
    .concat(explicitFlowIds)
    .forEach((flowId) => {
      const flow = findFlow(data, flowId);
      if (flow) derivedGroupIds.add(flow.groupId);
    });
  return {
    taskIds: materialTools.uniqueIds(taskIds),
    flowIds: materialTools.uniqueIds(explicitFlowIds),
    groupIds: materialTools.uniqueIds(
      groupIds.filter((groupId) => !derivedGroupIds.has(groupId))
    )
  };
}

/* 等价 app.js:3526 uniqueFlowNameForGroup */
function uniqueFlowNameForGroup(
  data: WeekflowData,
  name: string,
  groupId: string,
  excludeId: string,
  sourceGroupName: string
): string {
  let base = name;
  let candidate = base;
  let suffix = 1;
  function exists(value: string): boolean {
    return data.flows.some(
      (flow) =>
        flow.id !== excludeId &&
        flow.groupId === groupId &&
        flow.name.toLocaleLowerCase() === value.toLocaleLowerCase()
    );
  }
  if (exists(candidate)) {
    base = name + "（来自" + sourceGroupName + "）";
    candidate = base;
  }
  while (exists(candidate)) {
    suffix += 1;
    candidate = base + " " + suffix;
  }
  return candidate;
}

/* ------------------------- Excel Task 导入 ------------------------- */

function normalizeImportName(value: unknown): string {
  return utils.normalizeText(value);
}

function importFlowKey(groupName: string, flowName: string): string {
  return normalizeImportName(groupName) + "::" + normalizeImportName(flowName);
}

function taskImportKey(groupName: string, flowName: string, taskName: string): string {
  return [
    normalizeImportName(groupName),
    normalizeImportName(flowName),
    normalizeImportName(taskName)
  ].join("::");
}

/* 等价 app.js:5155 attachImportedMaterial：同 materialUrlKey 命中复用并回挂 taskId */
function attachImportedMaterial(
  data: WeekflowData,
  link: ParsedLink,
  type: "document" | "deliverable",
  taskId: string,
  stamp: string
): Material {
  const key = utils.materialUrlKey(link.url);
  const existing = data.materials.find(
    (material) => utils.materialUrlKey(material.url) === key
  );
  if (existing) {
    const previousCount = existing.taskIds.length;
    existing.taskIds = materialTools.uniqueIds(existing.taskIds.concat(taskId));
    if (existing.taskIds.length !== previousCount) existing.updatedAt = stamp;
    return existing;
  }
  const material = materialTools.makeMaterial(
    {
      id: utils.uid("material"),
      title: link.title,
      url: link.url,
      type,
      taskIds: [taskId]
    },
    stamp
  );
  data.materials.push(material);
  return material;
}

interface ImportedRecurrenceState {
  recurrenceCadence: RecurrenceCadence;
  recurrenceStart: string | null;
  recurrenceEnd: string | null;
  recurrenceCompletions: RecurrenceCompletion[];
  status: TaskStatus;
  completedAt: string | null;
}

/* 等价 app.js:5180 importedRecurrenceState：未指定周期列时沿用既有 Task 的周期排期 */
function importedRecurrenceState(
  row: ParsedTaskRow,
  existing: Task | null
): ImportedRecurrenceState {
  const useLegacyRecurrence = Boolean(
    !row.recurrenceSpecified &&
      existing &&
      dates.isRecurringTask(existing) &&
      existing.recurrenceStart !== null &&
      existing.recurrenceEnd !== null &&
      row.ddl >= existing.recurrenceStart &&
      row.ddl <= existing.recurrenceEnd
  );
  const cadence: RecurrenceCadence =
    useLegacyRecurrence && existing
      ? dates.recurrenceCadence(existing)
      : row.recurrenceCadence;
  if (!automation.isCadence(cadence)) {
    return {
      recurrenceCadence: "none",
      recurrenceStart: null,
      recurrenceEnd: null,
      recurrenceCompletions: [],
      status: row.status,
      completedAt: row.status === "completed" ? row.completedAt || dates.todayISO() : null
    };
  }

  const taskLike = {
    ddl: row.ddl,
    recurrenceCadence: cadence,
    recurrenceStart:
      useLegacyRecurrence && existing
        ? existing.recurrenceStart
        : row.recurrenceStart || null,
    recurrenceEnd:
      useLegacyRecurrence && existing ? existing.recurrenceEnd : row.recurrenceEnd || null,
    recurrenceCompletions: utils.clone(
      useLegacyRecurrence && existing
        ? existing.recurrenceCompletions || []
        : row.recurrenceCompletions || []
    )
  };
  if (row.status === "completed" && !taskLike.recurrenceCompletions.length) {
    const today = dates.todayISO();
    const completionDate = row.completedAt || today;
    const occurrences = dates.getRecurringOccurrences(taskLike);
    const currentKey = dates.recurrencePeriodKey(cadence, today);
    let targetIndex = occurrences.findIndex(
      (occurrence) => occurrence.periodKey === currentKey
    );
    if (targetIndex < 0) {
      occurrences.forEach((occurrence, index) => {
        if (occurrence.ddl <= completionDate) targetIndex = index;
      });
    }
    if (targetIndex >= 0) {
      taskLike.recurrenceCompletions = occurrences
        .slice(0, targetIndex + 1)
        .map((occurrence) => ({
          periodKey: occurrence.periodKey,
          occurrenceDdl: occurrence.ddl,
          completedAt: completionDate
        }));
    }
  }
  taskLike.recurrenceCompletions = automation.normalizeCompletions(taskLike as Task);
  const state = dates.getTaskPeriodState(taskLike as Task, new Date());
  return {
    recurrenceCadence: cadence,
    recurrenceStart: taskLike.recurrenceStart,
    recurrenceEnd: taskLike.recurrenceEnd,
    recurrenceCompletions: taskLike.recurrenceCompletions,
    status: state.completed ? "completed" : "pending",
    completedAt: state.completedAt || null
  };
}

/* 等价 app.js:5251 appendExcelRows：同名分组/Flow 复用，其余新建 */
function appendExcelRows(data: WeekflowData, rows: ParsedTaskRow[]): void {
  const stamp = new Date().toISOString();
  const groupByName = new Map<string, Group>();
  data.groups.forEach((group) => {
    groupByName.set(normalizeImportName(group.name), group);
  });

  const newGroupSpecs = new Map<string, { name: string; color: string }>();
  rows.forEach((row) => {
    const key = normalizeImportName(row.groupName);
    if (groupByName.has(key)) return;
    const spec = newGroupSpecs.get(key);
    if (!spec) {
      newGroupSpecs.set(key, { name: row.groupName, color: row.groupColor || "" });
    } else if (!spec.color && row.groupColor) {
      spec.color = row.groupColor;
    }
  });
  let nextGroupOrder = data.groups.length
    ? Math.max(...data.groups.map((group) => Number(group.order || 0))) + 1
    : 1;
  newGroupSpecs.forEach((spec, key) => {
    const group: Group = {
      id: utils.uid("group"),
      name: spec.name,
      color: spec.color || schema.nextGroupColor(data.groups),
      order: nextGroupOrder,
      collapsed: false,
      createdAt: stamp,
      updatedAt: stamp
    };
    nextGroupOrder += 1;
    data.groups.push(group);
    groupByName.set(key, group);
  });

  const flowByName = new Map<string, Flow>();
  data.flows.forEach((flow) => {
    const group = findGroup(data, flow.groupId);
    if (group) flowByName.set(importFlowKey(group.name, flow.name), flow);
  });
  const newFlowSpecs = new Map<string, { groupKey: string; name: string; color: string }>();
  rows.forEach((row) => {
    if (!row.flowName) return;
    const key = importFlowKey(row.groupName, row.flowName);
    if (flowByName.has(key)) return;
    const spec = newFlowSpecs.get(key);
    if (!spec) {
      newFlowSpecs.set(key, {
        groupKey: normalizeImportName(row.groupName),
        name: row.flowName,
        color: row.flowColor || ""
      });
    } else if (!spec.color && row.flowColor) {
      spec.color = row.flowColor;
    }
  });
  const maxFlowOrderByGroup = new Map<string, number>();
  data.flows.forEach((flow) => {
    maxFlowOrderByGroup.set(
      flow.groupId,
      Math.max(maxFlowOrderByGroup.get(flow.groupId) || 0, Number(flow.order || 0))
    );
  });
  newFlowSpecs.forEach((spec, key) => {
    const group = groupByName.get(spec.groupKey) as Group;
    const order = (maxFlowOrderByGroup.get(group.id) || 0) + 1;
    const flow: Flow = {
      id: utils.uid("flow"),
      groupId: group.id,
      name: spec.name,
      color: spec.color || group.color,
      order,
      collapsed: false,
      createdAt: stamp,
      updatedAt: stamp
    };
    data.flows.push(flow);
    flowByName.set(key, flow);
    maxFlowOrderByGroup.set(group.id, order);
  });

  const maxTaskOrderByFlow = new Map<string, number>();
  data.tasks.forEach((task) => {
    if (!task.flowId) return;
    maxTaskOrderByFlow.set(
      task.flowId,
      Math.max(maxTaskOrderByFlow.get(task.flowId) || 0, Number(task.flowOrder || 0))
    );
  });
  rows.forEach((row) => {
    const group = groupByName.get(normalizeImportName(row.groupName)) as Group;
    const flow = row.flowName
      ? flowByName.get(importFlowKey(row.groupName, row.flowName)) || null
      : null;
    let flowOrder: number | null = null;
    if (flow) {
      flowOrder = row.flowOrder || (maxTaskOrderByFlow.get(flow.id) || 0) + 1;
      maxTaskOrderByFlow.set(
        flow.id,
        Math.max(maxTaskOrderByFlow.get(flow.id) || 0, flowOrder)
      );
    }
    const recurrence = importedRecurrenceState(row, null);
    const importedTask: Task = {
      id: utils.uid("task"),
      groupId: group.id,
      flowId: flow ? flow.id : null,
      flowOrder,
      name: row.taskName,
      reportTo: canonicalSuggestion(data.tasks, "reportTo", row.reportTo),
      managedObject: canonicalSuggestion(data.tasks, "managedObject", row.managedObject),
      deliverable: row.deliverable,
      ddl: row.ddl,
      urgency: row.urgency || "medium",
      status: recurrence.status,
      completedAt: recurrence.completedAt,
      recurrenceCadence: recurrence.recurrenceCadence,
      recurrenceStart: recurrence.recurrenceStart,
      recurrenceEnd: recurrence.recurrenceEnd,
      recurrenceCompletions: recurrence.recurrenceCompletions,
      progressNote: row.progressNote,
      progressUpdatedAt: row.progressNote ? stamp : null,
      createdAt: stamp,
      updatedAt: stamp
    };
    data.tasks.push(importedTask);
    row.documentLinks.forEach((link) => {
      attachImportedMaterial(data, link, "document", importedTask.id, stamp);
    });
    row.deliverableLinks.forEach((link) => {
      attachImportedMaterial(data, link, "deliverable", importedTask.id, stamp);
    });
  });
}

/* 等价 app.js:5396 replaceExcelRows：按文件重建分组/Flow/Task，同名层级复用原 id */
function replaceExcelRows(data: WeekflowData, rows: ParsedTaskRow[]): void {
  const stamp = new Date().toISOString();
  const existingGroupById = new Map<string, Group>();
  const existingGroupByName = new Map<string, Group>();
  data.groups.forEach((group) => {
    existingGroupById.set(group.id, group);
    existingGroupByName.set(normalizeImportName(group.name), group);
  });
  const existingFlowById = new Map<string, Flow>();
  const existingFlowByName = new Map<string, Flow>();
  data.flows.forEach((flow) => {
    const group = existingGroupById.get(flow.groupId);
    existingFlowById.set(flow.id, flow);
    if (group) existingFlowByName.set(importFlowKey(group.name, flow.name), flow);
  });
  const existingTaskQueues = new Map<string, Task[]>();
  data.tasks.forEach((task) => {
    const group = existingGroupById.get(task.groupId);
    const flow = task.flowId ? existingFlowById.get(task.flowId) : null;
    if (!group) return;
    const key = taskImportKey(group.name, flow ? flow.name : "", task.name);
    if (!existingTaskQueues.has(key)) existingTaskQueues.set(key, []);
    (existingTaskQueues.get(key) as Task[]).push(task);
  });

  const groupSpecs = new Map<string, { name: string; color: string }>();
  rows.forEach((row) => {
    const key = normalizeImportName(row.groupName);
    const spec = groupSpecs.get(key);
    if (!spec) {
      groupSpecs.set(key, { name: row.groupName, color: row.groupColor || "" });
    } else if (!spec.color && row.groupColor) {
      spec.color = row.groupColor;
    }
  });
  const nextGroups: Group[] = [];
  const groupByName = new Map<string, Group>();
  groupSpecs.forEach((spec, key) => {
    const existing = existingGroupByName.get(key);
    const group: Group = {
      id: existing ? existing.id : utils.uid("group"),
      name: spec.name,
      color: spec.color || (existing && existing.color) || schema.nextGroupColor(nextGroups),
      order: nextGroups.length + 1,
      collapsed: existing ? existing.collapsed : false,
      createdAt: existing ? existing.createdAt : stamp,
      updatedAt: stamp
    };
    nextGroups.push(group);
    groupByName.set(key, group);
  });

  const flowSpecs = new Map<string, { groupKey: string; name: string; color: string }>();
  rows.forEach((row) => {
    if (!row.flowName) return;
    const key = importFlowKey(row.groupName, row.flowName);
    const spec = flowSpecs.get(key);
    if (!spec) {
      flowSpecs.set(key, {
        groupKey: normalizeImportName(row.groupName),
        name: row.flowName,
        color: row.flowColor || ""
      });
    } else if (!spec.color && row.flowColor) {
      spec.color = row.flowColor;
    }
  });
  const nextFlows: Flow[] = [];
  const flowByName = new Map<string, Flow>();
  const nextFlowOrderByGroup = new Map<string, number>();
  flowSpecs.forEach((spec, key) => {
    const group = groupByName.get(spec.groupKey) as Group;
    const existing = existingFlowByName.get(key);
    const order = (nextFlowOrderByGroup.get(group.id) || 0) + 1;
    const flow: Flow = {
      id: existing ? existing.id : utils.uid("flow"),
      groupId: group.id,
      name: spec.name,
      color: spec.color || (existing && existing.color) || group.color,
      order,
      collapsed: existing ? existing.collapsed : false,
      createdAt: existing ? existing.createdAt : stamp,
      updatedAt: stamp
    };
    nextFlows.push(flow);
    flowByName.set(key, flow);
    nextFlowOrderByGroup.set(group.id, order);
  });

  const nextTasks: Task[] = [];
  const maxTaskOrderByFlow = new Map<string, number>();
  rows.forEach((row) => {
    const group = groupByName.get(normalizeImportName(row.groupName)) as Group;
    const flow = row.flowName
      ? flowByName.get(importFlowKey(row.groupName, row.flowName)) || null
      : null;
    const queue = existingTaskQueues.get(
      taskImportKey(row.groupName, row.flowName, row.taskName)
    );
    const existing = queue && queue.length ? (queue.shift() as Task) : null;
    const recurrence = importedRecurrenceState(row, existing);
    let flowOrder: number | null = null;
    if (flow) {
      flowOrder = row.flowOrder || (maxTaskOrderByFlow.get(flow.id) || 0) + 1;
      maxTaskOrderByFlow.set(
        flow.id,
        Math.max(maxTaskOrderByFlow.get(flow.id) || 0, flowOrder)
      );
    }
    nextTasks.push({
      id: existing ? existing.id : utils.uid("task"),
      groupId: group.id,
      flowId: flow ? flow.id : null,
      flowOrder,
      name: row.taskName,
      reportTo: canonicalSuggestion(data.tasks, "reportTo", row.reportTo),
      managedObject: canonicalSuggestion(data.tasks, "managedObject", row.managedObject),
      deliverable: row.deliverable,
      ddl: row.ddl,
      urgency: row.urgency || "medium",
      status: recurrence.status,
      completedAt: recurrence.completedAt,
      recurrenceCadence: recurrence.recurrenceCadence,
      recurrenceStart: recurrence.recurrenceStart,
      recurrenceEnd: recurrence.recurrenceEnd,
      recurrenceCompletions: recurrence.recurrenceCompletions,
      progressNote: row.progressNote,
      progressUpdatedAt: row.progressNote
        ? existing &&
          existing.progressNote === row.progressNote &&
          existing.progressUpdatedAt
          ? existing.progressUpdatedAt
          : stamp
        : null,
      createdAt: existing ? existing.createdAt : stamp,
      updatedAt: stamp
    });
  });

  data.groups = nextGroups;
  data.flows = nextFlows;
  data.tasks = nextTasks;
  const validGroupIds = new Set(nextGroups.map((group) => group.id));
  const validFlowIds = new Set(nextFlows.map((flow) => flow.id));
  const validTaskIds = new Set(nextTasks.map((task) => task.id));
  data.materials.forEach((material) => {
    const previousRelationCount =
      material.taskIds.length + material.flowIds.length + material.groupIds.length;
    material.taskIds = material.taskIds.filter((id) => validTaskIds.has(id));
    material.flowIds = material.flowIds.filter((id) => validFlowIds.has(id));
    material.groupIds = material.groupIds.filter((id) => validGroupIds.has(id));
    if (
      previousRelationCount !==
      material.taskIds.length + material.flowIds.length + material.groupIds.length
    ) {
      material.updatedAt = stamp;
    }
  });

  /* 剥除旧 document/deliverable 关联，再按行重挂 */
  nextTasks.forEach((task) => {
    data.materials.forEach((material) => {
      if (!["document", "deliverable"].includes(material.type)) return;
      const previousCount = material.taskIds.length;
      material.taskIds = material.taskIds.filter((id) => id !== task.id);
      if (material.taskIds.length !== previousCount) material.updatedAt = stamp;
    });
  });
  rows.forEach((row, index) => {
    const task = nextTasks[index];
    row.documentLinks.forEach((link) => {
      attachImportedMaterial(data, link, "document", task.id, stamp);
    });
    row.deliverableLinks.forEach((link) => {
      attachImportedMaterial(data, link, "deliverable", task.id, stamp);
    });
  });
}

/* 等价 app.js:4984 analyzeExcelRows：导入预览统计 */
export function analyzeTaskExcelImport(
  data: WeekflowData,
  rows: ParsedTaskRow[]
): TaskImportSummary {
  const existingGroups = new Set(
    data.groups.map((group) => normalizeImportName(group.name))
  );
  const existingFlows = new Set(
    data.flows.map((flow) => {
      const group = findGroup(data, flow.groupId);
      return importFlowKey(group ? group.name : "", flow.name);
    })
  );
  const fileGroups = new Set<string>();
  const fileFlows = new Set<string>();
  rows.forEach((row) => {
    fileGroups.add(normalizeImportName(row.groupName));
    if (row.flowName) fileFlows.add(importFlowKey(row.groupName, row.flowName));
  });
  return {
    taskCount: rows.length,
    groupCount: fileGroups.size,
    flowCount: fileFlows.size,
    newGroupCount: Array.from(fileGroups).filter((key) => !existingGroups.has(key)).length,
    newFlowCount: Array.from(fileFlows).filter((key) => !existingFlows.has(key)).length
  };
}

/* ------------------------- 资料库 Excel 导入 ------------------------ */

function normalizedPathParts(value: unknown): string[] {
  return String(value || "")
    .split("/")
    .map((part) => utils.normalizeText(part))
    .filter(Boolean);
}

function resolveGroupToken(data: WeekflowData, token: string): Group[] {
  const parts = normalizedPathParts(token);
  const name = parts[parts.length - 1] || "";
  return data.groups.filter((group) => utils.normalizeText(group.name) === name);
}

function resolveFlowToken(data: WeekflowData, token: string): Flow[] {
  const parts = normalizedPathParts(token);
  const flowName = parts[parts.length - 1] || "";
  const groupName = parts.length > 1 ? parts[parts.length - 2] : "";
  return data.flows.filter((flow) => {
    const group = findGroup(data, flow.groupId);
    return (
      utils.normalizeText(flow.name) === flowName &&
      (!groupName || Boolean(group && utils.normalizeText(group.name) === groupName))
    );
  });
}

function resolveTaskToken(data: WeekflowData, token: string): Task[] {
  const parts = normalizedPathParts(token);
  const taskName = parts[parts.length - 1] || "";
  const qualifierA = parts.length > 1 ? parts[parts.length - 2] : "";
  const qualifierB = parts.length > 2 ? parts[parts.length - 3] : "";
  return data.tasks.filter((task) => {
    if (utils.normalizeText(task.name) !== taskName) return false;
    const group = findGroup(data, task.groupId);
    const flow = findFlow(data, task.flowId);
    if (parts.length >= 3) {
      return Boolean(
        group &&
          flow &&
          utils.normalizeText(group.name) === qualifierB &&
          utils.normalizeText(flow.name) === qualifierA
      );
    }
    if (parts.length === 2) {
      return Boolean(
        (group && utils.normalizeText(group.name) === qualifierA) ||
          (flow && utils.normalizeText(flow.name) === qualifierA)
      );
    }
    return true;
  });
}

/* 等价 app.js:4650 resolveMaterialImportRow + 4710 renderMaterialImportDialog 的数据部分：
   名称 → id 解析、compactMaterialRelations 压缩、文件内/既有重复地址检测。 */
export function prepareMaterialImport(
  data: WeekflowData,
  rows: ParsedMaterialRow[]
): MaterialImportPreview {
  const errors: string[] = [];
  const resolved = rows.map((row) => {
    const rowErrors: string[] = [];
    function resolveTokens(
      tokens: string[],
      resolver: (token: string) => Array<{ id: string }>,
      label: string
    ): string[] {
      const ids: string[] = [];
      tokens.forEach((token) => {
        const matches = resolver(token);
        if (!matches.length) {
          rowErrors.push(label + "「" + token + "」不存在");
        } else if (matches.length > 1) {
          rowErrors.push(label + "「" + token + "」存在重名，请使用完整层级路径");
        } else if (!ids.includes(matches[0].id)) {
          ids.push(matches[0].id);
        }
      });
      return ids;
    }
    const taskIds = resolveTokens(
      row.taskNames,
      (token) => resolveTaskToken(data, token),
      "Task"
    );
    const flowIds = resolveTokens(
      row.flowNames,
      (token) => resolveFlowToken(data, token),
      "Flow"
    );
    const groupIds = resolveTokens(
      row.groupNames,
      (token) => resolveGroupToken(data, token),
      "分组"
    );
    const compact = compactMaterialRelations(data, taskIds, flowIds, groupIds);
    return {
      sourceRow: row.sourceRow,
      errors: rowErrors,
      value: {
        title: row.title,
        url: row.url,
        type: row.type,
        taskIds: compact.taskIds,
        flowIds: compact.flowIds,
        groupIds: compact.groupIds,
        note: row.note
      }
    };
  });
  const seenUploadUrls = new Map<string, number>();
  resolved.forEach((row) => {
    row.errors.forEach((message) => {
      errors.push("第 " + row.sourceRow + " 行：" + message);
    });
    const key = utils.materialUrlKey(row.value.url);
    if (seenUploadUrls.has(key)) {
      errors.push(
        "第 " + row.sourceRow + " 行：链接地址与第 " + seenUploadUrls.get(key) + " 行重复"
      );
    } else {
      seenUploadUrls.set(key, row.sourceRow);
    }
  });
  if (!resolved.length && !errors.length) {
    errors.push("文件中没有可导入的资料。");
  }
  const existingByUrl = new Map<string, Material>();
  data.materials.forEach((material) => {
    const key = utils.materialUrlKey(material.url);
    if (!existingByUrl.has(key)) existingByUrl.set(key, material);
  });
  const importRows: ResolvedMaterialImportRow[] = resolved.map((row) => {
    const existing = existingByUrl.get(utils.materialUrlKey(row.value.url));
    return Object.assign({}, row.value, {
      sourceRow: row.sourceRow,
      duplicateId: existing ? existing.id : null
    });
  });
  return {
    rows: importRows,
    errors,
    duplicateCount: importRows.filter((row) => row.duplicateId).length
  };
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export interface DataStoreState {
  data: WeekflowData | null;
  loading: boolean;

  /* 防重入锁（UI 可据此禁用按钮） */
  isSavingTask: boolean;
  isExporting: boolean;
  isExportingPersonStatus: boolean;
  isImportingExcel: boolean;
  isImportingMaterials: boolean;

  /** 启动加载：loadData → syncRecurringTaskStates → 有变化再保存 → warning toast */
  load(): Promise<void>;

  /* Task */
  saveTask(input: SaveTaskInput): Promise<boolean>;
  deleteTask(id: string): Promise<boolean>;
  toggleTaskCompleted(id: string, now?: Date): Promise<boolean>;

  /* 分组 */
  saveGroup(input: SaveGroupInput): Promise<ActionResult>;
  /** 仅空分组直接删除（含空 Flow）；有 Task 的分组请走 deleteGroup 弹窗 */
  deleteGroup(id: string): Promise<boolean>;
  moveTasksAndDeleteGroup(id: string, targetId: string): Promise<boolean>;
  deleteGroupWithTasks(id: string): Promise<boolean>;

  /* Flow */
  saveFlow(input: SaveFlowInput): Promise<ActionResult>;
  deleteFlow(id: string): Promise<boolean>;

  /* 折叠 */
  toggleGroupCollapsed(id: string): Promise<boolean>;
  toggleFlowCollapsed(id: string): Promise<boolean>;
  setAllCollapsed(collapsed: boolean): Promise<boolean>;

  /* 进度记录 */
  saveProgressNote(taskId: string, note: string): Promise<boolean>;

  /* 资料 */
  saveMaterial(input: SaveMaterialInput): Promise<boolean>;
  deleteMaterial(id: string): Promise<boolean>;
  deleteMaterials(ids: string[]): Promise<boolean>;
  /** 记录打开次数并静默保存（无成功 toast） */
  recordMaterialOpen(id: string): Promise<boolean>;
  /** 资料管理弹窗保存：整组 reconcile 某 Task 的资料关联 */
  saveTaskMaterials(taskId: string, drafts: MaterialDraft[]): Promise<boolean>;

  /* Excel 导入 */
  applyTaskExcelImport(rows: ParsedTaskRow[], mode: "append" | "replace"): Promise<boolean>;
  applyMaterialExcelImport(
    rows: ResolvedMaterialImportRow[],
    mode: "append" | "replace",
    duplicateMode: "replace" | "skip"
  ): Promise<MaterialImportCounts | null>;

  /* JSON 备份 */
  exportJsonBackup(): Promise<boolean>;
  importJsonBackup(jsonText: string): Promise<boolean>;

  /* 人员建议 */
  getPersonSuggestions(field: PersonField): string[];
  canonicalTaskSuggestionValue(field: PersonField, value: string): string;
}

export const useDataStore = create<DataStoreState>()((set, get) => {
  const toast = (message: string, type?: "success" | "error" | "warning"): void => {
    useUiStore.getState().pushToast(message, type);
  };

  /* 统一变更管线（等价 app.js:658 persistAndRender 的持久化部分） */
  async function persist(message?: string): Promise<boolean> {
    const data = get().data;
    if (!data) return false;
    automation.syncRecurringTaskStates(data, new Date());
    const checked = schema.validateData(data);
    if (!checked.ok) {
      toast("保存失败：" + checked.errors.join("\n"), "error");
      return false;
    }
    const normalized = checked.data;
    set({ data: normalized });
    try {
      const saved = await window.weekflow.saveData(normalized);
      if (!saved.ok) {
        toast("保存失败：" + (saved.error || "未知错误"), "error");
        return false;
      }
    } catch (error) {
      toast("保存失败：" + errorMessage(error), "error");
      return false;
    }
    useUiStore.getState().sanitize(normalized);
    if (message) toast(message);
    return true;
  }

  return {
    data: null,
    loading: false,
    isSavingTask: false,
    isExporting: false,
    isExportingPersonStatus: false,
    isImportingExcel: false,
    isImportingMaterials: false,

    async load() {
      set({ loading: true });
      let result;
      try {
        result = await window.weekflow.loadData();
      } catch (error) {
        set({ loading: false });
        toast("加载失败：" + errorMessage(error), "error");
        return;
      }
      if (!result.ok || !result.data) {
        set({ loading: false });
        toast("加载失败：" + (result.error || "未知错误"), "error");
        return;
      }
      const data = result.data;
      const sync = automation.syncRecurringTaskStates(data, new Date());
      set({ data, loading: false });
      if (sync.changed) {
        try {
          const saved = await window.weekflow.saveData(data);
          if (!saved.ok) toast("保存失败：" + (saved.error || "未知错误"), "error");
        } catch (error) {
          toast("保存失败：" + errorMessage(error), "error");
        }
      }
      if (result.warning) toast(result.warning, "warning");
    },

    /* 等价 app.js:3997 saveTaskFromForm 的数据部分 */
    async saveTask(input) {
      const state = get();
      const data = state.data;
      if (!data || state.isSavingTask) return false;
      set({ isSavingTask: true });
      try {
        const stamp = new Date().toISOString();
        const existing = input.id ? findTask(data, input.id) || null : null;
        const isRecurring = automation.isCadence(input.recurrenceCadence);
        const cadence: RecurrenceCadence = isRecurring ? input.recurrenceCadence : "none";
        const flowId = input.flowId || null;

        let flowOrder: number | null = null;
        if (flowId) {
          if (existing && existing.flowId === flowId && existing.flowOrder) {
            flowOrder = existing.flowOrder;
          } else {
            const existingOrders = data.tasks
              .filter(
                (item) => item.flowId === flowId && (!existing || item.id !== existing.id)
              )
              .map((item) => Number(item.flowOrder || 0));
            flowOrder = existingOrders.length ? Math.max(...existingOrders) + 1 : 1;
          }
        }

        const status: TaskStatus =
          !isRecurring && input.status === "completed" ? "completed" : "pending";
        const schedule = {
          ddl: input.ddl,
          recurrenceCadence: cadence,
          recurrenceStart: isRecurring ? input.recurrenceStart : null,
          recurrenceEnd: isRecurring ? input.recurrenceEnd : null
        };
        const task: Task = {
          id: existing ? existing.id : utils.uid("task"),
          groupId: input.groupId,
          flowId,
          flowOrder,
          name: input.name,
          reportTo: get().canonicalTaskSuggestionValue("reportTo", input.reportTo),
          managedObject: get().canonicalTaskSuggestionValue(
            "managedObject",
            input.managedObject
          ),
          deliverable: input.deliverable,
          ddl: input.ddl,
          urgency: input.urgency,
          status,
          completedAt:
            status === "completed" ? input.completedAt || dates.todayISO() : null,
          recurrenceCadence: cadence,
          recurrenceStart: schedule.recurrenceStart,
          recurrenceEnd: schedule.recurrenceEnd,
          recurrenceCompletions: retainRecurringCompletions(existing, schedule),
          progressNote: existing ? existing.progressNote : "",
          progressUpdatedAt: existing ? existing.progressUpdatedAt : null,
          createdAt: existing ? existing.createdAt : stamp,
          updatedAt: stamp
        };
        if (existing) {
          const index = data.tasks.findIndex((item) => item.id === existing.id);
          data.tasks[index] = task;
        } else {
          data.tasks.push(task);
        }
        if (input.materials) {
          reconcileTaskMaterials(data, task.id, input.materials, stamp);
        }
        return await persist(existing ? "Task 已更新" : "Task 已创建");
      } finally {
        set({ isSavingTask: false });
      }
    },

    /* 等价 app.js:4189 requestDeleteCurrentTask 的数据部分 */
    async deleteTask(id) {
      const data = get().data;
      if (!data) return false;
      data.tasks = data.tasks.filter((item) => item.id !== id);
      data.materials.forEach((material) => {
        material.taskIds = material.taskIds.filter((taskId) => taskId !== id);
      });
      return persist("Task 已删除");
    },

    /* 等价 app.js:1932 toggleTaskCompleted */
    async toggleTaskCompleted(id, now) {
      const data = get().data;
      if (!data) return false;
      const task = findTask(data, id);
      if (!task) return false;
      const nowDate = now instanceof Date ? now : new Date();
      const recurring = dates.isRecurringTask(task);
      let target: boolean;
      if (recurring) {
        target = !dates.getTaskPeriodState(task, nowDate).completed;
        const result = automation.setCurrentPeriodCompleted(task, target, nowDate);
        if (!result.changed) {
          toast("当前不在该周期 Task 的可确认范围内", "warning");
          return false;
        }
      } else {
        target = task.status !== "completed";
        task.status = target ? "completed" : "pending";
        task.completedAt = target ? dates.todayISO(nowDate) : null;
      }
      task.updatedAt = new Date().toISOString();
      return persist(
        recurring
          ? target
            ? "本期 DDL 已确认完成"
            : "本期 DDL 已恢复为未完成"
          : target
            ? "Task 已标记完成"
            : "Task 已恢复为未完成"
      );
    },

    /* 等价 app.js:3007 saveGroupFromForm 的数据部分（重名拦截返回 error，不 toast） */
    async saveGroup(input) {
      const data = get().data;
      if (!data) return { ok: false };
      const name = input.name.trim();
      const duplicate = data.groups.some(
        (group) =>
          group.id !== input.id &&
          group.name.toLocaleLowerCase() === name.toLocaleLowerCase()
      );
      if (duplicate) {
        return { ok: false, error: "已有同名分组，请使用其他名称。" };
      }
      const stamp = new Date().toISOString();
      const existing = input.id ? findGroup(data, input.id) : undefined;
      if (input.id && !existing) return { ok: false };
      if (existing) {
        existing.name = name;
        existing.color = (input.color || existing.color).toUpperCase();
        existing.updatedAt = stamp;
      } else {
        data.groups.push({
          id: utils.uid("group"),
          name,
          color: (input.color || schema.nextGroupColor(data.groups)).toUpperCase(),
          order: data.groups.length
            ? Math.max(...data.groups.map((group) => Number(group.order || 0))) + 1
            : 1,
          collapsed: false,
          createdAt: stamp,
          updatedAt: stamp
        });
      }
      const saved = await persist(input.id ? "分组已更新" : "分组已创建");
      return { ok: saved };
    },

    /* 等价 app.js:3391 requestDeleteCurrentGroup 的空分组分支 */
    async deleteGroup(id) {
      const data = get().data;
      if (!data) return false;
      const group = findGroup(data, id);
      if (!group) return false;
      const hasTasks = data.tasks.some((task) => task.groupId === id);
      if (hasTasks) return false;
      data.groups = data.groups.filter((item) => item.id !== id);
      const removedFlowIds = new Set(
        data.flows.filter((flow) => flow.groupId === id).map((flow) => flow.id)
      );
      data.flows = data.flows.filter((flow) => flow.groupId !== id);
      data.materials.forEach((material) => {
        material.groupIds = material.groupIds.filter((groupId) => groupId !== id);
        material.flowIds = material.flowIds.filter((flowId) => !removedFlowIds.has(flowId));
      });
      return persist("分组已删除");
    },

    /* 等价 app.js:3462 moveTasksAndDeleteGroup 的数据部分 */
    async moveTasksAndDeleteGroup(id, targetId) {
      const data = get().data;
      if (!data) return false;
      const group = findGroup(data, id);
      const target = findGroup(data, targetId);
      if (!group || !target) {
        toast("无法移动 Task 与 Flow：目标分组不存在。", "error");
        return false;
      }
      const stamp = new Date().toISOString();
      data.tasks.forEach((task) => {
        if (task.groupId === id) {
          task.groupId = targetId;
          task.updatedAt = stamp;
        }
      });
      const targetFlowOrders = data.flows
        .filter((flow) => flow.groupId === targetId)
        .map((flow) => Number(flow.order || 0));
      let nextTargetFlowOrder = targetFlowOrders.length
        ? Math.max(...targetFlowOrders) + 1
        : 1;
      data.flows
        .filter((flow) => flow.groupId === id)
        .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
        .forEach((flow) => {
          flow.name = uniqueFlowNameForGroup(data, flow.name, targetId, flow.id, group.name);
          flow.groupId = targetId;
          flow.order = nextTargetFlowOrder;
          nextTargetFlowOrder += 1;
          flow.updatedAt = stamp;
        });
      data.groups = data.groups.filter((item) => item.id !== id);
      data.materials.forEach((material) => {
        material.groupIds = materialTools.uniqueIds(
          material.groupIds.map((groupId) => (groupId === id ? targetId : groupId))
        );
      });
      return persist("Task 与 Flow 已移动，原分组已删除");
    },

    /* 等价 app.js:3550 deleteGroupWithTasks 的数据部分 */
    async deleteGroupWithTasks(id) {
      const data = get().data;
      if (!data) return false;
      if (!findGroup(data, id)) return false;
      const removedTaskIds = new Set(
        data.tasks.filter((task) => task.groupId === id).map((task) => task.id)
      );
      const removedFlowIds = new Set(
        data.flows.filter((flow) => flow.groupId === id).map((flow) => flow.id)
      );
      data.tasks = data.tasks.filter((task) => task.groupId !== id);
      data.groups = data.groups.filter((item) => item.id !== id);
      data.flows = data.flows.filter((flow) => flow.groupId !== id);
      data.materials.forEach((material) => {
        material.taskIds = material.taskIds.filter((taskId) => !removedTaskIds.has(taskId));
        material.flowIds = material.flowIds.filter((flowId) => !removedFlowIds.has(flowId));
        material.groupIds = material.groupIds.filter((groupId) => groupId !== id);
      });
      return persist("分组及其中 Flow、Task 已删除");
    },

    /* 等价 app.js:3257 saveFlowFromForm 的数据部分（重名拦截返回 error，不 toast） */
    async saveFlow(input) {
      const data = get().data;
      if (!data) return { ok: false };
      const name = input.name.trim();
      const duplicate = data.flows.some(
        (flow) =>
          flow.id !== input.id &&
          flow.groupId === input.groupId &&
          flow.name.toLocaleLowerCase() === name.toLocaleLowerCase()
      );
      if (duplicate) {
        return { ok: false, error: "该分组中已有同名 Flow。" };
      }
      const stamp = new Date().toISOString();
      let flow = input.id ? findFlow(data, input.id) || null : null;
      if (input.id && !flow) {
        toast("Flow 不存在，无法保存。", "error");
        return { ok: false, error: "Flow 不存在，无法保存。" };
      }
      if (flow) {
        const groupChanged = flow.groupId !== input.groupId;
        flow.name = name;
        flow.groupId = input.groupId;
        flow.color = (input.color || flow.color).toUpperCase();
        if (groupChanged) {
          const targetOrders = data.flows
            .filter((item) => item.id !== (flow as Flow).id && item.groupId === input.groupId)
            .map((item) => Number(item.order || 0));
          flow.order = targetOrders.length ? Math.max(...targetOrders) + 1 : 1;
        }
        flow.updatedAt = stamp;
      } else {
        const group = findGroup(data, input.groupId);
        const siblingOrders = data.flows
          .filter((item) => item.groupId === input.groupId)
          .map((item) => Number(item.order || 0));
        flow = {
          id: utils.uid("flow"),
          groupId: input.groupId,
          name,
          color: (input.color || (group && group.color) || schema.COLORS[0]).toUpperCase(),
          order: siblingOrders.length ? Math.max(...siblingOrders) + 1 : 1,
          collapsed: false,
          createdAt: stamp,
          updatedAt: stamp
        };
        data.flows.push(flow);
      }
      const flowId = flow.id;
      (input.orderedTaskIds || []).forEach((taskId, index) => {
        const task = findTask(data, taskId);
        if (!task || task.flowId !== flowId) return;
        task.groupId = input.groupId;
        task.flowOrder = index + 1;
        task.updatedAt = stamp;
      });
      data.tasks.forEach((task) => {
        if (task.flowId === flowId) {
          task.groupId = input.groupId;
          task.updatedAt = stamp;
        }
      });
      const saved = await persist(input.id ? "Flow 已更新" : "Flow 已创建");
      return { ok: saved };
    },

    /* 等价 app.js:3357 requestDeleteCurrentFlow 的数据部分 */
    async deleteFlow(id) {
      const data = get().data;
      if (!data) return false;
      const stamp = new Date().toISOString();
      data.tasks.forEach((task) => {
        if (task.flowId === id) {
          task.flowId = null;
          task.flowOrder = null;
          task.updatedAt = stamp;
        }
      });
      data.flows = data.flows.filter((item) => item.id !== id);
      data.materials.forEach((material) => {
        material.flowIds = material.flowIds.filter((flowId) => flowId !== id);
      });
      return persist("Flow 已删除，原步骤已保留为普通 Task");
    },

    /* 等价 app.js:1886 toggleGroupCollapsed */
    async toggleGroupCollapsed(id) {
      const data = get().data;
      if (!data) return false;
      const group = findGroup(data, id);
      if (!group) return false;
      group.collapsed = !group.collapsed;
      group.updatedAt = new Date().toISOString();
      return persist();
    },

    /* 等价 app.js:1894 toggleFlowCollapsed */
    async toggleFlowCollapsed(id) {
      const data = get().data;
      if (!data) return false;
      const flow = findFlow(data, id);
      if (!flow) return false;
      flow.collapsed = !flow.collapsed;
      flow.updatedAt = new Date().toISOString();
      return persist();
    },

    /* 等价 app.js:1902 setAllGroupsCollapsed */
    async setAllCollapsed(collapsed) {
      const data = get().data;
      if (!data) return false;
      if (!data.groups.length) {
        toast("当前没有可" + (collapsed ? "折叠" : "展开") + "的分组", "warning");
        return false;
      }
      let changed = false;
      const stamp = new Date().toISOString();
      data.groups.forEach((group) => {
        if (group.collapsed !== collapsed) {
          group.collapsed = collapsed;
          group.updatedAt = stamp;
          changed = true;
        }
      });
      data.flows.forEach((flow) => {
        if (flow.collapsed !== collapsed) {
          flow.collapsed = collapsed;
          flow.updatedAt = stamp;
          changed = true;
        }
      });
      if (!changed) {
        toast(collapsed ? "所有分组与 Flow 已是折叠状态" : "所有分组与 Flow 已是展开状态");
        return false;
      }
      return persist(collapsed ? "已折叠全部分组与 Flow" : "已展开全部分组与 Flow");
    },

    /* 等价 app.js:4248 saveProgressNote */
    async saveProgressNote(taskId, note) {
      const data = get().data;
      if (!data) return false;
      const task = findTask(data, taskId);
      if (!task) {
        toast("Task 不存在，无法保存进度记录。", "error");
        return false;
      }
      const stamp = new Date().toISOString();
      const trimmed = note.trim().slice(0, 4000);
      task.progressNote = trimmed;
      task.progressUpdatedAt = trimmed ? stamp : null;
      task.updatedAt = stamp;
      return persist(trimmed ? "进度记录已保存" : "进度记录已清空");
    },

    /* 等价 app.js:4529 saveMaterialFromForm 的数据部分 */
    async saveMaterial(input) {
      const data = get().data;
      if (!data) return false;
      const stamp = new Date().toISOString();
      const existing = input.id ? findMaterial(data, input.id) : undefined;
      if (input.id && !existing) return false;
      const compact = compactMaterialRelations(
        data,
        input.taskIds,
        input.flowIds,
        input.groupIds
      );
      const material = materialTools.normalizeMaterial({
        id: existing ? existing.id : utils.uid("material"),
        title: input.title,
        url: input.url,
        type: input.type,
        taskIds: compact.taskIds,
        flowIds: compact.flowIds,
        groupIds: compact.groupIds,
        note: input.note,
        openEvents: existing ? existing.openEvents : [],
        createdAt: existing ? existing.createdAt : stamp,
        updatedAt: stamp
      });
      if (existing) {
        data.materials[data.materials.indexOf(existing)] = material;
      } else {
        data.materials.push(material);
      }
      return persist(existing ? "资料已更新并同步到时间轴" : "资料已添加");
    },

    /* 等价 app.js:4580 deleteCurrentMaterial 的数据部分 */
    async deleteMaterial(id) {
      const data = get().data;
      if (!data) return false;
      data.materials = data.materials.filter((item) => item.id !== id);
      return persist("资料已删除");
    },

    /* 等价 app.js:2857 deleteSelectedMaterials 的数据部分 */
    async deleteMaterials(ids) {
      const data = get().data;
      if (!data || !ids.length) return false;
      const idSet = new Set(ids);
      data.materials = data.materials.filter((material) => !idSet.has(material.id));
      useUiStore.getState().clearSelectedMaterials();
      return persist("已删除 " + ids.length + " 条资料");
    },

    /* 等价 app.js:2876 openMaterialLink 的持久化部分（静默保存，无成功 toast） */
    async recordMaterialOpen(id) {
      const data = get().data;
      if (!data) return false;
      const material = findMaterial(data, id);
      if (!material) return false;
      materialTools.recordOpen(material, new Date());
      return persist();
    },

    /* 等价 app.js:4312 saveManagedLinks 的数据部分 */
    async saveTaskMaterials(taskId, drafts) {
      const data = get().data;
      if (!data) return false;
      const task = findTask(data, taskId);
      if (!task) {
        toast("Task 不存在，无法保存资料。", "error");
        return false;
      }
      const stamp = new Date().toISOString();
      reconcileTaskMaterials(data, task.id, drafts, stamp);
      task.updatedAt = stamp;
      return persist("相关资料已保存并同步到资料库");
    },

    /* 等价 app.js:5597 confirmExcelImport 的数据部分（含 append/replace 两种模式） */
    async applyTaskExcelImport(rows, mode) {
      const state = get();
      const data = state.data;
      if (!data || state.isImportingExcel || !rows.length) return false;
      set({ isImportingExcel: true });
      const backup = utils.clone(data);
      try {
        if (mode === "replace") {
          replaceExcelRows(data, rows);
        } else {
          appendExcelRows(data, rows);
        }
        const message =
          mode === "replace"
            ? "已完整覆盖时间轴，共导入 " + rows.length + " 条 Task"
            : "已补充导入 " + rows.length + " 条 Task";
        const saved = await persist(message);
        if (!saved) {
          set({ data: backup });
          return false;
        }
        const ui = useUiStore.getState();
        ui.resetFilters();
        useUiStore.setState({ timelineMode: "all" });
        ui.switchView("timeline");
        return true;
      } catch (error) {
        set({ data: backup });
        toast("Excel 导入失败：" + errorMessage(error), "error");
        return false;
      } finally {
        set({ isImportingExcel: false });
      }
    },

    /* 等价 app.js:4859 confirmMaterialImport 的数据部分 */
    async applyMaterialExcelImport(rows, mode, duplicateMode) {
      const state = get();
      const data = state.data;
      if (!data || state.isImportingMaterials || !rows.length) return null;
      set({ isImportingMaterials: true });
      const stamp = new Date().toISOString();
      const backup = utils.clone(data);
      const counts: MaterialImportCounts = { added: 0, replaced: 0, skipped: 0 };
      try {
        if (mode === "replace") {
          data.materials = [];
          useUiStore.getState().clearSelectedMaterials();
        }
        rows.forEach((row) => {
          const duplicate =
            mode === "append" && row.duplicateId
              ? findMaterial(data, row.duplicateId) || null
              : null;
          if (duplicate && duplicateMode === "skip") {
            counts.skipped += 1;
            return;
          }
          const details = {
            title: row.title,
            url: row.url,
            type: row.type,
            taskIds: row.taskIds,
            flowIds: row.flowIds,
            groupIds: row.groupIds,
            note: row.note
          };
          if (duplicate) {
            const replacement = materialTools.makeMaterial(
              Object.assign({}, details, {
                id: duplicate.id,
                openEvents: duplicate.openEvents,
                createdAt: duplicate.createdAt,
                updatedAt: stamp
              }),
              stamp
            );
            data.materials[data.materials.indexOf(duplicate)] = replacement;
            counts.replaced += 1;
          } else {
            data.materials.push(
              materialTools.makeMaterial(
                Object.assign({}, details, {
                  id: utils.uid("material"),
                  createdAt: stamp,
                  updatedAt: stamp
                }),
                stamp
              )
            );
            counts.added += 1;
          }
        });
        const message =
          mode === "replace"
            ? "已全部覆盖资料库，共导入 " + counts.added + " 条资料"
            : "资料导入完成：新增 " +
              counts.added +
              " 条，替换 " +
              counts.replaced +
              " 条，跳过 " +
              counts.skipped +
              " 条";
        const saved = await persist(message);
        if (!saved) {
          set({ data: backup });
          return null;
        }
        useUiStore.getState().switchView("materials");
        return counts;
      } catch (error) {
        set({ data: backup });
        toast("Excel 导入失败：" + errorMessage(error), "error");
        return null;
      } finally {
        set({ isImportingMaterials: false });
      }
    },

    /* JSON 备份导出（原 app.js:5754；toast 按新契约带文件名） */
    async exportJsonBackup() {
      const data = get().data;
      if (!data) return false;
      const filename = "Task数据备份_" + dates.dateTimeStamp(new Date()) + ".json";
      try {
        const result = await window.weekflow.saveFileWithDialog({
          defaultPath: filename,
          filters: [{ name: "JSON 备份", extensions: ["json"] }],
          data: JSON.stringify(data, null, 2)
        });
        if (result.ok) {
          toast("JSON 备份已导出：" + filename);
          return true;
        }
        if (!result.canceled) {
          toast("备份导出失败：" + (result.error || "未知错误"), "error");
        }
        return false;
      } catch (error) {
        toast("备份导出失败：" + errorMessage(error), "error");
        return false;
      }
    },

    /* JSON 备份恢复（原 app.js:5771 importJsonFile 的数据部分；确认框在 UI 层） */
    async importJsonBackup(jsonText) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch (error) {
        toast("导入失败：" + errorMessage(error), "error");
        return false;
      }
      const checked = schema.validateData(parsed);
      if (!checked.ok) {
        toast("导入失败：" + checked.errors.slice(0, 6).join("；"), "error");
        return false;
      }
      set({ data: checked.data });
      const saved = await persist("数据已从 JSON 恢复");
      if (saved) useUiStore.setState({ timelineMode: "all" });
      return saved;
    },

    getPersonSuggestions(field) {
      const data = get().data;
      return collectSuggestionValues(data ? data.tasks : [], field);
    },

    canonicalTaskSuggestionValue(field, value) {
      const data = get().data;
      return canonicalSuggestion(data ? data.tasks : [], field, value);
    }
  };
});
