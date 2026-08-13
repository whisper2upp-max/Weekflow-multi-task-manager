/* 分组行：折叠钮、首字母徽标、名称、N TASKS、完成率环、三段堆叠条 + 计数、
   编辑钮、右侧 N 个空白格。等价 app.js:1389 createGroupRow。 */
import type { CSSProperties } from "react";
import type { Group, Task } from "../../../shared/types";
import * as stats from "../../../shared/stats";
import { groupStyleVars, percentage } from "./utils";

interface GroupRowProps {
  group: Group;
  /** 当前分组内可见的 Task（用于统计与计数） */
  tasks: Task[];
  columns: string[];
  currentColumn: string;
  /** 是否有激活筛选（堆叠条面板 title 文案区分） */
  filtered: boolean;
  today: string;
  onToggleCollapse: (groupId: string) => void;
  onEdit: (groupId: string) => void;
}

export default function GroupRow({
  group,
  tasks,
  columns,
  currentColumn,
  filtered,
  today,
  onToggleCollapse,
  onEdit
}: GroupRowProps) {
  const summary = stats.summarize(tasks, today);
  const active = Math.max(0, summary.pending - summary.overdue);
  return (
    <div
      className={"group-row" + (group.collapsed ? " is-collapsed" : "")}
      data-group-id={group.id}
      style={groupStyleVars(group)}
    >
      <div className="group-left">
        <button
          className="collapse-button"
          type="button"
          aria-label={group.collapsed ? "展开分组" : "收起分组"}
          onClick={() => onToggleCollapse(group.id)}
        >
          ⌄
        </button>
        <span className="group-emblem" aria-hidden="true">
          {group.name.trim().slice(0, 1).toUpperCase()}
        </span>
        <span className="group-identity">
          <span className="group-name" title={group.name}>
            {group.name}
          </span>
          <small>{summary.total + " TASKS"}</small>
        </span>
        <span
          className="group-progress-ring"
          style={{ "--progress": summary.completionRate + "%" } as CSSProperties}
          title={"完成率 " + summary.completionRate + "%"}
        >
          <b>{Math.round(summary.completionRate) + "%"}</b>
        </span>
        <span className="group-stack-panel" title={filtered ? "当前筛选结果统计" : "全部 Task 统计"}>
          <span className="group-stack">
            <i
              className="is-completed"
              style={{ width: percentage(summary.completed, summary.total) + "%" }}
            />
            <i className="is-active" style={{ width: percentage(active, summary.total) + "%" }} />
            <i
              className="is-overdue"
              style={{ width: percentage(summary.overdue, summary.total) + "%" }}
            />
          </span>
          <span className="group-mini-stats">
            <span className="completed-count">
              {"✓ "}
              <b>{summary.completed}</b>
            </span>
            <span className="active-count">
              {"○ "}
              <b>{active}</b>
            </span>
            <span className="overdue-count">
              {"! "}
              <b>{summary.overdue}</b>
            </span>
          </span>
        </span>
        <button className="group-edit" type="button" onClick={() => onEdit(group.id)}>
          编辑
        </button>
      </div>
      {columns.map((column) => (
        <div
          key={column}
          className={"group-week-cell" + (column === currentColumn ? " is-current" : "")}
        />
      ))}
    </div>
  );
}
