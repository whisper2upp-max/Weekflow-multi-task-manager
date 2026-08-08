/* 清理 SheetJS 生成包中的无实际宏却可能触发 Windows Excel 警告的标记。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.App = root.App || {};
  root.App.xlsxSafe = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  var UNSAFE_PART = /vbaProject|externalLinks|connections\.xml|customUI|activeX|embeddings|oleObjects|webextensions/i;

  function sanitizeContentTypes(xml) {
    var cleaned = String(xml || "").replace(
      /<Default\b(?=[^>]*\bExtension="bin")[^>]*\/>/gi,
      ""
    );
    if (/macroEnabled/i.test(cleaned)) {
      throw new Error("Excel 包含不应存在的宏内容类型。");
    }
    return cleaned;
  }

  function sanitizeWorkbookXml(xml) {
    return String(xml || "").replace(
      /(<workbookPr\b[^>]*?)\s+codeName="[^"]*"/i,
      "$1"
    );
  }

  function sanitizeAppProperties(xml) {
    var source = String(xml || "");
    if (/<DocSecurity>/.test(source)) {
      return source.replace(/<DocSecurity>[^<]*<\/DocSecurity>/, "<DocSecurity>0</DocSecurity>");
    }
    return source.replace(
      /(<Application>[^<]*<\/Application>)/,
      "$1<DocSecurity>0</DocSecurity>"
    );
  }

  function buildWorkbookPackage(workbook, XLSX, ZipConstructor, outputType) {
    if (!XLSX || typeof XLSX.write !== "function") {
      return Promise.reject(new Error("Excel 写入组件未加载。"));
    }
    if (typeof ZipConstructor !== "function") {
      return Promise.reject(new Error("Excel 压缩组件未加载。"));
    }
    var bytes = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
      compression: true
    });
    return ZipConstructor.loadAsync(bytes).then(function (zip) {
      var names = Object.keys(zip.files);
      var unsafe = names.find(function (name) {
        return UNSAFE_PART.test(name);
      });
      if (unsafe) throw new Error("Excel 包含不安全内容：" + unsafe);
      var contentTypes = zip.file("[Content_Types].xml");
      var workbookXml = zip.file("xl/workbook.xml");
      var appProperties = zip.file("docProps/app.xml");
      if (!contentTypes || !workbookXml || !appProperties) {
        throw new Error("Excel 包结构不完整。");
      }
      return Promise.all([
        contentTypes.async("string"),
        workbookXml.async("string"),
        appProperties.async("string")
      ]).then(function (parts) {
        zip.file("[Content_Types].xml", sanitizeContentTypes(parts[0]));
        zip.file("xl/workbook.xml", sanitizeWorkbookXml(parts[1]));
        zip.file("docProps/app.xml", sanitizeAppProperties(parts[2]));
        return zip.generateAsync({
          type: outputType || "blob",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          compression: "DEFLATE",
          compressionOptions: { level: 6 }
        });
      });
    });
  }

  return {
    sanitizeContentTypes: sanitizeContentTypes,
    sanitizeWorkbookXml: sanitizeWorkbookXml,
    sanitizeAppProperties: sanitizeAppProperties,
    buildWorkbookPackage: buildWorkbookPackage
  };
});
