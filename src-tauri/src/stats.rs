use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

const MAX_CHECKINS: usize = 5000;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Checkin {
    pub date: String,
    pub item_id: String,
    pub at: i64,
}

#[derive(Default)]
struct StatsFile {
    checkins: Vec<Checkin>,
    active_minutes: HashMap<String, u64>,
    celebrated: Vec<String>,
    focus_sessions: HashMap<String, u64>,
}

pub struct Stats {
    path: PathBuf,
    data: Mutex<StatsFile>,
}

pub fn today_str(now: chrono::NaiveDate) -> String {
    now.format("%Y-%m-%d").to_string()
}

fn today() -> String {
    today_str(chrono::Local::now().date_naive())
}

impl Stats {
    pub fn load(path: PathBuf) -> Self {
        let data = std::fs::read_to_string(&path)
            .ok()
            .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
            .map(|v| {
                let mut f = StatsFile::default();
                if let Some(list) = v.get("checkins").and_then(|c| c.as_array()) {
                    f.checkins = list
                        .iter()
                        .filter_map(|c| serde_json::from_value::<Checkin>(c.clone()).ok())
                        .collect();
                    if f.checkins.len() > MAX_CHECKINS {
                        f.checkins.drain(0..f.checkins.len() - MAX_CHECKINS);
                    }
                }
                if let Some(m) = v.get("activeMinutes").and_then(|m| m.as_object()) {
                    for (k, val) in m {
                        if let Some(n) = val.as_u64() {
                            f.active_minutes.insert(k.clone(), n);
                        }
                    }
                }
                if let Some(list) = v.get("celebrated").and_then(|c| c.as_array()) {
                    f.celebrated = list
                        .iter()
                        .filter_map(|c| c.as_str().map(|s| s.to_string()))
                        .collect();
                }
                if let Some(m) = v.get("focusSessions").and_then(|m| m.as_object()) {
                    for (k, val) in m {
                        if let Some(n) = val.as_u64() {
                            f.focus_sessions.insert(k.clone(), n);
                        }
                    }
                }
                f
            })
            .unwrap_or_default();
        Stats {
            path,
            data: Mutex::new(data),
        }
    }

    fn save(&self) {
        let d = self.data.lock().unwrap();
        let mut checkins = Vec::with_capacity(d.checkins.len());
        for c in &d.checkins {
            checkins.push(json!({ "date": c.date, "itemId": c.item_id, "at": c.at }));
        }
        let mut active = Map::new();
        for (k, v) in &d.active_minutes {
            active.insert(k.clone(), Value::from(*v));
        }
        let mut focus = Map::new();
        for (k, v) in &d.focus_sessions {
            focus.insert(k.clone(), Value::from(*v));
        }
        let value = json!({
            "checkins": checkins,
            "activeMinutes": active,
            "celebrated": d.celebrated,
            "focusSessions": focus,
        });
        if let Some(parent) = self.path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::write(
            &self.path,
            serde_json::to_string_pretty(&value).unwrap_or_default(),
        );
    }

    pub fn add_checkin(&self, item_id: &str) {
        let at = chrono::Local::now().timestamp_millis();
        {
            let mut d = self.data.lock().unwrap();
            d.checkins.push(Checkin {
                date: today(),
                item_id: item_id.to_string(),
                at,
            });
            if d.checkins.len() > MAX_CHECKINS {
                let n = d.checkins.len() - MAX_CHECKINS;
                d.checkins.drain(0..n);
            }
        }
        self.save();
    }

    pub fn today_checkin_count(&self) -> usize {
        let t = today();
        self.data
            .lock()
            .unwrap()
            .checkins
            .iter()
            .filter(|c| c.date == t)
            .count()
    }

    pub fn today_count_for(&self, item_id: &str) -> usize {
        let t = today();
        self.data
            .lock()
            .unwrap()
            .checkins
            .iter()
            .filter(|c| c.date == t && c.item_id == item_id)
            .count()
    }

    pub fn item_daily_counts(&self, item_id: &str) -> HashMap<String, u64> {
        let mut out = HashMap::new();
        for c in self.data.lock().unwrap().checkins.iter() {
            if c.item_id == item_id {
                *out.entry(c.date.clone()).or_insert(0) += 1;
            }
        }
        out
    }

    pub fn is_celebrated(&self, key: &str) -> bool {
        self.data
            .lock()
            .unwrap()
            .celebrated
            .iter()
            .any(|c| c == key)
    }

    pub fn mark_celebrated(&self, key: &str) {
        {
            let mut d = self.data.lock().unwrap();
            if !d.celebrated.iter().any(|c| c == key) {
                d.celebrated.push(key.to_string());
            }
        }
        self.save();
    }

