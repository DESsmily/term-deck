//! Live process table for the "进程管理" modal.
//!
//! `sysinfo` gives name/pid/status. Listening ports are attributed per-pid via
//! the platform's socket table (`netstat` on Windows, `lsof` elsewhere) so the
//! table stays relevant — it shows servers, matching the design — and degrades
//! to the full process list when port data is unavailable.

use std::collections::HashMap;
use std::process::Command;

use serde::Serialize;
use sysinfo::{Pid, ProcessStatus, ProcessesToUpdate, System};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcRow {
    pub pid: u32,
    pub name: String,
    pub port: Option<u16>,
    pub status: String,
}

fn status_label(status: ProcessStatus) -> &'static str {
    match status {
        ProcessStatus::Run => "运行中",
        ProcessStatus::Stop => "已暂停",
        ProcessStatus::Zombie => "僵尸",
        ProcessStatus::Idle => "空闲",
        _ => "运行中",
    }
}

#[tauri::command]
pub fn process_list() -> Result<Vec<ProcRow>, String> {
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    let ports = collect_ports();
    let have_ports = !ports.is_empty();

    let mut rows: Vec<ProcRow> = Vec::new();
    for (pid, proc) in sys.processes() {
        let name = proc.name().to_string_lossy().trim().to_string();
        if name.is_empty() {
            continue;
        }
        let port = ports.get(&pid.as_u32()).copied();
        if have_ports && port.is_none() {
            continue;
        }
        rows.push(ProcRow {
            pid: pid.as_u32(),
            name,
            port,
            status: status_label(proc.status()).to_string(),
        });
    }
    rows.sort_by(|a, b| {
        b.port
            .unwrap_or(0)
            .cmp(&a.port.unwrap_or(0))
            .then(a.name.cmp(&b.name))
    });
    rows.truncate(300);
    Ok(rows)
}

#[tauri::command]
pub fn process_kill(pids: Vec<u32>) -> Result<(), String> {
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    for pid in pids {
        if let Some(p) = sys.process(Pid::from_u32(pid)) {
            let _ = p.kill();
        }
    }
    Ok(())
}

#[cfg(windows)]
fn collect_ports() -> HashMap<u32, u16> {
    let mut map: HashMap<u32, u16> = HashMap::new();
    let Ok(out) = Command::new("netstat").args(["-ano"]).output() else {
        return map;
    };
    let text = String::from_utf8_lossy(&out.stdout);
    for line in text.lines() {
        let cols: Vec<&str> = line.split_whitespace().collect();
        if cols.len() < 4 {
            continue;
        }
        // TCP: proto local foreign state pid   |   UDP: proto local foreign pid
        let (local, pid_str) = match cols[0] {
            "TCP" => {
                if cols.len() < 5 || !cols[3].eq_ignore_ascii_case("LISTENING") {
                    continue;
                }
                (cols[1], cols[4])
            }
            "UDP" => (cols[1], cols[3]),
            _ => continue,
        };
        let Ok(pid) = pid_str.parse::<u32>() else {
            continue;
        };
        if let Some(port) = local.rsplit(':').next().and_then(|p| p.parse::<u16>().ok()) {
            if port != 0 {
                let e = map.entry(pid).or_insert(port);
                *e = (*e).min(port);
            }
        }
    }
    map
}

#[cfg(not(windows))]
fn collect_ports() -> HashMap<u32, u16> {
    let mut map: HashMap<u32, u16> = HashMap::new();
    let Ok(out) = Command::new("lsof").args(["-i", "-P", "-n"]).output() else {
        return map;
    };
    let text = String::from_utf8_lossy(&out.stdout);
    for line in text.lines().skip(1) {
        let cols: Vec<&str> = line.split_whitespace().collect();
        let Some(li) = cols.iter().position(|c| *c == "(LISTEN)") else {
            continue;
        };
        if li == 0 || cols.len() < 2 {
            continue;
        }
        let Ok(pid) = cols[1].parse::<u32>() else {
            continue;
        };
        if let Some(port) = cols[li - 1].rsplit(':').next().and_then(|p| p.parse::<u16>().ok()) {
            if port != 0 {
                let e = map.entry(pid).or_insert(port);
                *e = (*e).min(port);
            }
        }
    }
    map
}
