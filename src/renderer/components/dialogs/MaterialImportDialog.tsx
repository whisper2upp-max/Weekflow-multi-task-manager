/* 资料库 Excel 导入确认弹窗：文件信息、4 格统计卡、错误列表（最多 50 条）、
   前 20 行预览、导入方式（补充导入/全部覆盖）与重复地址处理（替换/跳过）。
   等价原 app.js:4710 renderMaterialImportDialog、4701 renderMaterialImportMode、
   4859 confirmMaterialImport。
   名称解析/错误收集/重复地址检测走 dataStore 导出的 prepareMaterialImport（等价
   原 resolveMaterialImportRow + renderMaterialImportDialog 的数据部分）。 */
import { useEffect, useMemo, useState } from "react";
import type { RefObject } from "react";
import type { MaterialImportParseResult } from "../../../shared/material-excel";
import * as materialTools from "../../../shared/materials";
import type { WeekflowData } from "../../../shared/types";
import { prepareMaterialImport, useDataStore } from "../../store/dataStore";
import { useUiStore } from "../../store/uiStore";
import { useModalDialog } from "../../lib/useModalDialog";
import { pickAndImportMaterialsExcel } from "../../lib/importMaterialsExcel";

export default function MaterialImportDialog() {
  const dialog = useUiStore((s) =>
    s.dialog && s.dialog.type === "materialImport" ? s.dialog : null
  );
  const data = useDataStore((s) => s.data);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const ref = useModalDialog(Boolean(dialog), closeDialog);
  if (!dialog || !data) return null;
  return (
    <MaterialImportDialogInner
      fileName={dialog.fileName}
      parsed={dialog.parsed}
      data={data}
      dialogRef={ref}
    />
  );
}

interface MaterialImportDialogInnerProps {
  fileName: string;
  parsed: MaterialImportParseResult;
  data: WeekflowData;
  dialogRef: RefObject<HTMLDialogElement>;
}

