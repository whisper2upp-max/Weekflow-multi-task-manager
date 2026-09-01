import { useEffect, useRef, useState } from "react";
import * as richText from "../../shared/rich-text";
import { isEnglish } from "../lib/i18n";
import { useUiStore } from "../store/uiStore";

const TEXT_COLORS = [
  "#172033", "#475569", "#64748B", "#665CFF", "#4338CA",
  "#2563EB", "#0E7490", "#0F766E", "#15803D", "#4D7C0F",
  "#A16207", "#D97706", "#C2410C", "#DC2626", "#BE123C",
  "#DB2777", "#9333EA", "#7C2D12", "#0F172A", "#FFFFFF"
];
const HIGHLIGHT_COLORS = [
  "#FFF1A8", "#FDE68A", "#FEF3C7", "#FED7AA", "#FECACA",
  "#FFE4E6", "#FBCFE8", "#E9D5FF", "#DDD6FE", "#C7D2FE",
  "#BFDBFE", "#BAE6FD", "#A5F3FC", "#99F6E4", "#BBF7D0",
  "#D9F99D", "#E2E8F0", "#CBD5E1", "#F1F5F9", "#FFFFFF"
];

interface Props {
  id: string;
  value: string;
  onChange(value: { html: string; text: string }): void;
  maxLength: number;
  placeholder: string;
  className?: string;
  autoFocus?: boolean;
  allowTables?: boolean;
}

type Palette = "text" | "highlight" | null;
type TableSubmenu = "create" | "edit" | null;
type TableOperation = "insert-row" | "insert-column" | "delete-row" | "delete-column" | "merge-cells" | "clear-table" | "delete-table";

interface CellInfo {
  cell: HTMLTableCellElement;
  row: number;
  column: number;
  rowSpan: number;
  colSpan: number;
}
interface TableModel {
  table: HTMLTableElement;
  rows: HTMLTableRowElement[];
  grid: Array<Array<CellInfo | undefined>>;
  width: number;
  infoByCell: Map<HTMLTableCellElement, CellInfo>;
}
interface TableRegion {
  table: HTMLTableElement;
  model: TableModel;
  cells: HTMLTableCellElement[];
  minRow: number;
  maxRow: number;
  minColumn: number;
  maxColumn: number;
}
interface TableHistoryEntry { before: string; after: string }

function selectionRangeInsideEditor(editor: HTMLElement | null, selection: Selection | null): Range | null {
  if (!editor || !selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) return range.cloneRange();
  try { if (!range.intersectsNode(editor)) return null; } catch { return null; }
  const clipped = range.cloneRange();
  if (!editor.contains(clipped.startContainer)) clipped.setStart(editor, 0);
  if (!editor.contains(clipped.endContainer)) clipped.setEnd(editor, editor.childNodes.length);
  return clipped;
}

function closestCell(node: EventTarget | Node | null, editor: HTMLElement | null): HTMLTableCellElement | null {
  const element = node instanceof Element ? node : node instanceof Node ? node.parentElement : null;
  const cell = element?.closest("td, th");
  return cell instanceof HTMLTableCellElement && editor?.contains(cell) ? cell : null;
}

function buildTableModel(table: HTMLTableElement): TableModel {
  const rows = Array.from(table.rows);
  const grid: Array<Array<CellInfo | undefined>> = [];
  const infoByCell = new Map<HTMLTableCellElement, CellInfo>();
  let width = 0;
  rows.forEach((row, rowIndex) => {
    grid[rowIndex] ||= [];
    let columnIndex = 0;
    Array.from(row.cells).forEach((cell) => {
      while (grid[rowIndex][columnIndex]) columnIndex += 1;
      const rowSpan = richText.normalizeTableSpan(cell.getAttribute("rowspan"));
      const colSpan = richText.normalizeTableSpan(cell.getAttribute("colspan"));
      const info: CellInfo = { cell, row: rowIndex, column: columnIndex, rowSpan, colSpan };
      infoByCell.set(cell, info);
      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        const gridRow = rowIndex + rowOffset;
        grid[gridRow] ||= [];
        for (let columnOffset = 0; columnOffset < colSpan; columnOffset += 1) {
          grid[gridRow][columnIndex + columnOffset] = info;
        }
      }
      columnIndex += colSpan;
      width = Math.max(width, columnIndex);
    });
  });
  return { table, rows, grid, width, infoByCell };
}

function tableRegionBetweenCells(anchor: HTMLTableCellElement | null, focus: HTMLTableCellElement | null, table: HTMLTableElement | null): TableRegion | null {
  if (!anchor || !focus || !table || table !== anchor.closest("table") || table !== focus.closest("table")) return null;
  const model = buildTableModel(table);
  const anchorInfo = model.infoByCell.get(anchor);
  const focusInfo = model.infoByCell.get(focus);
  if (!anchorInfo || !focusInfo) return null;
  const minRow = Math.min(anchorInfo.row, focusInfo.row);
  const maxRow = Math.max(anchorInfo.row + anchorInfo.rowSpan - 1, focusInfo.row + focusInfo.rowSpan - 1);
  const minColumn = Math.min(anchorInfo.column, focusInfo.column);
  const maxColumn = Math.max(anchorInfo.column + anchorInfo.colSpan - 1, focusInfo.column + focusInfo.colSpan - 1);
  const cells: HTMLTableCellElement[] = [];
  const seen = new Set<HTMLTableCellElement>();
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      const info = model.grid[row]?.[column];
      if (info && !seen.has(info.cell)) { seen.add(info.cell); cells.push(info.cell); }
    }
  }
  cells.sort((left, right) => {
    const leftInfo = model.infoByCell.get(left)!;
    const rightInfo = model.infoByCell.get(right)!;
    return leftInfo.row - rightInfo.row || leftInfo.column - rightInfo.column;
  });
  return { table, model, cells, minRow, maxRow, minColumn, maxColumn };
}

