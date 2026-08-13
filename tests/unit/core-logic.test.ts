import { describe, expect, it } from "vitest";
import type { Task } from "../../src/shared/types";
import {
  buildWeekRange,
  getRecurringOccurrences,
  getWeekFriday
} from "../../src/shared/date-utils";
import { normalizeCompletions } from "../../src/shared/automation";
import { validateData } from "../../src/shared/schema";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "task_1",
    groupId: "group_1",
    flowId: null,
    flowOrder: null,
    name: "任务",
    reportTo: "上级",
    managedObject: "",
    deliverable: "交付物",
    ddl: "2024-01-03",
    urgency: "medium",
    status: "pending",
    completedAt: null,
    progressNote: "",
    progressUpdatedAt: null,
    recurrenceCadence: "none",
    recurrenceStart: null,
    recurrenceEnd: null,
    recurrenceCompletions: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("date-utils getWeekFriday（周列锚点=周五）", () => {
  it("周内任意一天都归一到同周周五", () => {
    // 2024-01-01 是周一
    expect(getWeekFriday("2024-01-01")).toBe("2024-01-05");
    expect(getWeekFriday("2024-01-03")).toBe("2024-01-05");
    expect(getWeekFriday("2024-01-07")).toBe("2024-01-05"); // 周日仍属本周
    expect(getWeekFriday("2024-01-08")).toBe("2024-01-12"); // 下周一进下一周
    expect(getWeekFriday("bad")).toBe("");
  });
});

describe("date-utils buildWeekRange", () => {
  it("按周五锚点展开周列，起止倒置自动交换", () => {
    expect(buildWeekRange("2024-01-01", "2024-01-20")).toEqual([
      "2024-01-05",
      "2024-01-12",
      "2024-01-19"
    ]);
    expect(buildWeekRange("2024-01-20", "2024-01-01")).toEqual([
      "2024-01-05",
      "2024-01-12",
      "2024-01-19"
    ]);
    expect(buildWeekRange("", "2024-01-20")).toEqual([]);
  });
});

describe("date-utils getRecurringOccurrences", () => {
  it("weekly：从周期开始日起按锚定星期步进，periodKey 为该周周一", () => {
    const task = makeTask({
      ddl: "2024-01-03", // 周三
      recurrenceCadence: "weekly",
      recurrenceStart: "2024-01-01",
      recurrenceEnd: "2024-01-31"
    });
    const occurrences = getRecurringOccurrences(task);
    expect(occurrences.map((o) => o.ddl)).toEqual([
      "2024-01-03",
      "2024-01-10",
      "2024-01-17",
      "2024-01-24",
      "2024-01-31"
    ]);
    expect(occurrences.map((o) => o.periodKey)).toEqual([
      "2024-01-01",
      "2024-01-08",
      "2024-01-15",
      "2024-01-22",
      "2024-01-29"
    ]);
  });

  it("monthly：短月取月末，periodKey 为 YYYY-MM", () => {
    const task = makeTask({
      ddl: "2024-01-31",
      recurrenceCadence: "monthly",
      recurrenceStart: "2024-01-15",
      recurrenceEnd: "2024-04-30"
    });
    const occurrences = getRecurringOccurrences(task);
    expect(occurrences.map((o) => o.ddl)).toEqual([
      "2024-01-31",
      "2024-02-29", // 2024 闰年 2 月月末
      "2024-03-31",
      "2024-04-30"
    ]);
    expect(occurrences.map((o) => o.periodKey)).toEqual([
      "2024-01",
      "2024-02",
      "2024-03",
      "2024-04"
    ]);
  });
});

describe("automation normalizeCompletions（连续前缀补齐）", () => {
  it("较晚一期完成 = 此前各期全部完成；无效与间断记录被修复", () => {
    const task = makeTask({
      ddl: "2024-01-03",
      recurrenceCadence: "weekly",
      recurrenceStart: "2024-01-01",
      recurrenceEnd: "2024-01-31",
      recurrenceCompletions: [
        { periodKey: "2024-01-15", occurrenceDdl: "2024-01-17", completedAt: "2024-01-18" },
        // 不存在于周期内的记录应被丢弃
        { periodKey: "2024-02-05", occurrenceDdl: "2024-02-07", completedAt: "2024-02-07" }
      ]
    });
    const normalized = normalizeCompletions(task);
    expect(normalized.map((r) => r.periodKey)).toEqual([
      "2024-01-01",
      "2024-01-08",
      "2024-01-15"
    ]);
    // 前两期为补齐记录：occurrenceDdl 取各期 DDL，completedAt 沿用最晚一期的完成日期
    expect(normalized[0]).toEqual({
      periodKey: "2024-01-01",
      occurrenceDdl: "2024-01-03",
      completedAt: "2024-01-18"
    });
    expect(normalized[1]).toEqual({
      periodKey: "2024-01-08",
      occurrenceDdl: "2024-01-10",
      completedAt: "2024-01-18"
    });
    expect(normalized[2]).toEqual({
      periodKey: "2024-01-15",
      occurrenceDdl: "2024-01-17",
      completedAt: "2024-01-18"
    });
  });
});

describe("schema validateData", () => {
  it("拒绝非对象根节点与不支持的版本，错误文案与原版一致", () => {
    const notObject = validateData([1, 2, 3]);
    expect(notObject.ok).toBe(false);
    if (!notObject.ok) expect(notObject.errors).toEqual(["备份根节点必须是对象。"]);

    const badVersion = validateData({ version: 4, groups: [], tasks: [], flows: [] });
    expect(badVersion.ok).toBe(false);
    if (!badVersion.ok) expect(badVersion.errors).toContain("不支持的数据版本：4。");

    const empty = validateData({
      version: 3,
      groups: [],
      tasks: [],
      flows: [],
      materials: []
    });
    expect(empty.ok).toBe(true);
    if (empty.ok) expect(empty.data.version).toBe(3);
  });

  it("v1 → v3 迁移：documentLinks 变资料库、颜色大写化、过渡字段被删除", () => {
    const result = validateData({
      version: 1,
      groups: [{ id: "g1", name: "分组", color: "#665cff", order: 1 }],
      tasks: [
        {
          id: "t1",
          groupId: "g1",
          name: "任务",
          ddl: "2024-01-05",
          documentLinks: [{ id: "l1", title: "文档", url: "https://example.com/doc" }],
          deliverableLinks: []
        }
      ],
      updatedAt: "2024-01-01T00:00:00.000Z"
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.version).toBe(3);
    expect(result.data.groups[0].color).toBe("#665CFF");
    expect(result.data.materials).toHaveLength(1);
    expect(result.data.materials[0].type).toBe("document");
    expect(result.data.materials[0].taskIds).toEqual(["t1"]);
    expect("documentLinks" in result.data.tasks[0]).toBe(false);
    expect("deliverableLinks" in result.data.tasks[0]).toBe(false);
  });
});
