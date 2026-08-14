/* 分组维度 panel：等价原 js/app.js:2120 renderGroupDashboard、
   2321 createGroupCard、2376 createGroupTableRow。
   点卡片/行内名称钮 → 跳时间轴按该分组筛选；点逾期数字 → 追加仅看逾期。 */
import * as stats from "../../../shared/stats";
import type { GroupSummary } from "../../../shared/stats";
import type { WeekflowData } from "../../../shared/types";
import { useUiStore } from "../../store/uiStore";
import {
  applyDashboardFilter,
  CardRing,
  cssVars,
  EmptyState,
  groupCardVars,
  StackBars
} from "./shared";

export default function GroupPanel(props: { data: WeekflowData | null; today: string }) {
  const summaries = stats.summarizeByGroup(props.data?.groups, props.data?.tasks, props.today);
  return (
    <>
      <section className="dashboard-section" aria-labelledby="group-overview-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Group pulse</p>
            <h2 id="group-overview-title">分组进度</h2>
          </div>
          <span>点击分组或逾期数字可返回时间轴</span>
        </div>
        <div id="group-dashboard" className="group-dashboard">
          {summaries.length === 0 ? (
            <EmptyState
              title="还没有分组"
              description="建立分组后，这里会显示精确统计和完成进度。"
              buttonText="新建分组"
              onAction={() => useUiStore.getState().openDialog({ type: "group" })}
            />
          ) : (
            summaries.map((item) => <GroupCard key={item.group.id} item={item} />)
          )}
        </div>
      </section>

      <section className="dashboard-section table-section" aria-labelledby="group-table-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Exact numbers</p>
            <h2 id="group-table-title">分组汇总</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>分组</th>
                <th>Task 总数</th>
                <th>已完成</th>
                <th>未完成</th>
                <th>逾期</th>
                <th>完成率</th>
              </tr>
            </thead>
            <tbody id="group-summary-body">
              {summaries.length === 0 ? (
                <tr>
                  <td colSpan={6}>暂无分组数据</td>
                </tr>
              ) : (
                summaries.map((item) => <GroupTableRow key={item.group.id} item={item} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* 等价 app.js:2321 createGroupCard */
function GroupCard({ item }: { item: GroupSummary }) {
  const active = Math.max(0, item.pending - item.overdue);
  const open = () => applyDashboardFilter(item.group.id, false);
  return (
    <article
      className="group-card"
      style={groupCardVars(item.group.color, item.completionRate)}
      tabIndex={0}
      role="button"
      aria-label={"查看分组 " + item.group.name}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") open();
      }}
    >
      <div className="group-card-head">
        <div className="group-card-identity">
          <span className="group-card-emblem">
            {item.group.name.trim().slice(0, 1).toUpperCase()}
          </span>
          <div className="group-card-copy">
            <strong>{item.group.name}</strong>
            <small>{item.total} TASKS</small>
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
        {/* 单一表达式字符串（等价原版 textContent 拼接）：observer 数字句式需要完整文本节点 */}
        <span className="completed">{"✓ 完成 " + item.completed}</span>
        <span className="active">{"○ 进行 " + active}</span>
        <button
          type="button"
          className="table-overdue-button overdue"
          onClick={(event) => {
            event.stopPropagation();
            applyDashboardFilter(item.group.id, true);
          }}
        >
          {"逾期 " + item.overdue}
        </button>
      </div>
    </article>
  );
}

/* 等价 app.js:2376 createGroupTableRow */
function GroupTableRow({ item }: { item: GroupSummary }) {
  return (
    <tr>
      <td>
        <button
          type="button"
          className="table-group-button"
          onClick={() => applyDashboardFilter(item.group.id, false)}
        >
          <i className="group-swatch" style={cssVars({ "--swatch": item.group.color })} />
          <span>{item.group.name}</span>
        </button>
      </td>
      <td>{item.total}</td>
      <td>{item.completed}</td>
      <td>{item.pending}</td>
      <td>
        <button
          type="button"
          className="table-overdue-button"
          onClick={() => applyDashboardFilter(item.group.id, true)}
        >
          {item.overdue}
        </button>
      </td>
      <td>{item.completionRate}%</td>
    </tr>
  );
}
