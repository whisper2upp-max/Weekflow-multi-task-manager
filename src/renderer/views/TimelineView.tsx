/* 时间轴看板视图：week（Task by Week，列为周五序列，窗口 -4/+11 周或全部范围）与
   day（Task by Day，锚点周周一至周日 7 天）两种粒度。
   等价原 app.js 的 renderTimeline（1162）/ getVisibleTasks（1084，含资料反查补入）/
   getTimelineDays|Weeks|Columns（1063-1127）/ syncTimelineGranularityChrome（1129）/
   工具栏与周↔日切换（1886-2013）/ capture|restoreTimelineViewport（685-733）。
   滚动保持：操作前捕获 scrollLeft + 锚点行偏移存入 ref，提交后在 useLayoutEffect
   立即恢复并 requestAnimationFrame 再恢复一次（双帧）。 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import type { Flow, Group, Task } from "../../shared/types";
import * as dates from "../../shared/date-utils";
import * as stats from "../../shared/stats";
import * as materialTools from "../../shared/materials";
import * as utils from "../../shared/utils";
import { timelineWeeks } from "../../shared/excel-export";
import { useDataStore } from "../store/dataStore";
import { useUiStore } from "../store/uiStore";
import ActiveFilterChips from "../components/ActiveFilterChips";
import TimelineHeader from "./timeline/TimelineHeader";
import GroupRow from "./timeline/GroupRow";
import FlowRow from "./timeline/FlowRow";
import TaskRow from "./timeline/TaskRow";
import EmptyState, { EmptyFlowRow, EmptyGroupRow } from "./timeline/EmptyState";
import { getTaskTimelineOccurrences } from "./timeline/utils";

type RowModel =
  | { kind: "group"; key: string; group: Group; tasks: Task[] }
  | { kind: "flow"; key: string; flow: Flow; group: Group; tasks: Task[] }
  | { kind: "task"; key: string; task: Task; group: Group; flow: Flow | null; stepNumber: number | null }
  | { kind: "emptyGroup"; key: string; group: Group }
  | { kind: "emptyFlow"; key: string; flow: Flow; group: Group };

/** 行内操作/周视图进出时捕获的滚动视口（锚点行 key 形如 "group:<id>"）。 */
interface CapturedViewport {
  scrollLeft: number;
  scrollTop: number;
  anchorRowKey?: string;
  /** 锚点行相对滚动容器顶部的偏移 */
  anchorOffset?: number;
}

const ROW_SELECTOR = ".group-row, .flow-row, .task-row";

function rowKeyOf(row: Element): string | undefined {
  if (!(row instanceof HTMLElement)) return undefined;
  if (row.dataset.groupId) return "group:" + row.dataset.groupId;
  if (row.dataset.flowId) return "flow:" + row.dataset.flowId;
  if (row.dataset.taskId) return "task:" + row.dataset.taskId;
  return undefined;
}

