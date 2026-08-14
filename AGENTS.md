# Weekflow Desktop v1.0（Tauri v2 版）

首个桌面版本（v1.0，2026-08-14）：Weekflow 从 Web 版（v2.5）完整移植为 macOS 桌面应用，**功能与 Web 版 v2.5 完全对齐**。前端最初自 `/Users/cici/Desktop/AI/project/task manager kimi`（Electron 版 Weekflow 3.0）逐字移植；Electron 版仅作只读参考，**不要修改它任何文件**。安装包从 Electron 方案的约 277MB 降到约 3.6MB。

开发团队 / 署名：**Wesley Yan**（Excel 元数据 Author、使用说明、更新日志等处保持此署名）。

## 技术栈

- 桌面壳：**Tauri v2**（Rust 后端 + 系统 WebView，macOS 上为 WKWebView）
- 渲染层：React 18 + TypeScript **strict**（`strict: true`，禁用隐式 any）——与 Electron 版**逐字相同**，零改动
- 构建：Vite；状态：Zustand；数据校验：Zod
- 持久化：Rust 侧 JSON 文件（数据目录 `~/Library/Application Support/weekflow-tauri/weekflow-data.json`，目录名沿用 `weekflow-tauri` 以保持既有用户数据连续）+ **自动轮换备份**（`backups/`，保留最近 30 份）
- Excel：SheetJS（`xlsx`）+ JSZip
- 测试：Vitest（单元）。**e2e 未移植**：Electron 版 e2e 基于 Playwright Electron 驱动，与 Tauri/WKWebView 不兼容；Tauri 生态的 WebDriver 方案（tauri-driver + WebKitWebDriver/wkwebview 驱动）收益低、维护成本高，本版以单元测试 + 手动冒烟（见下）覆盖。
- **中英双语界面**：`src/renderer/lib/i18n.ts`（运行时翻译引擎，移植自原 Web 版 js/i18n.js），顶栏 `.language-switch` 切换后整页 reload。

## 目录结构

```
src/
  shared/        与 Electron 版逐字相同（纯逻辑，勿改字段语义）
    types.ts / ipc.ts / schema.ts / utils.ts / date-utils.ts / stats.ts
    automation.ts / materials.ts / xlsx-safe.ts / excel-import.ts
    excel-export.ts / material-excel.ts
  renderer/      与 Electron 版逐字相同，**差异点**：
    index.tsx        渲染前调用 installTauriBridge()
    index.html       CSP 增加 connect-src（放行 Tauri IPC）
    lib/tauri-bridge.ts  新增：用 @tauri-apps/api invoke 实现 WeekflowApi，
                         挂到 window.weekflow（等价 Electron 版 preload+主进程包装）；
                         语义校验（zod validateData）与首跑空数据落盘在此层做；
                         纯浏览器 dev 预览（无 Tauri IPC）时挂 localStorage 内存 stub
    lib/i18n.ts      新增：中英运行时翻译引擎（EN_TEXT 字典 + 参数化正则 +
                     MutationObserver 整树/增量翻译 + 日期输入壳），移植自原
                     Web 版 js/i18n.js；localStorage key `weekflow-desktop:language`，
                     默认 zh-CN；setLanguage 写偏好 + 整页 reload
    components/DateInput.tsx  新增：英文模式渲染 .localized-date-shell 日期壳
                     （替代原版运行时注入，避免与 React 受控节点冲突）
src-tauri/       Rust 后端
  src/lib.rs     数据读写（轮换备份/损坏恢复）+ 文件保存/打开对话框 commands
  tauri.conf.json  productName Weekflow Desktop、version 1.0.0、窗口标题 Weekflow Desktop、
                   identifier com.weekflow.app（保持不变以延续数据目录与钥匙串等系统归属）、
                   窗口 1440x900（min 960x640）、CSP；Cargo 包名 weekflow-desktop
                   （二进制同名，lib name weekflow_desktop_lib）
  capabilities/  最小授权（core:default + opener 仅 http/https）
tests/
  unit/          Vitest（共享逻辑 + Excel 解析，与 Electron 版相同）
```

