import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import type { Task, WeekflowData } from "../../src/shared/types";
import {
  exportTemplateWorkbook as exportTaskTemplate,
  exportWorkbook as exportTaskWorkbook,
  parseWorkbook as parseTaskWorkbook
} from "../../src/shared/excel-import";
import {
  exportTaskStatusWorkbook,
  exportWorkbook as exportDashboardWorkbook
} from "../../src/shared/excel-export";
import {
  exportTemplateWorkbook as exportMaterialTemplate,
  parseWorkbook as parseMaterialWorkbook
} from "../../src/shared/material-excel";

const TASK_HEADERS = [
  "分组*",
  "分组颜色",
  "Flow",
  "Flow颜色",
  "Flow步骤",
  "Task name*",
  "DDL*",
  "周期",
  "周期开始",
  "周期结束",
  "周期完成记录",
  "紧急程度*",
  "完成状态",
  "完成日期",
  "汇报对象*",
  "管理对象",
  "交付物*",
  "进度记录",
  "说明文档链接",
  "交付物链接"
];

const MATERIAL_HEADERS = ["链接名称*", "链接地址*", "类型", "相关Task", "相关Flow", "分组", "备注"];

function workbookBuffer(sheetName: string, aoa: unknown[][]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), sheetName);
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function taskWorkbookBuffer(dataRows: unknown[][]): ArrayBuffer {
  return workbookBuffer("Task导入", [
    ["Weekflow Task 导入模板"],
    ["每行填写 1 条 Task。"],
    ["带 * 为必填列"],
    TASK_HEADERS,
    ...dataRows
  ]);
}

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "task_1",
    groupId: "group_1",
    flowId: null,
    flowOrder: null,
    name: "完成发布前检查",
    reportTo: "Wesley Yan",
    managedObject: "Amy Chen",
    deliverable: "发布确认单",
    ddl: "2026-08-07",
    urgency: "high",
    status: "pending",
    completedAt: null,
    progressNote: "",
    progressUpdatedAt: null,
    recurrenceCadence: "none",
    recurrenceStart: null,
    recurrenceEnd: null,
    recurrenceCompletions: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides
  };
}

function sampleData(): WeekflowData {
  return {
    version: 3,
    groups: [
      {
        id: "group_1",
        name: "产品与项目",
        color: "#665CFF",
        order: 0,
        collapsed: false,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z"
      }
    ],
    flows: [],
    tasks: [makeTask({})],
    materials: [
      {
        id: "material_1",
        title: "操作说明",
        url: "https://example.com/guide",
        type: "document",
        taskIds: ["task_1"],
        flowIds: [],
        groupIds: [],
        note: "",
        openEvents: [],
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z"
      }
    ],
    updatedAt: "2026-08-01T00:00:00.000Z"
  };
}

describe("excel-import parseWorkbook", () => {
  it("合法任务工作簿解析无错误，字段逐列归一", () => {
    const buffer = taskWorkbookBuffer([
      [
        "产品与项目",
        "#665CFF",
        "",
        "",
        "",
        "完成发布前检查",
        "2026-08-07",
        "",
        "",
        "",
        "",
        "高",
        "未完成",
        "",
        "Wesley Yan",
        "Amy Chen",
        "发布确认单",
        "已完成联调",
        "操作说明|https://example.com/guide",
        "交付文件|https://example.com/delivery"
      ]
    ]);
    const result = parseTaskWorkbook(buffer);
    expect(result.errors).toEqual([]);
    expect(result.sheetName).toBe("Task导入");
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.taskName).toBe("完成发布前检查");
    expect(row.groupName).toBe("产品与项目");
    expect(row.ddl).toBe("2026-08-07");
    expect(row.urgency).toBe("high");
    expect(row.status).toBe("pending");
    expect(row.recurrenceCadence).toBe("none");
    expect(row.documentLinks).toEqual([
      { title: "操作说明", url: "https://example.com/guide" }
    ]);
  });

  it("缺必填列/非法值给出逐字中文错误（含行号）", () => {
    const buffer = taskWorkbookBuffer([
      ["", "", "", "", "", "", "not-a-date", "", "", "", "", "", "", "", "", "", "", "", "", ""]
    ]);
    const result = parseTaskWorkbook(buffer);
    expect(result.errors).toContain("第 5 行：分组不能为空");
    expect(result.errors).toContain("第 5 行：Task name 不能为空");
    expect(result.errors).toContain("第 5 行：DDL 必须是有效日期");
    expect(result.errors).toContain("第 5 行：紧急程度不能为空");
    expect(result.errors).toContain("第 5 行：汇报对象不能为空");
    expect(result.errors).toContain("第 5 行：交付物不能为空");
  });

  it("周期 Task 缺起止日期报交叉规则错误", () => {
    const buffer = taskWorkbookBuffer([
      [
        "产品与项目", "", "", "", "", "周期任务", "2026-08-07",
        "每周", "", "", "", "中", "", "", "Wesley Yan", "", "交付物", "", "", ""
      ]
    ]);
    const result = parseTaskWorkbook(buffer);
    expect(result.errors).toContain("第 5 行：周期 Task 必须填写周期开始");
    expect(result.errors).toContain("第 5 行：周期 Task 必须填写周期结束");
  });

  it("找不到模板表头时返回固定文案", () => {
    const buffer = workbookBuffer("Task导入", [["a", "b", "c"]]);
    const result = parseTaskWorkbook(buffer);
    expect(result.errors).toEqual(["未找到模板表头，请使用下载的 Weekflow Task 导入模板。"]);
  });
});

