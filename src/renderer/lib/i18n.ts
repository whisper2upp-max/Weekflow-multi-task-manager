/* Weekflow Desktop 中英双语运行时翻译引擎。
   对齐原 Web 版 js/i18n.js（Weekflow v2.7）：中文是源码内嵌的源文案，
   英文模式 = EN_TEXT 字典 + 参数化正则 + MutationObserver 运行时 DOM 翻译。
   与原版的有意差异（React 适配，均为最小规避）：
   - 语言偏好 localStorage key 改为 weekflow-desktop:language，默认语言 zh-CN；
   - setLanguage 写入后直接 window.location.reload()（原版在点击处理器里 reload，
     语义等价：observer 不跨语言残留）；
   - 原版 useGuide/更新日志的整篇 innerHTML 替换（englishGuideHtml/englishChangelogHtml）
     改由两个弹窗组件按 isEnglish() 渲染不同 JSX（React 禁止 dangerouslySetInnerHTML）；
   - 英文日期输入壳 .localized-date-shell 不再运行时注入——运行中给 React 受控
     input 换父节点会在弹窗卸载时触发 removeChild 冲突；改由 components/DateInput.tsx
     在英文模式下直接渲染壳结构。setupEnglishDateInputs/refreshDateInputs 按原版保留
     （幂等：壳已存在时只设置 lang 并刷新 is-empty），供任何绕过 DateInput 的
     原生 input[type="date"] 兜底。 */
export type Language = "zh-CN" | "en";

export const STORAGE_KEY = "weekflow-desktop:language";
export const SUPPORTED: readonly Language[] = ["zh-CN", "en"];
const DEFAULT_LANGUAGE: Language = "zh-CN";
const ENGLISH_DATE_PLACEHOLDER = "MM / DD / YYYY";

let language: Language = DEFAULT_LANGUAGE;
let observer: MutationObserver | null = null;