## 命令

- `npm run dev`：开发启动（tauri dev，vite dev server 端口 1420）
- `npm run test`：Vitest
- `npm run typecheck`：tsc --noEmit
- `npm run build`：tauri build（产出 `Weekflow Desktop.app` 与 `.dmg`，在 `src-tauri/target/release/bundle/`）
- 手动冒烟：`WEEKFLOW_USER_DATA_DIR=$(mktemp -d) "src-tauri/target/release/bundle/macos/Weekflow Desktop.app/Contents/MacOS/weekflow-desktop"`，15 秒不退出、数据文件被创建即 OK。

## 数据契约（与 Electron 版 / 原 v3 格式完全等价）

- 顶层：`{version: 3, groups, flows, tasks, materials, updatedAt}`，类型见 `src/shared/types.ts`。
- 校验/归一化规则照搬 `src/shared/schema.ts`：字符串 trim + 最大长度（分组/Flow 名 80、Task 名 160、reportTo 120、managedObject 160、deliverable 500、progressNote 4000、url 3000、note 2000、periodKey 20）；颜色非法回退调色板；flowOrder 按 Flow 内强制重排；周期任务不变量（起≤止、DDL 在范围内、完成记录连续前缀补齐）；`completedAt` 是**日期粒度**，`progressUpdatedAt`/`createdAt`/`updatedAt`/`openEvents` 是**完整时间戳**。
- 每次变更全量校验 + 全量保存：渲染层 validateData → 桥接层 saveData（再次校验）→ Rust `save_data`（旧文件复制进 backups/ → 原子写 tmp+rename → 裁剪到 30 份）。
- 调色板：`["#665CFF","#0AA6B5","#9B5DE5","#FF7A45","#2CA77B","#E94E89","#7BA23F"]`。
- ID：`uid(prefix)` = `prefix_` + crypto.randomUUID()。排序一律 zh-CN locale。
- 周口径三个并存勿混：周列锚点=**周五**；周显示标签=周一—周日；weekly periodKey=**周一**。

## IPC 契约

渲染进程只通过 `window.weekflow` 访问原生能力（接口定义 `src/shared/ipc.ts` 的 `WeekflowApi`，Tauri 版由 `src/renderer/lib/tauri-bridge.ts` 实现）：数据读写、文件保存/打开对话框（导入导出 xlsx/json，二进制跨桥走 base64）、`openExternal`（打开资料链接，桥接层校验仅 http/https，底层用 `@tauri-apps/plugin-opener` 的 `openUrl`）、`revealPath`（在系统文件管理器中显示路径，桥接层限定仅数据文件/备份目录，底层用 opener 插件的 `revealItemInDir`/`openPath`，能力声明在 `src-tauri/capabilities/default.json`）。

Rust commands（`src-tauri/src/lib.rs`）：`load_data` / `save_data` / `get_data_info` / `save_file_with_dialog` / `open_file_with_dialog`。测试钩子：环境变量 `WEEKFLOW_USER_DATA_DIR` 覆盖数据目录。

## UI 约定（复现原版，与 Electron 版相同）

- `styles/weekflow.css` 是原样式逐字拷贝；组件必须使用同一套类名/id 与 DOM 结构语义，动态颜色走 `style={{'--group-color': ...}}` 这类 CSS 变量注入。
- 弹窗用原生 `<dialog>` + `showModal()`（保留 ::backdrop 样式）；toast 右下角；DDL 提醒右下角悬浮卡，10 秒自动关闭。
- 所有用户内容用 React 文本渲染（等价原 textContent 语义），禁止 dangerouslySetInnerHTML。
- 时间轴左栏固定列 5 列：`Task / DDL、紧急、进度记录、相关资料、编辑`。

## 中英切换（i18n）

