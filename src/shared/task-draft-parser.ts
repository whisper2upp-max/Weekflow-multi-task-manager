/** 中英文、本地、可解释的 Task 草稿规则解析器；不访问网络或 AI 服务。 */
import type { Flow, Group, RecurrenceCadence, Urgency } from "./types";

export const LABELS = {
  taskName: ["task name", "task", "任务名称", "任务", "事项", "待办", "行动项", "todo", "action item"],
  ddl: ["ddl", "deadline", "due date", "due", "截止日期", "截止", "最晚完成", "最晚"],
  groupName: ["group", "分组", "工作组"],
  flowName: ["flow", "workflow", "流程"],
  urgency: ["urgency", "priority", "紧急程度", "优先级"],
  recurrence: ["recurrence", "repeat", "周期生成", "周期", "重复"],
  recurrenceStart: ["recurrence start", "repeat start", "周期开始日期", "周期开始", "开始日期"],
  recurrenceEnd: ["recurrence end", "repeat end", "周期结束日期", "周期结束", "结束日期"],
  reportTo: ["report to", "reports to", "汇报对象", "汇报给"],
  managedObject: ["managed person", "managee", "管理对象", "管理人员"],
  deliverable: ["deliverable", "output", "result", "交付物", "输出", "成果"]
} as const;

type FieldKey = keyof typeof LABELS;
const FIELD_KEYS = Object.keys(LABELS) as FieldKey[];
const BULLET = /^\s*(?:(?:[-*•▪◦]\s*(?:\[[ xX]?\]\s*)?)|(?:\d{1,3}(?:[.)、:]\s*|\s+))|(?:[一二三四五六七八九十]+(?:[、.):]\s*|\s+)))/;
const TASK_LABEL_START = /^\s*(?:task(?:\s+name)?|todo|action\s+item|任务(?:名称)?|事项|待办|行动项)\s*[:：-]\s*/i;

export const RULE_EXAMPLES = {
  zh: [
    "Task：完成上线检查；DDL：2026-08-20；紧急程度：高；汇报对象：Lucy；交付物：上线确认单",
    "任务：准备周报\n分组：组内运营\n周期：每周\n周期开始：2026-08-17\n周期结束：2026-12-31",
    "下周二，完成徽章考题 kickoff（独立换行识别为一个 Task，并预填下周二 DDL）",
    "每周三完成服务周报（识别为每周重复，DDL 预填为下周三）",
    "每月15日完成月度复核（识别为每月重复，DDL 预填为下个月15日）"
  ],
  en: [
    "Task: Complete release checks; DDL: 2026-08-20; Urgency: High; Report To: Lucy; Deliverable: Release approval",
    "Action item: Prepare weekly report\nGroup: Team Operations\nRecurrence: Weekly\nRecurrence Start: 2026-08-17\nRecurrence End: 2026-12-31",
    "Every Wednesday prepare the service report (Weekly; DDL defaults to next Wednesday)",
    "Monthly on the 15th complete the review (Monthly; DDL defaults to the 15th of next month)"
  ],
  fuzzy: [
    "明天完成上线检查 / finish release checks next Friday（未列入精确前缀规则的相对日期只建议）",
    "分组：服务研伐 / Group: Servce Development（若接近既有名称，只显示建议）"
  ]
};

export type DraftConfidence = "none" | "low" | "medium" | "high";
export interface DraftSuggestion {
  field: string;
  value: string;
  source?: string;
}
export interface TaskDraftCandidate {
  sourceText: string;
  taskName: string;
  groupId: string;
  groupName: string;
  flowId: string;
  flowName: string;
  ddl: string;
  recurrenceCadence: RecurrenceCadence;
  recurrenceStart: string;
  recurrenceEnd: string;
  urgency: Urgency | "";
  reportTo: string;
  managedObject: string;
  deliverable: string;
  suggestions: DraftSuggestion[];
  recognizedFields: string[];
}
export interface DraftParserContext {
  groups?: Group[];
  flows?: Flow[];
  reportToValues?: string[];
  managedObjectValues?: string[];
  referenceDate?: Date;
}

