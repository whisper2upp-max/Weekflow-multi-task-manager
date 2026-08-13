/* 顶栏：brand、主导航、未完成/逾期汇总、新建操作。等价原 Weekflow.html:15-62
   与 app.js 的 renderHeaderSummary（796-800）、syncView 顶栏部分（2950-2956）、
   openNewTask/openNewFlow 的空分组守卫（app.js:3741-3746 / 3077-3082）。
   去掉原语言切换（仅中文版）。 */
import * as stats from "../../shared/stats";
import type { ViewName } from "../../shared/types";
import { useDataStore } from "../store/dataStore";
import { useUiStore } from "../store/uiStore";

const NAV_TABS: { view: ViewName; icon: string; label: string }[] = [
  { view: "home", icon: "⌂", label: "主页" },
  { view: "timeline", icon: "⌁", label: "时间轴看板" },
  { view: "dashboard", icon: "▦", label: "整体看板" },
  { view: "materials", icon: "▤", label: "资料库" }
];

export default function Header() {
  const view = useUiStore((state) => state.view);
  const switchView = useUiStore((state) => state.switchView);
  const openDialog = useUiStore((state) => state.openDialog);
  const data = useDataStore((state) => state.data);

  const summary = stats.summarize(data ? data.tasks : null, new Date());
  /* 等价 app.js:2950：dashboard / materials 视图隐藏汇总与新建操作 */
  const simplifiedHeader = view === "dashboard" || view === "materials";

  const openNewGroup = (): void => {
    openDialog({ type: "group" });
  };

  /* 等价 app.js:3741 openNewTask 的外壳部分：无分组时提示并打开分组弹窗；
     默认分组选取（Flow 筛选分组 → 单一分组筛选 → 第一个分组）由 TaskDialog 按当前筛选推导。 */
  const openNewTask = (): void => {
    if (!data || !data.groups.length) {
      useUiStore.getState().pushToast("请先新建一个分组，再创建 Task。", "warning");
      openDialog({ type: "group" });
      return;
    }
    openDialog({ type: "task" });
  };

  /* 等价 app.js:3077 openNewFlow：空分组守卫 + 默认分组选取（当前 Flow 筛选的分组 →
     单一分组筛选 → 第一个分组），经 dialog.groupId 传给 FlowDialog。 */
  const openNewFlow = (): void => {
    if (!data || !data.groups.length) {
      useUiStore.getState().pushToast("请先新建一个分组，再创建 Flow。", "warning");
      openDialog({ type: "group" });
      return;
    }
    const filters = useUiStore.getState().filters;
    const activeFlow = data.flows.find((flow) => flow.id === filters.flowId) || null;
    const singleGroupId =
      filters.groupIds.length === 1 &&
      data.groups.some((group) => group.id === filters.groupIds[0])
        ? filters.groupIds[0]
        : null;
    const groupId = activeFlow
      ? activeFlow.groupId
      : singleGroupId || data.groups[0].id;
    openDialog({ type: "flow", groupId });
  };

  return (
    <header className="app-header">
      <a
        className="brand"
        href="#"
        aria-label="Weekflow 首页"
        data-action="show-home"
        onClick={(event) => {
          event.preventDefault();
          switchView("home");
        }}
      >
        <span className="brand-mark" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </span>
        <span>
          <strong>Weekflow</strong>
          <small>Task management</small>
        </span>
      </a>

      <nav className="view-nav" aria-label="主导航">
        {NAV_TABS.map((tab) => {
          const active = view === tab.view;
          return (
            <button
              key={tab.view}
              className={active ? "nav-tab is-active" : "nav-tab"}
              type="button"
              data-view={tab.view}
              aria-current={active ? "page" : "false"}
              onClick={() => switchView(tab.view)}
            >
              <span aria-hidden="true">{tab.icon}</span> {tab.label}
            </button>
          );
        })}
      </nav>

      <div id="header-summary" className="header-summary" aria-live="polite" hidden={simplifiedHeader}>
        <span>
          <b id="header-pending">{summary.pending}</b> 未完成
        </span>
        <span className="summary-overdue">
          <b id="header-overdue">{summary.overdue}</b> 逾期
        </span>
      </div>

      <div id="header-actions" className="header-actions" hidden={simplifiedHeader}>
        <button className="button button-quiet" type="button" data-action="new-group" onClick={openNewGroup}>
          <span aria-hidden="true">＋</span> 新建分组
        </button>
        <button className="button button-quiet" type="button" data-action="new-flow" onClick={openNewFlow}>
          <span aria-hidden="true">＋</span> 新建 Flow
        </button>
        <button className="button button-primary" type="button" data-action="new-task" onClick={openNewTask}>
          <span aria-hidden="true">＋</span> 新建 Task
        </button>
      </div>
    </header>
  );
}
