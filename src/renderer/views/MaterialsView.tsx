/* 资料库视图：标题行（统计胶囊 + 结果数）、操作区（批量选择删除 / 全部-最近常用切换 /
   下载菜单 / 上传 / 添加资料）、8 列资料表格。
   等价原 app.js:2618 materialMatchesFilters、2758 getVisibleMaterials、
   2764 syncMaterialSelectionState、2789 renderMaterialLibrary、2841 setVisibleMaterialsSelected、
   2857 deleteSelectedMaterials、2876 openMaterialLink。
   筛选栏由 components/MaterialsFilterBar 实现并挂载在 Header 区，本视图只消费 materialFilters。 */
import { useMemo, useRef } from "react";
import * as materialTools from "../../shared/materials";
import * as utils from "../../shared/utils";
import type { Material, MaterialFilters, WeekflowData } from "../../shared/types";
import { useDataStore } from "../store/dataStore";
import { useUiStore } from "../store/uiStore";
import * as exporters from "../lib/exporters";
import { pickAndImportMaterialsExcel } from "../lib/importMaterialsExcel";
import { tConfirm } from "../lib/i18n";
import MaterialTableRow from "./materials/MaterialTableRow";

/* 等价 app.js:2618 materialMatchesFilters */
function matchesFilters(
  material: Material,
  filters: MaterialFilters,
  data: WeekflowData,
  now: Date
): boolean {
  const relations = materialTools.resolveRelations(material, data);
  if (
    filters.name &&
    !utils.normalizeText(material.title).includes(utils.normalizeText(filters.name))
  ) {
    return false;
  }
  if (filters.types.length && !filters.types.includes(material.type)) return false;
  if (
    filters.taskIds.length &&
    !filters.taskIds.some((id) => relations.taskIds.includes(id))
  ) {
    return false;
  }
  if (
    filters.flowIds.length &&
    !filters.flowIds.some((id) => relations.flowIds.includes(id))
  ) {
    return false;
  }
  if (filters.groupIds.length) {
    const groupMatch = filters.groupIds.some((id) =>
      id === "__ungrouped__"
        ? relations.groupIds.length === 0
        : relations.groupIds.includes(id)
    );
    if (!groupMatch) return false;
  }
  if (
    filters.recentOnly &&
    !materialTools.openedInCurrentOrPreviousWeek(material, now)
  ) {
    return false;
  }
  return true;
}

