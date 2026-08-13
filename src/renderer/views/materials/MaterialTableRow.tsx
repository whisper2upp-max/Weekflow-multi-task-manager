/* 资料库表格行：选择框、链接名称/地址按钮、类型徽标、相关 Task/Flow/分组 chips、备注。
   等价原 app.js:2661 appendMaterialChips + 2679 createMaterialTableRow。 */
import type { CSSProperties } from "react";
import * as materialTools from "../../../shared/materials";
import type { Material, WeekflowData } from "../../../shared/types";

interface ChipItem {
  id: string;
  label: string;
  color?: string | null;
}

/* 等价 app.js:2661 appendMaterialChips */
function MaterialChips({ items, emptyLabel }: { items: ChipItem[]; emptyLabel: string }) {
  return (
    <div className="material-chip-list">
      {items.length === 0 ? (
        <span className="material-chip is-empty">{emptyLabel}</span>
      ) : (
        items.map((item) => (
          <span
            key={item.id}
            className={item.color ? "material-chip has-color" : "material-chip"}
            data-user-content="true"
            style={
              item.color ? ({ "--chip-color": item.color } as CSSProperties) : undefined
            }
          >
            {item.label}
          </span>
        ))
      )}
    </div>
  );
}

export interface MaterialTableRowProps {
  material: Material;
  data: WeekflowData;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onOpenLink: (material: Material) => void;
}

/* 等价 app.js:2679 createMaterialTableRow */
export default function MaterialTableRow({
  material,
  data,
  selected,
  onToggleSelect,
  onEdit,
  onOpenLink
}: MaterialTableRowProps) {
  const relations = materialTools.resolveRelations(material, data);
  const openCount = materialTools.currentAndPreviousWeekOpenCount(material, new Date());
  return (
    <tr data-material-id={material.id}>
      <td className="material-select-column">
        <input
          type="checkbox"
          value={material.id}
          data-material-select="true"
          checked={selected}
          aria-label={"选择资料 " + material.title}
          onChange={() => onToggleSelect(material.id)}
        />
      </td>
      <td>
        <button
          className="material-name-button"
          type="button"
          onClick={() => onEdit(material.id)}
        >
          {material.title}
        </button>
      </td>
      <td>
        <button
          className="material-url-button"
          type="button"
          title={"打开 " + material.title}
          onClick={() => onOpenLink(material)}
        >
          {material.url}
        </button>
        <small>{"本周及上周打开 " + openCount + " 次"}</small>
      </td>
      <td>
        <span className={"material-type-badge type-" + material.type}>
          {materialTools.typeLabel(material.type)}
        </span>
      </td>
      <td>
        <MaterialChips
          items={relations.tasks.map((task) => ({ id: task.id, label: task.name }))}
          emptyLabel="未关联"
        />
      </td>
      <td>
        <MaterialChips
          items={relations.flows.map((flow) => ({
            id: flow.id,
            label: flow.name,
            color: flow.color
          }))}
          emptyLabel="未关联"
        />
      </td>
      <td>
        <MaterialChips
          items={relations.groups.map((group) => ({
            id: group.id,
            label: group.name,
            color: group.color
          }))}
          emptyLabel="未分组"
        />
      </td>
      <td className="material-note-cell" title={material.note || ""}>
        {material.note || "—"}
      </td>
    </tr>
  );
}
