# Weekflow 状态层契约（给 UI 代理的唯一事实来源）

本文档与 `dataStore.ts` / `uiStore.ts` / `lib/*.ts` 的实现**逐一对应**；签名以本文档为准核对使用。

- 两个 store 都是 Zustand：`import { useDataStore } from "./store/dataStore"` / `import { useUiStore } from "./store/uiStore"`。
- 组件内读取：`const data = useDataStore((s) => s.data);`；组件外（事件、定时器）：`useDataStore.getState()` / `useUiStore.getState()`。
- 选择器返回数组/对象字面量时注意引用稳定性，必要时用 `zustand/react/shallow` 的 `useShallow`。
- **所有 action 内部已完成 toast**（文案与原版一致）。返回 `false` / `null` / `{ok:false}` 即失败，组件只需据此决定是否关闭弹窗，**不要再重复 toast**。
- 所有 `window.confirm` 二次确认都在**组件层**做（原版四处两次 confirm：批量删资料、资料全部覆盖、Excel 完整覆盖、删组连带删 Task），store 不弹确认。
- 表单字段级校验（必填、日期合法等）在弹窗组件做；store 接收合法 payload。但 `saveGroup` / `saveFlow` 的**重名拦截在 store 层**，返回 `{ ok: false, error }` 且**不 toast**，组件把 error 显示为字段错误。
- 每次成功变更后 `data` 会被替换为校验归一化后的新副本，组件按新引用重新派生即可。
- 打开资料链接：`await useDataStore.getState().recordMaterialOpen(id)`（记录打开次数并静默保存），然后 `window.weekflow.openExternal(url)`。

---

## 1. dataStore（`src/renderer/store/dataStore.ts`）

### State

```ts
data: WeekflowData | null;        // 业务数据，load() 成功前为 null
loading: boolean;
// 防重入锁（用于禁用按钮；isExporting* 由 lib/exporters.ts 维护）
isSavingTask: boolean;
isExporting: boolean;
isExportingPersonStatus: boolean;
isImportingExcel: boolean;
isImportingMaterials: boolean;
```

### 加载与统一管线

```ts
load(): Promise<void>;
```
启动时调用一次：`loadData()` → `syncRecurringTaskStates`（有变化则再次保存）→ warning toast。失败 toast `"加载失败：…"`。

所有变更 action 内部走统一管线 `persist(message?)`（不对外暴露）：同步周期状态 → `schema.validateData` → set 归一化副本 → IPC 保存 → `uiStore.sanitize()` → toast(message)。校验/保存失败 toast `"保存失败：…"` 并返回 false（内存数据保持已变更状态，与原版一致）。

### Task

```ts
saveTask(input: SaveTaskInput): Promise<boolean>;
deleteTask(id: string): Promise<boolean>;              // toast "Task 已删除"
toggleTaskCompleted(id: string, now?: Date): Promise<boolean>;
```

- `saveTask` 新建/编辑一体（有 `id` 即编辑）。toast `"Task 已更新" / "Task 已创建"`。带 `isSavingTask` 锁。
- `toggleTaskCompleted`：翻转语义。周期 Task 不可确认时 toast（warning）`"当前不在该周期 Task 的可确认范围内"` 并返回 false；成功 toast 四种之一（`"本期 DDL 已确认完成"` 等）。

```ts
interface SaveTaskInput {
  id?: string;
  groupId: string;
  flowId: string | null;
  name: string;
  reportTo: string;
  managedObject: string;
  deliverable: string;
  ddl: string;                       // YYYY-MM-DD
  urgency: Urgency;                  // "high" | "medium" | "low"
  status: TaskStatus;                // 仅非周期生效；周期强制 pending
  completedAt: string | null;        // status==="completed" 时用，空串回退今天
  recurrenceCadence: RecurrenceCadence;
  recurrenceStart: string | null;
  recurrenceEnd: string | null;
  materials?: MaterialDraft[];       // Task 弹窗的资料草稿；不传则不动资料关联
}

interface MaterialDraft { id: string; title: string; url: string; type: MaterialType; createdAt?: string; }
```

### 分组

```ts
saveGroup(input: SaveGroupInput): Promise<ActionResult>;   // { ok, error? }
deleteGroup(id: string): Promise<boolean>;                 // 仅空分组（含空 Flow）；有 Task 返回 false → 组件应打开 deleteGroup 弹窗
moveTasksAndDeleteGroup(id: string, targetId: string): Promise<boolean>;
deleteGroupWithTasks(id: string): Promise<boolean>;        // 级联删除（组件需两次 confirm）
```

