/* Weekflow 资料实体、关联解析与自然周常用统计。等价原 js/materials.js（i18n 固定为中文）。 */
import type { Flow, Group, Material, MaterialType, Task } from "./types";
import { uid } from "./utils";

export const TYPES: MaterialType[] = ["document", "deliverable", "control", "folder"];
export const TYPE_LABELS: Record<MaterialType, string> = {
  document: "说明文档",
  deliverable: "交付物",
  control: "控制表",
  folder: "文件夹"
};

export function getTypeLabels(): Record<MaterialType, string> {
  return Object.assign({}, TYPE_LABELS);
}

export function typeLabel(type: string): string {
  const labels = getTypeLabels();
  return labels[type as MaterialType] || type;
}

export const TYPE_ALIASES: Record<string, MaterialType> = {
  document: "document",
  doc: "document",
  documentation: "document",
  "说明文档": "document",
  "文档": "document",
  deliverable: "deliverable",
  delivery: "deliverable",
  "交付物": "deliverable",
  control: "control",
  "control sheet": "control",
  "控制表": "control",
  "控制": "control",
  folder: "folder",
  "文件夹": "folder",
  "目录": "folder"
};

export function cleanText(value: unknown, maxLength?: number): string {
  return String(value === null || value === undefined ? "" : value)
    .trim()
    .slice(0, maxLength || 500);
}

function safeId(value: unknown, prefix: string): string {
  const clean = cleanText(value, 180);
  return clean && /^[a-zA-Z0-9_-]+$/.test(clean) ? clean : uid(prefix);
}

export function normalizeType(value: unknown): MaterialType | "" {
  const key = cleanText(value, 40).toLocaleLowerCase();
  return TYPE_ALIASES[key] || "";
}

