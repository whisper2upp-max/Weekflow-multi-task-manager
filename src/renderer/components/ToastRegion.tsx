/* Toast 容器：右下角 #toast-region，渲染 uiStore.toasts（class "toast" + error/warning 修饰）。
   等价原 Weekflow.html:1451-1463 与 app.js:5896-5903 toast；超时移除与最大 5 条由 uiStore 管理。
   点击 toast 可立即关闭（dismissToast）。
   DDL 提醒与原 DOM 一样渲染为本容器的第一个子元素。 */
import { useUiStore } from "../store/uiStore";
import DdlReminder from "./DdlReminder";

export default function ToastRegion() {
  const toasts = useUiStore((state) => state.toasts);
  const dismissToast = useUiStore((state) => state.dismissToast);

  return (
    <div id="toast-region" className="toast-region" aria-live="polite" aria-atomic="true">
      <DdlReminder />
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={"toast" + (toast.type ? " " + toast.type : "")}
          onClick={() => dismissToast(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
