/* 资料库 Excel 导入、校验与导出。 */
import * as XLSX from "xlsx";
import { dateTimeStamp } from "./date-utils";
import { normalizeType, resolveRelations, sortByGroup, TYPE_LABELS } from "./materials";
import { buildWorkbookPackage } from "./xlsx-safe";
import type {
  Flow,
  Group,
  Material,
  MaterialType,
  Task
} from "./types";

export const SHEET_NAME = "资料库导入";
export const MAX_ROWS = 2000;

type MaterialColumnKey =
  | "title"
  | "url"
  | "type"
  | "taskNames"
  | "flowNames"
  | "groupNames"
  | "note";

const COLUMN_DEFS: ReadonlyArray<readonly [MaterialColumnKey, string, boolean]> = [
  ["title", "链接名称*", true],
  ["url", "链接地址*", true],
  ["type", "类型", false],
  ["taskNames", "相关Task", false],
  ["flowNames", "相关Flow", false],
  ["groupNames", "分组", false],
  ["note", "备注", false]
];

/** 与原版导出一致：{ key, header, required } 列表。 */
export const COLUMNS = COLUMN_DEFS.map((column) => ({
  key: column[0],
  header: column[1],
  required: column[2]
}));

export interface ParsedMaterialRow {
  sourceRow: number;
  title: string;
  url: string;
  type: MaterialType;
  taskNames: string[];
  flowNames: string[];
  groupNames: string[];
  note: string;
}

export interface MaterialImportParseResult {
  rows: ParsedMaterialRow[];
  errors: string[];
  sheetName: string;
}

/** 导出所需的数据子集；WeekflowData 可直接传入。 */
export interface MaterialExcelDataInput {
  groups: Group[];
  flows: Flow[];
  tasks: Task[];
  materials: Material[];
}

export interface BuildWorkbookOptions {
  template?: boolean;
}

export interface ExcelFileResult {
  filename: string;
  data: Uint8Array;
}

function cleanText(value: unknown, maxLength?: number): string {
  return String(value === null || value === undefined ? "" : value)
    .trim()
    .slice(0, maxLength || 500);
}

function normalizeHeader(value: unknown): string {
  return cleanText(value, 100)
    .replace(/[＊*]/g, "")
    .replace(/\s+/g, "")
    .toLocaleLowerCase();
}

