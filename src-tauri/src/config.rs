use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

pub const MAX_REMINDERS: usize = 20;
pub const MAX_SCHEDULES: usize = 20;
pub const MAX_PROFILES: usize = 10;

const SOUND_PRESETS: &[&str] = &[
    "classic",
    "windchime",
    "water",
    "knock",
    "musicbox",
    "marimba",
    "kalimba",
    "dingdong",
    "bell",
    "crystal",
    "birds",
    "bubble",
    "zen",
    "harp",
    "sparkle",
    "flute",
];

fn default_true() -> bool {
    true
}
fn default_name() -> String {
    "提醒".into()
}
fn default_interval() -> u64 {
    3600
}
fn default_volume() -> f64 {
    0.7
}
fn default_quiet_start() -> String {
    "22:00".into()
}
fn default_quiet_end() -> String {
    "08:00".into()
}
fn default_theme() -> String {
    "sky".into()
}
fn default_speed_seconds() -> f64 {
    11.0
}
fn default_missed_policy() -> String {
    "fire".into()
}
fn default_display_mode() -> String {
    "all".into()
}
fn default_danmaku_zone() -> String {
    "full".into()
}
fn default_zone_end() -> u32 {
    30
}
fn default_theme_mode() -> String {
    "system".into()
}
fn default_audio_mode() -> String {
    "synth".into()
}
fn default_sound_preset() -> String {
    "classic".into()
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Danmaku {
    #[serde(default = "default_true_f")]
    pub opacity: f64,
    #[serde(default = "default_font_scale")]
    pub font_scale: f64,
    #[serde(default = "default_true")]
    pub stroke: bool,
    /// 是否使用半透明胶囊样式；旧配置缺失时默认开启。
    #[serde(default = "default_true")]
    pub capsule: bool,
}
fn default_true_f() -> f64 {
    1.0
}
fn default_font_scale() -> f64 {
    1.0
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReminderItem {
    #[serde(default)]
    pub id: String,
    #[serde(default = "default_name")]
    pub name: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_interval")]
    pub interval_seconds: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub anchor_at: Option<u64>,
    #[serde(default)]
    pub texts: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub night_texts: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub daily_goal: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sound_preset: Option<String>,
    #[serde(default)]
    pub strict: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleItem {
    #[serde(default)]
    pub id: String,
    #[serde(default = "default_name")]
    pub name: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_quiet_start")]
    pub time: String,
    #[serde(default)]
    pub weekdays: Vec<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
    #[serde(default)]
    pub texts: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub night_texts: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub daily_goal: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sound_preset: Option<String>,
    #[serde(default)]
    pub ignore_quiet: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub item_ids: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SettingsWindow {
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(default = "default_reminders")]
    pub reminders: Vec<ReminderItem>,
    #[serde(default)]
    pub schedules: Vec<ScheduleItem>,
    #[serde(default)]
    pub profiles: Vec<Profile>,
    #[serde(default)]
    pub active_profile: Option<String>,
    #[serde(default = "default_true")]
    pub sound_enabled: bool,
    #[serde(default = "default_volume")]
    pub volume: f64,
    #[serde(default = "default_true")]
    pub autostart: bool,
    #[serde(default)]
    pub paused: bool,
    /// 临时暂停截止时间（Unix 毫秒）；到期后自动恢复。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paused_until: Option<i64>,
    #[serde(default = "default_true")]
    pub quiet_enabled: bool,
    #[serde(default = "default_quiet_start")]
    pub quiet_start: String,
    #[serde(default = "default_quiet_end")]
    pub quiet_end: String,
    #[serde(default)]
    pub meeting_detect: bool,
    #[serde(default = "default_true")]
    pub fullscreen_detect: bool,
    #[serde(default)]
    pub pomodoro_auto_loop: bool,
    #[serde(default = "default_missed_policy")]
    pub missed_policy: String,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_speed_seconds")]
    pub speed_seconds: f64,
    /// 旧版速度档位，仅用于迁移旧配置；迁移后清除且不序列化
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speed: Option<String>,
    #[serde(default = "default_danmaku")]
    pub danmaku: Danmaku,
    #[serde(default = "default_true")]
    pub festival_enabled: bool,
    #[serde(default)]
    pub high_priority_notify: bool,
    #[serde(default = "default_true")]
    pub hover_interaction: bool,
    #[serde(default = "default_true")]
    pub escalate_enabled: bool,
    #[serde(default = "default_display_mode")]
    pub display_mode: String,
    #[serde(default)]
    pub custom_displays: Vec<u32>,
    #[serde(default = "default_danmaku_zone")]
    pub danmaku_zone: String,
    #[serde(default)]
    pub zone_start: u32,
    #[serde(default = "default_zone_end")]
    pub zone_end: u32,
    #[serde(default = "default_theme_mode")]
    pub theme_mode: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settings_window: Option<SettingsWindow>,
    #[serde(default = "default_audio_mode")]
    pub audio_mode: String,
    #[serde(default)]
    pub audio_file_name: String,
    #[serde(default = "default_sound_preset")]
    pub sound_preset: String,
}

fn default_reminders() -> Vec<ReminderItem> {
    vec![ReminderItem {
        id: "water".into(),
        name: "喝水".into(),
        enabled: true,
        interval_seconds: 3600,
        anchor_at: None,
        texts: vec![],
        night_texts: None,
        daily_goal: None,
        priority: None,
        sound_preset: None,
        strict: false,
    }]
}
fn default_danmaku() -> Danmaku {
    Danmaku {
        opacity: 1.0,
        font_scale: 1.0,
        stroke: true,
        capsule: true,
    }
}

impl Default for Config {
    fn default() -> Self {
        serde_json::from_value(Value::Object(Default::default())).unwrap()
    }
}

impl Config {
    /// 字段清洗，与 Electron 版 store.ts 的 normalize/update 对齐
    pub fn normalize(&mut self) {
        self.reminders.truncate(MAX_REMINDERS);
        let mut seen = std::collections::HashSet::new();
        for r in &mut self.reminders {
            clean_common(
                &mut r.id,
                &mut r.name,
                &mut r.texts,
                &mut r.night_texts,
                &mut r.daily_goal,
                &mut r.priority,
                &mut r.sound_preset,
                &mut seen,
            );
            r.interval_seconds = r.interval_seconds.clamp(5, 7 * 86_400);
        }
        self.schedules.truncate(MAX_SCHEDULES);
        for s in &mut self.schedules {
            clean_common(
                &mut s.id,
                &mut s.name,
                &mut s.texts,
                &mut s.night_texts,
                &mut s.daily_goal,
                &mut s.priority,
                &mut s.sound_preset,
                &mut seen,
            );
            s.time = clean_time(&s.time);
            s.weekdays.retain(|d| *d <= 6);
            s.weekdays.sort();
            s.weekdays.dedup();
            if let Some(d) = &s.date {
                if !is_valid_date(d) {
                    s.date = None;
                }
            }
        }
        self.profiles.truncate(MAX_PROFILES);
        for p in &mut self.profiles {
            if p.id.is_empty() {
                p.id = unique_id(&mut seen);
            }
            seen.insert(p.id.clone());
            p.name = p.name.trim().chars().take(20).collect();
            if p.name.is_empty() {
                p.name = "模式".into();
            }
            p.item_ids
                .retain(|v| v.starts_with("r:") || v.starts_with("s:"));
            p.item_ids.truncate(40);
        }
        if let Some(s) = self.speed.take() {
            // 旧档位一次性迁移：slow→17s / normal→11s / fast→7s
            self.speed_seconds = match s.as_str() {
                "slow" => 17.0,
                "fast" => 7.0,
                _ => 11.0,
            };
        }
        self.speed_seconds = self.speed_seconds.clamp(3.0, 30.0);
        self.volume = self.volume.clamp(0.0, 1.0);
        if self
            .paused_until
            .is_some_and(|until| until <= chrono::Local::now().timestamp_millis())
        {
            self.paused_until = None;
        }
        self.quiet_start = clean_time(&self.quiet_start);
        self.quiet_end = clean_time(&self.quiet_end);
        self.danmaku.opacity = self.danmaku.opacity.clamp(0.3, 1.0);
        self.danmaku.font_scale = self.danmaku.font_scale.clamp(0.8, 1.6);
        if !["all", "primary", "custom"].contains(&self.display_mode.as_str()) {
            self.display_mode = "all".into();
        }
        self.custom_displays.retain(|d| *d < 8);
        self.custom_displays.sort();
        self.custom_displays.dedup();
        if !["full", "top-half", "top-30", "custom"].contains(&self.danmaku_zone.as_str()) {
            self.danmaku_zone = "full".into();
        }
        self.zone_start = self.zone_start.clamp(0, 80);
        self.zone_end = self.zone_end.clamp(20, 100);
        if !["system", "light", "dark"].contains(&self.theme_mode.as_str()) {
            self.theme_mode = "system".into();
        }
        if self.audio_mode != "file" {
            self.audio_mode = "synth".into();
        }
        if !self
            .audio_file_name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '.' || c == '-')
        {
            self.audio_file_name.clear();
        }
        if !SOUND_PRESETS.contains(&self.sound_preset.as_str()) {
            self.sound_preset = "classic".into();
        }
        if !["fire", "skip"].contains(&self.missed_policy.as_str()) {
            self.missed_policy = "fire".into();
        }
    }

    pub fn find_item(&self, item_id: &str) -> Option<ItemRef<'_>> {
        if let Some(r) = self.reminders.iter().find(|r| r.id == item_id) {
            return Some(ItemRef::Reminder(r));
        }
        if let Some(s) = self.schedules.iter().find(|s| s.id == item_id) {
            return Some(ItemRef::Schedule(s));
        }
        None
    }
}

pub enum ItemRef<'a> {
    Reminder(&'a ReminderItem),
    Schedule(&'a ScheduleItem),
}

impl ItemRef<'_> {
    pub fn texts(
        &self,
    ) -> (
        &[String],
        Option<&[String]>,
        Option<&str>,
        Option<&str>,
        bool,
    ) {
        match self {
            ItemRef::Reminder(r) => (
                &r.texts,
                r.night_texts.as_deref(),
                r.priority.as_deref(),
                r.sound_preset.as_deref(),
                r.strict,
            ),
            ItemRef::Schedule(s) => (
                &s.texts,
                s.night_texts.as_deref(),
                s.priority.as_deref(),
                s.sound_preset.as_deref(),
                false,
            ),
        }
    }
    pub fn name(&self) -> &str {
        match self {
            ItemRef::Reminder(r) => &r.name,
            ItemRef::Schedule(s) => &s.name,
        }
    }
    pub fn ignore_quiet(&self) -> bool {
        matches!(self, ItemRef::Schedule(s) if s.ignore_quiet)
    }
    pub fn daily_goal(&self) -> Option<u32> {
        match self {
            ItemRef::Reminder(r) => r.daily_goal,
            ItemRef::Schedule(s) => s.daily_goal,
        }
    }
}

fn unique_id(seen: &mut std::collections::HashSet<String>) -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    loop {
        let id = format!(
            "r-{}-{}",
            chrono::Local::now().timestamp_millis(),
            rng.gen_range(100_000..999_999)
        );
        if !seen.contains(&id) {
            seen.insert(id.clone());
            return id;
        }
    }
}

