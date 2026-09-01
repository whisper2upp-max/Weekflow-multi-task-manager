/** Weekflow Desktop AI settings and OpenAI-compatible client. */
import type { Flow, Group, RecurrenceCadence, Urgency } from "./types";
import { parseSingle, type DraftSuggestion, type TaskDraftCandidate } from "./task-draft-parser";

export const STORAGE_KEY = "weekflow-desktop:ai-settings:v1";
export const REQUEST_TIMEOUT_MS = 45_000;

export const PROVIDERS = {
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com", models: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"] },
  bailian: { label: "阿里云百炼 / DashScope", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", models: ["deepseek-v4-flash-0731", "deepseek-v4-pro-0813", "qwen3.8-max", "qwen3.7-max", "qwen3.7-plus", "qwen3.7-flash", "qwen3.6-plus", "qwen3.6-flash", "qwen3.5-plus", "qwen3.5-flash", "qwen-plus-latest", "qwen-max-latest", "qwen-turbo-latest"] },
  kimi: { label: "Kimi / Moonshot", baseUrl: "https://api.moonshot.cn/v1", models: ["kimi-k3", "kimi-k2.7-code", "kimi-k2.6", "kimi-k2.5", "kimi-latest", "moonshot-v1-128k", "moonshot-v1-32k"] },
  glm: { label: "智谱 GLM / Z.ai", baseUrl: "https://open.bigmodel.cn/api/paas/v4", models: ["glm-5.3", "glm-5.2", "glm-5.1", "glm-5", "glm-4.7", "glm-4.7-flash", "glm-4.6", "glm-4.5", "glm-4.5-flash"] },
  minimax: { label: "MiniMax", baseUrl: "https://api.minimaxi.com/v1", models: ["MiniMax-M3", "MiniMax-M2.7", "MiniMax-M2.7-highspeed", "MiniMax-M2.5", "MiniMax-M2.5-highspeed"] },
  custom: { label: "自定义 / OpenAI 兼容", baseUrl: "", models: [] as string[] }
} as const;

export type AiProviderKey = keyof typeof PROVIDERS;
export interface AiSettings {
  enabled: boolean;
  noteAiEnabled: boolean;
  provider: AiProviderKey;
  apiKey: string;
  baseUrl: string;
  model: string;
}
export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }
export interface ChatOptions { temperature?: number; maxTokens?: number; timeoutMs?: number }
export interface AiParserContext {
  settings?: AiSettings;
  groups?: Group[];
  flows?: Flow[];
  reportToValues?: string[];
  managedObjectValues?: string[];
  referenceDate?: Date;
}

export class AiProviderError extends Error {
  constructor(message: string, public code?: string) { super(message); this.name = "AiProviderError"; }
}

export function defaultSettings(): AiSettings {
  return { enabled: false, noteAiEnabled: true, provider: "deepseek", apiKey: "", baseUrl: PROVIDERS.deepseek.baseUrl, model: PROVIDERS.deepseek.models[0] };
}
export function getProvider(provider: unknown) {
  return PROVIDERS[String(provider) as AiProviderKey] || PROVIDERS.custom;
}
export function normalizeSettings(raw: unknown): AiSettings {
  const source = raw && typeof raw === "object" ? raw as Partial<AiSettings> : {};
  const provider = String(source.provider || "deepseek") in PROVIDERS ? source.provider as AiProviderKey : "deepseek";
  const config = PROVIDERS[provider];
  return {
    enabled: Boolean(source.enabled),
    noteAiEnabled: source.noteAiEnabled === undefined ? true : Boolean(source.noteAiEnabled),
    provider,
    apiKey: String(source.apiKey || "").trim(),
    baseUrl: String(source.baseUrl || config.baseUrl || "").trim().replace(/\/+$/, ""),
    model: String(source.model || config.models[0] || "").trim()
  };
}
export function getSettings(): AiSettings {
  if (typeof localStorage === "undefined") return defaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : defaultSettings();
  } catch { return defaultSettings(); }
}
export function saveSettings(settings: unknown): AiSettings {
  const normalized = normalizeSettings(settings);
  try { if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch { /* unavailable */ }
  return normalized;
}
export function clearSettings(): AiSettings {
  try { if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY); } catch { /* unavailable */ }
  return defaultSettings();
}
export function isConfigured(settings = getSettings()): boolean {
  return Boolean(settings.apiKey && settings.baseUrl && settings.model);
}
export function isEnabled(settings = getSettings()): boolean {
  return Boolean(settings.enabled && isConfigured(settings));
}

