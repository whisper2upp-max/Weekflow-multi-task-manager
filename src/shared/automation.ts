/* 周期 Task 当前周期状态与临期提醒逻辑。等价原 js/automation.js（i18n 固定为中文）。 */
import type {
  RecurrenceCadence,
  RecurrenceCompletion,
  RecurringOccurrence,
  Task,
  TaskPeriodState
} from "./types";
import * as dates from "./date-utils";

export const CADENCES: RecurrenceCadence[] = ["weekly", "monthly"];
export const CADENCE_LABELS: Record<string, string> = { weekly: "每周", monthly: "每月" };

export function cadenceLabel(cadence: string): string {
  return CADENCE_LABELS[cadence] || cadence;
}

export function isCadence(value: unknown): boolean {
  return CADENCES.includes(String(value || "") as RecurrenceCadence);
}

export function normalizeCompletions(task: Task): RecurrenceCompletion[] {
  const occurrences = dates.getRecurringOccurrences(task);
  const occurrenceMap = new Map(
    occurrences.map(function (occurrence) {
      return [occurrence.periodKey, occurrence] as [string, RecurringOccurrence];
    })
  );
  const seen = new Set<string>();
  const normalized = (Array.isArray(task.recurrenceCompletions) ? task.recurrenceCompletions : [])
    .map(function (record): RecurrenceCompletion | null {
      const periodKey = String((record && record.periodKey) || "");
      const occurrence = occurrenceMap.get(periodKey);
      if (!occurrence || seen.has(periodKey)) return null;
      seen.add(periodKey);
      return {
        periodKey: periodKey,
        occurrenceDdl: occurrence.ddl,
        completedAt: dates.formatDate(record && record.completedAt) || occurrence.ddl
      };
    })
    .filter(function (record): record is RecurrenceCompletion {
      return Boolean(record);
    })
    .sort(function (left, right) {
      return left.occurrenceDdl.localeCompare(right.occurrenceDdl);
    });
  if (!normalized.length) return normalized;

  // 周期完成记录必须是从第一期开始的连续前缀：确认较晚一期完成，
  // 即表示此前各期均已完成。这里同时修复旧版本留下的间断记录。
  const latest = normalized[normalized.length - 1];
  const latestIndex = occurrences.findIndex(function (occurrence) {
    return occurrence.periodKey === latest.periodKey;
  });
  const recordMap = new Map(
    normalized.map(function (record) {
      return [record.periodKey, record] as [string, RecurrenceCompletion];
    })
  );
  return occurrences.slice(0, latestIndex + 1).map(function (occurrence) {
    return (
      recordMap.get(occurrence.periodKey) || {
        periodKey: occurrence.periodKey,
        occurrenceDdl: occurrence.ddl,
        completedAt: latest.completedAt || occurrence.ddl
      }
    );
  });
}

export function syncRecurringTaskStates(
  data: { tasks?: Task[] },
  now?: Date | string
): { changed: boolean } {
  let changed = false;
  (data.tasks || []).forEach(function (task) {
    if (!dates.isRecurringTask(task)) return;
    const normalized = normalizeCompletions(task);
    if (JSON.stringify(normalized) !== JSON.stringify(task.recurrenceCompletions || [])) {
      task.recurrenceCompletions = normalized;
      changed = true;
    }
    const state = dates.getTaskPeriodState(task, now);
    const nextStatus = state.completed ? "completed" : "pending";
    const nextCompletedAt = state.completedAt || null;
    if (task.status !== nextStatus || task.completedAt !== nextCompletedAt) {
      task.status = nextStatus;
      task.completedAt = nextCompletedAt;
      changed = true;
    }
  });
  return { changed: changed };
}

export function setCurrentPeriodCompleted(
  task: Task,
  completed: boolean,
  now?: Date | string
): { changed: boolean; state: TaskPeriodState } {
  const state = dates.getTaskPeriodState(task, now);
  if (!state.recurring || !state.checkboxEnabled || !state.currentOccurrence) {
    return { changed: false, state: state };
  }
  const currentOccurrence = state.currentOccurrence;
  const currentKey = currentOccurrence.periodKey;
  const records = normalizeCompletions(task).filter(function (record) {
    return completed
      ? record.periodKey !== currentKey
      : record.occurrenceDdl < currentOccurrence.ddl;
  });
  if (completed) {
    records.push({
      periodKey: currentKey,
      occurrenceDdl: currentOccurrence.ddl,
      completedAt: dates.todayISO(now instanceof Date ? now : new Date())
    });
  }
  task.recurrenceCompletions = completed
    ? normalizeCompletions(Object.assign({}, task, { recurrenceCompletions: records }))
    : records;
  const nextState = dates.getTaskPeriodState(task, now);
  task.status = nextState.completed ? "completed" : "pending";
  task.completedAt = nextState.completedAt || null;
  return { changed: true, state: nextState };
}

export type DueSoonEntry = { task: Task; ddl: string };

export function getDueSoonTasks(
  data: { tasks?: Task[] },
  now?: Date | string,
  days?: number
): DueSoonEntry[] {
  const currentDate = dates.todayISO(now instanceof Date ? now : new Date());
  const end = dates.addDays(currentDate, Number.isFinite(Number(days)) ? Number(days) : 7);
  return (data.tasks || [])
    .map(function (task): DueSoonEntry | null {
      if (!dates.isRecurringTask(task)) {
        const ddl = dates.formatDate(task.ddl);
        return task.status !== "completed" && ddl && ddl >= currentDate && ddl <= end
          ? { task: task, ddl: ddl }
          : null;
      }
      const occurrence = dates.getRecurringOccurrences(task).find(function (item) {
        return (
          item.ddl >= currentDate &&
          item.ddl <= end &&
          !dates.getRecurringCompletion(task, item)
        );
      });
      return occurrence ? { task: task, ddl: occurrence.ddl } : null;
    })
    .filter(function (entry): entry is DueSoonEntry {
      return Boolean(entry);
    })
    .sort(function (left, right) {
      return (
        left.ddl.localeCompare(right.ddl) ||
        String(left.task.name).localeCompare(String(right.task.name), "zh-CN")
      );
    });
}
