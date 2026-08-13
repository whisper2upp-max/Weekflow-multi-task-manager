/* 资料库筛选栏：名称搜索（120ms 防抖）+ 类型/分组/Flow/Task 四个多选弹层 + 清空筛选。
   等价原 Weekflow.html:177-248 与 app.js 的 renderMaterialFilterOptions（2535-2616）、
   setMaterialFilterLabel（2495-2497）、appendMaterialFilterOption（2518-2533）、
   clearMaterialFilter（2499-2502）、clearMaterialFilters（2504-2516）。
   分组弹层含特殊值 __ungrouped__「未分组」。弹层同为非受控 <details>。 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import * as materialTools from "../../shared/materials";
import type { Flow, Group, MaterialFilters, Task, WeekflowData } from "../../shared/types";
import { useDataStore } from "../store/dataStore";
import { useUiStore } from "../store/uiStore";
import { closeDetailsMenus } from "./FilterBar";

const TYPE_COLORS: Record<string, string> = {
  document: "#5368d8",
  deliverable: "#258365",
  control: "#b5760d",
  folder: "#7352b8"
};

const UNGROUPED_ID = "__ungrouped__";

/* 等价 app.js:2495 setMaterialFilterLabel */
function countLabel(count: number): string {
  return count ? count + " 项" : "全部";
}

/* 等价 app.js:1005 getSortedGroups */
function sortedGroups(data: WeekflowData): Group[] {
  return data.groups
    .slice()
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
}

/* 等价 app.js:1011 getSortedFlows */
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

/* 等价 app.js:2555-2565 的资料 Task 选项排序：先分组 order，再 Task 名 zh-CN */
function sortedTasks(data: WeekflowData): Task[] {
  const groupsById = new Map(data.groups.map((group) => [group.id, group]));
  return data.tasks.slice().sort((left, right) => {
    const leftGroup = groupsById.get(left.groupId);
    const rightGroup = groupsById.get(right.groupId);
    return (
      Number((leftGroup && leftGroup.order) || 0) -
        Number((rightGroup && rightGroup.order) || 0) ||
      left.name.localeCompare(right.name, "zh-CN", { numeric: true })
    );
  });
}

function swatchStyle(color: string): CSSProperties {
  return { "--swatch": color } as CSSProperties;
}

