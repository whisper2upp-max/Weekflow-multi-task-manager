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
});
