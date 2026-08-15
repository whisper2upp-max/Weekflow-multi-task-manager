"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const storage = require("../js/storage.js");
const richText = require("../js/rich-text.js");
const parser = require("../js/task-draft-parser.js");
const excelImport = require("../js/excel-import.js");
const excelExport = require("../js/excel-export.js");
const XLSX = require("../vendor/xlsx.full.min.js");
const JSZip = require("../vendor/jszip.min.js");

function baseData() {
  return {
    version: 4,
    groups: [{
      id: "g1", name: "服务研发", color: "#665CFF", order: 1, collapsed: false,
      createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z"
    }],
    flows: [{
      id: "f1", groupId: "g1", name: "个人研发", color: "#665CFF", order: 1,
      collapsed: false, createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z"
    }],
    tasks: [{
      id: "t1", groupId: "g1", flowId: "f1", flowOrder: 1, name: "SOP 研发",
      reportTo: "Lucy", managedObject: "Jack", deliverable: "SOP 文档",
      ddl: "2026-08-20", urgency: "high", status: "pending", completedAt: null,
      recurrenceCadence: "none", recurrenceStart: null, recurrenceEnd: null,
      recurrenceCompletions: [],
      progressEntries: [
        {
          id: "p2", contentHtml: "<p><strong>第二次</strong>更新</p>", contentText: "第二次更新",
          sourceType: "manual", sourceNoteId: null,
          createdAt: "2026-08-15T02:00:00.000Z", updatedAt: "2026-08-15T03:00:00.000Z"
        },
        {
          id: "p1", contentHtml: "<p>第一次更新</p>", contentText: "第一次更新",
          sourceType: "quick-note", sourceNoteId: "n1",
          createdAt: "2026-08-14T02:00:00.000Z", updatedAt: "2026-08-14T02:00:00.000Z"
        }
      ],
      progressNote: "第二次更新", progressUpdatedAt: "2026-08-15T03:00:00.000Z",
      createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-15T03:00:00.000Z"
    }],
    materials: [],
    notes: [{
      id: "n1", title: "会议随手记",
      contentHtml: '<p><strong>确认</strong>下一步，参考 <a href="https://example.com/doc">文档</a></p>',
      contentText: "确认下一步，参考 文档", conversions: [],
      createdAt: "2026-08-14T01:00:00.000Z", updatedAt: "2026-08-14T01:00:00.000Z"
    }],
    preferences: { documentLibrary: { layout: "group", columns: 3, groupOrder: ["g1", "__ungrouped__"] } },
    updatedAt: "2026-08-15T03:00:00.000Z"
  };
}

function arrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

test("v2.6 single progress text migrates to one v2.7 history entry", () => {
  const old = baseData();
  old.version = 3;
  delete old.notes;
  old.tasks[0].progressEntries = undefined;
  old.tasks[0].progressNote = "旧版单条进度";
  old.tasks[0].progressUpdatedAt = "2026-08-14T04:00:00.000Z";
  const checked = storage.validateData(old);
  assert.equal(checked.valid, true, checked.errors.join("\n"));
  assert.equal(checked.data.version, 4);
  assert.equal(checked.data.notes.length, 0);
  assert.equal(checked.data.tasks[0].progressEntries.length, 1);
  assert.equal(checked.data.tasks[0].progressEntries[0].contentText, "旧版单条进度");
  assert.equal(checked.data.tasks[0].progressEntries[0].sourceType, "legacy");
});

test("JSON validation preserves Quick Notes, conversions, and rich progress history", () => {
  const source = baseData();
  source.notes[0].conversions.push({
    id: "c1", type: "progress", taskIds: ["t1"], progressEntryIds: ["p1"],
    skippedCount: 0, createdAt: "2026-08-14T02:00:00.000Z"
  });
  const checked = storage.validateData(JSON.parse(JSON.stringify(source)));
  assert.equal(checked.valid, true, checked.errors.join("\n"));
  assert.equal(checked.data.notes[0].title, "会议随手记");
  assert.match(checked.data.notes[0].contentHtml, /<strong>确认<\/strong>/);
  assert.match(checked.data.notes[0].contentHtml, /https:\/\/example\.com\/doc/);
  assert.equal(checked.data.notes[0].conversions[0].progressEntryIds[0], "p1");
  assert.equal(checked.data.tasks[0].progressEntries.length, 2);
});

