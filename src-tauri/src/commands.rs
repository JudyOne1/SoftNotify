use serde_json::{json, Value};
use std::collections::HashSet;
use tauri::{AppHandle, Manager, State};

use crate::remind;
use crate::scheduler::Source;
use crate::state::AppState;

fn current_config_value(state: &State<AppState>) -> Value {
    let cfg = state.store.lock().unwrap().config.clone();
    serde_json::to_value(&cfg).unwrap_or(Value::Null)
}

#[tauri::command]
pub fn config_get(state: State<AppState>) -> Value {
    current_config_value(&state)
}

#[tauri::command]
pub fn config_set(app: AppHandle, state: State<AppState>, patch: Value) -> Value {
    state.store.lock().unwrap().apply_patch(patch);
    drop(state);
    crate::apply_config_change(&app);
    let state: State<AppState> = app.state();
    current_config_value(&state)
}

#[tauri::command]
pub fn notify_test(app: AppHandle, state: State<AppState>, item_id: Option<String>) -> Value {
    let id = item_id.unwrap_or_else(|| {
        let cfg = &state.store.lock().unwrap().config;
        cfg.reminders
            .first()
            .map(|r| r.id.clone())
            .or_else(|| cfg.schedules.first().map(|s| s.id.clone()))
            .unwrap_or_default()
    });
    drop(state);
    let delivered = remind::remind_by_id(&app, &id, true);
    json!({ "overlayDelivered": delivered > 0 })
}

#[tauri::command]
pub fn remind_next(state: State<AppState>, item_id: String) -> Option<i64> {
    let mirror = state.next_mirror.lock().unwrap();
    mirror
        .get(&format!("r:{item_id}"))
        .or_else(|| mirror.get(&format!("s:{item_id}")))
        .copied()
}

#[tauri::command]
pub fn app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub fn ui_env() -> Value {
    json!({ "nativeMaterial": false })
}

#[tauri::command]
pub fn displays_list(app: AppHandle) -> Vec<Value> {
    let mut out = Vec::new();
    if let Ok(monitors) = app.available_monitors() {
        let primary = app.primary_monitor().ok().flatten();
        // 按物理 x 从左到右排序（同 x 按 y）：返回的 index 即左→右位置，
        // 与 overlay_targets 对 customDisplays 序号的解释一致
        let mut indexed: Vec<(usize, &tauri::Monitor)> = monitors.iter().enumerate().collect();
        indexed.sort_by_key(|(_, m)| (m.position().x, m.position().y));
        for (i, (_, m)) in indexed.iter().enumerate() {
            let scale = m.scale_factor();
            let is_primary = primary
                .as_ref()
                .map(|p| p.position() == m.position() && p.size() == m.size())
                .unwrap_or(i == 0);
            out.push(json!({
                "index": i,
                "primary": is_primary,
                "width": (m.size().width as f64 / scale).round(),
                "height": (m.size().height as f64 / scale).round()
            }));
        }
    }
    out
}

#[tauri::command]
pub fn open_external(url: String) {
    if url.starts_with("https://github.com") {
        let _ = tauri_plugin_opener::open_url(url, None::<&str>);
    }
}

// —— M2 待实现：自定义音频 / 更新检查 ——

#[tauri::command]
pub fn audio_choose(app: AppHandle) -> Value {
    crate::audio::choose_audio(&app)
}

