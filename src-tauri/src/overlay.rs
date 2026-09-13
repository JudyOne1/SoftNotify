use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use serde::Deserialize;
use tauri::{AppHandle, Emitter, Listener, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

use crate::config::Config;
use crate::remind::ReminderPayload;

/// 每个显示器一个透明置顶穿透弹幕窗口（移植自 Electron 版 overlay.ts）
pub fn create_overlays(app: &AppHandle) {
    let monitors = app.available_monitors().unwrap_or_default();
    for (i, m) in monitors.iter().enumerate() {
        spawn_overlay(app, i, &m);
    }
}

/**
 * 本机实测：主屏 overlay 可能被外部进程在创建后 ~1s 内销毁（移到原点、尺寸清零后 WM_CLOSE，
 * 与透明/置顶/尺寸/加载方式均无关，副屏不复现）。销毁后延迟重建作为兜底，限次防止死循环。
 */
static RECREATE_COUNT: OnceLock<Mutex<HashMap<usize, u32>>> = OnceLock::new();
static CREATE_PENDING: AtomicBool = AtomicBool::new(false);
const MAX_RECREATE: u32 = 3;

fn spawn_overlay(app: &AppHandle, i: usize, m: &tauri::Monitor) {
    let label = format!("overlay-{i}");
    if app.get_webview_window(&label).is_some() {
        return;
    }
    let scale = m.scale_factor();
    let size = m.size();
    let pos = m.position();
    let win = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html#/overlay".into()))
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .always_on_top(true)
        .focused(false)
        .resizable(false)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .position(pos.x as f64 / scale, pos.y as f64 / scale)
        .inner_size(size.width as f64 / scale, size.height as f64 / scale)
        .build();
    match win {
        Ok(w) => {
            let _ = w.set_ignore_cursor_events(true);
            let app2 = app.clone();
            let label2 = label.clone();
            w.on_window_event(move |ev| {
                if matches!(ev, WindowEvent::Destroyed) {
                    ready().lock().unwrap().remove(&label2);
                    schedule_recreate(app2.clone(), i);
                }
            });
        }
        Err(e) => eprintln!("[overlay] create {label} failed: {e}"),
    }
}

fn schedule_recreate(app: AppHandle, i: usize) {
    let attempt = {
        let mut map = RECREATE_COUNT.get_or_init(Default::default).lock().unwrap();
        let n = map.entry(i).or_insert(0);
        *n += 1;
        *n
    };
    if attempt > MAX_RECREATE {
        eprintln!("[overlay] overlay-{i} destroyed repeatedly, giving up recreation");
        return;
    }
    eprintln!("[overlay] overlay-{i} destroyed by environment, recreating (attempt {attempt})");
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(1500));
        if let Some(m) = app
            .available_monitors()
            .unwrap_or_default()
            .into_iter()
            .nth(i)
        {
            spawn_overlay(&app, i, &m);
        }
    });
}

fn schedule_create_overlays(app: AppHandle) {
    if CREATE_PENDING.swap(true, Ordering::AcqRel) {
        return;
    }
    std::thread::spawn(move || {
        // Let a WebView-originated IPC call return before creating another WebView on Windows.
        std::thread::sleep(Duration::from_millis(25));
        let create_app = app.clone();
        if app
            .run_on_main_thread(move || {
                create_overlays(&create_app);
                CREATE_PENDING.store(false, Ordering::Release);
            })
            .is_err()
        {
            CREATE_PENDING.store(false, Ordering::Release);
        }
    });
}

#[derive(Deserialize, Clone, Copy)]
struct UiRect {
    x: i32,
    y: i32,
    w: i32,
    h: i32,
}

/** 各 overlay 窗口的可交互区域（窗口内容坐标），由渲染层上报 */
static UI_RECTS: OnceLock<Mutex<HashMap<String, Vec<UiRect>>>> = OnceLock::new();
static READY: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

fn rects() -> &'static Mutex<HashMap<String, Vec<UiRect>>> {
    UI_RECTS.get_or_init(Default::default)
}

fn ready() -> &'static Mutex<HashSet<String>> {
    READY.get_or_init(Default::default)
}

pub fn register_overlay_ready_listener(app: &AppHandle) {
    app.listen("overlay:ready", |event| {
        let Ok(label) = serde_json::from_str::<String>(event.payload()) else {
            return;
        };
        ready().lock().unwrap().insert(label);
    });
}

pub fn register_ui_rects_listener(app: &AppHandle) {
    #[derive(Deserialize)]
    struct Payload {
        rects: Vec<UiRect>,
        label: String,
    }
    app.listen("overlay:set-ui-rects", |event| {
        let Ok(p) = serde_json::from_str::<Payload>(event.payload()) else {
            return;
        };
        let mut map = rects().lock().unwrap();
        if p.rects.is_empty() {
            map.remove(&p.label);
        } else {
            map.insert(p.label, p.rects);
        }
    });
}

