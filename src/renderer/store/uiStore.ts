/* UI 状态：视图、筛选、时间轴、弹窗、toast、DDL 提醒、资料选择。
   等价原 js/app.js 的 ui 对象（app.js:20-65）与视图/筛选/提醒相关函数。
   数据相关变更在 ./dataStore；本 store 只持有不持久化的 UI 状态。 */
import { create } from "zustand";
import type {
  DashboardModule,
  MaterialFilters,
  TaskFilters,
  TimelineGranularity,
  TimelineMode,
  ViewName,
  WeekflowData
} from "../../shared/types";
import type { TaskImportParseResult } from "../../shared/excel-import";
import type { MaterialImportParseResult } from "../../shared/material-excel";
import type { DueSoonEntry } from "../../shared/automation";
import * as automation from "../../shared/automation";
import * as dates from "../../shared/date-utils";
import * as materialTools from "../../shared/materials";
import * as utils from "../../shared/utils";
import { useDataStore } from "./dataStore";

export type ToastType = "success" | "error" | "warning";

export interface ToastItem {
  id: string;
  message: string;
  type?: ToastType;
  /** 毫秒；pushToast 时按类型取默认值 */
  duration: number;
}

/** 弹窗联合类型。Task/Flow/资料弹窗内的表单局部状态（草稿资料、flowColorCustomized
   等）不进 store，由组件自己管理。 */
export type DialogState =
  | { type: "group"; groupId?: string }
  | { type: "flow"; flowId?: string; groupId?: string; returnToTask?: boolean }
  | { type: "task"; taskId?: string }
  | { type: "link"; taskId: string }
  | { type: "material"; materialId?: string }
  | { type: "progress"; taskId: string }
  | { type: "deleteGroup"; groupId: string }
  | {
      type: "excelImport";
      fileName: string;
      fileSize: number;
      parsed: TaskImportParseResult;
    }
  | {
      type: "materialImport";
      fileName: string;
      fileSize: number;
      parsed: MaterialImportParseResult;
    }
  | { type: "userGuide" }
  | { type: "changelog" };

/** 周视图滚动锚点（周↔日切换时恢复滚动用）。 */
export interface WeekTimelineViewport {
  scrollLeft: number;
  /** 锚点行 key，如 "group:<id>" / "flow:<id>" / "task:<id>" */
  anchorRowKey?: string;
  /** 锚点行相对滚动容器顶部的偏移 */
  anchorOffset?: number;
}

export interface DdlReminderState {
  visible: boolean;
  items: DueSoonEntry[];
}

export interface UiStoreState {
  view: ViewName;
  /** 进入 timeline 视图时 +1，TimelineView 据此滚动到当前周 */
  scrollToCurrentWeekToken: number;

  filters: TaskFilters;
  materialFilters: MaterialFilters;

  timelineGranularity: TimelineGranularity;
  timelineMode: TimelineMode;
  /** 周列锚点（本周周五 YYYY-MM-DD） */
  timelineAnchor: string;
  /** 日视图锚点（所在周周五 YYYY-MM-DD） */
  timelineDayAnchor: string;
  weekTimelineViewport: WeekTimelineViewport | null;
  windowPastWeeks: number;
  windowFutureWeeks: number;

  dashboardModule: DashboardModule | null;
  dialog: DialogState | null;
  toasts: ToastItem[];
  ddlReminder: DdlReminderState;
  selectedMaterialIds: string[];

  /* 视图 */
  switchView(view: ViewName): void;
  /** 让 TimelineView 滚动到当前周（“回到本周”等场景） */
  requestScrollToCurrentWeek(): void;

  /* Task 筛选 */
  setFilters(patch: Partial<TaskFilters>): void;
  /** 静默重置（无 toast），供导入成功等流程使用 */
  resetFilters(): void;
  clearFilters(): void;
  hasActiveFilters(): boolean;

  /* 资料库筛选 */
  setMaterialFilters(patch: Partial<MaterialFilters>): void;
  clearMaterialFilters(): void;

  /* 时间轴 */
  setTimelineGranularity(granularity: TimelineGranularity): void;
  setTimelineMode(mode: TimelineMode): void;
  setTimelineAnchor(friday: string): void;
  setTimelineDayAnchor(friday: string): void;
  shiftTimeline(weeks: number): void;
  returnToCurrentWeek(): void;
  showAllTaskRange(): void;
  /** 进入日视图；调用前如需保留周视图滚动位请先 saveWeekViewport */
  openDayTimeline(friday: string): void;
  /** 返回周视图；不消费 weekTimelineViewport，由 TimelineView 恢复后调 clearWeekViewport */
  returnToWeekTimeline(): void;
  saveWeekViewport(viewport: WeekTimelineViewport): void;
  clearWeekViewport(): void;

  /* 看板 */
  toggleDashboardModule(module: DashboardModule): void;

  /* 弹窗 */
  openDialog(dialog: DialogState): void;
  closeDialog(): void;