test("local bilingual parser auto-fills exact fields and only suggests fuzzy matches", () => {
  const context = {
    groups: [{ id: "g1", name: "服务研发" }],
    flows: [{ id: "f1", groupId: "g1", name: "个人研发" }],
    reportToValues: ["Lucy"], managedObjectValues: ["Jack"],
    referenceDate: new Date("2026-08-15T12:00:00+08:00")
  };
  const exact = parser.parseSingle(
    "Task：完成上线检查；DDL：2026-08-20；紧急程度：高；分组：服务研发；Flow：个人研发；汇报对象：Lucy；管理对象：Jack；交付物：上线确认单",
    context
  );
  assert.equal(exact.taskName, "完成上线检查");
  assert.equal(exact.ddl, "2026-08-20");
  assert.equal(exact.urgency, "high");
  assert.equal(exact.groupId, "g1");
  assert.equal(exact.flowId, "f1");

  const fuzzy = parser.parseSingle(
    "Task: Release check; Due: next Friday; Group: 服务研伐; Report To: Lcy; Deliverable: approval",
    context
  );
  assert.equal(fuzzy.ddl, "");
  assert.equal(fuzzy.groupId, "");
  assert.equal(fuzzy.reportTo, "");
  assert.ok(fuzzy.suggestions.some((item) => item.field === "ddlCalculated"));
  assert.ok(fuzzy.suggestions.some((item) => item.field === "group" && item.value === "服务研发"));
  assert.ok(fuzzy.suggestions.some((item) => item.field === "reportTo" && item.value === "Lucy"));
  assert.ok(parser.RULE_EXAMPLES.zh.length && parser.RULE_EXAMPLES.en.length && parser.RULE_EXAMPLES.fuzzy.length);
});

test("candidate splitting keeps bulleted field lines with their Task", () => {
  const candidates = parser.splitCandidates([
    "1. Task: First Task",
    "- DDL: 2026-08-20",
    "- Urgency: High",
    "- Deliverable: First output",
    "2. Task: Second Task",
    "- DDL: 2026-08-21",
    "- Deliverable: Second output"
  ].join("\n"));
  assert.equal(candidates.length, 2);
  assert.match(candidates[0], /First output/);
  assert.match(candidates[1], /Second output/);
  const parsed = parser.parse(candidates.join("\n"), {
    groups: [], flows: [], reportToValues: [], managedObjectValues: [],
    referenceDate: new Date("2026-08-15T00:00:00Z")
  });
  assert.equal(parsed[0].ddl, "2026-08-20");
  assert.equal(parsed[0].urgency, "high");
  assert.equal(parsed[0].deliverable, "First output");
});

test("natural weekly and monthly wording prefills recurring cadence and next-period DDL", () => {
  const context = {
    groups: [], flows: [], reportToValues: [], managedObjectValues: [],
    referenceDate: new Date(2026, 7, 15, 12, 0, 0)
  };
  const weeklyZh = parser.parseSingle("每周三完成服务周报", context);
  assert.equal(weeklyZh.taskName, "完成服务周报");
  assert.equal(weeklyZh.recurrenceCadence, "weekly");
  assert.equal(weeklyZh.ddl, "2026-08-19");
  assert.equal(weeklyZh.recurrenceStart, "2026-08-19");

  const weeklyEn = parser.parseSingle("Every Thursday prepare the team report", context);
  assert.equal(weeklyEn.taskName, "prepare the team report");
  assert.equal(weeklyEn.recurrenceCadence, "weekly");
  assert.equal(weeklyEn.ddl, "2026-08-20");

  const monthlyZh = parser.parseSingle("每月5日完成质量复核", context);
  assert.equal(monthlyZh.taskName, "完成质量复核");
  assert.equal(monthlyZh.recurrenceCadence, "monthly");
  assert.equal(monthlyZh.ddl, "2026-09-05");

  const monthlyEn = parser.parseSingle("Monthly on the 28th complete the review", context);
  assert.equal(monthlyEn.taskName, "complete the review");
  assert.equal(monthlyEn.recurrenceCadence, "monthly");
  assert.equal(monthlyEn.ddl, "2026-09-28");

  const explicitAnchor = parser.parseSingle(
    "每周三完成例会；DDL: 2026-09-02",
    context
  );
  assert.equal(explicitAnchor.recurrenceCadence, "weekly");
  assert.equal(explicitAnchor.ddl, "2026-09-02");
  assert.equal(explicitAnchor.recurrenceStart, "2026-09-02");
});

test("bare 1 2 3 lines become separate Task draft candidates", () => {
  const candidates = parser.parse([
    "1 Prepare launch checklist",
    "2 Confirm reviewer coverage",
    "3 Publish the final package"
  ].join("\n"), {
    groups: [], flows: [], reportToValues: [], managedObjectValues: [],
    referenceDate: new Date(2026, 7, 15, 12, 0, 0)
  });
  assert.equal(candidates.length, 3);
  assert.deepEqual(
    candidates.map((candidate) => candidate.taskName),
    ["Prepare launch checklist", "Confirm reviewer coverage", "Publish the final package"]
  );
});