function clean(value: unknown, limit = 500): string {
  return String(value ?? "").replace(/\r\n/g, "\n").trim().slice(0, limit);
}

/** Remove lightweight Markdown decoration before applying deterministic rules. */
function textForParsing(value: unknown): string {
  return clean(value, 30_000)
    .replace(/\*+/g, "")
    .replace(/__+/g, "")
    .replace(/`+/g, "");
}

export function normalized(value: unknown): string {
  return clean(value).toLocaleLowerCase().replace(/[\s\u3000_\-—–·•:：,，.。/\\()（）\[\]【】]+/g, "");
}

const two = (value: number) => String(value).padStart(2, "0");
function isoDate(year: number, month: number, day: number): string {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? `${year}-${two(month)}-${two(day)}`
    : "";
}
function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}
const dateIso = (date: Date) => isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
const inferredYear = (value: string) => value.length === 2 ? 2000 + Number(value) : Number(value);

function referenceDay(referenceDate?: Date): Date {
  return referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
    : new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
}

function monthlyOccurrence(reference: Date, day: number, lastDay: boolean): Date | null {
  for (let offset = 1; offset <= 12; offset += 1) {
    const first = new Date(reference.getFullYear(), reference.getMonth() + offset, 1);
    if (lastDay) return new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const candidate = new Date(first.getFullYear(), first.getMonth(), day);
    if (candidate.getMonth() === first.getMonth()) return candidate;
  }
  return null;
}

export function parseNaturalRecurrenceSchedule(value: unknown, referenceDate?: Date): {
  cadence: RecurrenceCadence;
  ddl: string;
  confidence: DraftConfidence;
  source: string;
} {
  const text = clean(value, 30_000);
  const reference = referenceDay(referenceDate);
  const chineseWeekly = text.match(/每(?:个)?(?:周|星期|礼拜)(?:的)?(?:周|星期|礼拜)?\s*([一二三四五六日天])/);
  const englishWeekly = text.match(/\b(?:(?:every|each)\s+|weekly\s+(?:on\s+)?)(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  let weekdayIndex = -1;
  let source = "";
  if (chineseWeekly) {
    weekdayIndex = ({ 一: 0, 二: 1, 三: 2, 四: 3, 五: 4, 六: 5, 日: 6, 天: 6 } as Record<string, number>)[chineseWeekly[1]];
    source = chineseWeekly[0];
  } else if (englishWeekly) {
    weekdayIndex = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].indexOf(englishWeekly[1].toLocaleLowerCase());
    source = englishWeekly[0];
  }
  if (weekdayIndex >= 0) {
    const nextWeek = startOfWeek(reference);
    nextWeek.setDate(nextWeek.getDate() + 7 + weekdayIndex);
    return { cadence: "weekly", ddl: dateIso(nextWeek), confidence: "high", source };
  }

  const chineseLastDay = text.match(/每(?:个)?月(?:的)?\s*(?:最后一天|月底)/);
  const englishLastDay = text.match(/\b(?:the\s+)?last\s+day\s+of\s+(?:every|each)\s+month\b|\bmonthly\s+on\s+the\s+last\s+day\b/i);
  if (chineseLastDay || englishLastDay) {
    const occurrence = monthlyOccurrence(reference, 1, true);
    return { cadence: "monthly", ddl: occurrence ? dateIso(occurrence) : "", confidence: "high", source: (chineseLastDay || englishLastDay)?.[0] || "" };
  }
  const chineseMonthly = text.match(/每(?:个)?月(?:的)?\s*(\d{1,2})\s*(?:日|号)/);
  const englishMonthly = text.match(/\b(?:every\s+month|monthly)(?:\s+on)?(?:\s+(?:the|day))?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  const englishMonthlyReversed = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:day\s+)?of\s+(?:every|each)\s+month\b/i);
  const monthly = chineseMonthly || englishMonthly || englishMonthlyReversed;
  if (monthly) {
    const day = Number(monthly[1]);
    const occurrence = day >= 1 && day <= 31 ? monthlyOccurrence(reference, day, false) : null;
    if (occurrence) return { cadence: "monthly", ddl: dateIso(occurrence), confidence: "high", source: monthly[0] };
  }
  return { cadence: "none", ddl: "", confidence: "none", source: "" };
}

export function parseFlexibleDate(value: unknown, referenceDate?: Date): { value: string; confidence: DraftConfidence; source: string } {
  const text = clean(value, 100).toLocaleLowerCase();
  if (!text) return { value: "", confidence: "none", source: "" };
  const reference = referenceDay(referenceDate);
  const exact = text.replace(/[年/.]/g, "-").replace(/月/g, "-").replace(/[日号]/g, "")
    .match(/\b(\d{4}|\d{2})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})\b/);
  if (exact) return { value: isoDate(inferredYear(exact[1]), Number(exact[2]), Number(exact[3])), confidence: "high", source: exact[0] };

  const chinese = text.match(/(?:^|\D)(\d{1,2})\s*月\s*(\d{1,2})(?:\s*日)?/);
  if (chinese) {
    let value = isoDate(reference.getFullYear(), Number(chinese[1]), Number(chinese[2]));
    if (value && value < dateIso(reference)) value = isoDate(reference.getFullYear() + 1, Number(chinese[1]), Number(chinese[2]));
    return { value, confidence: value ? "high" : "none", source: chinese[0].trim() };
  }
  const slash = text.match(/(?:^|\D)(\d{1,2})\s*[./-]\s*(\d{1,2})(?:\D|$)/);
  if (slash) {
    let value = isoDate(reference.getFullYear(), Number(slash[1]), Number(slash[2]));
    if (value && value < dateIso(reference)) value = isoDate(reference.getFullYear() + 1, Number(slash[1]), Number(slash[2]));
    return { value, confidence: value ? "high" : "none", source: slash[0].trim() };
  }
  let offset: number | null = null;
  if (/\bday after tomorrow\b|后天/.test(text)) offset = 2;
  else if (/\btomorrow\b|明天/.test(text)) offset = 1;
  else if (/\btoday\b|今天/.test(text)) offset = 0;
  if (offset !== null) {
    const relative = new Date(reference);
    relative.setDate(relative.getDate() + offset);
    return { value: dateIso(relative), confidence: "medium", source: offset === 0 ? "today" : offset === 1 ? "tomorrow" : "day after tomorrow" };
  }

  const weekdayMap: Record<string, number> = {
    monday: 0, mon: 0, 周一: 0, 星期一: 0,
    tuesday: 1, tue: 1, tues: 1, 周二: 1, 星期二: 1,
    wednesday: 2, wed: 2, 周三: 2, 星期三: 2,
    thursday: 3, thu: 3, thur: 3, thurs: 3, 周四: 3, 星期四: 3,
    friday: 4, fri: 4, 周五: 4, 星期五: 4,
    saturday: 5, sat: 5, 周六: 5, 星期六: 5,
    sunday: 6, sun: 6, 周日: 6, 周天: 6, 星期日: 6, 星期天: 6
  };
  const chineseWeekday = text.match(/(下下周|下下星期|下下礼拜|下周|下星期|下礼拜|本周|本星期|本礼拜|这周|这星期|这礼拜|周|星期|礼拜)\s*([一二三四五六日天])/);
  if (chineseWeekday) {
    const index = ({ 一: 0, 二: 1, 三: 2, 四: 3, 五: 4, 六: 5, 日: 6, 天: 6 } as Record<string, number>)[chineseWeekday[2]];
    const weekOffset = /^下下/.test(chineseWeekday[1]) ? 2 : /^下/.test(chineseWeekday[1]) ? 1 : 0;
    const target = startOfWeek(reference);
    target.setDate(target.getDate() + weekOffset * 7 + index);
    return { value: dateIso(target), confidence: "high", source: chineseWeekday[0] };
  }
  const weekdayName = Object.keys(weekdayMap).find((name) => text.includes(name));
  if (weekdayName) {
    const target = startOfWeek(reference);
    const explicitNext = /next\s+(?:week\s+)?|下周/.test(text);
    const explicitThis = /this\s+week|本周|这周/.test(text);
    target.setDate(target.getDate() + weekdayMap[weekdayName] + (explicitNext ? 7 : 0));
    if (!explicitNext && !explicitThis && target < reference) target.setDate(target.getDate() + 7);
    return { value: dateIso(target), confidence: "medium", source: weekdayName };
  }
  return { value: "", confidence: "none", source: "" };
}

function stripLeadingDatePrefix(value: unknown): string {
  return clean(value).replace(/^\s*(?:(?:(?:下下周|下下星期|下下礼拜|下周|下星期|下礼拜|本周|本星期|本礼拜|这周|这星期|这礼拜|周|星期|礼拜)\s*[一二三四五六日天])|(?:(?:\d{4}|\d{2})\s*(?:年|[./-])\s*\d{1,2}\s*(?:月|[./-])\s*\d{1,2}\s*(?:日|号)?)|(?:\d{1,2}\s*(?:月\s*\d{1,2}\s*(?:日|号)?|[./-]\s*\d{1,2})))\s*/, "")
    .replace(/^[,，、:：;；—–-]+\s*/, "").trim();
}
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function labeledValue(text: string, labels: readonly string[]): string {
  const aliases = labels.slice().sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
  const match = text.match(new RegExp(`(?:^|\\n|[;；])\\s*(?:[-*•▪◦]\\s*)?(?:${aliases})\\s*[:：=]\\s*([^\\n;；]+)`, "i"));
  return match ? clean(match[1]) : "";
}
function fieldLine(line: string): boolean {
  return FIELD_KEYS.some((key) => LABELS[key].some((label) => new RegExp(`^\\s*${escapeRegExp(label)}\\s*[:：=]`, "i").test(line)));
}

const DELIVERABLE_NOUN = /(?:材料|报告|方案|文档|表格|清单|台账|底稿|文件|幻灯片|演示稿|ppt|邮件|记录|考题|代码|脚本|原型|模板|数据|结果|纪要|计划|合同|申请|审批|report|material|deck|presentation|document|spreadsheet|workbook|checklist|register|workpaper|file|email|record|question|code|script|prototype|template|data|result|minutes|plan|contract|application|approval)/i;

/**
 * Conservative fallback for simple phrases such as “完成汇报材料”. It only
 * fills the field when the object contains a recognisable deliverable noun;
 * ambiguous actions remain blank for user review.
 */
function inferDeliverable(text: string): string {
  const explicit = labeledValue(text, LABELS.deliverable);
  if (explicit) return clean(explicit, 500);
  const fragments = text.split(/\n|[;；]/).map((line) => stripLeadingDatePrefix(line.replace(BULLET, "")).trim()).filter(Boolean);
  for (const fragment of fragments) {
    const prefix = fragment.match(/^(?:完成|提交|输出|编写|撰写|制作|准备|交付|提供|整理|更新|发布|产出)\s*(?:一份|一个|一套)?\s*([^，,。.!！]+)$/i)
      || fragment.match(/^(?:complete|finish|submit|deliver|write|draft|prepare|produce|create|update)\s+(?:the\s+|a\s+|an\s+)?([^,.;!]+)$/i);
    const suffix = fragment.match(/^([^，,。.!！]+?)(?:必须|需要|得|要)?(?:写完|做完|完成|提交|交付)$/i);
    const candidate = clean(prefix?.[1] || suffix?.[1] || "", 500)
      .replace(/^[：:,，、\s]+|[：:,，、\s]+$/g, "");
    if (candidate && DELIVERABLE_NOUN.test(candidate)) return candidate;
  }
  return "";
}

export function editDistance(left: unknown, right: unknown): number {
  const a = normalized(left);
  const b = normalized(right);
  if (!a) return b.length;
  if (!b) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_item, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

interface KnownMatch<T> { item: T | null; confidence: DraftConfidence; suggestion: string }
function matchKnown<T>(rawValue: string, items: T[], fullText: string, nameOf: (item: T) => string): KnownMatch<T> {
  const valueKey = normalized(rawValue);
  const textKey = normalized(fullText);
  const exact = items.find((item) => {
    const key = normalized(nameOf(item));
    return key && (valueKey ? key === valueKey : textKey.includes(key));
  });
  if (exact) return { item: exact, confidence: "high", suggestion: "" };
  if (!valueKey) return { item: null, confidence: "none", suggestion: "" };
  const contained = items.find((item) => {
    const key = normalized(nameOf(item));
    return key && (valueKey.includes(key) || key.includes(valueKey)) && Math.min(key.length, valueKey.length) >= 3;
  });
  if (contained) return { item: null, confidence: "medium", suggestion: clean(nameOf(contained), 160) };
  const nearest = items.map((item) => ({ item, distance: editDistance(valueKey, nameOf(item)), name: clean(nameOf(item), 160) })).sort((a, b) => a.distance - b.distance)[0];
  const threshold = valueKey.length >= 7 ? 2 : valueKey.length >= 3 ? 1 : 0;
  return nearest && nearest.distance <= threshold
    ? { item: null, confidence: "low", suggestion: nearest.name }
    : { item: null, confidence: "none", suggestion: "" };
}

export function splitCandidates(value: unknown): string[] {
  const text = clean(value, 30_000);
  if (!text) return [""];
  const lines = text.split("\n");
  const starts: number[] = [];
  lines.forEach((line, index) => {
    const withoutBullet = line.replace(BULLET, "");
    if (TASK_LABEL_START.test(withoutBullet) || (BULLET.test(line) && !fieldLine(withoutBullet))) starts.push(index);
  });
  if (starts.length >= 2) {
    return starts.map((start, index) => {
      const end = index + 1 < starts.length ? starts[index + 1] : lines.length;
      return lines.slice(start, end).map((line, lineIndex) => lineIndex === 0 ? line.replace(BULLET, "") : line).join("\n").trim();
    }).filter(Boolean);
  }
  const groups: string[] = [];
  let current: string[] = [];
  let leadingFields: string[] = [];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const withoutBullet = trimmed.replace(BULLET, "");
    if (fieldLine(withoutBullet)) {
      if (current.length) current.push(trimmed); else leadingFields.push(trimmed);
      return;
    }
    if (current.length) groups.push(current.join("\n"));
    current = leadingFields.concat(withoutBullet);
    leadingFields = [];
  });
  if (current.length) groups.push(current.join("\n"));
  if (groups.length >= 2) return groups;
  const paragraphs = text.split(/\n\s*\n+/).map((part) => part.trim()).filter(Boolean);
  const likely = paragraphs.filter((part) => TASK_LABEL_START.test(part) || /(?:ddl|deadline|due|截止|交付物|deliverable)\s*[:：=]/i.test(part));
  return paragraphs.length > 1 && likely.length >= 2 ? paragraphs : [text];
}

function firstTaskName(text: string): string {
  const explicit = labeledValue(text, LABELS.taskName);
  if (explicit) return explicit.slice(0, 160);
  const lines = text.split("\n").map((line) => line.replace(BULLET, "").trim()).filter(Boolean);
  let line = lines.find((item) => !fieldLine(item)) || "";
  line = stripLeadingDatePrefix(line.replace(TASK_LABEL_START, ""))
    .replace(/^每(?:个)?(?:周|星期|礼拜)(?:的)?(?:周|星期|礼拜)?\s*[一二三四五六日天]\s*/, "")
    .replace(/^每(?:个)?月(?:的)?\s*(?:(?:\d{1,2})\s*(?:日|号)|最后一天|月底)\s*/, "")
    .replace(/^\s*(?:(?:every|each)\s+|weekly\s+(?:on\s+)?)(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\s*/i, "")
    .replace(/^\s*(?:every\s+month|monthly)(?:\s+on)?(?:\s+(?:the|day))?\s+\d{1,2}(?:st|nd|rd|th)?\b\s*/i, "")
    .replace(/^\s*(?:the\s+)?last\s+day\s+of\s+(?:every|each)\s+month\b\s*/i, "");
  const marker = line.search(/(?:\s+|[;；]\s*)(?:ddl|deadline|due|截止|紧急程度|urgency|priority|分组|group|flow|汇报对象|report\s+to|管理对象|managed\s+object|交付物|deliverable)\s*[:：=]/i);
  if (marker > 0) line = line.slice(0, marker);
  return clean(line.replace(/[;；|]+$/, ""), 160);
}

function parseUrgency(text: string): { value: Urgency | ""; confidence: DraftConfidence } {
  const labeled = labeledValue(text, LABELS.urgency).toLocaleLowerCase();
  const source = labeled || text.toLocaleLowerCase();
  if (/^(低|low)$/.test(labeled) || /不紧急|低优|有空|not\s+urgent|low\s+priority|\blow\b/.test(source)) return { value: "low", confidence: labeled ? "high" : "medium" };
  if (/^(高|high)$/.test(labeled) || /非常紧急|紧急|高优|马上|尽快|立即|urgent|asap|high\s+priority|\bhigh\b/.test(source)) return { value: "high", confidence: labeled ? "high" : "medium" };
  if (/^(中|medium)$/.test(labeled) || /中优|一般|正常|medium|normal/.test(source)) return { value: "medium", confidence: labeled ? "high" : "medium" };
  return { value: "", confidence: "none" };
}
function parseRecurrence(text: string): { value: RecurrenceCadence; confidence: DraftConfidence } {
  const labeled = labeledValue(text, LABELS.recurrence).toLocaleLowerCase();
  const source = labeled || text.toLocaleLowerCase();
  if (/每周|每星期|weekly|every\s+week/.test(source)) return { value: "weekly", confidence: labeled ? "high" : "medium" };
  if (/每月|monthly|every\s+month/.test(source)) return { value: "monthly", confidence: labeled ? "high" : "medium" };
  if (/不重复|does\s+not\s+repeat|no\s+recurrence|\bnone\b/.test(source)) return { value: "none", confidence: "high" };
  return { value: "none", confidence: "none" };
}

function extractPerson(text: string, labels: readonly string[], knownValues: string[] = []): { value: string; confidence: DraftConfidence; suggestion: string } {
  let raw = labeledValue(text, labels);
  if (!raw && labels === LABELS.reportTo) {
    const match = text.match(/(?:向|给)\s*([A-Za-z][A-Za-z .'-]{1,50}|[\u4e00-\u9fff]{2,8})\s*汇报|report\s+to\s+([A-Za-z][A-Za-z .'-]{1,50})/i);
    raw = match ? clean(match[1] || match[2], 120) : "";
  }
  const match = matchKnown(raw, knownValues.map((name) => ({ name })), raw, (item) => item.name);
  return {
    value: match.item ? match.item.name : match.suggestion ? "" : clean(raw, 120),
    confidence: match.item ? match.confidence : raw && !match.suggestion ? "high" : match.suggestion ? "low" : "none",
    suggestion: match.suggestion
  };
}

export function parseSingle(value: unknown, context: DraftParserContext = {}): TaskDraftCandidate {
  const sourceText = clean(value, 30_000);
  const parseText = textForParsing(sourceText);
  const natural = parseNaturalRecurrenceSchedule(parseText, context.referenceDate);
  const groups = context.groups || [];
  const groupRaw = labeledValue(parseText, LABELS.groupName);
  let groupMatch = matchKnown(groupRaw, groups, parseText, (item) => item.name);
  let group = groupMatch.item;
  const matchingFlows = (context.flows || []).filter((flow) => !group || flow.groupId === group.id);
  const flowRaw = labeledValue(parseText, LABELS.flowName);
  const flowMatch = matchKnown(flowRaw, matchingFlows, parseText, (item) => item.name);
  const flow = flowMatch.item;
  if (!group && flow) {
    group = groups.find((item) => item.id === flow.groupId) || null;
    if (group) groupMatch = { item: group, confidence: "medium", suggestion: "" };
  }
  const explicitDdl = labeledValue(parseText, LABELS.ddl);
  const ddl = explicitDdl
    ? parseFlexibleDate(explicitDdl, context.referenceDate)
    : natural.ddl
      ? { value: natural.ddl, confidence: "high" as const, source: natural.source }
      : parseFlexibleDate(parseText, context.referenceDate);
  const recurrence = natural.confidence === "high"
    ? { value: natural.cadence, confidence: "high" as const }
    : parseRecurrence(parseText);
  const recurrenceStart = parseFlexibleDate(labeledValue(parseText, LABELS.recurrenceStart), context.referenceDate);
  const recurrenceEnd = parseFlexibleDate(labeledValue(parseText, LABELS.recurrenceEnd), context.referenceDate);
  const urgency = parseUrgency(parseText);
  const reportTo = extractPerson(parseText, LABELS.reportTo, context.reportToValues);
  const managedObject = extractPerson(parseText, LABELS.managedObject, context.managedObjectValues);
  const candidate: TaskDraftCandidate = {
    sourceText,
    taskName: firstTaskName(parseText),
    groupId: group?.id || "",
    groupName: group?.name || groupRaw,
    flowId: flow?.id || "",
    flowName: flow?.name || flowRaw,
    ddl: ddl.confidence === "high" ? ddl.value : "",
    recurrenceCadence: recurrence.confidence === "high" ? recurrence.value : "none",
    recurrenceStart: recurrenceStart.value || (natural.ddl && ddl.confidence === "high" ? ddl.value : ""),
    recurrenceEnd: recurrenceEnd.value,
    urgency: urgency.confidence === "high" ? urgency.value : "",
    reportTo: reportTo.value,
    managedObject: managedObject.value,
    deliverable: inferDeliverable(parseText),
    suggestions: [],
    recognizedFields: []
  };
  const recognized: Array<[string, unknown]> = [
    ["taskName", candidate.taskName], ["group", candidate.groupId], ["flow", candidate.flowId],
    ["ddl", candidate.ddl], ["recurrence", recurrence.confidence !== "none" && recurrence.value !== "none"],
    ["urgency", candidate.urgency], ["reportTo", candidate.reportTo], ["managedObject", candidate.managedObject], ["deliverable", candidate.deliverable]
  ];
  recognized.forEach(([field, found]) => { if (found) candidate.recognizedFields.push(field); });
  if (groupMatch.suggestion) candidate.suggestions.push({ field: "group", value: groupMatch.suggestion });
  if (flowMatch.suggestion) candidate.suggestions.push({ field: "flow", value: flowMatch.suggestion });
  if (reportTo.suggestion) candidate.suggestions.push({ field: "reportTo", value: reportTo.suggestion });
  if (managedObject.suggestion) candidate.suggestions.push({ field: "managedObject", value: managedObject.suggestion });
  if (ddl.confidence === "medium" && ddl.source) candidate.suggestions.push({ field: "ddlCalculated", value: ddl.value, source: ddl.source });
  if (urgency.confidence === "medium" && urgency.value) candidate.suggestions.push({ field: "urgency", value: urgency.value });
  if (recurrence.confidence === "medium" && recurrence.value !== "none") candidate.suggestions.push({ field: "recurrence", value: recurrence.value });
  return candidate;
}

export function parse(value: unknown, context: DraftParserContext = {}): TaskDraftCandidate[] {
  return splitCandidates(value).map((part) => parseSingle(part, context));
}
