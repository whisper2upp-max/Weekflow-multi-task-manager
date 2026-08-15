/* 原生 <dialog> 的 React hook：open=true → showModal()，open=false → close()。
   监听原生 cancel/close 事件回调 onClosed（Esc 关闭时用于同步 uiStore.closeDialog）。 */
import { useEffect, useRef } from "react";
import type { RefObject } from "react";

export function useModalDialog<T extends HTMLDialogElement = HTMLDialogElement>(
  open: boolean,
  onClosed?: () => void
): RefObject<T> {
  const ref = useRef<T>(null);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  /* 不传依赖数组：部分弹窗（Task 草稿转换）会先解析数据、下一次渲染才
     挂载 <dialog>。若只在首次 render 执行，ref.current 当时为 null，后续既
     不会绑定事件，也不会 showModal。每次提交后检查一次，cleanup 可避免重复监听。 */
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handleCancel = (event: Event): void => {
      /* 原生 dialog 的 cancel 默认会立刻关闭；统一阻止默认行为，让调用方有机会
         在未保存内容的确认框中拒绝关闭。确认后调用方会更新 UI state 并卸载弹窗。 */
      event.preventDefault();
      if (onClosedRef.current) onClosedRef.current();
    };
    const handleClose = (): void => {
      if (onClosedRef.current) onClosedRef.current();
    };
    node.addEventListener("cancel", handleCancel);
    node.addEventListener("close", handleClose);
    return () => {
      node.removeEventListener("cancel", handleCancel);
      node.removeEventListener("close", handleClose);
    };
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open) {
      if (!node.open) {
        try {
          node.showModal();
        } catch {
          /* 已处于打开状态等异常场景忽略 */
        }
      }
    } else if (node.open) {
      node.close();
    }
  });

  return ref;
}
