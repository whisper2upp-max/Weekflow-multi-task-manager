# Weekflow Desktop v1.1.0

Weekflow Desktop is the Tauri v2 desktop edition of Weekflow. It uses React, TypeScript, Rust, and the operating system WebView. Desktop v1.1.0 aligns with Web v2.7 and uses the backward-compatible data v4 contract.

> Branch status: `codex/tauri-v3-windows` now contains a development preview of the Web v3.1/v3.2 feature set. The released desktop version remains v1.1.0 until validation and release approval.

Developer: Wesley Yan

## Highlights

- Native macOS and Windows desktop application
- Chinese and English interface
- Task by Week and Task by Day timelines
- Dashboard and a Document Library with List / Group layouts and persistent arrangement preferences
- Quick Notes with starred Favorites, 12/14/16/18/22 font sizes, preset colors, highlights, and SharePoint links
- Excel-compatible note tables: paste/copy merged ranges, create and edit tables, rectangular/whole-table selection, undo/redo, clear, and delete
- Deterministic bilingual Task draft conversion, plus optional explicitly authorized AI parsing and table-preserving AI note rewriting
- Local AI provider settings for DeepSeek, DashScope, Kimi, GLM, MiniMax, and custom OpenAI-compatible endpoints; API Keys stay outside business JSON and Excel
- Multiple timestamped rich-text progress records per Task
- Local JSON persistence with rotating backups
- Excel/JSON import and export, including a one-row-per-entry Progress History worksheet

## Local development

```bash
npm ci
npm run typecheck
npm run test
npm run dev
```

Build the native bundle for the current operating system:

```bash
npm run build
```

## Windows build on GitHub

The `Build Windows installers` workflow runs on a real `windows-latest` GitHub runner and produces two unsigned x64 installers:

- WiX Microsoft Installer: `.msi`
- NSIS setup executable: `-setup.exe`

It runs automatically when application files are pushed to `codex/tauri-v3-windows`, and it can also be started manually from **Actions → Build Windows installers → Run workflow**. Download the resulting `Weekflow-Desktop-v1.1.0-windows-x64` artifact after the workflow succeeds.

The installer uses Tauri's WebView2 download bootstrapper. Windows 10 and Windows 11 normally already provide WebView2. These builds are unsigned, so Windows SmartScreen may show an unknown-publisher warning.

This branch is maintained independently from the Web edition on `main`.

## Development-preview safety notes

- Opening Task draft conversion never sends note content to AI. Local rules run first; an external request is made only after the user clicks **Parse with AI** and confirms.
- AI requests are sent by the Rust backend over HTTPS (plain HTTP is allowed only for localhost development).
- Quick Note Favorites and table content are included in JSON backup/restore. AI connection settings and API Keys are local application preferences and are intentionally excluded.
- Existing Excel templates and dashboard reports retain the Windows-safe workbook generation path from Desktop v1.1.0.