export default function MaterialsView() {
  const data = useDataStore((s) => s.data);
  const view = useUiStore((s) => s.view);
  const materialFilters = useUiStore((s) => s.materialFilters);
  const selectedMaterialIds = useUiStore((s) => s.selectedMaterialIds);
  const downloadMenuRef = useRef<HTMLDetailsElement>(null);

  /* 等价 app.js:2758 getVisibleMaterials */
  const visible = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    return materialTools
      .sortByGroup(data.materials, data)
      .filter((material) => matchesFilters(material, materialFilters, data, now));
  }, [data, materialFilters]);

  const frequentCount = useMemo(() => {
    if (!data) return 0;
    const now = new Date();
    return data.materials.filter((material) =>
      materialTools.openedInCurrentOrPreviousWeek(material, now)
    ).length;
  }, [data]);

  const ungroupedCount = useMemo(() => {
    if (!data) return 0;
    return data.materials.filter(
      (material) => materialTools.resolveRelations(material, data).groupIds.length === 0
    ).length;
  }, [data]);

  const visibleIds = useMemo(() => visible.map((material) => material.id), [visible]);
  const selectedIdSet = useMemo(() => new Set(selectedMaterialIds), [selectedMaterialIds]);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIdSet.has(id)).length;

  /* 点击下载菜单项后收起（等价原版动作里的 closeDetailsMenus） */
  const closeDownloadMenu = (): void => {
    if (downloadMenuRef.current) downloadMenuRef.current.open = false;
  };

  /* 等价 app.js:2841 setVisibleMaterialsSelected：并集/差集，跨筛选保留已选 */
  const handleToggleVisible = (selected: boolean): void => {
    const ui = useUiStore.getState();
    if (selected) {
      ui.setSelectedMaterialIds(
        materialTools.uniqueIds(ui.selectedMaterialIds.concat(visibleIds))
      );
    } else {
      const visibleSet = new Set(visibleIds);
      ui.setSelectedMaterialIds(ui.selectedMaterialIds.filter((id) => !visibleSet.has(id)));
    }
  };

  /* 等价 app.js:2857 deleteSelectedMaterials：连续两次 confirm */
  const handleDeleteSelected = async (): Promise<void> => {
    const ids = useUiStore.getState().selectedMaterialIds.slice();
    if (!ids.length) return;
    if (
      !tConfirm(
        "确认删除选中的 " + ids.length + " 条资料？它们会从所有相关 Task 中同步移除。"
      )
    ) {
      return;
    }
    if (!tConfirm("再次确认：批量删除资料不可恢复，是否继续？")) return;
    await useDataStore.getState().deleteMaterials(ids);
  };

  /* 等价 app.js:2876 openMaterialLink：先记录打开次数，再打开外部链接 */
  const handleOpenLink = async (material: Material): Promise<void> => {
    if (!utils.isValidUrl(material.url)) {
      useUiStore.getState().pushToast("资料链接无效，无法打开。", "error");
      return;
    }
    await useDataStore.getState().recordMaterialOpen(material.id);
    await window.weekflow.openExternal(material.url);
  };

  if (!data) return null;
  const recentOnly = materialFilters.recentOnly;

  return (
    <section
      id="materials-view"
      className="view-panel materials-view"
      aria-labelledby="materials-heading"
      hidden={view !== "materials"}
    >
      <div className="view-toolbar materials-toolbar">
        <div className="materials-title-block">
          <div className="materials-title-line">
            <h1 id="materials-heading">资料库</h1>
            <div className="materials-summary" aria-live="polite">
              <span>
                <b id="materials-total">{data.materials.length}</b> 全部资料
              </span>
              <span title="本自然周或上个自然周至少打开过一次">
                <b id="materials-frequent-total">{frequentCount}</b> 最近常用
              </span>
              <span>
                <b id="materials-ungrouped-total">{ungroupedCount}</b> 未分组
              </span>
            </div>
          </div>
          <span id="materials-result-count">
            {"显示 " + visible.length + " / " + data.materials.length + " 条资料"}
          </span>
        </div>
        <div className="materials-actions">
          <span id="material-selection-count" className="material-selection-count">
            {"已选 " + selectedMaterialIds.length + " 条"}
          </span>
          <button
            className="button button-danger-quiet"
            type="button"
            data-action="delete-selected-materials"
            disabled={selectedMaterialIds.length === 0}
            onClick={() => void handleDeleteSelected()}
          >
            删除所选
          </button>
          <div className="segmented material-scope-toggle" aria-label="资料显示范围">
            <button
              className={recentOnly ? "" : "is-active"}
              type="button"
              data-action="materials-all"
              onClick={() => useUiStore.getState().setMaterialFilters({ recentOnly: false })}
            >
              全部
            </button>
            <button
              className={recentOnly ? "is-active" : ""}
              type="button"
              data-action="materials-recent"
              onClick={() => useUiStore.getState().setMaterialFilters({ recentOnly: true })}
            >
              最近常用
            </button>
          </div>
          <details className="materials-download-menu" ref={downloadMenuRef}>
            <summary className="button button-quiet">下载</summary>
            <div className="materials-download-popover">
              <button
                type="button"
                data-action="download-material-template"
                onClick={() => {
                  closeDownloadMenu();
                  void exporters.downloadMaterialTemplate();
                }}
              >
                下载空白模板
              </button>
              <button
                type="button"
                data-action="export-materials"
                onClick={() => {
                  closeDownloadMenu();
                  void exporters.exportMaterialLibrary();
                }}
              >
                下载资料库
              </button>
            </div>
          </details>
          <button
            className="button button-quiet"
            type="button"
            data-action="import-materials"
            onClick={() => void pickAndImportMaterialsExcel()}
          >
            上传
          </button>
          <button
            className="button button-primary"
            type="button"
            data-action="new-material"
            onClick={() => useUiStore.getState().openDialog({ type: "material" })}
          >
            ＋ 添加资料
          </button>
        </div>
      </div>

      <section className="dashboard-section materials-table-section" aria-label="资料清单">
        <div className="table-wrap materials-table-wrap">
          <table className="materials-table">
            <thead>
              <tr>
                <th className="material-select-column">
                  <input
                    id="material-select-visible"
                    type="checkbox"
                    aria-label="选择当前筛选结果中的全部资料"
                    checked={
                      visibleIds.length > 0 && selectedVisibleCount === visibleIds.length
                    }
                    ref={(el) => {
                      if (el) {
                        el.indeterminate =
                          selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
                      }
                    }}
                    onChange={(event) => handleToggleVisible(event.target.checked)}
                  />
                </th>
                <th>
                  <span>链接名称</span>
                </th>
                <th>
                  <span>链接地址</span>
                </th>
                <th>
                  <span>类型</span>
                </th>
                <th>
                  <span>相关 Task</span>
                </th>
                <th>
                  <span>相关 Flow</span>
                </th>
                <th>
                  <span>分组</span>
                </th>
                <th>
                  <span>备注</span>
                </th>
              </tr>
            </thead>
            <tbody id="materials-table-body">
              {visible.length === 0 ? (
                <tr>
                  <td className="materials-empty-cell" colSpan={8}>
                    {data.materials.length
                      ? "没有符合当前筛选条件的资料。"
                      : "还没有资料，可手动添加或上传。"}
                  </td>
                </tr>
              ) : (
                visible.map((material) => (
                  <MaterialTableRow
                    key={material.id}
                    material={material}
                    data={data}
                    selected={selectedIdSet.has(material.id)}
                    onToggleSelect={(id) =>
                      useUiStore.getState().toggleMaterialSelected(id)
                    }
                    onEdit={(id) =>
                      useUiStore.getState().openDialog({ type: "material", materialId: id })
                    }
                    onOpenLink={(item) => void handleOpenLink(item)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
