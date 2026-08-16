/* Weekflow bilingual UI and export-language settings. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.App = root.App || {};
  root.App.i18n = api;
})(typeof self !== "undefined" ? self : globalThis, function (root) {
  "use strict";

  var STORAGE_KEY = "weekflow-v2.4:language";
  var DEFAULT_LANGUAGE = "en";
  var SUPPORTED = ["zh-CN", "en"];
  var language = DEFAULT_LANGUAGE;
  var translations = { "zh-CN": {}, en: {} };
  var observer = null;
  var englishDocumentFragments = null;
  var ENGLISH_DATE_PLACEHOLDER = "MM / DD / YYYY";
  var EN_TEXT = {
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
    "搜索标题或正文": "Search titles or content",
    "写下第一条随手记": "Write Your First Quick Note",
    "保存后可以把内容添加为 Task 进度记录，或转换成一个或多个 Task 草稿。": "After saving, append the note to a Task's progress history or convert it into one or more Task drafts.",
    "笔记标题": "Note title",
    "尚未保存": "Not saved",
    "笔记文字格式": "Note text formatting",
    "加粗": "Bold",
    "斜体": "Italic",
    "字号": "Size",
    "选择字号": "Choose font size",
    "文字颜色": "Text color",
    "字色": "Text",
    "底色高亮": "Highlight color",
    "高亮": "Highlight",
    "选择字色": "Choose text color",
    "选择高亮颜色": "Choose highlight color",
    "清除格式": "Clear formatting",
    "在这里记录工作想法、会议要点或 SharePoint 链接…": "Capture work ideas, meeting notes, or SharePoint links here…",
    "删除笔记": "Delete Note",
    "添加到进度记录": "Add to Progress History",
    "AI 设置": "AI Settings",
    "AI 转换": "AI Conversion",
    "AI 改写": "AI Rewrite",
    "AI 接入设置": "AI Settings",
    "接入 AI": "Enable AI",
    "启用 AI 能力（Task 草稿解析 / 笔记改写）": "Enable AI (Task draft parsing / note rewriting)",
    "服务商": "Provider",
    "阿里云百炼 / DashScope": "Alibaba Cloud Model Studio / DashScope",
    "智谱 GLM / Z.ai": "Zhipu GLM / Z.ai",
    "自定义 / OpenAI 兼容": "Custom / OpenAI-compatible",
    "API Key": "API Key",
    "API Base URL": "API Base URL",
    "模型": "Model",
    "清除连接": "Clear Connection",
    "测试连接": "Test Connection",
    "保存设置": "Save Settings",
    "请选择模型": "Select a model",
    "自定义模型…": "Custom model…",
    "输入自定义模型名称": "Enter a custom model name",
    "开启后，转换为 Task 草稿优先使用 AI 语义拆分；笔记改写按钮可用": "When enabled, Task draft conversion uses AI semantic parsing first and AI Rewrite becomes available.",
    "改写前原文": "Original Before Rewrite",
    "关闭原文预览": "Close original preview",
    "恢复原文": "Restore Original",
    "已恢复为改写前原文。": "Restored to the original note.",
    "当前没有可恢复的原文。": "There is no original content to restore.",
    "转换为 Task 草稿": "Convert to Task Drafts",
    "保存笔记": "Save Note",
    "当前笔记尚未保存，切换语言会丢失这些修改。仍要继续吗？": "This note has unsaved changes. Switch language and discard them?",
    "选择服务商并填入 API Key，连接一次后会自动记住；手动清除后才会移除。": "Choose a provider and enter your API Key. The connection is remembered until you clear it manually.",
    "Task 草稿转换尚未完成，切换语言会退出当前转换。仍要继续吗？": "Task draft conversion is not complete. Switch language and exit the conversion?",
    "当前笔记尚未保存，离开后修改会丢失。仍要继续吗？": "This note has unsaved changes. Leave and discard them?",
    "布局": "Layout",
    "列表": "List",
    "资料库布局": "Document Library Layout",
    "资料库布局切换": "Document Library Layout Switch",
    "调整布局": "Arrange Layout",
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
    "查看 Weekflow v2.6 的发布内容": "Review the Weekflow v2.6 release history",
    "查看 Weekflow v3.0 的发布内容": "Review the Weekflow v3.0 release history",
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
    "跳过此项": "Skip This Draft",
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
    "进度记录已保存": "Progress record saved",
    "进度记录已清空": "Progress record cleared",
    "进度记录已删除": "Progress record deleted",
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
    "Weekflow 使用说明": "Weekflow User Guide",
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
    "统一管理说明文档、交付物、控制表和文件夹，并提供 List 与 Group 两种布局。List 保留完整大列表和类型、分组、Flow、Task 筛选；Group 按 Task 分组显示固定高度资料栏，仅保留名称搜索和类型筛选。": "Manage Documentation, Deliverables, Control Sheets, and Folders in List or Group layout. List keeps the full table and Type, Group, Flow, and Task filters; Group shows fixed-height cards by Task Group with name search and Type filtering only.",
    "Group 布局：": "Group Layout:",
    "默认每行显示四个分组，资料按本自然周与上个自然周的打开次数降序排列，同次数按名称排序；点击资料名称编辑，点击“前往”打开链接。可在“调整布局”中选择每行 1–4 个分组并拖动排列顺序。": "Show four Groups per row by default. Documents sort by open count in the current and previous natural week, then by name. Select a document name to edit or Go to to open its link. Arrange Layout supports one to four Groups per row and drag reordering.",
    "最近常用：": "Recently Used:",
    "List 可筛出本自然周或上个自然周至少打开过一次的资料；Group 会自动把近期打开次数更多的资料排在前面。": "List filters documents opened in the current or previous natural week; Group automatically ranks documents with more recent opens first.",
    "资料导入与清理：": "Document Import and Cleanup:",
    "资料 Excel 可选择补充导入或全部覆盖；重复地址可替换或跳过，批量删除需连续确认两次。": "Document Excel import supports supplement import or overwrite all. Duplicate URLs can be replaced or skipped, and bulk deletion requires two confirmations.",
    "数据保存位置": "Data Storage Location",
    "数据保存在当前浏览器、当前页面来源的": "Data is stored in localStorage for the current browser and page origin. The primary data key is:",
    "中，主数据键为：": "",
    "清除浏览器网站数据、使用无痕窗口、更换浏览器或更换启动地址，都会影响可见数据。": "Clearing site data, using a private window, changing browsers, or opening the app from a different origin can change which data is visible.",
    "数据备份与恢复": "Data Backup and Restore",
    "点击顶部数据操作区的": "Select",
    "选择“导出 JSON 备份”，将文件保存到安全位置。": "Choose Export JSON Backup and save the file in a safe location.",
    "需要恢复时选择“从 JSON 恢复”，程序会先校验数据并请求确认。": "To restore, choose Restore from JSON. Weekflow validates the data and asks for confirmation first.",
    "建议在批量修改、迁移浏览器或清理网站数据前先导出 JSON 备份。": "Export a JSON backup before bulk changes, browser migration, or clearing site data.",
    "JSON 备份同时保存资料库的 List / Group 模式、每行分组数和分组排列顺序，恢复后会继续沿用原布局偏好。": "JSON backup also stores the Document Library List / Group mode, Groups per row, and Group order. Restoring the backup restores the same layout preference.",
    "Excel 导出": "Excel Export",
    "开发团队": "Development Team",
    "开发团队：Wesley Yan": "Development team: Wesley Yan",
    "首个正式版本（v1.0）：2026年7月30日": "First release (v1.0): July 30, 2026",
    "最新版本（v2.6）更新时间：2026年8月14日": "Latest v2.6 update: August 14, 2026",
    "最新版本（v3.0）更新时间：2026年8月15日": "Latest v3.0 update: August 15, 2026",
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
    "搜索 Task、Flow、进度、交付物或资料": "Search Tasks, Flows, progress, deliverables, or documents"
  };

  function normalizeLanguage(value) {
    var text = String(value || "").toLowerCase();
    if (text === "en" || text.startsWith("en-")) return "en";
    if (text === "zh" || text.startsWith("zh-")) return "zh-CN";
    return DEFAULT_LANGUAGE;
  }

  function loadLanguage() {
    try {
      language = normalizeLanguage(root.localStorage && root.localStorage.getItem(STORAGE_KEY));
    } catch (_error) {
      language = DEFAULT_LANGUAGE;
    }
    return language;
  }

  function saveLanguage(value) {
    language = normalizeLanguage(value);
    try {
      if (root.localStorage) root.localStorage.setItem(STORAGE_KEY, language);
    } catch (_error) {
      /* Language still applies for the current page when storage is unavailable. */
    }
    return language;
  }

  function register(locale, messages) {
    var normalized = normalizeLanguage(locale);
    translations[normalized] = Object.assign(translations[normalized] || {}, messages || {});
  }

  function t(key, variables, fallback) {
    var table = translations[language] || {};
    var defaultTable = translations[DEFAULT_LANGUAGE] || {};
    var value = table[key];
    if (value === undefined) value = defaultTable[key];
    if (value === undefined) value = fallback === undefined ? key : fallback;
    return String(value).replace(/\{(\w+)\}/g, function (_match, name) {
      return variables && variables[name] !== undefined ? String(variables[name]) : "";
    });
  }

  function locale() {
    return language === "en" ? "en-US" : "zh-CN";
  }

  function setLanguage(value) {
    return saveLanguage(value);
  }

  function getLanguage() {
    return language;
  }

  function materialTypeLabels() {
    return language === "en"
      ? {
          document: "Documentation",
          deliverable: "Deliverable",
          control: "Control Sheet",
          folder: "Folder"
        }
      : {
          document: "说明文档",
          deliverable: "交付物",
          control: "控制表",
          folder: "文件夹"
        };
  }

  function cadenceLabels() {
    return language === "en"
      ? { none: "Does not repeat", weekly: "Weekly", monthly: "Monthly" }
      : { none: "不重复", weekly: "每周", monthly: "每月" };
  }

  function urgencyLabels() {
    return language === "en"
      ? { high: "High", medium: "Medium", low: "Low" }
      : { high: "高", medium: "中", low: "低" };
  }

  function statusLabels() {
    return language === "en"
      ? { pending: "Incomplete", completed: "Completed" }
      : { pending: "未完成", completed: "已完成" };
  }

  function translateText(text) {
    if (language !== "en") return text;
    var raw = String(text || "");
    var leading = (raw.match(/^\s*/) || [""])[0];
    var trailing = (raw.match(/\s*$/) || [""])[0];
    var clean = raw.trim();
    if (!clean) return raw;
    if (EN_TEXT[clean]) return leading + EN_TEXT[clean] + trailing;
    var patterns = [
      [/^确认删除笔记「(.+)」？已转换的 Task 和进度记录不会删除。$/, "Delete note “$1”? Converted Tasks and progress records will remain."],
      [/^请再次确认删除这条笔记。删除后无法恢复。$/, "Confirm again: this note cannot be recovered after deletion."],
      [/^当前笔记尚未保存，继续后修改会丢失。仍要继续吗？$/, "This note has unsaved changes. Continue and discard them?"],
      [/^当前进度记录尚未保存，继续后修改会丢失。仍要继续吗？$/, "This progress record has unsaved changes. Continue and discard them?"],
      [/^确认删除当前这条进度记录？$/, "Delete this progress record?"],
      [/^请再次确认。删除后无法恢复。$/, "Confirm again: deletion cannot be undone."],
      [/^退出后，已保存的 (\d+) 个 Task 会保留，其余草稿不会创建。确认退出？$/, "Exit conversion? The $1 saved Tasks will remain; unresolved drafts will not be created."],
      [/^Task 草稿转换尚未完成，确认退出？$/, "Task draft conversion is not complete. Exit anyway?"],
      [/^(\d+) 条可见 Task$/, "$1 visible Tasks"],
      [/^共 (\d+) 条资料$/, "$1 documents"],
      [/^已选 (\d+) 条$/, "$1 selected"],
      [/^(\d+) 个步骤$/, "$1 steps"],
      [/^(\d+) 项$/, "$1 selected"],
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
    for (var index = 0; index < patterns.length; index += 1) {
      if (patterns[index][0].test(clean)) {
        return leading + clean.replace(patterns[index][0], patterns[index][1]) + trailing;
      }
    }
    return raw;
  }

  function translateMessage(text) {
    if (language !== "en") return String(text || "");
    var clean = String(text || "");
    var exact = translateText(clean);
    if (exact !== clean) return exact;
    var rowMatch = clean.match(/^第 (\d+) 行：(.+)$/);
    if (rowMatch) {
      return "Row " + rowMatch[1] + ": " + translateMessage(rowMatch[2]);
    }
    var patterns = [
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
      [/^Task 状态已导出：(.+)$/, "Task status exported: $1"],
      [/^Task 状态导出失败：(.+)$/, "Task status export failed: $1"],
      [/^备份导出失败：(.+)$/, "Backup export failed: $1"],
      [/^导入失败：(.+)$/, "Import failed: $1"],
      [/^周期状态刷新失败：(.+)$/, "Recurrence status refresh failed: $1"],
      [/^保存失败：(.+)$/, "Save failed: $1"]
    ];
    for (var patternIndex = 0; patternIndex < patterns.length; patternIndex += 1) {
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
    var replacements = [
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
    replacements.forEach(function (pair) {
      clean = clean.replace(pair[0], pair[1]);
    });
    return clean;
  }

  function translateCompositeText(value) {
    if (language !== "en") return String(value || "");
    var text = String(value || "");
    var exact = translateText(text);
    if (exact !== text) return exact;
    var replacements = [
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
      [/Flow (\d+) · (\d+) 个步骤/g, "Flow $1 · $2 steps"],
      [/(\d{4}) · 周五/g, "$1 · Friday"],
      [/([\d-]+ — [\d-]+) · (\d+) 周/g, "$1 · $2 weeks"],
      [/(\d{4}-\d{2}-\d{2} — \d{4}-\d{2}-\d{2}) · (\d+) 周/g, "$1 · $2 weeks"],
      [/([\d-]+) · (\d+) 天后/g, "$1 · in $2 days"],
      [/([\d-]+) · 明天/g, "$1 · Tomorrow"],
      [/([\d-]+) · 今天/g, "$1 · Today"],
      [/统计全部 (\d+) 条 Task（不受时间轴筛选影响）/g, "All $1 Tasks included (timeline filters do not apply)"],
      [/(\d+) 条笔记/g, "$1 notes"],
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
    replacements.forEach(function (pair) {
      text = text.replace(pair[0], pair[1]);
    });
    return text;
  }

  function translateAttribute(name, value) {
    if (language !== "en") return value;
    var clean = String(value || "").trim();
    if (EN_TEXT[clean]) return EN_TEXT[clean];
    var attributes = {
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
      "Weekflow 首页": "Weekflow Home"
      ,"Weekflow v2.6 中英双语本地 Task 管理工具，支持周/日双时间轴、分组、Flow、资料库双布局、双向联动、看板、备份和 Excel 批量导入导出。": "Weekflow v2.6 bilingual local Task manager with weekly/daily timelines, Groups, Flows, a dual-layout Document Library, dashboards, backup, and Excel import/export."
      ,"Weekflow v3.0 中英双语本地 Task 管理工具，支持周/日双时间轴、随手记、多条进度历史、Task 草稿转换、资料库、看板、备份和 Excel 批量导入导出。": "Weekflow v3.0 bilingual local Task manager with weekly/daily timelines, Quick Notes, multi-entry progress history, Task draft conversion, a Document Library, dashboards, backup, and Excel import/export."
      ,"例如：已完成需求确认和接口联调，当前等待业务方验收。\n\n可按日期分段记录，也可以作为持续更新的项目备注。": "Example: Requirements and integration are complete; business acceptance is pending.\n\nUse dated entries or maintain this as a continuously updated project note."
      ,"例如：已完成需求确认和接口联调，当前等待业务方验收。": "Example: Requirements and integration are complete; business acceptance is pending."
    };
    return attributes[clean] || translateCompositeText(value);
  }

  function translateNode(node) {
    if (!node || node.nodeType !== 3 || !node.parentElement) return;
    if (["SCRIPT", "STYLE", "TEXTAREA"].includes(node.parentElement.tagName)) return;
    if (
      node.parentElement.closest(
        ".task-title, .task-node-label, .group-name, .flow-name, .material-name-button, " +
          ".material-url-button, .material-note-cell, .person-table-name, " +
          ".group-card-copy strong, .task-dialog-user-value, .note-list-item, " +
          ".progress-entry-item, .rich-text-editor, [data-user-content]"
      )
    ) {
      return;
    }
    var translated = translateCompositeText(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
  }

  function translateElement(element) {
    if (!element || element.nodeType !== 1) return;
    ["aria-label", "title", "placeholder", "content", "data-placeholder"].forEach(function (name) {
      if (!element.hasAttribute(name)) return;
      var value = element.getAttribute(name);
      var translated = translateAttribute(name, value);
      if (translated === value) translated = translateCompositeText(value);
      if (translated !== value) element.setAttribute(name, translated);
    });
    if (language === "en" && element.matches('input[type="date"]')) {
      element.lang = "en-US";
    }
  }

  function refreshDateInput(input) {
    if (!input) return;
    var shell = input.closest(".localized-date-shell");
    if (!shell) return;
    shell.classList.toggle("is-empty", !input.value);
  }

  function setupEnglishDateInputs() {
    if (!root.document || language !== "en") return;
    root.document.querySelectorAll('input[type="date"]').forEach(function (input) {
      input.lang = "en-US";
      var shell = input.closest(".localized-date-shell");
      if (!shell) {
        shell = root.document.createElement("span");
        shell.className = "localized-date-shell";
        input.parentNode.insertBefore(shell, input);
        shell.appendChild(input);
        var placeholder = root.document.createElement("span");
        placeholder.className = "localized-date-placeholder";
        placeholder.textContent = ENGLISH_DATE_PLACEHOLDER;
        placeholder.setAttribute("aria-hidden", "true");
        shell.appendChild(placeholder);
        var icon = root.document.createElement("span");
        icon.className = "localized-date-icon";
        icon.setAttribute("aria-hidden", "true");
        shell.appendChild(icon);
        ["input", "change", "blur"].forEach(function (eventName) {
          input.addEventListener(eventName, function () {
            refreshDateInput(input);
          });
        });
      }
      refreshDateInput(input);
    });
  }

  function refreshDateInputs() {
    if (!root.document || language !== "en") return;
    setupEnglishDateInputs();
    root.document.querySelectorAll('.localized-date-shell input[type="date"]').forEach(
      refreshDateInput
    );
  }

  function translateAllAttributes(rootNode) {
    if (language !== "en" || !rootNode) return;
    if (rootNode.nodeType === 1) translateElement(rootNode);
    if (!rootNode.querySelectorAll) return;
    rootNode.querySelectorAll("[aria-label], [title], [placeholder], [data-placeholder], meta[content]").forEach(
      translateElement
    );
  }

  function translateSubtree(rootNode) {
    if (language !== "en" || !rootNode) return;
    if (rootNode.nodeType === 3) translateNode(rootNode);
    if (rootNode.nodeType === 1) translateElement(rootNode);
    var doc = rootNode.ownerDocument || root.document;
    if (!doc || !doc.createTreeWalker) return;
    var walker = doc.createTreeWalker(rootNode, 5);
    var node = walker.currentNode;
    while (node) {
      if (node.nodeType === 3) translateNode(node);
      else translateElement(node);
      node = walker.nextNode();
    }
  }

  function captureDocumentFragments() {
    if (englishDocumentFragments || !root.document) return;
    var guide = root.document.querySelector("#user-guide-dialog .document-content");
    var changelog = root.document.querySelector("#changelog-dialog .changelog-content");
    englishDocumentFragments = {
      guide: guide ? guide.innerHTML : "",
      changelog: changelog ? changelog.innerHTML : ""
    };
  }

  function englishGuideHtml() {
    return [
      '<p class="guide-intro">Weekflow is a Multi-task management cockpit for tracking multiple workstreams and organizing all related documents in one place.</p>',
      '<section><h3>Key Features</h3><ul>',
      '<li><b>Timeline:</b> Task by Week shows deadlines by natural week. Double-click a week header to open Task by Day for Monday through Sunday.</li>',
      '<li><b>Task Management:</b> Create and edit Tasks with multi-entry progress history, completion status, people fields, Deliverables, related documents, and optional weekly or monthly recurrence. Every progress entry keeps its own created and last-edited time and supports links, five preset font sizes, and Excel-like 20-color text and highlight palettes.</li>',
      '<li><b>Quick Notes:</b> Capture titled rich-text-only Notes with bold, italic, five preset font sizes (12/14/16/18/22), SharePoint/HTTP/HTTPS links, Excel-like 20-color text and highlight palettes, search, updated-time sorting, unsaved-change protection, and double-confirm deletion.</li>',
      '<li><b>Note Conversion:</b> Append a Note as a new Task progress entry or convert it into one or more Task drafts. Deterministic bilingual local rules are the default; configured AI semantic parsing runs first when enabled, with automatic local fallback after failures or timeouts. The source Note remains and every candidate can be reviewed, skipped, or manually added.</li>',
      '<li><b>AI Assistance:</b> Choose a provider and model in AI Settings and enter an API Key to enable Note rewriting and AI Task-draft parsing. Rewriting uses the editor\'s current content, and late results never overwrite a Note changed or selected while waiting. The API Key is excluded from business-data JSON backups; clear it after use on a shared device.</li>',
      '<li><b>Draft Recognition Rules:</b> Common labels include Task / Todo / Action Item, Group, Flow / Workflow, DDL / Deadline / Due Date, Urgency / Priority, Report To, Managed Person, and Deliverable; corresponding Chinese aliases are recognized as well. Numbered 1/2/3 lines and ordinary non-empty unlabeled lines become separate candidates, while labeled detail lines remain attached to the preceding Task. Leading Chinese current/next/two-weeks-ahead weekdays, bare current-week weekdays, month-day forms, and year variants prefill DDL and are removed from Task names. Every Wednesday prefills Weekly recurrence and next Wednesday; Monthly on the 5th prefills Monthly recurrence and the 5th of next month. Equivalent Chinese recurring phrases are also recognized. Recurrence End still requires user confirmation; other fuzzy relative dates and names remain suggestions.</li>',
      '<li><b>Recurring Deadlines:</b> One recurring Task remains one stored Task while rendering every deadline. Completing the current period also completes all earlier periods.</li>',
      '<li><b>Flow Workflow:</b> Use the optional ordered Flow layer between a Group and its Tasks; new Flows inherit their Group color by default.</li>',
      '<li><b>Reminder:</b> A non-blocking bottom-right reminder lists incomplete Tasks due within seven days and closes after ten seconds.</li>',
      '<li><b>Filters and Dashboard:</b> Combine Group, Flow, status, urgency, overdue, and keyword filters. View summaries by Group, Flow, Managed Person, or Report To.</li>',
      '<li><b>Excel:</b> Download a blank 20-column Task main sheet or current re-importable data with a one-row-per-entry Progress History worksheet, validate uploads, and choose supplement import or complete replacement.</li>',
      '<li><b>Document Library:</b> Manage Documentation, Deliverables, Control Sheets, and Folders in List or Group layout. List keeps the full table and filters; Group shows fixed-height cards by Task Group with name search and Type filtering.</li>',
      '<li><b>Group Layout:</b> Show four Groups per row by default. Documents sort by open count in the current and previous natural week, then by name. Select a document name to edit or <b>Go to</b> to open its link. <b>Arrange Layout</b> supports one to four Groups per row and drag reordering.</li>',
      '<li><b>Recently Used:</b> List filters documents opened in the current or previous natural week; Group automatically ranks documents with more recent opens first.</li>',
      '</ul></section>',
      '<section><h3>Data Storage Location</h3><p>Business data is stored in <code>localStorage</code> for the current browser and page origin under:</p><pre>weekflow-v2.4:data:v4</pre><p>v3.0 keeps the v2.4-compatible namespace and upgrades the internal structure to v4. Existing single progress notes migrate into one history entry. Clearing site data, using a private window, changing browsers, or changing the launch origin affects which data is visible.</p></section>',
      '<section><h3>Data Backup and Restore</h3><ol><li>Open the <b>•••</b> data menu.</li><li>Select <b>Export JSON Backup</b> and save the file securely.</li><li>To restore, select <b>Restore from JSON</b>; Weekflow validates the data and asks for confirmation.</li></ol><p>Export a JSON backup before bulk changes, browser migration, or clearing site data.</p><p>JSON backup stores Groups, Flows, Tasks, complete progress history, all Documents including unlinked items, Quick Notes, conversion records, and Document Library layout preferences.</p></section>',
      '<section><h3>Excel Bulk Import</h3><ol><li>Open <b>•••</b> and download a blank Task template or current data in import format.</li><li>Edit <b>Task Import</b>; each row represents one Task. Edit <b>Progress History</b> for one progress entry per row.</li><li>Upload the workbook and review errors and preview data.</li><li>Choose <b>Supplement Import</b> or <b>Complete Replacement</b>.</li></ol><p>Group, Task Name, Deadline, Urgency, Report To, and Deliverable are required. Missing Groups and Flows are created; matching names are reused. Recurring Tasks require start and end dates. Legacy one-cell Progress Notes remain importable.</p></section>',
      '<section><h3>Excel Export</h3><p><b>Export Dashboard Report</b> creates Overall Dashboard, Timeline Dashboard, and Progress History worksheets containing every Task, hierarchy summary, recurrence fields, all progress entries, deadlines, and related links. It is a presentation report, not an import workbook.</p><p>For re-import, select <b>Download Current Data in Import Format</b>. The Overall Dashboard also exports three-sheet one-person Task status reports. All report sheets are unfrozen and use Windows-safe OOXML. The Document Library Download menu provides its blank template and complete library.</p></section>',
      '<section><h3>Development Team</h3><p>Developer: Wesley Yan</p><p>First release (v1.0): July 30, 2026</p><p>Latest release (v3.0): August 15, 2026</p></section>'
    ].join("");
  }

  function englishChangelogHtml() {
    var entries = [
      ["v3.0 Quick Notes and Progress History", "2026-08-15", "Added Quick Notes, deterministic local Task-draft conversion, and reusable multi-entry Task progress history.", ["Added titled rich-text-only Notes with links, search, latest-updated sorting, unsaved-change protection, and double-confirm deletion.", "Replaced arbitrary text/highlight color controls in Notes and progress history with two Excel-like 20-color preset palettes.", "Added one-time Note-to-progress conversion and sequential multi-candidate Task-draft review with source split view, skip, save-and-continue, and manual Add Task Draft.", "Used bilingual deterministic rules without AI/network access: numbered and ordinary non-empty lines split into candidates while labeled detail lines stay attached; precise Chinese weekday/month-day/year prefixes prefill DDL and are removed from Task names; explicit recurring phrases prefill recurrence plus next-period DDL/start.", "Upgraded JSON to v4 with Notes and progressEntries while migrating legacy progressNote content into one history entry.", "Added one-row-per-entry Progress History to re-importable data, dashboard reports, and person reports; kept main-cell newline aggregation and Excel's 32,767-character limit.", "Stabilized all five English navigation tabs across page switches and retained unfrozen Windows-safe three-sheet OOXML plus all timeline/document scroll-position safeguards.", "Fixed right-to-left whole-line and multi-line selections in Quick Notes and Task progress history so Bold, Italic, text color, highlight, and other formatting commands retain the intended selection."]],
      ["v2.6 Document Library Dual Layout", "2026-08-14", "Added a Group layout for browsing documents by Task Group while preserving the existing List layout and data workflows.", ["Added List / Group switching and fixed-height Group cards in a four-column default grid with independent scrolling.", "Sorted documents by current/previous natural-week open count and then by name; document names edit and Go to opens links.", "Added Arrange Layout to the left of the layout switch, with one-to-four columns and drag or button reordering.", "Stored layout mode, column count, and Group order in JSON preferences, retained the unified language-switch position, stable checkbox scrolling, unchanged Excel schemas, and Windows-safe OOXML packaging."]],
      ["v2.5 Bilingual Release", "2026-08-12", "Complete bilingual language layer and language-matched repository documentation.", ["Added the Chinese / English switch beside Document Library and made English the branch default.", "UI, dialogs, guides, reminders, templates, re-importable data, reports, workbook metadata, and filenames follow the selected language.", "Added separate Chinese and English README pages with matching screenshots and mutual language links.", "Kept the v2.4 data model and storage namespace unchanged, retained Windows-safe XLSX packaging, and preserved timeline and Document Library scroll-position protections."]],
      ["v2.4 Week / Day Timeline", "2026-08-10", "Added a daily drill-down while preserving the weekly timeline and data model.", ["Renamed the main timeline Task by Week and added Task by Day by double-clicking a week header.", "Task by Day shows only deadline occurrences in the selected week, from Monday through Sunday.", "Both views preserve the operated Task row after completion and preserve Group/Flow rows after collapse or expand.", "Migrated earlier browser data into the isolated v2.4 storage namespace without changing Excel formats."]],
      ["v2.3 Recurring Tasks and Deadline Reminder", "2026-08-08", "Added weekly/monthly recurrence, continuous completion history, and a ten-second deadline reminder.", ["A recurring Task is stored once but renders every deadline between its start and end dates.", "Completing the current period also completes all earlier periods; the next period starts incomplete.", "Expanded the Task import format to 20 columns while retaining legacy 16-column compatibility.", "Prevented Task completion from jumping to the top and hardened Windows Excel workbook security metadata."]],
      ["v2.2 People Progress and Report Compatibility", "2026-08-08", "Added Managed Person and Report To summaries and person-specific Task reports.", ["The Overall Dashboard keeps five overview metrics visible and opens one detail dimension at a time.", "Person reports are sorted by Group and include deadlines, progress, Deliverables, and related documents.", "Dashboard and person workbooks open without frozen panes and retain Windows-safe workbook properties."]],
      ["v2.1 Portable Data and Stable Long Lists", "2026-08-03", "Added re-importable current Task data and strengthened long-list interaction.", ["Added current-data download in the same format as the Task import template.", "Added supplement import and double-confirm complete replacement.", "Fixed Windows Excel workbook.xml repair prompts by adding standard AutoFilter names and metadata.", "Fixed Group/Flow collapse and individual document selection jumping back to the top."]],
      ["v2.0 Document Collaboration", "2026-07-31", "Introduced the unified Document Library and two-way timeline relations.", ["Added Documentation, Deliverable, Control Sheet, and Folder document types.", "Added Group, Flow, and Task relations, filters, recently used scope, Excel import/export, and double-confirm bulk deletion.", "Merged Task documentation and Deliverables into Related Documents and synchronized edits from either page."]],
      ["v1.1 Bulk Entry", "2026-07-30", "Added Task Excel bulk import and required-field validation.", ["Added a blank template, validation preview, automatic Group/Flow reuse or creation, and Flow step order.", "Made Urgency, Report To, and Deliverable required in both the form and Excel import."]],
      ["v1.0 First Release", "2026-07-30", "First complete release of the weekly Task timeline and Workflow organization model.", ["Added Home, Timeline, Overall Dashboard, User Guide, and Changelog views.", "Added Group → optional Flow → ordered Task organization, progress notes, related links, filters, dashboard summaries, JSON backup, and Excel export.", "Released as a clean build without sample data and with isolated browser storage."]]
    ];
    return entries.map(function (entry) {
      return '<div class="release-entry"><div class="release-heading"><span>' + entry[0] + '</span><time>' + entry[1] + '</time></div><p class="release-lead">' + entry[2] + '</p><section><h3>Changes</h3><ul>' + entry[3].map(function (item) { return '<li>' + item + '</li>'; }).join("") + '</ul></section></div>';
    }).join("");
  }

  function applyDocumentFragments() {
    captureDocumentFragments();
    var guide = root.document && root.document.querySelector("#user-guide-dialog .document-content");
    var changelog = root.document && root.document.querySelector("#changelog-dialog .changelog-content");
    if (!guide || !changelog || !englishDocumentFragments) return;
    guide.innerHTML = language === "en" ? englishGuideHtml() : englishDocumentFragments.guide;
    changelog.innerHTML = language === "en" ? englishChangelogHtml() : englishDocumentFragments.changelog;
  }

  function observeDom() {
    if (!root.document || !root.MutationObserver) return;
    if (observer) observer.disconnect();
    observer = new root.MutationObserver(function (mutations) {
      if (language !== "en") return;
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(translateSubtree);
        if (mutation.type === "characterData") translateNode(mutation.target);
        if (mutation.type === "attributes") translateElement(mutation.target);
      });
    });
    observer.observe(root.document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label", "title", "placeholder", "content", "data-placeholder"]
    });
  }

  function applyDocument() {
    if (!root.document) return;
    applyDocumentFragments();
    root.document.documentElement.lang = language === "en" ? "en" : "zh-CN";
    root.document.documentElement.dataset.language = language;
    root.document.body.dataset.language = language;
    if (language === "en") {
      translateSubtree(root.document.documentElement);
      translateAllAttributes(root.document.documentElement);
      setupEnglishDateInputs();
    }
    root.document.querySelectorAll(".language-switch button[data-language]").forEach(function (button) {
      var active = normalizeLanguage(button.dataset.language) === language;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    observeDom();
  }

  loadLanguage();

  return {
    STORAGE_KEY: STORAGE_KEY,
    SUPPORTED: SUPPORTED.slice(),
    normalizeLanguage: normalizeLanguage,
    register: register,
    t: t,
    locale: locale,
    setLanguage: setLanguage,
    getLanguage: getLanguage,
    materialTypeLabels: materialTypeLabels,
    cadenceLabels: cadenceLabels,
    urgencyLabels: urgencyLabels,
    statusLabels: statusLabels,
    translateText: translateText,
    translateCompositeText: translateCompositeText,
    translateMessage: translateMessage,
    translateSubtree: translateSubtree,
    refreshDateInputs: refreshDateInputs,
    applyDocument: applyDocument,
    isEnglish: function () {
      return language === "en";
    }
  };
});
