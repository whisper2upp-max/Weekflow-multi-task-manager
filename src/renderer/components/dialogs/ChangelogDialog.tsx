/* 更新日志弹窗：原生 <dialog> + useModalDialog。内容逐字照搬原 Weekflow.html:794-1031
   中文版（v1.0–v2.5 全部条目，按版本号从新到旧）。 */
import { useUiStore } from "../../store/uiStore";
import { useModalDialog } from "../../lib/useModalDialog";

export default function ChangelogDialog() {
  const dialog = useUiStore((state) => (state.dialog?.type === "changelog" ? state.dialog : null));
  const closeDialog = useUiStore((state) => state.closeDialog);
  const ref = useModalDialog(!!dialog, closeDialog);

  if (!dialog) return null;

  return (
    <dialog ref={ref} id="changelog-dialog" className="modal document-modal changelog-modal">
      <div className="modal-head">
        <div>
          <p className="eyebrow">Release notes</p>
          <h2>Weekflow 更新日志</h2>
        </div>
        <button className="icon-button" type="button" data-action="close-changelog" aria-label="关闭" onClick={closeDialog}>×</button>
      </div>
      <article className="document-content changelog-content">
        <div className="release-entry" data-version="2.5">
          <div className="release-heading">
            <span>v2.5 中英双语版</span>
            <time dateTime="2026-08-12">2026-08-12</time>
          </div>
          <p className="release-lead">在不改变 v2.4 数据结构和业务机制的前提下，为整套程序、文档及 Excel 输入输出增加完整中英文切换。</p>
          <section>
            <h3>新增与调整</h3>
            <ul>
              <li>在资料库右侧增加 Chinese / EN 切换，整套 UI、弹窗、提示、使用说明和更新日志随语言切换。</li>
              <li>Task 与资料库模板、可回导数据、看板报告及人员状态报告自动使用当前界面的语种。</li>
              <li>GitHub 项目主页提供中文与英文 README，并为两种语言分别配置对应界面配图。</li>
              <li>英文导入继续兼容中英文表头和值，不翻译或改写用户录入的业务数据。</li>
            </ul>
          </section>
          <section>
            <h3>稳定性</h3>
            <ul>
              <li>继续沿用 Windows-safe XLSX 打包，模板与报告不含宏、外部链接、数据连接或默认冻结窗格。</li>
              <li>保留时间轴勾选、分组/Flow 展开折叠及资料库复选时的滚动位置保护。</li>
              <li>继续沿用 <code>weekflow-v2.4:*</code> 数据命名空间，升级 v2.5 不迁移、不清空用户数据。</li>
            </ul>
          </section>
        </div>

        <div className="release-entry" data-version="2.4">
          <div className="release-heading">
            <span>v2.4 Week / Day 双时间轴版</span>
            <time dateTime="2026-08-10">2026-08-10</time>
          </div>
          <p className="release-lead">在原周时间轴基础上增加单周日粒度下钻，保持分组、Flow、Task 和既有导入导出逻辑不变。</p>
          <section>
            <h3>新增与调整</h3>
            <ul>
              <li>原时间轴主界面更名为 Task by Week，继续保留周范围浏览、回到本周、全部范围及全部展开折叠。</li>
              <li>双击任意周日期框可进入该周 Task by Day；表头按周一至周日显示日期和星期，Task DDL 标签落在具体日期列。</li>
              <li>Task by Day 只显示在所选自然周内存在 DDL 的 Task；周期 Task 按该周的实际 DDL 参与筛选，其他周 Task 不显示。</li>
              <li>日视图保留分组、Flow、Task、筛选、编辑、完成和展开折叠功能，并以“返回 Task by Week”替代周范围控制。</li>
              <li>正式版升级为独立 v2.4 存储空间并自动迁移 v2.3 及更早版本；Excel 模板、上传和下载格式均未改变。</li>
            </ul>
          </section>
          <section>
            <h3>稳定性</h3>
            <ul>
              <li>Task by Week 与 Task by Day 均沿用被操作 Task 行锚点；在长列表底部勾选或取消完成后不会跳回首个分组。</li>
              <li>从日视图返回周视图会恢复进入前的周时间轴滚动位置；从其他主页面重新进入时间轴时默认回到 Task by Week。</li>
            </ul>
          </section>
        </div>

        <div className="release-entry" data-version="2.3">
          <div className="release-heading">
            <span>v2.3 周期任务与临期提醒版</span>
            <time dateTime="2026-08-08">2026-08-08</time>
          </div>
          <p className="release-lead">建立每周、每月周期 Task 的连续完成模型，加入临期提醒，并强化批量回导与 Windows Excel 兼容。</p>
          <section>
            <h3>新增与调整</h3>
            <ul>
              <li>周期 Task 支持每周或每月模式，并要求填写周期开始和结束日期；DDL 作为星期或月内日期锚点，季度周期已移除。</li>
              <li>一个周期 Task 只保存和统计为一条记录，时间轴会在周期范围内展开全部 DDL 标签，不再克隆多条 Task。</li>
              <li>勾选当前自然周或自然月完成时，会把本期及此前各期一并视为完成；进入下一周期后自动恢复未勾选，连续完成历史继续保留。</li>
              <li>Task 导入模板和可回导当前数据升级为 20 列，新增周期、周期开始、周期结束和周期完成记录；旧 16 列文件仍可导入。</li>
              <li>三类看板报告统一增加周期及起止日期，周标签区分已完成、逾期和待完成。</li>
              <li>进入程序时右下角显示未来 7 天未完成 DDL 提醒，10 秒后自动关闭；悬浮提醒不阻断操作，并采用新的图形化关闭按钮。</li>
              <li>移除未采用的 Flow 模板入口、弹窗与数据结构，保留 Flow 创建、编辑和步骤拖动排序。</li>
              <li>正式版升级为独立 v2.3 存储空间，并自动迁移 v2.2、v2.1、v2.0、v1.1 和 v1.0 数据。</li>
            </ul>
          </section>
          <section>
            <h3>优化与修复</h3>
            <ul>
              <li>修复点击任意 Task 完成框后时间轴跳回顶部的问题；重绘前后会锁定被操作 Task 的视口位置和横向滚动位置。</li>
              <li>修复 Windows 显示缩放触发 1280px 响应式断点后，时间轴新建按钮停留在中部、资料库操作按钮另起一整行的问题；资料库标题和整组操作在桌面宽度下保持同一行。</li>
              <li>修复较早开始的周期 Task 在完成本期后，此前标签仍显示逾期的问题；旧的间断完成记录会在启动时自动补齐。</li>
              <li>可回导 Task 数据与资料库下载会移除无实际宏却可能触发 Windows“启用内容”的伪宏标记，并显式设置文档安全级别为 0。</li>
              <li>数据 v3 将周期设置和按期完成历史保存在 Task 内；JSON 备份恢复会校验周期范围和完成记录，旧式周期规则与 Flow 模板字段可安全读取并忽略。</li>
            </ul>
          </section>
        </div>

        <div className="release-entry" data-version="2.2">
          <div className="release-heading">
            <span>v2.2 人员进度与报表兼容版</span>
            <time dateTime="2026-08-08">2026-08-08</time>
          </div>
          <p className="release-lead">增加按管理对象和汇报对象的人员进度汇总与单人报告，并强化 Windows Excel 报表兼容。</p>
          <section>
            <h3>新增与调整</h3>
            <ul>
              <li>整体看板改为五项总览常驻，分组、Flow、管理对象和汇报对象四个详细模块按按钮切换显示。</li>
              <li>新增按管理对象、按汇报对象的 Task 进度汇总，展示完成率及完成、未完成、逾期数量。</li>
              <li>管理对象和汇报对象新增单对象 Task 状态导出，按分组排序并包含 DDL、进度、交付物和相关资料。</li>
              <li>汇报对象和管理对象明确按人员姓名录入，Task 表单、使用说明及 Excel 模板示例同步更新。</li>
              <li>开发版示例数据中的汇报对象和管理对象全部改为人员姓名。</li>
              <li>正式版升级为独立 v2.2 存储空间，并自动迁移 v2.1、v2.0、v1.1 和 v1.0 数据。</li>
            </ul>
          </section>
          <section>
            <h3>优化与修复</h3>
            <ul>
              <li>时间轴看板报告、管理对象报告和汇报对象报告均取消默认冻结窗格，打开后可自由滚动全部区域。</li>
              <li>继续保留 Windows Excel 所需的标准工作簿属性和筛选定义，报告不包含宏、外部工作簿链接或数据连接。</li>
            </ul>
          </section>
        </div>

        <div className="release-entry" data-version="2.1">
          <div className="release-heading">
            <span>v2.1 数据可移植与交互稳定版</span>
            <time dateTime="2026-08-03">2026-08-03</time>
          </div>
          <p className="release-lead">增强 Task 数据回导能力、Excel 兼容性与长列表连续操作体验。</p>
          <section>
            <h3>新增与调整</h3>
            <ul>
              <li>Task 批量录入新增“按导入模板下载当前数据”，导出的 16 列数据可直接再次上传。</li>
              <li>Task Excel 上传新增补充导入和双重确认的完整覆盖模式。</li>
              <li>时间轴主按钮改名为“导出看板报告”，与可回导的当前数据文件明确区分。</li>
              <li>正式版升级为独立 v2.1 存储空间，并自动迁移 v2.0、v1.1 和 v1.0 数据。</li>
            </ul>
          </section>
          <section>
            <h3>优化与修复</h3>
            <ul>
              <li>修复 Windows Excel 打开看板报告时提示修复 <code>workbook.xml</code> 的兼容性问题。</li>
              <li>修复展开或收起任意分组/Flow 后时间轴滚动回顶的问题，被操作行会保持在原视口位置。</li>
              <li>修复逐条勾选或取消资料后资料表滚动回顶的问题，选择状态改为局部更新。</li>
            </ul>
          </section>
        </div>

        <div className="release-entry" data-version="2.0">
          <div className="release-heading">
            <span>v2.0 正式版本</span>
            <time dateTime="2026-07-31">2026-07-31</time>
          </div>
          <p className="release-lead">资料协同升级版本，把时间轴中的链接统一为可筛选、可统计、可双向编辑的资料库。</p>
          <section>
            <h3>新增</h3>
            <ul>
              <li>新增与时间轴、整体看板并列的资料库模块。</li>
              <li>资料支持说明文档、交付物、控制表、文件夹四种类型及多 Task/Flow/分组关联。</li>
              <li>新增资料库顶部搜索/筛选栏、最近常用统计、手动录入及 Excel 导入导出。</li>
              <li>时间轴“说明文档/交付物”合并为“相关资料”，编辑后实时同步资料库。</li>
              <li>资料 Excel 支持补充导入、重复地址替换或跳过，以及双重确认的全部覆盖。</li>
              <li>资料列表支持表头全选当前结果、复选和双重确认批量删除。</li>
            </ul>
          </section>
          <section>
            <h3>优化与修复</h3>
            <ul>
              <li>旧版 Task 内链接自动迁移为 v2.0 统一资料，保留类型与 Task 归属。</li>
              <li>资料名称、地址、类型和关联关系从任一入口修改后保持同一数据源。</li>
              <li>最近常用改按本自然周和上个自然周统计，任一周打开过一次即可保留。</li>
              <li>资料关联改为“分组 → Flow → Task”级联选择，并移除备注搜索、重复全选和操作列。</li>
              <li>时间轴筛选统一为“筛选分组”样式，筛选菜单支持互斥打开与点击空白自动关闭。</li>
              <li>资料库搜索与筛选移到表格上方，弹层配色、选中态和层级提示统一为时间轴看板风格。</li>
              <li>整体看板隐藏时间轴专属命令栏；资料编辑弹窗压缩基础信息区，为关联选择释放更多空间。</li>
              <li>资料表头、类型、相关 Flow、分组和备注统一为资料名称的 12px 主字号；链接和相关 Task 保持紧凑字号。</li>
              <li>程序内更新日志改为完整版本历史，按版本号从新到旧展示。</li>
              <li>使用说明新增 Multi-task 管理座舱定位，以及开发团队、首版日期和最新版本更新时间。</li>
            </ul>
          </section>
        </div>

        <div className="release-entry" data-version="1.1">
          <div className="release-heading">
            <span>v1.1 批量录入升级</span>
            <time dateTime="2026-07-30">2026-07-30</time>
          </div>
          <p className="release-lead">批量录入与字段规则升级版本，减少初始建档操作并统一数据质量要求。</p>
          <section>
            <h3>新增</h3>
            <ul>
              <li>提供空白 Excel 导入模板、逐行校验预览和 Task 批量导入。</li>
              <li>导入时可自动复用或创建分组与 Flow，并支持 Flow 步骤序号。</li>
              <li>导入预览显示 Task、新分组和新 Flow 数量；存在错误时禁止确认。</li>
            </ul>
          </section>
          <section>
            <h3>变更与修复</h3>
            <ul>
              <li>紧急程度、汇报对象和交付物改为网页表单与 Excel 导入必填项。</li>
              <li>紧急程度取消默认选中，创建 Task 时需要主动选择。</li>
              <li>修复带 Excel 日期格式的文本日期被误判为无效日期的问题。</li>
              <li>正式版存储空间升级为 <code>weekflow-v1.1:*</code>，并自动迁移 v1.0 本地数据。</li>
            </ul>
          </section>
        </div>

        <div className="release-entry" data-version="1.0">
          <div className="release-heading">
            <span>v1.0 首个正式版本</span>
            <time dateTime="2026-07-30">2026-07-30</time>
          </div>
          <p className="release-lead">第一个完整发布版本，聚焦周时间轴、Workflow 步骤组织和本地数据管理。</p>
          <section>
            <h3>新增</h3>
            <ul>
              <li>图形化主页，以及时间轴看板、整体看板、使用说明和更新日志四个快捷入口。</li>
              <li>“分组 → 可选 Flow → Task”的三级工作结构。</li>
              <li>Flow 创建、编辑、删除、折叠、进度统计和 Task 步骤拖动排序。</li>
              <li>Task 自由文本进度记录、说明文档链接和交付物链接。</li>
              <li>分组、Flow、状态、紧急程度、逾期和关键词组合筛选。</li>
              <li>整体看板的 Task、分组与 Flow 进度统计。</li>
              <li>JSON 数据备份恢复和包含 Flow/步骤信息的 Excel 导出。</li>
              <li>独立空白发布目录，不包含示例数据及“恢复示例数据”入口。</li>
              <li>发布版使用独立的 <code>weekflow-v1.0:*</code> 存储空间，不读取开发版残留示例数据。</li>
              <li>汇报对象和管理对象自动提供已使用历史值，减少名称不一致。</li>
              <li>新建 Flow 默认继承所属分组颜色，主动改色后保留自定义值。</li>
            </ul>
          </section>
          <section>
            <h3>优化与修复</h3>
            <ul>
              <li>筛选条件移动到“可见 Task”数量右侧，不再额外占用一行。</li>
              <li>时间轴左侧六列表头放大，同时保持固定列宽和单行防溢出。</li>
              <li>压缩时间轴上方区域，为 Task 列表释放更多空间。</li>
              <li>加强数据版本、分组/Flow/Task 关联和进度更新时间校验。</li>
              <li>支持旧版 v1 本地数据自动迁移到 v2。</li>
            </ul>
          </section>
        </div>
      </article>
      <div className="modal-actions">
        <button className="button button-primary" type="button" data-action="close-changelog" onClick={closeDialog}>关闭</button>
      </div>
    </dialog>
  );
}
