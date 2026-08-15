/* i18n 运行时翻译引擎单测：字典命中、参数化正则、第 N 行递归、兜底逐词替换、
   normalizeLanguage 默认值。语言切换在 node 环境下不持久化/不 reload（有守卫）。 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  getLanguage,
  isEnglish,
  normalizeLanguage,
  setLanguage,
  translateCompositeText,
  translateMessage,
  translateText
} from "../../src/renderer/lib/i18n";

beforeEach(() => {
  setLanguage("zh-CN");
});

describe("normalizeLanguage / 语言状态", () => {
  it("默认与未知值一律回退 zh-CN", () => {
    expect(normalizeLanguage(null)).toBe("zh-CN");
    expect(normalizeLanguage(undefined)).toBe("zh-CN");
    expect(normalizeLanguage("")).toBe("zh-CN");
    expect(normalizeLanguage("fr-FR")).toBe("zh-CN");
  });

  it("zh* → zh-CN，en* → en", () => {
    expect(normalizeLanguage("zh")).toBe("zh-CN");
    expect(normalizeLanguage("zh-CN")).toBe("zh-CN");
    expect(normalizeLanguage("zh-TW")).toBe("zh-CN");
    expect(normalizeLanguage("en")).toBe("en");
    expect(normalizeLanguage("en-US")).toBe("en");
    expect(normalizeLanguage("EN")).toBe("en");
  });

  it("setLanguage 更新会话内语言（node 环境无 localStorage/reload 也安全）", () => {
    expect(getLanguage()).toBe("zh-CN");
    setLanguage("en");
    expect(getLanguage()).toBe("en");
    expect(isEnglish()).toBe(true);
    setLanguage("zh-CN");
    expect(isEnglish()).toBe(false);
  });
});

describe("translateText（字典 + 数字句式）", () => {
  it("中文模式原样返回", () => {
    expect(translateText("主页")).toBe("主页");
    expect(translateText("5 条可见 Task")).toBe("5 条可见 Task");
  });

  it("英文模式字典精确命中，保留首尾空白", () => {
    setLanguage("en");
    expect(translateText("主页")).toBe("Home");
    expect(translateText("时间轴看板")).toBe("Timeline");
    expect(translateText(" 未完成")).toBe(" Incomplete");
    expect(translateText("新建 Task")).toBe("New Task");
  });

  it("数字句式正则", () => {
    setLanguage("en");
    expect(translateText("5 条可见 Task")).toBe("5 visible Tasks");
    expect(translateText("共 12 条资料")).toBe("12 documents");
    expect(translateText("已选 3 条")).toBe("3 selected");
    expect(translateText("4 个步骤")).toBe("4 steps");
    expect(translateText("2 个")).toBe("2");
    expect(translateText("显示 3 / 10 条资料")).toBe("Showing 3 of 10 documents");
    expect(translateText("逾期 2")).toBe("Overdue 2");
    expect(translateText("✓ 完成 4")).toBe("✓ Completed 4");
    expect(translateText("3 天后")).toBe("in 3 days");
    expect(translateText("另有 6 条未显示")).toBe("6 more not shown");
  });

  it("v2.6 / v2.7 新功能的静态文案", () => {
    setLanguage("en");
    expect(translateText("随手记")).toBe("Quick Notes");
    expect(translateText("保存笔记")).toBe("Save Note");
    expect(translateText("添加到进度记录")).toBe("Add to Progress History");
    expect(translateText("调整分组布局")).toBe("Arrange Group Layout");
    expect(translateText("前往")).toBe("Go to");
  });

  it("未命中原样返回", () => {
    setLanguage("en");
    expect(translateText("随便一句不在字典里的话")).toBe("随便一句不在字典里的话");
  });
});

describe("translateMessage（toast/confirm/校验错误）", () => {
  it("「第 N 行：」前缀递归翻译", () => {
    setLanguage("en");
    expect(translateMessage("第 3 行：分组不能为空")).toBe("Row 3: Group is required");
    expect(translateMessage("第 5 行：Task name 不能为空")).toBe("Row 5: Task Name is required");
    expect(translateMessage("第 2 行：链接地址与第 1 行重复")).toBe(
      "Row 2: Link URL duplicates row 1"
    );
  });

  it("参数化 confirm 句式", () => {
    setLanguage("en");
    expect(translateMessage("确认删除 Task「发布检查」？此操作不可恢复。")).toBe(
      "Delete Task “发布检查”? This action cannot be undone."
    );
    expect(translateMessage("确认删除 Flow「上线」？其中 3 条 Task 会保留在原分组并取消 Flow 归属。")).toBe(
      "Delete Flow “上线”? Its 3 Tasks will remain in their current Group without a Flow."
    );
    expect(
      translateMessage("确认用该备份替换当前数据？将导入 2 个分组和 5 条 Task、4 条资料。")
    ).toBe("Replace the current data with this backup? It contains 2 Groups, 5 Tasks, and 4 documents.");
  });

  it("参数化 toast 句式", () => {
    setLanguage("en");
    expect(translateMessage("已补充导入 7 条 Task")).toBe("7 Tasks imported");
    expect(translateMessage("已完整覆盖时间轴，共导入 9 条 Task")).toBe(
      "Timeline completely replaced with 9 imported Tasks"
    );
    expect(translateMessage("资料导入完成：新增 2 条，替换 1 条，跳过 3 条")).toBe(
      "Document import completed: 2 added, 1 replaced, 3 skipped"
    );
    expect(translateMessage("看板报告已导出：Task_Dashboard_20260812_1030.xlsx")).toBe(
      "Dashboard report exported: Task_Dashboard_20260812_1030.xlsx"
    );
    expect(translateMessage("JSON 备份已导出：Weekflow_Data_Backup_20260812_1030.json")).toBe(
      "JSON backup exported: Weekflow_Data_Backup_20260812_1030.json"
    );
    expect(translateMessage("数据已从 JSON 恢复")).toBe("Data restored from JSON");
  });

  it("兜底逐词替换（与原版一致的粗放行为）", () => {
    setLanguage("en");
    expect(translateMessage("资料已导出")).toBe("document已export");
  });

  it("中文模式原样返回", () => {
    expect(translateMessage("第 3 行：分组不能为空")).toBe("第 3 行：分组不能为空");
  });
});

describe("translateCompositeText（observer 的 DOM 文本入口）", () => {
  it("整句命中与长尾替换", () => {
    setLanguage("en");
    expect(translateCompositeText("先建立第一个分组")).toBe("Create Your First Group");
    expect(translateCompositeText("3 个分组 · 2 个 Flow")).toBe("3 Groups · 2 Flows");
    expect(translateCompositeText("2026 · 周五")).toBe("2026 · Friday");
    expect(translateCompositeText("2026-08-10 — 2026-08-16 · 1 周")).toBe(
      "2026-08-10 — 2026-08-16 · 1 weeks"
    );
    expect(translateCompositeText("进度（1）")).toBe("Progress (1)");
    expect(translateCompositeText("资料（0）")).toBe("Documents (0)");
  });

  it("桌面版新增替换", () => {
    setLanguage("en");
    expect(translateCompositeText("2026-08-10 — 2026-08-16 · 周一至周日")).toBe(
      "2026-08-10 — 2026-08-16 · Monday to Sunday"
    );
    expect(translateCompositeText("任务.xlsx · 工作表：Task导入")).toBe("任务.xlsx · Sheet: Task导入");
    expect(translateCompositeText("关键词：发布")).toBe("Keyword: 发布");
    expect(translateCompositeText("Flow：未加入")).toBe("Flow: No Flow");
    expect(translateCompositeText("另有 3 条 Task，将在确认后一起导入")).toBe(
      "3 additional Tasks will be imported after confirmation"
    );
    expect(translateCompositeText("8 条笔记")).toBe("8 notes");
    expect(translateCompositeText("识别到 3 个潜在 Task，正在编辑第 2 个")).toBe(
      "Detected 3 potential Tasks · Editing 2"
    );
    expect(translateCompositeText("1 个待处理 · 1 个已保存 · 1 个已跳过")).toBe(
      "1 pending · 1 saved · 1 skipped"
    );
    expect(translateCompositeText("已完成一次性转换：2 条进度记录 · 3 个 Task")).toBe(
      "Completed conversions: 2 progress records · 3 Tasks"
    );
  });

  it("中文模式原样返回", () => {
    expect(translateCompositeText("3 个分组 · 2 个 Flow")).toBe("3 个分组 · 2 个 Flow");
  });
});
