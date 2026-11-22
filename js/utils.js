/* 通用工具：浏览器挂载到 App.utils，Node 测试使用 module.exports。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.App = root.App || {};
  root.App.utils = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  function personNames(value) {
    var names = new Map();
    String(value || "").split(/[;；]/).forEach(function (item) {
      var name = item.trim().replace(/\s+/g, " ");
      var key = name.toLocaleLowerCase();
      if (name && !names.has(key)) names.set(key, name);
    });
    return Array.from(names.values());
  }

  function personPicker(input, suggestions, english) {
    var picker = el("details", "person-picker");
    var summary = el("summary", "", english ? "Select people" : "选择人员");
    var options = el("div", "person-options");
    picker.append(summary, options);
    function refresh() {
      if (!picker.open) return;
      clear(options);
      var selected = personNames(input.value);
      var keys = selected.map(function (name) { return name.toLocaleLowerCase(); });
      var names = personNames(selected.concat(suggestions()).join("; "));
      if (!names.length) options.textContent = english ? "Enter a name above first." : "可先在上方输入姓名。";
      names.forEach(function (name) {
        var label = el("label");
        var box = el("input");
        box.type = "checkbox";
        box.checked = keys.includes(name.toLocaleLowerCase());
        label.append(box, document.createTextNode(name));
        options.append(label);
        box.addEventListener("change", function () {
          var current = personNames(input.value).filter(function (item) {
            return item.toLocaleLowerCase() !== name.toLocaleLowerCase();
          });
          if (box.checked) current.push(name);
          input.value = current.join("; ");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          var next = Array.from(options.querySelectorAll("label")).find(function (row) {
            return row.textContent === name;
          });
          if (next) next.firstChild.focus();
        });
      });
    }
    picker.addEventListener("toggle", refresh);
    input.addEventListener("input", refresh);
    return picker;
  }

  function uid(prefix) {
    var value;
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      value = crypto.randomUUID();
    } else {
      value = Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
    }
    return (prefix || "id") + "_" + value;
  }

  function isValidUrl(value) {
    if (typeof value !== "string" || !value.trim()) return false;
    try {
      var parsed = new URL(value.trim());
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (_error) {
      return false;
    }
  }

  function safeOpen(url) {
    if (!isValidUrl(url) || typeof window === "undefined") return false;
    var opened = window.open(url.trim(), "_blank", "noopener,noreferrer");
    if (opened) opened.opener = null;
    return Boolean(opened);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function setAttrs(node, attributes) {
    Object.keys(attributes || {}).forEach(function (key) {
      var value = attributes[key];
      if (value === false || value === null || value === undefined) return;
      if (key === "className") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key in node && key !== "style") node[key] = value;
      else node.setAttribute(key, value === true ? "" : String(value));
    });
    return node;
  }

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase()
      .replace(/\s+/g, " ");
  }

  function truncate(value, maxLength) {
    var text = String(value || "");
    return text.length <= maxLength ? text : text.slice(0, Math.max(1, maxLength - 1)) + "…";
  }

  function isHexColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || ""));
  }

  function hexToRgb(hex) {
    if (!isHexColor(hex)) return { r: 83, g: 104, b: 216 };
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  function rgba(hex, alpha) {
    var rgb = hexToRgb(hex);
    return "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + alpha + ")";
  }

  function blendWithWhite(hex, amount) {
    var rgb = hexToRgb(hex);
    var ratio = Math.min(1, Math.max(0, Number(amount)));
    function channel(value) {
      return Math.round(value + (255 - value) * ratio)
        .toString(16)
        .padStart(2, "0");
    }
    return "#" + channel(rgb.r) + channel(rgb.g) + channel(rgb.b);
  }

  function debounce(fn, delay) {
    var timer = null;
    return function () {
      var args = arguments;
      var context = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function sanitizeFilename(value) {
    return String(value || "download")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim();
  }

  return {
    personNames: personNames,
    personPicker: personPicker,
    uid: uid,
    isValidUrl: isValidUrl,
    safeOpen: safeOpen,
    el: el,
    clear: clear,
    setAttrs: setAttrs,
    clone: clone,
    normalizeText: normalizeText,
    truncate: truncate,
    isHexColor: isHexColor,
    rgba: rgba,
    blendWithWhite: blendWithWhite,
    debounce: debounce,
    downloadBlob: downloadBlob,
    sanitizeFilename: sanitizeFilename
  };
});
