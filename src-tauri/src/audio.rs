use std::fs;
use std::path::PathBuf;

use serde_json::{json, Value};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

const MAX_BYTES: u64 = 10 * 1024 * 1024;
const ALLOWED_EXT: [&str; 5] = [".mp3", ".wav", ".ogg", ".m4a", ".flac"];

pub fn audio_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("audio"))
}

pub fn audio_path(app: &tauri::AppHandle, file_name: &str) -> Option<PathBuf> {
    audio_dir(app).map(|d| d.join(file_name))
}

/// 弹选择框，把选中的音频复制到 userData/audio/（覆盖旧的 custom.*），返回结果（移植自 Electron audio.ts）
pub fn choose_audio(app: &tauri::AppHandle) -> Value {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .set_title("选择提示音")
        .add_filter("音频文件", &["mp3", "wav", "ogg", "m4a", "flac"])
        .pick_file(move |file| {
            let _ = tx.send(file.and_then(|f| f.into_path().ok()));
        });
    let src = match rx.recv_timeout(std::time::Duration::from_secs(60)) {
        Ok(Some(p)) => p,
        _ => return json!({ "canceled": true }),
    };
    let ext = src
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
        .unwrap_or_default();
    if !ALLOWED_EXT.contains(&ext.as_str()) {
        return json!({ "canceled": false, "reason": "ext" });
    }
    if fs::metadata(&src).map(|m| m.len()).unwrap_or(u64::MAX) > MAX_BYTES {
        return json!({ "canceled": false, "reason": "size" });
    }
    let Some(dir) = audio_dir(app) else {
        return json!({ "canceled": true });
    };
    if fs::create_dir_all(&dir).is_err() {
        return json!({ "canceled": true });
    }
    if let Ok(entries) = fs::read_dir(&dir) {
        for e in entries.flatten() {
            if e.file_name().to_string_lossy().starts_with("custom.") {
                let _ = fs::remove_file(e.path());
            }
        }
    }
    let file_name = format!("custom{ext}");
    if fs::copy(&src, dir.join(&file_name)).is_err() {
        return json!({ "canceled": true });
    }
    json!({ "canceled": false, "fileName": file_name })
}
