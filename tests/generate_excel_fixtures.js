"use strict";

const fs = require("node:fs");
const path = require("node:path");
const JSZip = require("../vendor/jszip.min.js");
const i18n = require("../js/i18n.js");
const excelImport = require("../js/excel-import.js");
const materialExcel = require("../js/material-excel.js");
const excelExport = require("../js/excel-export.js");

const outputDir = process.argv[2] || "/tmp/weekflow-excel-verification";
fs.mkdirSync(outputDir, { recursive: true });
i18n.setLanguage("en");

const data = {
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
    taskIds: ["t1"], flowIds: ["f1"], groupIds: ["g1"], note: "Reference", openEvents: []
  }]
};

async function save(name, bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  fs.writeFileSync(path.join(outputDir, name), buffer);
}

(async () => {
  await save("01_Task_Import_Template_EN.xlsx", await excelImport.buildXlsxPackage(
    { groups: [], flows: [], tasks: [], materials: [] }, JSZip, "nodebuffer", { language: "en", template: true }
  ));
  await save("02_Current_Task_Data_EN.xlsx", await excelImport.buildXlsxPackage(
    data, JSZip, "nodebuffer", { language: "en" }
  ));
  await save("03_Document_Import_Template_EN.xlsx", await materialExcel.buildXlsxPackage(
    { groups: [], flows: [], tasks: [], materials: [] }, JSZip, "nodebuffer", { language: "en", template: true }
  ));
  await save("04_Document_Library_EN.xlsx", await materialExcel.buildXlsxPackage(
    data, JSZip, "nodebuffer", { language: "en" }
  ));
  await save("05_Dashboard_Report_EN.xlsx", await excelExport.buildXlsxPackage(
    data, JSZip, new Date(2026, 7, 12, 12), "nodebuffer", { language: "en" }
  ));
  await save("06_Managed_Person_Report_EN.xlsx", await excelExport.buildTaskStatusXlsxPackage(
    data, JSZip, { field: "managedObject", value: "Jack Wang", label: "Jack Wang", language: "en" },
    new Date(2026, 7, 12, 12), "nodebuffer"
  ));
  await save("07_Report_To_Report_EN.xlsx", await excelExport.buildTaskStatusXlsxPackage(
    data, JSZip, { field: "reportTo", value: "Lucy Chen", label: "Lucy Chen", language: "en" },
    new Date(2026, 7, 12, 12), "nodebuffer"
  ));
  console.log(outputDir);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