fn clean_common(
    id: &mut String,
    name: &mut String,
    texts: &mut Vec<String>,
    night_texts: &mut Option<Vec<String>>,
    daily_goal: &mut Option<u32>,
    priority: &mut Option<String>,
    sound_preset: &mut Option<String>,
    seen: &mut std::collections::HashSet<String>,
) {
    if id.is_empty() || seen.contains(id) {
        *id = unique_id(seen);
    } else {
        seen.insert(id.clone());
    }
    *name = name.trim().chars().take(20).collect();
    if name.is_empty() {
        *name = "提醒".into();
    }
    clean_texts(texts, 20);
    if let Some(nt) = night_texts {
        clean_texts(nt, 10);
        if nt.is_empty() {
            *night_texts = None;
        }
    }
    if let Some(g) = daily_goal {
        if *g < 1 {
            *daily_goal = None;
        } else {
            *g = (*g).min(99);
        }
    }
    if priority.as_deref() != Some("high") {
        *priority = None;
    }
    if !sound_preset
        .as_deref()
        .map_or(false, |p| SOUND_PRESETS.contains(&p))
    {
        *sound_preset = None;
    }
}

fn clean_texts(texts: &mut Vec<String>, max: usize) {
    let mut out: Vec<String> = Vec::new();
    for t in texts.iter().take(max) {
        let v: String = t.trim().chars().take(100).collect();
        if !v.is_empty() && !out.contains(&v) {
            out.push(v);
        }
    }
    *texts = out;
}