/* 中文 → 英文整句字典（逐字沿用原 i18n.js EN_TEXT） */
const EN_TEXT: Record<string, string> = {
  "无法打开目录，请手动访问上方路径": "Could not open the folder. Please use the path shown above.",
  "主页": "Home",
  "时间轴看板": "Timeline",
  "整体看板": "Overall Dashboard",
  "资料库": "Document Library",
  "随手记": "Quick Notes",
  "笔记": "Notes",
  "记录想法，并转换为进度记录或 Task 草稿": "Capture ideas and convert them into progress records or Task drafts",
  "记录临时想法，再转为进度或 Task 草稿": "Capture quick thoughts, then convert them into progress or Task drafts",
  "· 记录临时想法，再转为进度或 Task 草稿": "· Capture quick thoughts, then convert them into progress or Task drafts",
  "新建笔记": "New Note",
  "笔记列表": "Note list",
  "笔记范围": "Note scope",
  "收藏夹": "Favorites",
  "收藏笔记": "Add note to favorites",
  "取消收藏": "Remove from favorites",
  "搜索标题或正文": "Search titles or content",
  "写下第一条随手记": "Write Your First Quick Note",
  "保存后可以把内容添加为 Task 进度记录，或转换成一个或多个 Task 草稿。": "After saving, append the note to a Task's progress history or convert it into one or more Task drafts.",
  "笔记标题": "Note title",
  "尚未保存": "Not saved",
  "笔记文字格式": "Note text formatting",
  "加粗": "Bold",
  "斜体": "Italic",
  "字号": "Size",
  "文字颜色": "Text color",
  "字色": "Text",
  "底色高亮": "Highlight color",
  "高亮": "Highlight",
  "选择字色": "Choose text color",
  "选择高亮颜色": "Choose highlight color",
  "清除格式": "Clear formatting",
  "表格": "Table",
  "新建表格": "Create Table",
  "编辑表格": "Edit Table",
  "选择整个表格": "Select entire table",
  "请选择分组": "Select a Group",
  "改写前原文": "Original note",
  "关闭原文预览": "Close original preview",
  "在下方插入行": "Insert Row Below",
  "在右侧插入列": "Insert Column Right",
  "删除当前行": "Delete Current Row",
  "删除当前列": "Delete Current Column",
  "合并所选单元格": "Merge Selected Cells",
  "删除整个表格": "Delete Entire Table",
  "在这里记录工作想法、会议要点或 SharePoint 链接…": "Capture work ideas, meeting notes, or SharePoint links here…",
  "删除笔记": "Delete Note",
  "添加到进度记录": "Add to Progress History",
  "AI 设置": "AI Settings",
  "AI 转换": "AI Conversion",
  "AI 改写": "AI Rewrite",
  "AI 改写中…": "AI Rewriting…",
  "AI 改写前原文": "Original Before AI Rewrite",
  "恢复原文": "Restore Original",
  "AI 接入设置": "AI Settings",
  "接入 AI": "Enable AI",
  "启用 AI 能力（Task 草稿解析 / 笔记改写）": "Enable AI (Task draft parsing / note rewriting)",
  "服务商": "Provider",
  "模型": "Model",
  "请选择模型": "Select a model",
  "自定义模型…": "Custom model…",
  "输入自定义模型名称": "Enter a custom model name",
  "清除连接": "Clear Connection",
  "测试连接": "Test Connection",
  "测试中…": "Testing…",
  "保存设置": "Save Settings",
  "✦ 使用 AI 解析": "✦ Parse with AI",
  "AI 解析中…": "AI Parsing…",
  "AI 解析": "AI parsing",
  "本地规则": "Local rules",
  "已开启随手记 AI 转换": "Quick Notes AI conversion enabled",
  "已关闭随手记 AI 转换": "Quick Notes AI conversion disabled",
  "笔记内容为空，无法改写。": "The note is empty and cannot be rewritten.",
  "请先在 AI 设置中接入并启用 AI。": "Configure and enable AI in AI Settings first.",
  "请在随手记界面开启 AI 转换。": "Enable AI Conversion in Quick Notes first.",
  "AI 将改写当前笔记内容，原意不变，但表达会被结构化。是否继续？": "AI will restructure the current note without changing its meaning. Continue?",
  "AI 改写期间笔记内容或当前笔记已变化，本次结果未应用。": "The note or current selection changed during AI rewriting, so the result was not applied.",
  "AI 未完整保留表格及其位置，本次改写已取消，原笔记未发生变化。": "AI did not preserve every table and its position. The rewrite was canceled and the note remains unchanged.",
  "AI 改写完成，请检查后保存。": "AI rewrite complete. Review the result before saving.",
  "已恢复为改写前原文。": "Restored the original text from before the AI rewrite.",
  "请先在 AI 设置中接入并启用随手记 AI 转换。": "Configure AI and enable Quick Notes AI Conversion first.",
  "已有 Task 被保存，不能再替换本轮草稿解析结果。": "A Task has already been saved, so this draft set can no longer be replaced.",
  "将把当前笔记正文发送给已配置的 AI 服务，并用 AI 结果替换尚未保存的草稿列表。是否继续？": "Send the current note to the configured AI service and replace the unsaved draft list with the AI result?",
  "AI 解析完成，请逐条复核后保存。": "AI parsing complete. Review each draft before saving.",
  "转换为 Task 草稿": "Convert to Task Drafts",
  "保存笔记": "Save Note",
  "请输入笔记标题。": "Enter a note title.",
  "笔记已保存": "Note saved",
  "笔记已创建": "Note created",
  "笔记已删除": "Note deleted",
  "没有符合搜索的笔记。": "No notes match the search.",
  "保存后的笔记会显示在这里。": "Saved notes will appear here.",
  "空白笔记": "Blank note",
  "有未保存修改": "Unsaved changes",
  "已保存": "Saved",
  "最后更新：": "Last updated: ",
  "手动记录": "Manual record",
  "尚无记录": "No records yet",
  "新记录将在保存时写入时间": "The timestamp is added when the new record is saved",
  "请输入进度内容。": "Enter progress details.",
  "进度记录已删除": "Progress record deleted",
  "进度记录已保存": "Progress record saved",
  "添加记录": "Add Record",
  "将按当前时间新增一条独立记录。": "A separate record will be added with the current timestamp.",
  "当前范围下没有可选择的 Task。": "No Tasks are available in the current scope.",
  "请选择有效 Task。": "Select a valid Task.",
  "笔记没有可转换的正文内容。": "The note has no content to convert.",
  "已新增一条 Task 进度记录": "A Task progress record was added",
  "Task 草稿转换已完成": "Task draft conversion completed",
  "请先创建分组，并保存有效笔记。": "Create a Group and save a valid note first.",
  "请补齐 Task name、分组、DDL、紧急程度、汇报对象和交付物。": "Complete Task Name, Group, DDL, Urgency, Report To, and Deliverable.",
  "周期 Task 必须填写周期开始和周期结束日期。": "A recurring Task requires Recurrence Start and Recurrence End.",
  "所有草稿均已处理，可复核后点击“完成转换”。": "All drafts are resolved. Review them, then select Complete Conversion.",
  "手动增加的 Task 草稿": "Manually added Task draft",
  "请先保存或明确跳过全部 Task 草稿。": "Save or explicitly skip every Task draft first.",
  "未识别到可可靠预填的字段，请根据原笔记补充必填信息。": "No fields could be filled reliably. Complete the required details using the source note.",
  "可直接选择并复制原文，辅助修正右侧 Task。": "Select and copy the source text to help correct the Task on the right.",
  "复核已创建 Task": "Review Created Task",
  "确认 Task 草稿": "Confirm Task Draft",
  "请选择": "Select",
  "退出转换": "Exit Conversion",
  "恢复待处理": "Restore Pending",
  "更新并继续": "Update and Continue",
  "保存并继续": "Save and Continue",
  "周期开始": "Recurrence Start",
  "周期结束": "Recurrence End",
  "当前笔记尚未保存，切换语言会丢失这些修改。仍要继续吗？": "This note has unsaved changes. Switch language and discard them?",
  "当前笔记尚未保存，切换语言后修改会丢失。仍要继续吗？": "This note has unsaved changes. Switch language and discard them?",
  "Task 草稿转换尚未完成，切换语言会退出当前转换。仍要继续吗？": "Task draft conversion is not complete. Switch language and exit the conversion?",
  "当前笔记尚未保存，离开后修改会丢失。仍要继续吗？": "This note has unsaved changes. Leave and discard them?",
  "当前笔记尚未保存，继续后修改会丢失。仍要继续吗？": "This note has unsaved changes. Continue and discard them?",
  "布局": "Layout",
  "列表": "List",
  "资料库布局": "Document Library Layout",
  "资料库布局切换": "Document Library Layout Switch",
  "调整布局": "Arrange Layout",
  "已切换到分组布局": "Group layout enabled",
  "已切换到列表布局": "List layout enabled",
  "分组布局已更新": "Group layout updated",
  "未完成": "Incomplete",
  "已完成": "Completed",
  "逾期": "Overdue",
  "完成": "Completed",
  "新建分组": "New Group",
  "编辑分组": "Edit Group",
  "新建 Flow": "New Flow",
  "新建 Task": "New Task",
  "分组": "Group",
  "状态": "Status",
  "紧急程度": "Urgency",
  "全部": "All",
  "清空": "Clear",
  "筛选分组": "Filter Groups",
  "筛选 Flow": "Filter Flows",
  "筛选状态": "Filter Status",
  "筛选紧急程度": "Filter Urgency",
  "仅看逾期": "Overdue only",
  "清空筛选": "Clear Filters",
  "导出看板报告": "Export Dashboard Report",
  "批量录入": "Bulk Import",
  "下载 Excel 导入模板": "Download Excel Import Template",
  "按导入模板下载当前数据": "Download Current Data in Import Format",
  "上传 Excel 批量导入": "Upload Excel for Bulk Import",
  "数据备份": "Data Backup",
  "导出 JSON 备份": "Export JSON Backup",
  "从 JSON 恢复": "Restore from JSON",
  "类型": "Type",
  "筛选资料类型": "Filter Document Types",
  "筛选 Task": "Filter Tasks",
  "把工作拆成清晰的下一步": "Turn Work into Clear Next Steps",
  "用分组建立工作版图，用 Flow 串起执行步骤，再用周时间轴看清每一个 DDL。": "Build your work map with Groups, connect execution steps with Flows, and see every deadline on the weekly timeline.",
  "完成率": "Completion Rate",
  "资料": "Documents",
  "工作主题": "Workstream",
  "执行流程": "Execution Flow",
  "需求确认": "Confirm Requirements",
  "方案执行": "Execute Plan",
  "交付验收": "Accept Delivery",
  "按周总览 DDL，双击周表头查看每日安排": "Review deadlines by week; double-click a week header for the daily view",
  "掌握 Task、分组和 Flow 的实时进度": "Track real-time progress across Tasks, Groups, and Flows",
  "集中管理链接、关联工作并查看最近常用": "Manage links, connect work, and find recently used documents",
  "使用说明": "User Guide",
  "了解主要功能、数据保存与导出方法": "Learn the key features, data storage, and export workflows",
  "更新日志": "Changelog",
  "查看 Weekflow Desktop 的发布内容": "Review the Weekflow Desktop release history",
  "周一至周日 · 表头显示周五 · 双击周表头查看每天": "Monday to Sunday · Headers show Friday · Double-click a week to view each day",
  "本周": "This Week",
  "今天": "Today",
  "展开全部": "Expand All",
  "折叠全部": "Collapse All",
  "回到本周": "Go to This Week",
  "全部范围": "Full Range",
  "← 返回 Task by Week": "← Return to Task by Week",
  "全量数据 · 实时更新": "All data · Updated in real time",
  "总览始终显示；选择下方维度查看汇总，人员维度可一键导出 Task 状态。": "The overview always remains visible. Select a dimension below for details; people views can export Task status in one click.",
  "进度汇总维度": "Progress Dimensions",
  "统计全部 Task": "All Tasks included",
  "分组进度": "Group Progress",
  "Flow 进度": "Flow Progress",
  "管理对象": "Managed Person",
  "汇报对象": "Report To",
  "点击按钮显示一个维度；再次点击当前按钮可收起，返回仅看总览。": "Select a button to show one dimension. Select it again to collapse the details and return to the overview.",
  "点击分组或逾期数字可返回时间轴": "Select a Group or overdue count to return to the timeline",
  "分组汇总": "Group Summary",
  "Task 总数": "Total Tasks",
  "按工作步骤实时统计": "Real-time progress by workflow step",
  "Flow 汇总": "Flow Summary",
  "所属分组": "Group",
  "步骤数": "Steps",
  "管理对象进度": "Managed Person Progress",
  "按管理对象人员分别统计 Task": "Task progress summarized by managed person",
  "管理对象汇总": "Managed Person Summary",
  "Task 状态": "Task Status",
  "汇报对象进度": "Report-To Progress",
  "按汇报对象人员分别统计 Task": "Task progress summarized by report-to person",
  "汇报对象汇总": "Report-To Summary",
  "全部资料": "All Documents",
  "最近常用": "Recently Used",
  "未分组": "Ungrouped",
  "删除所选": "Delete Selected",
  "下载": "Download",
  "下载空白模板": "Download Blank Template",
  "下载资料库": "Download Document Library",
  "上传": "Upload",
  "＋ 添加资料": "+ Add Document",
  "资料清单": "Document List",
  "按分组显示资料": "Documents by Group",
  "调整分组布局": "Arrange Group Layout",
  "设置每行显示的分组数，并拖动分组调整排列顺序。": "Set the number of Groups per row, then drag Groups to arrange their order.",
  "每行分组数": "Groups per Row",
  "分组排列顺序": "Group Order",
  "恢复默认": "Restore Defaults",
  "应用布局": "Apply Layout",
  "前往": "Go to",
  "暂无符合条件的资料": "No matching documents",
  "链接名称": "Link Name",
  "链接地址": "Link URL",
  "相关 Task": "Related Tasks",
  "相关 Flow": "Related Flows",
  "备注": "Notes",
  "Excel 批量导入": "Excel Bulk Import",
  "导入方式": "Import Mode",
  "补充导入": "Supplement Import",
  "保留现有数据并新增 Task；同名分组和 Flow 会直接复用。": "Keep existing data and add Tasks; Groups and Flows with the same names are reused.",
  "完整覆盖": "Complete Replacement",
  "以文件替换全部分组、Flow 和 Task；资料库条目不会删除。": "Replace every Group, Flow, and Task with the file; documents are not deleted.",
  "周期": "Recurrence",
  "补充导入会新增 Task；完整覆盖会连续确认两次，并按文件替换时间轴数据。同名层级沿用原 ID 时会保留资料关联，无法匹配的旧关联会移除。": "Supplement import adds Tasks. Complete replacement requires two confirmations and replaces timeline data with the file. Matching hierarchy IDs retain document relations; unmatched old relations are removed.",
  "重新选择文件": "Choose Another File",
  "取消": "Cancel",
  "确认导入": "Confirm Import",
  "知道了": "Got It",
  "关闭": "Close",
  "分组名称": "Group Name",
  "分组颜色": "Group Color",
  "删除分组": "Delete Group",
  "保存分组": "Save Group",
  "Flow 名称": "Flow Name",
  "Flow 颜色": "Flow Color",
  "默认继承所属分组颜色，主动修改后保留自定义颜色。": "Defaults to the Group color; a manually selected color is retained.",
  "工作步骤排序": "Workflow Step Order",
  "拖动左侧把手调整顺序，也可使用上下移动按钮。": "Drag the handle to reorder, or use the move up/down buttons.",
  "删除 Flow": "Delete Flow",
  "保存 Flow": "Save Flow",
  "所属 Flow（可选）": "Flow (optional)",
  "不加入 Flow 时，Task 直接显示在分组下。": "Without a Flow, the Task appears directly under its Group.",
  "周期生成": "Recurrence",
  "不重复": "Does not repeat",
  "每周": "Weekly",
  "每月": "Monthly",
  "周期 Task 仍只统计为一个 Task，但会在时间轴显示多个 DDL。": "A recurring Task is counted once but displays multiple deadlines on the timeline.",
  "周期开始日期": "Recurrence Start Date",
  "周期结束日期": "Recurrence End Date",
  "请选择紧急程度": "Select urgency",
  "高": "High",
  "中": "Medium",
  "低": "Low",
  "完成状态": "Completion Status",
  "非周期 Task 可在此设置整体完成状态。": "Set the overall completion status here for a non-recurring Task.",
  "完成日期": "Completion Date",
  "标记完成时自动记录，可按需调整。": "Recorded automatically when completed; adjust if needed.",
  "填写人员姓名；可从历史值中选择，也可输入新值。": "Enter a person's name; select a previous value or enter a new one.",
  "交付物": "Deliverable",
  "相关资料": "Related Documents",
  "资料会同步到资料库；支持说明文档、交付物、控制表和文件夹。": "Documents sync to the library and support Documentation, Deliverable, Control Sheet, and Folder types.",
  "删除 Task": "Delete Task",
  "保存 Task": "Save Task",
  "管理相关资料": "Manage Related Documents",
  "保存资料": "Save Documents",
  "添加资料": "Add Document",
  "说明文档": "Documentation",
  "控制表": "Control Sheet",
  "文件夹": "Folder",
  "分组（可多选）": "Groups (multiple allowed)",
  "相关 Flow（可多选）": "Related Flows (multiple allowed)",
  "相关 Task（可多选）": "Related Tasks (multiple allowed)",
  "先选择分组，再从所选分组内勾选 Flow 和 Task；所有选项都来自时间轴看板。": "Select Groups first, then select Flows and Tasks within those Groups. Every option comes from the timeline.",
  "删除资料": "Delete Document",
  "资料库 Excel 导入": "Document Library Excel Import",
  "新增资料；遇到相同链接地址时选择替换或跳过。": "Add documents; choose whether to replace or skip duplicate URLs.",
  "全部覆盖": "Overwrite All",
  "删除资料库全部现有资料，再写入本次文件。": "Delete all existing documents, then import this file.",
  "发现重复链接地址": "Duplicate Link URLs Found",
  "用新上传资料替换": "Replace with Uploaded Document",
  "保留原资料 ID 和打开记录，其他字段以新文件为准。": "Keep the original document ID and open history; replace all other fields from the new file.",
  "跳过重复资料": "Skip Duplicate Documents",
  "保留原资料，只导入地址不重复的新内容。": "Keep existing documents and import only new URLs.",
  "导入不会创建 Task、Flow 或分组；无法匹配或存在重名歧义时会阻止导入。补充导入会新增或按选择处理重复地址，全部覆盖会先清空资料库。": "Import does not create Tasks, Flows, or Groups. Missing or ambiguous matches block import. Supplement import adds documents and applies the selected duplicate rule; overwrite clears the library first.",
  "编辑进度记录": "Manage Progress History",
  "＋ 新建记录": "+ New Record",
  "进度记录文字格式": "Progress record text formatting",
  "删除本条": "Delete This Record",
  "添加到 Task 进度记录": "Add to Task Progress History",
  "Flow（可选筛选）": "Flow (optional filter)",
  "确认新增记录": "Add Record",
  "原始笔记": "Source Note",
  "可选择并复制原文": "Select and copy the source text",
  "识别到 1 个潜在 Task，正在编辑第 1 个": "Detected 1 potential Task · Editing 1",
  "1 个待处理": "1 pending",
  "← 上一个": "← Previous",
  "下一个 →": "Next →",
  "＋ 增加 Task 草稿": "+ Add Task Draft",
  "＋ 增加 Task": "+ Add Task",
  "跳过此项": "Skip This Draft",
  "跳过本条": "Skip This Draft",
  "完成转换": "Complete Conversion",
  "进度内容": "Progress Details",
  "尚未记录进度": "No progress recorded",
  "保存进度": "Save Progress",
  "分组内仍有 Task": "This Group Still Contains Tasks",
  "移动到其他分组": "Move to Another Group",
  "移动 Task 与 Flow 后删除": "Move Tasks and Flows, Then Delete",
  "同时删除 Task": "Delete Tasks Too",
  "未来 7 天 DDL 提醒": "Deadlines in the Next 7 Days",
  "请选择有效的周期。": "Select a valid recurrence.",
  "请输入 Task name。": "Enter a Task Name.",
  "请选择有效分组。": "Select a valid Group.",
  "请选择当前分组下的有效 Flow。": "Select a valid Flow in the current Group.",
  "请选择有效 DDL。": "Select a valid DDL.",
  "请选择周期开始日期。": "Select a recurrence start date.",
  "请选择周期结束日期。": "Select a recurrence end date.",
  "周期结束日期不能早于开始日期。": "Recurrence End cannot be earlier than Recurrence Start.",
  "周期 Task 的 DDL 必须位于周期起止日期内。": "A recurring Task's DDL must be within the recurrence date range.",
  "当前 DDL 与周期范围无法形成任何周期节点。": "The current DDL and recurrence range do not create any valid occurrence.",
  "请选择紧急程度。": "Select an urgency.",
  "请输入或选择汇报对象。": "Enter or select a Report To person.",
  "请输入交付物。": "Enter a Deliverable.",
  "请输入链接名称。": "Enter a Link Name.",
  "请输入合法的 HTTP/HTTPS 链接地址。": "Enter a valid HTTP/HTTPS Link URL.",
  "每条资料都需要链接名称、类型和合法的 HTTP/HTTPS 地址。": "Every document requires a Link Name, Type, and valid HTTP/HTTPS URL.",
  "请输入分组名称。": "Enter a Group Name.",
  "已有同名分组，请使用其他名称。": "A Group with this name already exists. Use another name.",
  "请输入 Flow 名称。": "Enter a Flow Name.",
  "该分组中已有同名 Flow。": "A Flow with this name already exists in the selected Group.",
  "再次确认：批量删除资料不可恢复，是否继续？": "Final confirmation: deleting these documents cannot be undone. Continue?",
  "再次确认：全部覆盖不可撤销，建议已先导出 JSON 备份。": "Final confirmation: overwrite cannot be undone. Export a JSON backup first if needed. Continue?",
  "再次确认：文件中没有的分组、Flow 和 Task 将被移除，无法匹配的资料关联也会移除。建议已先导出 JSON 备份。": "Final confirmation: Groups, Flows, and Tasks missing from the file will be removed, along with unmatched document relations. Export a JSON backup first if needed. Continue?",
  "Excel 解析组件未加载。": "The Excel parser is not loaded.",
  "Excel 中没有工作表。": "The Excel workbook contains no worksheets.",
  "未找到模板表头，请使用下载的 Weekflow Task 导入模板。": "Template headers were not found. Use the downloaded Weekflow Task import template.",
  "未找到资料库模板表头，请使用下载的 Weekflow 资料库导入模板。": "Document template headers were not found. Use the downloaded Weekflow Document Library import template.",
  "分组不能为空": "Group is required",
  "Task name 不能为空": "Task Name is required",
  "DDL 必须是有效日期": "DDL must be a valid date",
  "周期仅支持不重复、每周、每月": "Recurrence supports only Does not repeat, Weekly, or Monthly",
  "周期开始必须是有效日期": "Recurrence Start must be a valid date",
  "周期结束必须是有效日期": "Recurrence End must be a valid date",
  "分组颜色必须是 #RRGGBB": "Group Color must use #RRGGBB",
  "Flow颜色必须是 #RRGGBB": "Flow Color must use #RRGGBB",
  "Flow步骤必须是大于 0 的整数": "Flow Step must be an integer greater than 0",
  "填写 Flow步骤 时必须同时填写 Flow": "Flow is required when Flow Step is entered",
  "紧急程度不能为空": "Urgency is required",
  "紧急程度仅支持高、中、低": "Urgency supports only High, Medium, or Low",
  "汇报对象不能为空": "Report To is required",
  "交付物不能为空": "Deliverable is required",
  "完成状态仅支持未完成、已完成": "Completion Status supports only Incomplete or Completed",
  "完成日期必须是有效日期": "Completion Date must be a valid date",
  "不重复 Task 不能填写周期开始、周期结束或周期完成记录": "A non-recurring Task cannot contain Recurrence Start, Recurrence End, or Recurrence Completion History",
  "周期 Task 必须填写周期开始": "A recurring Task requires Recurrence Start",
  "周期 Task 必须填写周期结束": "A recurring Task requires Recurrence End",
  "周期开始不能晚于周期结束": "Recurrence Start cannot be later than Recurrence End",
  "周期 Task 的 DDL 必须位于周期起止日期内": "A recurring Task's DDL must be within its recurrence date range",
  "DDL 与周期范围无法形成周期节点": "DDL and the recurrence range do not create any valid occurrence",
  "文件中没有可导入的资料。": "The file contains no documents to import.",
  "文件中没有可导入的 Task，请在模板表头下方填写数据。": "The file contains no Tasks to import. Enter data below the template headers.",
  "链接名称不能为空": "Link Name is required",
  "链接地址不能为空": "Link URL is required",
  "链接地址必须是 HTTP/HTTPS URL": "Link URL must be an HTTP/HTTPS URL",
  "类型仅支持说明文档、交付物、控制表、文件夹": "Type supports only Documentation, Deliverable, Control Sheet, or Folder",
  "筛选已清空": "Filters cleared",
  "所有分组与 Flow 已是折叠状态": "All Groups and Flows are already collapsed",
  "所有分组与 Flow 已是展开状态": "All Groups and Flows are already expanded",
  "已折叠全部分组与 Flow": "All Groups and Flows collapsed",
  "已展开全部分组与 Flow": "All Groups and Flows expanded",
  "当前不在该周期 Task 的可确认范围内": "This recurring Task cannot be completed in the current period",
  "已显示最早至最晚 DDL 的全部周范围": "Showing the full weekly range from the earliest to latest DDL",
  "资料库筛选已清空": "Document Library filters cleared",
  "资料链接无效，无法打开。": "The document URL is invalid and cannot be opened.",
  "分组已更新": "Group updated",
  "分组已创建": "Group created",
  "请先新建一个分组，再创建 Flow。": "Create a Group before creating a Flow.",
  "Flow 不存在，无法保存。": "The Flow no longer exists and cannot be saved.",
  "Flow 已更新": "Flow updated",
  "Flow 已创建": "Flow created",
  "Flow 已删除，原步骤已保留为普通 Task": "Flow deleted; its Tasks remain as standalone Tasks",
  "分组已删除": "Group deleted",
  "无法移动 Task 与 Flow：目标分组不存在。": "Tasks and Flows cannot be moved because the target Group does not exist.",
  "Task 与 Flow 已移动，原分组已删除": "Tasks and Flows moved; the original Group was deleted",
  "分组及其中 Flow、Task 已删除": "Group, Flows, and Tasks deleted",
  "请先新建一个分组，再创建 Task。": "Create a Group before creating a Task.",
  "请先输入合法的 HTTP/HTTPS 链接。": "Enter a valid HTTP/HTTPS URL first.",
  "Task 已更新": "Task updated",
  "Task 已创建": "Task created",
  "Task 已删除": "Task deleted",
  "Task 不存在，无法保存进度记录。": "The Task no longer exists, so the progress note cannot be saved.",
  "进度记录已清空": "Progress note cleared",
  "Task 不存在，无法保存资料。": "The Task no longer exists, so related documents cannot be saved.",
  "相关资料已保存并同步到资料库": "Related documents saved and synced to the Document Library",
  "资料已更新并同步到时间轴": "Document updated and synced to the timeline",
  "资料已添加": "Document added",
  "资料已删除": "Document deleted",
  "Excel 文件不能超过 15 MB。": "The Excel file cannot exceed 15 MB.",
  "无法读取所选 Excel 文件。": "The selected Excel file cannot be read.",
  "资料库 Excel 组件未加载，请刷新页面后重试。": "The Document Library Excel component is not loaded. Refresh the page and try again.",
  "Excel 导入组件未加载，请刷新页面后重试。": "The Excel import component is not loaded. Refresh the page and try again.",
  "可回导 Excel 组件未加载，请刷新页面后重试。": "The re-importable Excel component is not loaded. Refresh the page and try again.",
  "人员 Task 状态导出组件未加载，请刷新页面后重试。": "The person Task status export component is not loaded. Refresh the page and try again.",
  "JSON 备份已导出": "JSON backup exported",
  "无法读取所选文件。": "The selected file cannot be read.",
  "JSON 数据已恢复": "JSON data restored",
  "本期 DDL 已确认完成": "Current deadline marked completed",
  "本期 DDL 已恢复为未完成": "Current deadline restored to incomplete",
  "Task 已标记完成": "Task marked completed",
  "Task 已恢复为未完成": "Task restored to incomplete",
  "确认补充导入": "Confirm Supplement Import",
  "确认完整覆盖": "Confirm Complete Replacement",
  "正在导入…": "Importing…",
  "正在导出…": "Exporting…",
  "导出中…": "Exporting…",
  "打开": "Open",
  "编辑 Task": "Edit Task",
  "编辑资料": "Edit Document",
  "不加入 Flow": "No Flow",
  "＋ 创建新的 Flow…": "+ Create New Flow…",
  "不重复的 Task 只在其 DDL 所在周显示一次。": "A non-recurring Task appears once in the week containing its DDL.",
  "先建立第一个分组": "Create Your First Group",
  "Task 必须归属分组。建立分组后即可开始安排周时间轴。": "Every Task belongs to a Group. Create one to start planning on the weekly timeline.",
  "该周没有符合筛选条件的 Task": "No Tasks Match the Filters This Week",
  "该周没有 Task DDL": "No Task Deadlines This Week",
  "清空筛选后可继续查看该周，或返回 Task by Week 选择其他周。": "Clear the filters to review this week, or return to Task by Week and choose another week.",
  "返回 Task by Week 后，可双击其他周的日期框继续查看。": "Return to Task by Week, then double-click another week header to continue.",
  "返回 Task by Week": "Return to Task by Week",
  "没有符合条件的 Task": "No Tasks Match the Filters",
  "尝试减少筛选条件，或清空筛选查看全部 Task。": "Remove one or more filters, or clear them to view every Task.",
  "没有符合当前筛选条件的资料。": "No documents match the current filters.",
  "还没有资料，可手动添加或上传。": "No documents yet. Add one manually or upload a file.",
  "暂无步骤。可在新建或编辑 Task 时把它加入此 Flow。": "No steps yet. Add a Task to this Flow while creating or editing it.",
  "Flow 创建后，可在 Task 中选择加入并在这里拖动排序。": "After creating the Flow, add Tasks to it and reorder them here.",
  "⚠ 本期逾期": "⚠ Overdue",
  "✓ 本期已完成": "✓ Period Completed",
  "周期未开始": "Recurrence Not Started",
  "周期已结束": "Recurrence Ended",
  "本期无 DDL": "No DDL This Period",
  "本期未完成": "Period Incomplete",
  "双击管理相关资料": "Double-click to manage related documents",
  "暂无相关资料": "No related documents",
  "暂无 Task": "No Tasks",
  "暂无 Flow": "No Flows",
  "未关联": "Not linked",
  "当前没有临期未完成 Task": "No incomplete Tasks are due soon",
  "未来 7 天可以从容安排。": "No urgent deadlines in the next seven days.",
  "明天": "Tomorrow",
  "Weekflow Desktop 使用说明": "Weekflow Desktop User Guide",
  "这是一款 Multi-task 管理的座舱程序，具备多任务进度管理、任务相关资料汇总整理的功能。": "Weekflow is a Multi-task management cockpit for tracking progress across multiple Tasks and organizing all related documents in one place.",
  "主要功能": "Key Features",
  "时间轴看板：": "Timeline:",
  "主界面 Task by Week 按自然周查看 Task DDL；双击任意周表头进入 Task by Day，只显示该周 DDL，并按周一至周日精确落到具体日期。日视图通过“返回 Task by Week”回到周时间轴。": "Task by Week shows Task deadlines by natural week. Double-click any week header to open Task by Day, which shows only that week's deadlines from Monday through Sunday. Use Return to Task by Week to go back.",
  "Task 管理：": "Task Management:",
  "创建和编辑 Task，可记录进度、完成状态和相关资料；紧急程度、汇报对象和交付物为必填项，汇报对象与管理对象均按人员姓名录入。周期可选每周或每月，需指定周期开始和结束日期。": "Create and edit Tasks with progress notes, completion status, and related documents. Urgency, Report To, and Deliverable are required; Report To and Managed Person are entered as person names. Recurrence can be weekly or monthly with required start and end dates.",
  "周期 DDL：": "Recurring Deadlines:",
  "周期 Task 仍只统计为一条 Task，但时间轴会按基准 DDL 的星期或日期显示多个 DDL；勾选本期完成会同时视同此前各期完成，下一周期自动恢复未勾选并保留之前的连续完成记录。": "A recurring Task is counted once but displays multiple deadlines based on its anchor weekday or date. Completing the current period also completes all previous periods; the next period resets while the continuous completion history remains.",
  "Flow 工作流：": "Flow Workflow:",
  "在分组和 Task 之间增加可选步骤层，支持拖动排序；新 Flow 默认继承所属分组颜色。": "Use the optional Flow layer between Groups and Tasks to define ordered steps. Tasks can be reordered by dragging, and new Flows inherit their Group color by default.",
  "DDL 提醒：": "Deadline Reminder:",
  "每次进入程序会在右下角播报未来 7 天内的未完成 Task，10 秒后自动关闭，悬浮时不影响页面操作。": "On entry, a non-blocking reminder lists incomplete Tasks due within seven days and closes automatically after ten seconds.",
  "筛选与看板：": "Filters and Dashboards:",
  "时间轴可按分组、Flow、状态、紧急程度、逾期或关键词组合筛选；筛选弹层会在切换菜单或点击空白处时关闭。整体看板常驻显示 Task 总数、已完成、未完成、当前逾期和完成率，并可按分组、Flow、管理对象或汇报对象切换查看详细进度。": "Filter the timeline by Group, Flow, status, urgency, overdue state, or keywords. Popovers close when another menu or blank area is selected. The Overall Dashboard always shows totals, completed, incomplete, overdue, and completion rate, with details by Group, Flow, Managed Person, or Report To.",
  "对象汇总与导出：": "People Summaries and Exports:",
  "整体看板按人员姓名分别汇总每个管理对象和汇报对象的完成率、已完成、未完成及逾期数量，并一键导出该人员的 Task 状态。": "The Overall Dashboard summarizes completion rate and completed, incomplete, and overdue counts for each Managed Person and Report To, with one-click Task status export.",
  "Excel 批量录入：": "Excel Bulk Import:",
  "20 列 Task 模板包含周期、周期起止和完成历史，可下载空白模板或按模板下载当前数据，上传后先校验预览，再选择补充导入或完整覆盖。": "The 20-column Task template includes recurrence, date range, and completion history. Download a blank template or current data in the same format, validate the upload preview, then choose supplement import or complete replacement.",
  "资料库：": "Document Library:",
  "统一管理说明文档、交付物、控制表和文件夹；搜索及类型、分组、Flow、Task 筛选集中在表格上方，并按“分组 → Flow → Task”选择关联、与时间轴双向同步。": "Manage Documentation, Deliverables, Control Sheets, and Folders in one place. Search and Type, Group, Flow, and Task filters sit above the table. Relations follow Group → Flow → Task and sync both ways with the timeline.",
  "最近常用：": "Recently Used:",
  "本自然周或上个自然周至少打开过一次的资料可一键筛出。": "Filter documents opened at least once during the current or previous natural week.",
  "资料导入与清理：": "Document Import and Cleanup:",
  "资料 Excel 可选择补充导入或全部覆盖；重复地址可替换或跳过，批量删除需连续确认两次。": "Document Excel import supports supplement import or overwrite all. Duplicate URLs can be replaced or skipped, and bulk deletion requires two confirmations.",
  "数据保存位置": "Data Storage Location",
  "数据备份与恢复": "Data Backup and Restore",
  "点击顶部数据操作区的": "Select",
  "选择“导出 JSON 备份”，将文件保存到安全位置。": "Choose Export JSON Backup and save the file in a safe location.",
  "需要恢复时选择“从 JSON 恢复”，程序会先校验数据并请求确认。": "To restore, choose Restore from JSON. Weekflow validates the data and asks for confirmation first.",
  "Excel 导出": "Excel Export",
  "开发团队": "Development Team",
  "开发团队：Wesley Yan": "Development team: Wesley Yan",
  "首个桌面版本（v1.0）：2026年8月14日": "First desktop release (v1.0): August 14, 2026",
  "由 Web 版 v2.5 移植": "Ported from Web v2.5",
  "Weekflow 更新日志": "Weekflow Changelog",
  "新增与调整": "New and Updated",
  "新增": "New",
  "稳定性": "Stability",
  "优化与修复": "Improvements and Fixes",
  "变更与修复": "Changes and Fixes",
  "搜索分组": "Search Groups",
  "搜索 Flow": "Search Flows",
  "搜索 Task": "Search Tasks",
  "请先选择分组": "Select a Group first",
  "搜索资料名称": "Search document names",
  "搜索 Task、Flow、进度、交付物或资料": "Search Tasks, Flows, progress, deliverables, or documents",
  /* ---- 桌面版新增条目（重构后新写/改写的文案 + 原版英文模式下漏译的明显空缺，
     翻译风格沿用原有条目） ---- */
  "编辑 Flow": "Edit Flow",
  "周一至周日 · DDL 精确到天": "Monday to Sunday · Deadlines shown by day",
  "数据已从 JSON 恢复": "Data restored from JSON",
  "JSON 备份": "JSON Backup",
  "Excel 工作簿": "Excel Workbook",
  "Task 空白模板已下载": "Blank Task template downloaded.",
  "资料库空白模板已下载": "Blank document template downloaded.",
  "还没有 Task": "No Tasks yet",
  "还没有分组": "No Groups yet",
  "前往时间轴": "Go to Timeline",
  "创建 Task 并填写管理对象后，这里会显示对应进度。": "Create a Task and fill in Managed Person to see progress here.",
  "创建 Task 并填写汇报对象后，这里会显示对应进度。": "Create a Task and fill in Report To to see progress here.",
  "暂无分组数据": "No Group data",
  "暂无管理对象数据": "No Managed Person data",
  "暂无汇报对象数据": "No Report To data",
  "建立分组后，这里会显示精确统计和完成进度。": "Create a Group to see exact statistics and progress here.",
  "未知分组": "Unknown Group",
  "未加入": "No Flow",
  "所选分组暂无 Flow": "No Flows in the selected Groups",
  "所选分组暂无 Task": "No Tasks in the selected Groups",
  "还没有可选分组": "No Groups available yet",
  "未知错误": "Unknown error",
  "Flow：未加入": "Flow: No Flow"
};