- `SaveGroupInput = { id?: string; name: string; color?: string }`。重名 → `{ ok:false, error:"已有同名分组，请使用其他名称。" }`（不 toast）。成功 toast `"分组已更新" / "分组已创建"`。
- `moveTasksAndDeleteGroup` 失败（目标不存在）toast error `"无法移动 Task 与 Flow：目标分组不存在。"`；成功 toast `"Task 与 Flow 已移动，原分组已删除"`。
- `deleteGroupWithTasks` 成功 toast `"分组及其中 Flow、Task 已删除"`。

### Flow

```ts
saveFlow(input: SaveFlowInput): Promise<ActionResult>;
deleteFlow(id: string): Promise<boolean>;   // toast "Flow 已删除，原步骤已保留为普通 Task"
```

```ts
interface SaveFlowInput {
  id?: string;
  name: string;
  groupId: string;
  color?: string;             // 新建缺省继承分组色
  orderedTaskIds?: string[];  // Flow 弹窗排序列表的 taskId 顺序，回写 flowOrder 1 起
}
```

重名（同分组内）→ `{ ok:false, error:"该分组中已有同名 Flow。" }`（不 toast）。成功 toast `"Flow 已更新" / "Flow 已创建"`。

### 折叠

```ts
toggleGroupCollapsed(id: string): Promise<boolean>;   // 静默（无 toast）
toggleFlowCollapsed(id: string): Promise<boolean>;    // 静默
setAllCollapsed(collapsed: boolean): Promise<boolean>;
```

`setAllCollapsed` 无分组时 toast（warning）`"当前没有可折叠/展开的分组"`；无变化 toast `"所有分组与 Flow 已是折叠/展开状态"`；成功 toast `"已折叠/展开全部分组与 Flow"`。时间轴滚动位置保持由 TimelineView 自己处理。

### 进度记录

```ts
saveProgressNote(taskId: string, note: string): Promise<boolean>;
```
trim + 截 4000；有内容 toast `"进度记录已保存"`，清空 toast `"进度记录已清空"`；Task 不存在 toast error `"Task 不存在，无法保存进度记录。"`。

### 资料

```ts
saveMaterial(input: SaveMaterialInput): Promise<boolean>;   // toast "资料已更新并同步到时间轴" / "资料已添加"
deleteMaterial(id: string): Promise<boolean>;               // toast "资料已删除"
deleteMaterials(ids: string[]): Promise<boolean>;           // toast "已删除 N 条资料"；组件需两次 confirm
recordMaterialOpen(id: string): Promise<boolean>;           // 静默保存（无成功 toast）
saveTaskMaterials(taskId: string, drafts: MaterialDraft[]): Promise<boolean>;  // toast "相关资料已保存并同步到资料库"
```

```ts
interface SaveMaterialInput {
  id?: string;
  title: string; url: string; type: MaterialType;
  taskIds: string[]; flowIds: string[]; groupIds: string[];
  note: string;
}
```

关联会先经 `compactMaterialRelations` 压缩（Task 已隐含的 Flow/分组关联会被剔除）。

### Excel 导入

```ts
applyTaskExcelImport(rows: ParsedTaskRow[], mode: "append" | "replace"): Promise<boolean>;
applyMaterialExcelImport(
  rows: ResolvedMaterialImportRow[],
  mode: "append" | "replace",
  duplicateMode: "replace" | "skip"
): Promise<MaterialImportCounts | null>;   // { added, replaced, skipped }
```

- rows 来自 `excel-import.ts` / `material-excel.ts` 的 `parseWorkbook`；资料库导入的行需先经 `prepareMaterialImport` 解析（见下）。
- 成功：toast 原版文案（`"已补充导入 N 条 Task"` / `"已完整覆盖时间轴，共导入 N 条 Task"` / `"资料导入完成：新增 X 条，替换 Y 条，跳过 Z 条"` / `"已全部覆盖资料库，共导入 N 条资料"`）。Task 导入成功后自动静默清筛选 + `timelineMode="all"` + 切到 timeline；资料导入成功后切到 materials。
- 失败：数据回滚，toast 已展示，返回 false / null。

同文件导出的两个辅助纯函数：