export function uniqueIds(values: unknown): string[] {
  const seen = new Set<string>();
  return (Array.isArray(values) ? values : [])
    .map(function (value) {
      return cleanText(value, 180);
    })
    .filter(function (value) {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function normalizeOpenEvents(values: unknown): string[] {
  return (Array.isArray(values) ? values : [])
    .map(function (value) {
      return cleanText(value, 80);
    })
    .filter(function (value) {
      return value && !Number.isNaN(new Date(value).getTime());
    })
    .sort()
    .slice(-500);
}

export function normalizeMaterial(material: unknown): Material {
  const raw = (material || {}) as Record<string, unknown>;
  const created = cleanText(raw.createdAt, 80) || new Date().toISOString();
  return {
    id: safeId(raw.id, "material"),
    title: cleanText(raw.title, 160),
    url: cleanText(raw.url, 3000),
    type: normalizeType(raw.type) || "document",
    taskIds: uniqueIds(raw.taskIds),
    flowIds: uniqueIds(raw.flowIds),
    groupIds: uniqueIds(raw.groupIds),
    note: cleanText(raw.note, 2000),
    openEvents: normalizeOpenEvents(raw.openEvents),
    createdAt: created,
    updatedAt: cleanText(raw.updatedAt, 80) || created
  };
}

export function makeMaterial(details?: Record<string, unknown> | null, stamp?: string): Material {
  const now = stamp || new Date().toISOString();
  return normalizeMaterial(
    Object.assign(
      {
        id: uid("material"),
        type: "document",
        taskIds: [],
        flowIds: [],
        groupIds: [],
        note: "",
        openEvents: [],
        createdAt: now,
        updatedAt: now
      },
      details || {}
    )
  );
}

export function migrateLegacyLinks(tasks: unknown, stamp?: string): Material[] {
  const materialByKey = new Map<string, Material>();
  (Array.isArray(tasks) ? tasks : []).forEach(function (task) {
    const rawTask = (task || {}) as Record<string, unknown>;
    const sources: Array<[string, unknown]> = [
      ["document", rawTask.documentLinks],
      ["deliverable", rawTask.deliverableLinks]
    ];
    sources.forEach(function (source) {
      (Array.isArray(source[1]) ? source[1] : []).forEach(function (link) {
        const rawLink = (link || {}) as Record<string, unknown>;
        const title = cleanText(rawLink.title, 160);
        const url = cleanText(rawLink.url, 3000);
        const key = source[0] + "::" + title.toLocaleLowerCase() + "::" + url;
        let material = materialByKey.get(key);
        if (!material) {
          material = makeMaterial(
            {
              id: rawLink.id,
              title: title,
              url: url,
              type: source[0],
              taskIds: [],
              flowIds: [],
              groupIds: []
            },
            stamp
          );
          materialByKey.set(key, material);
        }
        material.taskIds = uniqueIds((material.taskIds as unknown[]).concat(rawTask.id || []));
      });
    });
  });
  return Array.from(materialByKey.values());
}

function byId<T extends { id: string }>(items: unknown): Map<string, T> {
  return new Map(
    (Array.isArray(items) ? (items as T[]) : []).map(function (item) {
      return [item.id, item] as [string, T];
    })
  );
}

export interface MaterialRelations {
  taskIds: string[];
  flowIds: string[];
  groupIds: string[];
  tasks: Task[];
  flows: Flow[];
  groups: Group[];
}

export function resolveRelations(
  material: unknown,
  data: { tasks?: Task[]; flows?: Flow[]; groups?: Group[] } | null | undefined
): MaterialRelations {
  const raw = (material || {}) as Record<string, unknown>;
  const taskMap = byId<Task>(data && data.tasks);
  const flowMap = byId<Flow>(data && data.flows);
  const groupMap = byId<Group>(data && data.groups);
  const taskIds = uniqueIds(raw.taskIds).filter(function (id) {
    return taskMap.has(id);
  });
  const flowIds = uniqueIds(raw.flowIds).filter(function (id) {
    return flowMap.has(id);
  });
  const groupIds = uniqueIds(raw.groupIds).filter(function (id) {
    return groupMap.has(id);
  });

  taskIds.forEach(function (taskId) {
    const task = taskMap.get(taskId) as Task;
    if (task.flowId && flowMap.has(task.flowId) && !flowIds.includes(task.flowId)) {
      flowIds.push(task.flowId);
    }
    if (task.groupId && groupMap.has(task.groupId) && !groupIds.includes(task.groupId)) {
      groupIds.push(task.groupId);
    }
  });
  flowIds.forEach(function (flowId) {
    const flow = flowMap.get(flowId);
    if (flow && groupMap.has(flow.groupId) && !groupIds.includes(flow.groupId)) {
      groupIds.push(flow.groupId);
    }
  });
  return {
    taskIds: taskIds,
    flowIds: flowIds,
    groupIds: groupIds,
    tasks: taskIds.map(function (id) {
      return taskMap.get(id) as Task;
    }),
    flows: flowIds.map(function (id) {
      return flowMap.get(id) as Flow;
    }),
    groups: groupIds.map(function (id) {
      return groupMap.get(id) as Group;
    })
  };
}

export function forTask(materials: unknown, taskId: string): Material[] {
  return (Array.isArray(materials) ? (materials as Material[]) : []).filter(function (material) {
    return Array.isArray(material.taskIds) && material.taskIds.includes(taskId);
  });
}

export function startOfNaturalWeek(value?: Date | string | number): Date {
  let date = value instanceof Date ? new Date(value.getTime()) : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) date = new Date();
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

export function currentAndPreviousWeekOpenCount(
  material: { openEvents?: string[] } | null | undefined,
  now?: Date | string | number
): number {
  let current = now instanceof Date ? new Date(now.getTime()) : new Date(now || Date.now());
  if (Number.isNaN(current.getTime())) current = new Date();
  const start = startOfNaturalWeek(current);
  start.setDate(start.getDate() - 7);
  const startTime = start.getTime();
  const endTime = current.getTime();
  return (Array.isArray(material && material.openEvents) ? (material as { openEvents: string[] }).openEvents : []).filter(
    function (value) {
      const time = new Date(value).getTime();
      return !Number.isNaN(time) && time >= startTime && time <= endTime;
    }
  ).length;
}

export function openedInCurrentOrPreviousWeek(
  material: { openEvents?: string[] } | null | undefined,
  now?: Date | string | number
): boolean {
  return currentAndPreviousWeekOpenCount(material, now) > 0;
}

/* 保留旧方法名，避免外部脚本失效；统计口径已切换为本周与上周。 */
export function recentOpenCount(
  material: { openEvents?: string[] } | null | undefined,
  now?: Date | string | number
): number {
  return currentAndPreviousWeekOpenCount(material, now);
}

export function recordOpen(material: Material, now?: Date | string | number): Material {
  const time = now instanceof Date ? now : new Date(now || Date.now());
  const cutoff = time.getTime() - 90 * 24 * 60 * 60 * 1000;
  material.openEvents = normalizeOpenEvents(
    (Array.isArray(material.openEvents) ? material.openEvents : [])
      .filter(function (value) {
        const parsed = new Date(value).getTime();
        return !Number.isNaN(parsed) && parsed >= cutoff;
      })
      .concat(time.toISOString())
  );
  material.updatedAt = time.toISOString();
  return material;
}

function firstGroupSortKey(
  material: unknown,
  data: { tasks?: Task[]; flows?: Flow[]; groups?: Group[] } | null | undefined
): [number, string] {
  const relations = resolveRelations(material, data);
  if (!relations.groups.length) return [Number.MAX_SAFE_INTEGER, "未分组"];
  const sorted = relations.groups.slice().sort(function (left, right) {
    return (
      Number(left.order || 0) - Number(right.order || 0) ||
      left.name.localeCompare(right.name, "zh-CN", { numeric: true })
    );
  });
  return [Number(sorted[0].order || 0), sorted[0].name];
}

export function sortByGroup(
  materials: unknown,
  data: { tasks?: Task[]; flows?: Flow[]; groups?: Group[] } | null | undefined
): Material[] {
  return (Array.isArray(materials) ? (materials as Material[]) : [])
    .slice()
    .sort(function (left, right) {
      const leftKey = firstGroupSortKey(left, data);
      const rightKey = firstGroupSortKey(right, data);
      return (
        leftKey[0] - rightKey[0] ||
        leftKey[1].localeCompare(rightKey[1], "zh-CN", { numeric: true }) ||
        left.title.localeCompare(right.title, "zh-CN", { numeric: true })
      );
    });
}
