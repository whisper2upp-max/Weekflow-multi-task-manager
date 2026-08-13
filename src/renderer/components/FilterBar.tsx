/* 时间轴筛选栏：搜索（120ms 防抖）、分组多选 / Flow 单选 / 状态单选 / 紧急程度单选弹层、
   仅看逾期、清空筛选、数据操作（导出看板报告 + ••• 批量录入/数据备份菜单）。
   等价原 Weekflow.html:64-175 与 app.js 的 renderFilterControls（811-822）、
   renderGroupFilterOptions（824-850）、renderFlowFilterOptions（870-910）、
   renderStatusFilterOptions（912-929）、renderUrgencyFilterOptions（931-949）、
   分组变更联动（310-326）、单选变更联动（464-486）。
   <details> 弹层不做受控：与原 DOM 一致由浏览器管理 open 状态，收起走 DOM。 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import * as schema from "../../shared/schema";
import type { Flow, Group, TaskFilters, WeekflowData } from "../../shared/types";
import { useDataStore } from "../store/dataStore";
import { useUiStore } from "../store/uiStore";
import {
  downloadTaskTemplate,
  exportDashboardReport,
  exportTaskImportData
} from "../lib/exporters";
import { pickFile } from "../lib/files";
import { pickAndImportTaskExcel } from "../lib/importTaskExcel";

/** 等价 app.js:5817 closeDetailsMenus：收起所有打开的 <details> 弹层。 */
export function closeDetailsMenus(): void {
  document
    .querySelectorAll<HTMLDetailsElement>("details[open]")
    .forEach((details) => {
      details.open = false;
    });
}

const STATUS_OPTIONS: { value: string; label: string; color: string | null }[] = [
  { value: "all", label: "全部状态", color: null },
  { value: "pending", label: "未完成", color: "#5368d8" },
  { value: "completed", label: "已完成", color: "#258365" }
];

const URGENCY_OPTIONS: { value: string; label: string; color: string | null }[] = [
  { value: "all", label: "全部紧急程度", color: null },
  { value: "high", label: "高", color: "#cf434d" },
  { value: "medium", label: "中", color: "#b5760d" },
  { value: "low", label: "低", color: "#16899c" }
];

const STATUS_LABELS: Record<string, string> = { pending: "未完成", completed: "已完成" };
const URGENCY_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };

/* 等价 app.js:1005 getSortedGroups */
function sortedGroups(data: WeekflowData): Group[] {
  return data.groups
    .slice()
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
}

/* 等价 app.js:1011 getSortedFlows（先按所属分组 order，再按自身 order） */
function sortedFlows(data: WeekflowData): Flow[] {
  const groupsById = new Map(data.groups.map((group) => [group.id, group]));
  return data.flows.slice().sort((left, right) => {
    if (left.groupId !== right.groupId) {
      const leftGroup = groupsById.get(left.groupId);
      const rightGroup = groupsById.get(right.groupId);
      const groupDifference =
        Number((leftGroup && leftGroup.order) || 0) -
        Number((rightGroup && rightGroup.order) || 0);
      if (groupDifference) return groupDifference;
    }
    return Number(left.order || 0) - Number(right.order || 0);
  });
}

function swatchStyle(color: string): CSSProperties {
  return { "--swatch": color } as CSSProperties;
}

