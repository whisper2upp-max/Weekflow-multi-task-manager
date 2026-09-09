"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const bulk = require("../js/bulk-actions.js");
const storage = require("../js/storage.js");
const stats = require("../js/stats.js");
const automation = require("../js/automation.js");
const excelImport = require("../js/excel-import.js");
const JSZip = require("../vendor/jszip.min.js");
const stamp = "2026-09-09T08:00:00.000Z";
function fixture() {
  return storage.validateData({ version: 4,
    groups: [{ id: "g1", name: "项目 A" }, { id: "g2", name: "项目 B" }],
    flows: [{ id: "f1", name: "发布", groupId: "g1" }],
    tasks: [
      { id: "t1", groupId: "g1", flowId: "f1", flowOrder: 1, name: "检查", ddl: "2026-09-10" },
      { id: "t2", groupId: "g1", name: "交付", ddl: "2026-09-11" },
      { id: "t3", groupId: "g2", name: "验收", ddl: "2026-09-12" }
    ].map(t => ({ ...t, urgency: "medium", reportTo: "Lucy", managedObject: "Jack", deliverable: "报告", progressEntries: [{ id: "p-" + t.id, contentText: "已完成初稿", createdAt: stamp, updatedAt: stamp }] })),
    materials: [{ id: "m1", title: "说明", url: "https://example.com", type: "document", taskIds: ["t1"], flowIds: ["f1"], groupIds: ["g1"] }], notes: []
  }).data;
}
function archive(data, kind, ids, batch) {
  return bulk.applyPlan(data, bulk.planArchive(data, kind, ids, false, stamp, batch));
}
test("group archive excludes descendants from active statistics and reminders, preserving content", () => {
  const data = fixture(), original = JSON.stringify(data);
  const next = archive(data, "group", ["g1"], "a1");
  assert.equal(JSON.stringify(data), original);
  assert.equal(stats.summarize(bulk.activeData(next).tasks).total, 1);
  assert.deepEqual(bulk.activeData(next).flows, []);
  assert.deepEqual(automation.getDueSoonTasks(bulk.activeData(next), new Date(2026, 8, 9), 7).map(x => x.task.id), ["t3"]);
  assert.deepEqual(next.materials, data.materials);
  assert.deepEqual(next.tasks[0].progressEntries, data.tasks[0].progressEntries);
  assert.equal(next.tasks[0].status, "pending");
});
test("restoring parent keeps previously archived children archived", () => {
  let data = archive(fixture(), "task", ["t1"], "old");
  data = archive(data, "group", ["g1"], "new");
  const restored = bulk.applyPlan(data, bulk.planArchive(data, "group", ["g1"], true, stamp));
  assert.equal(restored.tasks[0].archiveBatchId, "old");
  assert.equal(restored.tasks[1].archivedAt, null);
  assert.equal(restored.flows[0].archivedAt, null);
  assert.equal(restored.groups[0].archivedAt, null);
});
test("restoring one group in a shared batch leaves the other group archived", () => {
  const data = archive(fixture(), "group", ["g1", "g2"], "a");
  const next = bulk.applyPlan(data, bulk.planArchive(data, "group", ["g1"], true, stamp));
  assert.equal(next.tasks[2].archiveBatchId, "a");
  assert.equal(next.groups[1].archiveBatchId, "a");
});
test("flow archiving and restoring preserves previously archived tasks", () => {
  let data = archive(fixture(), "task", ["t1"], "old");
  data = archive(data, "flow", ["f1"], "flow");
  assert.equal(data.tasks[1].archivedAt, null);
  const restored = bulk.applyPlan(data, bulk.planArchive(data, "flow", ["f1"], true, stamp));
  assert.equal(restored.flows[0].archivedAt, null);
  assert.equal(restored.tasks[0].archiveBatchId, "old");
});
test("archived ancestors block restoring a child", () => {
  const data = archive(fixture(), "group", ["g1"], "a");
  assert.throws(() => bulk.planArchive(data, "task", ["t1"], true, stamp), /restore-parent-first/);
  assert.throws(() => bulk.planArchive(data, "flow", ["f1"], true, stamp), /restore-parent-first/);
});
test("bulk group edits change active Tasks only and preserve progress and unrelated fields", () => {
  const data = archive(fixture(), "task", ["t1"], "old");
  const plan = bulk.planEdit(data, "group", ["g1"], { ddlMode: "shift", days: 7, urgency: "high", managedObject: " Amy " }, stamp);
  assert.equal(plan.changes.length, 1);
  const next = bulk.applyPlan(data, plan);
  assert.equal(next.tasks[1].ddl, "2026-09-18");
  assert.equal(next.tasks[1].managedObject, "Amy");
  assert.equal(next.tasks[1].urgency, "high");
  assert.deepEqual(next.tasks[0], data.tasks[0]);
  assert.deepEqual(next.tasks[2], data.tasks[2]);
  assert.deepEqual(next.tasks[1].progressEntries, data.tasks[1].progressEntries);
});
test("bulk dates cross year boundaries and can be set to an exact valid date", () => {
  const data = fixture(); data.tasks[0].ddl = "2026-12-31";
  const plan = bulk.planEdit(data, "task", ["t1"], { ddlMode: "shift", days: 1 }, stamp);
  assert.equal(plan.changes[0].after.ddl, "2027-01-01");
  assert.equal(bulk.planEdit(data, "task", ["t1"], { ddlMode: "set", ddl: "2028-02-29" }, stamp).changes[0].after.ddl, "2028-02-29");
});
test("invalid batches fail atomically and stale previews cannot overwrite edits", () => {
  const data = fixture(), original = JSON.stringify(data);
  assert.throws(() => bulk.planEdit(data, "task", ["t1", "missing"], { urgency: "high" }, stamp), /invalid-selection/);
  assert.throws(() => bulk.planEdit(data, "task", ["t1"], { ddlMode: "set", ddl: "2026-02-30" }, stamp), /invalid-date/);
  assert.throws(() => bulk.planEdit(data, "task", ["t1"], { ddlMode: "shift", days: 1.2 }, stamp), /invalid-shift/);
  assert.equal(JSON.stringify(data), original);
  const plan = bulk.planEdit(data, "task", ["t1"], { urgency: "high" }, stamp);
  data.tasks[0].name = "New name";
  assert.throws(() => bulk.applyPlan(data, plan), /stale-preview/);
  assert.equal(data.tasks[0].urgency, "medium");
});
test("recurring DDL changes block whole batch; person and urgency edits retain recurrence history", () => {
  const data = fixture(); Object.assign(data.tasks[0], { recurrenceCadence: "weekly", recurrenceStart: "2026-09-01", recurrenceEnd: "2026-10-31", recurrenceCompletions: [{ periodKey: "2026-09-07", occurrenceDdl: "2026-09-10", completedAt: "2026-09-09" }] });
  assert.throws(() => bulk.planEdit(data, "group", ["g1"], { ddlMode: "shift", days: 2, urgency: "high" }, stamp), /recurring-ddl/);
  assert.equal(data.tasks[1].urgency, "medium");
  const plan = bulk.planEdit(data, "group", ["g1"], { urgency: "high", managedObject: "" }, stamp);
  assert.deepEqual(plan.changes[0].after.recurrenceCompletions, data.tasks[0].recurrenceCompletions);
  assert.equal(plan.changes[0].after.managedObject, "");
});
test("old JSON defaults to active and archived JSON preserves full hierarchy and relationships", () => {
  const data = fixture(); assert.equal(data.tasks[0].archivedAt, null);
  const next = archive(data, "group", ["g1"], "a");
  const checked = storage.validateData(JSON.parse(JSON.stringify(next)));
  assert.equal(checked.valid, true);
  assert.equal(checked.data.groups[0].archiveBatchId, "a");
  assert.equal(checked.data.flows[0].archiveBatchId, "a");
  assert.equal(checked.data.tasks[0].archiveBatchId, "a");
  assert.deepEqual(checked.data.materials, data.materials);
});
test("English and Chinese re-importable Excel retain archive metadata", async () => {
  const data = archive(fixture(), "group", ["g1"], "a");
  for (const language of ["en", "zh-CN"]) {
    const result = await excelImport.buildXlsxPackage(data, JSZip, "nodebuffer", { language });
    const parsed = excelImport.parseWorkbook(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength));
    assert.deepEqual(parsed.errors, []);
    const row = parsed.rows.find(r => r.taskName === "检查");
    assert.equal(row.archive.groupArchivedAt, stamp);
    assert.equal(row.archive.flowArchiveBatchId, "a");
    assert.equal(row.archive.taskArchiveBatchId, "a");
    assert.equal(row.archive.specified, true);
  }
});