function wholeTable(region: TableRegion | null): boolean {
  return Boolean(region && region.minRow === 0 && region.minColumn === 0 &&
    region.maxRow === region.model.grid.length - 1 && region.maxColumn === region.model.width - 1 &&
    region.cells.length === region.model.infoByCell.size);
}

function setCellSpan(cell: HTMLTableCellElement, attribute: "rowspan" | "colspan", value: number): void {
  if (value > 1) cell.setAttribute(attribute, String(value));
  else cell.removeAttribute(attribute);
}
function emptyCell(tagName: "TD" | "TH" = "TD"): HTMLTableCellElement {
  const cell = document.createElement(tagName === "TH" ? "th" : "td");
  cell.appendChild(document.createElement("br"));
  return cell;
}
function tableHtmlFromDimensions(rows: number, columns: number, values?: string[][], trailing = true): string {
  const output = ["<table><tbody>"];
  for (let row = 0; row < rows; row += 1) {
    output.push("<tr>");
    for (let column = 0; column < columns; column += 1) {
      const value = values?.[row]?.[column] || "";
      output.push(`<td>${value ? richText.escapeHtml(value) : "<br>"}</td>`);
    }
    output.push("</tr>");
  }
  output.push("</tbody></table>");
  if (trailing) output.push("<p><br></p>");
  return output.join("");
}
function tableHtmlFromTabText(text: string): string {
  const source = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!source.includes("\t")) return "";
  const rows = source.replace(/\n$/, "").split("\n").slice(0, 200).map((line) => line.split("\t").slice(0, 100));
  const columns = rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  return rows.length && columns > 1 ? tableHtmlFromDimensions(rows.length, columns, rows, false) : "";
}
function usesAppleDeleteKeyLayout(): boolean {
  const source = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(String(source.userAgentData?.platform || navigator.platform || ""));
}

