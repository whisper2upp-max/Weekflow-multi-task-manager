import { createElement, useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";
import * as richText from "../../shared/rich-text";

const ALLOWED_TAGS = new Set([
  "p", "div", "br", "strong", "b", "em", "i", "u", "s", "span", "font", "a", "ul", "ol", "li"
]);

function styleFrom(element: Element): CSSProperties | undefined {
  const color = richText.normalizeColor((element as HTMLElement).style.color);
  const backgroundColor = richText.normalizeColor((element as HTMLElement).style.backgroundColor);
  return color || backgroundColor ? { color: color || undefined, backgroundColor: backgroundColor || undefined } : undefined;
}

function renderNode(node: Node, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const element = node as Element;
  const tag = element.tagName.toLocaleLowerCase();
  if (!ALLOWED_TAGS.has(tag)) return Array.from(element.childNodes).map((child, index) => renderNode(child, `${key}-${index}`));
  const props: Record<string, unknown> = { key };
  const style = styleFrom(element);
  if (style) props.style = style;
  if (tag === "a") {
    const href = element.getAttribute("href") || "";
    if (richText.validHttpUrl(href)) {
      props.href = href;
      props.target = "_blank";
      props.rel = "noopener noreferrer";
    }
  }
  const children = Array.from(element.childNodes).map((child, index) => renderNode(child, `${key}-${index}`));
  return createElement(tag, props, ...children);
}

export default function RichTextView({ html, className }: { html: string; className?: string }) {
  const content = useMemo(() => {
    if (typeof document === "undefined") return richText.plainText(html);
    const template = document.createElement("template");
    template.innerHTML = richText.sanitizeHtml(html, richText.MAX_NOTE_TEXT);
    return Array.from(template.content.childNodes).map((node, index) => renderNode(node, String(index)));
  }, [html]);
  return <div className={className} data-user-content="true">{content}</div>;
}
