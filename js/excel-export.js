/* 使用本地 JSZip 生成带样式、冻结窗格和精确周时间轴的 OOXML .xlsx 文件。 */
(function (root, factory) {
  var deps = {
    dates:
      root.App && root.App.dateUtils
        ? root.App.dateUtils
        : typeof require === "function"
          ? require("./date-utils.js")
          : null,
    stats:
      root.App && root.App.stats
        ? root.App.stats
        : typeof require === "function"
          ? require("./stats.js")
          : null,
    materials:
      root.App && root.App.materials
        ? root.App.materials
        : typeof require === "function"
          ? require("./materials.js")
          : null
  };
  var api = factory(deps.dates, deps.stats, deps.materials);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.App = root.App || {};
  root.App.excelExport = api;
})(typeof self !== "undefined" ? self : globalThis, function (dates, stats, materialTools) {
  "use strict";

  var FIXED_HEADERS = [
    "分组",
    "Flow",
    "步骤序号",
    "Task name",
    "汇报对象",
    "管理对象",
    "交付物",
    "DDL",
    "DDL 对应周五",
    "紧急程度",
    "完成状态",
    "完成日期",
    "是否逾期",
    "进度记录",
    "相关资料"
  ];
  var FIXED_WIDTHS = [18, 22, 10, 34, 16, 18, 28, 13, 15, 11, 12, 13, 11, 48, 60];
  var XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  var urgencyLabels = { high: "高", medium: "中", low: "低" };

  function formatMaterials(materials) {
    return (Array.isArray(materials) ? materials : [])
      .map(function (material) {
        return (
          "[" +
          (materialTools.TYPE_LABELS[material.type] || material.type) +
          "] " +
          material.title +
          "：" +
          material.url
        );
      })
      .join("\n");
  }

  function timelineWeeks(tasks, now) {
    var valid = (Array.isArray(tasks) ? tasks : []).filter(function (task) {
      return dates.parseISODate(task.ddl);
    });
    if (!valid.length) return [dates.getWeekFriday(now || new Date())];
    var ddls = valid
      .map(function (task) {
        return task.ddl;
      })
      .sort();
    return dates.buildWeekRange(ddls[0], ddls[ddls.length - 1], 600);
  }

  function buildOverallRows(data, now) {
    var summary = stats.summarize(data.tasks, now);
    var groupRows = stats.summarizeByGroup(data.groups, data.tasks, now);
    var flowRows = stats.summarizeByFlow(data.flows || [], data.groups, data.tasks, now);
    var rows = [
      ["Task 整体看板"],
      ["导出时间", new Date(now || Date.now()).toLocaleString("zh-CN")],
      [],
      ["总体统计"],
      ["Task 总数", "已完成数量", "未完成数量", "当前逾期数量", "完成率"],
      [
        summary.total,
        summary.completed,
        summary.pending,
        summary.overdue,
        summary.completionRate + "%"
      ],
      [],
      ["分组统计"],
      ["分组名称", "Task 总数", "已完成", "未完成", "逾期", "完成率"]
    ];
    groupRows.forEach(function (item) {
      rows.push([
        item.group.name,
        item.total,
        item.completed,
        item.pending,
        item.overdue,
        item.completionRate + "%"
      ]);
    });
    rows.push([], ["Flow 统计"], [
      "所属分组",
      "Flow 名称",
      "步骤数",
      "已完成",
      "未完成",
      "逾期",
      "完成率"
    ]);
    flowRows.forEach(function (item) {
      rows.push([
        item.group ? item.group.name : "未知分组",
        item.flow.name,
        item.total,
        item.completed,
        item.pending,
        item.overdue,
        item.completionRate + "%"
      ]);
    });
    return rows;
  }

  function buildTimelineRows(data, now) {
    var today = dates.todayISO(now instanceof Date ? now : new Date());
    var weeks = timelineWeeks(data.tasks, now);
    var groupMap = new Map(
      data.groups.map(function (group) {
        return [group.id, group];
      })
    );
    var flowMap = new Map(
      (data.flows || []).map(function (flow) {
        return [flow.id, flow];
      })
    );
    var sortedGroups = data.groups.slice().sort(function (a, b) {
      return Number(a.order || 0) - Number(b.order || 0);
    });
    var rows = [FIXED_HEADERS.concat(weeks)];
    var orderedTasks = [];
    sortedGroups.forEach(function (group) {
      var groupSourceTasks = data.tasks.filter(function (task) {
        return task.groupId === group.id;
      });
      var groupTasks = [];
      (data.flows || [])
        .filter(function (flow) {
          return flow.groupId === group.id;
        })
        .sort(function (left, right) {
          return Number(left.order || 0) - Number(right.order || 0);
        })
        .forEach(function (flow) {
          groupTasks = groupTasks.concat(
            stats.sortFlowTasks(
              groupSourceTasks.filter(function (task) {
                return task.flowId === flow.id;
              }),
              today
            )
          );
        });
      groupTasks = groupTasks.concat(
        stats.sortTasks(
          groupSourceTasks.filter(function (task) {
            return !task.flowId;
          }),
          today
        )
      );
      groupTasks.forEach(function (task) {
        var taskFriday = dates.getWeekFriday(task.ddl);
        var flow = task.flowId ? flowMap.get(task.flowId) : null;
        var row = [
          groupMap.get(task.groupId) ? group.name : "未知分组",
          flow ? flow.name : "",
          flow ? task.flowOrder || "" : "",
          task.name,
          task.reportTo,
          task.managedObject,
          task.deliverable,
          task.ddl,
          taskFriday,
          urgencyLabels[task.urgency] || task.urgency,
          task.status === "completed" ? "已完成" : "未完成",
          task.completedAt || "",
          dates.isOverdue(task, today) ? "是" : "否",
          task.progressNote || "",
          formatMaterials(
            (data.materials || []).filter(function (material) {
              return material.taskIds.includes(task.id);
            })
          )
        ];
        weeks.forEach(function (friday) {
          row.push(friday === taskFriday ? "● " + task.name : "");
        });
        rows.push(row);
        orderedTasks.push(task);
      });
    });
    return { rows: rows, weeks: weeks, tasks: orderedTasks };
  }

  function xmlEscape(value) {
    var clean = Array.from(String(value === null || value === undefined ? "" : value))
      .filter(function (character) {
        var code = character.codePointAt(0);
        return (
          code === 9 ||
          code === 10 ||
          code === 13 ||
          (code >= 32 && code <= 55295) ||
          (code >= 57344 && code <= 65533) ||
          (code >= 65536 && code <= 1114111)
        );
      })
      .join("");
    return clean
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function columnName(index) {
    var name = "";
    var value = Number(index) + 1;
    while (value > 0) {
      var remainder = (value - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      value = Math.floor((value - 1) / 26);
    }
    return name;
  }

  function excelSerial(dateString) {
    var date = dates.parseISODate(dateString);
    if (!date) return null;
    return Math.round(
      (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
        Date.UTC(1899, 11, 30)) /
        86400000
    );
  }

  function cellXml(reference, value, styleIndex, forceDate) {
    var style = styleIndex ? ' s="' + styleIndex + '"' : "";
    if (forceDate) {
      var serial = excelSerial(value);
      return serial === null
        ? '<c r="' + reference + '"' + style + "/>"
        : '<c r="' + reference + '"' + style + ' t="n"><v>' + serial + "</v></c>";
    }
    if (value === "" || value === null || value === undefined) {
      return '<c r="' + reference + '"' + style + "/>";
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return '<c r="' + reference + '"' + style + ' t="n"><v>' + value + "</v></c>";
    }
    return (
      '<c r="' +
      reference +
      '"' +
      style +
      ' t="inlineStr"><is><t xml:space="preserve">' +
      xmlEscape(value) +
      "</t></is></c>"
    );
  }

  function contrastUsesDarkFont(hex) {
    var raw = String(hex || "#5368D8").replace("#", "");
    var r = parseInt(raw.slice(0, 2), 16);
    var g = parseInt(raw.slice(2, 4), 16);
    var b = parseInt(raw.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 155;
  }

  function groupStyleMap(data) {
    var map = new Map();
    data.groups.forEach(function (group, index) {
      map.set(group.id, 9 + index);
    });
    return map;
  }

  function styleSheetXml(data) {
    var dynamicFills = data.groups
      .map(function (group) {
        return (
          '<fill><patternFill patternType="solid"><fgColor rgb="FF' +
          xmlEscape(group.color.replace("#", "").toUpperCase()) +
          '"/><bgColor indexed="64"/></patternFill></fill>'
        );
      })
      .join("");
    var dynamicXfs = data.groups
      .map(function (group, index) {
        return (
          '<xf numFmtId="0" fontId="' +
          (contrastUsesDarkFont(group.color) ? 5 : 1) +
          '" fillId="' +
          (6 + index) +
          '" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
          '<alignment vertical="top" wrapText="1"/></xf>'
        );
      })
      .join("");
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>' +
      '<fonts count="6">' +
      '<font><sz val="11"/><color rgb="FF172033"/><name val="Arial Unicode MS"/><family val="2"/><charset val="86"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial Unicode MS"/><family val="2"/><charset val="86"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FF3F51B8"/><name val="Arial Unicode MS"/><family val="2"/><charset val="86"/></font>' +
      '<font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Arial Unicode MS"/><family val="2"/><charset val="86"/></font>' +
      '<font><sz val="11"/><color rgb="FFB32832"/><name val="Arial Unicode MS"/><family val="2"/><charset val="86"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FF172033"/><name val="Arial Unicode MS"/><family val="2"/><charset val="86"/></font>' +
      "</fonts>" +
      '<fills count="' +
      (6 + data.groups.length) +
      '">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF172033"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF5368D8"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFEDF0FF"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF0F1"/><bgColor indexed="64"/></patternFill></fill>' +
      dynamicFills +
      "</fills>" +
      '<borders count="2">' +
      "<border><left/><right/><top/><bottom/><diagonal/></border>" +
      '<border><left style="thin"><color rgb="FFDDE3ED"/></left><right style="thin"><color rgb="FFDDE3ED"/></right>' +
      '<top style="thin"><color rgb="FFDDE3ED"/></top><bottom style="thin"><color rgb="FFDDE3ED"/></bottom><diagonal/></border>' +
      "</borders>" +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' +
      (9 + data.groups.length) +
      '">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>' +
      '<xf numFmtId="164" fontId="4" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>' +
      dynamicXfs +
      "</cellXfs>" +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>' +
      "</styleSheet>"
    );
  }

  function columnsXml(widths) {
    return (
      "<cols>" +
      widths
        .map(function (width, index) {
          return (
            '<col min="' +
            (index + 1) +
            '" max="' +
            (index + 1) +
            '" width="' +
            width +
            '" customWidth="1"/>'
          );
        })
        .join("") +
      "</cols>"
    );
  }

  function overallSheetXml(data, now) {
    var rows = buildOverallRows(data, now);
    var styles = groupStyleMap(data);
    var sortedGroups = data.groups.slice().sort(function (a, b) {
      return Number(a.order || 0) - Number(b.order || 0);
    });
    var flowSummaries = stats.summarizeByFlow(data.flows || [], data.groups, data.tasks, now);
    var groupHeadingRow = 8;
    var groupHeaderRow = 9;
    var groupStartRow = 10;
    var groupEndRow = groupStartRow + sortedGroups.length - 1;
    var flowHeadingRow = groupEndRow + 2;
    var flowHeaderRow = flowHeadingRow + 1;
    var flowStartRow = flowHeaderRow + 1;
    var rowXml = rows
      .map(function (row, rowIndex) {
        var excelRow = rowIndex + 1;
        if (!row.length) return '<row r="' + excelRow + '"/>';
        var headingRow =
          excelRow === 1 ||
          excelRow === 4 ||
          excelRow === groupHeadingRow ||
          excelRow === flowHeadingRow;
        var maxColumns = headingRow ? 1 : row.length;
        var cells = [];
        for (var col = 0; col < maxColumns; col += 1) {
          var style = 1;
          if (excelRow === 1) style = 3;
          else if (
            excelRow === 4 ||
            excelRow === groupHeadingRow ||
            excelRow === flowHeadingRow
          ) {
            style = 4;
          } else if (
            excelRow === 5 ||
            excelRow === groupHeaderRow ||
            excelRow === flowHeaderRow
          ) {
            style = 5;
          } else if (
            excelRow >= groupStartRow &&
            excelRow <= groupEndRow &&
            col === 0
          ) {
            var group = sortedGroups[excelRow - groupStartRow];
            style = group ? styles.get(group.id) : 1;
          } else if (excelRow >= flowStartRow && col === 0) {
            var flowSummary = flowSummaries[excelRow - flowStartRow];
            style =
              flowSummary && flowSummary.group
                ? styles.get(flowSummary.group.id) || 1
                : 1;
          }
          cells.push(cellXml(columnName(col) + excelRow, row[col], style));
        }
        var height = excelRow === 1 ? ' ht="28" customHeight="1"' : "";
        return '<row r="' + excelRow + '"' + height + ">" + cells.join("") + "</row>";
      })
      .join("");
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:G' +
      rows.length +
      '"/><sheetViews><sheetView tabSelected="1" workbookViewId="0">' +
      '<pane ySplit="9" topLeftCell="A10" activePane="bottomLeft" state="frozen"/>' +
      '<selection pane="bottomLeft" activeCell="A10" sqref="A10"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>' +
      columnsXml([28, 28, 16, 16, 16, 16, 14]) +
      "<sheetData>" +
      rowXml +
      '</sheetData><mergeCells count="4"><mergeCell ref="A1:G1"/><mergeCell ref="A4:G4"/><mergeCell ref="A' +
      groupHeadingRow +
      ':G' +
      groupHeadingRow +
      '"/><mergeCell ref="A' +
      flowHeadingRow +
      ':G' +
      flowHeadingRow +
      '"/></mergeCells>' +
      '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
      "</worksheet>"
    );
  }

  function timelineSheetXml(data, now) {
    var timeline = buildTimelineRows(data, now);
    var styles = groupStyleMap(data);
    var today = dates.todayISO(now instanceof Date ? now : new Date());
    var rowXml = timeline.rows
      .map(function (row, rowIndex) {
        var excelRow = rowIndex + 1;
        var task = rowIndex > 0 ? timeline.tasks[rowIndex - 1] : null;
        var overdue = task ? dates.isOverdue(task, today) : false;
        var cells = row.map(function (value, col) {
          var style;
          var dateColumn = rowIndex > 0 && (col === 7 || col === 8 || col === 11);
          if (rowIndex === 0) style = 2;
          else if (col === 0 && task) style = styles.get(task.groupId) || 1;
          else if (dateColumn) style = overdue ? 8 : 7;
          else style = overdue ? 6 : 1;
          return cellXml(columnName(col) + excelRow, value, style, dateColumn);
        });
        var height = rowIndex === 0 ? ' ht="30" customHeight="1"' : ' ht="34" customHeight="1"';
        return '<row r="' + excelRow + '"' + height + ">" + cells.join("") + "</row>";
      })
      .join("");
    var lastColumn = columnName(timeline.rows[0].length - 1);
    var lastRow = timeline.rows.length;
    var frozenColumn = columnName(FIXED_HEADERS.length);
    var widths = FIXED_WIDTHS.concat(
      timeline.weeks.map(function () {
        return 15;
      })
    );
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:' +
      lastColumn +
      lastRow +
      '"/><sheetViews><sheetView workbookViewId="0">' +
      '<pane xSplit="' +
      FIXED_HEADERS.length +
      '" ySplit="1" topLeftCell="' +
      frozenColumn +
      '2" activePane="bottomRight" state="frozen"/>' +
      '<selection pane="topRight" activeCell="' +
      frozenColumn +
      '1" sqref="' +
      frozenColumn +
      '1"/>' +
      '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' +
      '<selection pane="bottomRight" activeCell="' +
      frozenColumn +
      '2" sqref="' +
      frozenColumn +
      '2"/>' +
      "</sheetView></sheetViews><sheetFormatPr defaultRowHeight=\"15\"/>" +
      columnsXml(widths) +
      "<sheetData>" +
      rowXml +
      '</sheetData><autoFilter ref="A1:' +
      lastColumn +
      lastRow +
      '"/><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>' +
      "</worksheet>"
    );
  }

  function contentTypesXml() {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      "</Types>"
    );
  }

  function packageRelationshipsXml() {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
      "</Relationships>"
    );
  }

  function workbookXml(data, now) {
    var timeline = buildTimelineRows(data, now);
    var lastColumn = columnName(timeline.rows[0].length - 1);
    var lastRow = timeline.rows.length;
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<workbookPr date1904="0"/>' +
      '<bookViews><workbookView visibility="visible" minimized="0" showHorizontalScroll="1" showVerticalScroll="1" showSheetTabs="1" xWindow="120" yWindow="120" windowWidth="24000" windowHeight="15000" tabRatio="600" firstSheet="0" activeTab="0" autoFilterDateGrouping="1"/></bookViews>' +
      '<sheets><sheet name="整体看板" sheetId="1" state="visible" r:id="rId1"/><sheet name="时间表看板" sheetId="2" state="visible" r:id="rId2"/></sheets>' +
      '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="1" hidden="1">&apos;时间表看板&apos;!$A$1:$' +
      lastColumn +
      "$" +
      lastRow +
      "</definedName></definedNames>" +
      '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'
    );
  }

  function workbookRelationshipsXml() {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>"
    );
  }

  function corePropertiesXml(now) {
    var created = (now instanceof Date ? now : new Date()).toISOString();
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      "<dc:title>Weekflow Task 看板</dc:title><dc:creator>Wesley Yan</dc:creator>" +
      "<cp:lastModifiedBy>Wesley Yan</cp:lastModifiedBy>" +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' +
      created +
      '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' +
      created +
      "</dcterms:modified></cp:coreProperties>"
    );
  }

  function appPropertiesXml() {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
      'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
      "<Application>Weekflow</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop>" +
      '<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>工作表</vt:lpstr></vt:variant>' +
      '<vt:variant><vt:i4>2</vt:i4></vt:variant></vt:vector></HeadingPairs>' +
      '<TitlesOfParts><vt:vector size="2" baseType="lpstr"><vt:lpstr>整体看板</vt:lpstr><vt:lpstr>时间表看板</vt:lpstr></vt:vector></TitlesOfParts>' +
      "<Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc>" +
      "<HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0300</AppVersion></Properties>"
    );
  }

  function buildXlsxPackage(data, ZipConstructor, now, outputType) {
    if (typeof ZipConstructor !== "function") {
      return Promise.reject(new Error("Excel 压缩组件未加载。"));
    }
    var date = now instanceof Date ? now : new Date();
    var zip = new ZipConstructor();
    zip.file("[Content_Types].xml", contentTypesXml());
    zip.file("_rels/.rels", packageRelationshipsXml());
    zip.file("docProps/core.xml", corePropertiesXml(date));
    zip.file("docProps/app.xml", appPropertiesXml());
    zip.file("xl/workbook.xml", workbookXml(data, date));
    zip.file("xl/_rels/workbook.xml.rels", workbookRelationshipsXml());
    zip.file("xl/styles.xml", styleSheetXml(data));
    zip.file("xl/worksheets/sheet1.xml", overallSheetXml(data, date));
    zip.file("xl/worksheets/sheet2.xml", timelineSheetXml(data, date));
    return zip.generateAsync({
      type: outputType || "blob",
      mimeType: XLSX_MIME,
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });
  }

  function exportWorkbook(data, ZipConstructor, now) {
    var date = now instanceof Date ? now : new Date();
    var filename = "Task看板_" + dates.dateTimeStamp(date) + ".xlsx";
    return buildXlsxPackage(data, ZipConstructor, date, "blob").then(function (blob) {
      return { filename: filename, blob: blob };
    });
  }

  return {
    FIXED_HEADERS: FIXED_HEADERS.slice(),
    formatMaterials: formatMaterials,
    timelineWeeks: timelineWeeks,
    buildOverallRows: buildOverallRows,
    buildTimelineRows: buildTimelineRows,
    buildXlsxPackage: buildXlsxPackage,
    exportWorkbook: exportWorkbook,
    _test: {
      xmlEscape: xmlEscape,
      columnName: columnName,
      excelSerial: excelSerial,
      workbookXml: workbookXml,
      styleSheetXml: styleSheetXml,
      overallSheetXml: overallSheetXml,
      timelineSheetXml: timelineSheetXml
    }
  };
});