fn clean_time(value: &str) -> String {
    let mut parts = value.split(':');
    let (h, m) = (parts.next(), parts.next());
    match (
        h.and_then(|s| s.parse::<u32>().ok()),
        m.and_then(|s| s.parse::<u32>().ok()),
    ) {
        (Some(h), Some(m)) if h < 24 && m < 60 && value.len() == 5 => value.to_string(),
        _ => "09:00".into(),
    }
}

fn is_valid_date(d: &str) -> bool {
    chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").is_ok()
}

pub struct Store {
    path: PathBuf,
    pub config: Config,
    pub fresh: bool,
    pub corrupted: bool,
}

impl Store {
    pub fn load(data_dir: &Path) -> Self {
        let path = data_dir.join("config.json");
        match fs::read_to_string(&path) {
            Ok(text) => {
                let mut corrupted = false;
                let config: Config = serde_json::from_str(&text).unwrap_or_else(|_| {
                    // 损坏自愈：备份现场，以默认值启动
                    let bak = path.with_extension(format!(
                        "json.bak-{}",
                        chrono::Local::now().timestamp_millis()
                    ));
                    let _ = fs::rename(&path, &bak);
                    corrupted = true;
                    Config::default()
                });
                let mut config = config;
                config.normalize();
                Store {
                    path,
                    config,
                    fresh: false,
                    corrupted,
                }
            }
            Err(_) => {
                let config = Config::default();
                Store {
                    path,
                    config,
                    fresh: true,
                    corrupted: false,
                }
            }
        }
    }

