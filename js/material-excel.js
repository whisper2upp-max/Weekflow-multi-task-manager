/* 资料库 Excel 导入、校验与导出。 */
(function (root, factory) {
  var xlsx =
    typeof module === "object" && module.exports
      ? require("../vendor/xlsx.full.min.js")
      : root.XLSX;
  var materialTools =
    root.App && root.App.materials
      ? root.App.materials
      : typeof require === "function"
        ? require("./materials.js")
        : null;
  var api = factory(xlsx, materialTools);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.App = root.App || {};
  root.App.materialExcel = api;
})(typeof self !== "undefined" ? self : globalThis, function (XLSX, materialTools) {
  "use strict";

  var SHEET_NAME = "资料库导入";
  var MAX_ROWS = 2000;
  var COLUMNS = [
    ["title", "链接名称*", true],
    ["url", "链接地址*", true],
    ["type", "类型", false],
    ["taskNames", "相关Task", false],
    ["flowNames", "相关Flow", false],
    ["groupNames", "分组", false],
    ["note", "备注", false]
  ];

  function cleanText(value, maxLength) {
    return String(value === null || value === undefined ? "" : value)
      .trim()
      .slice(0, maxLength || 500);
  }

  function normalizeHeader(value) {
    return cleanText(value, 100)
      .replace(/[＊*]/g, "")
      .replace(/\s+/g, "")
      .toLocaleLowerCase();
  }

  function splitNames(value) {
    var seen = new Set();
    return String(value === null || value === undefined ? "" : value)
      .split(/\r?\n|；|;/)
      .map(function (part) {
        return part.trim();
      })
      .filter(function (part) {
        var key = part.toLocaleLowerCase();
        if (!part || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function validUrl(value) {
    try {
      var parsed = new URL(value);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch (_error) {
      return false;
    }
  }

  function aliases() {
    var result = {};
    COLUMNS.forEach(function (column) {
      result[normalizeHeader(column[1])] = column[0];
    });
    [
      ["名称", "title"],
      ["资料名称", "title"],
      ["地址", "url"],
      ["链接", "url"],
      ["链接类型", "type"],
      ["Task", "taskNames"],
      ["Flow", "flowNames"],
      ["所属分组", "groupNames"],
      ["说明", "note"]
    ].forEach(function (item) {
      result[normalizeHeader(item[0])] = item[1];
    });
    return result;
  }

  function matrixFromSheet(sheet) {
    if (!sheet || !sheet["!ref"]) return [];
    var range = XLSX.utils.decode_range(sheet["!ref"]);
    var matrix = [];
    var lastRow = Math.min(range.e.r, MAX_ROWS + 20);
    var lastColumn = Math.min(range.e.c, 31);
    for (var rowIndex = 0; rowIndex <= lastRow; rowIndex += 1) {
      var row = [];
      for (var columnIndex = 0; columnIndex <= lastColumn; columnIndex += 1) {
        var cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
        row.push(cell && cell.v !== undefined && cell.v !== null ? cell.v : "");
      }
      matrix.push(row);
    }
    return matrix;
  }

  function findHeaderRow(matrix) {
    var map = aliases();
    for (var index = 0; index < Math.min(matrix.length, 12); index += 1) {
      var found = new Set(
        matrix[index]
          .map(function (value) {
            return map[normalizeHeader(value)];
          })
          .filter(Boolean)
      );
      if (found.has("title") && found.has("url")) return index;
    }
    return -1;
  }

  function parseWorkbook(arrayBuffer) {
    if (!XLSX) return { rows: [], errors: ["Excel 解析组件未加载。"], sheetName: "" };
    try {
      var workbook = XLSX.read(arrayBuffer, { type: "array" });
      var sheetName = workbook.Sheets[SHEET_NAME] ? SHEET_NAME : workbook.SheetNames[0];
      if (!sheetName) return { rows: [], errors: ["Excel 中没有工作表。"], sheetName: "" };
      var matrix = matrixFromSheet(workbook.Sheets[sheetName]);
      var headerRow = findHeaderRow(matrix);
      if (headerRow < 0) {
        return {
          rows: [],
          errors: ["未找到资料库模板表头，请使用下载的 Weekflow 资料库导入模板。"],
          sheetName: sheetName
        };
      }
      var map = aliases();
      var indexes = {};
      matrix[headerRow].forEach(function (header, index) {
        var key = map[normalizeHeader(header)];
        if (key && indexes[key] === undefined) indexes[key] = index;
      });
      var sourceRows = matrix
        .slice(headerRow + 1)
        .map(function (row, index) {
          return { row: row, sourceRow: headerRow + index + 2 };
        })
        .filter(function (item) {
          return item.row.some(function (cell) {
            return cleanText(cell, 20);
          });
        });
      if (sourceRows.length > MAX_ROWS) {
        return {
          rows: [],
          errors: ["单次最多导入 " + MAX_ROWS + " 条资料，请拆分文件。"],
          sheetName: sheetName
        };
      }
      var errors = [];
      var rows = sourceRows.map(function (item) {
        var raw = {};
        COLUMNS.forEach(function (column) {
          raw[column[0]] =
            indexes[column[0]] === undefined ? "" : item.row[indexes[column[0]]];
        });
        var title = cleanText(raw.title, 160);
        var url = cleanText(raw.url, 3000);
        var rawType = cleanText(raw.type, 40);
        var type = materialTools.normalizeType(rawType) || (!rawType ? "document" : "");
        if (!title) errors.push("第 " + item.sourceRow + " 行：链接名称不能为空");
        if (!url) errors.push("第 " + item.sourceRow + " 行：链接地址不能为空");
        else if (!validUrl(url)) {
          errors.push("第 " + item.sourceRow + " 行：链接地址必须是 HTTP/HTTPS URL");
        }
        if (!type) {
          errors.push(
            "第 " +
              item.sourceRow +
              " 行：类型仅支持说明文档、交付物、控制表、文件夹"
          );
        }
        return {
          sourceRow: item.sourceRow,
          title: title,
          url: url,
          type: type || "document",
          taskNames: splitNames(raw.taskNames),
          flowNames: splitNames(raw.flowNames),
          groupNames: splitNames(raw.groupNames),
          note: cleanText(raw.note, 2000)
        };
      });
      return { rows: rows, errors: errors, sheetName: sheetName };
    } catch (error) {
      return { rows: [], errors: ["无法读取 Excel：" + error.message], sheetName: "" };
    }
  }

  function taskPath(task, data) {
    var group = data.groups.find(function (item) {
      return item.id === task.groupId;
    });
    var flow = data.flows.find(function (item) {
      return item.id === task.flowId;
    });
    return [group && group.name, flow && flow.name, task.name].filter(Boolean).join("/");
  }

  function flowPath(flow, data) {
    var group = data.groups.find(function (item) {
      return item.id === flow.groupId;
    });
    return [group && group.name, flow.name].filter(Boolean).join("/");
  }

  function buildWorkbook(data) {
    var header = COLUMNS.map(function (column) {
      return column[1];
    });
    var rows = materialTools.sortByGroup(data.materials || [], data).map(function (material) {
      var relations = materialTools.resolveRelations(material, data);
      return [
        material.title,
        material.url,
        materialTools.TYPE_LABELS[material.type],
        relations.tasks
          .map(function (task) {
            return taskPath(task, data);
          })
          .join("\n"),
        relations.flows
          .map(function (flow) {
            return flowPath(flow, data);
          })
          .join("\n"),
        relations.groups
          .map(function (group) {
            return group.name;
          })
          .join("\n"),
        material.note || ""
      ];
    });
    var workbook = XLSX.utils.book_new();
    var sheet = XLSX.utils.aoa_to_sheet([header].concat(rows));
    sheet["!cols"] = [
      { wch: 28 },
      { wch: 52 },
      { wch: 14 },
      { wch: 36 },
      { wch: 30 },
      { wch: 24 },
      { wch: 42 }
    ];
    sheet["!autofilter"] = { ref: "A1:G" + Math.max(1, rows.length + 1) };
    sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    rows.forEach(function (_row, index) {
      var address = "B" + (index + 2);
      if (sheet[address]) sheet[address].l = { Target: sheet[address].v };
    });
    XLSX.utils.book_append_sheet(workbook, sheet, "资料库");
    workbook.Props = {
      Title: "Weekflow v2.1 资料库",
      Subject: "Weekflow materials library",
      Author: "Wesley Yan"
    };
    return workbook;
  }

  function exportWorkbook(data, filename) {
    XLSX.writeFile(buildWorkbook(data), filename || "Weekflow_资料库.xlsx", {
      compression: true
    });
  }

  return {
    SHEET_NAME: SHEET_NAME,
    MAX_ROWS: MAX_ROWS,
    COLUMNS: COLUMNS.map(function (column) {
      return { key: column[0], header: column[1], required: column[2] };
    }),
    splitNames: splitNames,
    parseWorkbook: parseWorkbook,
    buildWorkbook: buildWorkbook,
    exportWorkbook: exportWorkbook
  };
});
