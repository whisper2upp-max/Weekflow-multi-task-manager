/* 资料行编辑器（Task 弹窗 / 资料管理弹窗共用）：
   等价原 app.js:3851 renderMaterialRows + 3934 collectMaterialRows。
   按类型分组显示（空类型不出小节），行内 名称/地址/类型/×（可选「打开」）。 */
import type { MaterialType } from "../../../shared/types";
import { TYPES, typeLabel } from "../../../shared/materials";
import { isValidUrl, uid } from "../../../shared/utils";
import type { MaterialDraft } from "../../store/dataStore";

export interface MaterialRowInvalid {
  title?: boolean;
  url?: boolean;
}

/** 新增一行的初始草稿（等价原 addDraftMaterial / addManagedLink 的 makeMaterial） */
export function makeEmptyMaterialDraft(): MaterialDraft {
  return {
    id: uid("material"),
    title: "",
    url: "",
    type: "document",
    createdAt: new Date().toISOString()
  };
}

/** 等价原 collectMaterialRows：每行须名称 + 合法 http(s) URL；返回 trim 后的草稿。 */
export function validateMaterialRows(rows: MaterialDraft[]): {
  valid: boolean;
  drafts: MaterialDraft[];
  invalid: Record<string, MaterialRowInvalid>;
} {
  let valid = true;
  const invalid: Record<string, MaterialRowInvalid> = {};
  const drafts = rows.map((row) => {
    const title = row.title.trim();
    const url = row.url.trim();
    const entry: MaterialRowInvalid = {};
    if (!title) {
      entry.title = true;
      valid = false;
    }
    if (!isValidUrl(url)) {
      entry.url = true;
      valid = false;
    }
    if (entry.title || entry.url) invalid[row.id] = entry;
    return {
      id: row.id || uid("material"),
      title,
      url,
      type: row.type,
      ...(row.createdAt ? { createdAt: row.createdAt } : {})
    };
  });
  return { valid, drafts, invalid };
}

interface MaterialRowsEditorProps {
  /** 容器 id（task-materials / link-manager-rows），供“添加资料”后聚焦最后一行 */
  id: string;
  className: string;
  rows: MaterialDraft[];
  invalid: Record<string, MaterialRowInvalid>;
  /** 显示行内「打开」按钮（资料管理弹窗） */
  showOpen?: boolean;
  onChange: (rows: MaterialDraft[]) => void;
  onOpenRow?: (row: MaterialDraft) => void;
}

export default function MaterialRowsEditor({
  id,
  className,
  rows,
  invalid,
  showOpen,
  onChange,
  onOpenRow
}: MaterialRowsEditorProps) {
  const update = (rowId: string, patch: Partial<MaterialDraft>): void => {
    onChange(rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };
  return (
    <div id={id} className={className}>
      {!rows.length && (
        <p className="modal-context" style={{ margin: "4px 0" }}>
          暂无相关资料
        </p>
      )}
      {TYPES.map((type) => {
        const typeRows = rows.filter((row) => row.type === type);
        if (!typeRows.length) return null;
        return (
          <section key={type} className={"material-type-group type-" + type}>
            <h4>
              {typeLabel(type)}
              <span>{typeRows.length}</span>
            </h4>
            {typeRows.map((row) => {
              const rowInvalid = invalid[row.id] || {};
              return (
                <div key={row.id} className="link-row material-link-row" data-material-id={row.id}>
                  <input
                    type="text"
                    maxLength={160}
                    placeholder="链接名称"
                    aria-label="链接名称"
                    data-material-field="title"
                    value={row.title}
                    className={rowInvalid.title ? "is-invalid" : undefined}
                    onChange={(event) => update(row.id, { title: event.target.value })}
                  />
                  <input
                    type="url"
                    maxLength={3000}
                    placeholder="https://"
                    aria-label="链接地址"
                    data-material-field="url"
                    value={row.url}
                    className={rowInvalid.url ? "is-invalid" : undefined}
                    onChange={(event) => update(row.id, { url: event.target.value })}
                  />
                  <select
                    data-material-field="type"
                    aria-label="链接类型"
                    value={row.type}
                    onChange={(event) =>
                      update(row.id, { type: event.target.value as MaterialType })
                    }
                  >
                    {TYPES.map((value) => (
                      <option key={value} value={value}>
                        {typeLabel(value)}
                      </option>
                    ))}
                  </select>
                  {showOpen && (
                    <button
                      className="open-link"
                      type="button"
                      onClick={() => {
                        if (onOpenRow) onOpenRow(row);
                      }}
                    >
                      打开
                    </button>
                  )}
                  <button
                    className="remove-link"
                    type="button"
                    title="从当前 Task 移除资料关联"
                    aria-label={"移除资料 " + row.title}
                    onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
