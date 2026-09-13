#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod commands;
mod config;
mod festivals;
mod fullscreen;
mod history;
mod meeting;
mod overlay;
mod pomodoro;
mod remind;
mod schedule;
mod scheduler;
mod settings;
mod snooze;
mod state;
mod stats;
mod tray;

use std::sync::Mutex;
use tauri::{Emitter, Manager, State};

use pomodoro::{PomodoroEvent, PomodoroHandle};
use scheduler::Source;
use state::AppState;

/// 配置变更后的统一收尾：同步调度器 + 广播前端 + 刷新托盘
pub fn apply_config_change(app: &tauri::AppHandle) {
    let state: State<AppState> = app.state();
    let (reminders, schedules, cfg) = {
        let st = state.store.lock().unwrap();
        (st.config.reminders.clone(), st.config.schedules.clone(), st.config.clone())
    };
    if let Some(s) = state.scheduler.lock().unwrap().as_ref() {
        s.sync(scheduler::SyncData { reminders, schedules });
        s.set_missed_policy(&cfg.missed_policy);
    }
    state.pomodoro.set_auto_loop(cfg.pomodoro_auto_loop);
    apply_autostart(app, cfg.autostart);
    drop(state);
    let _ = app.emit("config:changed", cfg);
    tray::refresh_tray(app);
}

/// 开机自启（移植自 Electron autostart.ts 的 setLoginItemSettings）
fn apply_autostart(app: &tauri::AppHandle, enable: bool) {
    use tauri_plugin_autostart::ManagerExt;
    let m = app.autolaunch();
    let enabled = m.is_enabled().unwrap_or(false);
    if enable && !enabled {
        let _ = m.enable();
    } else if !enable && enabled {
        let _ = m.disable();
    }
}

/// 临时暂停到期后清理状态并刷新所有窗口与托盘。
fn start_temporary_pause_watcher(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(1));
        let state: State<AppState> = app.state();
        let expired = {
            let mut store = state.store.lock().unwrap();
            let expired = store
                .config
                .paused_until
                .is_some_and(|until| until <= chrono::Local::now().timestamp_millis());
            if expired {
                store.config.paused_until = None;
                store.save();
            }
            expired
        };
        drop(state);
        if expired {
            apply_config_change(&app);
        }
    });
}