```ts
// Task 导入预览统计（等价原版 analyzeExcelRows）
analyzeTaskExcelImport(data: WeekflowData, rows: ParsedTaskRow[]): TaskImportSummary;
// → { taskCount, groupCount, flowCount, newGroupCount, newFlowCount }

// 资料库导入预览：名称→id 解析 + 错误收集 + 重复地址检测（等价原版 renderMaterialImportDialog 数据部分）
prepareMaterialImport(data: WeekflowData, rows: ParsedMaterialRow[]): MaterialImportPreview;
// → { rows: ResolvedMaterialImportRow[], errors: string[], duplicateCount }
// errors 非空时禁止确认导入（与原版的禁用逻辑一致）
```

### JSON 备份

```ts
exportJsonBackup(): Promise<boolean>;        // 成功 toast "JSON 备份已导出：<文件名>"；取消静默
importJsonBackup(jsonText: string): Promise<boolean>;
```

`importJsonBackup`：解析/校验失败 toast error `"导入失败：<前 6 条错误，；分隔>"`；成功直接替换数据并 toast `"数据已从 JSON 恢复"`，且 `timelineMode` 置 `"all"`。**确认框在组件层**（原版文案：`"确认用该备份替换当前数据？将导入 X 个分组和 Y 条 Task、Z 条资料。"`）。

### 人员建议

```ts
getPersonSuggestions(field: "reportTo" | "managedObject"): string[];  // 历史值去重，zh-CN 排序
canonicalTaskSuggestionValue(field: "reportTo" | "managedObject", value: string): string;  // 大小写不敏感归一到历史值
```

---

## 2. uiStore（`src/renderer/store/uiStore.ts`）

### State

```ts
view: ViewName;                       // "home" | "timeline" | "dashboard" | "materials"，默认 "home"
scrollToCurrentWeekToken: number;     // 每次进入 timeline +1；TimelineView 据此滚动到当前周

filters: TaskFilters;                 // { search, groupIds, flowId, status, urgency, overdueOnly }
materialFilters: MaterialFilters;     // { name, types, taskIds, flowIds, groupIds, recentOnly }

timelineGranularity: "week" | "day";  // 默认 "week"
timelineMode: "window" | "all";       // 默认 "window"
timelineAnchor: string;               // 周列锚点（本周周五），默认本周周五
timelineDayAnchor: string;            // 日视图锚点，默认本周周五
weekTimelineViewport: WeekTimelineViewport | null;
windowPastWeeks: number;              // 4
windowFutureWeeks: number;            // 11

dashboardModule: DashboardModule | null;   // "group" | "flow" | "managedObject" | "reportTo"
dialog: DialogState | null;
toasts: ToastItem[];                  // { id, message, type?, duration }
ddlReminder: { visible: boolean; items: { task: Task; ddl: string }[] };
selectedMaterialIds: string[];

interface WeekTimelineViewport { scrollLeft: number; anchorRowKey?: string; anchorOffset?: number; }
```

### 视图

```ts
switchView(view: ViewName): void;
requestScrollToCurrentWeek(): void;   // token +1（“回到本周”按钮等场景）
```

`switchView` 复刻原版：切回 timeline 时若 day 模式则重置为 week（dayAnchor ← anchor，清 viewport）；切入 dashboard 时 `dashboardModule` 置 null；每次落到 timeline `scrollToCurrentWeekToken +1`。

### Task 筛选

```ts
setFilters(patch: Partial<TaskFilters>): void;
resetFilters(): void;        // 静默（Excel 导入成功流程用）
clearFilters(): void;        // 重置 + toast "筛选已清空"
hasActiveFilters(): boolean;
```

### 资料库筛选

```ts
setMaterialFilters(patch: Partial<MaterialFilters>): void;
clearMaterialFilters(): void;   // 重置 + toast "资料库筛选已清空"
```

### 时间轴

```ts
setTimelineGranularity(g: "week" | "day"): void;
setTimelineMode(m: "window" | "all"): void;
setTimelineAnchor(friday: string): void;
setTimelineDayAnchor(friday: string): void;
shiftTimeline(weeks: number): void;     // 窗口模式平移 N 周
returnToCurrentWeek(): void;            // 回本周（week/window/anchor=本周五）+ 滚动 token
showAllTaskRange(): void;               // week + "all"
openDayTimeline(friday: string): void;  // 进日视图；先 saveWeekViewport 保留滚动位
returnToWeekTimeline(): void;           // 回周视图；不消费 viewport，由 TimelineView 恢复后调 clearWeekViewport
saveWeekViewport(viewport: WeekTimelineViewport): void;
clearWeekViewport(): void;
```

