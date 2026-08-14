/* 资料库 Excel 导入入口：选文件 → 15MB 限制 → material-excel.parseWorkbook 解析 →
   打开导入确认弹窗（名称解析/重复检测由弹窗经 dataStore.prepareMaterialImport 完成）。
   等价原 app.js:4830 openMaterialFilePicker + 4836 importMaterialFile。 */
import * as materialExcel from "../../shared/material-excel";
import type { MaterialImportParseResult } from "../../shared/material-excel";
import { useUiStore } from "../store/uiStore";
import { pickFile } from "./files";
import { translateText } from "./i18n";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function pickAndImportMaterialsExcel(): Promise<void> {
  const file = await pickFile([{ name: translateText("Excel 工作簿"), extensions: ["xlsx"] }]);
  if (!file) return;
  if (file.data.byteLength > MAX_FILE_SIZE) {
    useUiStore.getState().pushToast("Excel 文件不能超过 15 MB。", "error");
    return;
  }
  let parsed: MaterialImportParseResult;
  try {
    parsed = materialExcel.parseWorkbook(file.data);
  } catch (error) {
    useUiStore.getState().pushToast("无法读取 Excel：" + errorMessage(error), "error");
    return;
  }
  useUiStore.getState().openDialog({
    type: "materialImport",
    fileName: file.name,
    fileSize: file.data.byteLength,
    parsed
  });
}
