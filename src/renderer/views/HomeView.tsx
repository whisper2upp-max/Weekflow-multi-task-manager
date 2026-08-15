/* 主页：hero + 动态统计胶囊 + 6 张入口卡。等价 Web v2.7 主页。
   文案差异：eyebrow 为「Weekflow Desktop v1.1.0」，
   更新日志入口卡描述指向 Weekflow Desktop 发布内容。 */
import * as stats from "../../shared/stats";
import { useDataStore } from "../store/dataStore";
import { useUiStore } from "../store/uiStore";

export default function HomeView() {
  const view = useUiStore((state) => state.view);
  const switchView = useUiStore((state) => state.switchView);
  const openDialog = useUiStore((state) => state.openDialog);
  const data = useDataStore((state) => state.data);

  const summary = stats.summarize(data ? data.tasks : null, new Date());

  return (
    <section
      id="home-view"
      className="view-panel home-view"
      aria-labelledby="home-heading"
      hidden={view !== "home"}
    >
      <div className="home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">Weekflow Desktop v1.1.0</p>
          <h1 id="home-heading">把工作拆成清晰的下一步</h1>
          <p>用分组建立工作版图，用 Flow 串起执行步骤，再用周时间轴看清每一个 DDL。</p>
          <div className="home-stats" aria-label="当前数据概览">
            <span>
              <b id="home-task-total">{summary.total}</b> Task
            </span>
            <span>
              <b id="home-completion-rate">{summary.completionRate}%</b> 完成率
            </span>
            <span>
              <b id="home-group-total">{data ? data.groups.length : 0}</b> 分组
            </span>
            <span>
              <b id="home-flow-total">{data ? data.flows.length : 0}</b> Flow
            </span>
            <span>
              <b id="home-material-total">{data ? data.materials.length : 0}</b> 资料
            </span>
            <span>
              <b id="home-note-total">{data ? data.notes.length : 0}</b> 笔记
            </span>
          </div>
        </div>
        <div className="home-flow-visual" aria-label="Weekflow 工作结构示意">
          <div className="home-visual-caption">
            <span>WORK MAP</span>
            <b>Group → Flow → Task</b>
          </div>
          <div className="home-group-node">
            <i aria-hidden="true">G</i>
            <div>
              <small>GROUP</small>
              <strong>工作主题</strong>
            </div>
          </div>
          <div className="home-flow-track" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="home-flow-node">
            <i aria-hidden="true">F</i>
            <div>
              <small>FLOW</small>
              <strong>执行流程</strong>
            </div>
            <em>67%</em>
          </div>
          <div className="home-task-steps" aria-hidden="true">
            <span className="is-complete">
              <i>01</i>需求确认
            </span>
            <span className="is-complete">
              <i>02</i>方案执行
            </span>
            <span className="is-current">
              <i>03</i>交付验收
            </span>
          </div>
        </div>
      </div>

      <div className="home-entry-grid" aria-label="Weekflow 功能入口">
        <button
          className="home-entry-card is-timeline"
          type="button"
          data-view="timeline"
          onClick={() => switchView("timeline")}
        >
          <span className="home-entry-icon" aria-hidden="true">⌁</span>
          <span className="home-entry-copy">
            <small>PLAN BY WEEK</small>
            <strong>时间轴看板</strong>
            <span>按周总览 DDL，双击周表头查看每日安排</span>
          </span>
          <span className="home-entry-arrow" aria-hidden="true">→</span>
        </button>
        <button
          className="home-entry-card is-dashboard"
          type="button"
          data-view="dashboard"
          onClick={() => switchView("dashboard")}
        >
          <span className="home-entry-icon" aria-hidden="true">▦</span>
          <span className="home-entry-copy">
            <small>SEE THE PULSE</small>
            <strong>整体看板</strong>
            <span>掌握 Task、分组和 Flow 的实时进度</span>
          </span>
          <span className="home-entry-arrow" aria-hidden="true">→</span>
        </button>
        <button
          className="home-entry-card is-materials"
          type="button"
          data-view="materials"
          onClick={() => switchView("materials")}
        >
          <span className="home-entry-icon" aria-hidden="true">▤</span>
          <span className="home-entry-copy">
            <small>FIND THE SOURCE</small>
            <strong>资料库</strong>
            <span>集中管理链接、关联工作并查看最近常用</span>
          </span>
          <span className="home-entry-arrow" aria-hidden="true">→</span>
        </button>
        <button
          className="home-entry-card is-notes"
          type="button"
          data-view="notes"
          onClick={() => switchView("notes")}
        >
          <span className="home-entry-icon" aria-hidden="true">✎</span>
          <span className="home-entry-copy">
            <small>CAPTURE THE MOMENT</small>
            <strong>随手记</strong>
            <span>记录想法，并转换为进度记录或 Task 草稿</span>
          </span>
          <span className="home-entry-arrow" aria-hidden="true">→</span>
        </button>
        <button
          className="home-entry-card is-guide"
          type="button"
          data-action="open-user-guide"
          onClick={() => openDialog({ type: "userGuide" })}
        >
          <span className="home-entry-icon" aria-hidden="true">?</span>
          <span className="home-entry-copy">
            <small>QUICK GUIDE</small>
            <strong>使用说明</strong>
            <span>了解主要功能、数据保存与导出方法</span>
          </span>
          <span className="home-entry-arrow" aria-hidden="true">↗</span>
        </button>
        <button
          className="home-entry-card is-changelog"
          type="button"
          data-action="open-changelog"
          onClick={() => openDialog({ type: "changelog" })}
        >
          <span className="home-entry-icon" aria-hidden="true">✦</span>
          <span className="home-entry-copy">
            <small>WHAT&apos;S NEW</small>
            <strong>更新日志</strong>
            <span>查看 Weekflow Desktop 的发布内容</span>
          </span>
          <span className="home-entry-arrow" aria-hidden="true">↗</span>
        </button>
      </div>
    </section>
  );
}
