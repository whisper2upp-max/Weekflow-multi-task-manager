/* 使用本地 JSZip 生成带样式、开放视图和精确周时间轴的 OOXML .xlsx 文件。 */
import JSZip from "jszip";
import {
  buildWeekRange,
  dateTimeStamp,
  getRecurringCompletion,
  getRecurringOccurrences,
  getWeekFriday,
  isOverdue,
  isRecurringTask,
  parseISODate,
  recurrenceCadence as taskRecurrenceCadence,
  todayISO
} from "./date-utils";
import {
  sortFlowTasks,
  sortTasks,
  summarize,
  summarizeByFlow,
  summarizeByGroup
} from "./stats";
import { TYPE_LABELS } from "./materials";
import {
  MAX_PROGRESS_TEXT,
  plainText,
  progressCellText,
  sortProgressEntries
} from "./rich-text";
import type {
  Flow,
  Group,
  Material,
  RecurrenceCadence,
  RecurringOccurrence,
  Task,
  Urgency,
  WeekflowData
} from "./types";

const FIXED_HEADERS_LIST = [
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

/** 与原版导出一致：表头数组副本。 */
export const FIXED_HEADERS = FIXED_HEADERS_LIST.slice();

const FIXED_WIDTHS = [
  18, 22, 10, 34, 16, 18, 28, 13, 15, 12, 13, 13, 11, 12, 13, 11, 48, 60
];
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const urgencyLabels: Record<Urgency, string> = {
  high: "高",
  medium: "中",
  low: "低"
};
const recurrenceLabels: Record<RecurrenceCadence, string> = {
  none: "不重复",
  weekly: "每周",
  monthly: "每月"
};

interface ExcelLabels {
  headers: string[];
  overallTitle: string;
  exportTime: string;
  overallStats: string;
  totals: string[];
  groupStats: string;
  groupHeaders: string[];
  flowStats: string;
  flowHeaders: string[];
  unknownGroup: string;
  yes: string;
  no: string;
  completed: string;
  pending: string;
  urgency: Record<Urgency, string>;
  recurrence: Record<RecurrenceCadence, string>;
  sheets: string[];
  workbook: string;
  dashboardTitle: string;
  reportFilename: string;
  managed: string;
  reportTo: string;
  notProvided: string;
  taskStatus: string;
  progressHeaders: string[];
}

const LABELS: ExcelLabels = {
  headers: FIXED_HEADERS_LIST.slice(),
  overallTitle: "Task 整体看板",
  exportTime: "导出时间",
  overallStats: "总体统计",
  totals: ["Task 总数", "已完成数量", "未完成数量", "当前逾期数量", "完成率"],
  groupStats: "分组统计",
  groupHeaders: ["分组名称", "Task 总数", "已完成", "未完成", "逾期", "完成率"],
  flowStats: "Flow 统计",
  flowHeaders: ["所属分组", "Flow 名称", "步骤数", "已完成", "未完成", "逾期", "完成率"],
  unknownGroup: "未知分组",
  yes: "是",
  no: "否",
  completed: "已完成",
  pending: "未完成",
  urgency: urgencyLabels,
  recurrence: recurrenceLabels,
  sheets: ["整体看板", "时间表看板", "进度历史"],
  workbook: "工作表",
  dashboardTitle: "Weekflow Task 看板",
  reportFilename: "Task看板_",
  managed: "管理对象",
  reportTo: "汇报对象",
  notProvided: "未填写",
  taskStatus: "Task状态",
  progressHeaders: ["分组", "Flow", "Task name", "DDL", "记录 ID", "进度内容", "创建时间", "最后编辑时间", "来源", "来源笔记 ID"]
};

/* 英文 labels（逐字沿用原 excel-export.js labels() 的英文分支）。
   语言通过 english 参数显式传入，shared 不读全局语言。 */
const EN_LABELS: ExcelLabels = {
  headers: [
    "Group",
    "Flow",
    "Step Number",
    "Task Name",
    "Report To",
    "Managed Person",
    "Deliverable",
    "DDL",
    "DDL Week Friday",
    "Recurrence",
    "Recurrence Start",
    "Recurrence End",
    "Urgency",
    "Completion Status",
    "Completion Date",
    "Overdue",
    "Progress Note",
    "Related Documents"
  ],
  overallTitle: "Task Overall Dashboard",
  exportTime: "Exported At",
  overallStats: "Overall Statistics",
  totals: ["Total Tasks", "Completed", "Incomplete", "Currently Overdue", "Completion Rate"],
  groupStats: "Group Statistics",
  groupHeaders: ["Group Name", "Total Tasks", "Completed", "Incomplete", "Overdue", "Completion Rate"],
  flowStats: "Flow Statistics",
  flowHeaders: ["Group", "Flow Name", "Steps", "Completed", "Incomplete", "Overdue", "Completion Rate"],
  unknownGroup: "Unknown Group",
  yes: "Yes",
  no: "No",
  completed: "Completed",
  pending: "Incomplete",
  urgency: { high: "High", medium: "Medium", low: "Low" },
  recurrence: { none: "Does not repeat", weekly: "Weekly", monthly: "Monthly" },
  sheets: ["Overall Dashboard", "Timeline Dashboard", "Progress History"],
  workbook: "Worksheets",
  dashboardTitle: "Weekflow Task Dashboard",
  reportFilename: "Task_Dashboard_",
  managed: "Managed_Person",
  reportTo: "Report_To",
  notProvided: "Not_Provided",
  taskStatus: "Task_Status",
  progressHeaders: ["Group", "Flow", "Task Name", "DDL", "Entry ID", "Progress Content", "Created At", "Last Edited At", "Source", "Source Note ID"]
};

function labelsFor(english?: boolean): ExcelLabels {
  return english ? EN_LABELS : LABELS;
}

const EN_MATERIAL_TYPE_LABELS: Record<string, string> = {
  document: "Documentation",
  deliverable: "Deliverable",
  control: "Control Sheet",
  folder: "Folder"
};

export interface ExcelExportOptions {
  title?: string;
  /** true 时使用英文 labels/sheet 名/文件名（等价原版 options.language 为 en 的分支） */
  english?: boolean;
}

export interface ExcelFileResult {
  filename: string;
  data: Uint8Array;
}

export interface TaskStatusFileResult extends ExcelFileResult {
  title: string;
}

export interface TaskStatusScopeConfig {
  field: "managedObject" | "reportTo";
  value?: string;
  label?: string;
}

interface ResolvedTaskStatusScope {
  field: "managedObject" | "reportTo";
  fieldLabel: string;
  value: string;
  label: string;
  title: string;
}

type CellValue = string | number | null | undefined;

export function formatMaterials(materials: Material[], english?: boolean): string {
  return (Array.isArray(materials) ? materials : [])
    .map((material) => {
      return (
        "[" +
        (english
          ? EN_MATERIAL_TYPE_LABELS[material.type] || material.type
          : TYPE_LABELS[material.type] || material.type) +
        "] " +
        material.title +
        (english ? ": " : "：") +
        material.url
      );
    })
    .join("\n");
}

export function timelineWeeks(tasks: Task[], now?: Date): string[] {
  const ddls: string[] = [];
  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    if (isRecurringTask(task)) {
      getRecurringOccurrences(task).forEach((occurrence) => {
        ddls.push(occurrence.ddl);
      });
    } else if (parseISODate(task.ddl)) {
      ddls.push(task.ddl);
    }
  });
  if (!ddls.length) return [getWeekFriday(now || new Date())];
  ddls.sort();
  return buildWeekRange(ddls[0], ddls[ddls.length - 1], 600);
}