export default function MaterialsFilterBar() {
  const view = useUiStore((state) => state.view);
  const filters = useUiStore((state) => state.materialFilters);
  const setMaterialFilters = useUiStore((state) => state.setMaterialFilters);
  const clearMaterialFilters = useUiStore((state) => state.clearMaterialFilters);
  const data = useDataStore((state) => state.data);

  /* 名称搜索：本地草稿 + 120ms 防抖（等价 app.js:374-380）；store 外部重置时同步回输入框 */
  const [nameDraft, setNameDraft] = useState(filters.name);
  const committedNameRef = useRef(filters.name);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (filters.name !== committedNameRef.current) {
      committedNameRef.current = filters.name;
      setNameDraft(filters.name);
    }
  }, [filters.name]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) window.clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleNameInput = (value: string): void => {
    setNameDraft(value);
    if (debounceTimerRef.current !== null) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      const next = value.trim();
      committedNameRef.current = next;
      setNameDraft(next);
      useUiStore.getState().setMaterialFilters({ name: next });
    }, 120);
  };

  const groups = data ? sortedGroups(data) : [];
  const flows = data ? sortedFlows(data) : [];
  const tasks = data ? sortedTasks(data) : [];
  const groupsById = new Map((data ? data.groups : []).map((group) => [group.id, group]));
  const flowsById = new Map((data ? data.flows : []).map((flow) => [flow.id, flow]));

  /* 多选变更（app.js:381-400）：选中数组按选项渲染顺序重排，与原 DOM 读取顺序一致 */
  const toggleInOrderedList = (
    current: string[],
    orderedValues: string[],
    value: string,
    checked: boolean
  ): string[] => {
    const selected = new Set(current);
    if (checked) selected.add(value);
    else selected.delete(value);
    return orderedValues.filter((item) => selected.has(item));
  };

  const handleTypeToggle = (value: string, checked: boolean): void => {
    setMaterialFilters({
      types: toggleInOrderedList(
        filters.types,
        materialTools.TYPES,
        value,
        checked
      ) as MaterialFilters["types"]
    });
  };

  const handleTaskToggle = (value: string, checked: boolean): void => {
    setMaterialFilters({
      taskIds: toggleInOrderedList(filters.taskIds, tasks.map((task) => task.id), value, checked)
    });
  };

  const handleFlowToggle = (value: string, checked: boolean): void => {
    setMaterialFilters({
      flowIds: toggleInOrderedList(filters.flowIds, flows.map((flow) => flow.id), value, checked)
    });
  };

  const handleGroupToggle = (value: string, checked: boolean): void => {
    const ordered = groups.map((group) => group.id).concat(UNGROUPED_ID);
    setMaterialFilters({
      groupIds: toggleInOrderedList(filters.groupIds, ordered, value, checked)
    });
  };

  return (
    <section
      id="materials-filter-bar"
      className="filter-bar materials-filter-bar"
      aria-label="资料库筛选"
      hidden={view !== "materials"}
    >
      <label className="search-field materials-search-field" htmlFor="material-filter-name">
        <span aria-hidden="true">⌕</span>
        <input
          id="material-filter-name"
          type="search"
          autoComplete="off"
          placeholder="搜索资料名称"
          value={nameDraft}
          onChange={(event) => handleNameInput(event.target.value)}
        />
        <kbd>⌘ K</kbd>
      </label>

      <details className="filter-menu" id="material-type-filter">
        <summary>
          <span>类型</span>
          <b id="material-filter-type-label">{countLabel(filters.types.length)}</b>
        </summary>
        <div className="filter-popover">
          <div className="filter-popover-head">
            <strong>筛选资料类型</strong>
            <button type="button" data-action="clear-material-types" onClick={() => setMaterialFilters({ types: [] })}>
              清空
            </button>
          </div>
          <div id="material-filter-types" className="check-list">
            {materialTools.TYPES.map((type) => (
              <label className="check-option" key={type}>
                <input
                  type="checkbox"
                  value={type}
                  data-material-filter-type="true"
                  checked={filters.types.includes(type)}
                  onChange={(event) => handleTypeToggle(type, event.target.checked)}
                />
                <i className="group-swatch" style={swatchStyle(TYPE_COLORS[type])}></i>
                <span>{materialTools.typeLabel(type)}</span>
              </label>
            ))}
          </div>
        </div>
      </details>

      <details className="filter-menu" id="material-group-filter">
        <summary>
          <span>分组</span>
          <b id="material-filter-group-label">{countLabel(filters.groupIds.length)}</b>
        </summary>
        <div className="filter-popover">
          <div className="filter-popover-head">
            <strong>筛选分组</strong>
            <button type="button" data-action="clear-material-groups" onClick={() => setMaterialFilters({ groupIds: [] })}>
              清空
            </button>
          </div>
          <div id="material-filter-groups" className="check-list">
            {groups.map((group) => (
              <label className="check-option" key={group.id}>
                <input
                  type="checkbox"
                  value={group.id}
                  data-material-filter-group="true"
                  checked={filters.groupIds.includes(group.id)}
                  onChange={(event) => handleGroupToggle(group.id, event.target.checked)}
                />
                <i className="group-swatch" style={swatchStyle(group.color)}></i>
                <span>{group.name}</span>
              </label>
            ))}
            <label className="check-option">
              <input
                type="checkbox"
                value={UNGROUPED_ID}
                data-material-filter-group="true"
                checked={filters.groupIds.includes(UNGROUPED_ID)}
                onChange={(event) => handleGroupToggle(UNGROUPED_ID, event.target.checked)}
              />
              <i className="group-swatch" style={swatchStyle("#9aa4b7")}></i>
              <span>未分组</span>
            </label>
          </div>
        </div>
      </details>

      <details className="filter-menu" id="material-flow-filter">
        <summary>
          <span>Flow</span>
          <b id="material-filter-flow-label">{countLabel(filters.flowIds.length)}</b>
        </summary>
        <div className="filter-popover filter-popover-wide">
          <div className="filter-popover-head">
            <strong>筛选 Flow</strong>
            <button type="button" data-action="clear-material-flows" onClick={() => setMaterialFilters({ flowIds: [] })}>
              清空
            </button>
          </div>
          <div id="material-filter-flows" className="check-list">
            {flows.map((flow) => {
              const group = groupsById.get(flow.groupId);
              return (
                <label className="check-option" key={flow.id}>
                  <input
                    type="checkbox"
                    value={flow.id}
                    data-material-filter-flow="true"
                    checked={filters.flowIds.includes(flow.id)}
                    onChange={(event) => handleFlowToggle(flow.id, event.target.checked)}
                  />
                  <i className="group-swatch" style={swatchStyle(flow.color)}></i>
                  <span>{[group && group.name, flow.name].filter(Boolean).join(" / ")}</span>
                </label>
              );
            })}
            {flows.length === 0 && <p className="filter-empty">暂无 Flow</p>}
          </div>
        </div>
      </details>

      <details className="filter-menu" id="material-task-filter">
        <summary>
          <span>Task</span>
          <b id="material-filter-task-label">{countLabel(filters.taskIds.length)}</b>
        </summary>
        <div className="filter-popover filter-popover-wide">
          <div className="filter-popover-head">
            <strong>筛选 Task</strong>
            <button type="button" data-action="clear-material-tasks" onClick={() => setMaterialFilters({ taskIds: [] })}>
              清空
            </button>
          </div>
          <div id="material-filter-tasks" className="check-list">
            {tasks.map((task) => {
              const group = groupsById.get(task.groupId);
              const flow = task.flowId ? flowsById.get(task.flowId) : null;
              return (
                <label className="check-option" key={task.id}>
                  <input
                    type="checkbox"
                    value={task.id}
                    data-material-filter-task="true"
                    checked={filters.taskIds.includes(task.id)}
                    onChange={(event) => handleTaskToggle(task.id, event.target.checked)}
                  />
                  {group ? <i className="group-swatch" style={swatchStyle(group.color)}></i> : null}
                  <span>{[group && group.name, flow && flow.name, task.name].filter(Boolean).join(" / ")}</span>
                </label>
              );
            })}
            {tasks.length === 0 && <p className="filter-empty">暂无 Task</p>}
          </div>
        </div>
      </details>

      <button
        className="text-button"
        type="button"
        data-action="clear-material-filters"
        onClick={() => {
          clearMaterialFilters();
          closeDetailsMenus();
        }}
      >
        清空筛选
      </button>
    </section>
  );
}
