//! PTY-backed terminal sessions.
//!
//! Each session owns a `portable-pty` pair. A reader thread pumps raw bytes to
//! the webview over a `Channel`, and a waiter thread reports the child's exit
//! code. Output travels as `Vec<u8>` so ANSI escapes and non-UTF-8 bytes reach
//! xterm intact.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use parking_lot::Mutex;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use portable_pty::{native_pty_system, Child, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::ipc::Channel;
use tauri::State;
use uuid::Uuid;

/// Frame sent to the webview over the attach channel.
#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Frame {
    Data { bytes: Vec<u8> },
    Exit { exit_code: Option<i32> },
}

type WriterSink = Arc<dyn Fn(Frame) + Send + Sync + 'static>;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateResult {
    pub id: String,
    pub cwd: String,
}

struct Session {
    writer: Mutex<Box<dyn Write + Send>>,
    master: Mutex<Box<dyn MasterPty + Send>>,
    killer: Mutex<Box<dyn ChildKiller + Send>>,
    reader: Mutex<Option<Box<dyn Read + Send>>>,
    sink: Mutex<Option<WriterSink>>,
    started: AtomicBool,
}

#[derive(Default)]
pub struct TerminalManager {
    sessions: Mutex<HashMap<String, Arc<Session>>>,
}

/// Program, arguments, and extra environment for a settings `ShellId`.
///
/// Each launch is wired so the shell prints its current directory as an OSC 7
/// escape sequence on every prompt. xterm captures those sequences, which is how
/// a pane's `cwd` tracks `cd` and how the `复制` action opens a duplicate in the
/// directory the source terminal is actually in right now.
fn shell_launch(shell: &str) -> (String, Vec<String>, Vec<(String, String)>) {
    match shell {
        "cmd" => (
            which(&["cmd"], "cmd"),
            // `prompt <str>` re-runs on every prompt; `$p` is the live path, so
            // `$e]7;$p$e\` emits ESC ]7; <path> ESC \ (an OSC-7 ST terminator).
            vec!["/K".into(), "prompt $e]7;$p$e\\$p$g ".into()],
            vec![],
        ),
        "powershell" => (
            which(&["powershell"], "powershell"),
            vec!["-NoExit".into(), "-EncodedCommand".into(), powershell_osc7()],
            vec![],
        ),
        "pwsh" => (
            which(&["pwsh"], "pwsh"),
            vec!["-NoExit".into(), "-EncodedCommand".into(), powershell_osc7()],
            vec![],
        ),
        "git-bash" => (
            which(
                &[
                    "C:\\Program Files\\Git\\bin\\bash.exe",
                    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
                    "bash",
                ],
                "bash",
            ),
            vec!["-l".into()],
            vec![("PROMPT_COMMAND".into(), BASH_OSC7.into())],
        ),
        "zsh" | "iterm" => (which(&["zsh", "bash"], "zsh"), vec![], vec![]),
        _ => (
            which(&["bash", "zsh", "sh"], "bash"),
            vec![],
            vec![("PROMPT_COMMAND".into(), BASH_OSC7.into())],
        ),
    }
}

/// Bash reports its directory on each prompt via PROMPT_COMMAND.
const BASH_OSC7: &str = "printf '\\033]7;file://localhost%s\\007' \"$PWD\"";

/// PowerShell's `prompt` function re-runs each prompt; `-EncodedCommand` (UTF-16LE
/// base64) sidesteps every Windows argv-quoting problem.
fn powershell_osc7() -> String {
    const SCRIPT: &str =
        "function global:prompt{$p=(Get-Location).Path;$e=[char]27;[Console]::Write(\"$e]7;$p$([char]7)\");\"PS $p> \"}";
    let utf16: Vec<u8> = SCRIPT.encode_utf16().flat_map(|c| c.to_le_bytes()).collect();
    STANDARD.encode(&utf16)
}

fn which(candidates: &[&str], fallback: &str) -> String {
    for c in candidates {
        if std::path::Path::new(c).exists() {
            return c.to_string();
        }
        if !c.contains('/') && !c.contains('\\') && which_in_path(c) {
            return c.to_string();
        }
    }
    fallback.to_string()
}

fn which_in_path(prog: &str) -> bool {
    let paths = std::env::var_os("PATH").unwrap_or_default();
    std::env::split_paths(&paths).any(|dir| dir.join(prog).exists())
}

fn default_cwd() -> String {
    if cfg!(windows) {
        std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".into())
    } else {
        std::env::var("HOME").unwrap_or_else(|_| "/".into())
    }
}

