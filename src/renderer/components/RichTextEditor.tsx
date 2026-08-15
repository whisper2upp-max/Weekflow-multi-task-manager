import { useEffect, useRef, useState } from "react";
import * as richText from "../../shared/rich-text";

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

interface RichTextEditorProps {
  id: string;
  value: string;
  onChange(value: { html: string; text: string }): void;
  maxLength: number;
  placeholder: string;
  className?: string;
  autoFocus?: boolean;
}

type Palette = "text" | "highlight" | null;

function selectionRangeInsideEditor(
  editor: HTMLElement | null,
  selection: Selection | null
): Range | null {
  if (!editor || !selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) return range.cloneRange();
  try {
    if (!range.intersectsNode(editor)) return null;
  } catch {
    return null;
  }
  const clipped = range.cloneRange();
  if (!editor.contains(clipped.startContainer)) clipped.setStart(editor, 0);
  if (!editor.contains(clipped.endContainer)) {
    clipped.setEnd(editor, editor.childNodes.length);
  }
  return clipped;
}

export default function RichTextEditor({
  id,
  value,
  onChange,
  maxLength,
  placeholder,
  className = "",
  autoFocus = false
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [palette, setPalette] = useState<Palette>(null);
  const [selectedColors, setSelectedColors] = useState({
    text: TEXT_COLORS[0],
    highlight: HIGHLIGHT_COLORS[0]
  });

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.innerHTML === value) return;
    editor.innerHTML = richText.sanitizeHtml(value, maxLength);
  }, [value, maxLength]);

  useEffect(() => {
    if (!autoFocus) return;
    const timer = window.setTimeout(() => editorRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [autoFocus]);

  useEffect(() => {
    if (!palette) return;
    const close = (event: MouseEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest(`[data-rich-editor="${id}"]`)
      ) {
        setPalette(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [palette, id]);

  const emit = (): void => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = richText.sanitizeHtml(editor.innerHTML, maxLength);
    if (html !== editor.innerHTML) editor.innerHTML = html;
    onChange({ html, text: richText.plainText(html).slice(0, maxLength) });
  };

  const rememberSelection = (): void => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const range = selectionRangeInsideEditor(editor, selection);
    if (range) savedRangeRef.current = range;
  };

  const restoreSelection = (): void => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (selection && savedRangeRef.current) {
      try {
        selection.removeAllRanges();
        selection.addRange(savedRangeRef.current);
      } catch {
        /* 编辑区内容变化后使用浏览器当前的默认光标位置。 */
      }
    }
  };

  const command = (name: string, commandValue?: string): void => {
    restoreSelection();
    try {
      const applied = document.execCommand(name, false, commandValue);
      if (!applied && name === "hiliteColor") {
        document.execCommand("backColor", false, commandValue || HIGHLIGHT_COLORS[0]);
      }
    } catch {
      /* 不支持该命令时保留编辑内容，不让工具栏操作打断输入。 */
    }
    rememberSelection();
    emit();
  };

  const applyColor = (mode: Exclude<Palette, null>, color: string): void => {
    command(mode === "text" ? "foreColor" : "hiliteColor", color);
    setSelectedColors((current) => ({ ...current, [mode]: color }));
    setPalette(null);
  };

  return (
    <div className="rich-text-control" data-rich-editor={id}>
      <div
        className="rich-text-toolbar"
        role="toolbar"
        aria-label="文字格式"
        onMouseDownCapture={(event) => {
          if (event.button === 0) rememberSelection();
        }}
      >
        <button type="button" title="加粗" onMouseDown={(event) => event.preventDefault()} onClick={() => command("bold")}><b>B</b></button>
        <button type="button" title="斜体" onMouseDown={(event) => event.preventDefault()} onClick={() => command("italic")}><i>I</i></button>
        {(["text", "highlight"] as const).map((mode) => {
          const colors = mode === "text" ? TEXT_COLORS : HIGHLIGHT_COLORS;
          const open = palette === mode;
          return (
            <div className="preset-color-picker" data-color-picker key={mode}>
              <button
                className="preset-color-trigger"
                type="button"
                aria-expanded={open}
                aria-label={mode === "text" ? "选择字色" : "选择高亮颜色"}
                onMouseDown={(event) => {
                  event.preventDefault();
                  rememberSelection();
                }}
                onClick={() => setPalette(open ? null : mode)}
              >
                <span>{mode === "text" ? "字色" : "高亮"}</span>
                <span className="selected-color-swatch" style={{ "--swatch-color": selectedColors[mode] } as React.CSSProperties}></span>
                <span aria-hidden="true">⌄</span>
              </button>
              {!open ? null : (
                <div className="preset-color-popover" role="menu">
                  {colors.map((color) => (
                    <button
                      key={color}
                      className={"preset-color-swatch" + (selectedColors[mode] === color ? " is-selected" : "")}
                      type="button"
                      title={color}
                      aria-label={color}
                      role="menuitemradio"
                      aria-checked={selectedColors[mode] === color}
                      style={{ "--swatch-color": color } as React.CSSProperties}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyColor(mode, color)}
                    ><span></span></button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("removeFormat")}>清除格式</button>
      </div>
      <div
        ref={editorRef}
        id={id}
        className={`rich-text-editor ${className}`.trim()}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-user-content="true"
        data-placeholder={placeholder}
        onInput={emit}
        onMouseUp={rememberSelection}
        onKeyUp={rememberSelection}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain").slice(0, maxLength);
          restoreSelection();
          richText.insertHtmlAtSelection(richText.fromPlainText(text), editorRef.current);
          emit();
        }}
      />
    </div>
  );
}