export async function chatComplete(settings: unknown, messages: ChatMessage[], options: ChatOptions = {}): Promise<unknown> {
  const current = normalizeSettings(settings);
  if (!isConfigured(current)) throw new AiProviderError("请先完成 AI 接入配置。", "AI_NOT_CONFIGURED");
  const payload: Record<string, unknown> = {
    model: current.model,
    messages,
    temperature: typeof options.temperature === "number" ? options.temperature : 0.2,
    stream: false,
    max_tokens: options.maxTokens || 8192
  };
  const deepseekV4 = /^deepseek-v4/i.test(current.model);
  const attempt = async (withThinking: boolean): Promise<unknown> => {
    if (withThinking) payload.thinking = { type: "disabled" };
    else delete payload.thinking;
    const result = await window.weekflow.aiChat({
      url: `${current.baseUrl}/chat/completions`,
      apiKey: current.apiKey,
      payload: structuredClone(payload),
      timeoutMs: options.timeoutMs || REQUEST_TIMEOUT_MS
    });
    if (!result.ok) throw new AiProviderError(result.error || "AI 请求失败。", result.code || "AI_REQUEST_FAILED");
    return result.data;
  };
  try { return await attempt(deepseekV4); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (deepseekV4 && /(?:unknown|not allowed|additional propert|invalid parameter|unexpected field|thinking|不支持|参数)/i.test(message)) return attempt(false);
    throw error;
  }
}

function extractMessageText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const source = message as Record<string, unknown>;
  if (Array.isArray(source.content)) return source.content.map((part) => part && typeof part === "object" ? String((part as Record<string, unknown>).text || (part as Record<string, unknown>).content || "") : "").join("");
  if (typeof source.content === "string" && source.content) return source.content;
  return String(source.reasoning_content || source.text || "");
}
async function chatContent(settings: unknown, messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const data = await chatComplete(settings, messages, options);
  const record = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const choice = choices[0] && typeof choices[0] === "object" ? choices[0] as Record<string, unknown> : {};
  const content = extractMessageText(choice.message) || String(choice.text || "");
  if (!content.trim()) {
    if (choice.finish_reason === "length") throw new AiProviderError("AI 返回内容为空（输出长度受限，请重试或更换模型）。", "AI_EMPTY_RESPONSE");
    throw new AiProviderError("AI 返回内容为空。", "AI_EMPTY_RESPONSE");
  }
  return content.trim();
}
export async function testConnection(settings: unknown): Promise<{ ok: true; message: string }> {
  const content = await chatContent(settings, [
    { role: "system", content: "You are a connectivity test helper. Reply with exactly: ok" },
    { role: "user", content: "ping" }
  ], { temperature: 0, maxTokens: 512 });
  return { ok: true, message: content };
}