export default function AdvancedRichTextEditor({ id, value, onChange, maxLength, placeholder, className = "", autoFocus = false, allowTables = false }: Props) {
  const controlRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const anchorRef = useRef<HTMLTableCellElement | null>(null);
  const focusRef = useRef<HTMLTableCellElement | null>(null);
  const pointerAnchorRef = useRef<HTMLTableCellElement | null>(null);
  const shiftAnchorRef = useRef<HTMLTableCellElement | null>(null);
  const dragSelectingRef = useRef(false);
  const dragFinishedRef = useRef(false);
  const handleHideTimerRef = useRef<number | null>(null);
  const tableUndoRef = useRef<TableHistoryEntry[]>([]);
  const tableRedoRef = useRef<TableHistoryEntry[]>([]);
  const [palette, setPalette] = useState<Palette>(null);
  const [tableMenu, setTableMenu] = useState(false);
  const [tableSubmenu, setTableSubmenu] = useState<TableSubmenu>(null);
  const [tableSize, setTableSize] = useState({ rows: 1, columns: 1 });
  const [, forceSelectionRender] = useState(0);
  const [hoveredTable, setHoveredTable] = useState<HTMLTableElement | null>(null);
  const [handlePosition, setHandlePosition] = useState({ visible: false, left: 0, top: 0 });
  const [selectedColors, setSelectedColors] = useState({ text: TEXT_COLORS[0], highlight: HIGHLIGHT_COLORS[0] });

  const region = (): TableRegion | null => {
    const editor = editorRef.current;
    const table = anchorRef.current?.closest("table");
    return editor && table instanceof HTMLTableElement && editor.contains(table)
      ? tableRegionBetweenCells(anchorRef.current, focusRef.current || anchorRef.current, table)
      : null;
  };
  const renderSelection = (): void => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll(".is-table-active, .is-table-selected").forEach((cell) => cell.classList.remove("is-table-active", "is-table-selected"));
    editor.querySelectorAll("table.has-table-selection").forEach((table) => table.classList.remove("has-table-selection"));
    const selected = region();
    if (selected) {
      selected.table.classList.add("has-table-selection");
      selected.cells.forEach((cell) => cell.classList.add("is-table-selected"));
      focusRef.current?.classList.add("is-table-active");
    }
    forceSelectionRender((current) => current + 1);
  };
  const clearSelection = (): void => {
    anchorRef.current = null; focusRef.current = null; pointerAnchorRef.current = null; shiftAnchorRef.current = null; dragSelectingRef.current = false;
    renderSelection();
  };
  const emit = (): void => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = richText.sanitizeHtml(editor.innerHTML, maxLength);
    if (html !== editor.innerHTML) editor.innerHTML = html;
    onChange({ html, text: richText.plainText(html).slice(0, maxLength) });
  };
  const collapseNativeSelection = (cell: HTMLTableCellElement | null): void => {
    const editor = editorRef.current;
    if (!editor || !cell?.isConnected || !editor.contains(cell)) return;
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(cell); range.collapse(false);
    selection.removeAllRanges(); selection.addRange(range);
    savedRangeRef.current = range.cloneRange();
  };
  const rememberSelection = (syncTable = true): void => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const range = selectionRangeInsideEditor(editor, selection);
    if (!range) return;
    savedRangeRef.current = range;
    if (!allowTables || !syncTable || !selection) return;
    const intersecting = Array.from(editor?.querySelectorAll<HTMLTableCellElement>("td, th") || []).filter((cell) => {
      try { return range.intersectsNode(cell); } catch { return false; }
    });
    let anchor = closestCell(selection.anchorNode, editor) || closestCell(range.startContainer, editor);
    let focus = closestCell(selection.focusNode, editor) || closestCell(range.endContainer, editor);
    if (!anchor && intersecting.length) anchor = intersecting[0];
    if (!focus && intersecting.length) focus = intersecting[intersecting.length - 1];
    if (anchor && focus && anchor.closest("table") === focus.closest("table")) {
      anchorRef.current = anchor; focusRef.current = focus; renderSelection();
      if ((region()?.cells.length || 0) > 1) collapseNativeSelection(focus);
    }
  };
  const restoreSelection = (): void => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (!selection || !savedRangeRef.current) return;
    try { selection.removeAllRanges(); selection.addRange(savedRangeRef.current); } catch { /* stale range */ }
  };
  const normalizeExecutedFontSize = (size: number): void => {
    editorRef.current?.querySelectorAll("font[size='7']").forEach((font) => {
      const span = document.createElement("span");
      span.style.fontSize = `${size}px`;
      const color = font.getAttribute("color");
      if (color) span.style.color = color;
      while (font.firstChild) span.appendChild(font.firstChild);
      font.replaceWith(span);
    });
  };
  const command = (name: string, commandValue?: string): void => {
    restoreSelection();
    try {
      let applied = false;
      if (name === "fontSize") {
        const size = Number(commandValue);
        if (!(richText.FONT_SIZE_PRESETS as readonly number[]).includes(size)) return;
        applied = document.execCommand("fontSize", false, "7");
        if (applied) normalizeExecutedFontSize(size);
      } else applied = document.execCommand(name, false, commandValue);
      if (!applied && name === "hiliteColor") document.execCommand("backColor", false, commandValue || HIGHLIGHT_COLORS[0]);
    } catch { /* unsupported formatting command */ }
    rememberSelection(); emit();
  };
  const applyColor = (mode: Exclude<Palette, null>, color: string): void => {
    command(mode === "text" ? "foreColor" : "hiliteColor", color);
    setSelectedColors((current) => ({ ...current, [mode]: color })); setPalette(null);
  };
  const placeCaretInNode = (node: Node | null): void => {
    if (!node) return;
    const range = document.createRange(); range.selectNodeContents(node); range.collapse(false);
    const selection = window.getSelection();
    if (selection) { selection.removeAllRanges(); selection.addRange(range); savedRangeRef.current = range.cloneRange(); }
    editorRef.current?.focus();
  };
  const selectCell = (cell: HTMLTableCellElement | null): void => {
    if (!cell) return clearSelection();
    anchorRef.current = cell; focusRef.current = cell; renderSelection(); placeCaretInNode(cell);
  };
  const insertHtmlWithUndo = (html: string): boolean => {
    const editor = editorRef.current;
    if (!editor) return false;
    const sanitized = richText.sanitizeHtml(html, richText.MAX_NOTE_TEXT);
    if (!sanitized) return false;
    restoreSelection();
    let inserted = false;
    try { inserted = document.execCommand("insertHTML", false, sanitized); } catch { inserted = false; }
    return inserted || richText.insertHtmlAtSelection(sanitized, editor);
  };
  const insertTableHtml = (html: string): HTMLTableElement | null => {
    const editor = editorRef.current;
    if (!editor) return null;
    const existing = new Set(editor.querySelectorAll("table"));
    if (!insertHtmlWithUndo(html)) {
      const template = document.createElement("template");
      template.innerHTML = richText.sanitizeHtml(html, richText.MAX_NOTE_TEXT);
      editor.appendChild(template.content);
    }
    const inserted = Array.from(editor.querySelectorAll<HTMLTableElement>("table")).find((table) => !existing.has(table)) || null;
    emit();
    if (inserted) selectCell(inserted.querySelector("td, th"));
    return inserted;
  };
  const replaceTable = (table: HTMLTableElement, replacementHtml: string): HTMLTableElement | null | false => {
    const editor = editorRef.current;
    if (!editor || !table.isConnected || !editor.contains(table)) return false;
    const template = document.createElement("template");
    template.innerHTML = richText.sanitizeHtml(replacementHtml, richText.MAX_NOTE_TEXT);
    const replacement = template.content.querySelector("table");
    table.replaceWith(template.content);
    return replacement instanceof HTMLTableElement && replacement.isConnected ? replacement : null;
  };
  const editorSnapshot = (): string => richText.sanitizeHtml(editorRef.current?.innerHTML || "", maxLength);
  const recordTableHistory = (before: string): void => {
    const after = editorSnapshot();
    if (before === after) return;
    tableUndoRef.current.push({ before, after });
    if (tableUndoRef.current.length > 50) tableUndoRef.current.shift();
    tableRedoRef.current = [];
  };
  const restoreTableSnapshot = (html: string): void => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = richText.sanitizeHtml(html, maxLength);
    clearSelection();
    emit();
    const lastTable = editor.querySelector<HTMLTableElement>("table:last-of-type");
    placeCaretInNode(lastTable?.querySelector("td, th") || editor.lastChild || editor);
  };
  const undoTableOperation = (): boolean => {
    const entry = tableUndoRef.current.at(-1);
    if (!entry || editorSnapshot() !== entry.after) return false;
    tableUndoRef.current.pop();
    tableRedoRef.current.push(entry);
    restoreTableSnapshot(entry.before);
    return true;
  };
  const redoTableOperation = (): boolean => {
    const entry = tableRedoRef.current.at(-1);
    if (!entry || editorSnapshot() !== entry.before) return false;
    tableRedoRef.current.pop();
    tableUndoRef.current.push(entry);
    restoreTableSnapshot(entry.after);
    return true;
  };

  const insertRow = (selected: TableRegion, focusCell: HTMLTableCellElement): HTMLTableCellElement | null => {
    const model = selected.model;
    const active = model.infoByCell.get(focusCell);
    const currentRow = active ? model.rows[active.row] : null;
    if (!active || !currentRow) return null;
    const insertAt = active.row + 1;
    const crossing: CellInfo[] = [];
    Array.from(model.infoByCell.values()).forEach((info) => {
      if (info.row < insertAt && info.row + info.rowSpan > insertAt) {
        crossing.push(info); info.rowSpan += 1; setCellSpan(info.cell, "rowspan", info.rowSpan);
      }
    });
    const newRow = document.createElement("tr");
    let firstCell: HTMLTableCellElement | null = null;
    for (let column = 0; column < Math.max(1, model.width); column += 1) {
      if (crossing.some((info) => column >= info.column && column < info.column + info.colSpan)) continue;
      const cell = emptyCell(); firstCell ||= cell; newRow.appendChild(cell);
    }
    currentRow.parentNode?.insertBefore(newRow, currentRow.nextSibling);
    return firstCell || crossing[0]?.cell || null;
  };
  const insertColumn = (selected: TableRegion, focusCell: HTMLTableCellElement): HTMLTableCellElement | null => {
    const model = selected.model;
    const active = model.infoByCell.get(focusCell);
    if (!active) return null;
    const insertAt = active.column + active.colSpan;
    const crossing: CellInfo[] = [];
    Array.from(model.infoByCell.values()).forEach((info) => {
      if (info.column < insertAt && info.column + info.colSpan > insertAt) {
        crossing.push(info); info.colSpan += 1; setCellSpan(info.cell, "colspan", info.colSpan);
      }
    });
    let firstCell: HTMLTableCellElement | null = null;
    model.rows.forEach((row, rowIndex) => {
      if (crossing.some((info) => rowIndex >= info.row && rowIndex < info.row + info.rowSpan)) return;
      const cell = emptyCell(row.parentElement?.tagName === "THEAD" ? "TH" : "TD");
      const before = Array.from(row.cells).find((candidate) => (model.infoByCell.get(candidate)?.column ?? -1) >= insertAt);
      row.insertBefore(cell, before || null);
      if (!firstCell || rowIndex === active.row) firstCell = cell;
    });
    return firstCell;
  };
  const deleteRow = (selected: TableRegion, focusCell: HTMLTableCellElement): HTMLTableCellElement | null => {
    const model = selected.model;
    const active = model.infoByCell.get(focusCell);
    const rowIndex = active?.row;
    if (!active || rowIndex === undefined) return null;
    const row = model.rows[rowIndex];
    if (!row) return null;
    const nextRow = model.rows[rowIndex + 1] || null;
    Array.from(model.infoByCell.values()).sort((a, b) => a.column - b.column).forEach((info) => {
      if (info.row < rowIndex && info.row + info.rowSpan > rowIndex) {
        info.rowSpan -= 1; setCellSpan(info.cell, "rowspan", info.rowSpan);
      } else if (info.row === rowIndex && info.rowSpan > 1 && nextRow) {
        info.rowSpan -= 1; setCellSpan(info.cell, "rowspan", info.rowSpan);
        const before = Array.from(nextRow.cells).find((candidate) => (model.infoByCell.get(candidate)?.column ?? -1) > info.column);
        nextRow.insertBefore(info.cell, before || null);
      }
    });
    row.remove();
    const refreshed = buildTableModel(selected.table);
    return (refreshed.grid[Math.min(rowIndex, refreshed.rows.length - 1)]?.[active.column] || refreshed.grid[0]?.[0])?.cell || null;
  };
  const deleteColumn = (selected: TableRegion, focusCell: HTMLTableCellElement): HTMLTableCellElement | null => {
    const model = selected.model;
    const active = model.infoByCell.get(focusCell);
    if (!active) return null;
    const column = active.column;
    Array.from(model.infoByCell.values()).forEach((info) => {
      if (column < info.column || column >= info.column + info.colSpan) return;
      if (info.colSpan > 1) { info.colSpan -= 1; setCellSpan(info.cell, "colspan", info.colSpan); }
      else info.cell.remove();
    });
    const refreshed = buildTableModel(selected.table);
    return (refreshed.grid[Math.min(active.row, refreshed.rows.length - 1)]?.[Math.min(column, refreshed.width - 1)] || refreshed.grid[0]?.[0])?.cell || null;
  };
  const mergeCells = (selected: TableRegion): HTMLTableCellElement | null => {
    if (selected.cells.length < 2) return null;
    const invalid = selected.cells.some((cell) => {
      const info = selected.model.infoByCell.get(cell)!;
      return info.row < selected.minRow || info.column < selected.minColumn ||
        info.row + info.rowSpan - 1 > selected.maxRow || info.column + info.colSpan - 1 > selected.maxColumn;
    });
    if (invalid) {
      useUiStore.getState().pushToast(isEnglish() ? "The selection crosses an existing merged cell. Select a complete rectangle." : "所选区域穿过了已有合并单元格，请选择完整的矩形区域。", "warning");
      return null;
    }
    const primary = selected.model.grid[selected.minRow]?.[selected.minColumn]?.cell;
    if (!primary) return null;
    const contents = selected.cells.map((cell) => cell.innerHTML).filter((html) => richText.plainText(html).trim());
    primary.innerHTML = contents.length ? contents.join("<br>") : "<br>";
    selected.cells.forEach((cell) => { if (cell !== primary) cell.remove(); });
    setCellSpan(primary, "rowspan", selected.maxRow - selected.minRow + 1);
    setCellSpan(primary, "colspan", selected.maxColumn - selected.minColumn + 1);
    return primary;
  };
  const closeTableMenus = (): void => { setTableMenu(false); setTableSubmenu(null); };
  const editTable = (operation: TableOperation): void => {
    const selected = region();
    if (!selected) {
      useUiStore.getState().pushToast(isEnglish() ? "Select a table cell first." : "请先点击要编辑的表格单元格。", "warning");
      return;
    }
    const beforeEditor = editorSnapshot();
    const anchorInfo = selected.model.infoByCell.get(anchorRef.current!);
    const focusInfo = selected.model.infoByCell.get(focusRef.current!);
    if (!anchorInfo || !focusInfo) return;
    const clone = selected.table.cloneNode(true) as HTMLTableElement;
    const cloneModel = buildTableModel(clone);
    const cloneAnchor = cloneModel.grid[anchorInfo.row]?.[anchorInfo.column]?.cell || null;
    const cloneFocus = cloneModel.grid[focusInfo.row]?.[focusInfo.column]?.cell || null;
    const cloneRegion = tableRegionBetweenCells(cloneAnchor, cloneFocus, clone);
    if (!cloneRegion || !cloneFocus) return;
    const before = richText.sanitizeHtml(clone.outerHTML, richText.MAX_NOTE_TEXT);
    const removeTable = operation === "delete-table" || (operation === "delete-row" && cloneRegion.model.rows.length <= 1) || (operation === "delete-column" && cloneRegion.model.width <= 1);
    let nextCell: HTMLTableCellElement | null = null;
    if (!removeTable) {
      if (operation === "clear-table") {
        clone.querySelectorAll<HTMLTableCellElement>("td, th").forEach((cell) => cell.replaceChildren(document.createElement("br")));
        nextCell = cloneFocus;
      } else if (operation === "insert-row") nextCell = insertRow(cloneRegion, cloneFocus);
      else if (operation === "insert-column") nextCell = insertColumn(cloneRegion, cloneFocus);
      else if (operation === "delete-row") nextCell = deleteRow(cloneRegion, cloneFocus);
      else if (operation === "delete-column") nextCell = deleteColumn(cloneRegion, cloneFocus);
      else if (operation === "merge-cells") nextCell = mergeCells(cloneRegion);
    }
    let nextPosition: { row: number; column: number } | null = null;
    if (nextCell && clone.contains(nextCell)) {
      const info = buildTableModel(clone).infoByCell.get(nextCell);
      if (info) nextPosition = { row: info.row, column: info.column };
    }
    const replacementHtml = removeTable ? "<p><br></p>" : richText.sanitizeHtml(clone.outerHTML, richText.MAX_NOTE_TEXT);
    if (!removeTable && replacementHtml === before) return closeTableMenus();
    const replacement = replaceTable(selected.table, replacementHtml);
    if (replacement === false) return;
    clearSelection();
    if (replacement && nextPosition) {
      const model = buildTableModel(replacement);
      const info = model.grid[nextPosition.row]?.[nextPosition.column] || model.grid[nextPosition.row]?.[0];
      if (info) selectCell(info.cell);
    }
    emit(); recordTableHistory(beforeEditor); closeTableMenus();
  };
  const cloneSelectedRegion = (selected: TableRegion): HTMLTableElement => {
    const table = document.createElement("table");
    const body = document.createElement("tbody");
    const emitted = new Set<HTMLTableCellElement>();
    table.appendChild(body);
    for (let row = selected.minRow; row <= selected.maxRow; row += 1) {
      const targetRow = document.createElement("tr");
      for (let column = selected.minColumn; column <= selected.maxColumn; column += 1) {
        const info = selected.model.grid[row]?.[column];
        if (!info || emitted.has(info.cell)) continue;
        emitted.add(info.cell);
        const clone = info.cell.cloneNode(true) as HTMLTableCellElement;
        setCellSpan(clone, "rowspan", info.rowSpan); setCellSpan(clone, "colspan", info.colSpan);
        targetRow.appendChild(clone);
      }
      body.appendChild(targetRow);
    }
    return table;
  };
  const refreshHandle = (table: HTMLTableElement | null): void => {
    const control = controlRef.current;
    if (!control || !table?.isConnected) return setHandlePosition((position) => ({ ...position, visible: false }));
    const controlBounds = control.getBoundingClientRect();
    const tableBounds = table.getBoundingClientRect();
    setHandlePosition({ visible: true, left: Math.max(2, tableBounds.left - controlBounds.left - 24), top: Math.max(58, tableBounds.top - controlBounds.top + 4) });
  };
  const cancelHandleHide = (): void => {
    if (handleHideTimerRef.current !== null) window.clearTimeout(handleHideTimerRef.current);
    handleHideTimerRef.current = null;
  };
  const scheduleHandleHide = (): void => {
    cancelHandleHide();
    handleHideTimerRef.current = window.setTimeout(() => {
      setHoveredTable(null); setHandlePosition((position) => ({ ...position, visible: false }));
    }, 180);
  };
  const selectWholeHoveredTable = (): void => {
    const editor = editorRef.current;
    if (!hoveredTable?.isConnected || !editor?.contains(hoveredTable)) return;
    const model = buildTableModel(hoveredTable);
    const anchor = model.grid[0]?.[0]?.cell;
    const focus = model.grid[model.grid.length - 1]?.[model.width - 1]?.cell;
    if (!anchor || !focus) return;
    anchorRef.current = anchor; focusRef.current = focus; renderSelection(); collapseNativeSelection(focus);
    useUiStore.getState().pushToast(usesAppleDeleteKeyLayout()
      ? (isEnglish() ? "Whole table selected. Delete clears contents; Fn+Delete deletes the table." : "已选中整个表格。Delete 清空内容；Fn+Delete 删除表格。")
      : (isEnglish() ? "Whole table selected. Delete clears contents; Backspace deletes the table." : "已选中整个表格。Delete 清空内容；Backspace 删除表格。"));
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const normalizedValue = richText.sanitizeHtml(value, maxLength);
    // Table-selection classes are transient editor UI state and are intentionally
    // absent from the controlled value. Compare sanitized content so a parent
    // render does not replace the live table DOM (and disconnect its selection
    // anchor) merely because those temporary classes are present.
    if (richText.sanitizeHtml(editor.innerHTML, maxLength) === normalizedValue) return;
    editor.innerHTML = normalizedValue;
    anchorRef.current = null; focusRef.current = null;
  }, [value, maxLength]);
  useEffect(() => {
    if (!autoFocus) return;
    const timer = window.setTimeout(() => editorRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [autoFocus]);
  useEffect(() => {
    if (!palette && !tableMenu) return;
    const close = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(`[data-rich-editor="${id}"]`)) { setPalette(null); closeTableMenus(); }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [palette, tableMenu, id]);
  useEffect(() => () => cancelHandleHide(), []);

  const selectedRegion = allowTables ? region() : null;
  const tableHelp = selectedRegion
    ? (isEnglish() ? `Selected ${selectedRegion.maxRow - selectedRegion.minRow + 1} row(s) × ${selectedRegion.maxColumn - selectedRegion.minColumn + 1} column(s) (${selectedRegion.cells.length} cell(s)).` : `已选择 ${selectedRegion.maxRow - selectedRegion.minRow + 1} 行 × ${selectedRegion.maxColumn - selectedRegion.minColumn + 1} 列（${selectedRegion.cells.length} 个单元格）。`)
    : (isEnglish() ? "Drag across cells, or click one cell and Shift-click another, to select a rectangle." : "拖过单元格，或先点击一个格子再按住 Shift 点击另一个格子，即可选择矩形区域。");

  return (
    <div ref={controlRef} className="rich-text-control" data-rich-editor={id}>
      <div className="rich-text-toolbar" role="toolbar" aria-label="文字格式" onMouseDownCapture={(event) => { if (event.button === 0) rememberSelection(!((event.target as Element).closest?.("[data-table-tool]"))); }}>
        <button type="button" title="加粗" onMouseDown={(event) => event.preventDefault()} onClick={() => command("bold")}><b>B</b></button>
        <button type="button" title="斜体" onMouseDown={(event) => event.preventDefault()} onClick={() => command("italic")}><i>I</i></button>
        <label className="rich-text-font-size"><span className="sr-only">字号</span><select aria-label="字号" defaultValue="" onMouseDown={() => rememberSelection()} onChange={(event) => { const size = event.target.value; if (size) command("fontSize", size); event.target.value = ""; }}><option value="">字号</option>{richText.FONT_SIZE_PRESETS.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
        {(["text", "highlight"] as const).map((mode) => {
          const colors = mode === "text" ? TEXT_COLORS : HIGHLIGHT_COLORS;
          const open = palette === mode;
          return <div className="preset-color-picker" data-color-picker key={mode}>
            <button className="preset-color-trigger" type="button" aria-expanded={open} aria-label={mode === "text" ? "选择字色" : "选择高亮颜色"} onMouseDown={(event) => { event.preventDefault(); rememberSelection(); }} onClick={() => { closeTableMenus(); setPalette(open ? null : mode); }}><span>{mode === "text" ? "字色" : "高亮"}</span><span className="selected-color-swatch" style={{ "--swatch-color": selectedColors[mode] } as React.CSSProperties}></span><span aria-hidden="true">⌄</span></button>
            {!open ? null : <div className="preset-color-popover" role="menu">{colors.map((color) => <button key={color} className={`preset-color-swatch${selectedColors[mode] === color ? " is-selected" : ""}`} type="button" title={color} aria-label={color} role="menuitemradio" aria-checked={selectedColors[mode] === color} style={{ "--swatch-color": color } as React.CSSProperties} onMouseDown={(event) => event.preventDefault()} onClick={() => applyColor(mode, color)}><span></span></button>)}</div>}
          </div>;
        })}
        {allowTables ? <div className="note-table-tool" data-table-tool>
          <button type="button" data-table-tool aria-expanded={tableMenu} onMouseDown={(event) => { event.preventDefault(); rememberSelection(false); }} onClick={() => { setPalette(null); setTableMenu((open) => !open); setTableSubmenu(null); }}>表格 <span aria-hidden="true">⌄</span></button>
          {!tableMenu ? null : <div className="note-table-menu" role="menu">
            <div className="note-table-submenu-row" onMouseEnter={() => setTableSubmenu("create")}>
              <button type="button" role="menuitem" aria-expanded={tableSubmenu === "create"} onClick={() => setTableSubmenu(tableSubmenu === "create" ? null : "create")}>新建表格 <span>›</span></button>
              {tableSubmenu !== "create" ? null : <div className="note-table-submenu note-table-create-submenu"><div className="note-table-size-grid" role="grid">{Array.from({ length: 8 }, (_, row) => Array.from({ length: 10 }, (_unused, column) => ({ rows: row + 1, columns: column + 1 }))).flat().map((size) => <button key={`${size.rows}-${size.columns}`} className={`note-table-size-cell${size.rows <= tableSize.rows && size.columns <= tableSize.columns ? " is-preview" : ""}`} type="button" role="gridcell" aria-label={`${size.rows} 行 × ${size.columns} 列`} onMouseEnter={() => setTableSize(size)} onFocus={() => setTableSize(size)} onClick={() => { insertTableHtml(tableHtmlFromDimensions(size.rows, size.columns)); closeTableMenus(); }} />)}</div><strong>{tableSize.rows} × {tableSize.columns}</strong></div>}
            </div>
            <div className="note-table-submenu-row" onMouseEnter={() => setTableSubmenu("edit")}>
              <button type="button" role="menuitem" aria-expanded={tableSubmenu === "edit"} onClick={() => setTableSubmenu(tableSubmenu === "edit" ? null : "edit")}>编辑表格 <span>›</span></button>
              {tableSubmenu !== "edit" ? null : <div className="note-table-submenu note-table-edit-submenu"><p>{tableHelp}</p>{([ ["insert-row", "在下方插入行"], ["insert-column", "在右侧插入列"], ["delete-row", "删除当前行"], ["delete-column", "删除当前列"], ["merge-cells", "合并所选单元格"], ["delete-table", "删除整个表格"] ] as Array<[TableOperation, string]>).map(([operation, label]) => <button key={operation} type="button" disabled={!selectedRegion || (operation === "merge-cells" && selectedRegion.cells.length < 2)} onClick={() => editTable(operation)}>{label}</button>)}</div>}
            </div>
          </div>}
        </div> : null}
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("removeFormat")}>清除格式</button>
      </div>
      {allowTables ? <button className={`note-table-select-handle${wholeTable(selectedRegion) && selectedRegion?.table === hoveredTable ? " is-selected" : ""}`} type="button" hidden={!handlePosition.visible} style={{ left: handlePosition.left, top: handlePosition.top }} aria-label="选择整个表格" title="选择整个表格" onMouseEnter={cancelHandleHide} onMouseLeave={scheduleHandleHide} onMouseDown={(event) => event.preventDefault()} onClick={selectWholeHoveredTable}>↖</button> : null}
      <div ref={editorRef} id={id} className={`rich-text-editor ${className}`.trim()} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" data-user-content="true" data-placeholder={placeholder}
        onInput={emit}
        onMouseDown={(event) => {
          if (!allowTables || event.button !== 0) return;
          const cell = closestCell(event.target, editorRef.current);
          if (!cell) { pointerAnchorRef.current = null; return; }
          cancelHandleHide();
          const table = cell.closest("table");
          if (table instanceof HTMLTableElement) { setHoveredTable(table); refreshHandle(table); }
          pointerAnchorRef.current = cell; dragSelectingRef.current = false;
          if (event.shiftKey && anchorRef.current?.isConnected && anchorRef.current.closest("table") === table) {
            // Preserve the original anchor explicitly through React's complete
            // mousedown → mouseup → click sequence. Browser caret normalization can
            // otherwise make a Shift-click look like a fresh one-cell selection.
            shiftAnchorRef.current = anchorRef.current;
            event.preventDefault(); focusRef.current = cell; renderSelection(); collapseNativeSelection(cell); return;
          }
          shiftAnchorRef.current = null;
          anchorRef.current = cell; focusRef.current = cell; renderSelection();
        }}
        onMouseMove={(event) => {
          if (!allowTables) return;
          const table = event.target instanceof Element ? event.target.closest("table") : null;
          if (table instanceof HTMLTableElement && editorRef.current?.contains(table)) { cancelHandleHide(); if (hoveredTable !== table) setHoveredTable(table); refreshHandle(table); }
          else scheduleHandleHide();
          if (!(event.buttons & 1) || !pointerAnchorRef.current) return;
          const cell = closestCell(event.target, editorRef.current);
          if (!cell || cell === pointerAnchorRef.current || cell.closest("table") !== pointerAnchorRef.current.closest("table")) return;
          event.preventDefault(); dragSelectingRef.current = true; anchorRef.current = pointerAnchorRef.current; focusRef.current = cell; renderSelection();
        }}
        onMouseUp={(event) => {
          if (allowTables && dragSelectingRef.current) { event.preventDefault(); dragSelectingRef.current = false; dragFinishedRef.current = true; collapseNativeSelection(focusRef.current); window.setTimeout(() => { dragFinishedRef.current = false; }, 0); }
          else if (allowTables && event.shiftKey && (region()?.cells.length || 0) > 1) {
            // The Shift-click rectangle is established during mousedown. Reading the
            // native caret again here would collapse the logical table selection to
            // the focus cell before click fires.
            event.preventDefault();
            collapseNativeSelection(focusRef.current);
          } else rememberSelection();
        }}
        onClick={(event) => {
          if (!allowTables || dragFinishedRef.current) return;
          const cell = closestCell(event.target, editorRef.current);
          if (!cell) return clearSelection();
          const shiftAnchor = event.shiftKey && shiftAnchorRef.current?.isConnected && shiftAnchorRef.current.closest("table") === cell.closest("table")
            ? shiftAnchorRef.current
            : null;
          anchorRef.current = shiftAnchor || cell;
          focusRef.current = cell; renderSelection();
          if (event.shiftKey && (region()?.cells.length || 0) > 1) collapseNativeSelection(cell);
          shiftAnchorRef.current = null;
        }}
        onKeyUp={(event) => {
          // Releasing Shift after a Shift-click produces a native keyup after the
          // logical rectangle has been established. Syncing from the collapsed
          // caret at that moment would shrink the rectangle back to one cell.
          if (allowTables && event.key === "Shift" && (region()?.cells.length || 0) > 1) {
            collapseNativeSelection(focusRef.current);
            return;
          }
          rememberSelection();
        }}
        onKeyDown={(event) => {
          if (!allowTables || event.defaultPrevented || event.nativeEvent.isComposing) return;
          const key = event.key.toLocaleLowerCase();
          const shortcut = (event.metaKey || event.ctrlKey) && !event.altKey;
          if (shortcut && key === "z") {
            const handled = event.shiftKey ? redoTableOperation() : undoTableOperation();
            if (handled) { event.preventDefault(); event.stopPropagation(); }
            return;
          }
          if (shortcut && !event.shiftKey && key === "y") {
            if (redoTableOperation()) { event.preventDefault(); event.stopPropagation(); }
            return;
          }
          if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !wholeTable(region())) return;
          const operation: TableOperation | null = usesAppleDeleteKeyLayout() ? (event.key === "Backspace" ? "clear-table" : event.key === "Delete" ? "delete-table" : null) : (event.key === "Delete" ? "clear-table" : event.key === "Backspace" ? "delete-table" : null);
          if (operation) { event.preventDefault(); event.stopPropagation(); editTable(operation); }
        }}
        onCopy={(event) => {
          if (!allowTables || !event.clipboardData) return;
          const selected = region();
          if (!selected || (selected.cells.length < 2 && !wholeTable(selected))) return;
          const html = richText.sanitizeHtml(cloneSelectedRegion(selected).outerHTML, richText.MAX_NOTE_TEXT);
          event.preventDefault(); event.clipboardData.setData("text/html", html); event.clipboardData.setData("text/plain", richText.plainText(html));
        }}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain").slice(0, maxLength);
          const tableHtml = allowTables ? richText.tableHtmlFromClipboard(event.clipboardData.getData("text/html")) || tableHtmlFromTabText(text) : "";
          if (tableHtml) insertTableHtml(`${tableHtml}<p><br></p>`);
          else { restoreSelection(); richText.insertHtmlAtSelection(richText.fromPlainText(text), editorRef.current); emit(); }
        }}
      />
    </div>
  );
}
