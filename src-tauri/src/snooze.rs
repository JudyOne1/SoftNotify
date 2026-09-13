use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

const SNOOZE_MS: u64 = 5 * 60_000;

fn reg() -> &'static Mutex<HashMap<String, u32>> {
    static REG: OnceLock<Mutex<HashMap<String, u32>>> = OnceLock::new();
    REG.get_or_init(|| Mutex::new(HashMap::new()))
}

/** 同一项重复贪睡：代际计数使旧在途计时失效，只保留最新一次 */
pub fn snooze_item(item_id: &str, fire: impl Fn(String, u32) + Send + 'static) {
    let count = {
        let mut m = reg().lock().unwrap();
        let c = m.get(item_id).copied().unwrap_or(0) + 1;
        m.insert(item_id.to_string(), c);
        c
    };
    let id = item_id.to_string();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(SNOOZE_MS));
        let current = reg().lock().unwrap().get(&id).copied();
        if current == Some(count) {
            reg().lock().unwrap().remove(&id);
            fire(id, count);
        }
    });
}

/** 打卡完成 → 清零升级计数，在途贪睡随之失效 */
pub fn reset(item_id: &str) {
    reg().lock().unwrap().remove(item_id);
}
