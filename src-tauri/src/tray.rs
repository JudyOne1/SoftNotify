use serde_json::{json, Value};
use chrono::TimeZone;
use tauri::image::Image;
use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Rect, State, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};

use crate::config::Config;
use crate::pomodoro::Phase;
use crate::state::AppState;

const TRAY_ICON: &[u8] = include_bytes!("../resources/tray.png");
const TRAY_ICON_PAUSED: &[u8] = include_bytes!("../resources/tray-paused.png");
const PANEL_WIDTH: f64 = 360.0;
const PANEL_HEIGHT: f64 = 460.0;

#[derive(Clone, Copy, Debug)]
struct Bounds {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

#[derive(Clone, Copy)]
enum Edge {
    Top,
    Right,
    Bottom,
    Left,
}

fn status_text(cfg: &Config, state: &State<AppState>) -> String {
    if cfg.paused {
        return "SoftNotify：已暂停".into();
    }
    if let Some(until) = cfg
        .paused_until
        .filter(|until| *until > chrono::Local::now().timestamp_millis())
    {
        let time = chrono::Local.timestamp_millis_opt(until).single()
            .map(|value| value.format("%H:%M").to_string())
            .unwrap_or_else(|| "稍后".into());
        return format!("SoftNotify：暂时暂停 · 至 {time}");
    }
    if state.pomodoro.is_active() {
        let min = (state.pomodoro.remaining_ms() as f64 / 60_000.0)
            .ceil()
            .max(1.0) as i64;
        return match state.pomodoro.phase() {
            Some(Phase::Focus) => format!("SoftNotify：专注中 · 剩余 {min} 分钟"),
            _ => format!("SoftNotify：休息中 · 剩余 {min} 分钟"),
        };
    }
    if crate::meeting::is_manual_meeting() {
        return "SoftNotify：会议模式（手动）".into();
    }
    if cfg.fullscreen_detect && crate::fullscreen::is_fullscreen_app() {
        return "SoftNotify：全屏应用中（免打扰）".into();
    }
    if crate::schedule::in_quiet_hours(
        cfg.quiet_enabled,
        &cfg.quiet_start,
        &cfg.quiet_end,
        chrono::Local::now(),
    ) {
        return format!("SoftNotify：安静时段（至 {}）", cfg.quiet_end);
    }
    let base = {
        let mirror = state.next_mirror.lock().unwrap();
        if let Some((key, at)) = mirror.iter().min_by_key(|(_, time)| *time) {
            let id = key
                .strip_prefix("r:")
                .or_else(|| key.strip_prefix("s:"))
                .unwrap_or(key);
            let name = cfg
                .find_item(id)
                .map(|item| item.name().to_string())
                .unwrap_or_default();
            let mins = ((*at - chrono::Local::now().timestamp_millis()) as f64 / 60_000.0)
                .ceil()
                .max(0.0) as i64;
            format!(
                "SoftNotify：{}{} 分钟后提醒",
                if name.is_empty() {
                    String::new()
                } else {
                    format!("{name} ")
                },
                mins
            )
        } else {
            "SoftNotify：无已启用的提醒".into()
        }
    };
    let checked = state.stats.today_checkin_count();
    if checked > 0 {
        format!("{base} · 今日已打卡 {checked} 次")
    } else {
        base
    }
}

fn build_menu(
    app: &AppHandle,
    cfg: &Config,
    state: &State<AppState>,
) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let pause_active = cfg.paused
        || cfg
            .paused_until
            .is_some_and(|until| until > chrono::Local::now().timestamp_millis());
    let pause_label = if pause_active {
        "恢复提醒"
    } else {
        "暂停提醒"
    };
    MenuBuilder::new(app)
        .item(
            &MenuItemBuilder::new(status_text(cfg, state))
                .id("status")
                .enabled(false)
                .build(app)?,
        )
        .item(&PredefinedMenuItem::separator(app)?)
        .item(
            &MenuItemBuilder::new("打开 SoftNotify")
                .id("open-notify")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::new(pause_label)
                .id("toggle-pause")
                .build(app)?,
        )
        .item(
            &CheckMenuItemBuilder::new("会议模式（静默）")
                .checked(crate::meeting::is_manual_meeting())
                .id("toggle-meeting")
                .build(app)?,
        )
        .item(&PredefinedMenuItem::separator(app)?)
        .item(
            &MenuItemBuilder::new("设置")
                .id("open-settings")
                .build(app)?,
        )
        .item(&PredefinedMenuItem::quit(app, Some("退出 SoftNotify"))?)
        .build()
}

pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    create_panel(app)?;
    let icon = Image::from_bytes(TRAY_ICON).expect("bad tray icon");
    let state: State<AppState> = app.state();
    let cfg = state.store.lock().unwrap().config.clone();
    TrayIconBuilder::with_id("main")
        .icon(icon)
        .icon_as_template(false)
        .tooltip(status_text(&cfg, &state))
        .menu(&build_menu(app, &cfg, &state)?)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                position,
                rect,
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_panel(tray.app_handle(), position, rect);
            }
        })
        .on_menu_event(|app, event| handle_menu_event(app, event.id().0.as_str()))
        .build(app)?;

    let refresh_app = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(30));
        refresh_tray(&refresh_app);
    });
    Ok(())
}

fn create_panel(app: &AppHandle) -> tauri::Result<()> {
    if app.get_webview_window("tray-panel").is_some() {
        return Ok(());
    }
    let panel = WebviewWindowBuilder::new(
        app,
        "tray-panel",
        WebviewUrl::App("index.html#/tray".into()),
    )
    .title("SoftNotify")
    .inner_size(PANEL_WIDTH, PANEL_HEIGHT)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .closable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(true)
    .focused(false)
    .visible(false)
    .build()?;

    let event_panel = panel.clone();
    panel.on_window_event(move |event| {
        if matches!(event, WindowEvent::Focused(false)) {
            let _ = event_panel.hide();
        }
    });
    Ok(())
}

fn toggle_panel(app: &AppHandle, click_position: PhysicalPosition<f64>, tray_rect: Rect) {
    let Some(panel) = app.get_webview_window("tray-panel") else {
        return;
    };
    if panel.is_visible().unwrap_or(false) {
        let _ = panel.hide();
        return;
    }
    position_panel(app, &panel, click_position, tray_rect);
    let _ = app.emit_to("tray-panel", "tray:refresh", ());
    let _ = panel.show();
    let _ = panel.set_focus();
}

fn position_panel(
    app: &AppHandle,
    panel: &tauri::WebviewWindow,
    click_position: PhysicalPosition<f64>,
    tray_rect: Rect,
) {
    let Ok(monitors) = app.available_monitors() else {
        return;
    };
    let Some(monitor) = monitors
        .iter()
        .find(|monitor| {
            let p = monitor.position();
            let s = monitor.size();
            click_position.x >= p.x as f64
                && click_position.x < (p.x + s.width as i32) as f64
                && click_position.y >= p.y as f64
                && click_position.y < (p.y + s.height as i32) as f64
        })
        .or_else(|| monitors.first())
    else {
        return;
    };

    let scale = monitor.scale_factor();
    let tray_position = tray_rect.position.to_physical::<i32>(scale);
    let tray_size = tray_rect.size.to_physical::<u32>(scale);
    let panel_width = (PANEL_WIDTH * scale).round() as u32;
    let panel_height = (PANEL_HEIGHT * scale).round() as u32;
    let _ = panel.set_size(PhysicalSize::new(panel_width, panel_height));

    let monitor_bounds = Bounds {
        x: monitor.position().x,
        y: monitor.position().y,
        width: monitor.size().width as i32,
        height: monitor.size().height as i32,
    };
    let work = monitor.work_area();
    let work_bounds = Bounds {
        x: work.position.x,
        y: work.position.y,
        width: work.size.width as i32,
        height: work.size.height as i32,
    };
    let tray_bounds = Bounds {
        x: tray_position.x,
        y: tray_position.y,
        width: tray_size.width as i32,
        height: tray_size.height as i32,
    };
    let gap = (8.0 * scale).round() as i32;
    let (x, y) = calculate_panel_position(
        monitor_bounds,
        work_bounds,
        tray_bounds,
        panel_width as i32,
        panel_height as i32,
        gap,
    );
    let _ = panel.set_position(PhysicalPosition::new(x, y));
}

