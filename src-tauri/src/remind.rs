use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_notification::NotificationExt;

use crate::schedule::{in_quiet_hours, pick_escalation, pick_template, pick_text};
use crate::scheduler::Source;
use crate::state::AppState;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReminderPayload {
    pub text: String,
    pub sound: bool,
    pub volume: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sound_preset: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strict: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub escalate: Option<u32>,
}

/** 自定义音频：file 模式且已选文件时下发绝对路径，bridge 层转 asset 协议 URL */
fn audio_url(app: &AppHandle, cfg: &crate::config::Config) -> Option<String> {
    if cfg.audio_mode == "file" && !cfg.audio_file_name.is_empty() {
        crate::audio::audio_path(app, &cfg.audio_file_name).map(|p| p.to_string_lossy().to_string())
    } else {
        None
    }
}

/// 提醒触发统一入口（移植自 Electron 版 remind()）
/// manual=true 绕过安静时段（手动「立即提醒」/测试）；会议/全屏/番茄专注优先级最高
pub fn remind(
    app: &AppHandle,
    _source: Source,
    item_id: &str,
    manual: bool,
    escalate_level: u32,
) -> usize {
    let state: State<AppState> = app.state();
    let cfg = state.store.lock().unwrap().config.clone();

    let now = chrono::Local::now();
    let temporary_pause = cfg
        .paused_until
        .is_some_and(|until| until > now.timestamp_millis());
    if (cfg.paused || temporary_pause) && !manual {
        return 0;
    }
    let mut payload = ReminderPayload {
        text: String::new(),
        sound: cfg.sound_enabled,
        volume: cfg.volume,
        audio_url: audio_url(app, &cfg),
        item_id: Some(item_id.to_string()),
        name: None,
        priority: None,
        sound_preset: None,
        strict: None,
        escalate: None,
    };

    let (ignore_quiet, high, strict) = match cfg.find_item(item_id) {
        Some(item) => {
            let (texts, night_texts, priority, preset, strict) = item.texts();
            payload.text = pick_text(texts, night_texts, now);
            payload.name = Some(item.name().to_string());
            payload.priority = priority.map(|s| s.to_string());
            payload.sound_preset = preset.map(|s| s.to_string());
            (item.ignore_quiet(), priority == Some("high"), strict)
        }
        None => {
            payload.text = pick_template();
            payload.item_id = None;
            (false, false, false)
        }
    };
    if strict {
        payload.strict = Some(true);
    }

    let suppressed = !manual
        && (crate::meeting::is_meeting()
            || (cfg.fullscreen_detect && crate::fullscreen::is_fullscreen_app())
            || state.pomodoro.is_suppressing()
            || (!ignore_quiet
                && in_quiet_hours(cfg.quiet_enabled, &cfg.quiet_start, &cfg.quiet_end, now)));
    if suppressed {
        crate::tray::refresh_tray(app);
        return 0;
    }

    let escalate = cfg.escalate_enabled && escalate_level >= 2;
    if escalate && rand::random::<f64>() < 0.6 {
        payload.text = pick_escalation();
    }
    if escalate {
        payload.escalate = Some(escalate_level);
    }

    // 节日祝福只附加在当天第一条弹幕上
    if cfg.festival_enabled {
        let today = crate::stats::today_str(now.date_naive());
        let mut shown = state.festival_shown_on.lock().unwrap();
        if *shown != today {
            if let Some(greeting) = crate::festivals::festival_greeting(now) {
                payload.text = format!("{greeting}！{}", payload.text);
                *shown = today;
            }
        }
    }

    let name = cfg.find_item(item_id).map(|i| i.name().to_string());
    let delivered = crate::overlay::broadcast(app, &cfg, payload.clone());
    let system_notified = delivered == 0 || (high && cfg.high_priority_notify);

    if system_notified {
        let title = cfg
            .find_item(item_id)
            .map(|i| format!("SoftNotify · {}", i.name()))
            .unwrap_or_else(|| "SoftNotify".into());
        let _ = app
            .notification()
            .builder()
            .title(title)
            .body(payload.text.clone())
            .show();
    }

    let result = match (delivered > 0, system_notified) {
        (true, true) => "overlay+system",
        (true, false) => "overlay",
        (false, true) => "system",
        (false, false) => "direct",
    };
    state.history.add(crate::history::HistoryEntry {
        text: payload.text.clone(),
        name,
        at: now.timestamp_millis(),
        result: Some(result.into()),
    });

    if manual && _source == Source::Reminder {
        if let Some(sched) = state.scheduler.lock().unwrap().as_ref() {
            sched.reset_item(item_id);
        }
    }
    drop(state);
    crate::tray::refresh_tray(app);
    delivered
}

/// 直接广播弹幕（番茄钟结束/补打卡确认等，豁免静默规则）
pub fn send_direct(app: &AppHandle, text: &str, sound: bool, volume: f64) {
    let payload = ReminderPayload {
        text: text.to_string(),
        sound,
        volume,
        audio_url: None,
        item_id: None,
        name: None,
        priority: None,
        sound_preset: None,
        strict: None,
        escalate: None,
    };
    let cfg = app.state::<AppState>().store.lock().unwrap().config.clone();
    if crate::overlay::broadcast(app, &cfg, payload) == 0 {
        let _ = app
            .notification()
            .builder()
            .title("SoftNotify")
            .body(text)
            .show();
    }
}

/// 按 id 提醒（托盘「立即提醒」），自动识别来源
pub fn remind_by_id(app: &AppHandle, item_id: &str, manual: bool) -> usize {
    let state: State<AppState> = app.state();
    let is_reminder = state
        .store
        .lock()
        .unwrap()
        .config
        .reminders
        .iter()
        .any(|r| r.id == item_id);
    remind(
        app,
        if is_reminder {
            Source::Reminder
        } else {
            Source::Schedule
        },
        item_id,
        manual,
        0,
    )
}
