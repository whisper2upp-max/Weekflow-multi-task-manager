/* 文件对话框 IPC 包装：保存二进制 / 选择文件。 */
import type { FileFilter } from "../../shared/ipc";
import { useUiStore } from "../store/uiStore";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 保存二进制到磁盘（弹保存对话框）。返回是否已保存：用户取消 = false（静默），错误 = false 并 toast。 */
export async function saveBinaryToDisk(
  filename: string,
  data: Uint8Array,
  filters: FileFilter[]
): Promise<boolean> {
  try {
    /* 复制一份，保证 buffer 是独立的 ArrayBuffer（IPC 要求 ArrayBuffer | string） */
    const buffer = data.slice().buffer as ArrayBuffer;
    const result = await window.weekflow.saveFileWithDialog({
      defaultPath: filename,
      filters,
      data: buffer
    });
    if (result.ok) return true;
    if (result.canceled) return false;
    useUiStore.getState().pushToast("文件保存失败：" + (result.error || "未知错误"), "error");
    return false;
  } catch (error) {
    useUiStore.getState().pushToast("文件保存失败：" + errorMessage(error), "error");
    return false;
  }
}

/** 弹打开对话框选文件。取消 / 失败均返回 null（失败会 toast）。 */
export async function pickFile(
  filters: FileFilter[]
): Promise<{ name: string; data: ArrayBuffer } | null> {
  try {
    const result = await window.weekflow.openFileWithDialog({ filters });
    if (result.ok && result.data && result.name) {
      return { name: result.name, data: result.data };
    }
    if (!result.canceled) {
      useUiStore.getState().pushToast("无法读取所选文件。", "error");
    }
    return null;
  } catch {
    useUiStore.getState().pushToast("无法读取所选文件。", "error");
    return null;
  }
}
