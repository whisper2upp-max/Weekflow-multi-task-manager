/* Flow 行：↳ 层级符、F 徽标、N STEPS · 分组名，统计结构同分组行。
   等价 app.js:1451 createFlowRow。 */
import type { CSSProperties } from "react";
import type { Flow, Group, Task } from "../../../shared/types";
import * as stats from "../../../shared/stats";
import { flowStyleVars, groupStyleVars, percentage } from "./utils";

interface FlowRowProps {
  flow: Flow;
  group: Group;
  /** 当前 Flow 内可见的 Task（用于统计与计数） */
  tasks: Task[];
  columns: string[];
  currentColumn: string;
  today: string;
  onToggleCollapse: (flowId: string) => void;
  onEdit: (flowId: string) => void;
}

export default function FlowRow({
  flow,
  group,
  tasks,
  columns,
  currentColumn,
  today,
  onToggleCollapse,
  onEdit
}: FlowRowProps) {
  const summary = stats.summarize(tasks, today);
  const active = Math.max(0, summary.pending - summary.overdue);
  const style: CSSProperties = { ...groupStyleVars(group), ...flowStyleVars(flow) };
  return (
    <div
      className={"flow-row" + (flow.collapsed ? " is-collapsed" : "")}
      data-flow-id={flow.id}
      style={style}
    >
      <div className="flow-left">
        <span className="flow-hierarchy" aria-hidden="true">
          ↳
        </span>
        <button
          className="collapse-button flow-collapse"
          type="button"
          aria-label={flow.collapsed ? "展开 Flow" : "收起 Flow"}
          onClick={() => onToggleCollapse(flow.id)}
        >
          ⌄
        </button>
        <span className="flow-emblem" aria-hidden="true">
          F
        </span>
        <span className="flow-identity">
          <span className="flow-name" title={group.name + " / " + flow.name}>
            {flow.name}
          </span>
          <small>{summary.total + " STEPS · " + group.name}</small>
        </span>
        <span
          className="flow-progress-ring"
          style={{ "--progress": summary.completionRate + "%" } as CSSProperties}
          title={"Flow 完成率 " + summary.completionRate + "%"}
        >
          <b>{Math.round(summary.completionRate) + "%"}</b>
        </span>
        <span className="flow-stack-panel">
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
        <button
          className="flow-edit"
          type="button"
          aria-label={"编辑 Flow " + flow.name}
          onClick={() => onEdit(flow.id)}
        >
          编辑
        </button>
      </div>
      {columns.map((column) => (
        <div
          key={column}
          className={"flow-week-cell" + (column === currentColumn ? " is-current" : "")}
        />
      ))}
    </div>
  );
}
