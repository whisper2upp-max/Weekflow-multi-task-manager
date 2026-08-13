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

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handleCancel = (): void => {
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
  }, []);

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
  }, [open]);

  return ref;
}
