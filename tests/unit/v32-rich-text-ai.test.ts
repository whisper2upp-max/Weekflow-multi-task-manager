import { afterEach, describe, expect, it, vi } from "vitest";
import * as ai from "../../src/shared/ai-provider";
import * as richText from "../../src/shared/rich-text";
import { normalizeNote } from "../../src/shared/schema";

describe("v3.2 富文本兼容", () => {
  it("保留预设字号、表格和合并属性并剔除脚本", () => {
    const html = richText.sanitizeHtml(
      '<script>alert(1)</script><p style="font-size:18px;color:#123456">Title</p><table><tbody><tr><td rowspan="2" onclick="x()">A</td><td colspan="2">B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>'
    );
    expect(html).toContain("font-size: 18px");
    expect(html).toContain('rowspan="2"');
    expect(html).toContain('colspan="2"');
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(richText.plainText(html)).toContain("A\tB");
  });

  it("只接受五档字号并让旧笔记默认未收藏", () => {
    expect(richText.normalizeFontSize("7")).toBe("22px");
    expect(richText.normalizeFontSize("17px")).toBe("");
    expect(normalizeNote({ id: "n1", title: "Note", contentText: "Text" }).favorite).toBe(false);
    expect(normalizeNote({ id: "n2", title: "Star", contentText: "Text", favorite: true }).favorite).toBe(true);
  });
});

describe("AI provider transport", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("普通模型不发送 thinking 参数", async () => {
    const aiChat = vi.fn(async (request: { payload: Record<string, unknown> }) => ({
      ok: true,
      data: { choices: [{ message: { content: "ok" } }] },
      request
    }));
    Object.assign(globalThis, { window: { weekflow: { aiChat } } });
    const settings = ai.normalizeSettings({ enabled: true, provider: "custom", apiKey: "key", baseUrl: "https://example.com/v1", model: "model" });
    await ai.testConnection(settings);
    expect(aiChat).toHaveBeenCalledTimes(1);
    expect(aiChat.mock.calls[0][0].payload).not.toHaveProperty("thinking");
  });

  it("DeepSeek v4 参数不兼容时自动移除 thinking 重试", async () => {
    const aiChat = vi.fn()
      .mockResolvedValueOnce({ ok: false, code: "AI_REQUEST_FAILED", error: "thinking is not allowed" })
      .mockResolvedValueOnce({ ok: true, data: { choices: [{ message: { content: "ok" } }] } });
    Object.assign(globalThis, { window: { weekflow: { aiChat } } });
    const settings = ai.normalizeSettings({ enabled: true, provider: "deepseek", apiKey: "key", model: "deepseek-v4-flash" });
    await ai.testConnection(settings);
    expect(aiChat).toHaveBeenCalledTimes(2);
    expect(aiChat.mock.calls[0][0].payload).toHaveProperty("thinking");
    expect(aiChat.mock.calls[1][0].payload).not.toHaveProperty("thinking");
  });

  it("AI 漏字段时用原始片段补齐可靠的 DDL、人员、交付物和分组", async () => {
    const response = JSON.stringify({
      tasks: [{
        sourceText: "- **下周四**：完成汇报材料；分组：服务研发；汇报对象：Lucy；管理对象：Jack",
        taskName: "**下周四**：完成汇报材料"
      }]
    });
    const aiChat = vi.fn(async (request: { payload: Record<string, unknown> }) => ({
      ok: true,
      data: { choices: [{ message: { content: response } }] },
      request
    }));
    Object.assign(globalThis, { window: { weekflow: { aiChat } } });
    const settings = ai.normalizeSettings({ enabled: true, provider: "custom", apiKey: "key", baseUrl: "https://example.com/v1", model: "model" });
    const groups = [{
      id: "g-service", name: "服务研发", color: "#665CFF", order: 0,
      collapsed: false, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z"
    }];
    const [candidate] = await ai.parseTasks("note", {
      settings, groups, reportToValues: ["Lucy"], managedObjectValues: ["Jack"],
      referenceDate: new Date(2026, 7, 15, 10, 0, 0)
    });
    expect(candidate).toMatchObject({
      taskName: "完成汇报材料",
      ddl: "2026-08-20",
      groupId: "g-service",
      reportTo: "Lucy",
      managedObject: "Jack",
      deliverable: "汇报材料"
    });
    const messages = aiChat.mock.calls[0][0].payload.messages as Array<{ content: string }>;
    expect(messages[0].content).toContain("deliverable 必须提取");
    expect(messages[0].content).toContain("不得编造");
  });
});
