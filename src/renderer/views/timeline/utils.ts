/* 时间轴视图共享小工具：分组/Flow 颜色 CSS 变量注入、周几文案、
   Task 时间轴 occurrence 计算与节点 tooltip。
   逐项等价原 js/app.js 的 applyGroupVariables（1367）/ applyFlowVariables（1376）/
   weekdayLabel（1288）/ getTaskTimelineOccurrences（1057）/ percentage（1522）/
   buildTaskTooltip（1756，含英文分支；英文分支里周期/紧急用原版的英文标签映射，
   周几沿用原版 weekdayLabel 中文输出——与原版英文 UI 表现一致）。 */
import type { CSSProperties } from "react";
import type { Flow, Group, RecurringOccurrence, Task, Urgency } from "../../../shared/types";
import * as dates from "../../../shared/date-utils";
import * as utils from "../../../shared/utils";
import * as automation from "../../../shared/automation";
import { isEnglish } from "../../lib/i18n";

export const URGENCY_ICONS: Record<Urgency, string> = { high: "◆", medium: "●", low: "○" };
export const URGENCY_LABELS: Record<Urgency, string> = { high: "高", medium: "中", low: "低" };

/** 等价 app.js:1367 applyGroupVariables */
export function groupStyleVars(group: Group): CSSProperties {
  return {
    "--group-color": group.color,
    "--group-soft": utils.rgba(group.color, 0.08),
    "--group-soft-solid": utils.blendWithWhite(group.color, 0.9),
    "--group-border": utils.rgba(group.color, 0.24),
    "--group-wash": utils.rgba(group.color, 0.045),
    "--group-medium": utils.rgba(group.color, 0.16)
  } as CSSProperties;
}

/** 等价 app.js:1376 applyFlowVariables */
export function flowStyleVars(flow: Flow): CSSProperties {
  return {
    "--flow-color": flow.color,
    "--flow-soft": utils.rgba(flow.color, 0.075),
    "--flow-border": utils.rgba(flow.color, 0.24),
    "--flow-medium": utils.rgba(flow.color, 0.16)
  } as CSSProperties;
}

/** 等价 app.js:1288 weekdayLabel（仅中文） */
export function weekdayLabel(value: string): string {
  const date = dates.parseISODate(value);
  return date
    ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()]
    : "";
}

/** 等价 app.js:1057 getTaskTimelineOccurrences */
export function getTaskTimelineOccurrences(task: Task): RecurringOccurrence[] {
  return dates.isRecurringTask(task)
    ? dates.getRecurringOccurrences(task)
    : [{ ddl: dates.formatDate(task && task.ddl), periodKey: "" }];
}

/** 等价 app.js:1522 percentage */
export function percentage(value: number, total: number): number {
  return total > 0 ? Math.max(0, Math.min(100, (Number(value || 0) / total) * 100)) : 0;
}

/** 等价 app.js:1756 buildTaskTooltip（含 isEnglish 英文分支） */
export function buildTaskTooltip(
  task: Task,
  group: Group,
  occurrence: RecurringOccurrence,
  completed: boolean,
  overdue: boolean,
  flow: Flow | null
): string {
  const recurring = dates.isRecurringTask(task);
  if (isEnglish()) {
    const enCadenceLabels = { none: "Does not repeat", weekly: "Weekly", monthly: "Monthly" } as const;
    const enUrgencyLabels: Record<Urgency, string> = { high: "High", medium: "Medium", low: "Low" };
    return [
      task.name,
      "Group: " + group.name,
      flow ? "Flow: " + flow.name + " · STEP " + String(task.flowOrder || 1).padStart(2, "0") : "",
      recurring
        ? "Recurrence: " +
          enCadenceLabels[dates.recurrenceCadence(task)] +
          " · " +
          task.recurrenceStart +
          " to " +
          task.recurrenceEnd
        : "",
      "DDL: " + occurrence.ddl + " (" + weekdayLabel(occurrence.ddl) + ")",
      "Urgency: " + enUrgencyLabels[task.urgency],
      "Status: " + (overdue ? "Overdue" : completed ? "Completed" : "Incomplete"),
      task.reportTo ? "Report To: " + task.reportTo : "",
      task.managedObject ? "Managed Person: " + task.managedObject : "",
      task.deliverable ? "Deliverable: " + task.deliverable : "",
      task.progressNote ? "Progress: " + task.progressNote.replace(/\s+/g, " ").slice(0, 120) : ""
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    task.name,
    "分组：" + group.name,
    flow ? "Flow：" + flow.name + " · STEP " + String(task.flowOrder || 1).padStart(2, "0") : "",
    recurring
      ? "周期：" +
        automation.cadenceLabel(dates.recurrenceCadence(task)) +
        " · " +
        task.recurrenceStart +
        " 至 " +
        task.recurrenceEnd
      : "",
    "DDL：" + occurrence.ddl + "（" + weekdayLabel(occurrence.ddl) + "）",
    "紧急程度：" + URGENCY_LABELS[task.urgency],
    "状态：" + (overdue ? "逾期" : completed ? "已完成" : "未完成"),
    task.reportTo ? "汇报对象：" + task.reportTo : "",
    task.managedObject ? "管理对象：" + task.managedObject : "",
    task.deliverable ? "交付物：" + task.deliverable : "",
    task.progressNote ? "进度：" + task.progressNote.replace(/\s+/g, " ").slice(0, 120) : ""
  ]
    .filter(Boolean)
    .join("\n");
}
