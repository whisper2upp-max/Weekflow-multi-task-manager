//! Weekflow Tauri 后端：数据持久化 + 文件对话框。
//!
//! 语义对应 Electron 版 src/main/storage.ts + ipc.ts：
//! - save_data：旧主文件复制进 backups/ → 原子写（tmp + rename）→ 备份裁剪到 30 份。
//! - load_data：主文件不存在 → json:null 无 warning（首次运行，前端会落盘空数据）；
//!   主文件 JSON 解析失败 → 留存 corrupt-backup-<时间戳>.json，再按新→旧找第一个可解析的
//!   备份返回并带 warning；全失败 → json:null + warning。
//!   语义校验（zod）不在本层做，由前端桥接层 validateData 负责。
//! - 测试钩子：环境变量 WEEKFLOW_USER_DATA_DIR 存在时覆盖数据目录。

use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri_plugin_dialog::DialogExt;

/// 轮换备份保留份数上限
const MAX_BACKUPS: usize = 30;

/* ---------- 路径 ---------- */

fn data_dir() -> Result<PathBuf, String> {
    if let Ok(dir) = std::env::var("WEEKFLOW_USER_DATA_DIR") {
        if !dir.is_empty() {
            return Ok(PathBuf::from(dir));
        }
    }
    directories::BaseDirs::new()
        .map(|b| b.data_dir().join("weekflow-tauri"))
        .ok_or_else(|| "无法确定用户数据目录".to_string())
}

fn data_file() -> Result<PathBuf, String> {
    Ok(data_dir()?.join("weekflow-data.json"))
}

fn backups_dir() -> Result<PathBuf, String> {
    Ok(data_dir()?.join("backups"))
}

/// 本地时间戳 YYYYMMDD_HHmmss
fn local_timestamp() -> String {
    chrono::Local::now().format("%Y%m%d_%H%M%S").to_string()
}

/// 轮换备份文件名：weekflow-data-<YYYYMMDD_HHmmss>.json（字典序即时间序）
fn is_backup_name(name: &str) -> bool {
    let Some(mid) = name
        .strip_prefix("weekflow-data-")
        .and_then(|s| s.strip_suffix(".json"))
    else {
        return false;
    };
    let bytes = mid.as_bytes();
    bytes.len() == 15
        && bytes[..8].iter().all(|b| b.is_ascii_digit())
        && bytes[8] == b'_'
        && bytes[9..].iter().all(|b| b.is_ascii_digit())
}

/// 轮换备份文件名列表（升序 = 旧→新）
fn list_backups() -> Vec<String> {
    let Ok(dir) = backups_dir() else { return Vec::new() };
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut names: Vec<String> = entries
        .filter_map(|e| e.ok()?.file_name().into_string().ok())
        .filter(|n| is_backup_name(n))
        .collect();
    names.sort();
    names
}

/// 裁剪 backups/，只保留最新 MAX_BACKUPS 份轮换备份
fn trim_backups() {
    let names = list_backups();
    if names.len() <= MAX_BACKUPS {
        return;
    }
    let Ok(dir) = backups_dir() else { return };
    for name in &names[..names.len() - MAX_BACKUPS] {
        let _ = fs::remove_file(dir.join(name));
    }
}

fn is_valid_json(raw: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(raw).is_ok()
}

/* ---------- 数据读写 ---------- */

#[derive(Serialize)]
pub struct LoadDataResult {
    json: Option<String>,
    warning: Option<String>,
}

#[tauri::command]
fn load_data() -> LoadDataResult {
    let file = match data_file() {
        Ok(f) => f,
        Err(e) => {
            return LoadDataResult {
                json: None,
                warning: Some(e),
            }
        }
    };

    // 首次运行：由前端桥接层 makeEmptyData 并落盘
    if !file.exists() {
        return LoadDataResult {
            json: None,
            warning: None,
        };
    }

    let raw = match fs::read_to_string(&file) {
        Ok(r) => r,
        Err(e) => {
            return LoadDataResult {
                json: None,
                warning: Some(format!("读取数据文件失败：{e}")),
            }
        }
    };

    if is_valid_json(&raw) {
        return LoadDataResult {
            json: Some(raw),
            warning: None,
        };
    }

    // 主数据损坏：原始内容留存 backups/corrupt-backup-<时间戳>.json（留存失败不阻塞恢复）
    if let Ok(dir) = backups_dir() {
        let _ = fs::create_dir_all(&dir);
        let _ = fs::write(
            dir.join(format!("corrupt-backup-{}.json", local_timestamp())),
            &raw,
        );
    }

    // 依次尝试最新备份（新→旧）
    if let Ok(dir) = backups_dir() {
        for name in list_backups().into_iter().rev() {
            if let Ok(backup_raw) = fs::read_to_string(dir.join(&name)) {
                if is_valid_json(&backup_raw) {
                    return LoadDataResult {
                        json: Some(backup_raw),
                        warning: Some(format!("主数据损坏，已从备份恢复（{name}）")),
                    };
                }
            }
        }
    }

    LoadDataResult {
        json: None,
        warning: Some("主数据损坏且所有备份均不可用，已重置为空数据".to_string()),
    }
}