/** 一次性日程过期后自动停用（含应用关闭期间错过的） */
fn expire_once_schedules(app: &tauri::AppHandle) {
    let state: State<AppState> = app.state();
    let now = chrono::Local::now();
    let changed = {
        let mut store = state.store.lock().unwrap();
        let mut changed = false;
        for s in store.config.schedules.iter_mut() {
            if let Some(date) = &s.date {
                if s.enabled {
                    if let Ok(d) = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d") {
                        let at = d.and_time(
                            chrono::NaiveTime::parse_from_str(&format!("{}:00", &s.time), "%H:%M:%S")
                                .unwrap_or(chrono::NaiveTime::MIN),
                        );
                        if at <= now.naive_local() {
                            s.enabled = false;
                            changed = true;
                        }
                    }
                }
            }
        }
        if changed {
            store.save();
        }
        changed
    };
    if changed {
        drop(state);
        apply_config_change(app);
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .invoke_handler(tauri::generate_handler![
            commands::config_get,
            commands::config_set,
            commands::notify_test,
            commands::remind_next,
            commands::app_version,
            commands::ui_env,
            commands::displays_list,
            commands::open_external,
            commands::audio_choose,
            commands::history_get,
            commands::checkin,
            commands::snooze,
            commands::stats_get,
            commands::tray_panel_state,
            commands::open_main_window,
            commands::stats_export,
            commands::pomodoro_start,
            commands::pomodoro_stop,
            commands::pomodoro_state,
            commands::profile_apply,
            commands::profile_save,
            commands::profile_update_items,
            commands::update_check
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let data_dir = app.path().app_data_dir()?;
            let store = config::Store::load(&data_dir);
            let fresh = store.fresh;
            let corrupted = store.corrupted;
            let auto_loop = store.config.pomodoro_auto_loop;

            let stats = std::sync::Arc::new(stats::Stats::load(data_dir.join("stats.json")));
            let history = std::sync::Arc::new(history::History::load(data_dir.join("history.json")));

            // 番茄钟：结束/休息通知豁免静默，直接广播
            let pomo_app = handle.clone();
            let pomodoro = PomodoroHandle::spawn(auto_loop, move |ev| {
                let state: State<AppState> = pomo_app.state();
                let cfg = state.store.lock().unwrap().config.clone();
                match ev {
                    PomodoroEvent::FocusEnd(mins) => {
                        state.stats.add_focus_session();
                        crate::remind::send_direct(
                            &pomo_app,
                            &format!("🍅 专注 {mins} 分钟完成！休息 5 分钟，起来走走"),
                            cfg.sound_enabled,
                            cfg.volume,
                        );
                        state.history.add(history::HistoryEntry {
                            text: format!("🍅 专注 {mins} 分钟完成"),
                            name: None,
                            at: chrono::Local::now().timestamp_millis(),
                            result: Some("direct".into()),
                        });
                    }
                    PomodoroEvent::BreakEnd => {
                        crate::remind::send_direct(&pomo_app, "休息结束，继续加油！", cfg.sound_enabled, cfg.volume);
                        state.history.add(history::HistoryEntry {
                            text: "休息结束".into(),
                            name: None,
                            at: chrono::Local::now().timestamp_millis(),
                            result: Some("direct".into()),
                        });
                    }
                }
                drop(state);
                tray::refresh_tray(&pomo_app);
            });

            app.manage(AppState {
                store: Mutex::new(store),
                scheduler: Mutex::new(None),
                next_mirror: Default::default(),
                stats,
                history,
                pomodoro,
                festival_shown_on: Mutex::new(String::new()),
            });

            expire_once_schedules(&handle);
            overlay::register_ui_rects_listener(&handle);
            overlay::register_overlay_ready_listener(&handle);
            overlay::create_overlays(&handle);
            overlay::start_hover_polling(&handle);
            tray::create_tray(&handle)?;

            let state: State<AppState> = app.state();
            let fire_app = handle.clone();
            let sched = scheduler::spawn(
                handle.clone(),
                state.next_mirror.clone(),
                move |source, id| {
                    remind::remind_by_id(&fire_app, id, false);
                    // 一次性日程触发后自动停用
                    if source == Source::Schedule {
                        let st: State<AppState> = fire_app.state();
                        let should_disable = {
                            let store = st.store.lock().unwrap();
                            store.config.schedules.iter().any(|s| s.id == id && s.date.is_some() && s.enabled)
                        };
                        if should_disable {
                            {
                                let mut store = st.store.lock().unwrap();
                                if let Some(s) = store.config.schedules.iter_mut().find(|s| s.id == id) {
                                    s.enabled = false;
                                }
                                store.save();
                            }
                            drop(st);
                            crate::apply_config_change(&fire_app);
                        }
                    }
                },
            );
            *state.scheduler.lock().unwrap() = Some(sched);
            let usage_stats = state.stats.clone();
            drop(state);
            usage_stats.start_usage_tracking();

            // 会议/全屏免打扰检测：状态变化只影响提醒静默与托盘展示
            let tray_app = handle.clone();
            meeting::start_polling(handle.clone(), move || tray::refresh_tray(&tray_app));
            let tray_app2 = handle.clone();
            fullscreen::start_polling(handle.clone(), move || tray::refresh_tray(&tray_app2));
            start_temporary_pause_watcher(handle.clone());

            apply_config_change(&handle);

            if corrupted {
                let msg_app = handle.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(2500));
                    remind::send_direct(&msg_app, "配置文件损坏，已自动重置（旧文件保留为 .bak）", false, 0.0);
                });
            }
            if fresh {
                settings::open_welcome(&handle);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SoftNotify");
}
