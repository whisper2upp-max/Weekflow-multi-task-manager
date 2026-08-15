/* 安全富文本、进度历史与纯文本转换工具。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.App = root.App || {};
  root.App.richText = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  var MAX_NOTE_TEXT = 20000;
  var MAX_PROGRESS_TEXT = 12000;
  var MAX_HTML = 80000;
  var BLOCK_TAGS = new Set(["P", "DIV", "LI", "UL", "OL"]);
  var ALLOWED_TAGS = new Set([
    "P",
    "DIV",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "S",
    "SPAN",
    "FONT",
    "A",
    "UL",
    "OL",
    "LI"
  ]);

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeColor(value) {
    var color = String(value || "").trim();
    if (/^#[0-9a-f]{3}$/i.test(color)) {
      return (
        "#" +
        color
          .slice(1)
          .split("")
          .map(function (part) {
            return part + part;
          })
          .join("")
      ).toUpperCase();
    }
    if (/^#[0-9a-f]{6}$/i.test(color)) return color.toUpperCase();
    var rgb = color.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
    if (!rgb) return "";
    var values = rgb.slice(1, 4).map(Number);
    if (values.some(function (part) { return part < 0 || part > 255; })) return "";
    return (
      "#" +
      values
        .map(function (part) {
          return part.toString(16).padStart(2, "0");
        })
        .join("")
    ).toUpperCase();
  }

  function validHttpUrl(value) {
    try {
      var parsed = new URL(String(value || "").trim());
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (_error) {
      return false;
    }
  }

  function safeStyle(value) {
    var source = String(value || "");
    var styles = [];
    source.split(";").forEach(function (declaration) {
      var separator = declaration.indexOf(":");
      if (separator < 0) return;
      var property = declaration.slice(0, separator).trim().toLowerCase();
      var raw = declaration.slice(separator + 1).trim();
      if (property !== "color" && property !== "background-color") return;
      var color = normalizeColor(raw);
      if (color) styles.push(property + ": " + color);
    });
    return styles.join("; ");
  }

  function plainTextFromNode(node) {
    var output = [];
    function visit(current) {
      if (current.nodeType === 3) {
        output.push(current.nodeValue || "");
        return;
      }
      if (current.nodeType !== 1) return;
      if (current.tagName === "BR") {
        output.push("\n");
        return;
      }
      var block = BLOCK_TAGS.has(current.tagName);
      if (block && output.length && output[output.length - 1] !== "\n") output.push("\n");
      Array.prototype.forEach.call(current.childNodes, visit);
      if (block && output[output.length - 1] !== "\n") output.push("\n");
    }
    Array.prototype.forEach.call(node.childNodes || [], visit);
    return output
      .join("")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function plainText(html) {
    var source = String(html || "");
    if (!source) return "";
    if (typeof document !== "undefined" && document.createElement) {
      var template = document.createElement("template");
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

  function normalizePlainText(value, maxLength) {
    var limit = Number(maxLength) || MAX_NOTE_TEXT;
    return String(value === null || value === undefined ? "" : value)
      .replace(/\r\n/g, "\n")
      .replace(/\u0000/g, "")
      .trim()
      .slice(0, limit);
  }

  function sanitizeWithDom(html) {
    var template = document.createElement("template");
    template.innerHTML = String(html || "").slice(0, MAX_HTML * 2);
    function clean(parent) {
      Array.prototype.slice.call(parent.childNodes).forEach(function (node) {
        if (node.nodeType === 8) {
          node.remove();
          return;
        }
        if (node.nodeType !== 1) return;
        if (!ALLOWED_TAGS.has(node.tagName)) {
          if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH"].includes(node.tagName)) {
            node.remove();
            return;
          }
          var fragment = document.createDocumentFragment();
          while (node.firstChild) fragment.appendChild(node.firstChild);
          node.replaceWith(fragment);
          clean(parent);
          return;
        }
        var style = safeStyle(node.getAttribute("style"));
        var fontColor = node.tagName === "FONT" ? normalizeColor(node.getAttribute("color")) : "";
        Array.prototype.slice.call(node.attributes).forEach(function (attribute) {
          node.removeAttribute(attribute.name);
        });
        if (node.tagName === "A") {
          var href = node.__weekflowHref || "";
          if (!href && node.textContent && validHttpUrl(node.textContent.trim())) {
            href = node.textContent.trim();
          }
          if (validHttpUrl(href)) {
            node.setAttribute("href", href);
            node.setAttribute("target", "_blank");
            node.setAttribute("rel", "noopener noreferrer");
          }
        }
        if (fontColor) style = "color: " + fontColor + (style ? "; " + style : "");
        if (style) node.setAttribute("style", style);
        clean(node);
      });
    }
    Array.prototype.slice.call(template.content.querySelectorAll("a")).forEach(function (link) {
      link.__weekflowHref = link.getAttribute("href") || "";
    });
    clean(template.content);
    return template.innerHTML.slice(0, MAX_HTML);
  }

  function sanitizeFallback(html) {
    return String(html || "")
      .slice(0, MAX_HTML * 2)
      .replace(/<\s*(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s(?:src|srcdoc)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/javascript\s*:/gi, "")
      .slice(0, MAX_HTML);
  }

  function sanitizeHtml(html, maxTextLength) {
    var limit = Number(maxTextLength) || MAX_NOTE_TEXT;
    var cleaned =
      typeof document !== "undefined" && document.createElement
        ? sanitizeWithDom(html)
        : sanitizeFallback(html);
    var text = plainText(cleaned);
    if (text.length <= limit) return cleaned;
    return fromPlainText(text.slice(0, limit));
  }

  function linkifyEscapedText(text) {
    return escapeHtml(text).replace(
      /https?:\/\/[^\s<]+/gi,
      function (url) {
        var trailing = "";
        while (/[),.;!?，。；！？）]$/.test(url)) {
          trailing = url.slice(-1) + trailing;
          url = url.slice(0, -1);
        }
        return (
          '<a href="' +
          url +
          '" target="_blank" rel="noopener noreferrer">' +
          url +
          "</a>" +
          trailing
        );
      }
    );
  }

  function fromPlainText(value) {
    var text = String(value || "").replace(/\r\n/g, "\n");
    if (!text.trim()) return "";
    return text
      .split(/\n{2,}/)
      .map(function (paragraph) {
        return "<p>" + linkifyEscapedText(paragraph).replace(/\n/g, "<br>") + "</p>";
      })
      .join("");
  }

  function insertHtmlAtSelection(html, container) {
    if (typeof document === "undefined" || typeof window === "undefined") return false;
    var selection = window.getSelection && window.getSelection();
    if (!selection || !selection.rangeCount) return false;
    var range = selection.getRangeAt(0);
    if (container && !container.contains(range.commonAncestorContainer)) return false;
    range.deleteContents();
    var template = document.createElement("template");
    template.innerHTML = sanitizeHtml(html, MAX_NOTE_TEXT);
    var fragment = template.content;
    var last = fragment.lastChild;
    range.insertNode(fragment);
    if (last) {
      range.setStartAfter(last);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return true;
  }

  function timestampLabel(value) {
    var parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    function two(number) {
      return String(number).padStart(2, "0");
    }
    return (
      parsed.getFullYear() +
      "-" +
      two(parsed.getMonth() + 1) +
      "-" +
      two(parsed.getDate()) +
      " " +
      two(parsed.getHours()) +
      ":" +
      two(parsed.getMinutes())
    );
  }

  function sortProgressEntries(entries) {
    return (Array.isArray(entries) ? entries : []).slice().sort(function (left, right) {
      return (
        new Date(right.updatedAt || right.createdAt || 0).getTime() -
        new Date(left.updatedAt || left.createdAt || 0).getTime()
      );
    });
  }

  function latestProgressEntry(taskOrEntries) {
    var entries = Array.isArray(taskOrEntries)
      ? taskOrEntries
      : taskOrEntries && taskOrEntries.progressEntries;
    return sortProgressEntries(entries)[0] || null;
  }

  function progressSearchText(task) {
    return sortProgressEntries(task && task.progressEntries)
      .map(function (entry) {
        return String(entry.contentText || plainText(entry.contentHtml || ""));
      })
      .join("\n");
  }

  function progressCellText(task, maxLength, overflowMarker) {
    var limit = Number(maxLength) || 32767;
    var entries = sortProgressEntries(task && task.progressEntries);
    if (!entries.length && task && task.progressNote) {
      entries = [
        {
          contentText: task.progressNote,
          updatedAt: task.progressUpdatedAt || task.updatedAt || task.createdAt
        }
      ];
    }
    var rows = entries.map(function (entry) {
      var text = String(entry.contentText || plainText(entry.contentHtml || ""))
        .replace(/\r\n/g, "\n")
        .trim();
      return "[" + timestampLabel(entry.updatedAt || entry.createdAt) + "] " + text;
    });
    var output = rows.join("\n");
    if (output.length <= limit) return output;
    var marker =
      overflowMarker ||
      "\n… Complete history is available in the Progress History worksheet.";
    return output.slice(0, Math.max(0, limit - marker.length)) + marker;
  }

  return {
    MAX_NOTE_TEXT: MAX_NOTE_TEXT,
    MAX_PROGRESS_TEXT: MAX_PROGRESS_TEXT,
    MAX_HTML: MAX_HTML,
    escapeHtml: escapeHtml,
    normalizeColor: normalizeColor,
    validHttpUrl: validHttpUrl,
    plainText: plainText,
    normalizePlainText: normalizePlainText,
    sanitizeHtml: sanitizeHtml,
    fromPlainText: fromPlainText,
    insertHtmlAtSelection: insertHtmlAtSelection,
    timestampLabel: timestampLabel,
    sortProgressEntries: sortProgressEntries,
    latestProgressEntry: latestProgressEntry,
    progressSearchText: progressSearchText,
    progressCellText: progressCellText
  };
});