fn calculate_panel_position(
    monitor: Bounds,
    work: Bounds,
    tray: Bounds,
    panel_width: i32,
    panel_height: i32,
    gap: i32,
) -> (i32, i32) {
    let monitor_right = monitor.x + monitor.width;
    let monitor_bottom = monitor.y + monitor.height;
    let work_right = work.x + work.width;
    let work_bottom = work.y + work.height;
    let insets = [
        (work.y - monitor.y).max(0),
        (monitor_right - work_right).max(0),
        (monitor_bottom - work_bottom).max(0),
        (work.x - monitor.x).max(0),
    ];
    let edge =
        if let Some((index, value)) = insets.iter().enumerate().max_by_key(|(_, value)| *value) {
            if *value > 0 {
                [Edge::Top, Edge::Right, Edge::Bottom, Edge::Left][index]
            } else {
                nearest_edge(monitor, tray)
            }
        } else {
            Edge::Bottom
        };

    let center_x = tray.x + tray.width / 2;
    let center_y = tray.y + tray.height / 2;
    let min_x = work.x + gap;
    let min_y = work.y + gap;
    let max_x = (work_right - panel_width - gap).max(min_x);
    let max_y = (work_bottom - panel_height - gap).max(min_y);
    match edge {
        Edge::Top => ((center_x - panel_width / 2).clamp(min_x, max_x), min_y),
        Edge::Right => (max_x, (center_y - panel_height / 2).clamp(min_y, max_y)),
        Edge::Bottom => ((center_x - panel_width / 2).clamp(min_x, max_x), max_y),
        Edge::Left => (min_x, (center_y - panel_height / 2).clamp(min_y, max_y)),
    }
}

fn nearest_edge(monitor: Bounds, tray: Bounds) -> Edge {
    let x = tray.x + tray.width / 2;
    let y = tray.y + tray.height / 2;
    let distances = [
        (y - monitor.y).abs(),
        (monitor.x + monitor.width - x).abs(),
        (monitor.y + monitor.height - y).abs(),
        (x - monitor.x).abs(),
    ];
    let index = distances
        .iter()
        .enumerate()
        .min_by_key(|(_, value)| *value)
        .map(|(index, _)| index)
        .unwrap_or(2);
    [Edge::Top, Edge::Right, Edge::Bottom, Edge::Left][index]
}

fn handle_menu_event(app: &AppHandle, id: &str) {
    match id {
        "toggle-pause" => {
            {
                let state: State<AppState> = app.state();
                let mut store = state.store.lock().unwrap();
                let pause_active = store.config.paused
                    || store
                        .config
                        .paused_until
                        .is_some_and(|until| until > chrono::Local::now().timestamp_millis());
                store.config.paused = !pause_active;
                store.config.paused_until = None;
                store.save();
            }
            crate::apply_config_change(app);
        }
        "toggle-meeting" => {
            crate::meeting::set_manual_meeting(!crate::meeting::is_manual_meeting());
            refresh_tray(app);
        }
        "open-notify" => crate::settings::open_settings_to(app, "today"),
        "open-settings" => crate::settings::open_settings_to(app, "settings"),
        "quit" => app.exit(0),
        _ => {}
    }
}

pub fn panel_snapshot(state: &State<AppState>) -> Value {
    let cfg = state.store.lock().unwrap().config.clone();
    let now = chrono::Local::now();
    let has_enabled = cfg.reminders.iter().any(|item| item.enabled)
        || cfg.schedules.iter().any(|item| item.enabled);
    let (kind, label, detail, resume_at) = if cfg.paused {
        ("paused", "已暂停", "所有自动提醒暂时停止".to_string(), None)
    } else if let Some(until) = cfg
        .paused_until
        .filter(|until| *until > now.timestamp_millis())
    {
        ("paused", "暂时暂停", "到时间后自动恢复提醒".to_string(), Some(until))
    } else if state.pomodoro.is_active() {
        match state.pomodoro.phase() {
            Some(Phase::Break) => ("break", "休息中", "休息结束后会提醒你".to_string(), None),
            _ => ("focus", "专注中", "其他提醒暂时静默".to_string(), None),
        }
    } else if crate::meeting::is_manual_meeting() {
        ("meeting", "会议模式", "手动免打扰已开启".to_string(), None)
    } else if cfg.fullscreen_detect && crate::fullscreen::is_fullscreen_app() {
        (
            "fullscreen",
            "全屏免打扰",
            "退出全屏应用后自动恢复".to_string(),
            None,
        )
    } else if crate::schedule::in_quiet_hours(
        cfg.quiet_enabled,
        &cfg.quiet_start,
        &cfg.quiet_end,
        now,
    ) {
        ("quiet", "安静时段", format!("{} 自动恢复", cfg.quiet_end), None)
    } else if !has_enabled {
        (
            "empty",
            "暂无启用提醒",
            "可在主窗口添加或启用提醒".to_string(),
            None,
        )
    } else {
        ("running", "正常运行", "提醒会按计划出现".to_string(), None)
    };

    let next = {
        let mirror = state.next_mirror.lock().unwrap();
        mirror
            .iter()
            .min_by_key(|(_, at)| *at)
            .and_then(|(key, at)| {
                let (prefix, id) = key.split_once(':')?;
                let item = cfg.find_item(id)?;
                Some(json!({
                    "id": id,
                    "name": item.name(),
                    "at": at,
                    "kind": if prefix == "s" { "schedule" } else { "interval" }
                }))
            })
    };

    let mut goal_items = 0usize;
    let mut goals_completed = 0usize;
    for item in cfg.reminders.iter().filter(|item| item.enabled) {
        if let Some(goal) = item.daily_goal.filter(|goal| *goal > 0) {
            goal_items += 1;
            if state.stats.today_count_for(&item.id) >= goal as usize {
                goals_completed += 1;
            }
        }
    }
    for item in cfg.schedules.iter().filter(|item| item.enabled) {
        if let Some(goal) = item.daily_goal.filter(|goal| *goal > 0) {
            goal_items += 1;
            if state.stats.today_count_for(&item.id) >= goal as usize {
                goals_completed += 1;
            }
        }
    }

    json!({
        "status": { "kind": kind, "label": label, "detail": detail, "resumeAt": resume_at },
        "next": next,
        "today": {
            "checkins": state.stats.today_checkin_count(),
            "goalItems": goal_items,
            "goalsCompleted": goals_completed,
            "focusSessions": state.stats.today_focus_count()
        },
        "pomodoro": {
            "active": state.pomodoro.is_active(),
            "phase": state.pomodoro.phase(),
            "remainingMs": state.pomodoro.remaining_ms()
        }
    })
}

