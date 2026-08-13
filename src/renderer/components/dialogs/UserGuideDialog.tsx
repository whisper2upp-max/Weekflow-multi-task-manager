/* 使用说明弹窗：原生 <dialog> + useModalDialog。内容照搬原 Weekflow.html:717-792 中文版。
   唯一改动：「数据保存位置」一节改为 JSON 文件存储（window.weekflow.getDataInfo() 展示真实路径，
   backups/ 目录自动保留最近 30 份轮换备份）；相关浏览器措辞同步改为文件措辞。 */
import { useEffect, useState } from "react";
import { useUiStore } from "../../store/uiStore";
import { useModalDialog } from "../../lib/useModalDialog";

interface DataInfo {
  dataFile: string;
  backupsDir: string;
  backupCount: number;
}

export default function UserGuideDialog() {
  const dialog = useUiStore((state) => (state.dialog?.type === "userGuide" ? state.dialog : null));
  const closeDialog = useUiStore((state) => state.closeDialog);
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

  return (
    <dialog ref={ref} id="user-guide-dialog" className="modal document-modal">
      <div className="modal-head">
        <div>
          <p className="eyebrow">Quick guide</p>
          <h2>Weekflow 使用说明</h2>
        </div>
        <button className="icon-button" type="button" data-action="close-user-guide" aria-label="关闭" onClick={closeDialog}>×</button>
      </div>
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
          </ul>
        </section>
        <section>
          <h3>数据保存位置</h3>
          <p>数据以 JSON 文件保存在本机应用数据目录中，数据文件为：</p>
          <pre>{dataInfo ? dataInfo.dataFile : "读取中…"}</pre>
          <p>每次保存前，旧数据文件会自动复制到 backups/ 目录，自动保留最近 30 份轮换备份{dataInfo ? `（当前 ${dataInfo.backupCount} 份）` : ""}：</p>
          <pre>{dataInfo ? dataInfo.backupsDir : "读取中…"}</pre>
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
          <p>首个正式版本（v1.0）：2026年7月30日</p>
          <p>最新版本（v2.5）更新时间：2026年8月12日</p>
        </section>
      </article>
      <div className="modal-actions">
        <button className="button button-primary" type="button" data-action="close-user-guide" onClick={closeDialog}>知道了</button>
      </div>
    </dialog>
  );
}
