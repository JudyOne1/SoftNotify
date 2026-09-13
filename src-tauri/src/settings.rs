use std::sync::mpsc;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

use crate::state::AppState;

fn open_hash_window(app: &AppHandle, label: &str, hash: &str, width: f64, height: f64) {
    if let Some(win) = app.get_webview_window(label) {
        let _ = win.unminimize();
        let _ = win.set_focus();
        return;
    }
    let url = format!("index.html#{hash}");
    if let Ok(win) = WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
        .title("SoftNotify")
        .inner_size(width, height)
        .min_inner_size(580.0, 560.0)
        .build()
    {
        let _ = win.set_focus();
        if label == "settings" {
            remember_settings_size(app, &win);
        }
    }
}

/// 记忆窗口尺寸（防抖 600ms；与 Electron 版一致只记尺寸不记位置，规避多显示器坐标问题）
fn remember_settings_size(app: &AppHandle, win: &tauri::WebviewWindow) {
    let (tx, rx) = mpsc::channel::<()>();
    win.on_window_event(move |ev| {
        if let WindowEvent::Resized(_) = ev {
            let _ = tx.send(());
        }
    });
    let app = app.clone();
    std::thread::spawn(move || {
        while rx.recv().is_ok() {
            std::thread::sleep(Duration::from_millis(600));
            while rx.try_recv().is_ok() {}
            let Some(win) = app.get_webview_window("settings") else {
                break;
            };
            let (Ok(size), Ok(scale)) = (win.inner_size(), win.scale_factor()) else {
                continue;
            };
            let width = (size.width as f64 / scale).round() as u32;
            let height = (size.height as f64 / scale).round() as u32;
            let state = app.state::<AppState>();
            let mut store = state.store.lock().unwrap();
            store.config.settings_window = Some(crate::config::SettingsWindow { width, height });
            store.save();
        }
    });
}

pub fn open_settings(app: &AppHandle) {
    let (w, h) = {
        let state = app.state::<AppState>();
        let store = state.store.lock().unwrap();
        match &store.config.settings_window {
            Some(s) => (s.width as f64, s.height as f64),
            None => (680.0, 700.0),
        }
    };
    open_hash_window(app, "settings", "/settings", w, h);
}

/// 打开主窗口并切到指定分区。首次创建时把目标写进 URL，避免前端监听尚未注册导致事件丢失。
pub fn open_settings_to(app: &AppHandle, section: &str) {
    if app.get_webview_window("settings").is_some() {
        open_settings(app);
        let _ = app.emit("ui:navigate", section);
        return;
    }

    let (w, h) = {
        let state = app.state::<AppState>();
        let store = state.store.lock().unwrap();
        match &store.config.settings_window {
            Some(s) => (s.width as f64, s.height as f64),
            None => (680.0, 700.0),
        }
    };
    open_hash_window(
        app,
        "settings",
        &format!("/settings?section={section}"),
        w,
        h,
    );
}

pub fn open_welcome(app: &AppHandle) {
    open_hash_window(app, "welcome", "/welcome", 560.0, 640.0);
}
