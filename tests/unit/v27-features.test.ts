import { describe, expect, it } from "vitest";
import * as richText from "../../src/shared/rich-text";
import * as taskDrafts from "../../src/shared/task-draft-parser";
import { validateData } from "../../src/shared/schema";
import { filterTasks } from "../../src/shared/stats";

describe("Quick Note Task 草稿本地规则解析", () => {
  const referenceDate = new Date(2026, 7, 15, 10, 0, 0);

  it("把带日期前缀的独立换行识别成多个 Task，并预填相对/绝对 DDL", () => {
    const candidates = taskDrafts.parse(
      "下周二，徽章考题必须kickoff\n下周五，固定资产的徽章考题得写完\n8月25日，无形资产的徽章考题完事",
      { referenceDate }
    );
    expect(candidates).toHaveLength(3);
    expect(candidates.map((item) => item.taskName)).toEqual([
      "徽章考题必须kickoff",
      "固定资产的徽章考题得写完",
      "无形资产的徽章考题完事"
    ]);
    expect(candidates.map((item) => item.ddl)).toEqual([
      "2026-08-18",
      "2026-08-21",
      "2026-08-25"
    ]);
  });

  it("编号行默认拆分，并识别中英文周/月周期表达", () => {
    const numbered = taskDrafts.splitCandidates("1. 准备方案\n2、完成复核\n3 上线交付");
    expect(numbered).toEqual(["准备方案", "完成复核", "上线交付"]);

    const weekly = taskDrafts.parseSingle("每周三完成服务周报", { referenceDate });
    expect(weekly.recurrenceCadence).toBe("weekly");
    expect(weekly.ddl).toBe("2026-08-19");
    expect(weekly.recurrenceStart).toBe("2026-08-19");

    const monthly = taskDrafts.parseSingle("Monthly on the 25th complete asset review", {
      referenceDate
    });
    expect(monthly.recurrenceCadence).toBe("monthly");
    expect(monthly.ddl).toBe("2026-09-25");
  });

  it("忽略 Markdown 标记并保守预填简单交付物、人员与分组", () => {
    const candidate = taskDrafts.parseSingle(
      "- **下周四**：完成汇报材料；分组：服务研发；汇报对象：Lucy；管理对象：Jack",
      {
        referenceDate,
        groups: [{
          id: "g-service", name: "服务研发", color: "#665CFF", order: 0,
          collapsed: false, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z"
        }],
        reportToValues: ["Lucy"],
        managedObjectValues: ["Jack"]
      }
    );
    expect(candidate.taskName).toBe("完成汇报材料");
    expect(candidate.ddl).toBe("2026-08-20");
    expect(candidate.groupId).toBe("g-service");
    expect(candidate.reportTo).toBe("Lucy");
    expect(candidate.managedObject).toBe("Jack");
    expect(candidate.deliverable).toBe("汇报材料");
    expect(candidate.recognizedFields).toEqual(expect.arrayContaining([
      "taskName", "group", "ddl", "reportTo", "managedObject", "deliverable"
    ]));
  });
});

describe("富文本与 data v4 迁移", () => {
  it("保留允许的格式和链接，剔除脚本、事件与危险 URL", () => {
    const safe = richText.sanitizeHtml(
      '<b onclick="alert(1)">加粗</b><script>alert(1)</script><a href="javascript:alert(1)">坏链接</a><i style="color:#DC2626;background-color:#FFF1A8">文本</i>',
      richText.MAX_NOTE_TEXT
    );
    expect(safe).toContain("<b>加粗</b>");
    expect(safe).toContain("color: #DC2626");
    expect(safe).toContain("background-color: #FFF1A8");
    expect(safe).not.toMatch(/script|onclick|javascript:/i);
  });

  it("时间轴搜索会覆盖全部历史进度，而不只搜索最新一条", () => {
    const result = validateData({
      version: 4,
      groups: [{ id: "g1", name: "项目", color: "#665CFF", order: 0 }],
      flows: [],
      tasks: [{
        id: "t1",
        groupId: "g1",
        name: "复核 Task",
        ddl: "2026-08-20",
        urgency: "high",
        reportTo: "Lucy",
        deliverable: "复核记录",
        progressEntries: [
          {
            id: "p1",
            contentHtml: "旧进度关键词",
            contentText: "旧进度关键词",
            sourceType: "manual",
            sourceNoteId: null,
            createdAt: "2026-08-14T02:00:00.000Z",
            updatedAt: "2026-08-14T02:00:00.000Z"
          },
          {
            id: "p2",
            contentHtml: "最新进度",
            contentText: "最新进度",
            sourceType: "manual",
            sourceNoteId: null,
            createdAt: "2026-08-15T02:00:00.000Z",
            updatedAt: "2026-08-15T02:00:00.000Z"
          }
        ]
      }],
      materials: [],
      notes: []
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(filterTasks(result.data.tasks, { search: "旧进度关键词" })).toHaveLength(1);
  });

  it("旧单条进度自动迁移成历史记录，资料库布局偏好进入 JSON data v4", () => {
    const result = validateData({
      version: 3,
      groups: [{ id: "g1", name: "项目", color: "#665CFF", order: 0 }],
      flows: [],
      tasks: [{
        id: "t1",
        groupId: "g1",
        name: "复核 Task",
        ddl: "2026-08-20",
        urgency: "high",
        reportTo: "Lucy",
        deliverable: "复核记录",
        progressNote: "第一次进度",
        progressUpdatedAt: "2026-08-15T02:00:00.000Z"
      }],
      materials: [],
      preferences: { documentLibrary: { layout: "group", columns: 3, groupOrder: ["g1", "__ungrouped__"] } }
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.version).toBe(4);
    expect(result.data.tasks[0].progressEntries).toHaveLength(1);
    expect(result.data.tasks[0].progressEntries[0].contentText).toBe("第一次进度");
    expect(result.data.preferences.documentLibrary).toEqual({
      layout: "group",
      columns: 3,
      groupOrder: ["g1", "__ungrouped__"]
    });
  });
});