export function normalizeLanguage(value: unknown): Language {
  const text = String(value || "").toLowerCase();
  if (text === "en" || text.startsWith("en-")) return "en";
  if (text === "zh" || text.startsWith("zh-")) return "zh-CN";
  return DEFAULT_LANGUAGE;
}

function loadLanguage(): Language {
  try {
    language = normalizeLanguage(
      typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
    );
  } catch (_error) {
    language = DEFAULT_LANGUAGE;
  }
  return language;
}

export function getLanguage(): Language {
  return language;
}

export function isEnglish(): boolean {
  return language === "en";
}

/* 写偏好并整页重载（原版语义：app.js:287-288 的点击处理器先 setLanguage 再 reload；
   重载后 observer 不跨语言残留，也不需要任何反向翻译）。 */
export function setLanguage(value: string): Language {
  language = normalizeLanguage(value);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, language);
    }
  } catch (_error) {
    /* 存储不可用时语言仍对当前页面生效（沿用原版注释语义）。 */
  }
  if (typeof window !== "undefined" && window.location) {
    window.location.reload();
  }
  return language;
}

/** 整句/带数字句式翻译：先查 EN_TEXT 字典，再按参数化正则。非英文模式原样返回。 */
export function translateText(text: string): string {
  if (language !== "en") return text;
  const raw = String(text || "");
  const leading = (raw.match(/^\s*/) || [""])[0];
  const trailing = (raw.match(/\s*$/) || [""])[0];
  const clean = raw.trim();
  if (!clean) return raw;
  if (EN_TEXT[clean]) return leading + EN_TEXT[clean] + trailing;
  const patterns: ReadonlyArray<readonly [RegExp, string]> = [
    [/^确认删除笔记「(.+)」？已转换的 Task 和进度记录不会删除。$/, "Delete note “$1”? Converted Tasks and progress records will remain."],
    [/^请再次确认删除这条笔记。删除后无法恢复。$/, "Confirm again: this note cannot be recovered after deletion."],
    [/^当前笔记尚未保存，继续后修改会丢失。仍要继续吗？$/, "This note has unsaved changes. Continue and discard them?"],
    [/^当前进度记录尚未保存，继续后修改会丢失。仍要继续吗？$/, "This progress record has unsaved changes. Continue and discard them?"],
    [/^确认删除当前这条进度记录？$/, "Delete this progress record?"],
    [/^请再次确认。删除后无法恢复。$/, "Confirm again: deletion cannot be undone."],
    [/^退出后，已保存的 (\d+) 个 Task 会保留，其余草稿不会创建。确认退出？$/, "Exit conversion? The $1 saved Tasks will remain; unresolved drafts will not be created."],
    [/^Task 草稿转换尚未完成，确认退出？$/, "Task draft conversion is not complete. Exit anyway?"],
    [/^Task 草稿转换尚未完成，退出后已创建的 Task 会保留，但本次转换进度不会记录。仍要退出吗？$/, "Task draft conversion is not complete. Created Tasks will remain, but this conversion will not be recorded. Exit anyway?"],
    [/^(\d+) 条可见 Task$/, "$1 visible Tasks"],
    [/^共 (\d+) 条资料$/, "$1 documents"],
    [/^已选 (\d+) 条$/, "$1 selected"],
    [/^(\d+) 个步骤$/, "$1 steps"],
    [/^(\d+) 项$/, "$1 selected"],
    [/^(\d+) 个$/, "$1"],
    [/^显示 (\d+) \/ (\d+) 条资料$/, "Showing $1 of $2 documents"],
    [/^Task 总数$/, "Total Tasks"],
    [/^当前逾期$/, "Currently Overdue"],
    [/^分组：(.*)$/, "Group: $1"],
    [/^状态：未完成$/, "Status: Incomplete"],
    [/^状态：已完成$/, "Status: Completed"],
    [/^紧急程度：高$/, "Urgency: High"],
    [/^紧急程度：中$/, "Urgency: Medium"],
    [/^紧急程度：低$/, "Urgency: Low"],
    [/^仅看逾期$/, "Overdue only"],
    [/^筛选中$/, "Filtered"],
    [/^逾期 (\d+)$/, "Overdue $1"],
    [/^✓ 完成 (\d+)$/, "✓ Completed $1"],
    [/^○ 进行 (\d+)$/, "○ Active $1"],
    [/^本周及上周打开 (\d+) 次$/, "Opened $1 times this or last week"],
    [/^(\d+) 条未完成 Task 即将到期$/, "$1 incomplete Tasks are due soon"],
    [/^另有 (\d+) 条未显示$/, "$1 more not shown"],
    [/^(\d+) 天后$/, "in $1 days"]
  ];
  for (let index = 0; index < patterns.length; index += 1) {
    if (patterns[index][0].test(clean)) {
      return leading + clean.replace(patterns[index][0], patterns[index][1]) + trailing;
    }
  }
  return raw;
}

