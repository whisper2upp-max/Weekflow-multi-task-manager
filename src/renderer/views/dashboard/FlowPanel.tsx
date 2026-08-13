/* Flow 维度 panel：等价原 js/app.js:2141 renderFlowDashboard、
   2404 createFlowCard、2466 createFlowTableRow。
   跳时间轴走 applyDashboardFlowFilter：同时带上 Flow 所属分组筛选。 */
import * as stats from "../../../shared/stats";
import type { FlowSummary } from "../../../shared/stats";
import type { WeekflowData } from "../../../shared/types";
import { useUiStore } from "../../store/uiStore";
import {
  applyDashboardFlowFilter,
  CardRing,
  cssVars,
  EmptyState,
  groupCardVars,
  StackBars
} from "./shared";

export default function FlowPanel(props: { data: WeekflowData | null; today: string }) {
  const summaries = stats.summarizeByFlow(
    props.data?.flows,
    props.data?.groups,
    props.data?.tasks,
    props.today
  );
  return (
    <>
      <section className="dashboard-section" aria-labelledby="flow-overview-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Workflow pulse</p>
            <h2 id="flow-overview-title">Flow 进度</h2>
          </div>
          <span>按工作步骤实时统计</span>
        </div>
        <div id="flow-dashboard" className="group-dashboard flow-dashboard">
          {summaries.length === 0 ? (
            <EmptyState
              title="还没有 Flow"
              description="Flow 可把同一分组内的 Task 组织为有顺序的工作步骤。"
              buttonText="新建 Flow"
              onAction={() => useUiStore.getState().openDialog({ type: "flow" })}
            />
          ) : (
            summaries.map((item) => <FlowCard key={item.flow.id} item={item} />)
          )}
        </div>
      </section>

      <section className="dashboard-section table-section" aria-labelledby="flow-table-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Workflow numbers</p>
            <h2 id="flow-table-title">Flow 汇总</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>所属分组</th>
                <th>Flow</th>
                <th>步骤数</th>
                <th>已完成</th>
                <th>未完成</th>
                <th>逾期</th>
                <th>完成率</th>
              </tr>
            </thead>
            <tbody id="flow-summary-body">
              {summaries.length === 0 ? (
                <tr>
                  <td colSpan={7}>暂无 Flow 数据</td>
                </tr>
              ) : (
                summaries.map((item) => <FlowTableRow key={item.flow.id} item={item} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* 等价 app.js:2404 createFlowCard */
function FlowCard({ item }: { item: FlowSummary }) {
  const active = Math.max(0, item.pending - item.overdue);
  const open = () => applyDashboardFlowFilter(item.flow.id, false);
  return (
    <article
      className="group-card flow-card"
      style={groupCardVars(item.flow.color, item.completionRate)}
      tabIndex={0}
      role="button"
      aria-label={"查看 Flow " + item.flow.name}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
    >
      <div className="group-card-head">
        <div className="group-card-identity">
          <span className="group-card-emblem flow-card-emblem">F</span>
          <div className="group-card-copy">
            <strong>{item.flow.name}</strong>
            <small>
              {(item.group ? item.group.name + " · " : "") + item.total + " STEPS"}
            </small>
          </div>
        </div>
        <CardRing rate={item.completionRate} />
      </div>
      <StackBars
        completed={item.completed}
        active={active}
        overdue={item.overdue}
        total={item.total}
      />
      <div className="group-card-stats">
        <span className="completed">✓ 完成 {item.completed}</span>
        <span className="active">○ 进行 {active}</span>
        <button
          type="button"
          className="table-overdue-button overdue"
          onClick={(event) => {
            event.stopPropagation();
            applyDashboardFlowFilter(item.flow.id, true);
          }}
        >
          逾期 {item.overdue}
        </button>
      </div>
    </article>
  );
}

/* 等价 app.js:2466 createFlowTableRow */
function FlowTableRow({ item }: { item: FlowSummary }) {
  return (
    <tr>
      <td>{item.group ? item.group.name : "未知分组"}</td>
      <td>
        <button
          type="button"
          className="table-group-button"
          onClick={() => applyDashboardFlowFilter(item.flow.id, false)}
        >
          <i className="group-swatch" style={cssVars({ "--swatch": item.flow.color })} />
          <span>{item.flow.name}</span>
        </button>
      </td>
      <td>{item.total}</td>
      <td>{item.completed}</td>
      <td>{item.pending}</td>
      <td>
        <button
          type="button"
          className="table-overdue-button"
          onClick={() => applyDashboardFlowFilter(item.flow.id, true)}
        >
          {item.overdue}
        </button>
      </td>
      <td>{item.completionRate}%</td>
    </tr>
  );
}
