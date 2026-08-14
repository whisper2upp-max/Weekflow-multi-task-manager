/* Excel 批量导入：读取模板、规范字段并生成可安全写入的 Task 行。 */
(function (root, factory) {
  var xlsx =
    root.XLSX ||
    (typeof require === "function" ? require("../vendor/xlsx.full.min.js") : null);
  var dates =
    root.App && root.App.dateUtils
      ? root.App.dateUtils
      : typeof require === "function"
        ? require("./date-utils.js")
        : null;
  var xlsxSafe =
    root.App && root.App.xlsxSafe
      ? root.App.xlsxSafe
      : typeof require === "function"
        ? require("./xlsx-safe.js")
        : null;
  var i18n =
    root.App && root.App.i18n
      ? root.App.i18n
      : typeof require === "function"
        ? require("./i18n.js")
        : null;
  var api = factory(xlsx, dates, xlsxSafe, i18n);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.App = root.App || {};
  root.App.excelImport = api;
})(typeof self !== "undefined" ? self : globalThis, function (XLSX, dates, xlsxSafe, i18n) {
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
    ["recurrenceCadence", "周期", false],
    ["recurrenceStart", "周期开始", false],
    ["recurrenceEnd", "周期结束", false],
    ["recurrenceCompletions", "周期完成记录", false],
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
  var COLUMN_WIDTHS = [18, 14, 20, 14, 11, 30, 14, 12, 14, 14, 32, 13, 13, 14, 18, 20, 26, 34, 38, 38];
  var urgencyLabels = { high: "高", medium: "中", low: "低" };
  var recurrenceLabels = { none: "不重复", weekly: "每周", monthly: "每月" };
  var GUIDE_ROWS = [
    ["分组*", "是", "补充导入会复用同名分组；完整覆盖会按文件重建分组范围", "产品与项目"],
    ["分组颜色", "否", "格式为 #RRGGBB；留空时沿用匹配分组颜色或自动分配", "#665CFF"],
    ["Flow", "否", "同一分组内按名称匹配；留空表示普通 Task", "版本发布流程"],
    ["Flow颜色", "否", "格式为 #RRGGBB；新 Flow 留空时继承分组颜色", "#665CFF"],
    ["Flow步骤", "否", "Task 在 Flow 中的步骤序号，填写大于 0 的整数", "1"],
    ["Task name*", "是", "Task 名称，最多 160 个字符", "完成发布前检查"],
    ["DDL*", "是", "截止日期，建议使用 yyyy-mm-dd", "2026-08-07"],
    ["周期", "否", "不重复、每周或每月；留空按不重复", "每周"],
    ["周期开始", "周期时是", "周期 Task 的开始日期，须与周期结束同时填写", "2026-08-01"],
    ["周期结束", "周期时是", "周期 Task 的结束日期；DDL 必须位于起止范围内", "2026-09-30"],
    ["周期完成记录", "否", "格式：周期DDL|完成日期；多期用换行或中文分号分隔。新建时可留空，当前数据下载会自动填写", "2026-08-07|2026-08-08"],
    ["紧急程度*", "是", "仅支持高、中、低", "高"],
    ["完成状态", "否", "未完成或已完成；留空默认为未完成", "未完成"],
    ["完成日期", "否", "仅已完成 Task 使用；建议使用 yyyy-mm-dd", "2026-08-06"],
    ["汇报对象*", "是", "填写人员姓名；会与既有同名人员统一，便于筛选", "Wesley Yan"],
    ["管理对象", "否", "填写人员姓名；会与既有同名人员统一，便于筛选", "Amy Chen"],
    ["交付物*", "是", "简要描述交付成果，最多 500 个字符", "发布确认单"],
    ["进度记录", "否", "可填写当前进度或备注，最多 4000 个字符", "已完成联调"],
    ["说明文档链接", "否", "格式：标题|https://...；多个链接用换行或中文分号分隔", "操作说明|https://example.com/guide"],
    ["交付物链接", "否", "格式：标题|https://...；多个链接用换行或中文分号分隔", "交付文件|https://example.com/delivery"]
  ];

  var EN_COLUMNS = [
    ["groupName", "Group*", true], ["groupColor", "Group Color", false], ["flowName", "Flow", false],
    ["flowColor", "Flow Color", false], ["flowOrder", "Flow Step", false], ["taskName", "Task Name*", true],
    ["ddl", "DDL*", true], ["recurrenceCadence", "Recurrence", false], ["recurrenceStart", "Recurrence Start", false],
    ["recurrenceEnd", "Recurrence End", false], ["recurrenceCompletions", "Recurrence Completion History", false],
    ["urgency", "Urgency*", true], ["status", "Completion Status", false], ["completedAt", "Completion Date", false],
    ["reportTo", "Report To*", true], ["managedObject", "Managed Person", false], ["deliverable", "Deliverable*", true],
    ["progressNote", "Progress Note", false], ["documentLinks", "Documentation Links", false], ["deliverableLinks", "Deliverable Links", false]
  ];

  var EN_GUIDE_ROWS = [
    ["Group*", "Yes", "Supplement import reuses a Group with the same name; complete replacement rebuilds Groups from the file", "Products and Projects"],
    ["Group Color", "No", "Use #RRGGBB; blank reuses a matched Group color or assigns one automatically", "#665CFF"],
    ["Flow", "No", "Matched by name within the Group; leave blank for a standalone Task", "Release Workflow"],
    ["Flow Color", "No", "Use #RRGGBB; a new Flow inherits its Group color when blank", "#665CFF"],
    ["Flow Step", "No", "Task step number within the Flow; enter an integer greater than 0", "1"],
    ["Task Name*", "Yes", "Task name, up to 160 characters", "Complete pre-release checks"],
    ["DDL*", "Yes", "Deadline; yyyy-mm-dd is recommended", "2026-08-07"],
    ["Recurrence", "No", "Does not repeat, Weekly, or Monthly; blank means Does not repeat", "Weekly"],
    ["Recurrence Start", "For recurring Tasks", "Start date; must be entered with Recurrence End", "2026-08-01"],
    ["Recurrence End", "For recurring Tasks", "End date; DDL must be inside the date range", "2026-09-30"],
    ["Recurrence Completion History", "No", "Format: occurrence DDL|completion date. Separate periods with new lines or semicolons", "2026-08-07|2026-08-08"],
    ["Urgency*", "Yes", "High, Medium, or Low", "High"],
    ["Completion Status", "No", "Incomplete or Completed; blank defaults to Incomplete", "Incomplete"],
    ["Completion Date", "No", "For completed Tasks only; yyyy-mm-dd is recommended", "2026-08-06"],
    ["Report To*", "Yes", "Enter a person's name; matching names are standardized for filtering", "Wesley Yan"],
    ["Managed Person", "No", "Enter a person's name; matching names are standardized for filtering", "Amy Chen"],
    ["Deliverable*", "Yes", "Describe the expected output, up to 500 characters", "Release approval record"],
    ["Progress Note", "No", "Current progress or notes, up to 4,000 characters", "Integration testing completed"],
    ["Documentation Links", "No", "Format: title|https://...; separate links with new lines or semicolons", "User Guide|https://example.com/guide"],
    ["Deliverable Links", "No", "Format: title|https://...; separate links with new lines or semicolons", "Delivery File|https://example.com/delivery"]
  ];

  function english(options) {
    return options && options.language
      ? String(options.language).toLowerCase().startsWith("en")
      : Boolean(i18n && i18n.isEnglish());
  }

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
      ["周期生成", "recurrenceCadence"],
      ["重复周期", "recurrenceCadence"],
      ["周期起始", "recurrenceStart"],
      ["周期截止", "recurrenceEnd"],
      ["已完成周期ddl", "recurrenceCompletions"],
      ["状态", "status"],
      ["进度", "progressNote"],
      ["说明文档", "documentLinks"],
      ["交付物链接地址", "deliverableLinks"],
      ["Group Name", "groupName"],
      ["Group Color", "groupColor"],
      ["Flow Color", "flowColor"],
      ["Flow Step", "flowOrder"],
      ["Task Name", "taskName"],
      ["Deadline", "ddl"],
      ["Recurrence", "recurrenceCadence"],
      ["Recurrence Start", "recurrenceStart"],
      ["Recurrence End", "recurrenceEnd"],
      ["Recurrence Completion History", "recurrenceCompletions"],
      ["Urgency", "urgency"],
      ["Completion Status", "status"],
      ["Completion Date", "completedAt"],
      ["Report To", "reportTo"],
      ["Managed Person", "managedObject"],
      ["Deliverable", "deliverable"],
      ["Progress Note", "progressNote"],
      ["Documentation Links", "documentLinks"],
      ["Deliverable Links", "deliverableLinks"]
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
    if (!text || text === "未完成" || text === "pending" || text === "incomplete") return "pending";
    if (text === "已完成" || text === "完成" || text === "completed" || text === "complete") return "completed";
    return null;
  }

  function parseFlowOrder(value) {
    var text = cleanText(value, 30);
    if (!text) return null;
    var number = Number(text);
    return Number.isInteger(number) && number >= 1 ? number : undefined;
  }

  function parseRecurrenceCadence(value) {
    var text = cleanText(value, 30).toLocaleLowerCase();
    if (!text || ["不重复", "无", "none", "does not repeat", "no recurrence"].includes(text)) return "none";
    if (["每周", "周", "weekly"].includes(text)) return "weekly";
    if (["每月", "月", "monthly"].includes(text)) return "monthly";
    return null;
  }

  function parseRecurrenceCompletions(value) {
    var text = cleanMultiline(value, 12000);
    if (!text) return { records: [], errors: [] };
    var records = [];
    var errors = [];
    var seen = new Set();
    text
      .split(/\n|；/)
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean)
      .forEach(function (part, index) {
        var pieces = part.split("|");
        var occurrenceDdl = parseDate(pieces[0]);
        var completedAt = pieces.length > 1 ? parseDate(pieces[1]) : occurrenceDdl;
        if (!occurrenceDdl || !completedAt) {
          errors.push("周期完成记录第 " + (index + 1) + " 项必须是 周期DDL|完成日期");
          return;
        }
        if (seen.has(occurrenceDdl)) {
          errors.push("周期完成记录包含重复 DDL " + occurrenceDdl);
          return;
        }
        seen.add(occurrenceDdl);
        records.push({ occurrenceDdl: occurrenceDdl, completedAt: completedAt });
      });
    return { records: records, errors: errors };
  }

  function normalizeRecurrenceHistory(config, records) {
    if (!dates || !config || config.recurrenceCadence === "none") return [];
    var occurrences = dates.getRecurringOccurrences(config);
    var occurrenceIndex = new Map(
      occurrences.map(function (occurrence, index) {
        return [occurrence.ddl, index];
      })
    );
    var recordMap = new Map();
    var latestIndex = -1;
    (records || []).forEach(function (record) {
      var index = occurrenceIndex.get(record.occurrenceDdl);
      if (index === undefined) return;
      latestIndex = Math.max(latestIndex, index);
      recordMap.set(record.occurrenceDdl, record);
    });
    if (latestIndex < 0) return [];
    var latestRecord = recordMap.get(occurrences[latestIndex].ddl);
    return occurrences.slice(0, latestIndex + 1).map(function (occurrence) {
      var record = recordMap.get(occurrence.ddl);
      return {
        periodKey: occurrence.periodKey,
        occurrenceDdl: occurrence.ddl,
        completedAt:
          (record && record.completedAt) ||
          (latestRecord && latestRecord.completedAt) ||
          occurrence.ddl
      };
    });
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
    var recurrenceCadence = parseRecurrenceCadence(raw.recurrenceCadence);
    var recurrenceStart = parseDate(raw.recurrenceStart);
    var recurrenceEnd = parseDate(raw.recurrenceEnd);
    var recurrenceHistory = parseRecurrenceCompletions(raw.recurrenceCompletions);
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
    if (!recurrenceCadence) errors.push("周期仅支持不重复、每周、每月");
    if (cleanText(raw.recurrenceStart, 40) && !recurrenceStart) {
      errors.push("周期开始必须是有效日期");
    }
    if (cleanText(raw.recurrenceEnd, 40) && !recurrenceEnd) {
      errors.push("周期结束必须是有效日期");
    }
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
    errors = errors.concat(
      recurrenceHistory.errors,
      documents.errors,
      deliverables.errors
    );

    var recurrenceCompletions = [];
    if (recurrenceCadence === "none") {
      if (recurrenceStart || recurrenceEnd || recurrenceHistory.records.length) {
        errors.push("不重复 Task 不能填写周期开始、周期结束或周期完成记录");
      }
    } else if (recurrenceCadence) {
      if (!recurrenceStart) errors.push("周期 Task 必须填写周期开始");
      if (!recurrenceEnd) errors.push("周期 Task 必须填写周期结束");
      if (recurrenceStart && recurrenceEnd && recurrenceStart > recurrenceEnd) {
        errors.push("周期开始不能晚于周期结束");
      }
      if (
        ddl &&
        recurrenceStart &&
        recurrenceEnd &&
        (ddl < recurrenceStart || ddl > recurrenceEnd)
      ) {
        errors.push("周期 Task 的 DDL 必须位于周期起止日期内");
      }
      if (ddl && recurrenceStart && recurrenceEnd && recurrenceStart <= recurrenceEnd) {
        var recurrenceConfig = {
          ddl: ddl,
          recurrenceCadence: recurrenceCadence,
          recurrenceStart: recurrenceStart,
          recurrenceEnd: recurrenceEnd,
          recurrenceCompletions: []
        };
        var occurrences = dates.getRecurringOccurrences(recurrenceConfig);
        var occurrenceDdls = new Set(
          occurrences.map(function (occurrence) {
            return occurrence.ddl;
          })
        );
        if (!occurrences.length) errors.push("DDL 与周期范围无法形成周期节点");
        recurrenceHistory.records.forEach(function (record) {
          if (!occurrenceDdls.has(record.occurrenceDdl)) {
            errors.push("周期完成记录中的 " + record.occurrenceDdl + " 不是该 Task 的周期 DDL");
          }
        });
        recurrenceCompletions = normalizeRecurrenceHistory(
          recurrenceConfig,
          recurrenceHistory.records
        );
      }
    }

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
        recurrenceCadence: recurrenceCadence || "none",
        recurrenceStart: recurrenceCadence === "none" ? "" : recurrenceStart,
        recurrenceEnd: recurrenceCadence === "none" ? "" : recurrenceEnd,
        recurrenceCompletions: recurrenceCompletions,
        recurrenceSpecified: Boolean(raw.recurrenceSpecified),
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
        : workbook.Sheets["Task Import"]
          ? "Task Import"
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
        raw.recurrenceSpecified = [
          "recurrenceCadence",
          "recurrenceStart",
          "recurrenceEnd",
          "recurrenceCompletions"
        ].some(function (key) {
          return columnIndexes[key] !== undefined;
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

  function numericOrder(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function orderedTasks(data) {
    var groups = (Array.isArray(data && data.groups) ? data.groups : [])
      .slice()
      .sort(function (left, right) {
        return numericOrder(left.order, 0) - numericOrder(right.order, 0);
      });
    var groupRank = new Map();
    groups.forEach(function (group, index) {
      groupRank.set(group.id, index);
    });
    var flows = (Array.isArray(data && data.flows) ? data.flows : [])
      .slice()
      .sort(function (left, right) {
        var groupDifference =
          (groupRank.get(left.groupId) || 0) - (groupRank.get(right.groupId) || 0);
        return (
          groupDifference ||
          numericOrder(left.order, 0) - numericOrder(right.order, 0)
        );
      });
    var flowRank = new Map();
    flows.forEach(function (flow, index) {
      flowRank.set(flow.id, index);
    });
    var sourceRank = new Map();
    (Array.isArray(data && data.tasks) ? data.tasks : []).forEach(function (task, index) {
      sourceRank.set(task.id, index);
    });
    return (Array.isArray(data && data.tasks) ? data.tasks : [])
      .filter(function (task) {
        return groupRank.has(task.groupId);
      })
      .slice()
      .sort(function (left, right) {
        var groupDifference = groupRank.get(left.groupId) - groupRank.get(right.groupId);
        if (groupDifference) return groupDifference;
        var leftFlowRank = left.flowId && flowRank.has(left.flowId)
          ? flowRank.get(left.flowId)
          : Number.MAX_SAFE_INTEGER;
        var rightFlowRank = right.flowId && flowRank.has(right.flowId)
          ? flowRank.get(right.flowId)
          : Number.MAX_SAFE_INTEGER;
        if (leftFlowRank !== rightFlowRank) return leftFlowRank - rightFlowRank;
        if (left.flowId && right.flowId && left.flowId === right.flowId) {
          var stepDifference =
            numericOrder(left.flowOrder, Number.MAX_SAFE_INTEGER) -
            numericOrder(right.flowOrder, Number.MAX_SAFE_INTEGER);
          if (stepDifference) return stepDifference;
        }
        return sourceRank.get(left.id) - sourceRank.get(right.id);
      });
  }

  function exportLinkText(materials, taskId, type) {
    return (Array.isArray(materials) ? materials : [])
      .filter(function (material) {
        return (
          material &&
          material.type === type &&
          Array.isArray(material.taskIds) &&
          material.taskIds.includes(taskId)
        );
      })
      .map(function (material) {
        var title = cleanText(material.title, 160).replace(/[|\r\n]+/g, "｜");
        return (title ? title + "|" : "") + cleanText(material.url, 3000);
      })
      .join("\n");
  }

  function exportRecurrenceHistory(task) {
    if (!dates.isRecurringTask(task)) return "";
    var occurrenceMap = new Map(
      dates.getRecurringOccurrences(task).map(function (occurrence) {
        return [occurrence.periodKey, occurrence];
      })
    );
    return (Array.isArray(task.recurrenceCompletions) ? task.recurrenceCompletions : [])
      .map(function (record) {
        var occurrence = occurrenceMap.get(record.periodKey);
        if (!occurrence) return "";
        return occurrence.ddl + "|" + (parseDate(record.completedAt) || occurrence.ddl);
      })
      .filter(Boolean)
      .join("\n");
  }

  function buildExportRows(data) {
    var groupMap = new Map(
      (Array.isArray(data && data.groups) ? data.groups : []).map(function (group) {
        return [group.id, group];
      })
    );
    var flowMap = new Map(
      (Array.isArray(data && data.flows) ? data.flows : []).map(function (flow) {
        return [flow.id, flow];
      })
    );
    var materials = Array.isArray(data && data.materials) ? data.materials : [];
    return orderedTasks(data).map(function (task) {
      var group = groupMap.get(task.groupId);
      var flow = task.flowId ? flowMap.get(task.flowId) : null;
      return [
        group ? group.name : "",
        group ? group.color : "",
        flow ? flow.name : "",
        flow ? flow.color : "",
        flow ? task.flowOrder || "" : "",
        task.name,
        task.ddl,
        recurrenceLabels[dates.recurrenceCadence(task)] || "不重复",
        dates.isRecurringTask(task) ? task.recurrenceStart : "",
        dates.isRecurringTask(task) ? task.recurrenceEnd : "",
        exportRecurrenceHistory(task),
        urgencyLabels[task.urgency] || task.urgency || "",
        task.status === "completed" ? "已完成" : "未完成",
        task.status === "completed" ? task.completedAt || "" : "",
        task.reportTo || "",
        task.managedObject || "",
        task.deliverable || "",
        task.progressNote || "",
        exportLinkText(materials, task.id, "document"),
        exportLinkText(materials, task.id, "deliverable")
      ];
    });
  }

  function buildWorkbook(data, options) {
    if (!XLSX) throw new Error("Excel 组件未加载。");
    var isTemplate = Boolean(options && options.template);
    var activeColumns = english(options) ? EN_COLUMNS : COLUMNS;
    var headers = activeColumns.map(function (column) {
      return column[1];
    });
    var rows = buildExportRows(data);
    if (english(options)) {
      rows = rows.map(function (row) {
        var copy = row.slice();
        copy[7] = ({ "不重复": "Does not repeat", "每周": "Weekly", "每月": "Monthly" })[copy[7]] || copy[7];
        copy[11] = ({ "高": "High", "中": "Medium", "低": "Low" })[copy[11]] || copy[11];
        copy[12] = copy[12] === "已完成" ? "Completed" : "Incomplete";
        return copy;
      });
    }
    var taskSheet = XLSX.utils.aoa_to_sheet(
      [
        [english(options)
          ? isTemplate ? "Weekflow Task Import Template" : "Weekflow Current Task Data (Re-importable)"
          : isTemplate ? "Weekflow Task 导入模板" : "Weekflow Task 当前数据（可再次导入）"],
        [english(options)
          ? isTemplate ? "Enter one Task per row, then upload this workbook through Excel Bulk Import." : "Each row is one Task. This file matches the blank import template and can be uploaded through Excel Bulk Import."
          : isTemplate ? "每行填写 1 条 Task，完成后可通过“上传 Excel 批量导入”上传。" : "每行代表 1 条 Task；文件结构与空白导入模板一致，可在“上传 Excel 批量导入”中直接使用。"],
        [english(options) ? "* Required | Do not change headers | Use yyyy-mm-dd dates | Maximum 1,000 Tasks per import" : "带 * 为必填列｜请勿修改表头｜日期建议使用 yyyy-mm-dd｜单次最多导入 1000 条 Task"],
        headers
      ].concat(rows)
    );
    taskSheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: COLUMNS.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: COLUMNS.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: COLUMNS.length - 1 } }
    ];
    taskSheet["!cols"] = COLUMN_WIDTHS.map(function (width) {
      return { wch: width };
    });
    taskSheet["!autofilter"] = {
      ref:
        "A4:" +
        XLSX.utils.encode_col(COLUMNS.length - 1) +
        Math.max(4, rows.length + 4)
    };
    taskSheet["!freeze"] = { xSplit: 0, ySplit: 4 };

    var guideRows = english(options)
      ? [
          ["Weekflow Excel Import Guide"],
          ["1. Open the Task Import sheet and enter or update one Task per row."],
          ["2. Group, Task Name, DDL, Urgency, Report To, and Deliverable are required."],
          ["3. In Weekflow, choose ••• → Upload Excel for Bulk Import and review validation results."],
          ["4. Choose Supplement Import or Complete Replacement; replacement requires two confirmations."],
          ["Field", "Required", "Instructions", "Example (reference only)"]
        ].concat(EN_GUIDE_ROWS)
      : [
          ["Weekflow Excel 导入使用说明"],
          ["1. 回到“Task导入”工作表，每行填写或调整 1 条 Task。"],
          ["2. 分组、Task name、DDL、紧急程度、汇报对象和交付物为必填。"],
          ["3. 在 Weekflow 中选择“••• → 上传 Excel 批量导入”，先查看校验预览。"],
          ["4. 选择补充导入或完整覆盖；完整覆盖会连续确认两次。"],
          ["字段", "必填", "填写规则", "格式示例（仅供参考）"]
        ].concat(GUIDE_ROWS);
    var guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
    guideSheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 3 } }
    ];
    guideSheet["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 58 }, { wch: 42 }];
    guideSheet["!autofilter"] = { ref: "A6:D" + guideRows.length };
    guideSheet["!freeze"] = { xSplit: 0, ySplit: 6 };

    var workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, taskSheet, english(options) ? "Task Import" : SHEET_NAME);
    XLSX.utils.book_append_sheet(workbook, guideSheet, english(options) ? "Instructions" : "填写说明");
    workbook.Props = {
      Title: english(options)
        ? isTemplate ? "Weekflow Task Import Template" : "Weekflow Current Task Data"
        : isTemplate ? "Weekflow Task 导入模板" : "Weekflow Task 当前数据",
      Subject: "Weekflow v2.6 re-importable Task data",
      Author: "Wesley Yan",
      Comments: english(options)
        ? isTemplate ? "Blank Task import template." : "Matches the Weekflow Task import template and can be imported again."
        : isTemplate ? "空白 Task 导入模板。" : "与 Weekflow Task 导入模板结构一致，可再次批量导入。"
    };
    return workbook;
  }

  function buildXlsxPackage(data, ZipConstructor, outputType, options) {
    if (!xlsxSafe || typeof xlsxSafe.buildWorkbookPackage !== "function") {
      return Promise.reject(new Error("Excel 安全打包组件未加载。"));
    }
    return xlsxSafe.buildWorkbookPackage(
      buildWorkbook(data, options),
      XLSX,
      ZipConstructor,
      outputType
    );
  }

  function exportWorkbook(data, ZipConstructor, filename) {
    var options = { language: i18n && i18n.getLanguage ? i18n.getLanguage() : "zh-CN" };
    var outputName = filename || (english(options) ? "Weekflow_Current_Task_Data.xlsx" : "Weekflow_Task当前数据.xlsx");
    return buildXlsxPackage(data, ZipConstructor, "blob", options).then(function (blob) {
      return { filename: outputName, blob: blob };
    });
  }

  function exportTemplateWorkbook(ZipConstructor, filename) {
    var options = {
      language: i18n && i18n.getLanguage ? i18n.getLanguage() : "zh-CN",
      template: true
    };
    var emptyData = { groups: [], flows: [], tasks: [], materials: [] };
    var outputName = filename || (english(options)
      ? "Weekflow_Task_Import_Template_EN.xlsx"
      : "Weekflow_Task导入模板.xlsx");
    return buildXlsxPackage(emptyData, ZipConstructor, "blob", options).then(function (blob) {
      return { filename: outputName, blob: blob };
    });
  }

  return {
    SHEET_NAME: SHEET_NAME,
    MAX_ROWS: MAX_ROWS,
    COLUMNS: COLUMNS.map(function (column) {
      return { key: column[0], header: column[1], required: column[2] };
    }),
    parseDate: parseDate,
    parseLinks: parseLinks,
    parseWorkbook: parseWorkbook,
    buildExportRows: buildExportRows,
    buildWorkbook: buildWorkbook,
    buildXlsxPackage: buildXlsxPackage,
    exportWorkbook: exportWorkbook,
    exportTemplateWorkbook: exportTemplateWorkbook
  };
});
