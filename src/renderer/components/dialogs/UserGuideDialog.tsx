/* 使用说明弹窗：原生 <dialog> + useModalDialog。Weekflow Desktop v1.0 桌面版内容：
   功能条目沿用 Web 版 v2.5 口径并新增语言切换说明；「数据保存位置」一节为 JSON 文件存储
   （window.weekflow.getDataInfo() 展示真实路径，backups/ 保留最近 30 份轮换备份、
   主文件损坏自动从备份恢复），并说明与 Web 版（浏览器 localStorage）的差异及迁移方法。
   英文模式按 isEnglish() 渲染英文 JSX（等价原版 englishGuideHtml 整篇替换机制；
   英文内容直译当前中文内容，措辞沿用原版英文文案习惯）。 */
import { useEffect, useState } from "react";
import { useUiStore } from "../../store/uiStore";
import { useModalDialog } from "../../lib/useModalDialog";
import { isEnglish } from "../../lib/i18n";

interface DataInfo {
  dataFile: string;
  backupsDir: string;
  backupCount: number;
}

export default function UserGuideDialog() {
  const dialog = useUiStore((state) => (state.dialog?.type === "userGuide" ? state.dialog : null));
  const closeDialog = useUiStore((state) => state.closeDialog);
  const pushToast = useUiStore((state) => state.pushToast);
  const ref = useModalDialog(!!dialog, closeDialog);
  const [dataInfo, setDataInfo] = useState<DataInfo | null>(null);

  /* 弹窗打开时读取真实数据文件 / 备份目录路径 */
  useEffect(() => {
    if (!dialog) return;
    let cancelled = false;
    window.weekflow
      .getDataInfo()
      .then((info) => {
        if (!cancelled) setDataInfo(info);
      })
      .catch(() => {
        /* 路径展示失败不阻断说明阅读 */
      });
    return () => {
      cancelled = true;
    };
  }, [dialog]);

  if (!dialog) return null;
  const english = isEnglish();

  /* 在系统文件管理器中显示数据文件 / 打开备份目录 */
  const reveal = (path: string | undefined) => {
    if (!path) return;
    void window.weekflow.revealPath(path).then((result) => {
      if (!result.ok) {
        pushToast("无法打开目录，请手动访问上方路径", "error");
      }
    });
  };
  const revealButton = (path: string | undefined, label: string) => (
    <p>
      <button
        className="button button-quiet button-small"
        type="button"
        disabled={!path}
        onClick={() => reveal(path)}
      >
        {label}
      </button>
    </p>
  );

  return (
    <dialog ref={ref} id="user-guide-dialog" className="modal document-modal">
      <div className="modal-head">
        <div>
          <p className="eyebrow">Quick guide</p>
          <h2>{english ? "Weekflow Desktop User Guide" : "Weekflow Desktop 使用说明"}</h2>
        </div>
        <button className="icon-button" type="button" data-action="close-user-guide" aria-label={english ? "Close" : "关闭"} onClick={closeDialog}>×</button>
      </div>
      {english ? (
        <article className="document-content">
          <p className="guide-intro">
            Weekflow is a Multi-task management cockpit for tracking progress across multiple Tasks and organizing all related documents in one place.
          </p>
          <section>
            <h3>Key Features</h3>
            <ul>
              <li><b>Timeline:</b> Task by Week shows Task deadlines by natural week. Double-click any week header to open Task by Day, which shows only that week&apos;s deadlines from Monday through Sunday. Use Return to Task by Week to go back.</li>
              <li><b>Task Management:</b> Create and edit Tasks with progress notes, completion status, and related documents. Urgency, Report To, and Deliverable are required; Report To and Managed Person are entered as person names. Recurrence can be weekly or monthly with required start and end dates.</li>
              <li><b>Recurring Deadlines:</b> A recurring Task is counted once but displays multiple deadlines based on its anchor weekday or date. Completing the current period also completes all previous periods; the next period resets while the continuous completion history remains.</li>
              <li><b>Flow Workflow:</b> Use the optional Flow layer between Groups and Tasks to define ordered steps. Tasks can be reordered by dragging, and new Flows inherit their Group color by default.</li>
              <li><b>Deadline Reminder:</b> On entry, a non-blocking reminder lists incomplete Tasks due within seven days and closes automatically after ten seconds.</li>
              <li><b>Filters and Dashboards:</b> Filter the timeline by Group, Flow, status, urgency, overdue state, or keywords. Popovers close when another menu or blank area is selected. The Overall Dashboard always shows totals, completed, incomplete, overdue, and completion rate, with details by Group, Flow, Managed Person, or Report To.</li>
              <li><b>People Summaries and Exports:</b> The Overall Dashboard summarizes completion rate and completed, incomplete, and overdue counts for each Managed Person and Report To, with one-click Task status export.</li>
              <li><b>Excel Bulk Import:</b> The 20-column Task template includes recurrence, date range, and completion history. Download a blank template or current data in the same format, validate the upload preview, then choose supplement import or complete replacement.</li>
              <li><b>Document Library:</b> Manage Documentation, Deliverables, Control Sheets, and Folders in one place. Search and Type, Group, Flow, and Task filters sit above the table. Relations follow Group → Flow → Task and sync both ways with the timeline.</li>
              <li><b>Recently Used:</b> Filter documents opened at least once during the current or previous natural week.</li>
              <li><b>Document Import and Cleanup:</b> Document Excel import supports supplement import or overwrite all. Duplicate URLs can be replaced or skipped, and bulk deletion requires two confirmations.</li>
              <li><b>Language Switch:</b> Use Chinese / EN at the top right to switch the interface language at any time; Excel exports (headers, sheet names, and filenames) follow the selected language.</li>
            </ul>
          </section>
          <section>
            <h3>Data Storage Location</h3>
            <p>Data is stored as a JSON file in the local application data directory. The data file is:</p>
            <pre>{dataInfo ? dataInfo.dataFile : "Loading…"}</pre>
            {revealButton(dataInfo?.dataFile, "Show in Folder")}
            <p>Before every save, the previous data file is copied into the backups/ directory, keeping the 30 most recent rotating backups{dataInfo ? ` (currently ${dataInfo.backupCount})` : ""}:</p>
            <pre>{dataInfo ? dataInfo.backupsDir : "Loading…"}</pre>
            {revealButton(dataInfo?.backupsDir, "Open Backups Folder")}
            <p>If the primary data file is corrupted, Weekflow Desktop restores it automatically from the rotating backups and keeps the corrupted file as a corrupt backup.</p>
            <p>Compared with the Web version: the Web version stored data in the browser&apos;s localStorage, where clearing site data, using a private window, or switching browsers could lose data. The desktop version writes a real local JSON file and no longer depends on the browser. To migrate from the Web version, choose Export JSON Backup there, then Restore from JSON here — the data format is identical.</p>
            <p>Deleting or moving the data file, or switching computers or system users, changes which data is visible.</p>
          </section>
          <section>
            <h3>Data Backup and Restore</h3>
            <ol>
              <li>Open the <b>•••</b> data menu at the top.</li>
              <li>Choose Export JSON Backup and save the file in a safe location.</li>
              <li>To restore, choose Restore from JSON. Weekflow validates the data and asks for confirmation first.</li>
            </ol>
            <p>Export a JSON backup before bulk changes, migrating to another computer, or deleting the data file.</p>
          </section>
          <section>
            <h3>Excel Bulk Import</h3>
            <ol>
              <li>Open the <b>•••</b> data menu and download a blank Excel import template, or choose Download Current Data in Import Format.</li>
              <li>Fill in or adjust the Task Import worksheet; each row represents one Task.</li>
              <li>Choose Upload Excel for Bulk Import and review the errors and data preview.</li>
              <li>Choose Supplement Import or Complete Replacement, then confirm to run the import.</li>
            </ol>
            <p>Missing Groups and Flows are created automatically; existing items with the same names are reused. A blank Flow color inherits the Group color.</p>
            <p>Recurrence can be Does not repeat, Weekly, or Monthly; recurring Tasks require start and end dates. Recurrence Completion History carries the full completion record and can stay blank for manually created Tasks.</p>
            <p>Supplement Import keeps existing timeline data and adds Tasks. Complete Replacement asks for two confirmations and replaces every Group, Flow, and Task with the file. Documents are not deleted, and matching hierarchy names keep their original IDs to preserve relations.</p>
            <p>Group, Task Name, DDL, Urgency, Report To, and Deliverable are required.</p>
          </section>
          <section>
            <h3>Excel Export</h3>
            <p>Export Dashboard Report creates an <code>.xlsx</code> file with Overall Dashboard and Timeline Dashboard worksheets.</p>
            <p>The file contains every Task, Group and Flow statistics, step numbers, recurrence and date ranges, progress notes, the weekly DDL timeline, and full links. Week labels distinguish completed, overdue, and pending, regardless of the active filters.</p>
            <p>The dashboard report is for reading and reporting, not for bulk import. To re-import, use Download Current Data in Import Format.</p>
            <p>The Overall Dashboard&apos;s Managed Person and Report To modules export Task status for a single person; the file contains only that person&apos;s Tasks, sorted by Group, with DDL, completion status, urgency, progress notes, Deliverables, and related documents.</p>
            <p>The Document Library&apos;s Download menu provides its blank template and complete library; Upload imports Excel files.</p>
          </section>
          <section>
            <h3>Development Team</h3>
            <p>Development team: Wesley Yan</p>
            <p>First desktop release (v1.0): August 14, 2026</p>
            <p>Ported from Web v2.5</p>
          </section>
        </article>
      ) : (
      <article className="document-content">
        <p className="guide-intro">
          这是一款 Multi-task 管理的座舱程序，具备多任务进度管理、任务相关资料汇总整理的功能。
        </p>
        <section>
          <h3>主要功能</h3>
          <ul>
            <li><b>时间轴看板：</b>主界面 Task by Week 按自然周查看 Task DDL；双击任意周表头进入 Task by Day，只显示该周 DDL，并按周一至周日精确落到具体日期。日视图通过“返回 Task by Week”回到周时间轴。</li>
            <li><b>Task 管理：</b>创建和编辑 Task，可记录进度、完成状态和相关资料；紧急程度、汇报对象和交付物为必填项，汇报对象与管理对象均按人员姓名录入。周期可选每周或每月，需指定周期开始和结束日期。</li>
            <li><b>周期 DDL：</b>周期 Task 仍只统计为一条 Task，但时间轴会按基准 DDL 的星期或日期显示多个 DDL；勾选本期完成会同时视同此前各期完成，下一周期自动恢复未勾选并保留之前的连续完成记录。</li>
            <li><b>Flow 工作流：</b>在分组和 Task 之间增加可选步骤层，支持拖动排序；新 Flow 默认继承所属分组颜色。</li>
            <li><b>DDL 提醒：</b>每次进入程序会在右下角播报未来 7 天内的未完成 Task，10 秒后自动关闭，悬浮时不影响页面操作。</li>
            <li><b>筛选与看板：</b>时间轴可按分组、Flow、状态、紧急程度、逾期或关键词组合筛选；筛选弹层会在切换菜单或点击空白处时关闭。整体看板常驻显示 Task 总数、已完成、未完成、当前逾期和完成率，并可按分组、Flow、管理对象或汇报对象切换查看详细进度。</li>
            <li><b>对象汇总与导出：</b>整体看板按人员姓名分别汇总每个管理对象和汇报对象的完成率、已完成、未完成及逾期数量，并一键导出该人员的 Task 状态。</li>
            <li><b>Excel 批量录入：</b>20 列 Task 模板包含周期、周期起止和完成历史，可下载空白模板或按模板下载当前数据，上传后先校验预览，再选择补充导入或完整覆盖。</li>
            <li><b>资料库：</b>统一管理说明文档、交付物、控制表和文件夹；搜索及类型、分组、Flow、Task 筛选集中在表格上方，并按“分组 → Flow → Task”选择关联、与时间轴双向同步。</li>
            <li><b>最近常用：</b>本自然周或上个自然周至少打开过一次的资料可一键筛出。</li>
            <li><b>资料导入与清理：</b>资料 Excel 可选择补充导入或全部覆盖；重复地址可替换或跳过，批量删除需连续确认两次。</li>
            <li><b>语言切换：</b>右上角 中文 / EN 可随时切换界面语言；Excel 导出的表头、工作表名和文件名均跟随当前语言。</li>
          </ul>
        </section>
        <section>
          <h3>数据保存位置</h3>
          <p>数据以 JSON 文件保存在本机应用数据目录中，数据文件为：</p>
          <pre>{dataInfo ? dataInfo.dataFile : "读取中…"}</pre>
          {revealButton(dataInfo?.dataFile, "在文件夹中显示")}
          <p>每次保存前，旧数据文件会自动复制到 backups/ 目录，自动保留最近 30 份轮换备份{dataInfo ? `（当前 ${dataInfo.backupCount} 份）` : ""}：</p>
          <pre>{dataInfo ? dataInfo.backupsDir : "读取中…"}</pre>
          {revealButton(dataInfo?.backupsDir, "打开备份目录")}
          <p>如果主数据文件损坏，程序会自动从轮换备份中恢复，并把损坏文件留存为 corrupt 备份。</p>
          <p>与 Web 版的区别：Web 版数据保存在浏览器 localStorage，清除网站数据、使用无痕窗口或更换浏览器都可能丢失数据；桌面版真正写入本机 JSON 文件，不再依赖浏览器。从 Web 版迁移时，在 Web 版“导出 JSON 备份”，再在本版“从 JSON 恢复”即可，数据格式完全一致。</p>
          <p>删除或移动数据文件、更换电脑或系统用户，都会影响可见数据。</p>
        </section>
        <section>
          <h3>数据备份与恢复</h3>
          <ol>
            <li>点击顶部数据操作区的 <b>•••</b>。</li>
            <li>选择“导出 JSON 备份”，将文件保存到安全位置。</li>
            <li>需要恢复时选择“从 JSON 恢复”，程序会先校验数据并请求确认。</li>
          </ol>
          <p>建议在批量修改、迁移到其他电脑或删除数据文件前先导出 JSON 备份。</p>
        </section>
        <section>
          <h3>Excel 批量导入</h3>
          <ol>
            <li>点击顶部数据操作区的 <b>•••</b>，下载空白 Excel 导入模板，或选择“按导入模板下载当前数据”。</li>
            <li>在“Task导入”工作表中填写或调整数据，每行代表一条 Task。</li>
            <li>选择“上传 Excel 批量导入”，检查错误提示和数据预览。</li>
            <li>选择“补充导入”或“完整覆盖”，确认无误后执行导入。</li>
          </ol>
          <p>不存在的分组和 Flow 会自动创建；已有同名项会复用。Flow 颜色留空时默认继承分组颜色。</p>
          <p>周期可选不重复、每周或每月；周期 Task 必须填写起止日期。“周期完成记录”用于完整回导历史，手工新建时可留空。</p>
          <p>补充导入保留现有时间轴数据并新增 Task；完整覆盖会连续确认两次，以文件替换全部分组、Flow 和 Task。资料库条目不会删除，同名层级会尽量沿用原 ID 以保留关联。</p>
          <p>分组、Task name、DDL、紧急程度、汇报对象和交付物均为必填字段。</p>
        </section>
        <section>
          <h3>Excel 导出</h3>
          <p>点击“导出看板报告”会生成包含“整体看板”和“时间表看板”的 <code>.xlsx</code> 文件。</p>
          <p>文件包含全部 Task、分组和 Flow 统计、步骤序号、周期及起止日期、进度记录、DDL 周时间轴与完整链接；周标签会区分已完成、逾期和待完成，不受当前筛选条件影响。</p>
          <p>看板报告用于阅读与汇报，不作为批量导入文件；需要再次上传时，请使用“按导入模板下载当前数据”。</p>
          <p>整体看板的“管理对象”和“汇报对象”模块支持按单个对象导出 Task 状态；文件只包含该对象的 Task，并按分组排序，带出 DDL、完成状态、紧急程度、进度记录、交付物及相关资料等基本信息。</p>
          <p>资料库的“下载”菜单包含空白模板和全量资料清单，“上传”用于导入 Excel。</p>
        </section>
        <section>
          <h3>开发团队</h3>
          <p>开发团队：Wesley Yan</p>
          <p>首个桌面版本（v1.0）：2026年8月14日</p>
          <p>由 Web 版 v2.5 移植</p>
        </section>
      </article>
      )}
      <div className="modal-actions">
        <button className="button button-primary" type="button" data-action="close-user-guide" onClick={closeDialog}>知道了</button>
      </div>
    </dialog>
  );
}