describe("excel-import 导出（SheetJS + xlsx-safe 打包）", () => {
  it("当前数据导出文件名带时间戳，且可回导无错误", async () => {
    const result = await exportTaskWorkbook(sampleData());
    expect(result.filename).toMatch(/^Weekflow_Task当前数据_\d{8}_\d{4}\.xlsx$/);
    expect(result.data).toBeInstanceOf(Uint8Array);
    const parsed = parseTaskWorkbook(result.data);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].taskName).toBe("完成发布前检查");
    expect(parsed.rows[0].documentLinks[0].url).toBe("https://example.com/guide");
  });

  it("空白模板文件名固定，解析后无数据行", async () => {
    const result = await exportTaskTemplate();
    expect(result.filename).toBe("Weekflow_Task导入模板.xlsx");
    const parsed = parseTaskWorkbook(result.data);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual([]);
  });
});

describe("material-excel parseWorkbook", () => {
  it("合法资料行解析无错误", () => {
    const buffer = workbookBuffer("资料库导入", [
      MATERIAL_HEADERS,
      ["操作说明", "https://example.com/guide", "说明文档", "产品与项目/完成发布前检查", "", "产品与项目", "备注"]
    ]);
    const result = parseMaterialWorkbook(buffer);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].type).toBe("document");
    expect(result.rows[0].taskNames).toEqual(["产品与项目/完成发布前检查"]);
  });

  it("缺地址/非法地址/非法类型给出逐字中文错误", () => {
    const buffer = workbookBuffer("资料库导入", [
      MATERIAL_HEADERS,
      ["只有名字", "", "", "", "", "", ""],
      ["坏链接", "ftp://example.com/x", "", "", "", "", ""],
      ["坏类型", "https://example.com", "其他", "", "", "", ""]
    ]);
    const result = parseMaterialWorkbook(buffer);
    expect(result.errors).toContain("第 2 行：链接地址不能为空");
    expect(result.errors).toContain("第 3 行：链接地址必须是 HTTP/HTTPS URL");
    expect(result.errors).toContain("第 4 行：类型仅支持说明文档、交付物、控制表、文件夹");
  });

  it("资料库模板导出文件名固定", async () => {
    const result = await exportMaterialTemplate();
    expect(result.filename).toBe("Weekflow_资料库导入模板.xlsx");
    expect(result.data).toBeInstanceOf(Uint8Array);
  });
});

describe("excel-export 看板报告（手写 OOXML + JSZip）", () => {
  const now = new Date(2026, 7, 12, 10, 30);

  it("导出 Task看板 文件，包结构与署名正确", async () => {
    const result = await exportDashboardWorkbook(sampleData(), now);
    expect(result.filename).toBe("Task看板_20260812_1030.xlsx");
    expect(result.data).toBeInstanceOf(Uint8Array);
    const zip = await JSZip.loadAsync(result.data);
    expect(zip.file("xl/worksheets/sheet1.xml")).toBeTruthy();
    expect(zip.file("xl/worksheets/sheet2.xml")).toBeTruthy();
    const core = await zip.file("docProps/core.xml")!.async("string");
    expect(core).toContain("<dc:creator>Wesley Yan</dc:creator>");
    const workbookXml = await zip.file("xl/workbook.xml")!.async("string");
    expect(workbookXml).toContain("整体看板");
    expect(workbookXml).toContain("时间表看板");
    expect(workbookXml).toContain("_xlnm._FilterDatabase");
    const sheet2 = await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    expect(sheet2).toContain("完成发布前检查");
  });

  it("按汇报对象导出人员 Task 状态，文件名含维度与姓名", async () => {
    const result = await exportTaskStatusWorkbook(
      sampleData(),
      { field: "reportTo", value: "Wesley Yan", label: "Wesley Yan" },
      now
    );
    expect(result.filename).toBe("汇报对象_Wesley_Yan_Task状态_20260812_1030.xlsx");
    expect(result.title).toBe("汇报对象：Wesley Yan · Task 状态");
  });

  it("无匹配人员时按原版文案拒绝", async () => {
    await expect(
      exportTaskStatusWorkbook(
        sampleData(),
        { field: "managedObject", value: "不存在的人" },
        now
      )
    ).rejects.toThrow("管理对象“不存在的人”没有 Task。");
  });
});
