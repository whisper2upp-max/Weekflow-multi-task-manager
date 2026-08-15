/* 筛选、排序与统计的纯函数。等价原 js/stats.js。 */
import type { Flow, Group, Summary, Task, TaskFilters } from "./types";
import * as dates from "./date-utils";
import { progressSearchText } from "./rich-text";

function normalized(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

export type TaskFieldName = "managedObject" | "reportTo";
export type GroupSummary = Summary & { group: Group };
export type FlowSummary = Summary & { flow: Flow; group: Group | null };
export type TaskFieldSummary = Summary & { value: string; label: string };

export function filterTasks(
  tasks: Task[] | null | undefined,
  filters: Partial<TaskFilters> | null | undefined,
  today?: Date | string,
  flows?: Flow[] | null
): Task[] {
  const source = Array.isArray(tasks) ? tasks : [];
  const active = filters || {};
  const query = normalized(active.search);
  const groupIds = Array.isArray(active.groupIds) ? active.groupIds : [];
  const flowId = active.flowId || "all";
  const flowMap = new Map(
    (Array.isArray(flows) ? flows : []).map(function (flow) {
      return [flow.id, flow] as [string, Flow];
    })
  );

  return source.filter(function (task) {
    if (groupIds.length && !groupIds.includes(task.groupId)) return false;
    if (flowId === "none" && task.flowId) return false;
    if (flowId !== "all" && flowId !== "none" && task.flowId !== flowId) return false;
    if (active.status && active.status !== "all" && task.status !== active.status) return false;
    if (active.urgency && active.urgency !== "all" && task.urgency !== active.urgency) {
      return false;
    }
    if (active.overdueOnly && !dates.isOverdue(task, today)) return false;
    if (query) {
      const haystack = [
        task.name,
        task.reportTo,
        task.managedObject,
        task.deliverable,
        task.progressNote,
        progressSearchText(task),
        task.flowId ? flowMap.get(task.flowId)?.name || "" : ""
      ]
        .map(normalized)
        .join(" ");
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function sortTasks(tasks: Task[] | null | undefined, today?: Date | string): Task[] {
  return (Array.isArray(tasks) ? tasks.slice() : []).sort(function (left, right) {
    const leftCompleted = left.status === "completed" ? 1 : 0;
    const rightCompleted = right.status === "completed" ? 1 : 0;
    if (leftCompleted !== rightCompleted) return leftCompleted - rightCompleted;

    const leftOverdue = dates.isOverdue(left, today) ? 0 : 1;
    const rightOverdue = dates.isOverdue(right, today) ? 0 : 1;
    if (leftOverdue !== rightOverdue) return leftOverdue - rightOverdue;

    const leftDdl = dates.taskEffectiveDdl(left, today);
    const rightDdl = dates.taskEffectiveDdl(right, today);
    if (leftDdl !== rightDdl) return String(leftDdl).localeCompare(String(rightDdl));
    return String(left.name).localeCompare(String(right.name), "zh-CN");
  });
}

export function sortFlowTasks(
  tasks: Task[] | null | undefined,
  today?: Date | string
): Task[] {
  return (Array.isArray(tasks) ? tasks.slice() : []).sort(function (left, right) {
    const leftOrder = Number.isFinite(Number(left.flowOrder))
      ? Number(left.flowOrder)
      : Number.MAX_SAFE_INTEGER;
    const rightOrder = Number.isFinite(Number(right.flowOrder))
      ? Number(right.flowOrder)
      : Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    const leftDdl = dates.taskEffectiveDdl(left, today);
    const rightDdl = dates.taskEffectiveDdl(right, today);
    if (leftDdl !== rightDdl) return String(leftDdl).localeCompare(String(rightDdl));
    const nameDifference = String(left.name).localeCompare(String(right.name), "zh-CN");
    return nameDifference || String(left.id || "").localeCompare(String(right.id || ""));
  });
}

export function summarize(tasks: Task[] | null | undefined, today?: Date | string): Summary {
  const source = Array.isArray(tasks) ? tasks : [];
  const completed = source.filter(function (task) {
    return task.status === "completed";
  }).length;
  const overdue = source.filter(function (task) {
    return dates.isOverdue(task, today);
  }).length;
  return {
    total: source.length,
    completed: completed,
    pending: source.length - completed,
    overdue: overdue,
    completionRate: dates.completionRate(completed, source.length)
  };
}

export function summarizeByGroup(
  groups: Group[] | null | undefined,
  tasks: Task[] | null | undefined,
  today?: Date | string
): GroupSummary[] {
  const sourceGroups = Array.isArray(groups) ? groups : [];
  const sourceTasks = Array.isArray(tasks) ? tasks : [];
  return sourceGroups
    .slice()
    .sort(function (a, b) {
      return Number(a.order || 0) - Number(b.order || 0);
    })
    .map(function (group) {
      const result = summarize(
        sourceTasks.filter(function (task) {
          return task.groupId === group.id;
        }),
        today
      );
      return Object.assign({ group: group }, result);
    });
}

export function summarizeByFlow(
  flows: Flow[] | null | undefined,
  groups: Group[] | null | undefined,
  tasks: Task[] | null | undefined,
  today?: Date | string
): FlowSummary[] {
  const sourceFlows = Array.isArray(flows) ? flows : [];
  const sourceGroups = Array.isArray(groups) ? groups : [];
  const sourceTasks = Array.isArray(tasks) ? tasks : [];
  const groupMap = new Map(
    sourceGroups.map(function (group) {
      return [group.id, group] as [string, Group];
    })
  );
  const groupOrder = new Map(
    sourceGroups.map(function (group) {
      return [group.id, Number(group.order || 0)] as [string, number];
    })
  );
  return sourceFlows
    .slice()
    .sort(function (left, right) {
      const groupDifference =
        (groupOrder.get(left.groupId) || 0) - (groupOrder.get(right.groupId) || 0);
      if (groupDifference) return groupDifference;
      return Number(left.order || 0) - Number(right.order || 0);
    })
    .map(function (flow) {
      const result = summarize(
        sourceTasks.filter(function (task) {
          return task.flowId === flow.id;
        }),
        today
      );
      return Object.assign(
        {
          flow: flow,
          group: groupMap.get(flow.groupId) || null
        },
        result
      );
    });
}

export function summarizeByTaskField(
  tasks: Task[] | null | undefined,
  field: string,
  today?: Date | string,
  emptyLabel?: string
): TaskFieldSummary[] {
  if (!["managedObject", "reportTo"].includes(field)) return [];
  const key = field as TaskFieldName;
  const buckets = new Map<string, Task[]>();
  (Array.isArray(tasks) ? tasks : []).forEach(function (task) {
    const value = String((task && task[key]) || "").trim();
    if (!buckets.has(value)) buckets.set(value, []);
    (buckets.get(value) as Task[]).push(task);
  });
  return Array.from(buckets.entries())
    .sort(function (left, right) {
      if (!left[0] && right[0]) return 1;
      if (left[0] && !right[0]) return -1;
      return left[0].localeCompare(right[0], "zh-CN");
    })
    .map(function (entry) {
      return Object.assign(
        {
          value: entry[0],
          label: entry[0] || emptyLabel || "未填写"
        },
        summarize(entry[1], today)
      );
    });
}