/** 动态消息翻译（toast / confirm / 校验错误）：字典 → “第 N 行：”前缀递归 →
   参数化正则 → 兜底逐词替换。等价原版 toast()/confirm() 入口行为。 */
export function translateMessage(text: string): string {
  if (language !== "en") return String(text || "");
  let clean = String(text || "");
  const exact = translateText(clean);
  if (exact !== clean) return exact;
  const rowMatch = clean.match(/^第 (\d+) 行：(.+)$/);
  if (rowMatch) {
    return "Row " + rowMatch[1] + ": " + translateMessage(rowMatch[2]);
  }
  const patterns: ReadonlyArray<readonly [RegExp, string]> = [
    [/^确认删除选中的 (\d+) 条资料？它们会从所有相关 Task 中同步移除。$/, "Delete the $1 selected documents? They will also be removed from every related Task."],
    [/^确认删除 Flow「(.+)」？其中 (\d+) 条 Task 会保留在原分组并取消 Flow 归属。$/, "Delete Flow “$1”? Its $2 Tasks will remain in their current Group without a Flow."],
    [/^确认删除 Flow「(.+)」？$/, "Delete Flow “$1”?"],
    [/^确认删除分组「(.+)」及其中 (\d+) 个空 Flow？此操作不可恢复。$/, "Delete Group “$1” and its $2 empty Flows? This action cannot be undone."],
    [/^确认删除分组「(.+)」？此操作不可恢复。$/, "Delete Group “$1”? This action cannot be undone."],
    [/^确认将「(.+)」内的 Task 与 Flow 移动到「(.+)」并删除原分组？$/, "Move the Tasks and Flows in “$1” to “$2”, then delete the original Group?"],
    [/^最终确认：删除分组「(.+)」、其中 (\d+) 个 Flow 和 (\d+) 条 Task？此操作不可恢复。$/, "Final confirmation: delete Group “$1”, its $2 Flows, and its $3 Tasks? This action cannot be undone."],
    [/^确认删除 Task「(.+)」？此操作不可恢复。$/, "Delete Task “$1”? This action cannot be undone."],
    [/^确认删除资料「(.+)」？所有 Task 中的关联也会移除。$/, "Delete document “$1”? Its relations will also be removed from every Task."],
    [/^全部覆盖会先删除资料库现有的 (\d+) 条资料，再导入 (\d+) 条新资料。是否继续？$/, "Overwrite All will delete the $1 current documents before importing $2 new documents. Continue?"],
    [/^完整覆盖会以本文件中的 (\d+) 个分组、(\d+) 个 Flow 和 (\d+) 条 Task，替换当前全部时间轴数据。资料库的 (\d+) 条资料不会删除；同名层级会尽量保留原有关联。是否继续？$/, "Complete Replacement will replace all timeline data with the file's $1 Groups, $2 Flows, and $3 Tasks. The $4 Document Library items will remain, and relations will be retained where matching hierarchy names allow. Continue?"],
    [/^确认用该备份替换当前数据？将导入 (\d+) 个分组和 (\d+) 条 Task、(\d+) 条资料。$/, "Replace the current data with this backup? It contains $1 Groups, $2 Tasks, and $3 documents."],
    [/^链接地址与第 (\d+) 行重复$/, "Link URL duplicates row $1"],
    [/^(Task|Flow|分组)「(.+)」不存在$/, "$1 “$2” does not exist"],
    [/^(Task|Flow|分组)「(.+)」存在重名，请使用完整层级路径$/, "More than one $1 is named “$2”. Use the full hierarchy path."],
    [/^单次最多导入 (\d+) 条资料，请拆分文件。$/, "A single import supports up to $1 documents. Split the file and try again."],
    [/^无法读取 Excel：(.+)$/, "Unable to read the Excel file: $1"],
    [/^周期完成记录第 (\d+) 项必须是 周期DDL\|完成日期$/, "Recurrence Completion History item $1 must use occurrence DDL|completion date"],
    [/^周期完成记录包含重复 DDL (.+)$/, "Recurrence Completion History contains duplicate DDL $1"],
    [/^周期完成记录中的 (.+) 不是该 Task 的周期 DDL$/, "$1 in Recurrence Completion History is not a recurring DDL for this Task"],
    [/^(说明文档|交付物)第 (\d+) 个链接不是有效的 HTTP\/HTTPS 地址$/, "$1 link $2 is not a valid HTTP/HTTPS URL"],
    [/^发现 (\d+) 个问题，修正后请重新选择文件：$/, "$1 issues found. Correct them, then choose the file again:"],
    [/^其余 (\d+) 个问题未显示。$/, "$1 additional issues are not shown."],
    [/^另有 (\d+) 条 Task，将在确认后一起导入$/, "$1 additional Tasks will be imported after confirmation"],
    [/^当前没有可(折叠|展开)的分组$/, "There are no Groups to $1"],
    [/^已删除 (\d+) 条资料$/, "$1 documents deleted"],
    [/^打开次数保存失败：(.+)$/, "Failed to save the open count: $1"],
    [/^已全部覆盖资料库，共导入 (\d+) 条资料$/, "Document Library overwritten with $1 imported documents"],
    [/^资料导入完成：新增 (\d+) 条，替换 (\d+) 条，跳过 (\d+) 条$/, "Document import completed: $1 added, $2 replaced, $3 skipped"],
    [/^资料库已下载：(.+)$/, "Document Library downloaded: $1"],
    [/^资料库下载失败：(.+)$/, "Document Library download failed: $1"],
    [/^已完整覆盖时间轴，共导入 (\d+) 条 Task$/, "Timeline completely replaced with $1 imported Tasks"],
    [/^已补充导入 (\d+) 条 Task$/, "$1 Tasks imported"],
    [/^Excel 导入失败：(.+)$/, "Excel import failed: $1"],
    [/^已按导入模板下载当前数据：(.+)$/, "Current data downloaded in import format: $1"],
    [/^当前数据下载失败：(.+)$/, "Current data download failed: $1"],
    [/^看板报告已导出：(.+)$/, "Dashboard report exported: $1"],
    [/^看板报告导出失败：(.+)$/, "Dashboard report export failed: $1"],
    [/^AI 改写失败：(.+)$/, "AI rewrite failed: $1"],
    [/^AI 解析失败，已保留本地规则结果：(.+)$/, "AI parsing failed; local-rule results were retained: $1"],
    [/^Task 状态已导出：(.+)$/, "Task status exported: $1"],
    [/^Task 状态导出失败：(.+)$/, "Task status export failed: $1"],
    [/^备份导出失败：(.+)$/, "Backup export failed: $1"],
    [/^导入失败：(.+)$/, "Import failed: $1"],
    [/^周期状态刷新失败：(.+)$/, "Recurrence status refresh failed: $1"],
    [/^保存失败：(.+)$/, "Save failed: $1"],
    [/^JSON 备份已导出：(.+)$/, "JSON backup exported: $1"],
    [/^模板下载失败：(.+)$/, "Template download failed: $1"],
    [/^文件保存失败：(.+)$/, "Failed to save the file: $1"]
  ];
  for (let patternIndex = 0; patternIndex < patterns.length; patternIndex += 1) {
    if (patterns[patternIndex][0].test(clean)) {
      clean = clean.replace(patterns[patternIndex][0], patterns[patternIndex][1]);
      clean = clean
        .replace(/^分组 /, "Group ")
        .replace(/^说明文档 link/, "Documentation link")
        .replace(/^交付物 link/, "Deliverable link");
      if (/There are no Groups to (折叠|展开)/.test(clean)) {
        clean = clean.replace("折叠", "collapse").replace("展开", "expand");
      }
      return clean;
    }
  }
  const replacements: ReadonlyArray<readonly [RegExp, string]> = [
    [/资料库/g, "Document Library"], [/资料/g, "document"], [/分组/g, "Group"],
    [/汇报对象/g, "Report To"], [/管理对象/g, "Managed Person"], [/交付物/g, "Deliverable"],
    [/紧急程度/g, "Urgency"], [/周期/g, "recurrence"], [/完整覆盖/g, "complete replacement"],
    [/补充导入/g, "supplement import"], [/导入/g, "import"], [/导出/g, "export"],
    [/已下载/g, "downloaded"], [/失败/g, "failed"], [/已保存/g, "saved"],
    [/已更新/g, "updated"], [/已创建/g, "created"], [/已删除/g, "deleted"],
    [/确认/g, "Confirm"], [/取消/g, "Cancel"], [/全部/g, "all"],
    [/未填写/g, "Not provided"], [/未完成/g, "Incomplete"], [/已完成/g, "Completed"],
    [/链接/g, "link"], [/时间轴/g, "timeline"], [/当前/g, "current"],
    [/错误/g, "error"], [/请/g, "Please "]
  ];
  replacements.forEach((pair) => {
    clean = clean.replace(pair[0], pair[1]);
  });
  return clean;
}

