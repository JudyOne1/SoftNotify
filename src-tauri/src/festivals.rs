use chrono::Datelike;

/// 节日名 → 祝福语（用 includes 匹配，兼容库返回名的细微差异）
const GREETINGS: [(&str, &str); 16] = [
    ("元旦", "元旦快乐"),
    ("除夕", "除夕快乐，阖家团圆"),
    ("春节", "新春快乐，万事如意"),
    ("元宵节", "元宵快乐"),
    ("情人节", "情人节快乐"),
    ("妇女节", "女神节快乐"),
    ("劳动节", "劳动节快乐"),
    ("青年节", "青年节快乐"),
    ("儿童节", "儿童节快乐"),
    ("端午节", "端午安康"),
    ("七夕", "七夕快乐"),
    ("中秋节", "中秋快乐"),
    ("国庆节", "国庆快乐"),
    ("重阳节", "重阳安康"),
    ("平安夜", "平安夜快乐"),
    ("圣诞节", "圣诞快乐"),
];

/// 今天是什么节日，返回祝福语；不是节日返回 None
pub fn festival_greeting(now: chrono::DateTime<chrono::Local>) -> Option<String> {
    let d = now.date_naive();
    let Ok(solar) = lunar_rs::Solar::from_ymd(d.year(), d.month() as i32, d.day() as i32) else {
        return None;
    };
    let Ok(lunar) = lunar_rs::Lunar::from_ymd(d.year(), d.month() as i32, d.day() as i32) else {
        return None;
    };
    let mut names: Vec<String> = Vec::new();
    if let Some(f) = solar.get_festival() {
        names.push(f.get_name());
    }
    if let Some(f) = lunar.get_festival() {
        names.push(f.get_name());
    }
    names.extend(solar.other_festivals().into_iter().map(|s| s.to_string()));
    names.extend(lunar.other_festivals().into_iter().map(|s| s.to_string()));
    for name in names {
        for (m, g) in GREETINGS {
            if name.contains(m) {
                return Some(g.to_string());
            }
        }
    }
    None
}
