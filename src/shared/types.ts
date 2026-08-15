/**
 * Weekflow 数据模型 —— 与 Web Weekflow v2.7 数据版本 v4 等价。
 * 字段语义、默认值、长度限制见 src/shared/schema.ts（Zod 校验与归一化）。
 */

export interface WeekflowData {
  version: number; // 恒为 4
  groups: Group[];
  flows: Flow[];
  tasks: Task[];
  materials: Material[];
  notes: QuickNote[];
  preferences: WeekflowPreferences;
  updatedAt: string; // 完整 ISO 时间戳
}

export interface Group {
  id: string;
  name: string; // trim，≤80
  color: string; // #RRGGBB 大写
  order: number;
  collapsed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Flow {
  id: string;
  groupId: string;
  name: string; // trim，≤80，同一 groupId 内大小写不敏感唯一
  color: string;
  order: number;
  collapsed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type Urgency = "high" | "medium" | "low";
export type TaskStatus = "pending" | "completed";
export type RecurrenceCadence = "none" | "weekly" | "monthly";

export interface RecurrenceCompletion {
  periodKey: string; // weekly → 该周周一 YYYY-MM-DD；monthly → YYYY-MM
  occurrenceDdl: string; // YYYY-MM-DD
  completedAt: string; // YYYY-MM-DD（日期粒度）
}

export interface Task {
  id: string;
  groupId: string;
  flowId: string | null;
  flowOrder: number | null; // ≥1；无 flowId 时恒 null
  name: string; // trim，≤160
  reportTo: string; // trim，≤120（必填）
  managedObject: string; // trim，≤160
  deliverable: string; // trim，≤500（必填）
  ddl: string; // YYYY-MM-DD
  urgency: Urgency;
  status: TaskStatus;
  completedAt: string | null; // YYYY-MM-DD（日期粒度），仅 completed 时非空
  progressNote: string; // ≤4000
  progressUpdatedAt: string | null; // 完整 ISO 时间戳，仅 progressNote 非空时存在
  progressEntries: ProgressEntry[];
  recurrenceCadence: RecurrenceCadence;
  recurrenceStart: string | null; // YYYY-MM-DD
  recurrenceEnd: string | null; // YYYY-MM-DD
  recurrenceCompletions: RecurrenceCompletion[];
  createdAt: string;
  updatedAt: string;
}

export type ProgressSourceType = "manual" | "quick-note" | "excel-import" | "legacy";

export interface ProgressEntry {
  id: string;
  contentHtml: string;
  contentText: string;
  sourceType: ProgressSourceType;
  sourceNoteId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NoteConversionType = "task" | "progress";

export interface NoteConversion {
  id: string;
  type: NoteConversionType;
  taskIds: string[];
  progressEntryIds: string[];
  skippedCount: number;
  createdAt: string;
}

export interface QuickNote {
  id: string;
  title: string;
  contentHtml: string;
  contentText: string;
  conversions: NoteConversion[];
  createdAt: string;
  updatedAt: string;
}

export type MaterialType = "document" | "deliverable" | "control" | "folder";

export interface Material {
  id: string;
  title: string; // trim，≤160
  url: string; // trim，≤3000，仅 http/https
  type: MaterialType;
  taskIds: string[];
  flowIds: string[];
  groupIds: string[];
  note: string; // trim，≤2000
  openEvents: string[]; // 完整 ISO 时间戳，字典序排序，≤500 条，90 天滚动窗口
  createdAt: string;
  updatedAt: string;
}

export const UNGROUPED_MATERIAL_KEY = "__ungrouped__" as const;
export type DocumentLibraryLayout = "list" | "group";

export interface DocumentLibraryPreferences {
  layout: DocumentLibraryLayout;
  columns: 1 | 2 | 3 | 4;
  groupOrder: string[];
}

export interface WeekflowPreferences {
  documentLibrary: DocumentLibraryPreferences;
}

/** 仅 v1/v2 旧数据迁移使用，v3 数据中不存在。 */
export interface LegacyLink {
  id: string;
  title: string;
  url: string;
}

// ---------- UI 层形状（不持久化） ----------

export interface TaskFilters {
  search: string;
  groupIds: string[];
  flowId: string; // "all" | "none" | flowId
  status: string; // "all" | TaskStatus
  urgency: string; // "all" | Urgency
  overdueOnly: boolean;
}

export interface MaterialFilters {
  name: string;
  types: MaterialType[];
  taskIds: string[];
  flowIds: string[];
  groupIds: string[]; // 可含 "__ungrouped__"
  recentOnly: boolean;
}

export interface Summary {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number; // 1 位小数百分比
}

export interface RecurringOccurrence {
  ddl: string;
  periodKey: string;
}

export interface TaskPeriodState {
  recurring: boolean;
  cadence: RecurrenceCadence;
  occurrence: RecurringOccurrence | null;
  currentOccurrence: RecurringOccurrence | null;
  checkboxEnabled: boolean;
  completed: boolean;
  completedAt: string | null;
  overdue: boolean;
}

export type ViewName = "home" | "timeline" | "dashboard" | "materials" | "notes";
export type TimelineGranularity = "week" | "day";
export type TimelineMode = "window" | "all";
export type DashboardModule = "group" | "flow" | "managedObject" | "reportTo";
