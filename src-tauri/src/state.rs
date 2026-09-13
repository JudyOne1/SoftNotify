use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::config::Store;
use crate::history::History;
use crate::pomodoro::PomodoroHandle;
use crate::scheduler::SchedulerHandle;
use crate::stats::Stats;

pub struct AppState {
    pub store: Mutex<Store>,
    pub scheduler: Mutex<Option<SchedulerHandle>>,
    /// 每个已启用项的下一次触发时刻镜像（key: r:/s: 前缀），供设置页与托盘查询
    pub next_mirror: Arc<Mutex<HashMap<String, i64>>>,
    pub stats: Arc<Stats>,
    pub history: Arc<History>,
    pub pomodoro: PomodoroHandle,
    /// 节日祝福当天是否已附加（日期串）
    pub festival_shown_on: Mutex<String>,
}
