# Weekflow v3.0 · Tauri Desktop

Weekflow v3.0 is the Tauri v2 desktop edition maintained separately from the Web edition on `main`. It uses React, TypeScript, Rust, and the operating system WebView while preserving the Weekflow workflow and data contract.

Developer: Wesley Yan

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

It runs automatically when application files are pushed to `codex/tauri-v3-windows`, and it can also be started manually from **Actions → Build Windows installers → Run workflow**. Download the resulting `Weekflow-v3.0.0-windows-x64` artifact after the workflow succeeds.

The installer uses Tauri's default WebView2 download bootstrapper. Windows 10 and Windows 11 normally already provide WebView2. These first builds are unsigned, so Windows SmartScreen may show an unknown-publisher warning during testing.

This branch is intentionally not merged into the Web edition's `main` branch.
