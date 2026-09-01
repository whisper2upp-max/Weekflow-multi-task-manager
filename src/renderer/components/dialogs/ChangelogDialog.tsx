/* 更新日志弹窗：原生 <dialog> + useModalDialog。
   Desktop v1.2.0 为最新已发布版本，功能同步 Web v3.1/v3.2，
   旧版条目继续保留并按新到旧排列。
   维护约定：后续只有新增功能才追加条目，移植与架构说明不再重复。
   英文模式按 isEnglish() 渲染英文 JSX（等价原版整篇 innerHTML 替换机制）。 */
import { useUiStore } from "../../store/uiStore";
import { useModalDialog } from "../../lib/useModalDialog";
import { isEnglish } from "../../lib/i18n";

/* 英文条目（与中文版 JSX 同步直译）：主条目 + Web 版历史简述 */
const EN_ENTRIES: ReadonlyArray<{
  title: string;
  date: string;
  lead: string;
  sections: ReadonlyArray<{ heading: string; items: readonly string[] }>;
}> = [
  {
    title: "Weekflow Desktop v1.2.0",
    date: "2026-09-01",
    lead: "Feature alignment with Web v3.1 and v3.2: optional AI, Excel-compatible note tables, Favorites, richer formatting, and safer Task draft prefill are now available in the desktop app.",
    sections: [
      {
        heading: "Optional AI and Safer Conversion",
        items: [
          "Added local AI settings for DeepSeek, DashScope, Kimi, GLM, MiniMax, and custom OpenAI-compatible endpoints. API Keys remain local and never enter business JSON or Excel exports.",
          "AI note rewriting preserves embedded tables and uses the same side-by-side comparison layout as the Web edition. Task draft conversion always starts with local rules and sends note content only after the user explicitly chooses Parse with AI and confirms the request.",
          "When AI omits an obvious value, the deterministic fallback can safely prefill DDL, Group, Report To, Managed Person, and Deliverable; fields that cannot be resolved reliably stay blank."
        ]
      },
      {
        heading: "Excel-compatible Note Tables",
        items: [
          "Paste Excel ranges, including merged cells, into Quick Notes; create tables from the toolbar; insert or delete rows and columns; merge cells; select a rectangle or the entire table; and copy back to Excel.",
          "Structural table operations support undo and redo. Whole-table Delete/Backspace behavior follows the operating system convention, with an explicit Delete Entire Table action in the nested Table menu."
        ]
      },
      {
        heading: "Favorites and Rich-text Improvements",
        items: [
          "Added starred Quick Note Favorites and a Favorites filter; favorite state is included in JSON backup and restore.",
          "Added 12/14/16/18/22 font sizes to Notes and progress records while retaining the existing preset text and highlight palettes."
        ]
      }
    ]
  },
  {
    title: "Weekflow Desktop v1.1.0",
    date: "2026-08-15",
    lead: "Feature alignment with Web v2.6 and v2.7: dual Document Library layouts, Quick Notes, rich-text progress history, and local Task draft conversion are now available in the Tauri desktop app.",
    sections: [
      {
        heading: "Document Library Layouts",
        items: [
          "Added List / Group switching. Group layout organizes documents into fixed-height cards by Task Group, ranks them by recent opens, and keeps selection, deletion, editing, upload, and download workflows.",
          "Arrange Layout supports one to four Groups per row and drag reordering. The selected layout, column count, and Group order are included in JSON backup and restore."
        ]
      },
      {
        heading: "Quick Notes and Task Drafts",
        items: [
          "Added a bilingual Quick Notes workspace with rich text, SharePoint links, and 20 preset text colors plus 20 preset highlight colors.",
          "A note can append a new timestamped progress record to a selected Task or become one or more reviewable Task drafts. The local rule engine recognizes line breaks, numbered items, common Chinese/English dates, and weekly/monthly recurrence without using AI."
        ]
      },
      {
        heading: "Progress History and Excel",
        items: [
          "Each Task now supports multiple independently editable progress records. Existing single progress notes migrate automatically to data v4.",
          "Task import/current-data workbooks and dashboard reports add a Progress History worksheet. The Task row keeps all progress records in one wrapped cell, newest first; the history worksheet lists one record per row.",
          "Excel packages remain generated without locked default views and retain the Windows-safe workbook structure used by the previous desktop release."
        ]
      }
    ]
  },
  {
    title: "Weekflow Desktop v1.0",
    date: "2026-08-14",
    lead: "The first desktop release: Weekflow is fully ported from the Web version (v2.5) to a macOS desktop app, with complete feature parity to Web v2.5.",
    sections: [
      {
        heading: "Feature Parity with Web v2.5",
        items: [
          "Timeline boards (Task by Week / Task by Day), Flow workflows, recurring deadlines, the Overall Dashboard, Document Library, Excel bulk import and export, JSON backup and restore, deadline reminders, and Chinese/English switching are all carried over unchanged.",
          "Use the Chinese / EN switch at the top right; the UI and Excel exports (headers, sheet names, and filenames) follow the selected language."
        ]
      },
      {
        heading: "Desktop Architecture",
        items: [
          "The desktop shell is built on Tauri 2 with a Rust backend; the interface renders in the system WebView (WKWebView on macOS), the frontend is React + TypeScript, and Excel support uses SheetJS + JSZip.",
          "Compared with bundling an entire Chromium runtime, the installer drops from about 277 MB to about 3.6 MB, with lower memory usage and faster startup.",
          "Data is written to a real local JSON file instead of browser localStorage, which could lose data when site data is cleared, a private window is used, or the browser is switched.",
          "Imports and exports use the native system file dialogs."
        ]
      },
      {
        heading: "Data Safety and Migration",
        items: [
          "The data file weekflow-data.json is saved immediately on every change; before each save, the previous file is copied into the backups/ directory as a rotating backup, keeping the 30 most recent.",
          "If the primary data file is corrupted, Weekflow Desktop restores it automatically from the backups and keeps the corrupted file as a corrupt backup.",
          "The data format is identical to the Web version's data v3: choose Export JSON Backup in the Web version, then Restore from JSON here to complete the migration."
        ]
      }
    ]
  },
  {
    title: "Web Version History · v1.0 (2026-07-30) — v2.5 (2026-08-12)",
    date: "2026-08-12",
    lead: "The weekly timeline board, Flow workflows, recurring deadlines, Document Library, Excel bulk import, and the rest of the feature set were built up across Web v1.0–v2.5; see the Web version changelog for the detailed entries. The desktop version is a complete port on top of that foundation.",
    sections: []
  }
];

