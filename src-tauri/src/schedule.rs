use chrono::{DateTime, Local};
use rand::seq::SliceRandom;

pub const REMINDER_TEMPLATES: &[&str] = &[
    "该喝水啦，起来接杯水吧",
    "喝口水，顺便活动一下肩颈",
    "补充水分的时间到了",
    "休息一下眼睛，喝口水吧",
    "忙了一阵了，喝口水歇一歇",
    "起来走两步，顺便喝杯水",
    "水是身体的燃料，现在加个油",
    "抬头远眺二十秒，再喝一口水",
];

fn to_minutes(hhmm: &str) -> u32 {
    let mut parts = hhmm.split(':');
    let h: u32 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let m: u32 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    h.min(23) * 60 + m.min(59)
}

/// 定时日程的下一个触发时刻（本地时区，epoch ms）；一次性日程返回其绝对时刻
pub fn compute_schedule_at(
    time: &str,
    weekdays: &[u32],
    date: Option<&str>,
    now: DateTime<Local>,
) -> i64 {
    if let Some(d) = date {
        if let Ok(dt) =
            chrono::NaiveDateTime::parse_from_str(&format!("{d}T{time}:00"), "%Y-%m-%dT%H:%M:%S")
        {
            return dt
                .and_local_timezone(Local)
                .earliest()
                .map(|x| x.timestamp_millis())
                .unwrap_or(0);
        }
        return 0;
    }
    let mut parts = time.split(':');
    let h: u32 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let m: u32 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    for offset in 0..8 {
        let day = now.date_naive() + chrono::Duration::days(offset);
        if let Some(dt) = day.and_hms_opt(h, m, 0) {
            if let Some(local) = dt.and_local_timezone(Local).earliest() {
                let t = local.timestamp_millis();
                let wd = chrono::Datelike::weekday(&day).num_days_from_sunday();
                if t > now.timestamp_millis() && (weekdays.is_empty() || weekdays.contains(&wd)) {
                    return t;
                }
            }
        }
    }
    0
}

/// 锚点顺延：返回锚点后（严格晚于 from）的第 k 个整周期时刻
pub fn compute_anchored_next(anchor_at: i64, interval_ms: i64, from_ms: i64) -> i64 {
    if interval_ms <= 0 {
        return 0;
    }
    if anchor_at > from_ms {
        return anchor_at;
    }
    let k = (from_ms - anchor_at) / interval_ms + 1;
    anchor_at + k * interval_ms
}

/// 间隔抖动：±ratio 随机偏移；间隔 <10 分钟不抖动
pub fn apply_jitter(planned_at: i64, interval_ms: i64, ratio: f64) -> i64 {
    if interval_ms < 10 * 60_000 || ratio <= 0.0 {
        return planned_at;
    }
    let r: f64 = rand::random();
    let delta = interval_ms as f64 * ratio * (r * 2.0 - 1.0);
    (planned_at as f64 + delta).round() as i64
}

/// 安静时段判断（支持跨午夜区间）
pub fn in_quiet_hours(enabled: bool, start: &str, end: &str, now: DateTime<Local>) -> bool {
    if !enabled {
        return false;
    }
    let s = to_minutes(start);
    let e = to_minutes(end);
    if s == e {
        return false;
    }
    let cur = now.hour() * 60 + now.minute();
    if s < e {
        cur >= s && cur < e
    } else {
        cur >= s || cur < e
    }
}

/// 夜间时段（22:00-06:00）
pub fn is_night_time(now: DateTime<Local>) -> bool {
    let h = now.hour();
    h >= 22 || h < 6
}

use chrono::Timelike;

/// 从提醒项取文案：夜间优先 nightTexts，空池回退内置模板
pub fn pick_text(texts: &[String], night_texts: Option<&[String]>, now: DateTime<Local>) -> String {
    let pool: &[String] = if is_night_time(now) {
        night_texts.filter(|p| !p.is_empty()).unwrap_or(texts)
    } else {
        texts
    };
    if pool.is_empty() {
        return pick_template();
    }
    let mut rng = rand::thread_rng();
    pool.choose(&mut rng).cloned().unwrap_or_else(pick_template)
}

pub fn pick_template() -> String {
    let mut rng = rand::thread_rng();
    REMINDER_TEMPLATES
        .choose(&mut rng)
        .map(|s| s.to_string())
        .unwrap_or_default()
}

/// 逐级升级文案池：同一提醒连续贪睡后随机替换
pub const ESCALATION_TEXTS: &[&str] = &[
    "说好的喝水呢？",
    "上次说 5 分钟后，已经过去 15 分钟啦",
    "我一直飘着，你一直装看不见是吧",
    "别划走，就差你一个打卡",
    "再拖下去我要长在你屏幕上了",
];

pub fn pick_escalation() -> String {
    let mut rng = rand::thread_rng();
    ESCALATION_TEXTS
        .choose(&mut rng)
        .map(|s| s.to_string())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn at(h: u32, m: u32) -> DateTime<Local> {
        Local
            .with_ymd_and_hms(2026, 8, 15, h, m, 0)
            .earliest()
            .unwrap()
    }

    #[test]
    fn quiet_cross_midnight() {
        assert!(in_quiet_hours(true, "22:00", "08:00", at(23, 30)));
        assert!(in_quiet_hours(true, "22:00", "08:00", at(7, 59)));
        assert!(!in_quiet_hours(true, "22:00", "08:00", at(12, 0)));
        assert!(!in_quiet_hours(false, "22:00", "08:00", at(23, 30)));
    }

    #[test]
    fn anchored_next() {
        let anchor = 1_000_000;
        assert_eq!(compute_anchored_next(anchor, 60_000, 900_000), anchor);
        assert_eq!(
            compute_anchored_next(anchor, 60_000, anchor),
            anchor + 60_000
        );
        assert_eq!(
            compute_anchored_next(anchor, 60_000, anchor + 30_000),
            anchor + 60_000
        );
    }

    #[test]
    fn schedule_daily() {
        let t = compute_schedule_at("09:00", &[], None, at(12, 0));
        let d = DateTime::from_timestamp_millis(t).unwrap();
        assert_eq!(
            d.date_naive(),
            at(12, 0).date_naive() + chrono::Duration::days(1)
        );
    }
}