test("newline Tasks with Chinese date prefixes split and prefill DDL", () => {
  const context = {
    groups: [], flows: [], reportToValues: [], managedObjectValues: [],
    referenceDate: new Date(2026, 7, 15, 12, 0, 0)
  };
  const candidates = parser.parse([
    "下周二，徽章考题必须kickoff",
    "下周五，固定资产的徽章考题得写完",
    "8月25日，无形资产的徽章考题完事"
  ].join("\n"), context);
  assert.equal(candidates.length, 3);
  assert.deepEqual(
    candidates.map((candidate) => candidate.taskName),
    ["徽章考题必须kickoff", "固定资产的徽章考题得写完", "无形资产的徽章考题完事"]
  );
  assert.deepEqual(
    candidates.map((candidate) => candidate.ddl),
    ["2026-08-18", "2026-08-21", "2026-08-25"]
  );
});

test("precise local date variants are high-confidence DDL values", () => {
  const referenceDate = new Date(2026, 7, 15, 12, 0, 0);
  const expected = new Map([
    ["本周五", "2026-08-14"],
    ["下周二", "2026-08-18"],
    ["下下周三", "2026-08-26"],
    ["周二", "2026-08-11"],
    ["8-25", "2026-08-25"],
    ["8.25", "2026-08-25"],
    ["8月25日", "2026-08-25"],
    ["2027-8-25", "2027-08-25"],
    ["2027.8.25", "2027-08-25"],
    ["2027/8/25", "2027-08-25"],
    ["2027年8月25日", "2027-08-25"],
    ["27年8月25日", "2027-08-25"]
  ]);
  expected.forEach((ddl, expression) => {
    const parsed = parser.parseFlexibleDate(expression, referenceDate);
    assert.equal(parsed.value, ddl, expression);
    assert.equal(parsed.confidence, "high", expression);
  });
});

test("Task progress aggregate is latest-first and stays within the Excel cell limit", () => {
  const task = baseData().tasks[0];
  const text = richText.progressCellText(task, 32767);
  assert.ok(text.indexOf("第二次更新") < text.indexOf("第一次更新"));
  const oversized = {
    progressEntries: Array.from({ length: 4 }, (_, index) => ({
      contentText: String(index).repeat(12000),
      createdAt: `2026-08-${15 - index}T00:00:00.000Z`,
      updatedAt: `2026-08-${15 - index}T00:00:00.000Z`
    }))
  };
  const truncated = richText.progressCellText(oversized, 32767);
  assert.equal(truncated.length, 32767);
  assert.match(truncated, /Progress History worksheet/);
});

test("re-importable workbook round-trips every progress entry", async () => {
  const source = baseData();
  const buffer = await excelImport.buildXlsxPackage(
    source, JSZip, "nodebuffer", { language: "en" }
  );
  const workbook = XLSX.read(buffer, { type: "buffer" });
  assert.deepEqual(workbook.SheetNames, ["Task Import", "Progress History", "Instructions"]);
  assert.equal(workbook.Sheets["Progress History"]["G5"].v, "第二次更新");
  assert.equal(workbook.Sheets["Progress History"]["G6"].v, "第一次更新");
  const parsed = excelImport.parseWorkbook(arrayBuffer(buffer));
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(
    parsed.rows[0].progressEntries.map((entry) => entry.contentText),
    ["第二次更新", "第一次更新"]
  );
  assert.equal(parsed.rows[0].progressEntries[1].sourceType, "quick-note");
  assert.equal(parsed.rows[0].progressEntries[1].sourceNoteId, "n1");
});

test("dashboard report has Windows-safe three-sheet OOXML with no frozen panes", async () => {
  const buffer = await excelExport.buildXlsxPackage(
    baseData(), JSZip, new Date("2026-08-15T04:00:00.000Z"), "nodebuffer", { language: "en" }
  );
  const zip = await JSZip.loadAsync(buffer);
  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const relationships = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const contentTypes = await zip.file("[Content_Types].xml").async("string");
  const appXml = await zip.file("docProps/app.xml").async("string");
  assert.equal((workbookXml.match(/<sheet name=/g) || []).length, 3);
  assert.match(workbookXml, /name="Progress History"/);
  assert.match(relationships, /worksheets\/sheet3\.xml/);
  assert.match(contentTypes, /worksheets\/sheet3\.xml/);
  assert.match(appXml, /<vt:i4>3<\/vt:i4>/);
  for (const name of ["sheet1.xml", "sheet2.xml", "sheet3.xml"]) {
    const xml = await zip.file(`xl/worksheets/${name}`).async("string");
    assert.doesNotMatch(xml, /<pane\b/);
  }
  assert.doesNotMatch(contentTypes, /macroEnabled|vbaProject|Extension="bin"/i);
  assert.equal(zip.file("xl/vbaProject.bin"), null);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  assert.deepEqual(workbook.SheetNames, ["Overall Dashboard", "Timeline Dashboard", "Progress History"]);
  assert.equal(workbook.Sheets["Progress History"].F2.v, "第二次更新");
});