#[cfg(target_os = "windows")]
mod win {
    #[repr(C)]
    pub struct Point {
        pub x: i32,
        pub y: i32,
    }

    extern "system" {
        pub fn GetCursorPos(p: *mut Point) -> i32;
    }

    pub fn cursor() -> Option<(i32, i32)> {
        unsafe {
            let mut p = Point { x: 0, y: 0 };
            if GetCursorPos(&mut p) == 0 {
                None
            } else {
                Some((p.x, p.y))
            }
        }
    }
}

/**
 * 悬停检测：轮询光标位置，命中弹幕交互区则关闭该窗口穿透（接收点击），否则保持穿透。
 * 与 Electron 版一致用轮询而非事件转发（Electron 的 forward 模式在本机触发渲染崩溃）。
 */
pub fn start_hover_polling(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        let mut last_ignore: HashMap<String, bool> = HashMap::new();
        loop {
            std::thread::sleep(std::time::Duration::from_millis(80));
            #[cfg(target_os = "windows")]
            {
                let Some((cx, cy)) = win::cursor() else {
                    continue;
                };
                for (label, win) in app.webview_windows() {
                    if !label.starts_with("overlay-") {
                        continue;
                    }
                    let ui = rects()
                        .lock()
                        .unwrap()
                        .get(&label)
                        .cloned()
                        .unwrap_or_default();
                    let mut hover = false;
                    if !ui.is_empty() {
                        if let (Ok(p), Ok(s)) = (win.outer_position(), win.outer_size()) {
                            let lx = cx - p.x;
                            let ly = cy - p.y;
                            if lx >= 0 && ly >= 0 && lx < s.width as i32 && ly < s.height as i32 {
                                hover = ui.iter().any(|r| {
                                    lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h
                                });
                            }
                        }
                    }
                    let ignore = !hover;
                    if last_ignore.get(&label) != Some(&ignore) {
                        last_ignore.insert(label.to_string(), ignore);
                        let _ = win.set_ignore_cursor_events(ignore);
                    }
                }
            }
        }
    });
}

/// 按配置解析本次弹幕应投递的 overlay 窗口（label, 是否主屏）
pub fn overlay_targets(app: &AppHandle, cfg: &Config) -> Vec<(String, bool)> {
    let monitors = app.available_monitors().unwrap_or_default();
    let primary = app.primary_monitor().ok().flatten();
    let mut entries: Vec<(usize, bool, i32)> = monitors
        .iter()
        .enumerate()
        .map(|(i, m)| {
            let is_primary = primary
                .as_ref()
                .map(|p| p.position() == m.position() && p.size() == m.size())
                .unwrap_or(i == 0);
            (i, is_primary, m.position().x)
        })
        .collect();
    match cfg.display_mode.as_str() {
        "primary" => entries.retain(|e| e.1),
        "custom" => {
            // customDisplays 序号 = 按屏幕 x 从左到右排序后的位置（与 displays_list 返回顺序一致）
            let mut sorted: Vec<usize> = (0..entries.len()).collect();
            sorted.sort_by_key(|i| entries[*i].2);
            let chosen: Vec<usize> = cfg
                .custom_displays
                .iter()
                .filter_map(|idx| sorted.get(*idx as usize).copied())
                .collect();
            // 配置的序号全部失配（显示器变动）→ 回退全部
            if !chosen.is_empty() {
                entries.retain(|e| chosen.contains(&e.0));
            }
        }
        _ => {}
    }
    entries
        .into_iter()
        .map(|(i, is_primary, _)| (format!("overlay-{i}"), is_primary))
        .collect()
}

/// 按 displayMode 定向广播弹幕；返回实际收到事件的窗口数。
/// 提示音只由恰好一个窗口播放（优先主屏，目标里没有主屏时回退第一个，避免选了副屏就无声）。
pub fn broadcast(app: &AppHandle, cfg: &Config, payload: ReminderPayload) -> usize {
    let targets = overlay_targets(app, cfg);
    if targets.is_empty() {
        return 0;
    }
    let sound_idx = targets
        .iter()
        .position(|(_, is_primary)| *is_primary)
        .unwrap_or(0);
    let mut delivered = 0;
    for (i, (label, _)) in targets.iter().enumerate() {
        if app.get_webview_window(label).is_none() || !ready().lock().unwrap().contains(label) {
            continue;
        }
        let mut p = payload.clone();
        p.sound = p.sound && i == sound_idx;
        if app.emit_to(label, "notify:reminder", &p).is_ok() {
            delivered += 1;
        }
    }
    if delivered == 0 {
        // 安全软件可能关闭透明窗；下一次提醒前主动再尝试恢复。
        schedule_create_overlays(app.clone());
    }
    delivered
}