周↔日切换的滚动恢复约定：进入日视图前 TimelineView 调 `saveWeekViewport({ scrollLeft, anchorRowKey, anchorOffset })`；返回周视图后 TimelineView 读取 `weekTimelineViewport` 恢复滚动，然后 `clearWeekViewport()`。

### 看板

```ts
toggleDashboardModule(m: DashboardModule): void;   // 再点同一个则收起（null）
```

### 弹窗

```ts
openDialog(d: DialogState): void;
closeDialog(): void;
```

```ts
type DialogState =
  | { type: "group"; groupId?: string }                                     // 无 groupId = 新建
  | { type: "flow"; flowId?: string; groupId?: string; returnToTask?: boolean }
  | { type: "task"; taskId?: string }                                       // 无 taskId = 新建
  | { type: "link"; taskId: string }                                        // 资料管理弹窗
  | { type: "material"; materialId?: string }
  | { type: "progress"; taskId: string }
  | { type: "deleteGroup"; groupId: string }
  | { type: "excelImport"; fileName: string; fileSize: number; parsed: TaskImportParseResult }
  | { type: "materialImport"; fileName: string; fileSize: number; parsed: MaterialImportParseResult }
  | { type: "userGuide" }
  | { type: "changelog" };
```

`parsed` 即 `excel-import.ts` / `material-excel.ts` 的 `parseWorkbook` 返回。表单局部状态（Task 弹窗资料草稿、Flow 弹窗 flowColorCustomized/拖拽 id 等）**不进 store**，组件自管。新建 Flow 返回 Task 弹窗的场景用 `returnToTask: true`。

### Toast

```ts
pushToast(message: string, type?: "success" | "error" | "warning", duration?: number): string;  // 返回 id
dismissToast(id: string): void;
```

默认时长：success 4s / error 7s / warning 6s；超时自动移除；最多叠 5 条，超出挤掉最旧。渲染：class `"toast"` +（type 存在时 `" " + type`），右下角容器。

### DDL 临期提醒

```ts
showDdlReminder(): void;   // 取 dataStore 当前数据算未来 7 天临期，visible=true，10 秒自动关闭
closeDdlReminder(): void;
```

启动时序：App `useEffect` 里 `await useDataStore.getState().load(); useUiStore.getState().showDdlReminder();`。跨午夜刷新（次日 00:00:02）由外壳组件定时器负责：再调一次 `load()` + `showDdlReminder()`。

### 资料批量选择

```ts
toggleMaterialSelected(id: string): void;
setSelectedMaterialIds(ids: string[]): void;
clearSelectedMaterials(): void;
```

### sanitize

```ts
sanitize(valid: WeekflowData): void;   // 内部方法，dataStore.persist 成功后自动调用；组件不要直接调
```

---

## 3. `src/renderer/lib/files.ts`

```ts
saveBinaryToDisk(filename: string, data: Uint8Array, filters: FileFilter[]): Promise<boolean>;
// true=已保存；false=用户取消（静默）或失败（已 toast "文件保存失败：…"）

pickFile(filters: FileFilter[]): Promise<{ name: string; data: ArrayBuffer } | null>;
// null=取消或失败（失败已 toast "无法读取所选文件。"）
```

`FileFilter = { name: string; extensions: string[] }`（来自 `src/shared/ipc.ts`）。

## 4. `src/renderer/lib/exporters.ts`

全部 `Promise<boolean>`（true=已保存并 toast 成功文案；取消静默 false；失败 toast 后 false）：

```ts
exportDashboardReport(): Promise<boolean>;        // isExporting 锁；toast "看板报告已导出：<文件名>"
exportPersonTaskStatus(scopeField: "managedObject" | "reportTo", scopeValue: string, scopeLabel: string): Promise<boolean>;
//   isExportingPersonStatus 锁；toast "Task 状态已导出：<文件名>"；失败 toast 其错误文案
exportTaskImportData(): Promise<boolean>;         // toast "已按导入模板下载当前数据：<文件名>"
downloadTaskTemplate(): Promise<boolean>;         // toast "Task 空白模板已下载"
downloadMaterialTemplate(): Promise<boolean>;     // toast "资料库空白模板已下载"
exportMaterialLibrary(): Promise<boolean>;        // toast "资料库已下载：<文件名>"
```