export function buildOverallRows(
  data: WeekflowData,
  now?: Date,
  options?: ExcelExportOptions
): CellValue[][] {
  const copy = labelsFor(options && options.english);
  const summary = summarize(data.tasks, now);
  const groupRows = summarizeByGroup(data.groups, data.tasks, now);
  const flowRows = summarizeByFlow(data.flows || [], data.groups, data.tasks, now);
  const title = options && options.title ? String(options.title) : copy.overallTitle;
  const rows: CellValue[][] = [
    [title],
    [
      copy.exportTime,
      new Date(now || Date.now()).toLocaleString(
        options && options.english ? "en-US" : "zh-CN"
      )
    ],
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
  groupRows.forEach((item) => {
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
  flowRows.forEach((item) => {
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

export interface TimelineRows {
  rows: CellValue[][];
  weeks: string[];
  tasks: Task[];
}

export function buildTimelineRows(
  data: WeekflowData,
  now?: Date,
  options?: ExcelExportOptions
): TimelineRows {
  const copy = labelsFor(options && options.english);
  const today = todayISO(now instanceof Date ? now : new Date());
  const weeks = timelineWeeks(data.tasks, now);
  const groupMap = new Map<string, Group>(
    data.groups.map((group) => {
      return [group.id, group];
    })
  );
  const flowMap = new Map<string, Flow>(
    (data.flows || []).map((flow) => {
      return [flow.id, flow];
    })
  );
  const sortedGroups = data.groups.slice().sort((a, b) => {
    return Number(a.order || 0) - Number(b.order || 0);
  });
  const rows: CellValue[][] = [copy.headers.concat(weeks)];
  const orderedTasks: Task[] = [];
  sortedGroups.forEach((group) => {
    const groupSourceTasks = data.tasks.filter((task) => {
      return task.groupId === group.id;
    });
    let groupTasks: Task[] = [];
    (data.flows || [])
      .filter((flow) => {
        return flow.groupId === group.id;
      })
      .sort((left, right) => {
        return Number(left.order || 0) - Number(right.order || 0);
      })
      .forEach((flow) => {
        groupTasks = groupTasks.concat(
          sortFlowTasks(
            groupSourceTasks.filter((task) => {
              return task.flowId === flow.id;
            }),
            today
          )
        );
      });
    groupTasks = groupTasks.concat(
      sortTasks(
        groupSourceTasks.filter((task) => {
          return !task.flowId;
        }),
        today
      )
    );
    groupTasks.forEach((task) => {
      const taskFriday = getWeekFriday(task.ddl);
      const recurring = isRecurringTask(task);
      const occurrences: RecurringOccurrence[] = recurring
        ? getRecurringOccurrences(task)
        : [{ ddl: task.ddl, periodKey: "" }];
      const occurrencesByFriday = new Map<string, RecurringOccurrence[]>();
      occurrences.forEach((occurrence) => {
        const friday = getWeekFriday(occurrence.ddl);
        if (!occurrencesByFriday.has(friday)) occurrencesByFriday.set(friday, []);
        occurrencesByFriday.get(friday)!.push(occurrence);
      });
      const flow = task.flowId ? flowMap.get(task.flowId) : null;
      const row: CellValue[] = [
        groupMap.get(task.groupId) ? group.name : copy.unknownGroup,
        flow ? flow.name : "",
        flow ? task.flowOrder || "" : "",
        task.name,
        task.reportTo,
        task.managedObject,
        task.deliverable,
        task.ddl,
        taskFriday,
        copy.recurrence[taskRecurrenceCadence(task)] || copy.recurrence.none,
        recurring ? task.recurrenceStart : "",
        recurring ? task.recurrenceEnd : "",
        copy.urgency[task.urgency] || task.urgency,
        task.status === "completed" ? copy.completed : copy.pending,
        task.completedAt || "",
        isOverdue(task, today) ? copy.yes : copy.no,
        progressCellText(
          task,
          32767,
          options?.english
            ? "\n… Complete history is available in the Progress History worksheet."
            : "\n……完整内容请查看“进度历史”工作表。"
        ),
        formatMaterials(
          (data.materials || []).filter((material) => {
            return material.taskIds.includes(task.id);
          }),
          options && options.english
        )
      ];
      weeks.forEach((friday) => {
        row.push(
          (occurrencesByFriday.get(friday) || [])
            .map((occurrence) => {
              const completed = recurring
                ? Boolean(getRecurringCompletion(task, occurrence))
                : task.status === "completed";
              const overdue = !completed && occurrence.ddl < today;
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

function progressEntriesForExport(task: Task) {
  const entries = sortProgressEntries(task.progressEntries);
  if (entries.length || !task.progressNote) return entries;
  return [{
    id: "",
    contentHtml: "",
    contentText: task.progressNote,
    sourceType: "legacy" as const,
    sourceNoteId: null,
    createdAt: task.progressUpdatedAt || task.updatedAt || task.createdAt || "",
    updatedAt: task.progressUpdatedAt || task.updatedAt || task.createdAt || ""
  }];
}

export function buildProgressHistoryRows(
  data: WeekflowData,
  now?: Date,
  options?: ExcelExportOptions
): CellValue[][] {
  const copy = labelsFor(options?.english);
  const groupMap = new Map(data.groups.map((group) => [group.id, group] as const));
  const flowMap = new Map(data.flows.map((flow) => [flow.id, flow] as const));
  const rows: CellValue[][] = [copy.progressHeaders.slice()];
  buildTimelineRows(data, now, options).tasks.forEach((task) => {
    const group = groupMap.get(task.groupId);
    const flow = task.flowId ? flowMap.get(task.flowId) : null;
    progressEntriesForExport(task).forEach((entry) => {
      rows.push([
        group?.name || copy.unknownGroup,
        flow?.name || "",
        task.name || "",
        task.ddl || "",
        entry.id || "",
        String(entry.contentText || plainText(entry.contentHtml || "")).slice(0, MAX_PROGRESS_TEXT),
        entry.createdAt || "",
        entry.updatedAt || entry.createdAt || "",
        entry.sourceType || "manual",
        entry.sourceNoteId || ""
      ]);
    });
  });
  return rows;
}

function xmlEscape(value: unknown): string {
  const clean = Array.from(String(value === null || value === undefined ? "" : value))
    .filter((character) => {
      const code = character.codePointAt(0) as number;
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

function columnName(index: number): string {
  let name = "";
  let value = Number(index) + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function excelSerial(dateString: unknown): number | null {
  const date = parseISODate(dateString);
  if (!date) return null;
  return Math.round(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(1899, 11, 30)) /
      86400000
  );
}

function cellXml(
  reference: string,
  value: CellValue,
  styleIndex: number | undefined,
  forceDate?: boolean
): string {
  const style = styleIndex ? ' s="' + styleIndex + '"' : "";
  if (forceDate) {
    const serial = excelSerial(value);
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

function contrastUsesDarkFont(hex: string): boolean {
  const raw = String(hex || "#5368D8").replace("#", "");
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

function groupStyleMap(data: WeekflowData): Map<string, number> {
  const map = new Map<string, number>();
  data.groups.forEach((group, index) => {
    map.set(group.id, 9 + index);
  });
  return map;
}

function styleSheetXml(data: WeekflowData): string {
  const dynamicFills = data.groups
    .map((group) => {
      return (
        '<fill><patternFill patternType="solid"><fgColor rgb="FF' +
        xmlEscape(group.color.replace("#", "").toUpperCase()) +
        '"/><bgColor indexed="64"/></patternFill></fill>'
      );
    })
    .join("");
  const dynamicXfs = data.groups
    .map((group, index) => {
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

function columnsXml(widths: number[]): string {
  return (
    "<cols>" +
    widths
      .map((width, index) => {
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

function overallSheetXml(
  data: WeekflowData,
  now?: Date,
  options?: ExcelExportOptions
): string {
  const rows = buildOverallRows(data, now, options);
  const styles = groupStyleMap(data);
  const sortedGroups = data.groups.slice().sort((a, b) => {
    return Number(a.order || 0) - Number(b.order || 0);
  });
  const flowSummaries = summarizeByFlow(data.flows || [], data.groups, data.tasks, now);
  const groupHeadingRow = 8;
  const groupHeaderRow = 9;
  const groupStartRow = 10;
  const groupEndRow = groupStartRow + sortedGroups.length - 1;
  const flowHeadingRow = groupEndRow + 2;
  const flowHeaderRow = flowHeadingRow + 1;
  const flowStartRow = flowHeaderRow + 1;
  const rowXml = rows
    .map((row, rowIndex) => {
      const excelRow = rowIndex + 1;
      if (!row.length) return '<row r="' + excelRow + '"/>';
      const headingRow =
        excelRow === 1 ||
        excelRow === 4 ||
        excelRow === groupHeadingRow ||
        excelRow === flowHeadingRow;
      const maxColumns = headingRow ? 1 : row.length;
      const cells: string[] = [];
      for (let col = 0; col < maxColumns; col += 1) {
        let style: number | undefined = 1;
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
          const group = sortedGroups[excelRow - groupStartRow];
          style = group ? styles.get(group.id) : 1;
        } else if (excelRow >= flowStartRow && col === 0) {
          const flowSummary = flowSummaries[excelRow - flowStartRow];
          style =
            flowSummary && flowSummary.group
              ? styles.get(flowSummary.group.id) || 1
              : 1;
        }
        cells.push(cellXml(columnName(col) + excelRow, row[col], style));
      }
      const height = excelRow === 1 ? ' ht="28" customHeight="1"' : "";
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

function timelineSheetXml(
  data: WeekflowData,
  now?: Date,
  options?: ExcelExportOptions
): string {
  const timeline = buildTimelineRows(data, now, options);
  const styles = groupStyleMap(data);
  const today = todayISO(now instanceof Date ? now : new Date());
  const rowXml = timeline.rows
    .map((row, rowIndex) => {
      const excelRow = rowIndex + 1;
      const task = rowIndex > 0 ? timeline.tasks[rowIndex - 1] : null;
      const overdue = task ? isOverdue(task, today) : false;
      const cells = row.map((value, col) => {
        let style: number | undefined;
        const dateColumn = rowIndex > 0 && [7, 8, 10, 11, 14].includes(col);
        if (rowIndex === 0) style = 2;
        else if (col === 0 && task) style = styles.get(task.groupId) || 1;
        else if (dateColumn) style = overdue ? 8 : 7;
        else style = overdue ? 6 : 1;
        return cellXml(columnName(col) + excelRow, value, style, dateColumn);
      });
      const progressLines = rowIndex > 0 ? String(row[16] || "").split("\n").length : 1;
      const taskHeight = Math.min(120, Math.max(34, 18 + progressLines * 15));
      const height = rowIndex === 0
        ? ' ht="30" customHeight="1"'
        : ` ht="${taskHeight}" customHeight="1"`;
      return '<row r="' + excelRow + '"' + height + ">" + cells.join("") + "</row>";
    })
    .join("");
  const lastColumn = columnName(timeline.rows[0].length - 1);
  const lastRow = timeline.rows.length;
  const widths = FIXED_WIDTHS.concat(
    timeline.weeks.map(() => {
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

function progressHistorySheetXml(
  data: WeekflowData,
  now?: Date,
  options?: ExcelExportOptions
): string {
  const rows = buildProgressHistoryRows(data, now, options);
  const rowXml = rows.map((row, rowIndex) => {
    const excelRow = rowIndex + 1;
    const cells = row.map((value, columnIndex) => {
      const isDate = rowIndex > 0 && columnIndex === 3;
      return cellXml(
        columnName(columnIndex) + excelRow,
        value,
        rowIndex === 0 ? 2 : isDate ? 7 : 1,
        isDate
      );
    });
    const height = rowIndex === 0 ? ' ht="30" customHeight="1"' : ' ht="42" customHeight="1"';
    return `<row r="${excelRow}"${height}>${cells.join("")}</row>`;
  }).join("");
  const lastColumn = columnName(labelsFor(options?.english).progressHeaders.length - 1);
  const lastRow = Math.max(1, rows.length);
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="A1:${lastColumn}${lastRow}"/>` +
    '<sheetViews><sheetView workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    columnsXml([18, 22, 34, 13, 24, 70, 25, 25, 16, 24]) +
    `<sheetData>${rowXml}</sheetData>` +
    `<autoFilter ref="A1:${lastColumn}${lastRow}"/>` +
    '<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>' +
    '</worksheet>'
  );
}

function contentTypesXml(): string {
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

function packageRelationshipsXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
    "</Relationships>"
  );
}

function workbookXml(
  data: WeekflowData,
  now?: Date,
  options?: ExcelExportOptions
): string {
  const copy = labelsFor(options && options.english);
  const timeline = buildTimelineRows(data, now, options);
  const lastColumn = columnName(timeline.rows[0].length - 1);
  const lastRow = timeline.rows.length;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<workbookPr date1904="0"/>' +
    '<bookViews><workbookView visibility="visible" minimized="0" showHorizontalScroll="1" showVerticalScroll="1" showSheetTabs="1" xWindow="120" yWindow="120" windowWidth="24000" windowHeight="15000" tabRatio="600" firstSheet="0" activeTab="0" autoFilterDateGrouping="1"/></bookViews>' +
    '<sheets><sheet name="' +
    xmlEscape(copy.sheets[0]) +
    '" sheetId="1" state="visible" r:id="rId1"/><sheet name="' +
    xmlEscape(copy.sheets[1]) +
    '" sheetId="2" state="visible" r:id="rId2"/><sheet name="' +
    xmlEscape(copy.sheets[2]) +
    '" sheetId="3" state="visible" r:id="rId3"/></sheets>' +
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

function workbookRelationshipsXml(): string {
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

function corePropertiesXml(now?: Date, options?: ExcelExportOptions): string {
  const created = (now instanceof Date ? now : new Date()).toISOString();
  const title =
    options && options.title
      ? String(options.title)
      : labelsFor(options && options.english).dashboardTitle;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    "<dc:title>" +
    xmlEscape(title) +
    "</dc:title><dc:creator>Wesley Yan</dc:creator>" +
    "<cp:lastModifiedBy>Wesley Yan</cp:lastModifiedBy>" +
    '<dcterms:created xsi:type="dcterms:W3CDTF">' +
    created +
    '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' +
    created +
    "</dcterms:modified></cp:coreProperties>"
  );
}

function appPropertiesXml(options?: ExcelExportOptions): string {
  const copy = labelsFor(options && options.english);
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    "<Application>Weekflow</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop>" +
    '<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>' +
    xmlEscape(copy.workbook) +
    "</vt:lpstr></vt:variant>" +
    '<vt:variant><vt:i4>3</vt:i4></vt:variant></vt:vector></HeadingPairs>' +
    '<TitlesOfParts><vt:vector size="3" baseType="lpstr"><vt:lpstr>' +
    xmlEscape(copy.sheets[0]) +
    "</vt:lpstr><vt:lpstr>" +
    xmlEscape(copy.sheets[1]) +
    "</vt:lpstr><vt:lpstr>" +
    xmlEscape(copy.sheets[2]) +
    "</vt:lpstr></vt:vector></TitlesOfParts>" +
    "<Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc>" +
    "<HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0300</AppVersion></Properties>"
  );
}

export function buildXlsxPackage(
  data: WeekflowData,
  now: Date | undefined,
  outputType: "arraybuffer",
  options?: ExcelExportOptions
): Promise<ArrayBuffer>;
export function buildXlsxPackage(
  data: WeekflowData,
  now?: Date,
  outputType?: "uint8array",
  options?: ExcelExportOptions
): Promise<Uint8Array>;
export function buildXlsxPackage(
  data: WeekflowData,
  now: Date | undefined,
  outputType: "uint8array" | "arraybuffer",
  options?: ExcelExportOptions
): Promise<Uint8Array | ArrayBuffer>;
export function buildXlsxPackage(
  data: WeekflowData,
  now?: Date,
  outputType: "uint8array" | "arraybuffer" = "uint8array",
  options?: ExcelExportOptions
): Promise<Uint8Array | ArrayBuffer> {
  const date = now instanceof Date ? now : new Date();
  const zip = new JSZip();
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
    type: outputType,
    mimeType: XLSX_MIME,
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });
}

export function exportWorkbook(
  data: WeekflowData,
  now?: Date,
  english?: boolean
): Promise<ExcelFileResult> {
  const date = now instanceof Date ? now : new Date();
  const filename = labelsFor(english).reportFilename + dateTimeStamp(date) + ".xlsx";
  return buildXlsxPackage(data, date, "uint8array", { english: Boolean(english) }).then(
    (bytes) => {
      return { filename: filename, data: bytes };
    }
  );
}

export function buildScopedTaskData(
  data: WeekflowData,
  field: "managedObject" | "reportTo",
  value: string
): WeekflowData {
  if (!["managedObject", "reportTo"].includes(field)) {
    throw new Error("不支持的人员汇总维度。");
  }
  const expected = String(value || "").trim();
  const tasks = (data.tasks || []).filter((task) => {
    return String(task[field] || "").trim() === expected;
  });
  const taskIds = new Set(
    tasks.map((task) => {
      return task.id;
    })
  );
  const groupIds = new Set(
    tasks.map((task) => {
      return task.groupId;
    })
  );
  const flowIds = new Set(
    tasks
      .map((task) => {
        return task.flowId;
      })
      .filter((flowId): flowId is string => Boolean(flowId))
  );
  return {
    version: data.version,
    groups: (data.groups || []).filter((group) => {
      return groupIds.has(group.id);
    }),
    flows: (data.flows || []).filter((flow) => {
      return flowIds.has(flow.id);
    }),
    tasks: tasks,
    materials: (data.materials || []).filter((material) => {
      return (material.taskIds || []).some((taskId) => {
        return taskIds.has(taskId);
      });
    }),
    notes: [],
    preferences: data.preferences,
    updatedAt: data.updatedAt
  };
}

function safeFilenamePart(value: unknown, english?: boolean): string {
  const copy = labelsFor(english);
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

function taskStatusConfig(
  config: TaskStatusScopeConfig,
  english?: boolean
): ResolvedTaskStatusScope {
  const source = config || ({} as TaskStatusScopeConfig);
  const field = source.field;
  if (!["managedObject", "reportTo"].includes(field)) {
    throw new Error("不支持的人员汇总维度。");
  }
  const copy = labelsFor(english);
  const fieldLabel = field === "managedObject" ? copy.managed : copy.reportTo;
  const value = String(source.value || "").trim();
  const label = String(
    source.label || value || copy.notProvided + "_" + fieldLabel
  ).trim();
  return {
    field: field,
    fieldLabel: fieldLabel,
    value: value,
    label: label,
    title:
      fieldLabel +
      (english ? ": " : "：") +
      label +
      (english ? " · Task Status" : " · Task 状态")
  };
}

export function buildTaskStatusXlsxPackage(
  data: WeekflowData,
  config: TaskStatusScopeConfig,
  now: Date | undefined,
  outputType: "arraybuffer",
  english?: boolean
): Promise<ArrayBuffer>;
export function buildTaskStatusXlsxPackage(
  data: WeekflowData,
  config: TaskStatusScopeConfig,
  now?: Date,
  outputType?: "uint8array",
  english?: boolean
): Promise<Uint8Array>;
export function buildTaskStatusXlsxPackage(
  data: WeekflowData,
  config: TaskStatusScopeConfig,
  now?: Date,
  outputType: "uint8array" | "arraybuffer" = "uint8array",
  english?: boolean
): Promise<Uint8Array | ArrayBuffer> {
  const scope = taskStatusConfig(config, english);
  const scopedData = buildScopedTaskData(data, scope.field, scope.value);
  if (!scopedData.tasks.length) {
    return Promise.reject(
      new Error(scope.fieldLabel + "“" + scope.label + "”没有 Task。")
    );
  }
  return buildXlsxPackage(scopedData, now, outputType, {
    title: scope.title,
    english: Boolean(english)
  });
}

export function exportTaskStatusWorkbook(
  data: WeekflowData,
  config: TaskStatusScopeConfig,
  now?: Date,
  english?: boolean
): Promise<TaskStatusFileResult> {
  const date = now instanceof Date ? now : new Date();
  const scope = taskStatusConfig(config, english);
  const copy = labelsFor(english);
  const filename =
    scope.fieldLabel +
    "_" +
    safeFilenamePart(scope.label, english) +
    "_" +
    copy.taskStatus +
    "_" +
    dateTimeStamp(date) +
    ".xlsx";
  return buildTaskStatusXlsxPackage(data, scope, date, "uint8array", english).then((bytes) => {
    return { filename: filename, data: bytes, title: scope.title };
  });
}

export const _test = {
  xmlEscape: xmlEscape,
  columnName: columnName,
  excelSerial: excelSerial,
  workbookXml: workbookXml,
  styleSheetXml: styleSheetXml,
  overallSheetXml: overallSheetXml,
  timelineSheetXml: timelineSheetXml,
  safeFilenamePart: safeFilenamePart
};
