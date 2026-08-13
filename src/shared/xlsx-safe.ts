/* 清理 SheetJS 生成包中的无实际宏却可能触发 Windows Excel 警告的标记。 */
import * as XLSX from "xlsx";
import JSZip from "jszip";

const UNSAFE_PART =
  /vbaProject|externalLinks|connections\.xml|customUI|activeX|embeddings|oleObjects|webextensions/i;

export type WorkbookOutputType = "uint8array" | "arraybuffer";

export function sanitizeContentTypes(xml: string): string {
  const cleaned = String(xml || "").replace(
    /<Default\b(?=[^>]*\bExtension="bin")[^>]*\/>/gi,
    ""
  );
  if (/macroEnabled/i.test(cleaned)) {
    throw new Error("Excel 包含不应存在的宏内容类型。");
  }
  return cleaned;
}

export function sanitizeWorkbookXml(xml: string): string {
  return String(xml || "").replace(
    /(<workbookPr\b[^>]*?)\s+codeName="[^"]*"/i,
    "$1"
  );
}

export function sanitizeAppProperties(xml: string): string {
  const source = String(xml || "");
  if (/<DocSecurity>/.test(source)) {
    return source.replace(
      /<DocSecurity>[^<]*<\/DocSecurity>/,
      "<DocSecurity>0</DocSecurity>"
    );
  }
  return source.replace(
    /(<Application>[^<]*<\/Application>)/,
    "$1<DocSecurity>0</DocSecurity>"
  );
}

export function buildWorkbookPackage(
  workbook: XLSX.WorkBook,
  outputType?: "uint8array"
): Promise<Uint8Array>;
export function buildWorkbookPackage(
  workbook: XLSX.WorkBook,
  outputType: "arraybuffer"
): Promise<ArrayBuffer>;
export function buildWorkbookPackage(
  workbook: XLSX.WorkBook,
  outputType: WorkbookOutputType
): Promise<Uint8Array | ArrayBuffer>;
export function buildWorkbookPackage(
  workbook: XLSX.WorkBook,
  outputType: WorkbookOutputType = "uint8array"
): Promise<Uint8Array | ArrayBuffer> {
  const bytes = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
    compression: true
  });
  return JSZip.loadAsync(bytes).then((zip) => {
    const names = Object.keys(zip.files);
    const unsafe = names.find((name) => UNSAFE_PART.test(name));
    if (unsafe) throw new Error("Excel 包含不安全内容：" + unsafe);
    const contentTypes = zip.file("[Content_Types].xml");
    const workbookXml = zip.file("xl/workbook.xml");
    const appProperties = zip.file("docProps/app.xml");
    if (!contentTypes || !workbookXml || !appProperties) {
      throw new Error("Excel 包结构不完整。");
    }
    return Promise.all([
      contentTypes.async("string"),
      workbookXml.async("string"),
      appProperties.async("string")
    ]).then((parts) => {
      zip.file("[Content_Types].xml", sanitizeContentTypes(parts[0]));
      zip.file("xl/workbook.xml", sanitizeWorkbookXml(parts[1]));
      zip.file("docProps/app.xml", sanitizeAppProperties(parts[2]));
      return zip.generateAsync({
        type: outputType,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });
    });
  });
}
