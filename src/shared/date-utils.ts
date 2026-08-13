/* 本地日期与自然周计算。所有 YYYY-MM-DD 都按本地时区解析。等价原 js/date-utils.js。 */
import type {
  RecurrenceCadence,
  RecurrenceCompletion,
  RecurringOccurrence,
  Task,
  TaskPeriodState
} from "./types";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 原 JS 为鸭子类型：周期计算只需要这几个字段（Excel 导入等场景会传入尚未补全的 Task）。 */
export type RecurrenceConfig = Pick<
  Task,
  "ddl" | "recurrenceCadence" | "recurrenceStart" | "recurrenceEnd"
>;

export function parseISODate(value: unknown): Date | null {
  if (value instanceof Date) {
    const copy = new Date(value.getFullYear(), value.getMonth(), value.getDate());
    return Number.isNaN(copy.getTime()) ? null : copy;
  }
  const match = ISO_DATE.exec(String(value || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDate(value: unknown): string {
  const date = parseISODate(value);
  if (!date) return "";
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

export function todayISO(now?: Date): string {
  return formatDate(now instanceof Date ? now : new Date());
}

export function addDays(value: unknown, amount?: number): string {
  const date = parseISODate(value);
  if (!date) return "";
  date.setDate(date.getDate() + Number(amount || 0));
  return formatDate(date);
}

export function startOfWeek(value: unknown): string {
  const date = parseISODate(value);
  if (!date) return "";
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return formatDate(date);
}

export function endOfWeek(value: unknown): string {
  const monday = startOfWeek(value);
  return monday ? addDays(monday, 6) : "";
}

export function getWeekFriday(value: unknown): string {
  const monday = startOfWeek(value);
  return monday ? addDays(monday, 4) : "";
}

export function addWeeksFriday(friday: unknown, weeks?: number): string {
  const normalized = getWeekFriday(friday);
  return normalized ? addDays(normalized, Number(weeks || 0) * 7) : "";
}

export function compareDates(left: unknown, right: unknown): number {
  const a = formatDate(left);
  const b = formatDate(right);
  if (!a || !b) return 0;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function daysBetween(left: unknown, right: unknown): number {
  const a = parseISODate(left);
  const b = parseISODate(right);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function buildWeekRange(
  startValue: unknown,
  endValue: unknown,
  maxWeeks?: number
): string[] {
  let start = getWeekFriday(startValue);
  let end = getWeekFriday(endValue);
  if (!start || !end) return [];
  if (start > end) {
    const swap = start;
    start = end;
    end = swap;
  }
  const weeks: string[] = [];
  let cursor = start;
  const limit = Number(maxWeeks || 600);
  while (cursor <= end && weeks.length < limit) {
    weeks.push(cursor);
    cursor = addWeeksFriday(cursor, 1);
  }
  return weeks;
}

export function recurrenceCadence(
  task: { recurrenceCadence?: unknown } | null | undefined
): RecurrenceCadence {
  const value = String((task && task.recurrenceCadence) || "none");
  return value === "weekly" || value === "monthly" ? value : "none";
}

export function isRecurringTask(task: RecurrenceConfig | null | undefined): boolean {
  return Boolean(
    task &&
      recurrenceCadence(task) !== "none" &&
      parseISODate(task.ddl) &&
      parseISODate(task.recurrenceStart) &&
      parseISODate(task.recurrenceEnd) &&
      formatDate(task.recurrenceStart) <= formatDate(task.recurrenceEnd)
  );
}

export function recurrencePeriodKey(cadence: string, value: unknown): string {
  const date = formatDate(value);
  if (!date) return "";
  if (cadence === "weekly") return startOfWeek(date);
  if (cadence === "monthly") return date.slice(0, 7);
  return "";
}

export function getRecurringOccurrences(
  task: RecurrenceConfig | null | undefined,
  maxOccurrences?: number
): RecurringOccurrence[] {
  if (!isRecurringTask(task)) return [];
  const source = task as RecurrenceConfig;
  const cadence = recurrenceCadence(source);
  const start = formatDate(source.recurrenceStart);
  const end = formatDate(source.recurrenceEnd);
  const anchor = parseISODate(source.ddl) as Date;
  const limit = Math.max(1, Number(maxOccurrences || 5000));
  const occurrences: RecurringOccurrence[] = [];
  if (cadence === "weekly") {
    const startDate = parseISODate(start) as Date;
    const offset = (anchor.getDay() - startDate.getDay() + 7) % 7;
    let cursor = addDays(start, offset);
    while (cursor && cursor <= end && occurrences.length < limit) {
      occurrences.push({
        ddl: cursor,
        periodKey: recurrencePeriodKey(cadence, cursor)
      });
      cursor = addDays(cursor, 7);
    }
    return occurrences;
  }
  const startMonth = parseISODate(start) as Date;
  let monthCursor = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);
  const anchorDay = anchor.getDate();
  while (occurrences.length < limit) {
    // 短月没有锚定日时取该月最后一天（如锚 31 日的 2 月取 28/29 日）。
    const lastDay = new Date(
      monthCursor.getFullYear(),
      monthCursor.getMonth() + 1,
      0
    ).getDate();
    const occurrence = new Date(
      monthCursor.getFullYear(),
      monthCursor.getMonth(),
      Math.min(anchorDay, lastDay)
    );
    const occurrenceDate = formatDate(occurrence);
    if (occurrenceDate > end) break;
    if (occurrenceDate >= start) {
      occurrences.push({
        ddl: occurrenceDate,
        periodKey: recurrencePeriodKey(cadence, occurrenceDate)
      });
    }
    monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
    if (formatDate(monthCursor) > end) break;
  }
  return occurrences;
}

export function getRecurringCompletion(
  task: { recurrenceCompletions?: RecurrenceCompletion[] } | null | undefined,
  occurrence: RecurringOccurrence | null
): RecurrenceCompletion | null {
  if (!occurrence) return null;
  return (
    (Array.isArray(task && task.recurrenceCompletions)
      ? (task as { recurrenceCompletions: RecurrenceCompletion[] }).recurrenceCompletions
      : []
    ).find(function (record) {
      return record.periodKey === occurrence.periodKey;
    }) || null
  );
}

export function getTaskPeriodState(
  task: Task | null | undefined,
  today?: Date | string
): TaskPeriodState {
  const currentDate = formatDate(today || new Date()) || todayISO();
  if (!isRecurringTask(task)) {
    const normalCompleted = Boolean(task && task.status === "completed");
    return {
      recurring: false,
      cadence: "none",
      occurrence:
        task && parseISODate(task.ddl)
          ? { ddl: formatDate(task.ddl), periodKey: "" }
          : null,
      currentOccurrence: null,
      checkboxEnabled: true,
      completed: normalCompleted,
      completedAt: normalCompleted && task ? formatDate(task.completedAt) : null,
      overdue: Boolean(
        task &&
          !normalCompleted &&
          parseISODate(task.ddl) &&
          formatDate(task.ddl) < currentDate
      )
    };
  }
  const source = task as Task;
  const cadence = recurrenceCadence(source);
  const occurrences = getRecurringOccurrences(source);
  const currentKey = recurrencePeriodKey(cadence, currentDate);
  const currentOccurrence =
    occurrences.find(function (occurrence) {
      return occurrence.periodKey === currentKey;
    }) || null;
  const withinSchedule =
    currentDate >= formatDate(source.recurrenceStart) &&
    currentDate <= formatDate(source.recurrenceEnd);
  const checkboxEnabled = Boolean(currentOccurrence && withinSchedule);
  let relevant = currentOccurrence;
  if (!relevant) {
    relevant =
      occurrences.find(function (occurrence) {
        return occurrence.ddl >= currentDate;
      }) ||
      occurrences[occurrences.length - 1] ||
      null;
  }
  let completion: RecurrenceCompletion | null = null;
  if (checkboxEnabled) {
    completion = getRecurringCompletion(source, currentOccurrence);
  } else if (currentDate > formatDate(source.recurrenceEnd) && relevant) {
    completion = getRecurringCompletion(source, relevant);
  }
  const completed = Boolean(completion);
  const overdue = Boolean(
    relevant &&
      !completed &&
      relevant.ddl < currentDate &&
      (checkboxEnabled || currentDate > formatDate(source.recurrenceEnd))
  );
  const state: TaskPeriodState & { occurrences: RecurringOccurrence[] } = {
    recurring: true,
    cadence: cadence,
    occurrence: relevant,
    currentOccurrence: currentOccurrence,
    checkboxEnabled: checkboxEnabled,
    completed: completed,
    completedAt: completion ? formatDate(completion.completedAt) : null,
    overdue: overdue,
    occurrences: occurrences
  };
  return state;
}

export function taskEffectiveDdl(
  task: Task | null | undefined,
  today?: Date | string
): string {
  const state = getTaskPeriodState(task, today);
  return state.occurrence ? state.occurrence.ddl : formatDate(task && task.ddl);
}

export function isOverdue(task: Task | null | undefined, today?: Date | string): boolean {
  return getTaskPeriodState(task, today).overdue;
}

export function completionRate(completed: number, total: number): number {
  const safeTotal = Number(total || 0);
  if (safeTotal <= 0) return 0;
  return Math.round((Number(completed || 0) / safeTotal) * 1000) / 10;
}

export function dateTimeStamp(now?: Date): string {
  const date = now instanceof Date ? now : new Date();
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    "_" +
    pad(date.getHours()) +
    pad(date.getMinutes())
  );
}

export function friendlyWeekLabel(friday: unknown): string {
  const monday = startOfWeek(friday);
  const sunday = endOfWeek(friday);
  if (!monday || !sunday) return "";
  return monday.slice(5) + " — " + sunday.slice(5);
}
