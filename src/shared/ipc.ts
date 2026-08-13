/**
 * 主进程 ↔ 渲染进程 IPC 契约。
 * preload 通过 contextBridge 把这些方法暴露为 window.weekflow（类型 WeekflowApi）。
 */
import type { WeekflowData } from "./types";

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface LoadDataResult {
  ok: boolean;
  data?: WeekflowData;
  /** 迁移/损坏/恢复备份等提示，渲染层 toast 展示 */
  warning?: string | null;
  error?: string;
}

export interface SaveDataResult {
  ok: boolean;
  error?: string;
}

export interface SaveFileResult {
  ok: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

export interface OpenFileResult {
  ok: boolean;
  canceled?: boolean;
  name?: string;
  /** 文件内容（xlsx/json 等），以 ArrayBuffer 返回 */
  data?: ArrayBuffer;
  error?: string;
}

export interface WeekflowApi {
  /** 启动时读取 JSON 数据文件（含轮换备份/损坏备份逻辑） */
  loadData(): Promise<LoadDataResult>;
  /** 全量校验并保存数据（原子写 + 轮换备份） */
  saveData(data: WeekflowData): Promise<SaveDataResult>;
  /** 导出文件：弹保存对话框并写入（xlsx 用 ArrayBuffer，json 用 string） */
  saveFileWithDialog(options: {
    defaultPath: string;
    filters: FileFilter[];
    data: ArrayBuffer | string;
  }): Promise<SaveFileResult>;
  /** 导入文件：弹打开对话框，返回文件名与内容 */
  openFileWithDialog(options: { filters: FileFilter[] }): Promise<OpenFileResult>;
  /** 用系统浏览器打开 http/https 链接 */
  openExternal(url: string): Promise<{ ok: boolean; error?: string }>;
  /** 数据目录路径（用于使用说明展示） */
  getDataInfo(): Promise<{ dataFile: string; backupsDir: string; backupCount: number }>;
}

export const IPC = {
  loadData: "weekflow:data:load",
  saveData: "weekflow:data:save",
  saveFileWithDialog: "weekflow:file:save",
  openFileWithDialog: "weekflow:file:open",
  openExternal: "weekflow:shell:open-external",
  getDataInfo: "weekflow:data:info",
} as const;

declare global {
  interface Window {
    weekflow: WeekflowApi;
  }
}
