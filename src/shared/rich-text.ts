/** 安全富文本、进度历史与纯文本转换工具。 */
import type { ProgressEntry, Task } from "./types";

export const MAX_NOTE_TEXT = 20_000;
export const MAX_PROGRESS_TEXT = 12_000;
export const MAX_HTML = 80_000;

const BLOCK_TAGS = new Set(["P", "DIV", "LI", "UL", "OL"]);
const ALLOWED_TAGS = new Set([
  "P", "DIV", "BR", "STRONG", "B", "EM", "I", "U", "S", "SPAN", "FONT", "A", "UL", "OL", "LI"
]);

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeColor(value: unknown): string {
  const color = String(value || "").trim();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return ("#" + color.slice(1).split("").map((part) => part + part).join("")).toUpperCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toUpperCase();
  const rgb = color.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (!rgb) return "";
  const values = rgb.slice(1, 4).map(Number);
  if (values.some((part) => part < 0 || part > 255)) return "";
  return "#" + values.map((part) => part.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function validHttpUrl(value: unknown): boolean {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function safeStyle(value: unknown): string {
  const styles: string[] = [];
  String(value || "").split(";").forEach((declaration) => {
    const separator = declaration.indexOf(":");
    if (separator < 0) return;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const raw = declaration.slice(separator + 1).trim();
    if (property !== "color" && property !== "background-color") return;
    const color = normalizeColor(raw);
    if (color) styles.push(`${property}: ${color}`);
  });
  return styles.join("; ");
}

function plainTextFromNode(node: ParentNode): string {
  const output: string[] = [];
  function visit(current: Node): void {
    if (current.nodeType === Node.TEXT_NODE) {
      output.push(current.nodeValue || "");
      return;
    }
    if (current.nodeType !== Node.ELEMENT_NODE) return;
    const element = current as Element;
    if (element.tagName === "BR") {
      output.push("\n");
      return;
    }
    const block = BLOCK_TAGS.has(element.tagName);
    if (block && output.length && output[output.length - 1] !== "\n") output.push("\n");
    Array.from(current.childNodes).forEach(visit);
    if (block && output[output.length - 1] !== "\n") output.push("\n");
  }
  Array.from(node.childNodes).forEach(visit);
  return output.join("")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function plainText(html: unknown): string {
  const source = String(html || "");
  if (!source) return "";
  if (typeof document !== "undefined" && document.createElement) {
    const template = document.createElement("template");
    template.innerHTML = source;
    return plainTextFromNode(template.content);
  }
  return source
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizePlainText(value: unknown, maxLength = MAX_NOTE_TEXT): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function sanitizeWithDom(html: unknown): string {
  const template = document.createElement("template");
  template.innerHTML = String(html || "").slice(0, MAX_HTML * 2);
  const originalHrefs = new WeakMap<Element, string>();
  template.content.querySelectorAll("a").forEach((link) => originalHrefs.set(link, link.getAttribute("href") || ""));

  function clean(parent: ParentNode): void {
    Array.from(parent.childNodes).forEach((node) => {
      if (node.nodeType === Node.COMMENT_NODE) {
        node.parentNode?.removeChild(node);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node as Element;
      if (!ALLOWED_TAGS.has(element.tagName)) {
        if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH"].includes(element.tagName)) {
          element.remove();
          return;
        }
        const fragment = document.createDocumentFragment();
        while (element.firstChild) fragment.appendChild(element.firstChild);
        element.replaceWith(fragment);
        clean(parent);
        return;
      }
      let style = safeStyle(element.getAttribute("style"));
      const fontColor = element.tagName === "FONT" ? normalizeColor(element.getAttribute("color")) : "";
      Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));
      if (element.tagName === "A") {
        let href = originalHrefs.get(element) || "";
        if (!href && element.textContent && validHttpUrl(element.textContent.trim())) href = element.textContent.trim();
        if (validHttpUrl(href)) {
          element.setAttribute("href", href);
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noopener noreferrer");
        }
      }
      if (fontColor) style = `color: ${fontColor}${style ? `; ${style}` : ""}`;
      if (style) element.setAttribute("style", style);
      clean(element);
    });
  }
  clean(template.content);
  return template.innerHTML.slice(0, MAX_HTML);
}

function sanitizeFallback(html: unknown): string {
  const source = String(html || "")
    .slice(0, MAX_HTML * 2)
    .replace(/<\s*(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const allowed = new Set(Array.from(ALLOWED_TAGS, (tag) => tag.toLocaleLowerCase()));
  return source
    .replace(/<([a-z][\w-]*)([^>]*)>/gi, (_match, rawTag: string, rawAttributes: string) => {
      const tag = rawTag.toLocaleLowerCase();
      if (!allowed.has(tag)) return "";
      const styleMatch = rawAttributes.match(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      let style = safeStyle(styleMatch?.[1] || styleMatch?.[2] || styleMatch?.[3] || "");
      if (tag === "font") {
        const colorMatch = rawAttributes.match(/\scolor\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        const color = normalizeColor(colorMatch?.[1] || colorMatch?.[2] || colorMatch?.[3] || "");
        if (color) style = `color: ${color}${style ? `; ${style}` : ""}`;
      }
      const attributes: string[] = [];
      if (tag === "a") {
        const hrefMatch = rawAttributes.match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        const href = hrefMatch?.[1] || hrefMatch?.[2] || hrefMatch?.[3] || "";
        if (validHttpUrl(href)) {
          attributes.push(`href="${escapeHtml(href)}"`, 'target="_blank"', 'rel="noopener noreferrer"');
        }
      }
      if (style) attributes.push(`style="${escapeHtml(style)}"`);
      return `<${tag}${attributes.length ? ` ${attributes.join(" ")}` : ""}>`;
    })
    .replace(/<\/([a-z][\w-]*)\s*>/gi, (_match, rawTag: string) => {
      const tag = rawTag.toLocaleLowerCase();
      return allowed.has(tag) && tag !== "br" ? `</${tag}>` : "";
    })
    .slice(0, MAX_HTML);
}

export function sanitizeHtml(html: unknown, maxTextLength = MAX_NOTE_TEXT): string {
  const cleaned = typeof document !== "undefined"
    ? sanitizeWithDom(html)
    : sanitizeFallback(html);
  const text = plainText(cleaned);
  return text.length <= maxTextLength ? cleaned : fromPlainText(text.slice(0, maxTextLength));
}

function linkifyEscapedText(text: string): string {
  return escapeHtml(text).replace(/https?:\/\/[^\s<]+/gi, (matched) => {
    let url = matched;
    let trailing = "";
    while (/[),.;!?，。；！？）]$/.test(url)) {
      trailing = url.slice(-1) + trailing;
      url = url.slice(0, -1);
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`;
  });
}

export function fromPlainText(value: unknown): string {
  const text = String(value || "").replace(/\r\n/g, "\n");
  if (!text.trim()) return "";
  return text.split(/\n{2,}/).map((paragraph) => `<p>${linkifyEscapedText(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
}

export function insertHtmlAtSelection(html: string, container?: HTMLElement | null): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  const selection = window.getSelection?.();
  if (!selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (container && !container.contains(range.commonAncestorContainer)) return false;
  range.deleteContents();
  const template = document.createElement("template");
  template.innerHTML = sanitizeHtml(html, MAX_NOTE_TEXT);
  const fragment = template.content;
  const last = fragment.lastChild;
  range.insertNode(fragment);
  if (last) {
    range.setStartAfter(last);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  return true;
}

export function timestampLabel(value: unknown): string {
  const parsed = new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) return "";
  const two = (number: number) => String(number).padStart(2, "0");
  return `${parsed.getFullYear()}-${two(parsed.getMonth() + 1)}-${two(parsed.getDate())} ${two(parsed.getHours())}:${two(parsed.getMinutes())}`;
}

export function sortProgressEntries(entries: readonly ProgressEntry[] | null | undefined): ProgressEntry[] {
  return (Array.isArray(entries) ? entries : []).slice().sort((left, right) =>
    new Date(right.updatedAt || right.createdAt || 0).getTime() -
    new Date(left.updatedAt || left.createdAt || 0).getTime()
  );
}

export function latestProgressEntry(taskOrEntries: Pick<Task, "progressEntries"> | readonly ProgressEntry[] | null | undefined): ProgressEntry | null {
  const entries = Array.isArray(taskOrEntries)
    ? (taskOrEntries as readonly ProgressEntry[])
    : (taskOrEntries as Pick<Task, "progressEntries"> | null | undefined)?.progressEntries;
  return sortProgressEntries(entries)[0] || null;
}

export function progressSearchText(task: Pick<Task, "progressEntries">): string {
  return sortProgressEntries(task.progressEntries).map((entry) => entry.contentText || plainText(entry.contentHtml)).join("\n");
}

export function progressCellText(
  task: Pick<Task, "progressEntries" | "progressNote" | "progressUpdatedAt" | "updatedAt" | "createdAt">,
  maxLength = 32_767,
  overflowMarker = "\n… Complete history is available in the Progress History worksheet."
): string {
  let entries: Array<Pick<ProgressEntry, "contentText" | "contentHtml" | "updatedAt" | "createdAt">> = sortProgressEntries(task.progressEntries);
  if (!entries.length && task.progressNote) {
    entries = [{ contentText: task.progressNote, contentHtml: "", updatedAt: task.progressUpdatedAt || task.updatedAt || task.createdAt, createdAt: task.createdAt }];
  }
  const output = entries.map((entry) => {
    const text = String(entry.contentText || plainText(entry.contentHtml)).replace(/\r\n/g, "\n").trim();
    return `[${timestampLabel(entry.updatedAt || entry.createdAt)}] ${text}`;
  }).join("\n");
  return output.length <= maxLength
    ? output
    : output.slice(0, Math.max(0, maxLength - overflowMarker.length)) + overflowMarker;
}
