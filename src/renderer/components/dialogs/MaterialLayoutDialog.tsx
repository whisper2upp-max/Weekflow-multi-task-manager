import { useMemo, useRef, useState } from "react";
import type { DragEvent, FormEvent, RefObject } from "react";
import { UNGROUPED_MATERIAL_KEY } from "../../../shared/types";
import type { Group, WeekflowData } from "../../../shared/types";
import { useModalDialog } from "../../lib/useModalDialog";
import { useDataStore } from "../../store/dataStore";
import { useUiStore } from "../../store/uiStore";

type ColumnCount = 1 | 2 | 3 | 4;

function defaultOrder(data: WeekflowData): string[] {
  return data.groups
    .slice()
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .map((group) => group.id)
    .concat(UNGROUPED_MATERIAL_KEY);
}

function validOrder(data: WeekflowData, requested: string[]): string[] {
  const defaults = defaultOrder(data);
  const valid = requested.filter((key, index) => defaults.includes(key) && requested.indexOf(key) === index);
  defaults.forEach((key) => {
    if (!valid.includes(key)) valid.push(key);
  });
  return valid;
}

export default function MaterialLayoutDialog() {
  const dialog = useUiStore((state) => state.dialog?.type === "materialLayout" ? state.dialog : null);
  const data = useDataStore((state) => state.data);
  const closeDialog = useUiStore((state) => state.closeDialog);
  const ref = useModalDialog(Boolean(dialog), closeDialog);
  if (!dialog || !data) return null;
  return <MaterialLayoutDialogInner key={data.updatedAt} data={data} dialogRef={ref} />;
}

function MaterialLayoutDialogInner({ data, dialogRef }: {
  data: WeekflowData;
  dialogRef: RefObject<HTMLDialogElement>;
}) {
  const closeDialog = useUiStore((state) => state.closeDialog);
  const [columns, setColumns] = useState<ColumnCount>(data.preferences.documentLibrary.columns);
  const [order, setOrder] = useState(() => validOrder(data, data.preferences.documentLibrary.groupOrder));
  const [saving, setSaving] = useState(false);
  const draggedKey = useRef<string | null>(null);
  const groups = useMemo(() => new Map(data.groups.map((group) => [group.id, group])), [data.groups]);

  const move = (index: number, offset: number): void => {
    const target = index + offset;
    if (target < 0 || target >= order.length) return;
    setOrder((current) => {
      const next = current.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const reorderOnDrag = (event: DragEvent<HTMLDivElement>, targetKey: string): void => {
    event.preventDefault();
    const sourceKey = draggedKey.current;
    if (!sourceKey || sourceKey === targetKey) return;
    const targetElement = event.currentTarget;
    const placeAfter = event.clientY > targetElement.getBoundingClientRect().top + targetElement.offsetHeight / 2;
    setOrder((current) => {
      const withoutSource = current.filter((key) => key !== sourceKey);
      const targetIndex = withoutSource.indexOf(targetKey);
      withoutSource.splice(Math.max(0, targetIndex + (placeAfter ? 1 : 0)), 0, sourceKey);
      return withoutSource;
    });
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    void useDataStore.getState().saveDocumentLibraryLayout(columns, order).then((ok) => {
      setSaving(false);
      if (ok) closeDialog();
    });
  };

  return (
    <dialog ref={dialogRef} id="material-layout-dialog" className="modal material-layout-dialog">
      <form method="dialog" noValidate onSubmit={submit}>
        <div className="modal-head">
          <div><p className="eyebrow">Group layout</p><h2>调整分组布局</h2></div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={closeDialog}>×</button>
        </div>
        <p className="modal-context">设置每行显示的分组数，并拖动分组调整排列顺序。</p>
        <label className="form-field material-layout-columns-field" htmlFor="material-layout-columns">
          <span>每行分组数</span>
          <select id="material-layout-columns" value={columns} onChange={(event) => setColumns(Number(event.target.value) as ColumnCount)}>
            <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
          </select>
        </label>
        <section className="material-layout-order-section" aria-labelledby="material-layout-order-title">
          <div className="material-layout-order-head"><div><h3 id="material-layout-order-title">分组排列顺序</h3><p>拖动左侧把手调整顺序，也可使用上下移动按钮。</p></div></div>
          <div className="material-layout-order-list">
            {order.map((key, index) => {
              const group: Group | undefined = groups.get(key);
              const name = key === UNGROUPED_MATERIAL_KEY ? "未分组" : group?.name || "";
              const color = key === UNGROUPED_MATERIAL_KEY ? "#9AA4B7" : group?.color || "#9AA4B7";
              return (
                <div
                  className="material-layout-order-item"
                  key={key}
                  draggable
                  data-material-group-key={key}
                  style={{ "--group-color": color } as React.CSSProperties}
                  onDragStart={(event) => {
                    draggedKey.current = key;
                    event.currentTarget.classList.add("is-dragging");
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", key);
                  }}
                  onDragOver={(event) => reorderOnDrag(event, key)}
                  onDrop={(event) => event.preventDefault()}
                  onDragEnd={(event) => {
                    draggedKey.current = null;
                    event.currentTarget.classList.remove("is-dragging");
                  }}
                >
                  <span className="material-layout-drag-handle" title="拖动调整顺序" aria-hidden="true">⠿</span>
                  <span className="material-layout-order-number">{String(index + 1).padStart(2, "0")}</span>
                  <strong data-user-content={group ? "true" : undefined}>{name}</strong>
                  <span className="material-layout-order-controls">
                    <button type="button" title="上移" disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
                    <button type="button" title="下移" disabled={index === order.length - 1} onClick={() => move(index, 1)}>↓</button>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
        <div className="modal-actions split-actions">
          <button className="button button-quiet" type="button" onClick={() => { setColumns(4); setOrder(defaultOrder(data)); }}>恢复默认</button>
          <span></span>
          <button className="button button-quiet" type="button" onClick={closeDialog}>取消</button>
          <button className="button button-primary" type="submit" disabled={saving}>应用布局</button>
        </div>
      </form>
    </dialog>
  );
}