/** 复合文本翻译：observer 对 DOM 文本节点的主入口（含 aria/title 等长尾句式）。 */
export function translateCompositeText(value: string): string {
  if (language !== "en") return String(value || "");
  let text = String(value || "");
  const exact = translateText(text);
  if (exact !== text) return exact;
  const replacements: ReadonlyArray<readonly [RegExp, string]> = [
    [/全部 Flow/g, "All Flows"], [/全部状态/g, "All Statuses"],
    [/全部紧急程度/g, "All Urgencies"], [/未加入 Flow/g, "No Flow"],
    [/暂无 Flow 数据/g, "No Flow data"], [/还没有 Flow/g, "No Flows yet"],
    [/未关联/g, "Not linked"], [/仍需推进/g, "In progress"],
    [/Flow 可把同一分组内的 Task 组织为有顺序的工作步骤。/g, "Flows organize Tasks in the same Group into ordered workflow steps."],
    [/已退出当前逾期/g, "Current overdue filter cleared"],
    [/Task 已标记完成/g, "Task marked completed"],
    [/Task 已恢复为未完成/g, "Task restored to incomplete"],
    [/本期 DDL 已确认完成/g, "Current deadline marked completed"],
    [/本期 DDL 已恢复为未完成/g, "Current deadline restored to incomplete"],
    [/双击查看 ([^\n]+) 的日时间轴/g, "Double-click to view the daily timeline for $1"],
    [/双击进入该周的 Task by Day/g, "Double-click to open Task by Day for this week"],
    [/恢复为未完成/g, "Restore to incomplete"], [/标记为已完成/g, "Mark as completed"],
    [/展开分组/g, "Expand Group"], [/收起分组/g, "Collapse Group"],
    [/展开 Flow/g, "Expand Flow"], [/收起 Flow/g, "Collapse Flow"],
    [/查看分组 /g, "View Group "], [/编辑 Flow /g, "Edit Flow "],
    [/查看 Flow /g, "View Flow "],
    [/编辑 Task /g, "Edit "], [/选择资料 /g, "Select document "],
    [/打开 /g, "Open "], [/双击添加进度记录/g, "Double-click to add a progress note"],
    [/进度记录，暂无内容；双击或按回车编辑/g, "Progress note is empty; double-click or press Enter to edit"],
    [/相关资料，(\d+) 条；双击或按回车管理/g, "$1 related documents; double-click or press Enter to manage"],
    [/进度记录，已有内容；双击或按回车编辑/g, "Progress note available; double-click or press Enter to edit"],
    [/导出管理对象“([^”]+)”的 Task 状态/g, "Export Task status for Managed Person “$1”"],
    [/导出汇报对象“([^”]+)”的 Task 状态/g, "Export Task status for Report To “$1”"],
    [/点击查看逾期 Task/g, "View overdue Tasks"],
    [/完成率 (\d+(?:\.\d+)?)%/g, "Completion rate $1%"],
    [/全部 Task 统计/g, "All Task statistics"],
    [/当前筛选结果统计/g, "Current filtered statistics"],
    [/本自然周或上个自然周至少打开过一次/g, "Opened at least once this or last natural week"],
    [/(\d+) 个分组 · (\d+) 个 Flow/g, "$1 Groups · $2 Flows"],
    [/(\d+) 条笔记/g, "$1 notes"],
    [/分组 (\d+)/g, "Group $1"],
    [/Flow (\d+) · (\d+) 个步骤/g, "Flow $1 · $2 steps"],
    [/(\d{4}) · 周五/g, "$1 · Friday"],
    [/([\d-]+ — [\d-]+) · (\d+) 周/g, "$1 · $2 weeks"],
    [/(\d{4}-\d{2}-\d{2} — \d{4}-\d{2}-\d{2}) · (\d+) 周/g, "$1 · $2 weeks"],
    [/([\d-]+) · (\d+) 天后/g, "$1 · in $2 days"],
    [/([\d-]+) · 明天/g, "$1 · Tomorrow"],
    [/([\d-]+) · 今天/g, "$1 · Today"],
    [/统计全部 (\d+) 条 Task（不受时间轴筛选影响）/g, "All $1 Tasks included (timeline filters do not apply)"],
    [/ · 将按当前时间新增一条独立记录。/g, " · A separate record will be added with the current timestamp."],
    [/可选择 (\d+) 个 Task/g, "$1 Tasks available"],
    [/最后更新：/g, "Last updated: "],
    [/最后编辑：/g, "Last edited: "],
    [/已完成一次性转换：(\d+) 条进度记录 · (\d+) 个 Task/g, "Completed conversions: $1 progress records · $2 Tasks"],
    [/识别到 (\d+) 个潜在 Task，正在编辑第 (\d+) 个/g, "Detected $1 potential Tasks · Editing $2"],
    [/(\d+) 个待处理 · (\d+) 个已保存 · (\d+) 个已跳过/g, "$1 pending · $2 saved · $3 skipped"],
    [/已预填：/g, "Prefilled: "],
    [/ · 可能的 ([^：]+)：/g, " · Suggested $1: "],
    /* ---- 桌面版新增替换（原版漏译空缺 + 新文案；置于通用尾缀规则之前） ---- */
    [/([\d-]+ — [\d-]+) · 周一至周日/g, "$1 · Monday to Sunday"],
    [/ · 工作表：/g, " · Sheet: "],
    [/另有 (\d+) 条 Task，将在确认后一起导入/g, "$1 additional Tasks will be imported after confirmation"],
    [/^「(.+)」中有 (\d+) 条 Task 和 (\d+) 个 Flow。移动时会保留 Flow 与步骤顺序。$/, "“$1” contains $2 Tasks and $3 Flows. Flows and their step order are retained."],
    [/关键词：/g, "Keyword: "],
    [/Flow：/g, "Flow: "],
    [/条关联 Task$/g, "related Tasks"],
    [/条地址重复$/g, "with duplicate URLs"],
    [/条未分组$/g, "ungrouped"],
    [/条资料$/g, "documents"],
    [/个新分组$/g, "new Groups"],
    [/个新 Flow$/g, "new Flows"],
    [/条 Task$/g, "Tasks"],
    [/个分组$/g, "Groups"],
    [/个 Flow$/g, "Flows"],
    [/上移 /g, "Move up "],
    [/下移 /g, "Move down "],
    [/进度（(\d+)）/g, "Progress ($1)"], [/资料（(\d+)）/g, "Documents ($1)"],
    [/✓ 已完成/g, "✓ Completed"], [/⇩ 导出 Task 状态/g, "⇩ Export Task Status"],
    [/导出$/g, "Export"], [/编辑$/g, "Edit"], [/紧急$/g, "Urgency"],
    [/^管$/g, "M"], [/^汇$/g, "R"],
    [/进度记录$/g, "Progress Note"], [/中文/g, "Chinese"],
    [/分组：/g, "Group: "], [/紧急程度：/g, "Urgency: "],
    [/状态：/g, "Status: "], [/汇报对象：/g, "Report To: "],
    [/管理对象：/g, "Managed Person: "], [/交付物：/g, "Deliverable: "],
    [/（周一）/g, " (Monday)"], [/（周二）/g, " (Tuesday)"],
    [/（周三）/g, " (Wednesday)"], [/（周四）/g, " (Thursday)"],
    [/（周五）/g, " (Friday)"], [/（周六）/g, " (Saturday)"],
    [/（周日）/g, " (Sunday)"], [/未完成/g, "Incomplete"], [/已完成/g, "Completed"]
  ];
  replacements.forEach((pair) => {
    text = text.replace(pair[0], pair[1]);
  });
  return text;
}