    pub fn save(&self) {
        if let Some(dir) = self.path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        if let Ok(text) = serde_json::to_string_pretty(&self.config) {
            let _ = fs::write(&self.path, text);
        }
    }

    /// 顶层键浅合并 + 清洗 + 落盘（与 Electron updateConfig 对齐）
    pub fn apply_patch(&mut self, patch: Value) {
        let mut current =
            serde_json::to_value(&self.config).unwrap_or(Value::Object(Default::default()));
        if let (Some(base), Some(p)) = (current.as_object_mut(), patch.as_object()) {
            for (k, v) in p {
                base.insert(k.clone(), v.clone());
            }
        }
        let mut next: Config =
            serde_json::from_value(current).unwrap_or_else(|_| Config::default());
        next.normalize();
        self.config = next;
        self.save();
    }
}

#[cfg(test)]
mod tests {
    use super::Config;

    #[test]
    fn clears_expired_temporary_pause() {
        let mut config = Config::default();
        config.paused_until = Some(chrono::Local::now().timestamp_millis() - 1);
        config.normalize();
        assert_eq!(config.paused_until, None);
    }

    #[test]
    fn keeps_active_temporary_pause() {
        let until = chrono::Local::now().timestamp_millis() + 60_000;
        let mut config = Config::default();
        config.paused_until = Some(until);
        config.normalize();
        assert_eq!(config.paused_until, Some(until));
    }
}
