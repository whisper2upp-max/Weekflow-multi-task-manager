/* 数据校验、归一化与 v1/v2 → v3 迁移。等价原 js/storage.js 的校验部分；
   localStorage 读写/备份键不移植（持久化由主进程 JSON 文件负责）。
   顶层结构校验用 Zod，跨实体不变量与归一化照搬原 storage.js validateData。 */
import { z } from "zod";
import type {
  Flow,
  Group,
  LegacyLink,
  Material,
  RecurrenceCadence,
  RecurrenceCompletion,
  Task,
  TaskStatus,
  Urgency,
  WeekflowData
} from "./types";
import * as dates from "./date-utils";
import * as utils from "./utils";
import * as materialTools from "./materials";

export const VERSION = 3;
const SUPPORTED_VERSIONS = [1, 2, 3];
export const COLORS = [
  "#665CFF",
  "#0AA6B5",
  "#9B5DE5",
  "#FF7A45",
  "#2CA77B",
  "#E94E89",
  "#7BA23F"
];

function nowISO(): string {
  return new Date().toISOString();
}

function isValidTimestamp(value: unknown): boolean {
  if (value === null || value === undefined || String(value).trim() === "") return false;
  return !Number.isNaN(new Date(value as string | number).getTime());
}

function safeId(value: unknown, prefix: string): string {
  const clean = String(value || "").trim();
  return clean && /^[a-zA-Z0-9_-]+$/.test(clean) ? clean : utils.uid(prefix);
}

function normalizeLink(link: unknown): LegacyLink {
  const raw = (link || {}) as Record<string, unknown>;
  return {
    id: safeId(raw.id, "link"),
    title: String(raw.title || "").trim().slice(0, 160),
    url: String(raw.url || "").trim().slice(0, 3000)
  };
}

function normalizeGroup(group: unknown, index: number): Group {
  const raw = (group || {}) as Record<string, unknown>;
  const created = String(raw.createdAt || nowISO());
  return {
    id: safeId(raw.id, "group"),
    name: String(raw.name || "").trim().slice(0, 80),
    color: utils.isHexColor(raw.color)
      ? String(raw.color).toUpperCase()
      : COLORS[index % COLORS.length],
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index + 1,
    collapsed: Boolean(raw.collapsed),
    createdAt: created,
    updatedAt: String(raw.updatedAt || created)
  };
}

function normalizeFlow(flow: unknown, index: number): Flow {
  const raw = (flow || {}) as Record<string, unknown>;
  const created = String(raw.createdAt || nowISO());
  return {
    id: safeId(raw.id, "flow"),
    groupId: String(raw.groupId || ""),
    name: String(raw.name || "").trim().slice(0, 80),
    color: utils.isHexColor(raw.color)
      ? String(raw.color).toUpperCase()
      : COLORS[(index + 2) % COLORS.length],
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index + 1,
    collapsed: Boolean(raw.collapsed),
    createdAt: created,
    updatedAt: String(raw.updatedAt || created)
  };
}

function normalizeRecurrenceCompletion(record: unknown): RecurrenceCompletion {
  const raw = (record || {}) as Record<string, unknown>;
  return {
    periodKey: String(raw.periodKey || "").trim().slice(0, 20),
    occurrenceDdl: dates.formatDate(raw.occurrenceDdl),
    completedAt: dates.formatDate(raw.completedAt)
  };
}

/** 归一化过程中 Task 临时携带 v1/v2 过渡字段，校验结束后删除。 */
type TaskWithLegacyLinks = Task & {
  documentLinks: LegacyLink[];
  deliverableLinks: LegacyLink[];
};