#[tauri::command]
pub fn update_check(app: AppHandle) -> Value {
    if cfg!(debug_assertions) {
        return json!({ "status": "unsupported" });
    }
    let current = app.package_info().version.to_string();
    std::thread::spawn(move || {
        use tauri::Emitter;
        let status = match ureq::get("https://api.github.com/repos/JudyOne1/SoftNotify/releases/latest")
            .set("User-Agent", "SoftNotify")
            .timeout(std::time::Duration::from_secs(10))
            .call()
        {
            Ok(resp) => {
                let latest = resp
                    .into_json::<serde_json::Value>()
                    .ok()
                    .and_then(|j| j.get("tag_name")?.as_str().map(|s| s.trim_start_matches('v').to_string()));
                match latest {
                    // 暂无自动安装通道：发现新版本引导用户到下载页
                    Some(v) if v != current => "error",
                    Some(_) => "up-to-date",
                    None => "error",
                }
            }
            Err(_) => "error",
        };
        let _ = app.emit("update:status", status);
    });
    json!({ "status": "checking" })
}

#[tauri::command]
pub fn history_get(state: State<AppState>) -> Value {
    state.history.get()
}

#[tauri::command]
pub fn checkin(app: AppHandle, state: State<AppState>, item_id: String) {
    state.stats.add_checkin(&item_id);
    crate::snooze::reset(&item_id);
    // Streak 里程碑庆祝（3/7/14/30/50/100 天连续达标）
    let (name, goal) = match state.store.lock().unwrap().config.find_item(&item_id) {
        Some(i) => (i.name().to_string(), i.daily_goal()),
        None => (String::new(), None),
    };
    if let Some(g) = goal.filter(|g| *g > 0) {
        let streak = crate::stats::compute_streak(&state.stats.item_daily_counts(&item_id), g as u64);
        let milestone = crate::stats::STREAK_MILESTONES
            .iter()
            .rev()
            .find(|n| streak >= **n && !state.stats.is_celebrated(&format!("{item_id}-{n}")));
        if let Some(m) = milestone {
            state.stats.mark_celebrated(&format!("{item_id}-{m}"));
            let cfg = state.store.lock().unwrap().config.clone();
            crate::remind::send_direct(&app, &format!("🔥 连续 {m} 天达成「{name}」目标！"), cfg.sound_enabled, cfg.volume);
            state.history.add(crate::history::HistoryEntry {
                text: format!("🔥 连续 {m} 天达成「{name}」"),
                name: Some(name),
                at: chrono::Local::now().timestamp_millis(),
                result: Some("direct".into()),
            });
        }
    }
    drop(state);
    crate::tray::refresh_tray(&app);
}

#[tauri::command]
pub fn snooze(app: AppHandle, item_id: String) {
    crate::snooze::snooze_item(&item_id, move |id, level| {
        crate::remind::remind(&app, Source::Reminder, &id, false, level);
    });
}

#[tauri::command]
pub fn stats_get(state: State<AppState>) -> Value {
    state.stats.get_stats(365)
}

#[tauri::command]
pub fn tray_panel_state(state: State<AppState>) -> Value {
    crate::tray::panel_snapshot(&state)
}

#[tauri::command]
pub fn open_main_window(app: AppHandle, section: String) {
    // On Windows, creating a second WebView before the tray WebView's IPC turn returns can leave a blank window shell.
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(25));
        let window_app = app.clone();
        let _ = app.run_on_main_thread(move || {
            crate::settings::open_settings_to(&window_app, &section);
        });
    });
}

#[tauri::command]
pub fn stats_export(app: AppHandle, state: State<AppState>) -> Value {
    use tauri_plugin_dialog::DialogExt;
    let data = serde_json::to_string_pretty(&state.stats.get_stats(365)).unwrap_or_default();
    let (tx, rx) = std::sync::mpsc::channel();
    let default = format!("notify-stats-{}.json", chrono::Local::now().format("%Y-%m-%d"));
    app.dialog()
        .file()
        .set_title("导出统计数据")
        .set_file_name(default)
        .add_filter("JSON", &["json"])
        .save_file(move |path| {
            let ok = match path {
                Some(p) => p.into_path().map(|fp| std::fs::write(fp, data).is_ok()).unwrap_or(false),
                None => false,
            };
            let _ = tx.send(ok);
        });
    match rx.recv_timeout(std::time::Duration::from_secs(60)) {
        Ok(true) => json!({ "canceled": false }),
        _ => json!({ "canceled": true }),
    }
}

