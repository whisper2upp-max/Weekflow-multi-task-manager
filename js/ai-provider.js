/* Weekflow AI 接入：主流国内大模型 OpenAI 兼容适配、设置持久化、Task 草稿解析与笔记改写。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.App = root.App || {};
  root.App.aiProvider = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  var STORAGE_KEY = "weekflow:ai-settings:v1";
  var REQUEST_TIMEOUT_MS = 45000;

  var PROVIDERS = {
    deepseek: {
      label: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      models: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"]
    },
    bailian: {
      label: "阿里云百炼 / DashScope",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      models: ["deepseek-v4-flash-0731", "deepseek-v4-pro-0813", "qwen3.8-max", "qwen3.7-max", "qwen3.7-plus", "qwen3.7-flash", "qwen3.6-plus", "qwen3.6-flash", "qwen3.5-plus", "qwen3.5-flash", "qwen-plus-latest", "qwen-max-latest", "qwen-turbo-latest"]
    },
    kimi: {
      label: "Kimi / Moonshot",
      baseUrl: "https://api.moonshot.cn/v1",
      models: ["kimi-k3", "kimi-k2.7-code", "kimi-k2.6", "kimi-k2.5", "kimi-latest", "moonshot-v1-128k", "moonshot-v1-32k"]
    },
    glm: {
      label: "智谱 GLM / Z.ai",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      models: ["glm-5.3", "glm-5.2", "glm-5.1", "glm-5", "glm-4.7", "glm-4.7-flash", "glm-4.6", "glm-4.5", "glm-4.5-flash"]
    },
    minimax: {
      label: "MiniMax",
      baseUrl: "https://api.minimaxi.com/v1",
      models: ["MiniMax-M3", "MiniMax-M2.7", "MiniMax-M2.7-highspeed", "MiniMax-M2.5", "MiniMax-M2.5-highspeed"]
    },
    custom: {
      label: "自定义 / OpenAI 兼容",
      baseUrl: "",
      models: []
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function defaultSettings() {
    return {
      enabled: false,
      noteAiEnabled: true,
      provider: "deepseek",
      apiKey: "",
      baseUrl: PROVIDERS.deepseek.baseUrl,
      model: PROVIDERS.deepseek.models[0]
    };
  }

  function normalizeSettings(raw) {
    var source = raw && typeof raw === "object" ? raw : {};
    var provider = PROVIDERS[source.provider] ? source.provider : "deepseek";
    var providerConfig = PROVIDERS[provider];
    var baseUrl = String(source.baseUrl || (providerConfig && providerConfig.baseUrl) || "").trim();
    var model = String(source.model || (providerConfig && providerConfig.models && providerConfig.models[0]) || "").trim();
    return {
      enabled: Boolean(source.enabled),
      noteAiEnabled: source.noteAiEnabled === undefined ? true : Boolean(source.noteAiEnabled),
      provider: provider,
      apiKey: String(source.apiKey || "").trim(),
      baseUrl: baseUrl.replace(/\/+$/, ""),
      model: model
    };
  }

  function loadSettings() {
    if (typeof localStorage === "undefined") return defaultSettings();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeSettings(JSON.parse(raw)) : defaultSettings();
    } catch (_error) {
      return defaultSettings();
    }
  }

  function saveSettings(settings) {
    var normalized = normalizeSettings(settings);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      }
    } catch (_error) {
      /* 存储不可用时仍返回当前设置，调用方提示即可。 */
    }
    return normalized;
  }

  function clearSettings() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_error) {
      /* ignore */
    }
    return defaultSettings();
  }

  function getSettings() {
    return loadSettings();
  }

  function isConfigured(settings) {
    var current = settings || loadSettings();
    return Boolean(current.apiKey && current.baseUrl && current.model);
  }

  function isEnabled(settings) {
    var current = settings || loadSettings();
    return Boolean(current.enabled && isConfigured(current));
  }

  function getProvider(provider) {
    return PROVIDERS[provider] || PROVIDERS.custom;
  }

  function extractError(data) {
    if (!data) return "未知错误";
    if (data.error) {
      return (
        (data.error.message || data.error.code || JSON.stringify(data.error)) +
        (data.error.type ? " (" + data.error.type + ")" : "")
      );
    }
    return data.message || JSON.stringify(data);
  }

  function aiError(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
  }

  function postChat(url, payload, headers, timeoutMs) {
    var limit = Number(timeoutMs);
    if (!Number.isFinite(limit) || limit <= 0) limit = REQUEST_TIMEOUT_MS;
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = null;
    var timeout = new Promise(function (_resolve, reject) {
      timer = setTimeout(function () {
        if (controller) controller.abort();
        reject(aiError("AI_TIMEOUT", "AI 请求超时，请检查网络后重试。"));
      }, limit);
    });
    var request = fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        try {
          data = text ? JSON.parse(text) : {};
        } catch (_error) {
          throw aiError(
            "AI_INVALID_RESPONSE",
            response.ok
              ? "AI 服务返回了无法识别的内容。"
              : "AI 服务请求失败（HTTP " + response.status + "）。"
          );
        }
        if (!response.ok) {
          throw new Error(extractError(data));
        }
        return data;
      });
    }).catch(function (error) {
      if (error && error.name === "AbortError") {
        throw aiError("AI_TIMEOUT", "AI 请求超时，请检查网络后重试。");
      }
      throw error;
    });
    return Promise.race([request, timeout]).then(
      function (data) {
        clearTimeout(timer);
        return data;
      },
      function (error) {
        clearTimeout(timer);
        throw error;
      }
    );
  }

  function chatComplete(settings, messages, options) {
    var current = normalizeSettings(settings);
    if (!current.apiKey || !current.baseUrl || !current.model) {
      return Promise.reject(new Error("请先完成 AI 接入配置。"));
    }
    var url = current.baseUrl.replace(/\/+$/, "") + "/chat/completions";
    var headers = {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + current.apiKey
    };
    var payload = {
      model: current.model,
      messages: messages,
      temperature: options && typeof options.temperature === "number" ? options.temperature : 0.2,
      stream: false
    };
    payload.max_tokens = options && options.maxTokens ? options.maxTokens : 8192;
    var deepseekV4 = /^deepseek-v4/i.test(current.model);
    if (deepseekV4) {
      payload.thinking = { type: "disabled" };
    }

    function attempt(withThinking) {
      if (withThinking) payload.thinking = { type: "disabled" };
      else delete payload.thinking;
      return postChat(url, payload, headers, options && options.timeoutMs);
    }

    return attempt(deepseekV4).catch(function (error) {
      var message = String(error && error.message || "");
      if (deepseekV4 && /(?:unknown|not allowed|additional propert|invalid parameter|unexpected field|thinking|不支持|参数)/i.test(message)) {
        return attempt(false);
      }
      throw error;
    });
  }

  function extractMessageText(message) {
    if (!message) return "";
    var content = message.content;
    if (Array.isArray(content)) {
      return content.map(function (part) {
        return part && (part.text || part.content || "");
      }).join("");
    }
    if (typeof content === "string") {
      if (content) return content;
    } else if (content) {
      return String(content);
    }
    if (message.reasoning_content) return String(message.reasoning_content);
    if (message.text) return String(message.text);
    return "";
  }

  function chatContent(settings, messages, options) {
    return chatComplete(settings, messages, options).then(function (data) {
      var choice = data && data.choices && data.choices[0];
      var content = choice ? extractMessageText(choice.message) : "";
      if (!content && choice && choice.text) content = String(choice.text);
      if (!content || !String(content).trim()) {
        if (choice && choice.finish_reason === "length") {
          throw new Error("AI 返回内容为空（输出长度受限，请重试或更换模型）。");
        }
        throw new Error("AI 返回内容为空。");
      }
      return String(content).trim();
    });
  }

  function testConnection(settings) {
    return chatContent(settings, [
      { role: "system", content: "You are a connectivity test helper. Reply with exactly: ok" },
      { role: "user", content: "ping" }
    ], { temperature: 0, maxTokens: 512 }).then(function (content) {
      return { ok: true, message: content };
    });
  }

  function extractJsonObject(text) {
    var value = String(text || "").trim();
    value = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    var start = value.indexOf("{");
    var end = value.lastIndexOf("}");
    if (start < 0 || end < start) {
      throw new Error("AI 返回不是有效 JSON。");
    }
    return JSON.parse(value.slice(start, end + 1));
  }

  function normalizedKey(value) {
    return String(value || "")
      .toLocaleLowerCase()
      .replace(/[\s\u3000_\-—–·•:：,，.。/\\()（）\[\]【】]+/g, "");
  }

  function matchKnown(rawValue, items, nameOf) {
    var key = normalizedKey(rawValue);
    if (!key) return "";
    var source = Array.isArray(items) ? items : [];
    var exact = source.find(function (item) {
      return normalizedKey(nameOf(item)) === key;
    });
    if (exact) return nameOf(exact);
    var contained = source.find(function (item) {
      var itemKey = normalizedKey(nameOf(item));
      return itemKey && (itemKey.includes(key) || key.includes(itemKey)) && Math.min(key.length, itemKey.length) >= 2;
    });
    return contained ? nameOf(contained) : rawValue;
  }

  function resolveGroup(groupName, groups) {
    var name = String(groupName || "").trim();
    if (!name) return { id: "", name: "" };
    var matched = matchKnown(name, groups || [], function (group) { return group.name; });
    var group = (groups || []).find(function (item) { return item.name === matched; });
    return group ? { id: group.id, name: group.name } : { id: "", name: name };
  }

  function resolveFlow(flowName, flows, groupId) {
    var name = String(flowName || "").trim();
    if (!name) return { id: "", name: "" };
    var scoped = (flows || []).filter(function (flow) {
      return !groupId || flow.groupId === groupId;
    });
    var matched = matchKnown(name, scoped, function (flow) { return flow.name; });
    var matches = scoped.filter(function (item) { return item.name === matched; });
    if (matches.length === 1) return { id: matches[0].id, name: matches[0].name };
    return { id: "", name: name };
  }

  function validIsoDate(value) {
    var match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    var parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return (
      parsed.getFullYear() === Number(match[1]) &&
      parsed.getMonth() === Number(match[2]) - 1 &&
      parsed.getDate() === Number(match[3])
    );
  }

  function normalizeAiTask(raw, context) {
    var source = raw && typeof raw === "object" ? raw : {};
    var group = resolveGroup(source.groupName || source.group, context.groups);
    var flow = resolveFlow(source.flowName || source.flow, context.flows, group.id);
    if (!group.id && flow.id) {
      var flowRecord = (context.flows || []).find(function (item) { return item.id === flow.id; });
      var flowGroup = (context.groups || []).find(function (item) { return item.id === (flowRecord && flowRecord.groupId); });
      if (flowGroup) {
        group = { id: flowGroup.id, name: flowGroup.name };
      }
    }
    var ddl = String(source.ddl || "").trim();
    if (ddl && !validIsoDate(ddl)) ddl = "";
    var recurrence = ["none", "weekly", "monthly"].includes(source.recurrenceCadence)
      ? source.recurrenceCadence
      : "none";
    var recurrenceStart = String(source.recurrenceStart || "").trim();
    var recurrenceEnd = String(source.recurrenceEnd || "").trim();
    if (recurrenceStart && !validIsoDate(recurrenceStart)) recurrenceStart = "";
    if (recurrenceEnd && !validIsoDate(recurrenceEnd)) recurrenceEnd = "";
    var reportTo = matchKnown(source.reportTo, context.reportToValues || [], function (value) { return value; });
    var managedObject = matchKnown(source.managedObject, context.managedObjectValues || [], function (value) { return value; });
    var candidate = {
      sourceText: String(source.sourceText || "").trim(),
      taskName: String(source.taskName || "").trim().slice(0, 160),
      groupId: group.id,
      groupName: group.name,
      flowId: flow.id,
      flowName: flow.name,
      ddl: ddl,
      recurrenceCadence: recurrence,
      recurrenceStart: recurrenceStart,
      recurrenceEnd: recurrenceEnd,
      urgency: ["low", "medium", "high"].includes(String(source.urgency || "").toLocaleLowerCase())
        ? String(source.urgency).toLocaleLowerCase()
        : "",
      reportTo: String(reportTo || "").trim().slice(0, 120),
      managedObject: String(managedObject || "").trim().slice(0, 160),
      deliverable: String(source.deliverable || "").trim().slice(0, 500),
      recognizedFields: [],
      suggestions: []
    };
    if (!candidate.taskName && candidate.sourceText) {
      candidate.taskName = candidate.sourceText.split(/\n/)[0].replace(/^[-*•▪◦\s]+/, "").slice(0, 160);
    }
    if (candidate.recurrenceCadence !== "none" && !candidate.recurrenceStart && candidate.ddl) {
      candidate.recurrenceStart = candidate.ddl;
    }
    [
      ["taskName", candidate.taskName],
      ["group", candidate.groupId],
      ["flow", candidate.flowId],
      ["ddl", candidate.ddl],
      ["recurrence", candidate.recurrenceCadence !== "none"],
      ["urgency", candidate.urgency],
      ["reportTo", candidate.reportTo],
      ["managedObject", candidate.managedObject],
      ["deliverable", candidate.deliverable]
    ].forEach(function (field) {
      if (field[1]) candidate.recognizedFields.push(field[0]);
    });
    return candidate;
  }

  function outputTokenBudget(text, factor) {
    var length = String(text || "").length;
    var budget = Math.ceil(length * (factor || 1.2)) + 4096;
    return Math.max(8192, Math.min(32768, budget));
  }

  function parseTasks(noteText, context) {
    var source = context || {};
    var knownGroups = (source.groups || []).map(function (group) { return group.name; }).join("、");
    var knownFlows = (source.flows || []).map(function (flow) { return flow.name; }).join("、");
    var knownReport = (source.reportToValues || []).join("、");
    var knownManaged = (source.managedObjectValues || []).join("、");
    var systemPrompt =
      "你是 Weekflow 的任务草稿解析器。请把用户随手记按语义拆分成一个或多个潜在 Task，并从原文中提取字段。\n" +
      "只能输出一个 JSON 对象，不要输出 Markdown 代码块、不要输出解释。格式：\n" +
      '{"tasks":[{"sourceText":"原始片段","taskName":"任务名称","groupName":"分组名称或空","flowName":"Flow名称或空","ddl":"YYYY-MM-DD或空","recurrenceCadence":"none/weekly/monthly","recurrenceStart":"YYYY-MM-DD或空","recurrenceEnd":"YYYY-MM-DD或空","urgency":"low/medium/high或空","reportTo":"汇报对象或空","managedObject":"管理对象或空","deliverable":"交付物或空"}]}';
    var reference = source.referenceDate instanceof Date && !Number.isNaN(source.referenceDate.getTime())
      ? source.referenceDate
      : new Date();
    function two(value) { value = Number(value); return value < 10 ? "0" + value : String(value); }
    var today = reference.getFullYear() + "-" + two(reference.getMonth() + 1) + "-" + two(reference.getDate());
    var userPrompt =
      "今天是 " + today + "\n" +
      "现有分组：" + (knownGroups || "无") + "\n" +
      "现有 Flow：" + (knownFlows || "无") + "\n" +
      "已知汇报对象：" + (knownReport || "无") + "\n" +
      "已知管理对象：" + (knownManaged || "无") + "\n\n" +
      "请解析以下随手记：\n" + String(noteText || "");
    return chatContent(source.settings || loadSettings(), [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], { temperature: 0.1, maxTokens: outputTokenBudget(noteText, 0.6) }).then(function (content) {
      var parsed = extractJsonObject(content);
      var list = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      if (!list.length) throw new Error("AI 未识别到 Task。");
      return list.map(function (item) {
        return normalizeAiTask(item, source);
      });
    });
  }

  function rewriteNote(noteText) {
    var systemPrompt =
      "你是 Weekflow 的笔记润色助手。请把用户随手记改写为完整、结构化、有条理的表达。\n" +
      "要求：不能改变原意；不能增删事实；不能编造信息；保留所有关键细节；可以适当分段、使用列表或标题；" +
      "输出正文本身即可，不要输出解释或前后缀。";
    return chatContent(loadSettings(), [
      { role: "system", content: systemPrompt },
      { role: "user", content: String(noteText || "") }
    ], { temperature: 0.3, maxTokens: outputTokenBudget(noteText, 1.4) });
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    REQUEST_TIMEOUT_MS: REQUEST_TIMEOUT_MS,
    PROVIDERS: PROVIDERS,
    defaultSettings: defaultSettings,
    normalizeSettings: normalizeSettings,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    clearSettings: clearSettings,
    getSettings: getSettings,
    isConfigured: isConfigured,
    isEnabled: isEnabled,
    getProvider: getProvider,
    testConnection: testConnection,
    chatComplete: chatComplete,
    parseTasks: parseTasks,
    rewriteNote: rewriteNote
  };
});