function MaterialImportDialogInner({
  fileName,
  parsed,
  data,
  dialogRef
}: MaterialImportDialogInnerProps) {
  const closeDialog = useUiStore((s) => s.closeDialog);
  const isImporting = useDataStore((s) => s.isImportingMaterials);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [duplicateMode, setDuplicateMode] = useState<"replace" | "skip">("replace");

  /* 等价原版 renderMaterialImportDialog 每次打开/换文件时重置 radio 为 append + replace */
  useEffect(() => {
    setMode("append");
    setDuplicateMode("replace");
  }, [parsed]);

  /* 名称→id 解析 + 行级错误 + 文件内/既有重复地址检测（等价 4710-4754） */
  const preview = useMemo(() => prepareMaterialImport(data, parsed.rows), [data, parsed]);
  const errors = useMemo(() => parsed.errors.concat(preview.errors), [parsed, preview]);
  const rows = preview.rows;

  const summaryCards: Array<[number, string]> = [
    [rows.length, " 条资料"],
    [rows.filter((row) => row.taskIds.length).length, " 条关联 Task"],
    [
      rows.filter((row) => !row.taskIds.length && !row.flowIds.length && !row.groupIds.length)
        .length,
      " 条未分组"
    ],
    [preview.duplicateCount, " 条地址重复"]
  ];

  /* 等价 renderMaterialImportMode：仅补充模式且有重复时显示重复地址处理 */
  const showDuplicateChoice = mode === "append" && preview.duplicateCount > 0;
  const confirmDisabled = Boolean(errors.length || !rows.length || isImporting);

  const taskNameById = useMemo(
    () => new Map(data.tasks.map((task) => [task.id, task.name])),
    [data]
  );

  const previewRows = rows.slice(0, 20).map((row, index) => ({
    key: row.sourceRow,
    index: index + 1,
    title: row.title,
    typeLabel: materialTools.typeLabel(row.type),
    taskNames:
      row.taskIds
        .map((id) => taskNameById.get(id) || "")
        .filter(Boolean)
        .join("、") || "—",
    groupNames:
      materialTools
        .resolveRelations(row, data)
        .groups.map((group) => group.name)
        .join("、") || "未分组"
  }));

  /* 等价 app.js:4859 confirmMaterialImport（两次 confirm 在组件层，文案照原版） */
  const handleConfirm = async (): Promise<void> => {
    if (isImporting || !rows.length || errors.length) return;
    if (mode === "replace") {
      if (
        !window.confirm(
          "全部覆盖会先删除资料库现有的 " +
            data.materials.length +
            " 条资料，再导入 " +
            rows.length +
            " 条新资料。是否继续？"
        )
      ) {
        return;
      }
      if (!window.confirm("再次确认：全部覆盖不可撤销，建议已先导出 JSON 备份。")) return;
    }
    const counts = await useDataStore
      .getState()
      .applyMaterialExcelImport(rows, mode, duplicateMode);
    /* store 成功时已 toast 原版文案并 switchView("materials")，这里只负责关弹窗 */
    if (counts) closeDialog();
  };

  return (
    <dialog id="material-import-dialog" className="modal modal-large" ref={dialogRef}>
      <div className="modal-head">
        <div>
          <p className="eyebrow">Document import</p>
          <h2>资料库 Excel 导入</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          data-action="close-material-import"
          aria-label="关闭"
          onClick={closeDialog}
        >
          ×
        </button>
      </div>
      <p id="material-import-file" className="modal-context">
        {fileName + (parsed.sheetName ? " · 工作表：" + parsed.sheetName : "")}
      </p>
      <fieldset className="material-import-mode">
        <legend>导入方式</legend>
        <label>
          <input
            type="radio"
            name="material-import-mode"
            value="append"
            checked={mode === "append"}
            onChange={() => setMode("append")}
          />
          <span>
            <b>补充导入</b>
            <small>新增资料；遇到相同链接地址时选择替换或跳过。</small>
          </span>
        </label>
        <label>
          <input
            type="radio"
            name="material-import-mode"
            value="replace"
            checked={mode === "replace"}
            onChange={() => setMode("replace")}
          />
          <span>
            <b>全部覆盖</b>
            <small>删除资料库全部现有资料，再写入本次文件。</small>
          </span>
        </label>
      </fieldset>
      <fieldset
        id="material-duplicate-choice"
        className="material-import-mode duplicate-choice"
        hidden={!showDuplicateChoice}
      >
        <legend>发现重复链接地址</legend>
        <label>
          <input
            type="radio"
            name="material-duplicate-mode"
            value="replace"
            checked={duplicateMode === "replace"}
            onChange={() => setDuplicateMode("replace")}
          />
          <span>
            <b>用新上传资料替换</b>
            <small>保留原资料 ID 和打开记录，其他字段以新文件为准。</small>
          </span>
        </label>
        <label>
          <input
            type="radio"
            name="material-duplicate-mode"
            value="skip"
            checked={duplicateMode === "skip"}
            onChange={() => setDuplicateMode("skip")}
          />
          <span>
            <b>跳过重复资料</b>
            <small>保留原资料，只导入地址不重复的新内容。</small>
          </span>
        </label>
      </fieldset>
      <div id="material-import-summary" className="import-summary">
        {summaryCards.map(([count, label]) => (
          <span key={label}>
            <b>{count}</b>
            {label}
          </span>
        ))}
      </div>
      <div
        id="material-import-errors"
        className={errors.length ? "import-errors has-errors" : "import-errors"}
        role="alert"
      >
        {errors.length > 0 && (
          <>
            <strong>{"发现 " + errors.length + " 个问题，修正后请重新选择文件："}</strong>
            <ul>
              {errors.slice(0, 50).map((message, index) => (
                <li key={index}>{message}</li>
              ))}
              {errors.length > 50 && (
                <li>{"其余 " + (errors.length - 50) + " 个问题未显示。"}</li>
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
              <th>链接名称</th>
              <th>类型</th>
              <th>相关 Task</th>
              <th>分组</th>
            </tr>
          </thead>
          <tbody id="material-import-preview">
            {previewRows.map((row) => (
              <tr key={row.key}>
                <td>{row.index}</td>
                <td>{row.title}</td>
                <td>{row.typeLabel}</td>
                <td>{row.taskNames}</td>
                <td>{row.groupNames}</td>
              </tr>
            ))}
            {rows.length > 20 && (
              <tr>
                <td className="import-preview-more" colSpan={5}>
                  {"另有 " + (rows.length - 20) + " 条资料，将在确认后一起导入"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="import-note">
        导入不会创建 Task、Flow 或分组；无法匹配或存在重名歧义时会阻止导入。补充导入会新增或按选择处理重复地址，全部覆盖会先清空资料库。
      </p>
      <div className="modal-actions">
        <button
          className="button button-quiet"
          type="button"
          data-action="choose-material-import"
          onClick={() => void pickAndImportMaterialsExcel()}
        >
          重新选择文件
        </button>
        <button
          className="button button-quiet"
          type="button"
          data-action="close-material-import"
          onClick={closeDialog}
        >
          取消
        </button>
        <button
          id="material-import-confirm"
          className="button button-primary"
          type="button"
          data-action="confirm-material-import"
          disabled={confirmDisabled}
          onClick={() => void handleConfirm()}
        >
          确认导入
        </button>
      </div>
    </dialog>
  );
}