## 5. `src/renderer/lib/useModalDialog.ts`

```ts
useModalDialog<T extends HTMLDialogElement = HTMLDialogElement>(
  open: boolean,
  onClosed?: () => void
): RefObject<T>;
```

- `open` 变 true → `showModal()`（已开防重复调用）；变 false → `close()`。
- 原生 `cancel` / `close` 事件（Esc 关闭）会调 `onClosed` —— 用于同步 `uiStore.closeDialog()`（可能触发两次，closeDialog 幂等，无需处理）。

```tsx
function TaskDialog() {
  const dialog = useUiStore((s) => (s.dialog?.type === "task" ? s.dialog : null));
  const closeDialog = useUiStore((s) => s.closeDialog);
  const ref = useModalDialog(!!dialog, closeDialog);
  if (!dialog) return null;
  return <dialog ref={ref} className="modal">…</dialog>;
}
```

---

## 6. 派生计算速查（直接用 shared 纯函数，不要在组件里重造）

| 需求 | 函数（`src/shared/…`） |
| --- | --- |
| Task 筛选 | `stats.filterTasks(tasks, filters, today?, flows?)` |
| Task 排序 | `stats.sortTasks(tasks, today?)`；Flow 内 `stats.sortFlowTasks(tasks, today?)` |
| 汇总数字 | `stats.summarize(tasks, today?)`、`summarizeByGroup`、`summarizeByFlow`、`summarizeByTaskField(tasks, "managedObject"/"reportTo", today?, emptyLabel?)` |
| 周期状态/勾选可用/逾期 | `date-utils.getTaskPeriodState(task, today?)` → `{ recurring, occurrence, currentOccurrence, checkboxEnabled, completed, overdue, … }` |
| 周期期次 | `date-utils.getRecurringOccurrences(task)`；有效 DDL `date-utils.taskEffectiveDdl(task, today?)`；逾期 `date-utils.isOverdue(task, today?)` |
| 周计算 | `date-utils.getWeekFriday(d)`、`startOfWeek`、`endOfWeek`、`addWeeksFriday(friday, n)`、`buildWeekRange(a, b)`、`friendlyWeekLabel(friday)`、`todayISO()`、`formatDate(d)`、`dateTimeStamp()` |
| 资料 | `materials.forTask(materials, taskId)`、`resolveRelations(material, data)`、`sortByGroup(materials, data)`、`currentAndPreviousWeekOpenCount(m)`、`typeLabel(type)`、`TYPES`、`TYPE_LABELS`、`uniqueIds` |
| 临期 | `automation.getDueSoonTasks(data, now, 7)`；周期文案 `automation.cadenceLabel(cadence)` |
| 校验/杂项 | `schema.validateData(input)`、`schema.COLORS`、`schema.nextGroupColor(groups)`；`utils.uid(prefix)`、`utils.isValidUrl`、`utils.isHexColor`、`utils.truncate`、`utils.materialUrlKey`、`utils.normalizeText` |
| 时间轴搜索反查资料 | 用 `materials.resolveRelations` / `forTask` 把命中资料（标题/URL/类型/备注）关联的 Task 补入结果（易漏行为 1） |

## 7. 典型流程示例

```ts
// Excel 导入：选文件 → 解析 → 打开预览弹窗
import * as excelImport from "../../shared/excel-import";
import { pickFile } from "../lib/files";

const file = await pickFile([{ name: "Excel 工作簿", extensions: ["xlsx"] }]);
if (!file) return;
const parsed = excelImport.parseWorkbook(file.data);
useUiStore.getState().openDialog({
  type: "excelImport",
  fileName: file.name,
  fileSize: file.data.byteLength,
  parsed
});

// 弹窗确认（完整覆盖需组件两次 confirm 后再调）：
const ok = await useDataStore.getState().applyTaskExcelImport(parsed.rows, mode);
if (ok) useUiStore.getState().closeDialog();

// 资料库导入预览：
const preview = prepareMaterialImport(data, parsed.rows);   // dataStore.ts 导出
// preview.errors 非空 → 禁用确认按钮并展示错误
const counts = await useDataStore
  .getState()
  .applyMaterialExcelImport(preview.rows, mode, duplicateMode);
if (counts) useUiStore.getState().closeDialog();
```
