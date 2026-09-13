use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager};

/**
 * 会议状态：手动开关（托盘）+ 摄像头/麦克风占用自动检测（仅 Windows）。
 * 检测原理：轮询 CapabilityAccessManager ConsentStore 注册表，任一应用
 * LastUsedTimeStart > LastUsedTimeStop 即占用中（无需管理员）。
 * 检测失败（键不存在/新系统迁移存储）静默视为不在会议。
 */
static MANUAL: AtomicBool = AtomicBool::new(false);
static AUTO: AtomicBool = AtomicBool::new(false);

const REG_KEYS: [&str; 4] = [
    r"HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam\NonPackaged",
    r"HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone\NonPackaged",
    r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam\NonPackaged",
    r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone\NonPackaged",
];

pub fn is_meeting() -> bool {
    MANUAL.load(Ordering::Relaxed) || AUTO.load(Ordering::Relaxed)
}

pub fn is_manual_meeting() -> bool {
    MANUAL.load(Ordering::Relaxed)
}

pub fn set_manual_meeting(on: bool) {
    MANUAL.store(on, Ordering::Relaxed);
}

/** 解析 reg query /s 输出：任一子键 Start > Stop 即占用中 */
pub fn parse_in_use(output: &str) -> bool {
    let mut in_use = false;
    let mut start: u64 = u64::MAX;
    let mut stop: u64 = u64::MAX;
    let mut has_start = false;
    for line in output.lines() {
        if line.starts_with("HKEY_") {
            if has_start && start > stop {
                in_use = true;
            }
            start = u64::MAX;
            stop = u64::MAX;
            has_start = false;
            continue;
        }
        if let Some(hex) = find_qword(line, "LastUsedTimeStart") {
            start = hex;
            has_start = true;
            continue;
        }
        if let Some(hex) = find_qword(line, "LastUsedTimeStop") {
            stop = hex;
        }
    }
    if has_start && start > stop {
        in_use = true;
    }
    in_use
}

fn find_qword(line: &str, name: &str) -> Option<u64> {
    let idx = line.find(name)?;
    let rest = &line[idx + name.len()..];
    let rest = rest.trim_start();
    let rest = rest.strip_prefix("REG_QWORD")?;
    let hex = rest.split_whitespace().next()?;
    let hex = hex.trim();
    let hex = hex.strip_prefix("0x").or_else(|| hex.strip_prefix("0X"))?;
    u64::from_str_radix(hex, 16).ok()
}

fn probe_in_use() -> bool {
    REG_KEYS.iter().any(|key| {
        std::process::Command::new("reg")
            .args(["query", key, "/s"])
            .output()
            .map(|o| parse_in_use(&String::from_utf8_lossy(&o.stdout)))
            .unwrap_or(false)
    })
}

/** 轮询自动检测；配置关闭时复位。onChange 在状态变化时触发 */
pub fn start_polling(app: AppHandle, on_change: impl Fn() + Send + 'static) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(15));
        let detect = {
            let state = app.state::<crate::state::AppState>();
            let guard = state.store.lock().unwrap();
            guard.config.meeting_detect
        };
        if !detect {
            if AUTO.swap(false, Ordering::Relaxed) {
                on_change();
            }
            continue;
        }
        let in_use = probe_in_use();
        if AUTO.swap(in_use, Ordering::Relaxed) != in_use {
            on_change();
        }
    });
}

#[cfg(test)]
mod tests {
    use super::parse_in_use;

    #[test]
    fn detects_in_use() {
        let out = "HKEY_CURRENT_USER\\Software\\...\\webcam\\NonPackaged\\AppA\r\n    LastUsedTimeStart    REG_QWORD    0x1d00\r\n    LastUsedTimeStop    REG_QWORD    0x1000\r\n";
        assert!(parse_in_use(out));
    }

    #[test]
    fn detects_idle() {
        let out = "HKEY_CURRENT_USER\\...\\AppA\n    LastUsedTimeStart    REG_QWORD    0x1000\n    LastUsedTimeStop    REG_QWORD    0x1d00\n";
        assert!(!parse_in_use(out));
    }
}