  /* toast（默认时长：success 4s / error 7s / warning 6s；最多叠 5 条，超出挤掉最旧） */
  pushToast(message: string, type?: ToastType, duration?: number): string;
  dismissToast(id: string): void;

  /* DDL 临期提醒（10 秒自动关闭） */
  showDdlReminder(): void;
  closeDdlReminder(): void;

  /* 资料库批量选择 */
  toggleMaterialSelected(id: string): void;
  setSelectedMaterialIds(ids: string[]): void;
  clearSelectedMaterials(): void;

  /** dataStore.persist 成功后调用：剔除失效筛选 id / 选中 id（等价 app.js:731-778） */
  sanitize(valid: WeekflowData): void;
}

const VALID_VIEWS: ViewName[] = ["home", "timeline", "dashboard", "materials"];

function defaultFilters(): TaskFilters {
  return {
    search: "",
    groupIds: [],
    flowId: "all",
    status: "all",
    urgency: "all",
    overdueOnly: false
  };
}

function defaultMaterialFilters(): MaterialFilters {
  return {
    name: "",
    types: [],
    taskIds: [],
    flowIds: [],
    groupIds: [],
    recentOnly: false
  };
}

/* toast / 提醒定时器不进 React state，模块级管理 */
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();
let ddlReminderTimer: ReturnType<typeof setTimeout> | null = null;

function clearToastTimer(id: string): void {
  const timer = toastTimers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    toastTimers.delete(id);
  }
}

const MAX_TOASTS = 5;

