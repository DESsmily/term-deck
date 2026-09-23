# TermDeck · 终端管理器

A multi-terminal manager desktop app built with **Tauri v2 + Vue 3 + TypeScript**,
recreated from the provided UI design mockups.

## Features

- **Real terminals** — each pane is backed by a live PTY (`portable-pty`) rendered
  with `xterm.js`. Shells are spawned per the default-shell setting.
- **Layout modes** — 网格 (grid) / 垂直 (vertical) / 水平 (horizontal), plus a
  single-pane view when one terminal is open.
- **Session sidebar** — create, select and close terminals; live status dots.
- **Drag to reorder** — grab a pane header and drop it onto another slot
  (green "松手放置到此" drop target).
- **Settings** — pick the default shell for the **current platform only** (Windows:
  CMD / PowerShell / Git Bash; macOS: Bash / zsh / iTerm), filtered to the shells
  actually installed on the machine. Choose what the close button does:
  **minimize to tray** (default) or **quit the app**.
- **Process manager** — live table of processes with name / PID / listening port /
  status, search, multi-select and kill.
- **Theme** — dark (default) and light, with a terminal palette that follows it.
- **Duplicate terminal** — the pane's 复制 button opens a new terminal in the same
  working directory.
- **Portable config** — settings and theme are saved to `termdeck.json` next to
  the executable (falls back to the app-data dir if the install dir is read-only).

## Architecture

```
src/                     Vue 3 + TS frontend
  services/              runtime-selected backend (Tauri IPC vs browser preview)
    backend.ts           interface + platform detection
    tauriBackend.ts      invoke + Channel to the Rust PTY/process commands
    previewBackend.ts    in-browser echo shell + sample processes (dev preview)
  stores/termdeck.ts     reactive app state (sessions, layout, theme, settings)
  components/            TitleBar, Toolbar, SessionList, TerminalWorkspace,
                         TerminalPane (xterm), StatusBar, SettingsModal, ProcessModal
src-tauri/               Rust backend (Tauri v2)
  src/terminal.rs        portable-pty manager (create/attach/write/resize/close) + shell detection
  src/process.rs         sysinfo process table + netstat/lsof port attribution
  src/config.rs          install-dir config persistence + close-to-tray behaviour (system tray)
```

The frontend is identical under Tauri and in a plain browser; only the service
layer is swapped at the IPC boundary. Running `pnpm dev` opens the app against the
preview backend so the UI is fully interactive without the native shell.

## Development

```bash
pnpm install
pnpm dev          # browser preview (echo shell + sample process data)
pnpm tauri:dev    # native app with real PTYs and live process table
pnpm build        # typecheck (vue-tsc) + production bundle
pnpm tauri:build  # package the desktop app
```

## Notes

- Windows uses ConPTY via `portable-pty`; macOS/Linux use a standard PTY.
- Process ports are attributed from `netstat -ano` (Windows) or `lsof -i -P -n`
  (macOS/Linux); when unavailable the table falls back to the full process list.
