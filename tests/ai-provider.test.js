"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const aiProvider = require("../js/ai-provider.js");

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

function settings(overrides) {
  return Object.assign({
    enabled: true,
    noteAiEnabled: true,
    provider: "custom",
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    model: "test-model"
  }, overrides || {});
}

test("non-DeepSeek requests do not receive the DeepSeek-only thinking field", async () => {
  const originalFetch = global.fetch;
  const payloads = [];
  global.fetch = async (_url, options) => {
    payloads.push(JSON.parse(options.body));
    return response(200, { choices: [{ message: { content: "ok" } }] });
  };
  try {
    await aiProvider.chatComplete(settings(), [{ role: "user", content: "ping" }], { timeoutMs: 100 });
    assert.equal(payloads.length, 1);
    assert.equal(Object.hasOwn(payloads[0], "thinking"), false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("DeepSeek v4 retries without thinking when the endpoint rejects that field", async () => {
  const originalFetch = global.fetch;
  const payloads = [];
  global.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    payloads.push(payload);
    if (payloads.length === 1) {
      return response(400, { error: { message: "unknown field thinking" } });
    }
    return response(200, { choices: [{ message: { content: "ok" } }] });
  };
  try {
    await aiProvider.chatComplete(
      settings({ provider: "deepseek", model: "deepseek-v4-flash" }),
      [{ role: "user", content: "ping" }],
      { timeoutMs: 100 }
    );
    assert.deepEqual(payloads[0].thinking, { type: "disabled" });
    assert.equal(Object.hasOwn(payloads[1], "thinking"), false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("AI Task normalization never links a Flow from another selected Group", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => response(200, {
    choices: [{
      message: {
        content: JSON.stringify({
          tasks: [
            {
              sourceText: "Cross-group candidate",
              taskName: "Cross-group candidate",
              groupName: "Group A",
              flowName: "Flow B",
              ddl: "2026-02-31",
              recurrenceCadence: "weekly",
              recurrenceStart: "2026-02-31",
              recurrenceEnd: "2026-13-01",
              urgency: "high",
              reportTo: "Lucy",
              managedObject: "Jack",
              deliverable: "Output"
            },
            {
              sourceText: "Ambiguous Flow candidate",
              taskName: "Ambiguous Flow candidate",
              groupName: "",
              flowName: "Shared Flow",
              ddl: "2026-08-20",
              recurrenceCadence: "none",
              recurrenceStart: "",
              recurrenceEnd: "",
              urgency: "medium",
              reportTo: "Lucy",
              managedObject: "Jack",
              deliverable: "Output"
            }
          ]
        })
      }
    }]
  });
  try {
    const candidates = await aiProvider.parseTasks("Cross-group candidate", {
      settings: settings(),
      groups: [{ id: "g-a", name: "Group A" }, { id: "g-b", name: "Group B" }],
      flows: [
        { id: "f-a", groupId: "g-a", name: "Flow A" },
        { id: "f-b", groupId: "g-b", name: "Flow B" },
        { id: "f-shared-a", groupId: "g-a", name: "Shared Flow" },
        { id: "f-shared-b", groupId: "g-b", name: "Shared Flow" }
      ],
      reportToValues: ["Lucy"],
      managedObjectValues: ["Jack"],
      referenceDate: new Date("2026-08-16T00:00:00Z")
    });
    assert.equal(candidates[0].groupId, "g-a");
    assert.equal(candidates[0].flowId, "");
    assert.equal(candidates[0].recognizedFields.includes("flow"), false);
    assert.equal(candidates[0].ddl, "");
    assert.equal(candidates[0].recurrenceStart, "");
    assert.equal(candidates[0].recurrenceEnd, "");
    assert.equal(candidates[1].groupId, "");
    assert.equal(candidates[1].flowId, "");
    assert.equal(candidates[1].recognizedFields.includes("flow"), false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("AI requests reject with a stable timeout error", async () => {
  const originalFetch = global.fetch;
  global.fetch = (_url, options) => new Promise((_resolve, reject) => {
    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    }
  });
  try {
    await assert.rejects(
      aiProvider.chatComplete(settings(), [{ role: "user", content: "ping" }], { timeoutMs: 10 }),
      error => error && error.code === "AI_TIMEOUT"
    );
  } finally {
    global.fetch = originalFetch;
  }
});