function translateAttribute(name: string, value: string | null): string | null {
  if (language !== "en") return value;
  const clean = String(value || "").trim();
  if (EN_TEXT[clean]) return EN_TEXT[clean];
  const attributes: Record<string, string> = {
    "主导航": "Primary navigation",
    "语言切换": "Language switch",
    "筛选与数据操作": "Filters and data actions",
    "更多数据操作": "More data actions",
    "资料库筛选": "Document Library filters",
    "当前数据概览": "Current data overview",
    "Weekflow 工作结构示意": "Weekflow work structure",
    "Weekflow 功能入口": "Weekflow feature shortcuts",
    "图例": "Legend",
    "分组与 Flow 展开折叠控制": "Expand and collapse Groups and Flows",
    "时间轴范围控制": "Timeline range controls",
    "整体看板功能切换": "Overall dashboard views",
    "资料显示范围": "Document display scope",
    "资料清单": "Documents list",
    "选择当前筛选结果中的全部资料": "Select every document in the current results",
    "关闭": "Close",
    "关闭 DDL 提醒": "Close deadline reminder",
    "展开所有分组与 Flow": "Expand all Groups and Flows",
    "折叠所有分组与 Flow": "Collapse all Groups and Flows",
    "向前 4 周": "Back 4 weeks",
    "向后 4 周": "Forward 4 weeks",
    "Weekflow 首页": "Weekflow Home",
    "拖动调整顺序": "Drag to reorder",
    "上移": "Move up",
    "下移": "Move down",
    "链接类型": "Link Type",
    "从当前 Task 移除资料关联": "Remove the document relation from this Task",
    "Weekflow Desktop v1.0 中英双语桌面 Task 管理工具，支持周/日双时间轴、分组、Flow、资料库、双向联动、看板、备份和 Excel 批量导入导出。": "Weekflow Desktop v1.0 bilingual desktop Task manager with weekly/daily timelines, Groups, Flows, Document Library, dashboards, backup, and Excel import/export.",
    "Weekflow Desktop v1.1.0 中英双语桌面 Task 管理工具，支持周/日双时间轴、资料库双布局、随手记、多条进度历史、Task 草稿转换、看板、备份和 Excel 批量导入导出。": "Weekflow Desktop v1.1.0 bilingual desktop Task manager with weekly/daily timelines, dual Document Library layouts, Quick Notes, progress history, Task draft conversion, dashboards, backup, and Excel import/export.",
    "例如：已完成需求确认和接口联调，当前等待业务方验收。\n\n可按日期分段记录，也可以作为持续更新的项目备注。": "Example: Requirements and integration are complete; business acceptance is pending.\n\nUse dated entries or maintain this as a continuously updated project note."
  };
  return attributes[clean] || translateCompositeText(value || "");
}

