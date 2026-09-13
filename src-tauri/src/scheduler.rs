use std::collections::HashMap;
use std::sync::mpsc::{channel, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::Local;
use tauri::AppHandle;

use crate::config::{ReminderItem, ScheduleItem};
use crate::schedule::{apply_jitter, compute_anchored_next, compute_schedule_at};

#[derive(Clone, Copy, PartialEq)]
pub enum Source {
    Reminder,
    Schedule,
}

pub struct SyncData {
    pub reminders: Vec<ReminderItem>,
    pub schedules: Vec<ScheduleItem>,
}

pub enum Cmd {
    Sync(SyncData),
    ResetItem(String),
    SetMissedPolicy(String),
}

pub struct SchedulerHandle {
    tx: Sender<Cmd>,
}

impl SchedulerHandle {
    pub fn sync(&self, data: SyncData) {
        let _ = self.tx.send(Cmd::Sync(data));
    }
    pub fn reset_item(&self, item_id: &str) {
        let _ = self.tx.send(Cmd::ResetItem(item_id.to_string()));
    }
    pub fn set_missed_policy(&self, policy: &str) {
        let _ = self.tx.send(Cmd::SetMissedPolicy(policy.to_string()));
    }
}

fn now_ms() -> i64 {
    Local::now().timestamp_millis()
}

/// 双源调度（移植自 Electron 版 scheduler.ts）：
/// 单线程循环只对准最近一次触发，按 key+签名差量更新。
pub fn spawn(
    app: AppHandle,
    mirror: Arc<Mutex<HashMap<String, i64>>>,
    on_fire: impl Fn(Source, &str) + Send + 'static,
) -> SchedulerHandle {
    let (tx, rx) = channel::<Cmd>();
    std::thread::spawn(move || run_loop(app, rx, mirror, on_fire));
    SchedulerHandle { tx }
}

struct State {
    next_at: HashMap<String, i64>,
    sigs: HashMap<String, String>,
    intervals_ms: HashMap<String, i64>,
    anchors: HashMap<String, i64>,
    schedule_items: HashMap<String, ScheduleItem>,
    jitter_ratio: f64,
    /// 休眠错过提醒的策略：'fire' 唤醒后补发，'skip' 丢弃
    missed_policy: String,
}

impl State {
    fn new() -> Self {
        State {
            next_at: HashMap::new(),
            sigs: HashMap::new(),
            intervals_ms: HashMap::new(),
            anchors: HashMap::new(),
            schedule_items: HashMap::new(),
            jitter_ratio: 0.0,
            missed_policy: "fire".into(),
        }
    }

    fn next_interval_at(&self, interval_ms: i64, anchor_at: i64, now: i64) -> i64 {
        if anchor_at > 0 {
            compute_anchored_next(anchor_at, interval_ms, now)
        } else {
            apply_jitter(now + interval_ms, interval_ms, self.jitter_ratio)
        }
    }

    fn sync(&mut self, data: SyncData) {
        let mut desired: HashMap<String, String> = HashMap::new();
        for r in &data.reminders {
            if r.enabled {
                desired.insert(
                    format!("r:{}", r.id),
                    format!(
                        "{}|{}",
                        r.interval_seconds,
                        r.anchor_at.map(|a| a.to_string()).unwrap_or_default()
                    ),
                );
            }
        }
        for s in &data.schedules {
            if s.enabled {
                let mut wds = s.weekdays.clone();
                wds.sort();
                let wd_str = wds
                    .iter()
                    .map(|d| d.to_string())
                    .collect::<Vec<_>>()
                    .join(",");
                desired.insert(
                    format!("s:{}", s.id),
                    format!(
                        "{}|{}|{}",
                        s.time,
                        wd_str,
                        s.date.clone().unwrap_or_default()
                    ),
                );
            }
        }

        self.next_at
            .retain(|k, _| desired.get(k) == self.sigs.get(k));
        self.sigs = desired.clone();
        self.schedule_items.clear();
        self.anchors.clear();

        for s in &data.schedules {
            if s.enabled {
                self.schedule_items.insert(s.id.clone(), s.clone());
            }
        }
        for r in &data.reminders {
            if r.enabled {
                if let Some(a) = r.anchor_at {
                    self.anchors.insert(format!("r:{}", r.id), a as i64);
                }
            }
        }

        let now = now_ms();
        for r in &data.reminders {
            if !r.enabled {
                continue;
            }
            let key = format!("r:{}", r.id);
            if self.next_at.contains_key(&key) {
                continue;
            }
            let ms = r.interval_seconds as i64 * 1000;
            self.intervals_ms.insert(key.clone(), ms);
            let anchor = r.anchor_at.map(|a| a as i64).unwrap_or(0);
            self.next_at
                .insert(key, self.next_interval_at(ms, anchor, now));
        }
        for s in &data.schedules {
            if !s.enabled {
                continue;
            }
            let key = format!("s:{}", s.id);
            if self.next_at.contains_key(&key) {
                continue;
            }
            let at = compute_schedule_at(&s.time, &s.weekdays, s.date.as_deref(), Local::now());
            if at > now {
                self.next_at.insert(key, at);
            }
        }
    }

    fn earliest(&self) -> Option<i64> {
        self.next_at.values().min().copied()
    }

    fn earliest_key(&self) -> Option<String> {
        let at = self.earliest()?;
        self.next_at
            .iter()
            .find(|(_, t)| **t == at)
            .map(|(k, _)| k.clone())
    }

    fn fire(&mut self, key: &str) -> Option<(Source, String, i64)> {
        let fired_at = now_ms();
        if let Some(id) = key.strip_prefix("r:") {
            let ms = *self.intervals_ms.get(key)?;
            let anchor = self.anchors.get(key).copied().unwrap_or(0);
            let prev_planned = self.next_at.get(key).copied().unwrap_or(fired_at);
            let next = if anchor > 0 {
                compute_anchored_next(anchor, ms, prev_planned.min(fired_at))
            } else {
                self.next_interval_at(ms, 0, fired_at)
            };
            self.next_at.insert(key.to_string(), next);
            Some((Source::Reminder, id.to_string(), fired_at - prev_planned))
        } else if let Some(id) = key.strip_prefix("s:") {
            let item = self.schedule_items.get(id)?.clone();
            let prev_planned = self.next_at.get(key).copied().unwrap_or(fired_at);
            if item.date.is_some() {
                self.next_at.remove(key);
            } else {
                let next = compute_schedule_at(&item.time, &item.weekdays, None, Local::now());
                if next > fired_at {
                    self.next_at.insert(key.to_string(), next);
                } else {
                    self.next_at.remove(key);
                }
            }
            Some((Source::Schedule, id.to_string(), fired_at - prev_planned))
        } else {
            None
        }
    }

    fn reset_item(&mut self, item_id: &str) {
        let key = format!("r:{item_id}");
        if let (Some(ms), true) = (
            self.intervals_ms.get(&key).copied(),
            self.next_at.contains_key(&key),
        ) {
            let anchor = self.anchors.get(&key).copied().unwrap_or(0);
            self.next_at
                .insert(key, self.next_interval_at(ms, anchor, now_ms()));
        }
    }
}

fn run_loop(
    _app: AppHandle,
    rx: Receiver<Cmd>,
    mirror: Arc<Mutex<HashMap<String, i64>>>,
    on_fire: impl Fn(Source, &str) + Send,
) {
    let mut st = State::new();
    let apply_cmd = |st: &mut State, cmd: Cmd| match cmd {
        Cmd::Sync(data) => st.sync(data),
        Cmd::ResetItem(id) => st.reset_item(&id),
        Cmd::SetMissedPolicy(p) => st.missed_policy = p,
    };
    let push_mirror = |st: &State| {
        *mirror.lock().unwrap() = st.next_at.clone();
    };
    // skip 策略：休眠等导致迟到超过 90s 的触发丢弃（仍照常重排）
    let should_fire = |st: &State, overdue: i64| !(st.missed_policy == "skip" && overdue > 90_000);
    loop {
        let mut changed = false;
        while let Ok(cmd) = rx.try_recv() {
            apply_cmd(&mut st, cmd);
            changed = true;
        }
        if changed {
            push_mirror(&st);
        }
        let now = now_ms();
        match st.earliest() {
            None => match rx.recv() {
                Ok(cmd) => {
                    apply_cmd(&mut st, cmd);
                    push_mirror(&st);
                }
                Err(_) => break,
            },
            Some(at) if at <= now => {
                if let Some(key) = st.earliest_key() {
                    if let Some((source, id, overdue)) = st.fire(&key) {
                        push_mirror(&st);
                        if should_fire(&st, overdue) {
                            on_fire(source, &id);
                        }
                    }
                }
            }
            Some(at) => {
                let wait = Duration::from_millis((at - now) as u64);
                match rx.recv_timeout(wait) {
                    Ok(cmd) => {
                        apply_cmd(&mut st, cmd);
                        push_mirror(&st);
                    }
                    Err(RecvTimeoutError::Timeout) => {
                        if let Some(key) = st.earliest_key() {
                            if let Some((source, id, overdue)) = st.fire(&key) {
                                push_mirror(&st);
                                if should_fire(&st, overdue) {
                                    on_fire(source, &id);
                                }
                            }
                        }
                    }
                    Err(RecvTimeoutError::Disconnected) => break,
                }
            }
        }
    }
}