    pub fn add_focus_session(&self) {
        {
            let mut d = self.data.lock().unwrap();
            *d.focus_sessions.entry(today()).or_insert(0) += 1;
        }
        self.save();
    }

    pub fn today_focus_count(&self) -> u64 {
        *self
            .data
            .lock()
            .unwrap()
            .focus_sessions
            .get(&today())
            .unwrap_or(&0)
    }

    /// 活跃时长采集：1 分钟内有过输入计 1 分钟（GetLastInputInfo）
    pub fn start_usage_tracking(self: &std::sync::Arc<Self>) {
        let stats = self.clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(std::time::Duration::from_secs(60));
            if idle_seconds() < 60 {
                {
                    let mut d = stats.data.lock().unwrap();
                    *d.active_minutes.entry(today()).or_insert(0) += 1;
                }
                stats.save();
            }
        });
    }

    /// 统计页数据，形状与 Electron 版 getStats 完全一致
    pub fn get_stats(&self, days: usize) -> Value {
        let d = self.data.lock().unwrap();
        let mut counts: HashMap<String, u64> = HashMap::new();
        for c in &d.checkins {
            *counts.entry(c.date.clone()).or_insert(0) += 1;
        }
        let mut checkins_per_day = Vec::with_capacity(days);
        let now = chrono::Local::now().date_naive();
        for i in (0..days).rev() {
            let date = now - chrono::Duration::days(i as i64);
            let key = today_str(date);
            checkins_per_day
                .push(json!({ "date": key, "count": counts.get(&key).copied().unwrap_or(0) }));
        }
        let t = today();
        let mut today_by_item: Map<String, Value> = Map::new();
        let mut today_total = 0u64;
        for c in &d.checkins {
            if c.date != t {
                continue;
            }
            let n = today_by_item
                .entry(c.item_id.clone())
                .or_insert(Value::from(0));
            *n = Value::from(n.as_u64().unwrap_or(0) + 1);
            today_total += 1;
        }
        let mut item_daily: Map<String, Value> = Map::new();
        for c in &d.checkins {
            let per = item_daily
                .entry(c.item_id.clone())
                .or_insert_with(|| Value::Object(Map::new()))
                .as_object_mut()
                .unwrap();
            let n = per.entry(c.date.clone()).or_insert(Value::from(0));
            *n = Value::from(n.as_u64().unwrap_or(0) + 1);
        }
        let mut active = Map::new();
        for (k, v) in &d.active_minutes {
            active.insert(k.clone(), Value::from(*v));
        }
        json!({
            "checkinsPerDay": checkins_per_day,
            "activeMinutes": active,
            "todayByItem": today_by_item,
            "todayTotal": today_total,
            "itemDaily": item_daily,
            "todayFocus": d.focus_sessions.get(&t).copied().unwrap_or(0),
        })
    }
}

/** 达成即是里程碑的天数档位 */
pub const STREAK_MILESTONES: [u64; 6] = [3, 7, 14, 30, 50, 100];

/** 连续达标天数；goal = 0 恒为 0。今天未达标不断签（算到昨天为止） */
pub fn compute_streak(daily: &HashMap<String, u64>, goal: u64) -> u64 {
    if goal == 0 {
        return 0;
    }
    let mut streak = 0u64;
    let mut cursor = chrono::Local::now().date_naive();
    if daily.get(&today_str(cursor)).copied().unwrap_or(0) < goal {
        cursor -= chrono::Duration::days(1);
    }
    while daily.get(&today_str(cursor)).copied().unwrap_or(0) >= goal {
        streak += 1;
        cursor -= chrono::Duration::days(1);
        if streak > 3650 {
            break;
        }
    }
    streak
}

#[cfg(target_os = "windows")]
fn idle_seconds() -> u32 {
    use std::mem::MaybeUninit;
    #[repr(C)]
    struct LastInputInfo {
        cb_size: u32,
        dw_time: u32,
    }
    extern "system" {
        fn GetLastInputInfo(plii: *mut LastInputInfo) -> i32;
        fn GetTickCount() -> u32;
    }
    unsafe {
        let mut lii = MaybeUninit::<LastInputInfo>::uninit();
        (*lii.as_mut_ptr()).cb_size = std::mem::size_of::<LastInputInfo>() as u32;
        if GetLastInputInfo(lii.as_mut_ptr()) == 0 {
            return u32::MAX;
        }
        let lii = lii.assume_init();
        GetTickCount().wrapping_sub(lii.dw_time) / 1000
    }
}

#[cfg(not(target_os = "windows"))]
fn idle_seconds() -> u32 {
    u32::MAX
}
