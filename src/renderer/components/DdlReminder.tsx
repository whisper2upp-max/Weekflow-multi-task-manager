/* DDL 临期提醒：右下角悬浮卡（位于 #toast-region 内）。复刻 app.js:5859-5894
   showDdlReminder/dueReminderLabel：最多 5 条，超出显示“另有 N 条未显示”，
   无临期时显示“未来 7 天可以从容安排。”。visible/10 秒自动关闭由 uiStore 管理。 */
import * as dates from "../../shared/date-utils";
import { useUiStore } from "../store/uiStore";

/* 等价 app.js:5859 dueReminderLabel */
function dueReminderLabel(ddl: string, today: string): string {
  const days = dates.daysBetween(today, ddl);
  if (days === 0) return "今天";
  if (days === 1) return "明天";
  return days + " 天后";
}

export default function DdlReminder() {
  const reminder = useUiStore((state) => state.ddlReminder);
  const closeDdlReminder = useUiStore((state) => state.closeDdlReminder);

  const today = dates.todayISO();
  const items = reminder.items;

  return (
    <aside id="ddl-reminder" className="ddl-reminder" role="status" hidden={!reminder.visible}>
      <div className="ddl-reminder-head">
        <span className="ddl-reminder-icon" aria-hidden="true">◷</span>
        <div>
          <strong>未来 7 天 DDL 提醒</strong>
          <small id="ddl-reminder-summary">
            {items.length ? items.length + " 条未完成 Task 即将到期" : "当前没有临期未完成 Task"}
          </small>
        </div>
        <button
          className="ddl-reminder-close"
          type="button"
          data-action="close-ddl-reminder"
          aria-label="关闭 DDL 提醒"
          onClick={closeDdlReminder}
        ></button>
      </div>
      <div id="ddl-reminder-list" className="ddl-reminder-list">
        {items.length === 0 ? (
          <p className="ddl-reminder-empty">未来 7 天可以从容安排。</p>
        ) : (
          <>
            {items.slice(0, 5).map((entry) => (
              <div className="ddl-reminder-item" key={entry.task.id + ":" + entry.ddl}>
                <span>{entry.task.name}</span>
                <time>{entry.ddl + " · " + dueReminderLabel(entry.ddl, today)}</time>
              </div>
            ))}
            {items.length > 5 && (
              <p className="ddl-reminder-empty">{"另有 " + (items.length - 5) + " 条未显示"}</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
