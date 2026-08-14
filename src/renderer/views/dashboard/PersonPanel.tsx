/* 人员维度 panel（管理对象/汇报对象）：等价原 js/app.js:2195 renderTaskFieldDashboard、
   2228 createPersonExportButton、2243 createPersonCard、2293 createPersonTableRow，
   以及 renderDashboard（2020-2035）中两份字段配置。
   分桶用 stats.summarizeByTaskField（空值桶“未填写…”永远排最后）；
   导出走 lib/exporters.ts 的 exportPersonTaskStatus（自带锁与 toast）。 */
import * as stats from "../../../shared/stats";
import type { TaskFieldSummary } from "../../../shared/stats";
import type { WeekflowData } from "../../../shared/types";
import { exportPersonTaskStatus } from "../../lib/exporters";
import { useDataStore } from "../../store/dataStore";
import { useUiStore } from "../../store/uiStore";
import { CardRing, cssVars, EmptyState, groupCardVars, StackBars } from "./shared";

type PersonField = "managedObject" | "reportTo";

interface PersonPanelConfig {
  cardContainerId: string;
  tableBodyId: string;
  emptyLabel: string;
  fieldLabel: string;
  emblem: string;
  color: string;
  overviewTitleId: string;
  overviewEyebrow: string;
  overviewTitle: string;
  overviewHint: string;
  tableTitleId: string;
  tableEyebrow: string;
  tableTitle: string;
}

const CONFIGS: Record<PersonField, PersonPanelConfig> = {
  managedObject: {
    cardContainerId: "managed-object-dashboard",
    tableBodyId: "managed-object-summary-body",
    emptyLabel: "未填写管理对象",
    fieldLabel: "管理对象",
    emblem: "管",
    color: "#0AA6B5",
    overviewTitleId: "managed-overview-title",
    overviewEyebrow: "Management pulse",
    overviewTitle: "管理对象进度",
    overviewHint: "按管理对象人员分别统计 Task",
    tableTitleId: "managed-table-title",
    tableEyebrow: "Management numbers",
    tableTitle: "管理对象汇总"
  },
  reportTo: {
    cardContainerId: "report-to-dashboard",
    tableBodyId: "report-to-summary-body",
    emptyLabel: "未填写汇报对象",
    fieldLabel: "汇报对象",
    emblem: "汇",
    color: "#665CFF",
    overviewTitleId: "report-overview-title",
    overviewEyebrow: "Reporting pulse",
    overviewTitle: "汇报对象进度",
    overviewHint: "按汇报对象人员分别统计 Task",
    tableTitleId: "report-table-title",
    tableEyebrow: "Reporting numbers",
    tableTitle: "汇报对象汇总"
  }
};

export default function PersonPanel(props: {
  field: PersonField;
  data: WeekflowData | null;
  today: string;
}) {
  const config = CONFIGS[props.field];
  const exporting = useDataStore((s) => s.isExportingPersonStatus);
  const summaries = stats.summarizeByTaskField(
    props.data?.tasks,
    props.field,
    props.today,
    config.emptyLabel
  );
  return (
    <>
      <section className="dashboard-section" aria-labelledby={config.overviewTitleId}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{config.overviewEyebrow}</p>
            <h2 id={config.overviewTitleId}>{config.overviewTitle}</h2>
          </div>
          <span>{config.overviewHint}</span>
        </div>
        <div id={config.cardContainerId} className="group-dashboard person-dashboard">
          {summaries.length === 0 ? (
            <EmptyState
              title="还没有 Task"
              description={"创建 Task 并填写" + config.fieldLabel + "后，这里会显示对应进度。"}
              buttonText="前往时间轴"
              onAction={() => useUiStore.getState().switchView("timeline")}
            />
          ) : (
            summaries.map((item) => (
              <PersonCard
                key={item.value || "__empty__"}
                field={props.field}
                item={item}
                config={config}
                exporting={exporting}
              />
            ))
          )}
        </div>
      </section>

      <section className="dashboard-section table-section" aria-labelledby={config.tableTitleId}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{config.tableEyebrow}</p>
            <h2 id={config.tableTitleId}>{config.tableTitle}</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{config.fieldLabel}</th>
                <th>Task 总数</th>
                <th>已完成</th>
                <th>未完成</th>
                <th>逾期</th>
                <th>完成率</th>
                <th>Task 状态</th>
              </tr>
            </thead>
            <tbody id={config.tableBodyId}>
              {summaries.length === 0 ? (
                <tr>
                  <td colSpan={7}>{"暂无" + config.fieldLabel + "数据"}</td>
                </tr>
              ) : (
                summaries.map((item) => (
                  <PersonTableRow
                    key={item.value || "__empty__"}
                    field={props.field}
                    item={item}
                    config={config}
                    exporting={exporting}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* 等价 app.js:2228 createPersonExportButton（导出动作改走 lib/exporters） */
function PersonExportButton(props: {
  field: PersonField;
  item: TaskFieldSummary;
  config: PersonPanelConfig;
  className: string;
  text: string;
  exporting: boolean;
}) {
  const { field, item, config } = props;
  return (
    <button
      type="button"
      className={props.className}
      data-action="export-person-task-status"
      data-scope-field={field}
      data-scope-value={item.value}
      data-scope-label={item.label}
      style={cssVars({ "--group-color": config.color })}
      aria-label={"导出" + config.fieldLabel + "“" + item.label + "”的 Task 状态"}
      disabled={props.exporting}
      onClick={() => {
        void exportPersonTaskStatus(field, item.value, item.label);
      }}
    >
      {props.exporting ? "导出中…" : props.text}
    </button>
  );
}

/* 等价 app.js:2243 createPersonCard */
function PersonCard(props: {
  field: PersonField;
  item: TaskFieldSummary;
  config: PersonPanelConfig;
  exporting: boolean;
}) {
  const { item, config } = props;
  const active = Math.max(0, item.pending - item.overdue);
  return (
    <article
      className="group-card person-card"
      style={groupCardVars(config.color, item.completionRate)}
    >
      <div className="group-card-head">
        <div className="group-card-identity">
          <span className="group-card-emblem">{config.emblem}</span>
          <div className="group-card-copy">
            <strong>{item.label}</strong>
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
        <span className="overdue">{"逾期 " + item.overdue}</span>
      </div>
      <div className="person-card-actions">
        <PersonExportButton
          field={props.field}
          item={item}
          config={config}
          className="dashboard-export-button"
          text="⇩ 导出 Task 状态"
          exporting={props.exporting}
        />
      </div>
    </article>
  );
}

/* 等价 app.js:2293 createPersonTableRow */
function PersonTableRow(props: {
  field: PersonField;
  item: TaskFieldSummary;
  config: PersonPanelConfig;
  exporting: boolean;
}) {
  const { item, config } = props;
  return (
    <tr>
      <td>
        <span className="person-table-name">
          <i className="group-swatch" style={cssVars({ "--swatch": config.color })} />
          <span>{item.label}</span>
        </span>
      </td>
      <td>{item.total}</td>
      <td>{item.completed}</td>
      <td>{item.pending}</td>
      <td>{item.overdue}</td>
      <td>{item.completionRate}%</td>
      <td>
        <PersonExportButton
          field={props.field}
          item={item}
          config={config}
          className="dashboard-table-export"
          text="导出"
          exporting={props.exporting}
        />
      </td>
    </tr>
  );
}
