/**
 * Tauri 桥接层（等价 Electron 版的 preload + 主进程 IPC 包装）。
 *
 * 用 @tauri-apps/api 的 invoke 调用 src-tauri 的 Rust commands，
 * 在渲染前挂到 window.weekflow；组件与 store 代码因此零改动。
 *
 * 与 Electron 主进程语义的对应关系：
 * - loadData：Rust 只做 JSON 解析级检查与备份轮换恢复（返回原始 json 字符串），
 *   语义校验（zod validateData）在本层做——与 Electron 主进程 parseAndValidate 等价。
 *   json 为 null 且无 warning = 首次运行：makeEmptyData 并立即 saveData 落盘
 *   （等价 Electron 主进程 loadData 的首跑分支）。
 * - saveData：先全量校验再落盘（等价 Electron 主进程 saveData 的校验前置）。
 * - 二进制内容（xlsx 等）跨桥一律 base64 字符串传递。
 */
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { makeEmptyData, validateData } from "../../shared/schema";
import type { WeekflowData } from "../../shared/types";
import type {
  LoadDataResult,
  OpenFileResult,
  SaveDataResult,
  SaveFileResult,
  WeekflowApi,
} from "../../shared/ipc";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/* ---------- base64 编解码（分块避免栈溢出） ---------- */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/* ---------- Rust command 的返回结构（snake_case 按约定） ---------- */

interface RustLoadDataResult {
  json: string | null;
  warning: string | null;
}

interface RustSaveFileResult {
  ok: boolean;
  canceled?: boolean;
  file_path?: string;
  error?: string;
}

interface RustOpenFileResult {
  ok: boolean;
  canceled?: boolean;
  name?: string;
  data_base64?: string;
  error?: string;
}

interface RustDataInfo {
  data_file: string;
  backups_dir: string;
  backup_count: number;
}

const api: WeekflowApi = {
  async loadData(): Promise<LoadDataResult> {
    const result = await invoke<RustLoadDataResult>("load_data");

    if (result.json === null) {
      if (result.warning) {
        // 主数据损坏且备份不可用 / 读取失败：空数据兜底（不立即落盘，与 Electron 版一致）
        return { ok: true, data: makeEmptyData(), warning: result.warning };
      }
      // 首次运行：落盘一份空数据
      const data = makeEmptyData();
      const saved = await api.saveData(data);
      if (!saved.ok) {
        return { ok: false, error: `初始化数据文件失败：${saved.error || "未知错误"}` };
      }
      return { ok: true, data, warning: null };
    }

    // Rust 已保证是合法 JSON；语义校验/归一化在前端做（等价主进程 parseAndValidate）
    try {
      const checked = validateData(JSON.parse(result.json));
      if (checked.ok) {
        return { ok: true, data: checked.data, warning: result.warning };
      }
      // 文件由应用自身写入且写入前已全量校验，正常不会走到这里
      return { ok: true, data: makeEmptyData(), warning: "数据校验失败，已重置为空数据" };
    } catch {
      return { ok: true, data: makeEmptyData(), warning: "数据解析失败，已重置为空数据" };
    }
  },

  async saveData(data: WeekflowData): Promise<SaveDataResult> {
    // 等价 Electron 主进程 saveData：先全量校验再落盘（2 空格 pretty print）
    const checked = validateData(data);
    if (!checked.ok) {
      return { ok: false, error: `数据校验失败：${checked.errors.join("；")}` };
    }
    return invoke<SaveDataResult>("save_data", {
      json: JSON.stringify(checked.data, null, 2),
    });
  },

  async saveFileWithDialog(options): Promise<SaveFileResult> {
    const bytes =
      typeof options.data === "string"
        ? new TextEncoder().encode(options.data)
        : new Uint8Array(options.data);
    const result = await invoke<RustSaveFileResult>("save_file_with_dialog", {
      defaultPath: options.defaultPath,
      filters: options.filters,
      dataBase64: bytesToBase64(bytes),
    });
    return {
      ok: result.ok,
      canceled: result.canceled,
      filePath: result.file_path,
      error: result.error,
    };
  },

  async openFileWithDialog(options): Promise<OpenFileResult> {
    const result = await invoke<RustOpenFileResult>("open_file_with_dialog", {
      filters: options.filters,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    if (result.canceled) {
      return { ok: true, canceled: true };
    }
    return {
      ok: true,
      canceled: false,
      name: result.name,
      data: result.data_base64 ? base64ToArrayBuffer(result.data_base64) : undefined,
    };
  },

  async openExternal(url: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return {
          ok: false,
          error: `仅允许打开 http/https 链接（收到 ${parsed.protocol}）`,
        };
      }
      await openUrl(url);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: `打开链接失败：${errorMessage(error)}` };
    }
  },

  async getDataInfo() {
    const info = await invoke<RustDataInfo>("get_data_info");
    return {
      dataFile: info.data_file,
      backupsDir: info.backups_dir,
      backupCount: info.backup_count,
    };
  },
};

/** 渲染前调用：把 Tauri 实现挂到 window.weekflow */
export function installTauriBridge(): void {
  window.weekflow = api;
}
