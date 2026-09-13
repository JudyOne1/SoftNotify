use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::Duration;

const BREAK_MS: i64 = 5 * 60_000;

#[derive(Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Focus,
    Break,
}

use serde::Serialize;

#[derive(Default)]
struct Inner {
    phase: Option<Phase>,
    ends_at: i64,
    focus_minutes: u32,
    auto_loop: bool,
}

enum Cmd {
    Start(u32),
    Stop,
    SetAutoLoop(bool),
}

pub struct PomodoroHandle {
    tx: mpsc::Sender<Cmd>,
    inner: Arc<Mutex<Inner>>,
}

pub enum PomodoroEvent {
    FocusEnd(u32),
    BreakEnd,
}

impl PomodoroHandle {
    pub fn spawn(auto_loop: bool, on_event: impl Fn(PomodoroEvent) + Send + 'static) -> Self {
        let (tx, rx) = mpsc::channel::<Cmd>();
        let inner = Arc::new(Mutex::new(Inner {
            auto_loop,
            ..Default::default()
        }));
        let state = inner.clone();
        std::thread::spawn(move || {
            let on_event = Arc::new(on_event);
            loop {
                let timeout = {
                    let s = state.lock().unwrap();
                    s.phase.map(|_| (s.ends_at - now_ms()).max(0))
                };
                let cmd = match timeout {
                    Some(ms) => rx.recv_timeout(Duration::from_millis(ms as u64)),
                    None => rx.recv().map_err(|_| mpsc::RecvTimeoutError::Disconnected),
                };
                match cmd {
                    Ok(Cmd::Start(mins)) => {
                        let mut s = state.lock().unwrap();
                        s.phase = Some(Phase::Focus);
                        s.focus_minutes = mins;
                        s.ends_at = now_ms() + mins as i64 * 60_000;
                    }
                    Ok(Cmd::Stop) => {
                        let mut s = state.lock().unwrap();
                        s.phase = None;
                        s.ends_at = 0;
                    }
                    Ok(Cmd::SetAutoLoop(v)) => {
                        state.lock().unwrap().auto_loop = v;
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        let event = {
                            let mut s = state.lock().unwrap();
                            match s.phase {
                                Some(Phase::Focus) => {
                                    s.phase = Some(Phase::Break);
                                    s.ends_at = now_ms() + BREAK_MS;
                                    Some(PomodoroEvent::FocusEnd(s.focus_minutes))
                                }
                                Some(Phase::Break) => {
                                    if s.auto_loop {
                                        s.phase = Some(Phase::Focus);
                                        s.ends_at = now_ms() + s.focus_minutes as i64 * 60_000;
                                    } else {
                                        s.phase = None;
                                        s.ends_at = 0;
                                    }
                                    Some(PomodoroEvent::BreakEnd)
                                }
                                None => None,
                            }
                        };
                        if let Some(e) = event {
                            on_event(e);
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
        });
        PomodoroHandle { tx, inner }
    }

    pub fn start(&self, minutes: u32) {
        let _ = self.tx.send(Cmd::Start(minutes));
    }

    pub fn stop(&self) {
        let _ = self.tx.send(Cmd::Stop);
    }

    pub fn set_auto_loop(&self, v: bool) {
        let _ = self.tx.send(Cmd::SetAutoLoop(v));
    }

    pub fn is_active(&self) -> bool {
        self.inner.lock().unwrap().phase.is_some()
    }

    /** 专注期静默其他提醒（休息期不静默） */
    pub fn is_suppressing(&self) -> bool {
        self.inner.lock().unwrap().phase == Some(Phase::Focus)
    }

    pub fn phase(&self) -> Option<Phase> {
        self.inner.lock().unwrap().phase
    }

    pub fn remaining_ms(&self) -> i64 {
        let s = self.inner.lock().unwrap();
        if s.phase.is_some() {
            (s.ends_at - now_ms()).max(0)
        } else {
            0
        }
    }
}

fn now_ms() -> i64 {
    chrono::Local::now().timestamp_millis()
}