pub fn refresh_tray(app: &AppHandle) {
    let Some(tray) = app.tray_by_id("main") else {
        return;
    };
    let state: State<AppState> = app.state();
    let cfg = state.store.lock().unwrap().config.clone();
    let pause_active = cfg.paused
        || cfg
            .paused_until
            .is_some_and(|until| until > chrono::Local::now().timestamp_millis());
    let icon_bytes = if pause_active {
        TRAY_ICON_PAUSED
    } else {
        TRAY_ICON
    };
    if let Ok(icon) = Image::from_bytes(icon_bytes) {
        let _ = tray.set_icon(Some(icon));
    }
    let _ = tray.set_tooltip(Some(status_text(&cfg, &state)));
    if let Ok(menu) = build_menu(app, &cfg, &state) {
        let _ = tray.set_menu(Some(menu));
    }
    let _ = app.emit_to("tray-panel", "tray:refresh", ());
}

#[cfg(test)]
mod tests {
    use super::{calculate_panel_position, Bounds};

    #[test]
    fn anchors_above_bottom_taskbar() {
        let position = calculate_panel_position(
            Bounds {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
            },
            Bounds {
                x: 0,
                y: 0,
                width: 1920,
                height: 1040,
            },
            Bounds {
                x: 1800,
                y: 1045,
                width: 24,
                height: 24,
            },
            360,
            520,
            8,
        );
        assert_eq!(position, (1552, 512));
    }

    #[test]
    fn supports_right_taskbar_and_negative_monitor_coordinates() {
        let position = calculate_panel_position(
            Bounds {
                x: -1920,
                y: 0,
                width: 1920,
                height: 1080,
            },
            Bounds {
                x: -1920,
                y: 0,
                width: 1870,
                height: 1080,
            },
            Bounds {
                x: -40,
                y: 700,
                width: 24,
                height: 24,
            },
            360,
            520,
            8,
        );
        assert_eq!(position, (-418, 452));
    }

    #[test]
    fn anchors_below_top_taskbar() {
        let position = calculate_panel_position(
            Bounds {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
            },
            Bounds {
                x: 0,
                y: 40,
                width: 1920,
                height: 1040,
            },
            Bounds {
                x: 100,
                y: 8,
                width: 24,
                height: 24,
            },
            360,
            460,
            8,
        );
        assert_eq!(position, (8, 48));
    }

    #[test]
    fn anchors_inside_left_taskbar() {
        let position = calculate_panel_position(
            Bounds {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
            },
            Bounds {
                x: 40,
                y: 0,
                width: 1880,
                height: 1080,
            },
            Bounds {
                x: 8,
                y: 900,
                width: 24,
                height: 24,
            },
            360,
            460,
            8,
        );
        assert_eq!(position, (48, 612));
    }
}