fn shell_available(id: &str) -> bool {
    match id {
        "cmd" => Path::new("C:\\Windows\\System32\\cmd.exe").exists() || which_in_path("cmd"),
        "powershell" => {
            Path::new("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe").exists()
                || which_in_path("powershell")
        }
        "pwsh" => which_in_path("pwsh"),
        "git-bash" => {
            Path::new("C:\\Program Files\\Git\\bin\\bash.exe").exists()
                || Path::new("C:\\Program Files (x86)\\Git\\bin\\bash.exe").exists()
        }
        "bash" => Path::new("/bin/bash").exists() || which_in_path("bash"),
        "zsh" => Path::new("/bin/zsh").exists() || which_in_path("zsh"),
        "iterm" => Path::new("/Applications/iTerm.app").exists(),
        _ => false,
    }
}

/// Shell ids from the current platform's candidate set that are installed.
#[tauri::command]
pub fn detect_shells() -> Vec<String> {
    let candidates: &[&str] = match std::env::consts::OS {
        "windows" => &["cmd", "powershell", "git-bash"],
        "macos" => &["bash", "zsh", "iterm"],
        _ => &["bash", "zsh"],
    };
    candidates
        .iter()
        .filter(|id| shell_available(id))
        .map(|id| id.to_string())
        .collect()
}

#[tauri::command]
pub fn terminal_create(
    state: State<'_, TerminalManager>,
    shell: String,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<CreateResult, String> {
    let cwd = cwd.filter(|c| !c.trim().is_empty()).unwrap_or_else(default_cwd);
    // A duplicate can target a folder that has since been deleted; fall back to
    // the home directory instead of failing to launch the shell.
    let cwd = if Path::new(&cwd).is_dir() { cwd } else { default_cwd() };
    let (program, args, extra_env) = shell_launch(&shell);

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(&program);
    cmd.args(args);
    cmd.cwd(&cwd);
    cmd.env("TERM", "xterm-256color");
    for (key, value) in extra_env {
        cmd.env(key, value);
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("无法启动 {program}: {e}"))?;
    drop(pair.slave);

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let killer = child.clone_killer();

    let session = Arc::new(Session {
        writer: Mutex::new(writer),
        master: Mutex::new(pair.master),
        killer: Mutex::new(killer),
        reader: Mutex::new(Some(reader)),
        sink: Mutex::new(None),
        started: AtomicBool::new(false),
    });

    // The waiter thread blocks in `child.wait()` for the session's whole life,
    // so `kill()` must go through the separately-stored killer to avoid
    // contending for the same lock.
    let wait_session = Arc::clone(&session);
    let mut child: Box<dyn Child + Send> = child;
    std::thread::spawn(move || {
        let status = child.wait().ok();
        let code = status.map(|s| if s.success() { 0 } else { s.exit_code() as i32 });
        if let Some(sink) = wait_session.sink.lock().as_ref() {
            sink(Frame::Exit { exit_code: code });
        }
    });

    let id = Uuid::new_v4().to_string();
    state.sessions.lock().insert(id.clone(), session);
    Ok(CreateResult { id, cwd })
}

#[tauri::command]
pub fn terminal_attach(
    state: State<'_, TerminalManager>,
    id: String,
    on_event: Channel<Frame>,
) -> Result<(), String> {
    let session = {
        let map = state.sessions.lock();
        map.get(&id).cloned().ok_or("terminal not found")?
    };

    let channel = Arc::new(on_event);
    let sink: WriterSink = {
        let c = Arc::clone(&channel);
        Arc::new(move |frame: Frame| {
            let _ = c.send(frame);
        })
    };
    *session.sink.lock() = Some(sink);

    if !session.started.swap(true, Ordering::SeqCst) {
        if let Some(reader) = session.reader.lock().take() {
            let s = Arc::clone(&session);
            std::thread::spawn(move || pump(reader, s));
        }
    }
    Ok(())
}

fn pump(mut reader: Box<dyn Read + Send>, session: Arc<Session>) {
    let mut buf = [0u8; 8192];
    loop {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                if let Some(sink) = session.sink.lock().as_ref() {
                    sink(Frame::Data {
                        bytes: buf[..n].to_vec(),
                    });
                }
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(_) => break,
        }
    }
}

#[tauri::command]
pub fn terminal_write(
    state: State<'_, TerminalManager>,
    id: String,
    data: String,
) -> Result<(), String> {
    let map = state.sessions.lock();
    let session = map.get(&id).ok_or("terminal not found")?;
    let mut writer = session.writer.lock();
    writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn terminal_resize(
    state: State<'_, TerminalManager>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let map = state.sessions.lock();
    if let Some(session) = map.get(&id) {
        session
            .master
            .lock()
            .resize(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn terminal_close(
    state: State<'_, TerminalManager>,
    id: String,
) -> Result<(), String> {
    let session = {
        let mut map = state.sessions.lock();
        map.remove(&id)
    };
    if let Some(session) = session {
        let _ = session.killer.lock().kill();
    }
    Ok(())
}
