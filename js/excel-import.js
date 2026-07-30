/* Excel 批量导入：读取模板、规范字段并生成可安全写入的 Task 行。 */
(function (root, factory) {
  var xlsx =
    root.XLSX ||
    (typeof require === "function" ? require("../vendor/xlsx.full.min.js") : null);
  var api = factory(xlsx);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.App = root.App || {};
  root.App.excelImport = api;
})(typeof self !== "undefined" ? self : globalThis, function (XLSX) {
  "use strict";

  var SHEET_NAME = "Task导入";
  var MAX_ROWS = 1000;
  var COLUMNS = [
    ["groupName", "分组*", true],
    ["groupColor", "分组颜色", false],
    ["flowName", "Flow", false],
    ["flowColor", "Flow颜色", false],
    ["flowOrder", "Flow步骤", false],
    ["taskName", "Task name*", true],
    ["ddl", "DDL*", true],
    ["urgency", "紧急程度*", true],
    ["status", "完成状态", false],
    ["completedAt", "完成日期", false],
    ["reportTo", "汇报对象*", true],
    ["managedObject", "管理对象", false],
    ["deliverable", "交付物*", true],
    ["progressNote", "进度记录", false],
    ["documentLinks", "说明文档链接", false],
    ["deliverableLinks", "交付物链接", false]
  ];

  function cleanText(value, maxLength) {
    return String(value === null || value === undefined ? "" : value)
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, maxLength || 500);
  }

  function cleanMultiline(value, maxLength) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/\r\n/g, "\n")
      .trim()
      .slice(0, maxLength || 4000);
  }

  function normalizeHeader(value) {
    return cleanText(value, 100)
      .replace(/[＊*]/g, "")
      .replace(/[（(]可选[）)]/g, "")
      .replace(/\s+/g, "")
      .toLocaleLowerCase();
  }

  function headerAliases() {
    var aliases = {};
    COLUMNS.forEach(function (column) {
      aliases[normalizeHeader(column[1])] = column[0];
    });
    [
      ["分组名称", "groupName"],
      ["group", "groupName"],
      ["flow名称", "flowName"],
      ["步骤", "flowOrder"],
      ["步骤序号", "flowOrder"],
      ["task", "taskName"],
      ["任务名称", "taskName"],
      ["截止日期", "ddl"],
      ["状态", "status"],
      ["进度", "progressNote"],
      ["说明文档", "documentLinks"],
      ["交付物链接地址", "deliverableLinks"]
    ].forEach(function (alias) {
      aliases[normalizeHeader(alias[0])] = alias[1];
    });
    return aliases;
  }

  function twoDigits(value) {
    return String(value).padStart(2, "0");
  }

  function validDateParts(year, month, day) {
    var date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  function dateFromParts(year, month, day) {
    return validDateParts(year, month, day)
      ? year + "-" + twoDigits(month) + "-" + twoDigits(day)
      : "";
  }

  function parseDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return dateFromParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
    }
    if (typeof value === "number" && Number.isFinite(value) && XLSX && XLSX.SSF) {
      var parsedCode = XLSX.SSF.parse_date_code(value);
      return parsedCode ? dateFromParts(parsedCode.y, parsedCode.m, parsedCode.d) : "";
    }
    var text = cleanText(value, 40);
    if (!text) return "";
    if (/^\d+(\.\d+)?$/.test(text) && XLSX && XLSX.SSF) {
      var numericCode = XLSX.SSF.parse_date_code(Number(text));
      return numericCode ? dateFromParts(numericCode.y, numericCode.m, numericCode.d) : "";
    }
    var match = text
      .replace(/[年/.]/g, "-")
      .replace(/月/g, "-")
      .replace(/日/g, "")
      .match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    return match
      ? dateFromParts(Number(match[1]), Number(match[2]), Number(match[3]))
      : "";
  }

  function parseColor(value) {
    var color = cleanText(value, 20).toUpperCase();
    return !color ? "" : /^#[0-9A-F]{6}$/.test(color) ? color : null;
  }

  function parseUrgency(value) {
    var text = cleanText(value, 30).toLocaleLowerCase();
    if (!text) return null;
    if (text === "中" || text === "medium") return "medium";
    if (text === "高" || text === "high" || text === "紧急") return "high";
    if (text === "低" || text === "low") return "low";
    return null;
  }

  function parseStatus(value) {
    var text = cleanText(value, 30).toLocaleLowerCase();
    if (!text || text === "未完成" || text === "pending") return "pending";
    if (text === "已完成" || text === "完成" || text === "completed") return "completed";
    return null;
  }

  function parseFlowOrder(value) {
    var text = cleanText(value, 30);
    if (!text) return null;
    var number = Number(text);
    return Number.isInteger(number) && number >= 1 ? number : undefined;
  }

  function parseLinks(value, label) {
    var text = cleanMultiline(value, 12000);
    if (!text) return { links: [], errors: [] };
    var errors = [];
    var links = [];
    text
      .split(/\n|；/)
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean)
      .forEach(function (part, index) {
        var separator = part.indexOf("|");
        var title = separator >= 0 ? cleanText(part.slice(0, separator), 160) : "";
        var url = cleanText(separator >= 0 ? part.slice(separator + 1) : part, 3000);
        try {
          var parsed = new URL(url);
          if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("protocol");
          links.push({
            title: title || label + " " + (index + 1),
            url: parsed.href
          });
        } catch (_error) {
          errors.push(label + "第 " + (index + 1) + " 个链接不是有效的 HTTP/HTTPS 地址");
        }
      });
    return { links: links, errors: errors };
  }

  function findHeaderRow(matrix) {
    var aliases = headerAliases();
    var required = new Set(["groupName", "taskName", "ddl"]);
    for (var rowIndex = 0; rowIndex < Math.min(matrix.length, 12); rowIndex += 1) {
      var found = new Set();
      matrix[rowIndex].forEach(function (cell) {
        var key = aliases[normalizeHeader(cell)];
        if (key) found.add(key);
      });
      var complete = Array.from(required).every(function (key) {
        return found.has(key);
      });
      if (complete) return rowIndex;
    }
    return -1;
  }

  function normalizeRow(raw, sourceRow) {
    var errors = [];
    var groupName = cleanText(raw.groupName, 80);
    var flowName = cleanText(raw.flowName, 80);
    var taskName = cleanText(raw.taskName, 160);
    var ddl = parseDate(raw.ddl);
    var groupColor = parseColor(raw.groupColor);
    var flowColor = parseColor(raw.flowColor);
    var flowOrder = parseFlowOrder(raw.flowOrder);
    var urgency = parseUrgency(raw.urgency);
    var status = parseStatus(raw.status);
    var completedAt = parseDate(raw.completedAt);
    var reportTo = cleanText(raw.reportTo, 120);
    var deliverable = cleanMultiline(raw.deliverable, 500);
    var documents = parseLinks(raw.documentLinks, "说明文档");
    var deliverables = parseLinks(raw.deliverableLinks, "交付物");

    if (!groupName) errors.push("分组不能为空");
    if (!taskName) errors.push("Task name 不能为空");
    if (!ddl) errors.push("DDL 必须是有效日期");
    if (groupColor === null) errors.push("分组颜色必须是 #RRGGBB");
    if (flowColor === null) errors.push("Flow颜色必须是 #RRGGBB");
    if (flowOrder === undefined) errors.push("Flow步骤必须是大于 0 的整数");
    if (flowOrder && !flowName) errors.push("填写 Flow步骤 时必须同时填写 Flow");
    if (!cleanText(raw.urgency, 30)) errors.push("紧急程度不能为空");
    else if (!urgency) errors.push("紧急程度仅支持高、中、低");
    if (!reportTo) errors.push("汇报对象不能为空");
    if (!deliverable) errors.push("交付物不能为空");
    if (!status) errors.push("完成状态仅支持未完成、已完成");
    if (cleanText(raw.completedAt, 40) && !completedAt) {
      errors.push("完成日期必须是有效日期");
    }
    errors = errors.concat(documents.errors, deliverables.errors);

    return {
      sourceRow: sourceRow,
      errors: errors,
      value: {
        groupName: groupName,
        groupColor: groupColor || "",
        flowName: flowName,
        flowColor: flowColor || "",
        flowOrder: flowOrder || null,
        taskName: taskName,
        ddl: ddl,
        urgency: urgency || "",
        status: status || "pending",
        completedAt: status === "completed" ? completedAt : "",
        reportTo: reportTo,
        managedObject: cleanText(raw.managedObject, 160),
        deliverable: deliverable,
        progressNote: cleanMultiline(raw.progressNote, 4000),
        documentLinks: documents.links,
        deliverableLinks: deliverables.links
      }
    };
  }

  function sheetToMatrix(sheet) {
    var reference = sheet && sheet["!ref"];
    if (!reference) return [];
    var range = XLSX.utils.decode_range(reference);
    var lastRow = Math.min(range.e.r, MAX_ROWS + 20);
    var lastColumn = Math.min(range.e.c, 63);
    var matrix = [];
    for (var rowIndex = 0; rowIndex <= lastRow; rowIndex += 1) {
      var row = [];
      for (var columnIndex = 0; columnIndex <= lastColumn; columnIndex += 1) {
        var address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        var cell = sheet[address];
        row.push(cell && cell.v !== undefined && cell.v !== null ? cell.v : "");
      }
      matrix.push(row);
    }
    return matrix;
  }

  function parseWorkbook(arrayBuffer) {
    if (!XLSX) {
      return { rows: [], errors: ["Excel 解析组件未加载。"], sheetName: "" };
    }
    try {
      var workbook = XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: false,
        cellNF: true
      });
      var sheetName = workbook.Sheets[SHEET_NAME]
        ? SHEET_NAME
        : workbook.SheetNames[0];
      if (!sheetName) return { rows: [], errors: ["Excel 中没有工作表。"], sheetName: "" };
      var matrix = sheetToMatrix(workbook.Sheets[sheetName]);
      var headerRowIndex = findHeaderRow(matrix);
      if (headerRowIndex < 0) {
        return {
          rows: [],
          errors: ["未找到模板表头，请使用下载的 Weekflow Task 导入模板。"],
          sheetName: sheetName
        };
      }
      var aliases = headerAliases();
      var columnIndexes = {};
      matrix[headerRowIndex].forEach(function (header, index) {
        var key = aliases[normalizeHeader(header)];
        if (key && columnIndexes[key] === undefined) columnIndexes[key] = index;
      });
      var sourceRows = matrix
        .slice(headerRowIndex + 1)
        .map(function (row, index) {
          return {
            row: row,
            sourceRow: headerRowIndex + index + 2
          };
        })
        .filter(function (item) {
          return item.row.some(function (cell) {
            return cleanText(cell, 20) !== "";
          });
        });
      if (sourceRows.length > MAX_ROWS) {
        return {
          rows: [],
          errors: ["单次最多导入 " + MAX_ROWS + " 条 Task，请拆分文件。"],
          sheetName: sheetName
        };
      }
      var normalizedRows = sourceRows.map(function (item) {
        var raw = {};
        COLUMNS.forEach(function (column) {
          var columnIndex = columnIndexes[column[0]];
          raw[column[0]] = columnIndex === undefined ? "" : item.row[columnIndex];
        });
        return normalizeRow(raw, item.sourceRow);
      });
      var errors = [];
      normalizedRows.forEach(function (row) {
        row.errors.forEach(function (message) {
          errors.push("第 " + row.sourceRow + " 行：" + message);
        });
      });
      return {
        rows: normalizedRows.map(function (row) {
          return row.value;
        }),
        errors: errors,
        sheetName: sheetName
      };
    } catch (error) {
      return {
        rows: [],
        errors: ["无法读取 Excel：" + error.message],
        sheetName: ""
      };
    }
  }

  return {
    SHEET_NAME: SHEET_NAME,
    MAX_ROWS: MAX_ROWS,
    COLUMNS: COLUMNS.map(function (column) {
      return { key: column[0], header: column[1], required: column[2] };
    }),
    parseDate: parseDate,
    parseLinks: parseLinks,
    parseWorkbook: parseWorkbook
  };
});
