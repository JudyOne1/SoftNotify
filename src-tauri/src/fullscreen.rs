use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager};

/**
 * 全屏免打扰：前台窗口矩形铺满任一显示器（≥98%）即视为全屏（观影/游戏）。
 * DPI：GetWindowRect 返回物理像素，monitor.position/size 同为物理像素，
 * 但前台窗口矩形在 PerMonitorV2 进程下对其它 DPI 的显示器也是物理口径，
 * 为稳妥仍按 1x 与 scaleFactor 两档比例匹配（与 Electron 版一致）。
 */
static FULLSCREEN: AtomicBool = AtomicBool::new(false);

pub fn is_fullscreen_app() -> bool {
    FULLSCREEN.load(Ordering::Relaxed)
}

#[cfg(target_os = "windows")]
mod win {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    #[repr(C)]
    pub struct Rect {
        pub left: i32,
        pub top: i32,
        pub right: i32,
        pub bottom: i32,
    }

    extern "system" {
        pub fn GetForegroundWindow() -> isize;
        pub fn GetWindowRect(hwnd: isize, rect: *mut Rect) -> i32;
        pub fn GetWindowThreadProcessId(hwnd: isize, process_id: *mut u32) -> u32;
        pub fn GetClassNameW(hwnd: isize, class: *mut u16, max: i32) -> i32;
        pub fn GetCurrentProcessId() -> u32;
    }

    pub fn class_name(hwnd: isize) -> String {
        let mut buf = vec![0u16; 256];
        let n = unsafe { GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32) };
        if n <= 0 {
            return String::new();
        }
        OsString::from_wide(&buf[..n as usize])
            .to_string_lossy()
            .into_owned()
    }

    pub fn foreground() -> Option<(isize, u32, String, Rect)> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd == 0 {
                return None;
            }
            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, &mut pid);
            let mut rect = Rect {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
            };
            if GetWindowRect(hwnd, &mut rect) == 0 {
                return None;
            }
            Some((hwnd, pid, class_name(hwnd), rect))
        }
    }
}

#[cfg(target_os = "windows")]
fn covers_display(b: &win::Rect, x: f64, y: f64, w: f64, h: f64, scale: f64) -> bool {
    let cx = b.left as f64 + (b.right - b.left) as f64 / 2.0;
    let cy = b.top as f64 + (b.bottom - b.top) as f64 / 2.0;
    if !(cx >= x && cx <= x + w && cy >= y && cy <= y + h) {
        return false;
    }
    let bw = (b.right - b.left) as f64;
    let bh = (b.bottom - b.top) as f64;
    [1.0, scale]
        .into_iter()
        .any(|s| (bw - w * s).abs() <= w * s * 0.02 && (bh - h * s).abs() <= h * s * 0.02)
}

fn probe(app: &AppHandle) -> bool {
    #[cfg(target_os = "windows")]
    {
        let Some((_hwnd, pid, class, rect)) = win::foreground() else {
            return false;
        };
        // 桌面/任务栏/自身窗口不算全屏应用
        if pid == unsafe { win::GetCurrentProcessId() } {
            return false;
        }
        if [
            "Progman",
            "WorkerW",
            "Shell_TrayWnd",
            "Shell_InputCanvasTopLevelWindowClass",
        ]
        .contains(&class.as_str())
        {
            return false;
        }
        if let Ok(monitors) = app.available_monitors() {
            return monitors.iter().any(|m| {
                let p = m.position();
                let s = m.size();
                covers_display(
                    &rect,
                    p.x as f64,
                    p.y as f64,
                    s.width as f64,
                    s.height as f64,
                    m.scale_factor(),
                )
            });
        }
        false
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        false
    }
}

/** 3s 轮询；配置关闭时复位。onChange 在状态变化时触发 */
pub fn start_polling(app: AppHandle, on_change: impl Fn() + Send + 'static) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(3));
        let detect = {
            let state = app.state::<crate::state::AppState>();
            let guard = state.store.lock().unwrap();
            guard.config.fullscreen_detect
        };
        if !detect {
            if FULLSCREEN.swap(false, Ordering::Relaxed) {
                on_change();
            }
            continue;
        }
        let fs = probe(&app);
        if FULLSCREEN.swap(fs, Ordering::Relaxed) != fs {
            on_change();
        }
    });
}
