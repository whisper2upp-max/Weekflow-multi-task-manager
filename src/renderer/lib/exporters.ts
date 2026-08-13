/* Excel 导出 action：看板报告 / 人员 Task 状态 / 可回导数据 / 空白模板 / 资料库。
   全部走 shared 的 excel-export / excel-import / material-excel 生成，再经 files.ts 保存。
   toast 文案与原 js/app.js 一致；导出期间用 dataStore 的锁防重入。 */
import * as excelExport from "../../shared/excel-export";
import * as excelImport from "../../shared/excel-import";
import * as materialExcel from "../../shared/material-excel";
import type { FileFilter } from "../../shared/ipc";
import { useDataStore } from "../store/dataStore";
import { useUiStore } from "../store/uiStore";
import { saveBinaryToDisk } from "./files";

const XLSX_FILTERS: FileFilter[] = [{ name: "Excel 工作簿", extensions: ["xlsx"] }];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toast(message: string, type?: "success" | "error" | "warning"): void {
  useUiStore.getState().pushToast(message, type);
}

/* 等价 app.js:5696 exportExcel（带 isExporting 锁） */
export async function exportDashboardReport(): Promise<boolean> {
  const state = useDataStore.getState();
  if (state.isExporting) return false;
  const data = state.data;
  if (!data) return false;
  useDataStore.setState({ isExporting: true });
  try {
    const result = await excelExport.exportWorkbook(data, new Date());
    const saved = await saveBinaryToDisk(result.filename, result.data, XLSX_FILTERS);
    if (saved) toast("看板报告已导出：" + result.filename);
    return saved;
  } catch (error) {
    toast("看板报告导出失败：" + errorMessage(error), "error");
    return false;
  } finally {
    useDataStore.setState({ isExporting: false });
  }
}

/* 等价 app.js:5720 exportPersonTaskStatus（带 isExportingPersonStatus 锁） */
export async function exportPersonTaskStatus(
  scopeField: "managedObject" | "reportTo",
  scopeValue: string,
  scopeLabel: string
): Promise<boolean> {
  const state = useDataStore.getState();
  if (state.isExportingPersonStatus) return false;
  const data = state.data;
  if (!data) return false;
  useDataStore.setState({ isExportingPersonStatus: true });
  try {
    const result = await excelExport.exportTaskStatusWorkbook(
      data,
      { field: scopeField, value: scopeValue, label: scopeLabel },
      new Date()
    );
    const saved = await saveBinaryToDisk(result.filename, result.data, XLSX_FILTERS);
    if (saved) toast("Task 状态已导出：" + result.filename);
    return saved;
  } catch (error) {
    toast("Task 状态导出失败：" + errorMessage(error), "error");
    return false;
  } finally {
    useDataStore.setState({ isExportingPersonStatus: false });
  }
}

/* 等价 app.js:5675 exportTaskImportData */
export async function exportTaskImportData(): Promise<boolean> {
  const data = useDataStore.getState().data;
  if (!data) return false;
  try {
    const result = await excelImport.exportWorkbook(data);
    const saved = await saveBinaryToDisk(result.filename, result.data, XLSX_FILTERS);
    if (saved) toast("已按导入模板下载当前数据：" + result.filename);
    return saved;
  } catch (error) {
    toast("当前数据下载失败：" + errorMessage(error), "error");
    return false;
  }
}

/* 等价 app.js:415 downloadBlankTemplate("task") */
export async function downloadTaskTemplate(): Promise<boolean> {
  try {
    const result = await excelImport.exportTemplateWorkbook();
    const saved = await saveBinaryToDisk(result.filename, result.data, XLSX_FILTERS);
    if (saved) toast("Task 空白模板已下载");
    return saved;
  } catch (error) {
    toast("模板下载失败：" + errorMessage(error), "error");
    return false;
  }
}

/* 等价 app.js:415 downloadBlankTemplate("materials") */
export async function downloadMaterialTemplate(): Promise<boolean> {
  try {
    const result = await materialExcel.exportTemplateWorkbook();
    const saved = await saveBinaryToDisk(result.filename, result.data, XLSX_FILTERS);
    if (saved) toast("资料库空白模板已下载");
    return saved;
  } catch (error) {
    toast("模板下载失败：" + errorMessage(error), "error");
    return false;
  }
}

/* 等价 app.js:4955 exportMaterialLibrary */
export async function exportMaterialLibrary(): Promise<boolean> {
  const data = useDataStore.getState().data;
  if (!data) return false;
  try {
    const result = await materialExcel.exportWorkbook(data);
    const saved = await saveBinaryToDisk(result.filename, result.data, XLSX_FILTERS);
    if (saved) toast("资料库已下载：" + result.filename);
    return saved;
  } catch (error) {
    toast("资料库下载失败：" + errorMessage(error), "error");
    return false;
  }
}
