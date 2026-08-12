"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const i18n = require(path.join(root, "js", "i18n.js"));
const XLSX = require(path.join(root, "vendor", "xlsx.full.min.js"));
const JSZip = require(path.join(root, "vendor", "jszip.min.js"));
const excelImport = require(path.join(root, "js", "excel-import.js"));
const materialExcel = require(path.join(root, "js", "material-excel.js"));
const excelExport = require(path.join(root, "js", "excel-export.js"));

function sampleData() {
  return {
    version: 3,
    groups: [{ id: "g1", name: "Service Delivery", color: "#665CFF", order: 1 }],
    flows: [{ id: "f1", groupId: "g1", name: "Review Flow", color: "#665CFF", order: 1 }],
    tasks: [{
      id: "t1", groupId: "g1", flowId: "f1", flowOrder: 1, name: "Review Package",
      reportTo: "Lucy Chen", managedObject: "Jack Wang", deliverable: "Approved package",
      ddl: "2026-08-14", urgency: "high", status: "pending", completedAt: null,
      recurrenceCadence: "none", recurrenceStart: null, recurrenceEnd: null,
      recurrenceCompletions: [], progressNote: "Ready for review"
    }],
    materials: [{
      id: "m1", title: "Review Guide", url: "https://example.com/guide", type: "document",
      taskIds: ["t1"], flowIds: [], groupIds: [], note: "Reference", openEvents: []
    }]
  };
}

test("English is the exploration-branch default and Chinese remains selectable", () => {
  assert.equal(i18n.getLanguage(), "en");
  assert.equal(i18n.normalizeLanguage("zh-CN"), "zh-CN");
  assert.equal(i18n.normalizeLanguage("en-US"), "en");
  assert.equal(
    i18n.translateMessage("确认删除 Task「Review Package」？此操作不可恢复。"),
    "Delete Task “Review Package”? This action cannot be undone."
  );
  assert.equal(
    i18n.translateMessage("第 8 行：分组不能为空"),
    "Row 8: Group is required"
  );
});

test("page contains the isolated language switch beside Document Library", () => {
  const html = fs.readFileSync(path.join(root, "Weekflow.html"), "utf8");
  assert.match(html, /data-view="materials"[\s\S]*class="language-switch"/);
  assert.match(html, /data-language="zh-CN"/);
  assert.match(html, /data-language="en"/);
  assert.match(html, /js\/i18n\.js/);
});

test("English current-Task workbook has English sheets and can be imported", async () => {
  i18n.setLanguage("en");
  const workbook = excelImport.buildWorkbook(sampleData(), { language: "en" });
  assert.deepEqual(workbook.SheetNames, ["Task Import", "Instructions"]);
  assert.equal(workbook.Sheets["Task Import"].A4.v, "Group*");
  assert.equal(workbook.Sheets["Task Import"].L5.v, "High");
  const buffer = await excelImport.buildXlsxPackage(sampleData(), JSZip, "nodebuffer", { language: "en" });
  const parsed = excelImport.parseWorkbook(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.rows[0].taskName, "Review Package");
  assert.equal(parsed.rows[0].urgency, "high");
});

test("English and Chinese blank templates use the selected language and re-import", async () => {
  i18n.setLanguage("en");
  const empty = { groups: [], flows: [], tasks: [], materials: [] };
  const enTask = excelImport.buildWorkbook(empty, { language: "en", template: true });
  const enMaterials = materialExcel.buildWorkbook(empty, { language: "en", template: true });
  assert.equal(enTask.Sheets["Task Import"].A1.v, "Weekflow Task Import Template");
  assert.deepEqual(enMaterials.SheetNames, ["Document Import"]);
  assert.equal(enMaterials.Sheets["Document Import"].A1.v, "Link Name*");

  const zhTaskBuffer = await excelImport.buildXlsxPackage(
    empty, JSZip, "nodebuffer", { language: "zh-CN", template: true }
  );
  const zhMaterialsBuffer = await materialExcel.buildXlsxPackage(
    empty, JSZip, "nodebuffer", { language: "zh-CN", template: true }
  );
  const zhTask = XLSX.read(zhTaskBuffer, { type: "buffer" });
  const zhMaterials = XLSX.read(zhMaterialsBuffer, { type: "buffer" });
  assert.deepEqual(zhTask.SheetNames, ["Task导入", "填写说明"]);
  assert.equal(zhTask.Sheets["Task导入"].A4.v, "分组*");
  assert.deepEqual(zhMaterials.SheetNames, ["资料库导入"]);
  assert.equal(zhMaterials.Sheets["资料库导入"].A1.v, "链接名称*");
});

test("English Document Library workbook has English headers and can be imported", async () => {
  i18n.setLanguage("en");
  const workbook = materialExcel.buildWorkbook(sampleData(), { language: "en" });
  assert.deepEqual(workbook.SheetNames, ["Document Library"]);
  assert.equal(workbook.Sheets["Document Library"].A1.v, "Link Name*");
  assert.equal(workbook.Sheets["Document Library"].C2.v, "Documentation");
  const buffer = await materialExcel.buildXlsxPackage(sampleData(), JSZip, "nodebuffer", { language: "en" });
  const parsed = materialExcel.parseWorkbook(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.rows[0].type, "document");
});

test("legacy English Materials Import workbooks remain upload-compatible", async () => {
  i18n.setLanguage("en");
  const workbook = materialExcel.buildWorkbook(sampleData(), { language: "en", template: true });
  workbook.SheetNames[0] = "Materials Import";
  workbook.Sheets["Materials Import"] = workbook.Sheets["Document Import"];
  delete workbook.Sheets["Document Import"];
  workbook.Sheets["Materials Import"].A1.v = "Material Name";
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const parsed = materialExcel.parseWorkbook(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.sheetName, "Materials Import");
});

test("English dashboard report keeps Windows-safe OOXML and English names", async () => {
  i18n.setLanguage("en");
  const buffer = await excelExport.buildXlsxPackage(
    sampleData(), JSZip, new Date(2026, 7, 12, 12), "nodebuffer", { language: "en" }
  );
  const zip = await JSZip.loadAsync(buffer);
  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const appXml = await zip.file("docProps/app.xml").async("string");
  const contentTypes = await zip.file("[Content_Types].xml").async("string");
  assert.match(workbookXml, /name="Overall Dashboard"/);
  assert.match(workbookXml, /name="Timeline Dashboard"/);
  assert.match(workbookXml, /&apos;Timeline Dashboard&apos;!\$A\$1/);
  assert.match(appXml, /<DocSecurity>0<\/DocSecurity>/);
  assert.doesNotMatch(contentTypes, /macroEnabled|vbaProject|Extension="bin"/i);
  assert.equal(zip.file("xl/vbaProject.bin"), null);
  assert.equal(zip.file("xl/externalLinks/externalLink1.xml"), null);
  assert.equal(zip.file("xl/connections.xml"), null);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  assert.deepEqual(workbook.SheetNames, ["Overall Dashboard", "Timeline Dashboard"]);
  assert.equal(workbook.Sheets["Timeline Dashboard"].A1.v, "Group");
  assert.equal(workbook.Sheets["Timeline Dashboard"].R1.v, "Related Documents");
});
