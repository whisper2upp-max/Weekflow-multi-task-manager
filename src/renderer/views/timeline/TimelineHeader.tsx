/* 时间轴表头行：左侧固定五列 + 周表头（双击/Enter/空格进日视图）或日表头 7 天。
   等价 app.js:1297 createTimelineHeader（含原版的 isEnglish 三元文案分支）。 */
import type { TimelineGranularity } from "../../../shared/types";
import * as dates from "../../../shared/date-utils";
import { isEnglish } from "../../lib/i18n";
import { weekdayLabel } from "./utils";

/* 原版英文分支逐字：["Task / DDL", "Urgency", "Progress", "Documents", "Edit"] */
const CORNER_LABELS = isEnglish()
  ? ["Task / DDL", "Urgency", "Progress", "Documents", "Edit"]
  : ["Task / DDL", "紧急", "进度记录", "相关资料", "编辑"];

interface TimelineHeaderProps {
  columns: string[];
  granularity: TimelineGranularity;
  /** 当前列：周模式为本周周五，日模式为今天 */
  currentColumn: string;
  onOpenDay: (friday: string) => void;
}

export default function TimelineHeader({
  columns,
  granularity,
  currentColumn,
  onOpenDay
}: TimelineHeaderProps) {
  const dayMode = granularity === "day";
  return (
    <div className="timeline-header">
      <div className="timeline-corner">
        {CORNER_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      {dayMode
        ? columns.map((day) => (
            <div
              key={day}
              className={"week-head day-head" + (day === currentColumn ? " is-current" : "")}
              data-day={day}
            >
              <small className="week-range">
                {isEnglish() ? day.slice(0, 4) : day.slice(0, 4) + " 年"}
              </small>
              <strong className="week-date">{day.slice(5).replace("-", "/")}</strong>
              <span className="week-year">{weekdayLabel(day)}</span>
              {day === currentColumn && <b className="week-current-badge">今天</b>}
            </div>
          ))
        : columns.map((friday) => {
            const isCurrent = friday === currentColumn;
            const handleOpen = () => onOpenDay(friday);
            return (
              <div
                key={friday}
                className={"week-head is-drillable" + (isCurrent ? " is-current" : "")}
                data-week={friday}
                tabIndex={0}
                role="button"
                aria-label={"双击查看 " + dates.friendlyWeekLabel(friday) + " 的日时间轴"}
                title="双击进入该周的 Task by Day"
                onDoubleClick={handleOpen}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  handleOpen();
                }}
              >
                <small className="week-range">{dates.friendlyWeekLabel(friday)}</small>
                <strong className="week-date">{friday.slice(5).replace("-", "/")}</strong>
                <span className="week-year">{friday.slice(0, 4) + " · 周五"}</span>
                {isCurrent && <b className="week-current-badge">本周</b>}
              </div>
            );
          })}
    </div>
  );
}
