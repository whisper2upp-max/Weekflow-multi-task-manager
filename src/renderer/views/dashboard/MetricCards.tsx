/* 五张指标卡：等价原 js/app.js:2040 renderMetricCards。
   结构 .metric-card + .metric-card-head（符号+标签）+ .metric-card-body（数值+注+.metric-ring）。
   颜色走 --metric-color / --metric-soft / --metric-progress 行内变量。 */
import type { Summary } from "../../../shared/types";
import { rgba } from "../../../shared/utils";
import { applyDashboardFilter, cssVars, percentage } from "./shared";

interface MetricSpec {
  label: string;
  value: string;
  note: string;
  className: string;
  icon: string;
  color: string;
  progress: number;
  onClick?: () => void;
}

export default function MetricCards(props: {
  summary: Summary;
  groupCount: number;
  flowCount: number;
}) {
  const { summary } = props;
  const metrics: MetricSpec[] = [
    {
      label: "Task 总数",
      value: String(summary.total),
      note: props.groupCount + " 个分组 · " + props.flowCount + " 个 Flow",
      className: "total",
      icon: "▦",
      color: "#665CFF",
      progress: 100
    },
    {
      label: "已完成",
      value: String(summary.completed),
      note: "已退出当前逾期",
      className: "completed",
      icon: "✓",
      color: "#2CA77B",
      progress: summary.completionRate
    },
    {
      label: "未完成",
      value: String(summary.pending),
      note: "仍需推进",
      className: "pending",
      icon: "↗",
      color: "#0AA6B5",
      progress: percentage(summary.pending, summary.total)
    },
    {
      label: "当前逾期",
      value: String(summary.overdue),
      note: "点击查看逾期 Task",
      className: "overdue clickable",
      icon: "!",
      color: "#F05462",
      progress: percentage(summary.overdue, summary.total),
      onClick: () => applyDashboardFilter(null, true)
    },
    {
      label: "完成率",
      value: summary.completionRate + "%",
      note: summary.completed + " ÷ " + summary.total,
      className: "rate",
      icon: "%",
      color: "#F2A93B",
      progress: summary.completionRate
    }
  ];
  return (
    <div id="metric-cards" className="metric-cards">
      {metrics.map((metric) => (
        <article
          key={metric.label}
          className={"metric-card " + metric.className}
          style={cssVars({
            "--metric-color": metric.color,
            "--metric-soft": rgba(metric.color, 0.1),
            "--metric-progress": metric.progress + "%"
          })}
          tabIndex={metric.onClick ? 0 : undefined}
          role={metric.onClick ? "button" : undefined}
          onClick={metric.onClick}
          onKeyDown={
            metric.onClick
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") metric.onClick?.();
                }
              : undefined
          }
        >
          <div className="metric-card-head">
            <span className="metric-icon">{metric.icon}</span>
            <p>{metric.label}</p>
          </div>
          <div className="metric-card-body">
            <div className="metric-card-copy">
              <strong>{metric.value}</strong>
              <small>{metric.note}</small>
            </div>
            <span className="metric-ring">
              <i>{Math.round(metric.progress)}%</i>
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