export default function TimelineView() {
  const data = useDataStore((s) => s.data);
  const view = useUiStore((s) => s.view);
  const filters = useUiStore((s) => s.filters);
  const granularity = useUiStore((s) => s.timelineGranularity);
  const timelineMode = useUiStore((s) => s.timelineMode);
  const timelineAnchor = useUiStore((s) => s.timelineAnchor);
  const timelineDayAnchor = useUiStore((s) => s.timelineDayAnchor);
  const windowPastWeeks = useUiStore((s) => s.windowPastWeeks);
  const windowFutureWeeks = useUiStore((s) => s.windowFutureWeeks);
  const scrollToCurrentWeekToken = useUiStore((s) => s.scrollToCurrentWeekToken);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  /** 行内操作触发的重渲染后要恢复的视口；提交后由 useLayoutEffect 消费 */
  const pendingRestoreRef = useRef<CapturedViewport | null>(null);

  const dayMode = granularity === "day";
  const now = new Date();
  const today = dates.todayISO(now);
  const currentColumn = dayMode ? today : dates.getWeekFriday(now);
  /* 等价 app.js:980 hasActiveFilters（直接由 filters 派生以保持响应式） */
  const hasFilters = Boolean(
    filters.search ||
      filters.groupIds.length ||
      filters.flowId !== "all" ||
      filters.status !== "all" ||
      filters.urgency !== "all" ||
      filters.overdueOnly
  );

  /* 等价 app.js:1063-1127 getTimelineDays / getTimelineWeeks / getTimelineColumns */
  const columns = useMemo<string[]>(() => {
    if (dayMode) {
      const monday = dates.startOfWeek(timelineDayAnchor || timelineAnchor);
      if (!monday) return [];
      return Array.from({ length: 7 }, (_item, index) => dates.addDays(monday, index));
    }
    if (timelineMode === "all") {
      return timelineWeeks(data ? data.tasks : [], new Date());
    }
    return dates.buildWeekRange(
      dates.addWeeksFriday(timelineAnchor, -windowPastWeeks),
      dates.addWeeksFriday(timelineAnchor, windowFutureWeeks)
    );
  }, [dayMode, timelineDayAnchor, timelineAnchor, timelineMode, data, windowPastWeeks, windowFutureWeeks]);

  /* 等价 app.js:1084 getVisibleTasks：stats.filterTasks + 搜索词资料反查补入 +
     sortTasks，再按日粒度裁剪（scopeTasksToTimelineGranularity） */
  const visibleTasks = useMemo<Task[]>(() => {
    if (!data) return [];
    const nowDate = new Date();
    const scopeToGranularity = (tasks: Task[]): Task[] => {
      if (!dayMode) return tasks;
      const start = columns[0];
      const end = columns[columns.length - 1];
      if (!start || !end) return [];
      return tasks.filter((task) =>
        getTaskTimelineOccurrences(task).some(
          (occurrence) => occurrence.ddl >= start && occurrence.ddl <= end
        )
      );
    };
    const visible = stats.filterTasks(data.tasks, filters, nowDate, data.flows);
    if (!filters.search) return scopeToGranularity(visible);
    const materialTaskIds = new Set<string>();
    const needle = utils.normalizeText(filters.search);
    data.materials.forEach((material) => {
      const haystack = utils.normalizeText(
        [material.title, material.url, materialTools.typeLabel(material.type), material.note].join(" ")
      );
      if (!haystack.includes(needle)) return;
      material.taskIds.forEach((taskId) => materialTaskIds.add(taskId));
    });
    const base = stats.filterTasks(data.tasks, { ...filters, search: "" }, nowDate, data.flows);
    const visibleIds = new Set(visible.map((task) => task.id));
    base.forEach((task) => {
      if (materialTaskIds.has(task.id) && !visibleIds.has(task.id)) {
        visible.push(task);
        visibleIds.add(task.id);
      }
    });
    return scopeToGranularity(stats.sortTasks(visible, nowDate));
  }, [data, filters, dayMode, columns]);

  /* 等价 app.js:1230-1285 renderTimeline 的分组/Flow/Task 行装配 */
  const rows = useMemo<RowModel[]>(() => {
    if (!data) return [];
    const nowDate = new Date();
    const visibleIds = new Set(visibleTasks.map((task) => task.id));
    const scopedTimeline = hasFilters || dayMode;
    const result: RowModel[] = [];
    const sortedGroups = data.groups
      .slice()
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    const groupsToShow = sortedGroups.filter(
      (group) => !scopedTimeline || visibleTasks.some((task) => task.groupId === group.id)
    );
    groupsToShow.forEach((group) => {
      const groupTasks = data.tasks.filter(
        (task) => task.groupId === group.id && visibleIds.has(task.id)
      );
      const groupFlows = data.flows
        .filter((flow) => flow.groupId === group.id)
        .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
        .filter(
          (flow) => !scopedTimeline || groupTasks.some((task) => task.flowId === flow.id)
        );
      const standaloneTasks = stats.sortTasks(
        groupTasks.filter((task) => !task.flowId),
        nowDate
      );
      result.push({ kind: "group", key: "group:" + group.id, group, tasks: groupTasks });
      if (group.collapsed) return;
      groupFlows.forEach((flow) => {
        const flowTasks = stats.sortFlowTasks(
          groupTasks.filter((task) => task.flowId === flow.id),
          nowDate
        );
        result.push({ kind: "flow", key: "flow:" + flow.id, flow, group, tasks: flowTasks });
        if (flow.collapsed) return;
        if (!flowTasks.length) {
          result.push({ kind: "emptyFlow", key: "empty-flow:" + flow.id, flow, group });
        }
        flowTasks.forEach((task) => {
          result.push({
            kind: "task",
            key: "task:" + task.id,
            task,
            group,
            flow,
            stepNumber: task.flowOrder
          });
        });
      });
      standaloneTasks.forEach((task) => {
        result.push({
          kind: "task",
          key: "task:" + task.id,
          task,
          group,
          flow: null,
          stepNumber: null
        });
      });
      if (!groupTasks.length && !groupFlows.length) {
        result.push({ kind: "emptyGroup", key: "empty-group:" + group.id, group });
      }
    });
    return result;
  }, [data, visibleTasks, hasFilters, dayMode]);

  /* ---------- 滚动视口捕获/恢复（等价 app.js:674-728） ---------- */

  const findRowByKey = (key: string): HTMLElement | null => {
    const board = boardRef.current;
    if (!board) return null;
    const separator = key.indexOf(":");
    const kind = key.slice(0, separator);
    const id = key.slice(separator + 1);
    const selector =
      kind === "group" ? ".group-row" : kind === "flow" ? ".flow-row" : kind === "task" ? ".task-row" : "";
    const attr =
      kind === "group" ? "data-group-id" : kind === "flow" ? "data-flow-id" : "data-task-id";
    if (!selector) return null;
    return board.querySelector<HTMLElement>(selector + "[" + attr + '="' + id + '"]');
  };

  /** 等价 captureTimelineViewport：未指定锚点行时取当前第一行可见行作为锚点 */
  const captureViewport = (anchorRowKey?: string): CapturedViewport => {
    const scroller = scrollRef.current;
    if (!scroller) return { scrollLeft: 0, scrollTop: 0 };
    const scrollerTop = scroller.getBoundingClientRect().top;
    let key = anchorRowKey;
    let offset: number | undefined;
    if (key) {
      const row = findRowByKey(key);
      if (row) offset = row.getBoundingClientRect().top - scrollerTop;
    }
    if (offset === undefined) {
      const board = boardRef.current;
      const rows = board ? board.querySelectorAll(ROW_SELECTOR) : [];
      for (const row of Array.from(rows)) {
        const rect = row.getBoundingClientRect();
        if (rect.bottom > scrollerTop) {
          key = rowKeyOf(row);
          offset = rect.top - scrollerTop;
          break;
        }
      }
    }
    return {
      scrollLeft: scroller.scrollLeft,
      scrollTop: scroller.scrollTop,
      anchorRowKey: offset !== undefined ? key : undefined,
      anchorOffset: offset
    };
  };

  /** 等价 restoreTimelineViewport 单次恢复（不含 window.scrollTo——桌面壳文档不滚动） */
  const restoreViewport = (viewport: CapturedViewport) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollLeft = viewport.scrollLeft;
    const anchor = viewport.anchorRowKey ? findRowByKey(viewport.anchorRowKey) : null;
    if (anchor && Number.isFinite(viewport.anchorOffset)) {
      const currentTop = anchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.scrollTop += currentTop - (viewport.anchorOffset as number);
    } else {
      scroller.scrollTop = viewport.scrollTop;
    }
  };

  /* 行内操作（勾选/折叠/展开全部）重渲染后的双帧恢复：提交后立即恢复 + 下一帧再恢复 */
  useLayoutEffect(() => {
    const pending = pendingRestoreRef.current;
    if (!pending) return;
    pendingRestoreRef.current = null;
    restoreViewport(pending);
    const frame = requestAnimationFrame(() => restoreViewport(pending));
    return () => cancelAnimationFrame(frame);
  });

  /* 周↔日切换（等价 app.js:1959-1980）：进日视图渲染后滚动归零；
     返回周视图恢复 weekTimelineViewport 后 clearWeekViewport */
  const prevGranularityRef = useRef(granularity);
  useLayoutEffect(() => {
    const prev = prevGranularityRef.current;
    prevGranularityRef.current = granularity;
    const scroller = scrollRef.current;
    if (!scroller || prev === granularity) return;
    if (granularity === "day") {
      scroller.scrollTop = 0;
      scroller.scrollLeft = 0;
      const frame = requestAnimationFrame(() => {
        scroller.scrollTop = 0;
        scroller.scrollLeft = 0;
      });
      return () => cancelAnimationFrame(frame);
    }
    const viewport = useUiStore.getState().weekTimelineViewport;
    if (viewport) {
      restoreViewport({ scrollTop: 0, ...viewport });
      const frame = requestAnimationFrame(() => restoreViewport({ scrollTop: 0, ...viewport }));
      useUiStore.getState().clearWeekViewport();
      return () => cancelAnimationFrame(frame);
    }
  }, [granularity]);

  /* scrollToCurrentWeekToken 变化（回到本周 / 从别的视图切回时间轴）→ 滚动到当前周列
     （等价 app.js:2004 scrollToCurrentWeek，尊重 prefers-reduced-motion） */
  useEffect(() => {
    if (useUiStore.getState().timelineGranularity !== "week") return;
    const scroller = scrollRef.current;
    const board = boardRef.current;
    if (!scroller || !board) return;
    const current = board.querySelector<HTMLElement>(
      '.week-head[data-week="' + dates.getWeekFriday(new Date()) + '"]'
    );
    if (!current) return;
    const leftRail =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-rail")) || 0;
    /* 只更新横向周列。这里不能启动 scrollTo({ behavior: "smooth" })：
       Chromium 会保留该动画的纵向 top 目标，用户随后滚到下方操作 Task 时，
       旧动画仍可能延迟把 timeline-scroll 拉回顶部。 */
    scroller.scrollLeft = Math.max(0, current.offsetLeft - leftRail - 12);
  }, [scrollToCurrentWeekToken]);

  /* ---------- 交互（等价 app.js:1886-2013 与各行内回调） ---------- */

  /** 等价 persistAndRenderTimelineAction：操作前捕获、数据未变则放弃恢复 */
  const runWithViewportRestore = async (
    anchorRowKey: string | undefined,
    action: () => Promise<unknown>
  ) => {
    const prevData = useDataStore.getState().data;
    pendingRestoreRef.current = captureViewport(anchorRowKey);
    await action();
    if (useDataStore.getState().data === prevData) pendingRestoreRef.current = null;
  };

  const handleToggleTask = (taskId: string) =>
    runWithViewportRestore("task:" + taskId, () =>
      useDataStore.getState().toggleTaskCompleted(taskId)
    );
  const handleToggleGroup = (groupId: string) =>
    runWithViewportRestore("group:" + groupId, () =>
      useDataStore.getState().toggleGroupCollapsed(groupId)
    );
  const handleToggleFlow = (flowId: string) =>
    runWithViewportRestore("flow:" + flowId, () =>
      useDataStore.getState().toggleFlowCollapsed(flowId)
    );
  const handleSetAllCollapsed = (collapsed: boolean) =>
    runWithViewportRestore(undefined, () => useDataStore.getState().setAllCollapsed(collapsed));

  const handleOpenTask = (taskId: string) =>
    useUiStore.getState().openDialog({ type: "task", taskId });
  const handleOpenProgress = (taskId: string) =>
    useUiStore.getState().openDialog({ type: "progress", taskId });
  const handleOpenMaterials = (taskId: string) =>
    useUiStore.getState().openDialog({ type: "link", taskId });
  const handleEditGroup = (groupId: string) =>
    useUiStore.getState().openDialog({ type: "group", groupId });
  const handleEditFlow = (flowId: string) =>
    useUiStore.getState().openDialog({ type: "flow", flowId });

  /** 双击/Enter/空格 周表头：保存周视图滚动位后进日视图（滚动归零由粒度 effect 负责） */
  const handleOpenDay = (friday: string) => {
    const viewport = captureViewport();
    useUiStore.getState().saveWeekViewport({
      scrollLeft: viewport.scrollLeft,
      anchorRowKey: viewport.anchorRowKey,
      anchorOffset: viewport.anchorOffset
    });
    useUiStore.getState().openDayTimeline(friday);
  };
  const handleReturnToWeek = () => useUiStore.getState().returnToWeekTimeline();
  const handleReturnToCurrentWeek = () => useUiStore.getState().returnToCurrentWeek();
  const handleShowAll = () => {
    useUiStore.getState().showAllTaskRange();
    useUiStore.getState().pushToast("已显示最早至最晚 DDL 的全部周范围");
  };
  const handleClearFilters = () => useUiStore.getState().clearFilters();
  const handleNewGroup = () => useUiStore.getState().openDialog({ type: "group" });

  /* ---------- 工具栏文案（等价 app.js:1129 syncTimelineGranularityChrome） ---------- */

  const rangeText = columns.length
    ? dayMode
      ? columns[0] + " — " + columns[columns.length - 1] + " · 周一至周日"
      : columns[0] + " — " + columns[columns.length - 1] + " · " + columns.length + " 周"
    : "";

  /* ---------- 看板内容（等价 renderTimeline 的空态分支与行渲染） ---------- */

  let content;
  if (!data) {
    content = null;
  } else if (!data.groups.length) {
    content = (
      <EmptyState
        title="先建立第一个分组"
        description="Task 必须归属分组。建立分组后即可开始安排周时间轴。"
        buttonText="新建分组"
        onAction={handleNewGroup}
      />
    );
  } else if (dayMode && visibleTasks.length === 0) {
    content = (
      <>
        <TimelineHeader
          columns={columns}
          granularity={granularity}
          currentColumn={currentColumn}
          onOpenDay={handleOpenDay}
        />
        {hasFilters ? (
          <EmptyState
            title="该周没有符合筛选条件的 Task"
            description="清空筛选后可继续查看该周，或返回 Task by Week 选择其他周。"
            buttonText="清空筛选"
            onAction={handleClearFilters}
          />
        ) : (
          <EmptyState
            title="该周没有 Task DDL"
            description="返回 Task by Week 后，可双击其他周的日期框继续查看。"
            buttonText="返回 Task by Week"
            onAction={handleReturnToWeek}
          />
        )}
      </>
    );
  } else if (hasFilters && visibleTasks.length === 0) {
    content = (
      <EmptyState
        title="没有符合条件的 Task"
        description="尝试减少筛选条件，或清空筛选查看全部 Task。"
        buttonText="清空筛选"
        onAction={handleClearFilters}
      />
    );
  } else {
    content = (
      <>
        <TimelineHeader
          columns={columns}
          granularity={granularity}
          currentColumn={currentColumn}
          onOpenDay={handleOpenDay}
        />
        {rows.map((row) => {
          switch (row.kind) {
            case "group":
              return (
                <GroupRow
                  key={row.key}
                  group={row.group}
                  tasks={row.tasks}
                  columns={columns}
                  currentColumn={currentColumn}
                  filtered={hasFilters}
                  today={today}
                  onToggleCollapse={handleToggleGroup}
                  onEdit={handleEditGroup}
                />
              );
            case "flow":
              return (
                <FlowRow
                  key={row.key}
                  flow={row.flow}
                  group={row.group}
                  tasks={row.tasks}
                  columns={columns}
                  currentColumn={currentColumn}
                  today={today}
                  onToggleCollapse={handleToggleFlow}
                  onEdit={handleEditFlow}
                />
              );
            case "task":
              return (
                <TaskRow
                  key={row.key}
                  task={row.task}
                  group={row.group}
                  flow={row.flow}
                  stepNumber={row.stepNumber}
                  columns={columns}
                  dayMode={dayMode}
                  currentColumn={currentColumn}
                  today={today}
                  materialCount={materialTools.forTask(data.materials, row.task.id).length}
                  onToggleCompleted={handleToggleTask}
                  onOpenTask={handleOpenTask}
                  onOpenProgress={handleOpenProgress}
                  onOpenMaterials={handleOpenMaterials}
                />
              );
            case "emptyGroup":
              return (
                <EmptyGroupRow
                  key={row.key}
                  group={row.group}
                  columns={columns}
                  currentColumn={currentColumn}
                />
              );
            case "emptyFlow":
              return (
                <EmptyFlowRow
                  key={row.key}
                  flow={row.flow}
                  group={row.group}
                  columns={columns}
                  currentColumn={currentColumn}
                />
              );
            default:
              return null;
          }
        })}
      </>
    );
  }

  const boardStyle = { "--week-count": String(columns.length) } as CSSProperties;

  return (
    <section
      id="timeline-view"
      className="view-panel"
      aria-labelledby="timeline-heading"
      hidden={view !== "timeline"}
    >
      <div className="view-toolbar timeline-toolbar">
        <div className="timeline-title-group">
          <div className="timeline-title-copy">
            <h1 id="timeline-heading">{dayMode ? "Task by Day" : "Task by Week"}</h1>
            <span id="timeline-subtitle">
              {dayMode
                ? "周一至周日 · DDL 精确到天"
                : "周一至周日 · 表头显示周五 · 双击周表头查看每天"}
            </span>
          </div>
          <div className="timeline-legend" aria-label="图例">
            <span>
              <i className="legend-dot current" />
              <span id="timeline-current-label">{dayMode ? "今天" : "本周"}</span>
            </span>
            <span>
              <i className="legend-dot overdue" />
              逾期
            </span>
            <span>
              <i className="legend-dot complete" />
              完成
            </span>
            <span id="visible-result-count">{visibleTasks.length + " 条可见 Task"}</span>
            <ActiveFilterChips />
          </div>
        </div>
        <div className="timeline-range-controls">
          <span id="range-label" className="range-label" title={rangeText}>
            {rangeText}
          </span>
          <div className="group-bulk-controls" aria-label="分组与 Flow 展开折叠控制">
            <button
              type="button"
              data-action="groups-expand-all"
              title="展开所有分组与 Flow"
              onClick={() => handleSetAllCollapsed(false)}
            >
              <span aria-hidden="true">↧</span>
              {" 展开全部"}
            </button>
            <button
              type="button"
              data-action="groups-collapse-all"
              title="折叠所有分组与 Flow"
              onClick={() => handleSetAllCollapsed(true)}
            >
              <span aria-hidden="true">↥</span>
              {" 折叠全部"}
            </button>
          </div>
          <div
            id="timeline-week-range-controls"
            className="timeline-week-range-controls"
            hidden={dayMode}
          >
            <div className="segmented" aria-label="时间轴范围控制">
              <button
                type="button"
                data-action="timeline-prev"
                title="向前 4 周"
                onClick={() => useUiStore.getState().shiftTimeline(-4)}
              >
                ←
              </button>
              <button type="button" data-action="timeline-today" onClick={handleReturnToCurrentWeek}>
                回到本周
              </button>
              <button
                type="button"
                data-action="timeline-next"
                title="向后 4 周"
                onClick={() => useUiStore.getState().shiftTimeline(4)}
              >
                →
              </button>
            </div>
            <button
              className="button button-quiet"
              type="button"
              data-action="timeline-all"
              onClick={handleShowAll}
            >
              全部范围
            </button>
          </div>
          <button
            id="timeline-week-return"
            className="button button-quiet timeline-week-return"
            type="button"
            data-action="timeline-week-return"
            hidden={!dayMode}
            onClick={handleReturnToWeek}
          >
            ← 返回 Task by Week
          </button>
        </div>
      </div>

      <div id="timeline-scroll" className="timeline-scroll" tabIndex={0} ref={scrollRef}>
        <div
          id="timeline-board"
          className={"timeline-board" + (dayMode ? " is-day-view" : "")}
          style={boardStyle}
          data-timeline-granularity={dayMode ? "day" : "week"}
          ref={boardRef}
        >
          {content}
        </div>
      </div>
    </section>
  );
}
