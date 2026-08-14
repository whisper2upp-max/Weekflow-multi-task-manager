/* Task 行：完成勾选框、标题钮、STEP 编号、DDL 基准/文案、周期徽标、周期状态机状态标、
   紧急徽标、进度钮（双击/Enter/空格）、资料钮（双击/Enter/空格）、⋯ 编辑钮，
   右侧每列 DDL 节点钮。等价 app.js:1561 createTaskRow、1802 createProgressButton、
   1838 createMaterialButton。英文文案沿用原版 isEnglish 三元分支（i18n.urgencyLabels 等）。 */
import type { CSSProperties } from "react";
import type { Flow, Group, RecurringOccurrence, Task, Urgency } from "../../../shared/types";
import * as dates from "../../../shared/date-utils";
import * as automation from "../../../shared/automation";
import { isEnglish } from "../../lib/i18n";
import {
  URGENCY_ICONS,
  URGENCY_LABELS,
  buildTaskTooltip,
  flowStyleVars,
  getTaskTimelineOccurrences,
  groupStyleVars
} from "./utils";

/* 等价原版 i18n.urgencyLabels()/cadenceLabels() 的英文映射 */
const EN_URGENCY_LABELS: Record<Urgency, string> = { high: "High", medium: "Medium", low: "Low" };
const EN_CADENCE_LABELS = { none: "Does not repeat", weekly: "Weekly", monthly: "Monthly" } as const;

type NodeState = "overdue" | "completed" | Urgency;

const NODE_SYMBOLS: Record<NodeState, string> = {
  overdue: "!",
  completed: "✓",
  high: "◆",
  medium: "●",
  low: "○"
};

interface TaskRowProps {
  task: Task;
  group: Group;
  flow: Flow | null;
  /** Flow 步骤序号（flowOrder），普通 Task 为 null */
  stepNumber: number | null;
  columns: string[];
  dayMode: boolean;
  currentColumn: string;
  today: string;
  /** 关联资料条数（materials.forTask 的长度） */
  materialCount: number;
  onToggleCompleted: (taskId: string) => void;
  onOpenTask: (taskId: string) => void;
  onOpenProgress: (taskId: string) => void;
  onOpenMaterials: (taskId: string) => void;
}

