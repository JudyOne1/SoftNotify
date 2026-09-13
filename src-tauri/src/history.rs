use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Mutex;

const MAX: usize = 50;

#[derive(Serialize, Deserialize, Clone)]
pub struct HistoryEntry {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub at: i64,
    /// 处理结果：overlay / system / overlay+system / direct。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub result: Option<String>,
}

pub struct History {
    path: PathBuf,
    entries: Mutex<Vec<HistoryEntry>>,
}

impl History {
    pub fn load(path: PathBuf) -> Self {
        let entries = std::fs::read_to_string(&path)
            .ok()
            .and_then(|raw| serde_json::from_str::<Vec<HistoryEntry>>(&raw).ok())
            .unwrap_or_default();
        let entries = if entries.len() > MAX {
            entries[entries.len() - MAX..].to_vec()
        } else {
            entries
        };
        History {
            path,
            entries: Mutex::new(entries),
        }
    }

    /// 最近的弹幕，新的在前
    pub fn get(&self) -> Value {
        let list = self.entries.lock().unwrap();
        let mut out = Vec::with_capacity(list.len());
        for e in list.iter().rev() {
            out.push(json!({ "text": e.text, "name": e.name, "at": e.at, "result": e.result }));
        }
        Value::Array(out)
    }

    pub fn add(&self, entry: HistoryEntry) {
        {
            let mut list = self.entries.lock().unwrap();
            list.push(entry);
            if list.len() > MAX {
                let n = list.len() - MAX;
                list.drain(0..n);
            }
        }
        self.save();
    }

    fn save(&self) {
        let list = self.entries.lock().unwrap();
        if let Some(parent) = self.path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::write(
            &self.path,
            serde_json::to_string(&*list).unwrap_or_default(),
        );
    }
}
