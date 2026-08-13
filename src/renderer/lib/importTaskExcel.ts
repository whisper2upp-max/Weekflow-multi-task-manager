/* Task Excel 导入入口：选文件 → 15MB 限制 → parseWorkbook → 打开导入预览弹窗。
   等价原 app.js:5122 openExcelFilePicker + 5132 importExcelFile。 */
import * as excelImport from "../../shared/excel-import";
import { useUiStore } from "../store/uiStore";
import { pickFile } from "./files";

const MAX_SIZE = 15 * 1024 * 1024;

export async function pickAndImportTaskExcel(): Promise<void> {
  const file = await pickFile([{ name: "Excel 工作簿", extensions: ["xlsx"] }]);
  if (!file) return;
  if (file.data.byteLength > MAX_SIZE) {
    useUiStore.getState().pushToast("Excel 文件不能超过 15 MB。", "error", 6500);
    return;
  }
  try {
    const parsed = excelImport.parseWorkbook(file.data);
    useUiStore.getState().openDialog({
      type: "excelImport",
      fileName: file.name,
      fileSize: file.data.byteLength,
      parsed
    });
  } catch (error) {
    useUiStore
      .getState()
      .pushToast(
        "无法读取 Excel：" + (error instanceof Error ? error.message : String(error)),
        "error",
        6500
      );
  }
}
