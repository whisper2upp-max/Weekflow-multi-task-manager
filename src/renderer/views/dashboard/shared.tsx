/* 看板内部共享件：等价原 js/app.js 的 percentage（1522）、applyDashboardFilter（2892）、
   applyDashboardFlowFilter（2905）、createEmptyState（1870），以及卡片通用结构件。
   颜色一律走行内 CSS 变量（--group-* / --metric-* / --swatch），计算照抄原版。 */
import type { CSSProperties } from "react";
import { rgba } from "../../../shared/utils";
import { useDataStore } from "../../store/dataStore";
import { useUiStore } from "../../store/uiStore";

/* 等价 app.js:1522 percentage */
export function percentage(value: number, total: number): number {
  return total > 0 ? Math.max(0, Math.min(100, (Number(value || 0) / total) * 100)) : 0;
}

/* 行内 CSS 变量注入（CSSProperties 无自定义属性索引签名，这里集中做一次断言） */
export function cssVars(vars: Record<string, string>): CSSProperties {
  return vars as unknown as CSSProperties;
}

/* 分组/Flow/人员卡片三件套：--group-color / --group-soft / --group-progress */
export function groupCardVars(color: string, completionRate: number): CSSProperties {
  return cssVars({
    "--group-color": color,
    "--group-soft": rgba(color, 0.1),
    "--group-progress": completionRate + "%"
  });
}

/* 等价 app.js:2892 applyDashboardFilter：重置筛选后跳时间轴 */
export function applyDashboardFilter(groupId: string | null, overdueOnly: boolean): void {
  const ui = useUiStore.getState();
  ui.setFilters({
    search: "",
    groupIds: groupId ? [groupId] : [],
    flowId: "all",
    status: "all",
    urgency: "all",
    overdueOnly: Boolean(overdueOnly)
  });
  ui.switchView("timeline");
}

/* 等价 app.js:2905 applyDashboardFlowFilter：同时带上 Flow 所属分组筛选 */
export function applyDashboardFlowFilter(flowId: string, overdueOnly: boolean): void {
  const data = useDataStore.getState().data;
  const flow = data ? data.flows.find((item) => item.id === flowId) : undefined;
  if (!flow) return;
  const ui = useUiStore.getState();
  ui.setFilters({
    search: "",
    groupIds: [flow.groupId],
    flowId: flow.id,
    status: "all",
    urgency: "all",
    overdueOnly: Boolean(overdueOnly)
  });
  ui.switchView("timeline");
}

/* 等价 app.js:1870 createEmptyState */
export function EmptyState(props: {
  title: string;
  description: string;
  buttonText: string;
  onAction: () => void;
}) {
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
        <h2>{props.title}</h2>
        <p>{props.description}</p>
        <button type="button" className="button button-primary" onClick={props.onAction}>
          {props.buttonText}
        </button>
      </div>
    </div>
  );
}

/* 卡片右上角完成率环（颜色由 --group-progress 驱动） */
export function CardRing({ rate }: { rate: number }) {
  return (
    <span className="group-card-ring">
      <b>{Math.round(rate)}%</b>
    </span>
  );
}

/* 三段堆叠条：已完成 / 进行 / 逾期，宽度 = percentage(部分, 总数) */
export function StackBars(props: {
  completed: number;
  active: number;
  overdue: number;
  total: number;
}) {
  return (
    <div className="group-card-stack">
      <i className="is-completed" style={{ width: percentage(props.completed, props.total) + "%" }} />
      <i className="is-active" style={{ width: percentage(props.active, props.total) + "%" }} />
      <i className="is-overdue" style={{ width: percentage(props.overdue, props.total) + "%" }} />
    </div>
  );
}