function normalizeTask(task: unknown): TaskWithLegacyLinks {
  const raw = (task || {}) as Record<string, unknown>;
  const created = String(raw.createdAt || nowISO());
  const status: TaskStatus = raw.status === "completed" ? "completed" : "pending";
  const progressNote = String(raw.progressNote || "").trim().slice(0, 4000);
  let progressTimestamp: string | null = null;
  if (progressNote) {
    // progressUpdatedAt 缺失时回退 updatedAt / createdAt，再回退当前时间。
    const found = [raw.progressUpdatedAt, raw.updatedAt, created].find(isValidTimestamp);
    progressTimestamp = String(found || nowISO());
  }
  const urgency: Urgency = ["high", "medium", "low"].includes(String(raw.urgency))
    ? (raw.urgency as Urgency)
    : "medium";
  const rawFlowOrder = Number(raw.flowOrder);
  const recurrenceCadence: RecurrenceCadence = ["weekly", "monthly"].includes(
    String(raw.recurrenceCadence)
  )
    ? (raw.recurrenceCadence as RecurrenceCadence)
    : "none";
  return {
    id: safeId(raw.id, "task"),
    groupId: String(raw.groupId || ""),
    flowId: raw.flowId ? String(raw.flowId) : null,
    flowOrder: Number.isFinite(rawFlowOrder) && rawFlowOrder >= 1 ? rawFlowOrder : null,
    name: String(raw.name || "").trim().slice(0, 160),
    reportTo: String(raw.reportTo || "").trim().slice(0, 120),
    managedObject: String(raw.managedObject || "").trim().slice(0, 160),
    deliverable: String(raw.deliverable || "").trim().slice(0, 500),
    ddl: dates.formatDate(raw.ddl),
    urgency: urgency,
    status: status,
    completedAt:
      status === "completed"
        ? dates.formatDate(raw.completedAt || dates.todayISO())
        : null,
    progressNote: progressNote,
    progressUpdatedAt: progressTimestamp,
    recurrenceCadence: recurrenceCadence,
    recurrenceStart:
      recurrenceCadence === "none" ? null : dates.formatDate(raw.recurrenceStart),
    recurrenceEnd: recurrenceCadence === "none" ? null : dates.formatDate(raw.recurrenceEnd),
    recurrenceCompletions:
      recurrenceCadence !== "none" && Array.isArray(raw.recurrenceCompletions)
        ? raw.recurrenceCompletions.map(normalizeRecurrenceCompletion)
        : [],
    documentLinks: Array.isArray(raw.documentLinks)
      ? raw.documentLinks.map(normalizeLink)
      : [],
    deliverableLinks: Array.isArray(raw.deliverableLinks)
      ? raw.deliverableLinks.map(normalizeLink)
      : [],
    createdAt: created,
    updatedAt: String(raw.updatedAt || created)
  };
}

/* 顶层结构校验：根节点必须是对象；version 支持 1/2/3；groups/tasks 必须是数组，
   flows（version>=2）与 materials（version=3）必须是数组。错误文案与原 storage.js 一致。 */
const structureSchema = z
  .object(
    {
      version: z.unknown(),
      groups: z.unknown(),
      tasks: z.unknown(),
      flows: z.unknown().optional(),
      materials: z.unknown().optional(),
      updatedAt: z.unknown().optional()
    },
    {
      required_error: "备份根节点必须是对象。",
      invalid_type_error: "备份根节点必须是对象。"
    }
  )
  .passthrough()
  .superRefine(function (value, ctx) {
    const inputVersion = Number(value.version);
    if (!Number.isInteger(inputVersion) || !SUPPORTED_VERSIONS.includes(inputVersion)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["version"],
        message:
          "不支持的数据版本：" +
          String(value.version === undefined ? "缺失" : value.version) +
          "。"
      });
    }
    if (!Array.isArray(value.groups)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["groups"], message: "groups 必须是数组。" });
    }
    if (!Array.isArray(value.tasks)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tasks"], message: "tasks 必须是数组。" });
    }
    if (inputVersion >= 2 && !Array.isArray(value.flows)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["flows"], message: "flows 必须是数组。" });
    }
    if (inputVersion === VERSION && !Array.isArray(value.materials)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["materials"],
        message: "materials 必须是数组。"
      });
    }
  });

export type ValidateDataResult =
  | { ok: true; data: WeekflowData }
  | { ok: false; errors: string[] };

