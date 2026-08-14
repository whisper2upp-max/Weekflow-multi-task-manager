/* 更新日志弹窗：原生 <dialog> + useModalDialog。
   桌面版首个发布（Weekflow Desktop v1.0，2026-08-14）：主条目说明移植定位、桌面架构与
   数据安全/迁移，另附一条 Web 版历史简述；结构与类名沿用原弹窗（.release-entry 等）。
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