export const useUiStore = create<UiStoreState>()((set, get) => ({
  view: "home",
  scrollToCurrentWeekToken: 0,

  filters: defaultFilters(),
  materialFilters: defaultMaterialFilters(),

  timelineGranularity: "week",
  timelineMode: "window",
  timelineAnchor: dates.getWeekFriday(new Date()),
  timelineDayAnchor: dates.getWeekFriday(new Date()),
  weekTimelineViewport: null,
  windowPastWeeks: 4,
  windowFutureWeeks: 11,

  dashboardModule: null,
  dialog: null,
  toasts: [],
  ddlReminder: { visible: false, items: [] },
  selectedMaterialIds: [],

  /* 等价 app.js:2920-2942：切回 timeline 时若为 day 模式重置为 week；
     切入 dashboard 时清空模块展开；每次落到 timeline 都让 TimelineView 滚动到当前周。 */
  switchView(view) {
    const nextView = VALID_VIEWS.includes(view) ? view : "home";
    set((state) => {
      const patch: Partial<UiStoreState> = { view: nextView };
      if (
        nextView === "timeline" &&
        state.view !== "timeline" &&
        state.timelineGranularity === "day"
      ) {
        patch.timelineGranularity = "week";
        patch.timelineDayAnchor = state.timelineAnchor;
        patch.weekTimelineViewport = null;
      }
      if (nextView === "dashboard" && state.view !== "dashboard") {
        patch.dashboardModule = null;
      }
      if (nextView === "timeline") {
        patch.scrollToCurrentWeekToken = state.scrollToCurrentWeekToken + 1;
      }
      return patch;
    });
  },

  requestScrollToCurrentWeek() {
    set((state) => ({ scrollToCurrentWeekToken: state.scrollToCurrentWeekToken + 1 }));
  },

  setFilters(patch) {
    set((state) => ({ filters: Object.assign({}, state.filters, patch) }));
  },

  resetFilters() {
    set({ filters: defaultFilters() });
  },

  clearFilters() {
    get().resetFilters();
    get().pushToast("筛选已清空");
  },

  hasActiveFilters() {
    const filters = get().filters;
    return Boolean(
      filters.search ||
        filters.groupIds.length ||
        filters.flowId !== "all" ||
        filters.status !== "all" ||
        filters.urgency !== "all" ||
        filters.overdueOnly
    );
  },

  setMaterialFilters(patch) {
    set((state) => ({ materialFilters: Object.assign({}, state.materialFilters, patch) }));
  },

  clearMaterialFilters() {
    set({ materialFilters: defaultMaterialFilters() });
    get().pushToast("资料库筛选已清空");
  },

  setTimelineGranularity(granularity) {
    set({ timelineGranularity: granularity });
  },

  setTimelineMode(mode) {
    set({ timelineMode: mode });
  },

  setTimelineAnchor(friday) {
    set({ timelineAnchor: friday });
  },

  setTimelineDayAnchor(friday) {
    set({ timelineDayAnchor: friday });
  },

  /* 等价 app.js:1982 shiftTimeline */
  shiftTimeline(weeks) {
    set((state) => ({
      timelineGranularity: "week",
      timelineMode: "window",
      timelineAnchor: dates.addWeeksFriday(state.timelineAnchor, weeks)
    }));
  },

  /* 等价 app.js:1989 returnToCurrentWeek */
  returnToCurrentWeek() {
    set({
      timelineGranularity: "week",
      timelineMode: "window",
      timelineAnchor: dates.getWeekFriday(new Date())
    });
    get().requestScrollToCurrentWeek();
  },

  /* 等价 app.js:1997 showAllTaskRange */
  showAllTaskRange() {
    set({ timelineGranularity: "week", timelineMode: "all" });
  },

  /* 等价 app.js:1959 openDayTimeline 的状态部分（滚动复位由 TimelineView 负责） */
  openDayTimeline(friday) {
    const normalized = dates.getWeekFriday(friday);
    if (!normalized) return;
    set({ timelineGranularity: "day", timelineDayAnchor: normalized });
  },

  /* 等价 app.js:1972 returnToWeekTimeline 的状态部分；
     weekTimelineViewport 留给 TimelineView 恢复滚动后自行 clearWeekViewport。 */
  returnToWeekTimeline() {
    if (get().timelineGranularity !== "day") return;
    set((state) => ({
      timelineGranularity: "week",
      timelineDayAnchor: state.timelineAnchor
    }));
  },

  saveWeekViewport(viewport) {
    set({ weekTimelineViewport: viewport });
  },

  clearWeekViewport() {
    set({ weekTimelineViewport: null });
  },

  toggleDashboardModule(module) {
    set((state) => ({
      dashboardModule: state.dashboardModule === module ? null : module
    }));
  },

  openDialog(dialog) {
    set({ dialog });
  },

  closeDialog() {
    set({ dialog: null });
  },

  pushToast(message, type, duration) {
    const id = utils.uid("toast");
    const finalDuration =
      Number.isFinite(Number(duration)) && duration !== undefined
        ? duration
        : type === "error"
          ? 7000
          : type === "warning"
            ? 6000
            : 4000;
    set((state) => {
      const next = state.toasts.slice();
      while (next.length >= MAX_TOASTS) {
        const oldest = next.shift();
        if (oldest) clearToastTimer(oldest.id);
      }
      next.push({ id, message, type, duration: finalDuration });
      return { toasts: next };
    });
    const timer = setTimeout(() => {
      get().dismissToast(id);
    }, finalDuration);
    toastTimers.set(id, timer);
    return id;
  },

  dismissToast(id) {
    clearToastTimer(id);
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }));
  },

  /* 等价 app.js:5866 showDdlReminder：取 dataStore 当前数据，10 秒后自动关闭 */
  showDdlReminder() {
    get().closeDdlReminder();
    const data = useDataStore.getState().data;
    if (!data) return;
    const items = automation.getDueSoonTasks(data, new Date(), 7);
    set({ ddlReminder: { visible: true, items } });
    ddlReminderTimer = setTimeout(() => {
      get().closeDdlReminder();
    }, 10000);
  },

  closeDdlReminder() {
    if (ddlReminderTimer !== null) {
      clearTimeout(ddlReminderTimer);
      ddlReminderTimer = null;
    }
    set((state) =>
      state.ddlReminder.visible
        ? { ddlReminder: Object.assign({}, state.ddlReminder, { visible: false }) }
        : {}
    );
  },

  toggleMaterialSelected(id) {
    set((state) => ({
      selectedMaterialIds: state.selectedMaterialIds.includes(id)
        ? state.selectedMaterialIds.filter((item) => item !== id)
        : state.selectedMaterialIds.concat(id)
    }));
  },

  setSelectedMaterialIds(ids) {
    set({ selectedMaterialIds: ids.slice() });
  },

  clearSelectedMaterials() {
    set({ selectedMaterialIds: [] });
  },

  /* 等价 app.js:731-778 sanitizeUiState */
  sanitize(valid) {
    const validGroupIds = new Set(valid.groups.map((group) => group.id));
    const validTaskIds = new Set(valid.tasks.map((task) => task.id));
    const validFlowIds = new Set(valid.flows.map((flow) => flow.id));
    const validMaterialIds = new Set(valid.materials.map((material) => material.id));
    set((state) => {
      const filters = Object.assign({}, state.filters, {
        groupIds: state.filters.groupIds.filter((id) => validGroupIds.has(id))
      });
      if (
        filters.flowId !== "all" &&
        filters.flowId !== "none" &&
        !validFlowIds.has(filters.flowId)
      ) {
        filters.flowId = "all";
      }
      const materialFilters = Object.assign({}, state.materialFilters, {
        taskIds: state.materialFilters.taskIds.filter((id) => validTaskIds.has(id)),
        flowIds: state.materialFilters.flowIds.filter((id) => validFlowIds.has(id)),
        groupIds: state.materialFilters.groupIds.filter(
          (id) => id === "__ungrouped__" || validGroupIds.has(id)
        ),
        types: state.materialFilters.types.filter((type) =>
          materialTools.TYPES.includes(type)
        )
      });
      return {
        filters,
        materialFilters,
        selectedMaterialIds: state.selectedMaterialIds.filter((id) =>
          validMaterialIds.has(id)
        )
      };
    });
  }
}));