#[tauri::command]
pub fn pomodoro_start(app: AppHandle, state: State<AppState>, minutes: u32) {
    state.pomodoro.start(minutes.clamp(1, 180));
    drop(state);
    crate::tray::refresh_tray(&app);
}

#[tauri::command]
pub fn pomodoro_stop(app: AppHandle, state: State<AppState>) {
    state.pomodoro.stop();
    drop(state);
    crate::tray::refresh_tray(&app);
}

#[tauri::command]
pub fn pomodoro_state(state: State<AppState>) -> Value {
    json!({
        "active": state.pomodoro.is_active(),
        "phase": state.pomodoro.phase(),
        "remainingMs": state.pomodoro.remaining_ms(),
        "todayFocus": state.stats.today_focus_count()
    })
}

#[tauri::command]
pub fn profile_apply(app: AppHandle, state: State<AppState>, id: String) -> Value {
    let cfg = state.store.lock().unwrap().config.clone();
    if let Some(p) = cfg.profiles.iter().find(|p| p.id == id) {
        let ids: HashSet<String> = p.item_ids.iter().cloned().collect();
        let reminders: Vec<Value> = cfg
            .reminders
            .iter()
            .map(|r| {
                let mut v = serde_json::to_value(r).unwrap();
                v["enabled"] = json!(ids.contains(&format!("r:{}", r.id)));
                v
            })
            .collect();
        let schedules: Vec<Value> = cfg
            .schedules
            .iter()
            .map(|s| {
                let mut v = serde_json::to_value(s).unwrap();
                v["enabled"] = json!(ids.contains(&format!("s:{}", s.id)));
                v
            })
            .collect();
        let patch = json!({ "reminders": reminders, "schedules": schedules, "activeProfile": id });
        state.store.lock().unwrap().apply_patch(patch);
    }
    drop(state);
    crate::apply_config_change(&app);
    let state: State<AppState> = app.state();
    current_config_value(&state)
}

#[tauri::command]
pub fn profile_save(app: AppHandle, state: State<AppState>, name: String) -> Value {
    {
        let mut store = state.store.lock().unwrap();
        let cfg = &store.config;
        let mut item_ids: Vec<String> = Vec::new();
        for s in cfg.schedules.iter().filter(|s| s.enabled) {
            item_ids.push(format!("s:{}", s.id));
        }
        for r in cfg.reminders.iter().filter(|r| r.enabled) {
            item_ids.push(format!("r:{}", r.id));
        }
        let id = format!("p-{}", chrono::Local::now().timestamp_millis());
        let profiles: Vec<Value> = cfg
            .profiles
            .iter()
            .map(|p| serde_json::to_value(p).unwrap())
            .chain(std::iter::once(json!({
                "id": id,
                "name": name.trim(),
                "itemIds": item_ids
            })))
            .collect();
        let patch = json!({ "profiles": profiles, "activeProfile": id });
        store.apply_patch(patch);
    }
    drop(state);
    crate::apply_config_change(&app);
    let state: State<AppState> = app.state();
    current_config_value(&state)
}

#[tauri::command]
pub fn profile_update_items(app: AppHandle, state: State<AppState>, id: String, item_ids: Vec<String>) -> Value {
    {
        let store = state.store.lock().unwrap();
        let profiles: Vec<Value> = store
            .config
            .profiles
            .iter()
            .map(|p| {
                let mut v = serde_json::to_value(p).unwrap();
                if p.id == id {
                    v["itemIds"] = json!(item_ids);
                }
                v
            })
            .collect();
        drop(store);
        state.store.lock().unwrap().apply_patch(json!({ "profiles": profiles }));
    }
    drop(state);
    crate::apply_config_change(&app);
    let state: State<AppState> = app.state();
    current_config_value(&state)
}