export function validateData(input: unknown): ValidateDataResult {
  const parsed = structureSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(function (issue) {
        return issue.message;
      })
    };
  }
  const rawInput = parsed.data;
  const inputVersion = Number(rawInput.version);
  const errors: string[] = [];

  const rawGroups = rawInput.groups as unknown[];
  const rawTasks = rawInput.tasks as unknown[];
  const rawFlows = (Array.isArray(rawInput.flows) ? rawInput.flows : []) as unknown[];

  const groups = rawGroups.map(normalizeGroup);
  const groupIds = new Set<string>();
  groups.forEach(function (group, index) {
    if (!group.name) errors.push("第 " + (index + 1) + " 个分组缺少名称。");
    if (groupIds.has(group.id)) errors.push("分组 ID 重复：" + group.id);
    groupIds.add(group.id);
  });

  const flows = rawFlows.map(normalizeFlow);
  const flowIds = new Set<string>();
  const flowNamesByGroup = new Set<string>();
  flows.forEach(function (flow, index) {
    if (!flow.name) errors.push("第 " + (index + 1) + " 个 Flow 缺少名称。");
    if (!groupIds.has(flow.groupId)) {
      errors.push("Flow「" + (flow.name || index + 1) + "」所属分组不存在。");
    }
    if (flowIds.has(flow.id)) errors.push("Flow ID 重复：" + flow.id);
    flowIds.add(flow.id);
    const nameKey = flow.groupId + "::" + flow.name.toLocaleLowerCase();
    if (flowNamesByGroup.has(nameKey)) {
      errors.push("同一分组中存在同名 Flow：" + flow.name);
    }
    flowNamesByGroup.add(nameKey);
  });
  const flowMap = new Map(
    flows.map(function (flow) {
      return [flow.id, flow] as [string, Flow];
    })
  );

  const taskIds = new Set<string>();
  const tasks = rawTasks.map(normalizeTask);
  tasks.forEach(function (task, index) {
    if (!task.name) errors.push("第 " + (index + 1) + " 个 Task 缺少名称。");
    if (!task.ddl) errors.push("Task「" + (task.name || index + 1) + "」的 DDL 无效。");
    if (!groupIds.has(task.groupId)) {
      errors.push("Task「" + (task.name || index + 1) + "」所属分组不存在。");
    }
    if (taskIds.has(task.id)) errors.push("Task ID 重复：" + task.id);
    taskIds.add(task.id);
    if (task.flowId) {
      const flow = flowMap.get(task.flowId);
      if (!flow) {
        errors.push("Task「" + (task.name || index + 1) + "」所属 Flow 不存在。");
      } else if (flow.groupId !== task.groupId) {
        errors.push("Task「" + (task.name || index + 1) + "」的 Flow 与分组不一致。");
      }
    }
    const rawTask = (rawTasks[index] || {}) as Record<string, unknown>;
    const rawCadence = String(rawTask.recurrenceCadence || "none");
    if (!["none", "weekly", "monthly"].includes(rawCadence)) {
      errors.push("Task「" + (task.name || index + 1) + "」的周期类型无效。");
    }
    if (task.recurrenceCadence !== "none") {
      if (!task.recurrenceStart || !task.recurrenceEnd) {
        errors.push("Task「" + (task.name || index + 1) + "」缺少周期开始或结束日期。");
      } else if (task.recurrenceStart > task.recurrenceEnd) {
        errors.push("Task「" + (task.name || index + 1) + "」的周期开始日期晚于结束日期。");
      } else if (task.ddl < task.recurrenceStart || task.ddl > task.recurrenceEnd) {
        errors.push("Task「" + (task.name || index + 1) + "」的 DDL 必须位于周期起止日期内。");
      } else if (!dates.getRecurringOccurrences(task).length) {
        errors.push("Task「" + (task.name || index + 1) + "」在周期范围内没有可用 DDL。");
      }
      if (
        rawTask.recurrenceCompletions !== undefined &&
        !Array.isArray(rawTask.recurrenceCompletions)
      ) {
        errors.push("Task「" + (task.name || index + 1) + "」的周期完成记录必须是数组。");
      }
      const validOccurrenceKeys = new Set(
        dates.getRecurringOccurrences(task).map(function (occurrence) {
          return occurrence.periodKey;
        })
      );
      const seenCompletionKeys = new Set<string>();
      task.recurrenceCompletions.forEach(function (record) {
        if (
          !record.periodKey ||
          !record.occurrenceDdl ||
          !record.completedAt ||
          !validOccurrenceKeys.has(record.periodKey)
        ) {
          errors.push("Task「" + (task.name || index + 1) + "」包含无效周期完成记录。");
        }
        if (seenCompletionKeys.has(record.periodKey)) {
          errors.push("Task「" + (task.name || index + 1) + "」包含重复周期完成记录。");
        }
        seenCompletionKeys.add(record.periodKey);
      });
    }
    if (
      task.progressNote &&
      rawTask.progressUpdatedAt !== undefined &&
      rawTask.progressUpdatedAt !== null &&
      String(rawTask.progressUpdatedAt).trim() &&
      !isValidTimestamp(rawTask.progressUpdatedAt)
    ) {
      errors.push("Task「" + (task.name || index + 1) + "」的进度更新时间无效。");
    }
    if (inputVersion < VERSION) {
      task.documentLinks.concat(task.deliverableLinks).forEach(function (link) {
        if (!link.title || !utils.isValidUrl(link.url)) {
          errors.push("Task「" + (task.name || index + 1) + "」包含无效链接。");
        }
      });
    }
  });

  // flowOrder 在每个 Flow 内按原顺序强制重排为 1..n；无 Flow 的 Task 恒为 null。
  flows.forEach(function (flow) {
    tasks
      .map(function (task, sourceIndex) {
        return { task: task, sourceIndex: sourceIndex };
      })
      .filter(function (item) {
        return item.task.flowId === flow.id;
      })
      .sort(function (left, right) {
        const leftOrder =
          left.task.flowOrder === null ? Number.MAX_SAFE_INTEGER : left.task.flowOrder;
        const rightOrder =
          right.task.flowOrder === null ? Number.MAX_SAFE_INTEGER : right.task.flowOrder;
        return leftOrder - rightOrder || left.sourceIndex - right.sourceIndex;
      })
      .forEach(function (item, index) {
        item.task.flowOrder = index + 1;
      });
  });
  tasks.forEach(function (task) {
    if (!task.flowId) task.flowOrder = null;
  });

  // v1/v2 数据没有 materials 数组，由 Task 上的 documentLinks/deliverableLinks 迁移生成。
  const sourceMaterials: unknown[] =
    inputVersion === VERSION
      ? (rawInput.materials as unknown[])
      : materialTools.migrateLegacyLinks(tasks, String(rawInput.updatedAt || nowISO()));
  const materialIds = new Set<string>();
  const materials = sourceMaterials.map(function (material) {
    return materialTools.normalizeMaterial(material);
  });
  materials.forEach(function (material, index) {
    const rawMaterial = (sourceMaterials[index] || {}) as Record<string, unknown>;
    if (!material.title) errors.push("第 " + (index + 1) + " 条资料缺少链接名称。");
    if (!utils.isValidUrl(material.url)) {
      errors.push("资料「" + (material.title || index + 1) + "」的链接地址无效。");
    }
    if (!materialTools.normalizeType(rawMaterial.type)) {
      errors.push("资料「" + (material.title || index + 1) + "」的类型无效。");
    }
    if (materialIds.has(material.id)) errors.push("资料 ID 重复：" + material.id);
    materialIds.add(material.id);
    material.taskIds.forEach(function (id) {
      if (!taskIds.has(id)) {
        errors.push("资料「" + (material.title || index + 1) + "」关联的 Task 不存在。");
      }
    });
    material.flowIds.forEach(function (id) {
      if (!flowIds.has(id)) {
        errors.push("资料「" + (material.title || index + 1) + "」关联的 Flow 不存在。");
      }
    });
    material.groupIds.forEach(function (id) {
      if (!groupIds.has(id)) {
        errors.push("资料「" + (material.title || index + 1) + "」关联的分组不存在。");
      }
    });
    (Array.isArray(rawMaterial.openEvents) ? rawMaterial.openEvents : []).forEach(
      function (value) {
        if (!isValidTimestamp(value)) {
          errors.push("资料「" + (material.title || index + 1) + "」包含无效打开时间。");
        }
      }
    );
  });
  tasks.forEach(function (task) {
    delete (task as Partial<TaskWithLegacyLinks>).documentLinks;
    delete (task as Partial<TaskWithLegacyLinks>).deliverableLinks;
  });

  const data: WeekflowData = {
    version: VERSION,
    groups: groups,
    flows: flows,
    tasks: tasks,
    materials: materials,
    updatedAt: String(rawInput.updatedAt || nowISO())
  };
  if (errors.length) return { ok: false, errors: errors };
  return { ok: true, data: data };
}

export function makeEmptyData(): WeekflowData {
  const stamp = nowISO();
  return {
    version: VERSION,
    groups: [],
    flows: [],
    tasks: [],
    materials: [],
    updatedAt: stamp
  };
}

export function nextGroupColor(groups: Group[] | null | undefined): string {
  const used = new Set(
    (Array.isArray(groups) ? groups : []).map(function (group) {
      return String(group.color || "").toUpperCase();
    })
  );
  return (
    COLORS.find(function (color) {
      return !used.has(color);
    }) || COLORS[(Array.isArray(groups) ? groups.length : 0) % COLORS.length]
  );
}
