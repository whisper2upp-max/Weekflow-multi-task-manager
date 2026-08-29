"use strict";

const fs = require("node:fs");
const path = require("node:path");
const JSZip = require("../vendor/jszip.min.js");
const i18n = require("../js/i18n.js");
const excelImport = require("../js/excel-import.js");
const materialExcel = require("../js/material-excel.js");

const outputDir = path.resolve(__dirname, "../templates");
const emptyData = {
  version: 4,
  groups: [],
  flows: [],
  tasks: [],
  materials: [],
  notes: [],
  preferences: {
    documentLibrary: { layout: "list", columns: 4, groupOrder: ["__ungrouped__"] }
  }
};

async function writeTemplate(filename, bytes) {
  fs.writeFileSync(path.join(outputDir, filename), Buffer.from(bytes));
}

(async () => {
  i18n.setLanguage("zh-CN");
  await writeTemplate(
    "Weekflow_Task导入模板.xlsx",
    await excelImport.buildXlsxPackage(emptyData, JSZip, "nodebuffer", {
      language: "zh-CN",
      template: true
    })
  );
  await writeTemplate(
    "Weekflow_资料库导入模板.xlsx",
    await materialExcel.buildXlsxPackage(emptyData, JSZip, "nodebuffer", {
      language: "zh-CN",
      template: true
    })
  );
  console.log("Weekflow v3.2 release templates regenerated");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
