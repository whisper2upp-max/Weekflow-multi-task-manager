/* 空态与空行：等价 app.js:1870 createEmptyState、1526 createEmptyGroupRow、
   1542 createEmptyFlowRow。 */
import type { CSSProperties } from "react";
import type { Flow, Group } from "../../../shared/types";
import { flowStyleVars, groupStyleVars } from "./utils";

interface EmptyStateProps {
  title: string;
  description: string;
  buttonText: string;
  onAction: () => void;
}

/** 等价 app.js:1870 createEmptyState */
export default function EmptyState({ title, description, buttonText, onAction }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div>
        <span className="empty-state-mark">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <h2>{title}</h2>
        <p>{description}</p>
        <button className="button button-primary" type="button" onClick={onAction}>
          {buttonText}
        </button>
      </div>
    </div>
  );
}

interface EmptyRowBaseProps {
  columns: string[];
  currentColumn: string;
}

/** 等价 app.js:1526 createEmptyGroupRow */
export function EmptyGroupRow({ group, columns, currentColumn }: EmptyRowBaseProps & { group: Group }) {
  return (
    <div className="task-row" style={groupStyleVars(group)}>
      <div className="task-info">
        <div className="task-main">
          <span className="task-meta">该分组还没有 Task</span>
        </div>
      </div>
      {columns.map((column) => (
        <div
          key={column}
          className={"timeline-cell" + (column === currentColumn ? " is-current" : "")}
        />
      ))}
    </div>
  );
}

/** 等价 app.js:1542 createEmptyFlowRow */
export function EmptyFlowRow({
  flow,
  group,
  columns,
  currentColumn
}: EmptyRowBaseProps & { flow: Flow; group: Group }) {
  const style: CSSProperties = { ...groupStyleVars(group), ...flowStyleVars(flow) };
  return (
    <div className="task-row is-flow-task is-empty-flow" style={style}>
      <div className="task-info">
        <div className="task-main">
          <span className="task-meta">该 Flow 还没有步骤，可在新建或编辑 Task 时加入</span>
        </div>
      </div>
      {columns.map((column) => (
        <div
          key={column}
          className={"timeline-cell" + (column === currentColumn ? " is-current" : "")}
        />
      ))}
    </div>
  );
}