export function splitNames(value: unknown): string[] {
  const seen = new Set<string>();
  return String(value === null || value === undefined ? "" : value)
    .split(/\r?\n|；|;/)
    .map((part) => {
      return part.trim();
    })
    .filter((part) => {
      const key = part.toLocaleLowerCase();
      if (!part || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function validUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch (_error) {
    return false;
  }
}

function aliases(): Record<string, MaterialColumnKey> {
  const result: Record<string, MaterialColumnKey> = {};
  COLUMN_DEFS.forEach((column) => {
    result[normalizeHeader(column[1])] = column[0];
  });
  const extraAliases: ReadonlyArray<readonly [string, MaterialColumnKey]> = [
    ["名称", "title"],
    ["资料名称", "title"],
    ["地址", "url"],
    ["链接", "url"],
    ["链接类型", "type"],
    ["Task", "taskNames"],
    ["Flow", "flowNames"],
    ["所属分组", "groupNames"],
    ["说明", "note"],
    ["Link Name", "title"],
    ["Document Name", "title"],
    ["Material Name", "title"],
    ["Link URL", "url"],
    ["URL", "url"],
    ["Link Type", "type"],
    ["Related Tasks", "taskNames"],
    ["Related Flows", "flowNames"],
    ["Groups", "groupNames"],
    ["Notes", "note"]
  ];
  extraAliases.forEach((item) => {
    result[normalizeHeader(item[0])] = item[1];
  });
  return result;
}

function matrixFromSheet(sheet: XLSX.WorkSheet | undefined): unknown[][] {
  if (!sheet || !sheet["!ref"]) return [];
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const matrix: unknown[][] = [];
  const lastRow = Math.min(range.e.r, MAX_ROWS + 20);
  const lastColumn = Math.min(range.e.c, 31);
  for (let rowIndex = 0; rowIndex <= lastRow; rowIndex += 1) {
    const row: unknown[] = [];
    for (let columnIndex = 0; columnIndex <= lastColumn; columnIndex += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
      row.push(cell && cell.v !== undefined && cell.v !== null ? cell.v : "");
    }
    matrix.push(row);
  }
  return matrix;
}

function findHeaderRow(matrix: unknown[][]): number {
  const map = aliases();
  for (let index = 0; index < Math.min(matrix.length, 12); index += 1) {
    const found = new Set(
      matrix[index]
        .map((value) => {
          return map[normalizeHeader(value)];
        })
        .filter(Boolean)
    );
    if (found.has("title") && found.has("url")) return index;
  }
  return -1;
}

export function parseWorkbook(
  arrayBuffer: ArrayBuffer | Uint8Array
): MaterialImportParseResult {
  try {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.Sheets[SHEET_NAME]
      ? SHEET_NAME
      : workbook.Sheets["Document Import"]
        ? "Document Import"
        : workbook.Sheets["Materials Import"]
          ? "Materials Import"
          : workbook.SheetNames[0];
    if (!sheetName) return { rows: [], errors: ["Excel 中没有工作表。"], sheetName: "" };
    const matrix = matrixFromSheet(workbook.Sheets[sheetName]);
    const headerRow = findHeaderRow(matrix);
    if (headerRow < 0) {
      return {
        rows: [],
        errors: ["未找到资料库模板表头，请使用下载的 Weekflow 资料库导入模板。"],
        sheetName: sheetName
      };
    }
    const map = aliases();
    const indexes: Partial<Record<MaterialColumnKey, number>> = {};
    matrix[headerRow].forEach((header, index) => {
      const key = map[normalizeHeader(header)];
      if (key && indexes[key] === undefined) indexes[key] = index;
    });
    const sourceRows = matrix
      .slice(headerRow + 1)
      .map((row, index) => {
        return { row: row, sourceRow: headerRow + index + 2 };
      })
      .filter((item) => {
        return item.row.some((cell) => {
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
    const errors: string[] = [];
    const rows = sourceRows.map((item) => {
      const raw: Record<string, unknown> = {};
      COLUMN_DEFS.forEach((column) => {
        const columnIndex = indexes[column[0]];
        raw[column[0]] = columnIndex === undefined ? "" : item.row[columnIndex];
      });
      const title = cleanText(raw.title, 160);
      const url = cleanText(raw.url, 3000);
      const rawType = cleanText(raw.type, 40);
      const type = normalizeType(rawType) || (!rawType ? "document" : "");
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
        type: (type || "document") as MaterialType,
        taskNames: splitNames(raw.taskNames),
        flowNames: splitNames(raw.flowNames),
        groupNames: splitNames(raw.groupNames),
        note: cleanText(raw.note, 2000)
      };
    });
    return { rows: rows, errors: errors, sheetName: sheetName };
  } catch (error) {
    return {
      rows: [],
      errors: ["无法读取 Excel：" + (error instanceof Error ? error.message : String(error))],
      sheetName: ""
    };
  }
}

function taskPath(task: Task, data: MaterialExcelDataInput): string {
  const group = data.groups.find((item) => {
    return item.id === task.groupId;
  });
  const flow = data.flows.find((item) => {
    return item.id === task.flowId;
  });
  return [group && group.name, flow && flow.name, task.name].filter(Boolean).join("/");
}

function flowPath(flow: Flow, data: MaterialExcelDataInput): string {
  const group = data.groups.find((item) => {
    return item.id === flow.groupId;
  });
  return [group && group.name, flow.name].filter(Boolean).join("/");
}

export function buildWorkbook(
  data: MaterialExcelDataInput,
  options?: BuildWorkbookOptions
): XLSX.WorkBook {
  const isTemplate = Boolean(options && options.template);
  const header = COLUMN_DEFS.map((column) => {
    return column[1];
  });
  const rows = sortByGroup(data.materials || [], data).map((material) => {
    const relations = resolveRelations(material, data);
    return [
      material.title,
      material.url,
      TYPE_LABELS[material.type],
      relations.tasks
        .map((task) => {
          return taskPath(task, data);
        })
        .join("\n"),
      relations.flows
        .map((flow) => {
          return flowPath(flow, data);
        })
        .join("\n"),
      relations.groups
        .map((group) => {
          return group.name;
        })
        .join("\n"),
      material.note || ""
    ];
  });
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([header].concat(rows));
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
  rows.forEach((_row, index) => {
    const address = "B" + (index + 2);
    if (sheet[address]) sheet[address].l = { Target: sheet[address].v };
  });
  XLSX.utils.book_append_sheet(
    workbook,
    sheet,
    isTemplate ? SHEET_NAME : "资料库"
  );
  workbook.Props = {
    Title: isTemplate ? "Weekflow 资料库导入模板" : "Weekflow v2.5 资料库",
    Subject: "Weekflow 资料库",
    Author: "Wesley Yan"
  };
  return workbook;
}

export function buildXlsxPackage(
  data: MaterialExcelDataInput,
  outputType: "arraybuffer",
  options?: BuildWorkbookOptions
): Promise<ArrayBuffer>;
export function buildXlsxPackage(
  data: MaterialExcelDataInput,
  outputType?: "uint8array",
  options?: BuildWorkbookOptions
): Promise<Uint8Array>;
export function buildXlsxPackage(
  data: MaterialExcelDataInput,
  outputType: "uint8array" | "arraybuffer" = "uint8array",
  options?: BuildWorkbookOptions
): Promise<Uint8Array | ArrayBuffer> {
  return buildWorkbookPackage(buildWorkbook(data, options), outputType);
}

export function exportWorkbook(
  data: MaterialExcelDataInput,
  filename?: string
): Promise<ExcelFileResult> {
  const outputName =
    filename || "Weekflow_资料库_" + dateTimeStamp(new Date()) + ".xlsx";
  return buildXlsxPackage(data, "uint8array", {}).then((bytes) => {
    return { filename: outputName, data: bytes };
  });
}

export function exportTemplateWorkbook(filename?: string): Promise<ExcelFileResult> {
  const options: BuildWorkbookOptions = { template: true };
  const emptyData: MaterialExcelDataInput = {
    groups: [],
    flows: [],
    tasks: [],
    materials: []
  };
  const outputName = filename || "Weekflow_资料库导入模板.xlsx";
  return buildXlsxPackage(emptyData, "uint8array", options).then((bytes) => {
    return { filename: outputName, data: bytes };
  });
}