#[derive(Serialize)]
pub struct SaveDataResult {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn save_data_inner(json: &str) -> Result<(), String> {
    let file = data_file()?;
    let backups = backups_dir()?;
    fs::create_dir_all(&backups).map_err(|e| e.to_string())?;

    // 旧主文件先进入轮换备份
    if file.exists() {
        let backup_name = format!("weekflow-data-{}.json", local_timestamp());
        fs::copy(&file, backups.join(backup_name)).map_err(|e| e.to_string())?;
    }

    // 原子写：tmp + rename
    let tmp = PathBuf::from(format!("{}.tmp", file.display()));
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &file).map_err(|e| e.to_string())?;

    trim_backups();
    Ok(())
}

#[tauri::command]
fn save_data(json: String) -> SaveDataResult {
    match save_data_inner(&json) {
        Ok(()) => SaveDataResult { ok: true, error: None },
        Err(e) => SaveDataResult {
            ok: false,
            error: Some(format!("保存数据失败：{e}")),
        },
    }
}

#[derive(Serialize)]
pub struct DataInfo {
    data_file: String,
    backups_dir: String,
    backup_count: usize,
}

#[tauri::command]
fn get_data_info() -> DataInfo {
    DataInfo {
        data_file: data_file()
            .map(|p| p.display().to_string())
            .unwrap_or_default(),
        backups_dir: backups_dir()
            .map(|p| p.display().to_string())
            .unwrap_or_default(),
        backup_count: list_backups().len(),
    }
}

/* ---------- 文件对话框 ---------- */

#[derive(Deserialize)]
pub struct FileFilter {
    name: String,
    extensions: Vec<String>,
}

#[derive(Serialize)]
pub struct SaveFileResult {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    canceled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[tauri::command]
fn save_file_with_dialog(
    app: tauri::AppHandle,
    default_path: String,
    filters: Vec<FileFilter>,
    data_base64: String,
) -> SaveFileResult {
    let run = || -> Result<SaveFileResult, String> {
        let mut dialog = app.dialog().file().set_file_name(&default_path);
        for f in &filters {
            let exts: Vec<&str> = f.extensions.iter().map(String::as_str).collect();
            dialog = dialog.add_filter(&f.name, &exts);
        }
        let Some(picked) = dialog.blocking_save_file() else {
            return Ok(SaveFileResult {
                ok: true,
                canceled: Some(true),
                file_path: None,
                error: None,
            });
        };
        let path = picked
            .into_path()
            .map_err(|_| "保存对话框返回了不支持的路径".to_string())?;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(&data_base64)
            .map_err(|e| e.to_string())?;
        fs::write(&path, bytes).map_err(|e| e.to_string())?;
        Ok(SaveFileResult {
            ok: true,
            canceled: Some(false),
            file_path: Some(path.display().to_string()),
            error: None,
        })
    };
    match run() {
        Ok(r) => r,
        Err(e) => SaveFileResult {
            ok: false,
            canceled: None,
            file_path: None,
            error: Some(format!("保存文件失败：{e}")),
        },
    }
}

#[derive(Serialize)]
pub struct OpenFileResult {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    canceled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    data_base64: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[tauri::command]
fn open_file_with_dialog(app: tauri::AppHandle, filters: Vec<FileFilter>) -> OpenFileResult {
    let run = || -> Result<OpenFileResult, String> {
        let mut dialog = app.dialog().file();
        for f in &filters {
            let exts: Vec<&str> = f.extensions.iter().map(String::as_str).collect();
            dialog = dialog.add_filter(&f.name, &exts);
        }
        let Some(picked) = dialog.blocking_pick_file() else {
            return Ok(OpenFileResult {
                ok: true,
                canceled: Some(true),
                name: None,
                data_base64: None,
                error: None,
            });
        };
        let path = picked
            .into_path()
            .map_err(|_| "打开对话框返回了不支持的路径".to_string())?;
        let bytes = fs::read(&path).map_err(|e| e.to_string())?;
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        Ok(OpenFileResult {
            ok: true,
            canceled: Some(false),
            name: Some(name),
            data_base64: Some(base64::engine::general_purpose::STANDARD.encode(bytes)),
            error: None,
        })
    };
    match run() {
        Ok(r) => r,
        Err(e) => OpenFileResult {
            ok: false,
            canceled: None,
            name: None,
            data_base64: None,
            error: Some(format!("打开文件失败：{e}")),
        },
    }
}

/* ---------- 入口 ---------- */

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            get_data_info,
            save_file_with_dialog,
            open_file_with_dialog,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Weekflow");
}
