/* 使用本地 JSZip 生成带样式、开放视图和精确周时间轴的 OOXML .xlsx 文件。 */
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
          : null,
    i18n:
      root.App && root.App.i18n
        ? root.App.i18n
        : typeof require === "function"
          ? require("./i18n.js")
          : null,
    richText:
      root.App && root.App.richText
        ? root.App.richText
        : typeof require === "function"
          ? require("./rich-text.js")
          : null
  };
  var api = factory(deps.dates, deps.stats, deps.materials, deps.i18n, deps.richText);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.App = root.App || {};
  root.App.excelExport = api;
})(typeof self !== "undefined" ? self : globalThis, function (dates, stats, materialTools, i18n, richText) {
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
    "周期",
    "周期开始",
    "周期结束",
    "紧急程度",
    "完成状态",
    "完成日期",
    "是否逾期",
    "进度记录",
    "相关资料"
  ];
  var FIXED_WIDTHS = [18, 22, 10, 34, 16, 18, 28, 13, 15, 12, 13, 13, 11, 12, 13, 11, 48, 60];
  var XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  var urgencyLabels = { high: "高", medium: "中", low: "低" };
  var recurrenceLabels = { none: "不重复", weekly: "每周", monthly: "每月" };

  function isEnglish(options) {
    return options && options.language
      ? String(options.language).toLowerCase().startsWith("en")
      : Boolean(i18n && i18n.isEnglish());
  }

  function labels(options) {
    if (!isEnglish(options)) {
      return {
        headers: FIXED_HEADERS.slice(), overallTitle: "Task 整体看板", exportTime: "导出时间",
        overallStats: "总体统计", totals: ["Task 总数", "已完成数量", "未完成数量", "当前逾期数量", "完成率"],
        groupStats: "分组统计", groupHeaders: ["分组名称", "Task 总数", "已完成", "未完成", "逾期", "完成率"],
        flowStats: "Flow 统计", flowHeaders: ["所属分组", "Flow 名称", "步骤数", "已完成", "未完成", "逾期", "完成率"],
        unknownGroup: "未知分组", yes: "是", no: "否", completed: "已完成", pending: "未完成",
        urgency: { high: "高", medium: "中", low: "低" }, recurrence: recurrenceLabels,
        sheets: ["整体看板", "时间表看板", "进度历史"], workbook: "工作表", dashboardTitle: "Weekflow Task 看板",
        progressHeaders: ["分组", "Flow", "Task name", "DDL", "记录 ID", "进度内容", "创建时间", "最后编辑时间", "来源", "来源笔记 ID"],
        reportFilename: "Task看板_", managed: "管理对象", reportTo: "汇报对象", notProvided: "未填写", taskStatus: "Task状态"
      };
    }
    return {
      headers: ["Group", "Flow", "Step Number", "Task Name", "Report To", "Managed Person", "Deliverable", "DDL", "DDL Week Friday", "Recurrence", "Recurrence Start", "Recurrence End", "Urgency", "Completion Status", "Completion Date", "Overdue", "Progress Note", "Related Documents"],
      overallTitle: "Task Overall Dashboard", exportTime: "Exported At", overallStats: "Overall Statistics",
      totals: ["Total Tasks", "Completed", "Incomplete", "Currently Overdue", "Completion Rate"],
      groupStats: "Group Statistics", groupHeaders: ["Group Name", "Total Tasks", "Completed", "Incomplete", "Overdue", "Completion Rate"],
      flowStats: "Flow Statistics", flowHeaders: ["Group", "Flow Name", "Steps", "Completed", "Incomplete", "Overdue", "Completion Rate"],
      unknownGroup: "Unknown Group", yes: "Yes", no: "No", completed: "Completed", pending: "Incomplete",
      urgency: { high: "High", medium: "Medium", low: "Low" }, recurrence: { none: "Does not repeat", weekly: "Weekly", monthly: "Monthly" },
      sheets: ["Overall Dashboard", "Timeline Dashboard", "Progress History"], workbook: "Worksheets", dashboardTitle: "Weekflow Task Dashboard",
      progressHeaders: ["Group", "Flow", "Task Name", "DDL", "Entry ID", "Progress Content", "Created At", "Last Edited At", "Source", "Source Note ID"],
      reportFilename: "Task_Dashboard_", managed: "Managed_Person", reportTo: "Report_To", notProvided: "Not_Provided", taskStatus: "Task_Status"
    };
  }

  function formatMaterials(materials, options) {
    return (Array.isArray(materials) ? materials : [])
      .map(function (material) {
        return (
          "[" +
          (isEnglish(options)
            ? ({ document: "Documentation", deliverable: "Deliverable", control: "Control Sheet", folder: "Folder" }[material.type] || material.type)
            : materialTools.TYPE_LABELS[material.type] || material.type) +
          "] " +
          material.title +
          (isEnglish(options) ? ": " : "：") +
          material.url
        );
      })
      .join("\n");
  }

  function timelineWeeks(tasks, now) {
    var ddls = [];
    (Array.isArray(tasks) ? tasks : []).forEach(function (task) {
      if (dates.isRecurringTask(task)) {
        dates.getRecurringOccurrences(task).forEach(function (occurrence) {
          ddls.push(occurrence.ddl);
        });
      } else if (dates.parseISODate(task.ddl)) {
        ddls.push(task.ddl);
      }
    });
    if (!ddls.length) return [dates.getWeekFriday(now || new Date())];
    ddls.sort();
    return dates.buildWeekRange(ddls[0], ddls[ddls.length - 1], 600);
  }

  function buildOverallRows(data, now, options) {
    var copy = labels(options);
    var summary = stats.summarize(data.tasks, now);
    var groupRows = stats.summarizeByGroup(data.groups, data.tasks, now);
    var flowRows = stats.summarizeByFlow(data.flows || [], data.groups, data.tasks, now);
    var title = options && options.title ? String(options.title) : copy.overallTitle;
    var rows = [
      [title],
      [copy.exportTime, new Date(now || Date.now()).toLocaleString(isEnglish(options) ? "en-US" : "zh-CN")],
      [],
      [copy.overallStats],
      copy.totals,
      [
        summary.total,
        summary.completed,
        summary.pending,
        summary.overdue,
        summary.completionRate + "%"
      ],
      [],
      [copy.groupStats],
      copy.groupHeaders
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
    rows.push([], [copy.flowStats], copy.flowHeaders);
    flowRows.forEach(function (item) {
      rows.push([
        item.group ? item.group.name : copy.unknownGroup,
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

  function buildTimelineRows(data, now, options) {
    var copy = labels(options);
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
    var rows = [copy.headers.concat(weeks)];
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
        var recurring = dates.isRecurringTask(task);
        var occurrences = recurring
          ? dates.getRecurringOccurrences(task)
          : [{ ddl: task.ddl, periodKey: "" }];
        var occurrencesByFriday = new Map();
        occurrences.forEach(function (occurrence) {
          var friday = dates.getWeekFriday(occurrence.ddl);
          if (!occurrencesByFriday.has(friday)) occurrencesByFriday.set(friday, []);
          occurrencesByFriday.get(friday).push(occurrence);
        });
        var flow = task.flowId ? flowMap.get(task.flowId) : null;
        var row = [
          groupMap.get(task.groupId) ? group.name : copy.unknownGroup,
          flow ? flow.name : "",
          flow ? task.flowOrder || "" : "",
          task.name,
          task.reportTo,
          task.managedObject,
          task.deliverable,
          task.ddl,
          taskFriday,
          copy.recurrence[dates.recurrenceCadence(task)] || copy.recurrence.none,
          recurring ? task.recurrenceStart : "",
          recurring ? task.recurrenceEnd : "",
          copy.urgency[task.urgency] || task.urgency,
          task.status === "completed" ? copy.completed : copy.pending,
          task.completedAt || "",
          dates.isOverdue(task, today) ? copy.yes : copy.no,
          richText.progressCellText(
            task,
            32767,
            isEnglish(options)
              ? "\n… Complete history is available in the Progress History worksheet."
              : "\n……完整内容请查看“进度历史”工作表。"
          ),
          formatMaterials(
            (data.materials || []).filter(function (material) {
              return material.taskIds.includes(task.id);
            }),
            options
          )
        ];
        weeks.forEach(function (friday) {
          row.push(
            (occurrencesByFriday.get(friday) || [])
              .map(function (occurrence) {
                var completed = recurring
                  ? Boolean(dates.getRecurringCompletion(task, occurrence))
                  : task.status === "completed";
                var overdue = !completed && occurrence.ddl < today;
                return (completed ? "✓" : overdue ? "!" : "●") + " " + task.name;
              })
              .join("\n")
          );
        });
        rows.push(row);
        orderedTasks.push(task);
      });
    });
    return { rows: rows, weeks: weeks, tasks: orderedTasks };
  }

  function progressEntriesForExport(task) {
    var entries = richText.sortProgressEntries(task && task.progressEntries);
    if (!entries.length && task && task.progressNote) {
      entries = [
        {
          id: "",
          contentText: task.progressNote,
          sourceType: "legacy",
          sourceNoteId: null,
          createdAt: task.progressUpdatedAt || task.updatedAt || task.createdAt || "",
          updatedAt: task.progressUpdatedAt || task.updatedAt || task.createdAt || ""
        }
      ];
    }
    return entries;
  }

  function buildProgressHistoryRows(data, now, options) {
    var copy = labels(options);
    var groupMap = new Map(
      (data.groups || []).map(function (group) {
        return [group.id, group];
      })
    );
    var flowMap = new Map(
      (data.flows || []).map(function (flow) {
        return [flow.id, flow];
      })
    );
    var taskOrder = buildTimelineRows(data, now, options).tasks;
    var rows = [copy.progressHeaders.slice()];
    taskOrder.forEach(function (task) {
      var group = groupMap.get(task.groupId);
      var flow = task.flowId ? flowMap.get(task.flowId) : null;
      progressEntriesForExport(task).forEach(function (entry) {
        rows.push([
          group ? group.name : copy.unknownGroup,
          flow ? flow.name : "",
          task.name || "",
          task.ddl || "",
          entry.id || "",
          String(entry.contentText || richText.plainText(entry.contentHtml || "")).slice(
            0,
            richText.MAX_PROGRESS_TEXT
          ),
          entry.createdAt || "",
          entry.updatedAt || entry.createdAt || "",
          entry.sourceType || "manual",
          entry.sourceNoteId || ""
        ]);
      });
    });
    return rows;
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

  function overallSheetXml(data, now, options) {
    var rows = buildOverallRows(data, now, options);
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
      '<selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>' +
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
    var options = arguments.length > 2 ? arguments[2] : null;
    var timeline = buildTimelineRows(data, now, options);
    var styles = groupStyleMap(data);
    var today = dates.todayISO(now instanceof Date ? now : new Date());
    var rowXml = timeline.rows
      .map(function (row, rowIndex) {
        var excelRow = rowIndex + 1;
        var task = rowIndex > 0 ? timeline.tasks[rowIndex - 1] : null;
        var overdue = task ? dates.isOverdue(task, today) : false;
        var cells = row.map(function (value, col) {
          var style;
          var dateColumn =
            rowIndex > 0 && [7, 8, 10, 11, 14].includes(col);
          if (rowIndex === 0) style = 2;
          else if (col === 0 && task) style = styles.get(task.groupId) || 1;
          else if (dateColumn) style = overdue ? 8 : 7;
          else style = overdue ? 6 : 1;
          return cellXml(columnName(col) + excelRow, value, style, dateColumn);
        });
        var progressLines = rowIndex > 0
          ? String(row[16] || "").split("\n").length
          : 1;
        var taskHeight = Math.min(120, Math.max(34, 18 + progressLines * 15));
        var height = rowIndex === 0
          ? ' ht="30" customHeight="1"'
          : ' ht="' + taskHeight + '" customHeight="1"';
        return '<row r="' + excelRow + '"' + height + ">" + cells.join("") + "</row>";
      })
      .join("");
    var lastColumn = columnName(timeline.rows[0].length - 1);
    var lastRow = timeline.rows.length;
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
      '<selection activeCell="A1" sqref="A1"/>' +
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

  function progressHistorySheetXml(data, now, options) {
    var rows = buildProgressHistoryRows(data, now, options);
    var rowXml = rows
      .map(function (row, rowIndex) {
        var excelRow = rowIndex + 1;
        var cells = row.map(function (value, columnIndex) {
          var isDate = rowIndex > 0 && columnIndex === 3;
          return cellXml(
            columnName(columnIndex) + excelRow,
            value,
            rowIndex === 0 ? 2 : isDate ? 7 : 1,
            isDate
          );
        });
        var height = rowIndex === 0 ? ' ht="30" customHeight="1"' : ' ht="42" customHeight="1"';
        return '<row r="' + excelRow + '"' + height + ">" + cells.join("") + "</row>";
      })
      .join("");
    var lastColumn = columnName(labels(options).progressHeaders.length - 1);
    var lastRow = Math.max(1, rows.length);
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:' +
      lastColumn +
      lastRow +
      '"/><sheetViews><sheetView workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>' +
      columnsXml([18, 22, 34, 13, 24, 70, 25, 25, 16, 24]) +
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
      '<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
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

  function workbookXml(data, now, options) {
    var copy = labels(options);
    var timeline = buildTimelineRows(data, now, options);
    var lastColumn = columnName(timeline.rows[0].length - 1);
    var lastRow = timeline.rows.length;
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<workbookPr date1904="0"/>' +
      '<bookViews><workbookView visibility="visible" minimized="0" showHorizontalScroll="1" showVerticalScroll="1" showSheetTabs="1" xWindow="120" yWindow="120" windowWidth="24000" windowHeight="15000" tabRatio="600" firstSheet="0" activeTab="0" autoFilterDateGrouping="1"/></bookViews>' +
      '<sheets><sheet name="' + xmlEscape(copy.sheets[0]) + '" sheetId="1" state="visible" r:id="rId1"/><sheet name="' + xmlEscape(copy.sheets[1]) + '" sheetId="2" state="visible" r:id="rId2"/><sheet name="' + xmlEscape(copy.sheets[2]) + '" sheetId="3" state="visible" r:id="rId3"/></sheets>' +
      '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="1" hidden="1">&apos;' +
      xmlEscape(copy.sheets[1]) +
      '&apos;!$A$1:$' +
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
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>' +
      '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>"
    );
  }

  function corePropertiesXml(now, options) {
    var created = (now instanceof Date ? now : new Date()).toISOString();
    var title = options && options.title ? String(options.title) : labels(options).dashboardTitle;
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      "<dc:title>" + xmlEscape(title) + "</dc:title><dc:creator>Wesley Yan</dc:creator>" +
      "<cp:lastModifiedBy>Wesley Yan</cp:lastModifiedBy>" +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' +
      created +
      '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' +
      created +
      "</dcterms:modified></cp:coreProperties>"
    );
  }

  function appPropertiesXml(options) {
    var copy = labels(options);
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
      'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
      "<Application>Weekflow</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop>" +
      '<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>' + xmlEscape(copy.workbook) + '</vt:lpstr></vt:variant>' +
      '<vt:variant><vt:i4>3</vt:i4></vt:variant></vt:vector></HeadingPairs>' +
      '<TitlesOfParts><vt:vector size="3" baseType="lpstr"><vt:lpstr>' + xmlEscape(copy.sheets[0]) + '</vt:lpstr><vt:lpstr>' + xmlEscape(copy.sheets[1]) + '</vt:lpstr><vt:lpstr>' + xmlEscape(copy.sheets[2]) + '</vt:lpstr></vt:vector></TitlesOfParts>' +
      "<Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc>" +
      "<HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0300</AppVersion></Properties>"
    );
  }

  function buildXlsxPackage(data, ZipConstructor, now, outputType, options) {
    if (typeof ZipConstructor !== "function") {
      return Promise.reject(new Error("Excel 压缩组件未加载。"));
    }
    var date = now instanceof Date ? now : new Date();
    var zip = new ZipConstructor();
    zip.file("[Content_Types].xml", contentTypesXml());
    zip.file("_rels/.rels", packageRelationshipsXml());
    zip.file("docProps/core.xml", corePropertiesXml(date, options));
    zip.file("docProps/app.xml", appPropertiesXml(options));
    zip.file("xl/workbook.xml", workbookXml(data, date, options));
    zip.file("xl/_rels/workbook.xml.rels", workbookRelationshipsXml());
    zip.file("xl/styles.xml", styleSheetXml(data));
    zip.file("xl/worksheets/sheet1.xml", overallSheetXml(data, date, options));
    zip.file("xl/worksheets/sheet2.xml", timelineSheetXml(data, date, options));
    zip.file("xl/worksheets/sheet3.xml", progressHistorySheetXml(data, date, options));
    return zip.generateAsync({
      type: outputType || "blob",
      mimeType: XLSX_MIME,
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });
  }

  function exportWorkbook(data, ZipConstructor, now) {
    var date = now instanceof Date ? now : new Date();
    var options = { language: i18n && i18n.getLanguage ? i18n.getLanguage() : "zh-CN" };
    var filename = labels(options).reportFilename + dates.dateTimeStamp(date) + ".xlsx";
    return buildXlsxPackage(data, ZipConstructor, date, "blob", options).then(function (blob) {
      return { filename: filename, blob: blob };
    });
  }

  function buildScopedTaskData(data, field, value) {
    if (!["managedObject", "reportTo"].includes(field)) {
      throw new Error("不支持的人员汇总维度。");
    }
    var expected = String(value || "").trim();
    var tasks = (data.tasks || []).filter(function (task) {
      return String(task[field] || "").trim() === expected;
    });
    var taskIds = new Set(
      tasks.map(function (task) {
        return task.id;
      })
    );
    var groupIds = new Set(
      tasks.map(function (task) {
        return task.groupId;
      })
    );
    var flowIds = new Set(
      tasks
        .map(function (task) {
          return task.flowId;
        })
        .filter(Boolean)
    );
    return {
      version: data.version,
      groups: (data.groups || []).filter(function (group) {
        return groupIds.has(group.id);
      }),
      flows: (data.flows || []).filter(function (flow) {
        return flowIds.has(flow.id);
      }),
      tasks: tasks,
      materials: (data.materials || []).filter(function (material) {
        return (material.taskIds || []).some(function (taskId) {
          return taskIds.has(taskId);
        });
      }),
      updatedAt: data.updatedAt
    };
  }

  function safeFilenamePart(value, options) {
    var copy = labels(options);
    return (
      String(value || copy.notProvided)
        .trim()
        .replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^[._]+|[._]+$/g, "")
        .slice(0, 60) || copy.notProvided
    );
  }

  function taskStatusConfig(config) {
    var source = config || {};
    if (!source.language && i18n && i18n.getLanguage) {
      source = Object.assign({}, source, { language: i18n.getLanguage() });
    }
    var field = source.field;
    if (!["managedObject", "reportTo"].includes(field)) {
      throw new Error("不支持的人员汇总维度。");
    }
    var copy = labels(source);
    var fieldLabel = field === "managedObject" ? copy.managed : copy.reportTo;
    var value = String(source.value || "").trim();
    var label = String(source.label || value || copy.notProvided + "_" + fieldLabel).trim();
    return {
      field: field,
      fieldLabel: fieldLabel,
      value: value,
      label: label,
      title: fieldLabel + (isEnglish(source) ? ": " : "：") + label + (isEnglish(source) ? " · Task Status" : " · Task 状态"),
      language: source.language
    };
  }

  function buildTaskStatusXlsxPackage(
    data,
    ZipConstructor,
    config,
    now,
    outputType
  ) {
    var scope = taskStatusConfig(config);
    var scopedData = buildScopedTaskData(data, scope.field, scope.value);
    if (!scopedData.tasks.length) {
      return Promise.reject(new Error(scope.fieldLabel + "“" + scope.label + "”没有 Task。"));
    }
    return buildXlsxPackage(
      scopedData,
      ZipConstructor,
      now,
      outputType,
      { title: scope.title, language: scope.language }
    );
  }

  function exportTaskStatusWorkbook(data, ZipConstructor, config, now) {
    var date = now instanceof Date ? now : new Date();
    var scope = taskStatusConfig(config);
    var copy = labels(scope);
    var filename =
      scope.fieldLabel +
      "_" +
      safeFilenamePart(scope.label, scope) +
      "_" + copy.taskStatus + "_" +
      dates.dateTimeStamp(date) +
      ".xlsx";
    return buildTaskStatusXlsxPackage(
      data,
      ZipConstructor,
      scope,
      date,
      "blob"
    ).then(function (blob) {
      return { filename: filename, blob: blob, title: scope.title };
    });
  }

  return {
    FIXED_HEADERS: FIXED_HEADERS.slice(),
    formatMaterials: formatMaterials,
    timelineWeeks: timelineWeeks,
    buildOverallRows: buildOverallRows,
    buildTimelineRows: buildTimelineRows,
    buildProgressHistoryRows: buildProgressHistoryRows,
    buildXlsxPackage: buildXlsxPackage,
    exportWorkbook: exportWorkbook,
    buildScopedTaskData: buildScopedTaskData,
    buildTaskStatusXlsxPackage: buildTaskStatusXlsxPackage,
    exportTaskStatusWorkbook: exportTaskStatusWorkbook,
    _test: {
      xmlEscape: xmlEscape,
      columnName: columnName,
      excelSerial: excelSerial,
      workbookXml: workbookXml,
      styleSheetXml: styleSheetXml,
      overallSheetXml: overallSheetXml,
      timelineSheetXml: timelineSheetXml,
      progressHistorySheetXml: progressHistorySheetXml,
      safeFilenamePart: safeFilenamePart
    }
  };
});
