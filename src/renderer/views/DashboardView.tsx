/* 整体看板视图：等价原 Weekflow.html 399-579（dashboard-view 静态结构）
   + js/app.js:2015 renderDashboard / 2169 toggleDashboardModule / 2175 syncDashboardModuleView。
   统计口径为全部 Task（stats.summarize* 直接吃 data.tasks），不受时间轴筛选影响。 */
import { useDataStore } from "../store/dataStore";
import { useUiStore } from "../store/uiStore";
import * as dates from "../../shared/date-utils";
import * as stats from "../../shared/stats";
import type { DashboardModule } from "../../shared/types";
import FlowPanel from "./dashboard/FlowPanel";
import GroupPanel from "./dashboard/GroupPanel";
import MetricCards from "./dashboard/MetricCards";
import PersonPanel from "./dashboard/PersonPanel";

const MODULE_TABS: { module: DashboardModule; label: string; controls: string }[] = [
  { module: "group", label: "分组进度", controls: "dashboard-group-panel" },
  { module: "flow", label: "Flow 进度", controls: "dashboard-flow-panel" },
  { module: "managedObject", label: "管理对象", controls: "dashboard-managed-panel" },
  { module: "reportTo", label: "汇报对象", controls: "dashboard-report-panel" }
];

export default function DashboardView() {
  const view = useUiStore((s) => s.view);
  const dashboardModule = useUiStore((s) => s.dashboardModule);
  const toggleDashboardModule = useUiStore((s) => s.toggleDashboardModule);
  const data = useDataStore((s) => s.data);

  const today = dates.todayISO();
  const summary = stats.summarize(data?.tasks, today);

  return (
    <section
      id="dashboard-view"
      className="view-panel"
      aria-labelledby="dashboard-heading"
      hidden={view !== "dashboard"}
    >
      <div className="view-toolbar dashboard-toolbar">
        <div className="dashboard-title-group">
          <h1 id="dashboard-heading">整体看板</h1>
          <span>全量数据 · 实时更新</span>
        </div>
        <p className="dashboard-note">
          总览始终显示；选择下方维度查看汇总，人员维度可一键导出 Task 状态。
        </p>
      </div>

      <MetricCards
        summary={summary}
        groupCount={data ? data.groups.length : 0}
        flowCount={data ? data.flows.length : 0}
      />

      <section className="dashboard-module-switch" aria-labelledby="dashboard-module-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Dashboard views</p>
            <h2 id="dashboard-module-title">进度汇总维度</h2>
          </div>
          <span id="dashboard-scope">
            {/* 单一表达式（等价原版 textContent 拼接）：observer 的复合替换需要完整字符串 */}
            {"统计全部 " + summary.total + " 条 Task（不受时间轴筛选影响）"}
          </span>
        </div>
        <div
          id="dashboard-module-nav"
          className="segmented dashboard-module-tabs"
          role="group"
          aria-label="整体看板功能切换"
        >
          {MODULE_TABS.map((tab) => {
            const active = dashboardModule === tab.module;
            return (
              <button
                key={tab.module}
                type="button"
                data-action="toggle-dashboard-module"
                data-dashboard-module={tab.module}
                aria-controls={tab.controls}
                aria-expanded={active}
                aria-pressed={active}
                className={active ? "is-active" : undefined}
                onClick={() => toggleDashboardModule(tab.module)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <p className="dashboard-module-hint">
          点击按钮显示一个维度；再次点击当前按钮可收起，返回仅看总览。
        </p>
      </section>

      <div id="dashboard-module-region" aria-live="polite">
        <div
          id="dashboard-group-panel"
          className="dashboard-module-panel"
          hidden={dashboardModule !== "group"}
        >
          <GroupPanel data={data} today={today} />
        </div>

        <div
          id="dashboard-flow-panel"
          className="dashboard-module-panel"
          hidden={dashboardModule !== "flow"}
        >
          <FlowPanel data={data} today={today} />
        </div>

        <div
          id="dashboard-managed-panel"
          className="dashboard-module-panel"
          hidden={dashboardModule !== "managedObject"}
        >
          <PersonPanel field="managedObject" data={data} today={today} />
        </div>

        <div
          id="dashboard-report-panel"
          className="dashboard-module-panel"
          hidden={dashboardModule !== "reportTo"}
        >
          <PersonPanel field="reportTo" data={data} today={today} />
        </div>
      </div>
    </section>
  );
}