function extractJsonObject(text: string): Record<string, unknown> {
  const value = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end < start) throw new AiProviderError("AI 返回不是有效 JSON。", "AI_INVALID_JSON");
  try { return JSON.parse(value.slice(start, end + 1)) as Record<string, unknown>; }
  catch { throw new AiProviderError("AI 返回不是有效 JSON。", "AI_INVALID_JSON"); }
}
function normalizedKey(value: unknown): string {
  return String(value || "").toLocaleLowerCase().replace(/[\s\u3000_\-—–·•:：,，.。/\\()（）\[\]【】]+/g, "");
}
function matchKnown<T>(rawValue: unknown, items: T[], nameOf: (item: T) => string): string {
  const key = normalizedKey(rawValue);
  if (!key) return "";
  const exact = items.find((item) => normalizedKey(nameOf(item)) === key);
  if (exact) return nameOf(exact);
  const contained = items.find((item) => {
    const itemKey = normalizedKey(nameOf(item));
    return itemKey && (itemKey.includes(key) || key.includes(itemKey)) && Math.min(key.length, itemKey.length) >= 2;
  });
  return contained ? nameOf(contained) : String(rawValue || "");
}
function validIsoDate(value: unknown): boolean {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return parsed.getFullYear() === Number(match[1]) && parsed.getMonth() === Number(match[2]) - 1 && parsed.getDate() === Number(match[3]);
}
function normalizeAiTask(raw: unknown, context: AiParserContext): TaskDraftCandidate {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const sourceText = String(source.sourceText || "").trim();
  const rawTaskName = String(source.taskName || "").trim();
  // AI output can omit an otherwise obvious field. Re-run the local,
  // explainable parser on the exact source fragment and use it only as a
  // fallback, never to overwrite a valid AI value.
  const local = parseSingle(sourceText || rawTaskName, context);
  const groupName = matchKnown(source.groupName || source.group, context.groups || [], (group) => group.name);
  let group = (context.groups || []).find((item) => item.name === groupName) || null;
  if (!group && local.groupId) group = (context.groups || []).find((item) => item.id === local.groupId) || null;
  const scopedFlows = (context.flows || []).filter((flow) => !group || flow.groupId === group.id);
  const flowName = matchKnown(source.flowName || source.flow, scopedFlows, (flow) => flow.name);
  const matchingFlows = scopedFlows.filter((flow) => flow.name === flowName);
  const flow = matchingFlows.length === 1 ? matchingFlows[0] : null;
  const localFlow = scopedFlows.find((item) => item.id === local.flowId) || null;
  if (!group && flow) group = (context.groups || []).find((item) => item.id === flow.groupId) || null;
  let ddl = String(source.ddl || "").trim(); if (ddl && !validIsoDate(ddl)) ddl = ""; ddl ||= local.ddl;
  const cadence: RecurrenceCadence = ["none", "weekly", "monthly"].includes(String(source.recurrenceCadence))
    ? source.recurrenceCadence as RecurrenceCadence
    : local.recurrenceCadence;
  let recurrenceStart = String(source.recurrenceStart || "").trim(); if (recurrenceStart && !validIsoDate(recurrenceStart)) recurrenceStart = ""; recurrenceStart ||= local.recurrenceStart;
  let recurrenceEnd = String(source.recurrenceEnd || "").trim(); if (recurrenceEnd && !validIsoDate(recurrenceEnd)) recurrenceEnd = ""; recurrenceEnd ||= local.recurrenceEnd;
  const urgencyText = String(source.urgency || "").toLocaleLowerCase();
  const urgency: Urgency | "" = ["low", "medium", "high"].includes(urgencyText) ? urgencyText as Urgency : local.urgency;
  const reportTo = matchKnown(source.reportTo, context.reportToValues || [], (value) => value) || local.reportTo;
  const managedObject = matchKnown(source.managedObject, context.managedObjectValues || [], (value) => value) || local.managedObject;
  const aiTaskName = parseSingle(rawTaskName, context).taskName;
  const deliverable = String(source.deliverable || "").trim().slice(0, 500) || local.deliverable;
  const suggestions: DraftSuggestion[] = [];
  const candidate: TaskDraftCandidate = {
    sourceText,
    taskName: (aiTaskName || local.taskName).slice(0, 160),
    groupId: group?.id || "", groupName: group?.name || local.groupName || groupName,
    flowId: flow?.id || localFlow?.id || "", flowName: flow?.name || localFlow?.name || flowName,
    ddl, recurrenceCadence: cadence, recurrenceStart, recurrenceEnd, urgency,
    reportTo: reportTo.trim().slice(0, 120), managedObject: managedObject.trim().slice(0, 160),
    deliverable, suggestions, recognizedFields: []
  };
  if (!candidate.taskName && candidate.sourceText) candidate.taskName = candidate.sourceText.split(/\n/)[0].replace(/^[-*•▪◦\s]+/, "").slice(0, 160);
  if (candidate.recurrenceCadence !== "none" && !candidate.recurrenceStart && candidate.ddl) candidate.recurrenceStart = candidate.ddl;
  const recognized: Array<[string, unknown]> = [
    ["taskName", candidate.taskName], ["group", candidate.groupId], ["flow", candidate.flowId], ["ddl", candidate.ddl],
    ["recurrence", candidate.recurrenceCadence !== "none"], ["urgency", candidate.urgency], ["reportTo", candidate.reportTo],
    ["managedObject", candidate.managedObject], ["deliverable", candidate.deliverable]
  ];
  recognized.forEach(([field, found]) => { if (found) candidate.recognizedFields.push(field); });
  return candidate;
}
function outputTokenBudget(text: unknown, factor = 1.2): number {
  return Math.max(8192, Math.min(32768, Math.ceil(String(text || "").length * factor) + 4096));
}
export async function parseTasks(noteText: string, context: AiParserContext = {}): Promise<TaskDraftCandidate[]> {
  const knownGroups = (context.groups || []).map((group) => group.name).join("、");
  const knownFlows = (context.flows || []).map((flow) => flow.name).join("、");
  const reference = context.referenceDate instanceof Date && !Number.isNaN(context.referenceDate.getTime()) ? context.referenceDate : new Date();
  const two = (value: number) => String(value).padStart(2, "0");
  const today = `${reference.getFullYear()}-${two(reference.getMonth() + 1)}-${two(reference.getDate())}`;
  const systemPrompt = "你是 Weekflow 的任务草稿解析器。请把用户随手记按语义拆分成一个或多个潜在 Task，并从原文中提取字段。\n" +
    "提取规则：1. DDL 必须结合今天解析明确日期或本周/下周/下下周等相对日期；2. groupName 只能返回现有分组中的准确名称，无法可靠匹配时留空；3. reportTo 是汇报对象，managedObject 是管理对象，不得互换；4. deliverable 必须提取任务要产出的具体交付物，例如‘完成报告’的交付物是‘报告’，‘完成汇报材料’的交付物是‘汇报材料’；5. 原文没有依据的字段必须留空，不得编造；6. sourceText 保留该 Task 对应的原始片段，taskName 不带日期前缀、Markdown 星号或字段标签。\n" +
    "只能输出一个 JSON 对象，不要输出 Markdown 代码块、不要输出解释。格式：\n" +
    '{"tasks":[{"sourceText":"原始片段","taskName":"任务名称","groupName":"分组名称或空","flowName":"Flow名称或空","ddl":"YYYY-MM-DD或空","recurrenceCadence":"none/weekly/monthly","recurrenceStart":"YYYY-MM-DD或空","recurrenceEnd":"YYYY-MM-DD或空","urgency":"low/medium/high或空","reportTo":"汇报对象或空","managedObject":"管理对象或空","deliverable":"交付物或空"}]}';
  const userPrompt = `今天是 ${today}\n现有分组：${knownGroups || "无"}\n现有 Flow：${knownFlows || "无"}\n已知汇报对象：${(context.reportToValues || []).join("、") || "无"}\n已知管理对象：${(context.managedObjectValues || []).join("、") || "无"}\n\n请解析以下随手记：\n${noteText}`;
  const content = await chatContent(context.settings || getSettings(), [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], { temperature: 0.1, maxTokens: outputTokenBudget(noteText, 0.6) });
  const parsed = extractJsonObject(content);
  const list = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  if (!list.length) throw new AiProviderError("AI 未识别到 Task。", "AI_NO_TASKS");
  return list.map((item) => normalizeAiTask(item, context));
}
export function rewriteNote(noteText: string, settings = getSettings()): Promise<string> {
  const systemPrompt = "你是 Weekflow 的笔记润色助手。请把用户随手记改写为完整、结构化、有条理的表达。\n要求：不能改变原意；不能增删事实；不能编造信息；保留所有关键细节；可以适当分段、使用列表或标题；若输入中包含形如 [[WEEKFLOW_TABLE_...]] 的表格占位标记，必须逐字保留每个标记，保持数量、顺序和所在位置不变，不得改写、删除、复制或解释标记；输出正文本身即可，不要输出解释或前后缀。";
  return chatContent(settings, [{ role: "system", content: systemPrompt }, { role: "user", content: noteText }], { temperature: 0.3, maxTokens: outputTokenBudget(noteText, 1.4) });
}

export function errorMessage(error: unknown, english = false): string {
  const code = error instanceof AiProviderError ? error.code : "";
  if (code === "AI_TIMEOUT") return english ? "The AI request timed out. Check the network and try again." : "AI 请求超时，请检查网络后重试。";
  if (code === "AI_INVALID_RESPONSE") return english ? "The AI service returned an unreadable response." : "AI 服务返回了无法识别的内容。";
  const message = error instanceof Error ? error.message : String(error || "未知错误");
  if (!english) return message;
  const translations: Record<string, string> = {
    "请先完成 AI 接入配置。": "Complete AI setup first.", "AI 返回内容为空。": "The AI response was empty.",
    "AI 返回不是有效 JSON。": "The AI response was not valid JSON.", "AI 未识别到 Task。": "AI did not detect any Tasks.", "未知错误": "Unknown error"
  };
  return translations[message] || message;
}