export default function FilterBar() {
  const view = useUiStore((state) => state.view);
  const filters = useUiStore((state) => state.filters);
  const setFilters = useUiStore((state) => state.setFilters);
  const clearFilters = useUiStore((state) => state.clearFilters);
  const data = useDataStore((state) => state.data);

  /* 搜索框：本地草稿即时回显，120ms 防抖后才写入 store（等价 app.js:292-298）；
     store 被外部重置（如 Excel 导入清筛选）时同步回输入框。 */
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const committedSearchRef = useRef(filters.search);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (filters.search !== committedSearchRef.current) {
      committedSearchRef.current = filters.search;
      setSearchDraft(filters.search);
    }
  }, [filters.search]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) window.clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleSearchInput = (value: string): void => {
    setSearchDraft(value);
    if (debounceTimerRef.current !== null) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      const next = value.trim();
      committedSearchRef.current = next;
      setSearchDraft(next);
      useUiStore.getState().setFilters({ search: next });
    }, 120);
  };

  const groups = data ? sortedGroups(data) : [];
  const flows = data ? sortedFlows(data) : [];
  const groupsById = new Map((data ? data.groups : []).map((group) => [group.id, group]));
  const selectedFlow = flows.find((flow) => flow.id === filters.flowId) || null;

  /* 分组多选变更（app.js:310-326）：选中集变化后，若当前 Flow 筛选的分组不再被选中则重置 Flow 筛选 */
  const handleGroupToggle = (groupId: string, checked: boolean): void => {
    const selected = new Set(filters.groupIds);
    if (checked) selected.add(groupId);
    else selected.delete(groupId);
    const nextGroupIds = groups
      .map((group) => group.id)
      .filter((id) => selected.has(id));
    const patch: Partial<TaskFilters> = { groupIds: nextGroupIds };
    if (selectedFlow && nextGroupIds.length && !nextGroupIds.includes(selectedFlow.groupId)) {
      patch.flowId = "all";
    }
    setFilters(patch);
  };

  /* Flow 单选变更（app.js:464-477）：选中具体 Flow 且分组筛选未含其分组时，自动锁定为该分组 */
  const handleFlowChange = (value: string): void => {
    const patch: Partial<TaskFilters> = { flowId: value };
    const flow = flows.find((item) => item.id === value) || null;
    if (flow && filters.groupIds.length && !filters.groupIds.includes(flow.groupId)) {
      patch.groupIds = [flow.groupId];
    }
    setFilters(patch);
    closeDetailsMenus();
  };

  const handleStatusChange = (value: string): void => {
    setFilters({ status: value });
    closeDetailsMenus();
  };

  const handleUrgencyChange = (value: string): void => {
    setFilters({ urgency: value });
    closeDetailsMenus();
  };

  /* 从 JSON 恢复（app.js:5771 importJsonFile）：选文件 → 解析校验 → 组件层 confirm → store 导入。
     恢复前自动备份由主进程轮换备份覆盖，无需单独处理。 */
  const handleImportJson = async (): Promise<void> => {
    closeDetailsMenus();
    const file = await pickFile([{ name: "JSON 备份", extensions: ["json"] }]);
    if (!file) return;
    const text = new TextDecoder("utf-8").decode(file.data);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      useUiStore
        .getState()
        .pushToast("导入失败：" + (error instanceof Error ? error.message : String(error)), "error");
      return;
    }
    const checked = schema.validateData(parsed);
    if (!checked.ok) {
      useUiStore
        .getState()
        .pushToast("导入失败：" + checked.errors.slice(0, 6).join("；"), "error");
      return;
    }
    const confirmed = window.confirm(
      "确认用该备份替换当前数据？将导入 " +
        checked.data.groups.length +
        " 个分组和 " +
        checked.data.tasks.length +
        " 条 Task、" +
        checked.data.materials.length +
        " 条资料。"
    );
    if (!confirmed) return;
    await useDataStore.getState().importJsonBackup(text);
  };

  const flowLabel =
    filters.flowId === "none" ? "未加入" : selectedFlow ? selectedFlow.name : "全部";
  const statusLabel = filters.status === "all" ? "全部" : STATUS_LABELS[filters.status];
  const urgencyLabel = filters.urgency === "all" ? "全部" : URGENCY_LABELS[filters.urgency];

  return (
    <section id="filter-bar" className="filter-bar" aria-label="筛选与数据操作" hidden={view !== "timeline"}>
      <label className="search-field" htmlFor="filter-search">
        <span aria-hidden="true">⌕</span>
        <input
          id="filter-search"
          type="search"
          autoComplete="off"
          placeholder="搜索 Task、Flow、进度、交付物或资料"
          value={searchDraft}
          onChange={(event) => handleSearchInput(event.target.value)}
        />
        <kbd>⌘ K</kbd>
      </label>

      <details className="filter-menu" id="group-filter">
        <summary>
          <span>分组</span>
          <b id="group-filter-count">{filters.groupIds.length ? filters.groupIds.length + " 个" : "全部"}</b>
        </summary>
        <div className="filter-popover">
          <div className="filter-popover-head">
            <strong>筛选分组</strong>
            <button type="button" data-action="clear-groups" onClick={() => setFilters({ groupIds: [] })}>
              清空
            </button>
          </div>
          <div id="group-filter-options" className="check-list">
            {groups.length === 0 ? (
              <p className="filter-empty">还没有分组</p>
            ) : (
              groups.map((group) => (
                <label className="check-option" key={group.id}>
                  <input
                    type="checkbox"
                    value={group.id}
                    data-group-filter="true"
                    checked={filters.groupIds.includes(group.id)}
                    onChange={(event) => handleGroupToggle(group.id, event.target.checked)}
                  />
                  <i className="group-swatch" style={swatchStyle(group.color)}></i>
                  <span>{group.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </details>

      <details className="filter-menu" id="flow-filter">
        <summary>
          <span>Flow</span>
          <b id="filter-flow-label">{flowLabel}</b>
        </summary>
        <div className="filter-popover">
          <div className="filter-popover-head">
            <strong>筛选 Flow</strong>
            <button type="button" data-action="clear-flow-filter" onClick={() => setFilters({ flowId: "all" })}>
              清空
            </button>
          </div>
          <div id="filter-flow-options" className="check-list single-choice-list">
            <label className="check-option choice-option">
              <input
                type="radio"
                name="timeline-flowId"
                value="all"
                data-timeline-filter="flowId"
                checked={filters.flowId === "all"}
                onChange={() => handleFlowChange("all")}
              />
              <span>全部 Flow</span>
            </label>
            <label className="check-option choice-option">
              <input
                type="radio"
                name="timeline-flowId"
                value="none"
                data-timeline-filter="flowId"
                checked={filters.flowId === "none"}
                onChange={() => handleFlowChange("none")}
              />
              <i className="group-swatch" style={swatchStyle("#9aa4b7")}></i>
              <span>未加入 Flow</span>
            </label>
            {flows.map((flow) => {
              const group = groupsById.get(flow.groupId);
              return (
                <label className="check-option choice-option" key={flow.id}>
                  <input
                    type="radio"
                    name="timeline-flowId"
                    value={flow.id}
                    data-timeline-filter="flowId"
                    checked={filters.flowId === flow.id}
                    onChange={() => handleFlowChange(flow.id)}
                  />
                  <i className="group-swatch" style={swatchStyle(flow.color)}></i>
                  <span>{[group && group.name, flow.name].filter(Boolean).join(" / ")}</span>
                </label>
              );
            })}
          </div>
        </div>
      </details>
      <input id="filter-flow" type="hidden" value={filters.flowId} readOnly />

      <details className="filter-menu" id="status-filter">
        <summary>
          <span>状态</span>
          <b id="filter-status-label">{statusLabel}</b>
        </summary>
        <div className="filter-popover filter-popover-compact">
          <div className="filter-popover-head">
            <strong>筛选状态</strong>
            <button type="button" data-action="clear-status-filter" onClick={() => setFilters({ status: "all" })}>
              清空
            </button>
          </div>
          <div id="filter-status-options" className="check-list single-choice-list">
            {STATUS_OPTIONS.map((option) => (
              <label className="check-option choice-option" key={option.value}>
                <input
                  type="radio"
                  name="timeline-status"
                  value={option.value}
                  data-timeline-filter="status"
                  checked={filters.status === option.value}
                  onChange={() => handleStatusChange(option.value)}
                />
                {option.color ? <i className="group-swatch" style={swatchStyle(option.color)}></i> : null}
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      </details>
      <input id="filter-status" type="hidden" value={filters.status} readOnly />

      <details className="filter-menu" id="urgency-filter">
        <summary>
          <span>紧急程度</span>
          <b id="filter-urgency-label">{urgencyLabel}</b>
        </summary>
        <div className="filter-popover filter-popover-compact">
          <div className="filter-popover-head">
            <strong>筛选紧急程度</strong>
            <button type="button" data-action="clear-urgency-filter" onClick={() => setFilters({ urgency: "all" })}>
              清空
            </button>
          </div>
          <div id="filter-urgency-options" className="check-list single-choice-list">
            {URGENCY_OPTIONS.map((option) => (
              <label className="check-option choice-option" key={option.value}>
                <input
                  type="radio"
                  name="timeline-urgency"
                  value={option.value}
                  data-timeline-filter="urgency"
                  checked={filters.urgency === option.value}
                  onChange={() => handleUrgencyChange(option.value)}
                />
                {option.color ? <i className="group-swatch" style={swatchStyle(option.color)}></i> : null}
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      </details>
      <input id="filter-urgency" type="hidden" value={filters.urgency} readOnly />

      <label className="toggle-filter" htmlFor="filter-overdue">
        <input
          id="filter-overdue"
          type="checkbox"
          checked={filters.overdueOnly}
          onChange={(event) => setFilters({ overdueOnly: event.target.checked })}
        />
        <span aria-hidden="true"></span>
        仅看逾期
      </label>

      <button
        className="text-button"
        type="button"
        data-action="clear-filters"
        onClick={() => {
          clearFilters();
          closeDetailsMenus();
        }}
      >
        清空筛选
      </button>

      <div className="data-actions">
        <button
          className="button button-quiet"
          type="button"
          data-action="export-excel"
          onClick={() => void exportDashboardReport()}
        >
          <span aria-hidden="true">⇩</span> 导出看板报告
        </button>
        <details className="more-menu">
          <summary aria-label="更多数据操作">•••</summary>
          <div className="more-popover">
            <span className="menu-section-label">批量录入</span>
            <a
              data-template-kind="task"
              download
              onClick={(event) => {
                event.preventDefault();
                void downloadTaskTemplate();
              }}
            >
              下载 Excel 导入模板
            </a>
            <button
              type="button"
              data-action="export-import-data"
              onClick={() => {
                closeDetailsMenus();
                void exportTaskImportData();
              }}
            >
              按导入模板下载当前数据
            </button>
            <button
              type="button"
              data-action="import-excel"
              onClick={() => {
                closeDetailsMenus();
                void pickAndImportTaskExcel();
              }}
            >
              上传 Excel 批量导入
            </button>
            <span className="menu-section-label">数据备份</span>
            <button
              type="button"
              data-action="export-json"
              onClick={() => {
                closeDetailsMenus();
                void useDataStore.getState().exportJsonBackup();
              }}
            >
              导出 JSON 备份
            </button>
            <button type="button" data-action="import-json" onClick={() => void handleImportJson()}>
              从 JSON 恢复
            </button>
          </div>
        </details>
        <input
          id="excel-file-input"
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          hidden
        />
        <input id="json-file-input" type="file" accept=".json,application/json" hidden />
      </div>
    </section>
  );
}