- 中文是源码内嵌文案；英文模式 = `lib/i18n.ts` 的 EN_TEXT 字典 + 参数化正则 + MutationObserver 运行时翻译（App 首帧后 `applyDocument()` 整树翻译一次，observer 接管增量）。语言偏好 `localStorage["weekflow-desktop:language"]`，默认 zh-CN，`setLanguage` 写后整页 reload。
- 动态消息：toast 入列前过 `translateMessage`（uiStore.pushToast）；确认框用 `tConfirm()`（组件层）；两个导入弹窗的错误列表渲染时过 `translateMessage`。
- 原版带 `isEnglish()` 显式分支的文案（时间轴表头角标、Task 行勾选框/徽标/tooltip、Task 弹窗帮助文案等）在对应组件用 `isEnglish()` 三元保留——observer 字典产出的措辞不同，不要改成依赖 observer。
- 日期输入一律用 `components/DateInput.tsx`（英文模式渲染日期壳）。
- Excel/JSON 导出文件名与内容随语言：shared 的 excel-import/excel-export/material-excel 接收显式 `english?: boolean` 参数（不读全局语言），调用处（lib/exporters.ts、store/dataStore.ts）按 `isEnglish()` 传参；导入解析端始终兼容中英文表头与值。
- 使用说明/更新日志弹窗按 `isEnglish()` 渲染不同 JSX（等价原版整篇 innerHTML 替换）。

## 易漏行为清单（重写必须保留）

1. 时间轴搜索除 Task 字段外，还要**反查资料**（标题/URL/类型/备注）把关联 Task 补入结果。
2. 时间轴内勾选/折叠后**保持滚动位置**（记录锚点行偏移，双帧恢复）。
3. 双击/Enter/空格 周表头进日视图；返回时恢复周视图滚动位。进度、资料按钮也是**双击/Enter** 触发。
4. 周期任务："勾当期完成=此前各期全部完成"（连续前缀补齐）；取消只砍当期及之后；排期外禁止勾选并 toast。
5. 三处**两次 confirm**：批量删资料、资料全部覆盖、Excel 完整覆盖。删除分组连带 Task 为单次「最终确认」confirm。
6. JSON 恢复前先自动备份当前数据（轮换备份已覆盖，无需单独键）。
7. 看板点击分组/Flow/逾期数字 → 跳时间轴并自动套用筛选。
8. Flow 步骤拖拽排序只存在于 Flow 弹窗；时间轴本身不可拖拽。
9. Cmd/Ctrl+K：主页/看板下切到时间轴并聚焦搜索框；资料库下聚焦资料名称框。
10. 跨午夜定时器（次日 00:00:02）刷新周期状态并重播临期提醒。
11. 已用过的汇报对象/管理对象成为 datalist 历史建议，保存时按大小写不敏感归一到历史同名片。
12. 新建 Flow 默认继承分组色，手动改色后不再跟随。
13. 使用说明/更新日志弹窗为桌面版改写内容（保留"开发团队：Wesley Yan"署名）。更新日志维护约定：**后续只有新增功能才追加条目**；v1.0 主条目只写移植定位、桌面架构与数据安全/迁移说明，另附一条 Web 版历史简述（v1.0–v2.5 详细条目见 Web 版更新日志）。

## Excel 要点

- 任务导入 20 列模板（列名/校验/错误文案逐字照搬）；资料库导入 7 列。模板与"当前数据"均由代码生成（不依赖静态文件）。
- 看板报告 = **手写 OOXML XML + JSZip**（excel-export.ts），不用 SheetJS 写；可回导导出与资料库导出用 SheetJS 写 + xlsx-safe 净化。
- 文件名时间戳 `YYYYMMDD_HHMM`；workbook Author 固定 `Wesley Yan`。
- SheetJS 依赖：`xlsx`（SheetJS 官方 CDN tarball 0.20.3）。

## 与 Electron 版的数据互通

两者 JSON 数据格式完全一致。Electron 版数据在 `~/Library/Application Support/weekflow-electron/`（或对应 userData 目录），本版在 `~/Library/Application Support/weekflow-tauri/`；用户可通过"导出 JSON 备份"→"从 JSON 恢复"迁移，也可直接拷贝 `weekflow-data.json`。
