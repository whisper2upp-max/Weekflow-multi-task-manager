/* App 外壳：按原 Weekflow.html 骨架组织 .app-shell（Header + 两条筛选栏 + main 四视图），
   body 级挂载全部弹窗与 toast/提醒区域。
   副作用复刻原 js/app.js：启动 load()+showDdlReminder（app.js:259-277）、
   首帧后 i18n.applyDocument()（app.js:272，英文模式整树翻译 + MutationObserver）、
   跨午夜定时器（app.js:5831-5857）、Cmd/Ctrl+K 聚焦搜索（app.js:451-462）、
   弹层互斥收起（app.js:487-496）。 */
import { useEffect } from "react";
import { applyDocument } from "./lib/i18n";
import { useDataStore } from "./store/dataStore";
import { useUiStore } from "./store/uiStore";
import Header from "./components/Header";
import FilterBar from "./components/FilterBar";
import MaterialsFilterBar from "./components/MaterialsFilterBar";
import ToastRegion from "./components/ToastRegion";
import HomeView from "./views/HomeView";
import TimelineView from "./views/TimelineView";
import DashboardView from "./views/DashboardView";
import MaterialsView from "./views/MaterialsView";
import NotesView from "./views/NotesView";
import GroupDialog from "./components/dialogs/GroupDialog";
import FlowDialog from "./components/dialogs/FlowDialog";
import TaskDialog from "./components/dialogs/TaskDialog";
import LinkDialog from "./components/dialogs/LinkDialog";
import MaterialDialog from "./components/dialogs/MaterialDialog";
import ProgressDialog from "./components/dialogs/ProgressDialog";
import DeleteGroupDialog from "./components/dialogs/DeleteGroupDialog";
import ExcelImportDialog from "./components/dialogs/ExcelImportDialog";
import MaterialImportDialog from "./components/dialogs/MaterialImportDialog";
import UserGuideDialog from "./components/dialogs/UserGuideDialog";
import ChangelogDialog from "./components/dialogs/ChangelogDialog";
import MaterialLayoutDialog from "./components/dialogs/MaterialLayoutDialog";
import NoteProgressDialog from "./components/dialogs/NoteProgressDialog";
import TaskDraftsDialog from "./components/dialogs/TaskDraftsDialog";

export default function App() {
  /* 等价 app.js:272 i18n.applyDocument()：首帧提交后整树翻译一次并启动 observer，
     之后所有增量渲染（含 load() 完成后的数据驱动内容与 DDL 提醒）由 observer 接管 */
  useEffect(() => {
    applyDocument();
  }, []);

  /* 启动加载（warning toast 由 dataStore.load 内部展示），完成后播报临期提醒 */
  useEffect(() => {
    let cancelled = false;
    void useDataStore
      .getState()
      .load()
      .then(() => {
        if (!cancelled) useUiStore.getState().showDdlReminder();
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* 等价 app.js:5831 scheduleNextPeriodRefresh：次日 00:00:02 重新 load（内含周期同步）
     并重播临期提醒，然后递归排下一次。 */
  useEffect(() => {
    let timer: number | null = null;
    const scheduleNext = (): void => {
      const now = new Date();
      const nextDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        2
      );
      timer = window.setTimeout(() => {
        void useDataStore
          .getState()
          .load()
          .then(() => {
            useUiStore.getState().showDdlReminder();
            scheduleNext();
          });
      }, Math.max(1000, nextDay.getTime() - now.getTime()));
    };
    scheduleNext();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  /* 等价 app.js:451 handleKeyboard：Cmd/Ctrl+K 聚焦搜索框并全选 */
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent): void => {
      if (!((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) return;
      event.preventDefault();
      const ui = useUiStore.getState();
      if (ui.view === "home" || ui.view === "dashboard") ui.switchView("timeline");
      requestAnimationFrame(() => {
        const view = useUiStore.getState().view;
        const search = document.getElementById(
          view === "materials"
            ? "material-filter-name"
            : view === "notes"
              ? "note-search"
              : "filter-search"
        );
        if (search instanceof HTMLInputElement) {
          search.focus();
          search.select();
        }
      });
    };
    document.addEventListener("keydown", handleKeyboard);
    return () => {
      document.removeEventListener("keydown", handleKeyboard);
    };
  }, []);

  /* 等价 app.js:487 closeOtherPopoverMenus：点击落在其他弹层之外时，收起其余打开的弹层 */
  useEffect(() => {
    const closeOtherPopoverMenus = (event: MouseEvent): void => {
      const target = event.target;
      const activeMenu =
        target instanceof Element
          ? target.closest(".filter-menu, .more-menu, .materials-download-menu")
          : null;
      document
        .querySelectorAll<HTMLDetailsElement>(
          ".filter-menu[open], .more-menu[open], .materials-download-menu[open]"
        )
        .forEach((details) => {
          if (details !== activeMenu) details.open = false;
        });
    };
    document.addEventListener("click", closeOtherPopoverMenus);
    return () => {
      document.removeEventListener("click", closeOtherPopoverMenus);
    };
  }, []);

  return (
    <>
      <div className="app-shell">
        <Header />
        <FilterBar />
        <MaterialsFilterBar />
        <main>
          <HomeView />
          <TimelineView />
          <DashboardView />
          <MaterialsView />
          <NotesView />
        </main>
      </div>
      <GroupDialog />
      <FlowDialog />
      <TaskDialog />
      <LinkDialog />
      <MaterialDialog />
      <ProgressDialog />
      <DeleteGroupDialog />
      <ExcelImportDialog />
      <MaterialImportDialog />
      <UserGuideDialog />
      <ChangelogDialog />
      <MaterialLayoutDialog />
      <NoteProgressDialog />
      <TaskDraftsDialog />
      {/* DDL 提醒渲染在 #toast-region 容器内（与原 DOM 一致），由 ToastRegion 负责挂载 */}
      <ToastRegion />
    </>
  );
}