export default function TaskRow({
  task,
  group,
  flow,
  stepNumber,
  columns,
  dayMode,
  currentColumn,
  today,
  materialCount,
  onToggleCompleted,
  onOpenTask,
  onOpenProgress,
  onOpenMaterials
}: TaskRowProps) {
  const periodState = dates.getTaskPeriodState(task, today);
  const recurring = periodState.recurring;
  const overdue = periodState.overdue;
  const completed = periodState.completed;

  let rowClass = "task-row";
  if (flow) rowClass += " is-flow-task";
  if (overdue) rowClass += " is-overdue";
  if (completed) rowClass += " is-completed";
  const style: CSSProperties = { ...groupStyleVars(group), ...(flow ? flowStyleVars(flow) : {}) };

  const checkboxDisabled = recurring && !periodState.checkboxEnabled;
  /* 等价 app.js:1584-1611：勾选框 aria-label/title 的英文分支逐字沿用原版 */
  const english = isEnglish();
  const checkboxAriaLabel = english
    ? recurring
      ? periodState.checkboxEnabled
        ? (completed ? "Clear" : "Confirm") +
          " the DDL completion status for the current natural " +
          (periodState.cadence === "weekly" ? "week" : "month")
        : "This recurring Task cannot be completed in the current period"
      : completed
        ? "Restore to incomplete"
        : "Mark as completed"
    : recurring
      ? periodState.checkboxEnabled
        ? (completed ? "取消" : "确认") +
          "当前自然" +
          (periodState.cadence === "weekly" ? "周" : "月") +
          "的 DDL 完成状态"
        : "当前不在周期 Task 的可确认范围内"
      : completed
        ? "恢复为未完成"
        : "标记为已完成";

  /* 周期状态机状态标（等价 app.js:1650-1678） */
  let statusLabel;
  if (overdue) {
    statusLabel = <span className="status-label overdue">⚠ 本期逾期</span>;
  } else if (completed) {
    statusLabel = (
      <span className="status-label completed">{recurring ? "✓ 本期已完成" : "✓ 已完成"}</span>
    );
  } else if (recurring && !periodState.checkboxEnabled) {
    const text =
      today < String(task.recurrenceStart || "")
        ? "周期未开始"
        : today > String(task.recurrenceEnd || "")
          ? "周期已结束"
          : "本期无 DDL";
    statusLabel = <span className="status-label">{text}</span>;
  } else {
    statusLabel = <span className="status-label">{recurring ? "本期未完成" : "未完成"}</span>;
  }

  const hasProgress = Boolean(String(task.progressNote || "").trim());

  /* DDL 节点按列归组：日模式列=当天，周模式列=所在周周五（等价 app.js:1700-1708） */
  const occurrencesByColumn = new Map<string, RecurringOccurrence[]>();
  getTaskTimelineOccurrences(task).forEach((occurrence) => {
    const column = dayMode ? occurrence.ddl : dates.getWeekFriday(occurrence.ddl);
    const bucket = occurrencesByColumn.get(column);
    if (bucket) bucket.push(occurrence);
    else occurrencesByColumn.set(column, [occurrence]);
  });

  return (
    <div className={rowClass} data-task-id={task.id} style={style}>
      <div className="task-info">
        <div className="task-main">
          <label className="complete-check">
            <input
              type="checkbox"
              checked={completed}
              disabled={checkboxDisabled}
              aria-label={checkboxAriaLabel}
              title={
                checkboxDisabled
                  ? english
                    ? "The current period can be completed after the recurrence becomes active"
                    : "进入有效自然周期后可确认本期完成状态"
                  : undefined
              }
              onChange={() => onToggleCompleted(task.id)}
            />
          </label>
          <div className="task-title-wrap">
            <button
              className="task-title"
              type="button"
              title={task.name}
              onClick={() => onOpenTask(task.id)}
            >
              {task.name}
            </button>
            <div className="task-meta">
              {flow && (
                <span className="flow-step-label">
                  {"STEP " + String(stepNumber || 1).padStart(2, "0")}
                </span>
              )}
              <span>
                {(english ? (recurring ? "DDL Anchor " : "DDL ") : recurring ? "DDL 基准 " : "DDL ") +
                  task.ddl}
              </span>
              {recurring && (
                <span className="recurrence-badge">
                  {(english
                    ? EN_CADENCE_LABELS[periodState.cadence]
                    : automation.cadenceLabel(periodState.cadence)) +
                    " · " +
                    task.recurrenceStart +
                    (english ? " to " : " 至 ") +
                    task.recurrenceEnd}
                </span>
              )}
              {statusLabel}
            </div>
          </div>
        </div>
        <span className={"urgency-badge " + task.urgency}>
          {URGENCY_ICONS[task.urgency] +
            " " +
            (english ? EN_URGENCY_LABELS[task.urgency] : URGENCY_LABELS[task.urgency])}
        </span>
        <button
          className={"link-button progress-button" + (hasProgress ? " has-progress" : "")}
          type="button"
          title={
            english
              ? hasProgress
                ? "Double-click to edit the progress note\n" +
                  task.progressNote.replace(/\s+/g, " ").slice(0, 160)
                : "Double-click to add a progress note"
              : hasProgress
                ? "双击编辑进度记录\n" + task.progressNote.replace(/\s+/g, " ").slice(0, 160)
                : "双击添加进度记录"
          }
          aria-label={"进度记录，" + (hasProgress ? "已有内容" : "暂无内容") + "；双击或按回车编辑"}
          onDoubleClick={(event) => {
            event.preventDefault();
            onOpenProgress(task.id);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onOpenProgress(task.id);
          }}
        >
          {"进度（" + (hasProgress ? "1" : "0") + "）"}
        </button>
        <button
          className={"link-button material-button" + (materialCount > 0 ? " has-links" : "")}
          type="button"
          title="双击管理相关资料"
          aria-label={"相关资料，" + materialCount + " 条；双击或按回车管理"}
          onDoubleClick={(event) => {
            event.preventDefault();
            onOpenMaterials(task.id);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onOpenMaterials(task.id);
          }}
        >
          {"资料（" + materialCount + "）"}
        </button>
        <button
          className="task-icon-button"
          type="button"
          title={english ? "Edit Task" : "编辑 Task"}
          aria-label={(english ? "Edit " : "编辑 ") + task.name}
          onClick={() => onOpenTask(task.id)}
        >
          ⋯
        </button>
      </div>
      {columns.map((column) => {
        const cellOccurrences = occurrencesByColumn.get(column) || [];
        return (
          <div
            key={column}
            className={"timeline-cell" + (column === currentColumn ? " is-current" : "")}
            data-date={column}
          >
            {cellOccurrences.map((occurrence) => {
              const occurrenceCompleted = recurring
                ? Boolean(dates.getRecurringCompletion(task, occurrence))
                : completed;
              const occurrenceOverdue = !occurrenceCompleted && occurrence.ddl < today;
              const nodeState: NodeState = occurrenceOverdue
                ? "overdue"
                : occurrenceCompleted
                  ? "completed"
                  : task.urgency;
              return (
                <button
                  key={occurrence.ddl + occurrence.periodKey}
                  className={"task-node node-" + nodeState}
                  type="button"
                  title={buildTaskTooltip(
                    task,
                    group,
                    occurrence,
                    occurrenceCompleted,
                    occurrenceOverdue,
                    flow
                  )}
                  onClick={() => onOpenTask(task.id)}
                >
                  <i className="task-node-symbol">{NODE_SYMBOLS[nodeState]}</i>
                  <span className="task-node-label">{task.name}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