export default function ChangelogDialog() {
  const dialog = useUiStore((state) => (state.dialog?.type === "changelog" ? state.dialog : null));
  const closeDialog = useUiStore((state) => state.closeDialog);
  const ref = useModalDialog(!!dialog, closeDialog);

  if (!dialog) return null;
  const english = isEnglish();

  return (
    <dialog ref={ref} id="changelog-dialog" className="modal document-modal changelog-modal">
      <div className="modal-head">
        <div>
          <p className="eyebrow">Release notes</p>
          <h2>{english ? "Weekflow Changelog" : "Weekflow 更新日志"}</h2>
        </div>
        <button className="icon-button" type="button" data-action="close-changelog" aria-label={english ? "Close" : "关闭"} onClick={closeDialog}>×</button>
      </div>
      {english ? (
        <article className="document-content changelog-content">
          {EN_ENTRIES.map((entry) => (
            <div className="release-entry" key={entry.title}>
              <div className="release-heading">
                <span>{entry.title}</span>
                <time>{entry.date}</time>
              </div>
              <p className="release-lead">{entry.lead}</p>
              {entry.sections.map((section) => (
                <section key={section.heading}>
                  <h3>{section.heading}</h3>
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ))}
          <p>Development team: Wesley Yan</p>
        </article>
      ) : (
      <article className="document-content changelog-content">
        <div className="release-entry" data-version="desktop-1.2.0">
          <div className="release-heading">
            <span>Weekflow Desktop v1.2.0</span>
            <time dateTime="2026-09-01">2026-09-01</time>
          </div>
          <p className="release-lead">同步 Web v3.1 与 v3.2：桌面版新增可选 AI、Excel 兼容笔记表格、笔记收藏、字号控制，并增强 Task 草稿安全预填。</p>
          <section>
            <h3>可选 AI 与安全转换</h3>
            <ul>
              <li>新增本机 AI 设置，支持 DeepSeek、百炼、Kimi、GLM、MiniMax 和自定义 OpenAI 兼容接口；API Key 不进入业务 JSON 或 Excel。</li>
              <li>AI 笔记改写会保护内嵌表格，并使用与 Web 版一致的双栏对照布局；Task 草稿始终先跑本地规则，只有用户主动点击“使用 AI 解析”并确认后才发送笔记正文。</li>
              <li>AI 漏掉明显字段时，确定性规则会安全补填 DDL、分组、汇报对象、管理对象和交付物；无法可靠解析的字段保持空白。</li>
            </ul>
          </section>
          <section>
            <h3>Excel 兼容笔记表格</h3>
            <ul>
              <li>支持从 Excel 粘贴含合并单元格的区域、工具栏新建表格、插删行列、合并单元格、矩形或整表选取，并可复制回 Excel。</li>
              <li>表格结构操作支持撤销与重做；整表 Delete / Backspace 遵循操作系统习惯，嵌套表格菜单同时提供“删除整个表格”。</li>
            </ul>
          </section>
          <section>
            <h3>收藏与富文本</h3>
            <ul>
              <li>随手记新增星号收藏与收藏夹筛选，收藏状态会随 JSON 备份恢复。</li>
              <li>笔记和进度记录新增 12/14/16/18/22 五档字号，并继续使用既有的预设字色与高亮色盘。</li>
            </ul>
          </section>
        </div>

        <div className="release-entry" data-version="desktop-1.1.0">
          <div className="release-heading">
            <span>Weekflow Desktop v1.1.0</span>
            <time dateTime="2026-08-15">2026-08-15</time>
          </div>
          <p className="release-lead">同步 Web v2.6 与 v2.7：Tauri 桌面版新增资料库双布局、随手记、富文本多条进度历史和纯本地 Task 草稿转换。</p>
          <section>
            <h3>资料库双布局</h3>
            <ul>
              <li>新增 List / Group 切换；Group 按 Task 分组显示固定高度资料栏，按近期打开次数排序，并保留勾选删除、编辑、上传和下载。</li>
              <li>“调整布局”支持每行 1–4 个分组及拖动排序；布局模式、列数和顺序会随 JSON 备份恢复。</li>
            </ul>
          </section>
          <section>
            <h3>随手记与 Task 草稿</h3>
            <ul>
              <li>新增中英文随手记，支持富文本、SharePoint 链接、20 种预设字色和 20 种预设高亮色。</li>
              <li>笔记可追加为某 Task 的新进度记录，或转换成一个或多个逐条确认的 Task 草稿；纯本地规则可识别换行、编号、常见中英文日期和每周/每月周期，不调用 AI。</li>
            </ul>
          </section>
          <section>
            <h3>进度历史、数据与 Excel</h3>
            <ul>
              <li>每个 Task 支持多条独立编辑、带时间戳的进度记录；旧单条进度自动迁移到 data v4。</li>
              <li>Task 模板、当前数据和看板报告新增“进度历史”工作表；Task 主行按新到旧在同一格换行显示全部进度，历史表按一条记录一行列示。</li>
              <li>Excel 继续采用不锁定默认视图、兼容 Windows Excel 的安全工作簿结构。</li>
            </ul>
          </section>
        </div>

        <div className="release-entry" data-version="desktop-1.0">
          <div className="release-heading">
            <span>Weekflow Desktop v1.0</span>
            <time dateTime="2026-08-14">2026-08-14</time>
          </div>
          <p className="release-lead">首个桌面版本：Weekflow 从 Web 版（v2.5）完整移植为 macOS 桌面应用，功能与 Web 版 v2.5 完全对齐。</p>
          <section>
            <h3>功能与 Web 版 v2.5 对齐</h3>
            <ul>
              <li>时间轴看板（Task by Week / Task by Day）、Flow 工作流、周期 DDL、整体看板、资料库、Excel 批量录入与导出、JSON 备份恢复、DDL 提醒、中英文切换全部保留，用法不变。</li>
              <li>右上角 中文 / EN 切换界面语言；Excel 导出的表头、工作表名和文件名均跟随当前语言。</li>
            </ul>
          </section>
          <section>
            <h3>桌面架构</h3>
            <ul>
              <li>桌面壳采用 Tauri 2 + Rust 后端，界面由系统 WebView（macOS WKWebView）渲染，前端为 React + TypeScript，Excel 能力使用 SheetJS + JSZip。</li>
              <li>相比打包整个 Chromium 的方案，安装包从约 277MB 降至约 3.6MB，内存占用更低、启动更快。</li>
              <li>数据真正写入本地 JSON 文件，不再受浏览器 localStorage 限制（清除网站数据、无痕窗口、更换浏览器都可能丢失数据）。</li>
              <li>导入导出使用系统原生文件对话框。</li>
            </ul>
          </section>
          <section>
            <h3>数据安全与迁移</h3>
            <ul>
              <li>数据文件 <code>weekflow-data.json</code> 每次修改立即保存；保存前自动把旧文件复制进 backups/ 轮换备份，保留最近 30 份。</li>
              <li>主数据文件损坏时自动从备份恢复，并把损坏文件留存为 corrupt 备份。</li>
              <li>数据格式与 Web 版 data v3 完全一致：在 Web 版「导出 JSON 备份」，再在本版「从 JSON 恢复」即可完成迁移。</li>
            </ul>
          </section>
        </div>

        <div className="release-entry" data-version="web-history">
          <div className="release-heading">
            <span>Web 版历史 · v1.0（2026-07-30）— v2.5（2026-08-12）</span>
            <time dateTime="2026-08-12">2026-08-12</time>
          </div>
          <p className="release-lead">时间轴看板、Flow 工作流、周期 DDL、资料库、Excel 批量录入等能力在 Web 版 v1.0–v2.5 中逐步建立，详细条目见 Web 版更新日志；桌面版在此基础上完整移植。</p>
        </div>

        <p>开发团队：Wesley Yan</p>
      </article>
      )}
      <div className="modal-actions">
        <button className="button button-primary" type="button" data-action="close-changelog" onClick={closeDialog}>{english ? "Close" : "关闭"}</button>
      </div>
    </dialog>
  );
}
