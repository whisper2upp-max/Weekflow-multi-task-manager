/* Excel 批量导入确认弹窗：等价原 app.js renderExcelImportDialog(5045) /
   renderExcelImportMode(5023) / confirmExcelImport(5597)。
   统计用 dataStore 的 analyzeTaskExcelImport；完整覆盖需连续两次 confirm。 */
import { useEffect, useMemo, useState } from "react";
import * as automation from "../../../shared/automation";
import type { ParsedTaskRow } from "../../../shared/excel-import";
import { analyzeTaskExcelImport, useDataStore } from "../../store/dataStore";
import { useUiStore } from "../../store/uiStore";
import { useModalDialog } from "../../lib/useModalDialog";
import { pickAndImportTaskExcel } from "../../lib/importTaskExcel";

const URGENCY_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };
const PREVIEW_LIMIT = 20;
const ERROR_LIMIT = 40;

type ImportMode = "append" | "replace";

/** 预览表周期列：等价原版 automation.cadenceLabel(x) || cadenceLabels.none */
function cadenceCell(row: ParsedTaskRow): string {
  return row.recurrenceCadence === "none"
    ? "不重复"
    : automation.cadenceLabel(row.recurrenceCadence) || "不重复";
}

export default function ExcelImportDialog() {
  const dialog = useUiStore((s) => (s.dialog?.type === "excelImport" ? s.dialog : null));
  const closeDialog = useUiStore((s) => s.closeDialog);
  const data = useDataStore((s) => s.data);
  const isImportingExcel = useDataStore((s) => s.isImportingExcel);
  const ref = useModalDialog(!!dialog, closeDialog);

  const [mode, setMode] = useState<ImportMode>("append");

  /* 每次打开（新文件）重置为补充导入（等价 renderExcelImportDialog 末尾的勾选重置） */
  useEffect(() => {
    if (dialog) setMode("append");
  }, [dialog]);

  const rows = useMemo(() => dialog?.parsed.rows ?? [], [dialog]);
  const errors = useMemo(() => {
    if (!dialog) return [] as string[];
    const list = dialog.parsed.errors.slice();
    if (!dialog.parsed.rows.length && !list.length) {
      list.push("文件中没有可导入的 Task，请在模板表头下方填写数据。");
    }
    return list;
  }, [dialog]);
  const summary = useMemo(
    () =>
      data
        ? analyzeTaskExcelImport(data, rows)
        : { taskCount: rows.length, groupCount: 0, flowCount: 0, newGroupCount: 0, newFlowCount: 0 },
    [data, rows]
  );

  if (!dialog) return null;

  const sizeLabel =
    dialog.fileSize >= 1024 * 1024
      ? (dialog.fileSize / (1024 * 1024)).toFixed(1) + " MB"
      : Math.max(1, Math.round(dialog.fileSize / 1024)) + " KB";
  const fileText =
    dialog.fileName +
    " · " +
    sizeLabel +
    (dialog.parsed.sheetName ? " · 工作表：" + dialog.parsed.sheetName : "");

  const confirmText = isImportingExcel
    ? "正在导入…"
    : mode === "replace"
      ? "确认完整覆盖"
      : "确认补充导入";
  const confirmDisabled = Boolean(errors.length || !rows.length || isImportingExcel);

  const onConfirm = (): void => {
    if (isImportingExcel || !rows.length || errors.length) return;
    if (mode === "replace") {
      if (
        !window.confirm(
          "完整覆盖会以本文件中的 " +
            summary.groupCount +
            " 个分组、" +
            summary.flowCount +
            " 个 Flow 和 " +
            rows.length +
            " 条 Task，替换当前全部时间轴数据。资料库的 " +
            (data?.materials.length ?? 0) +
            " 条资料不会删除；同名层级会尽量保留原有关联。是否继续？"
        )
      ) {
        return;
      }
      if (
        !window.confirm(
          "再次确认：文件中没有的分组、Flow 和 Task 将被移除，无法匹配的资料关联也会移除。建议已先导出 JSON 备份。"
        )
      ) {
        return;
      }
    }
    void useDataStore
      .getState()
      .applyTaskExcelImport(rows, mode)
      .then((ok) => {
        /* 成功后清筛选 / timelineMode=all / 切时间轴由 store 完成 */
        if (ok) closeDialog();
      });
  };

  return (
    <dialog ref={ref} id="excel-import-dialog" className="modal modal-large">
      <div className="modal-head">
        <div>
          <p className="eyebrow">Bulk import</p>
          <h2>Excel 批量导入</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          data-action="close-excel-import"
          aria-label="关闭"
          onClick={closeDialog}
        >
          ×
        </button>
      </div>
      <p id="excel-import-file" className="modal-context">
        {fileText}
      </p>
      <fieldset className="material-import-mode excel-import-mode">
        <legend>导入方式</legend>
        <label>
          <input
            type="radio"
            name="excel-import-mode"
            value="append"
            checked={mode === "append"}
            onChange={() => setMode("append")}
          />
          <span>
            <b>补充导入</b>
            <small>保留现有数据并新增 Task；同名分组和 Flow 会直接复用。</small>
          </span>
        </label>
        <label>
          <input
            type="radio"
            name="excel-import-mode"
            value="replace"
            checked={mode === "replace"}
            onChange={() => setMode("replace")}
          />
          <span>
            <b>完整覆盖</b>
            <small>以文件替换全部分组、Flow 和 Task；资料库条目不会删除。</small>
          </span>
        </label>
      </fieldset>
      <div id="excel-import-summary" className="import-summary">
        <span>
          <b>{summary.taskCount}</b>
          {" 条 Task"}
        </span>
        <span>
          <b>{mode === "replace" ? summary.groupCount : summary.newGroupCount}</b>
          {mode === "replace" ? " 个分组" : " 个新分组"}
        </span>
        <span>
          <b>{mode === "replace" ? summary.flowCount : summary.newFlowCount}</b>
          {mode === "replace" ? " 个 Flow" : " 个新 Flow"}
        </span>
      </div>
      <div
        id="excel-import-errors"
        className={"import-errors" + (errors.length ? " has-errors" : "")}
        role="alert"
      >
        {!!errors.length && (
          <>
            <strong>{"发现 " + errors.length + " 个问题，修正后请重新选择文件："}</strong>
            <ul>
              {errors.slice(0, ERROR_LIMIT).map((message, index) => (
                <li key={index}>{message}</li>
              ))}
              {errors.length > ERROR_LIMIT && (
                <li>{"其余 " + (errors.length - ERROR_LIMIT) + " 个问题未显示。"}</li>
              )}
            </ul>
          </>
        )}
      </div>
      <div className="table-wrap import-preview-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>分组</th>
              <th>Flow</th>
              <th>Task name</th>
              <th>DDL</th>
              <th>周期</th>
              <th>紧急程度</th>
            </tr>
          </thead>
          <tbody id="excel-import-preview">
            {rows.slice(0, PREVIEW_LIMIT).map((row, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{row.groupName}</td>
                <td>{row.flowName || "—"}</td>
                <td>{row.taskName}</td>
                <td>{row.ddl || "—"}</td>
                <td>{cadenceCell(row)}</td>
                <td>{URGENCY_LABELS[row.urgency] || "中"}</td>
              </tr>
            ))}
            {rows.length > PREVIEW_LIMIT && (
              <tr>
                <td className="import-preview-more" colSpan={7}>
                  {"另有 " + (rows.length - PREVIEW_LIMIT) + " 条 Task，将在确认后一起导入"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="import-note">
        补充导入会新增 Task；完整覆盖会连续确认两次，并按文件替换时间轴数据。同名层级沿用原 ID
        时会保留资料关联，无法匹配的旧关联会移除。
      </p>
      <div className="modal-actions">
        <button
          className="button button-quiet"
          type="button"
          data-action="choose-excel-import"
          onClick={() => void pickAndImportTaskExcel()}
        >
          重新选择文件
        </button>
        <button
          className="button button-quiet"
          type="button"
          data-action="close-excel-import"
          onClick={closeDialog}
        >
          取消
        </button>
        <button
          id="excel-import-confirm"
          className="button button-primary"
          type="button"
          data-action="confirm-excel-import"
          disabled={confirmDisabled}
          onClick={onConfirm}
        >
          {confirmText}
        </button>
      </div>
    </dialog>
  );
}