/* 用户内容跳过选择器：业务内容和富文本不能被运行时翻译器改写。 */
const USER_CONTENT_SELECTOR =
  ".task-title, .task-node-label, .group-name, .flow-name, .material-name-button, " +
  ".material-url-button, .material-note-cell, .person-table-name, " +
  ".group-card-copy strong, .task-dialog-user-value, .note-list-item, " +
  ".progress-entry-item, .rich-text-editor, [data-user-content]";

function translateNode(node: Node | null): void {
  if (!node || node.nodeType !== 3) return;
  const parent = (node as Text).parentElement;
  if (!parent) return;
  if (["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) return;
  if (parent.closest(USER_CONTENT_SELECTOR)) return;
  const translated = translateCompositeText(node.nodeValue || "");
  if (translated !== node.nodeValue) node.nodeValue = translated;
}

function translateElement(element: Node | null): void {
  if (!element || element.nodeType !== 1) return;
  const el = element as Element;
  ["aria-label", "title", "placeholder", "content", "data-placeholder"].forEach((name) => {
    if (!el.hasAttribute(name)) return;
    const value = el.getAttribute(name);
    let translated = translateAttribute(name, value);
    if (translated === value) translated = translateCompositeText(value || "");
    if (translated !== value) el.setAttribute(name, translated || "");
  });
  if (language === "en" && el.matches('input[type="date"]')) {
    (el as HTMLInputElement).lang = "en-US";
  }
}

function refreshDateInput(input: HTMLInputElement | null): void {
  if (!input) return;
  const shell = input.closest(".localized-date-shell");
  if (!shell) return;
  shell.classList.toggle("is-empty", !input.value);
}

/* 原版注入式日期壳（保留作兜底；React 应用内日期输入由 DateInput 预渲染壳，
   这里的注入分支不会触发）。 */
function setupEnglishDateInputs(): void {
  if (typeof document === "undefined" || language !== "en") return;
  document.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach((input) => {
    input.lang = "en-US";
    let shell = input.closest(".localized-date-shell");
    if (!shell) {
      shell = document.createElement("span");
      shell.className = "localized-date-shell";
      const parent = input.parentNode;
      if (parent) {
        parent.insertBefore(shell, input);
        shell.appendChild(input);
      }
      const placeholder = document.createElement("span");
      placeholder.className = "localized-date-placeholder";
      placeholder.textContent = ENGLISH_DATE_PLACEHOLDER;
      placeholder.setAttribute("aria-hidden", "true");
      shell.appendChild(placeholder);
      const icon = document.createElement("span");
      icon.className = "localized-date-icon";
      icon.setAttribute("aria-hidden", "true");
      shell.appendChild(icon);
      ["input", "change", "blur"].forEach((eventName) => {
        input.addEventListener(eventName, () => {
          refreshDateInput(input);
        });
      });
    }
    refreshDateInput(input);
  });
}

export function refreshDateInputs(): void {
  if (typeof document === "undefined" || language !== "en") return;
  setupEnglishDateInputs();
  document
    .querySelectorAll<HTMLInputElement>('.localized-date-shell input[type="date"]')
    .forEach((input) => {
      refreshDateInput(input);
    });
}

function translateAllAttributes(rootNode: Node | null): void {
  if (language !== "en" || !rootNode) return;
  if (rootNode.nodeType === 1) translateElement(rootNode);
  const rootElement = rootNode as Element;
  if (!rootElement.querySelectorAll) return;
  rootElement
    .querySelectorAll("[aria-label], [title], [placeholder], meta[content]")
    .forEach((element) => {
      translateElement(element);
    });
}

export function translateSubtree(rootNode: Node | null): void {
  if (language !== "en" || !rootNode) return;
  if (rootNode.nodeType === 3) translateNode(rootNode);
  if (rootNode.nodeType === 1) translateElement(rootNode);
  const doc = rootNode.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!doc || !doc.createTreeWalker) return;
  const walker = doc.createTreeWalker(rootNode, 5);
  let node: Node | null = walker.currentNode;
  while (node) {
    if (node.nodeType === 3) translateNode(node);
    else translateElement(node);
    node = walker.nextNode();
  }
}

function observeDom(): void {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  if (observer) observer.disconnect();
  observer = new MutationObserver((mutations) => {
    if (language !== "en") return;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        translateSubtree(node);
      });
      if (mutation.type === "characterData") translateNode(mutation.target);
      if (mutation.type === "attributes") translateElement(mutation.target);
    });
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-label", "title", "placeholder", "content"]
  });
}

/* 启动时调用一次（React 首帧提交后）：设置 <html lang>/<html data-language>/
   <body data-language>，英文模式整树翻译一次并启动 observer 接管后续增量，
   同步语言切换按钮激活态。 */
export function applyDocument(): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language === "en" ? "en" : "zh-CN";
  document.documentElement.dataset.language = language;
  if (document.body) document.body.dataset.language = language;
  if (language === "en") {
    translateSubtree(document.documentElement);
    translateAllAttributes(document.documentElement);
    setupEnglishDateInputs();
  }
  document
    .querySelectorAll<HTMLButtonElement>(".language-switch button[data-language]")
    .forEach((button) => {
      const active = normalizeLanguage(button.dataset.language) === language;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  observeDom();
}

/** 等价原版 app.js:78 的 confirm 包装：消息先过 translateMessage 再弹原生确认框。 */
export function tConfirm(message: string): boolean {
  return window.confirm(translateMessage(message));
}

loadLanguage();
