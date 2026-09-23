// Shared domain types for TermDeck.

/** Layout modes shown by the toolbar segmented control. */
export type LayoutMode = "grid" | "vertical" | "horizontal";

/** A shell option offered in the settings modal, keyed by platform. */
export type ShellId =
  | "cmd"
  | "powershell"
  | "pwsh"
  | "git-bash"
  | "bash"
  | "zsh"
  | "iterm";

export interface ShellOption {
  id: ShellId;
  label: string;
}

/** What the window close button does. */
export type CloseAction = "tray" | "quit";
export type Theme = "dark" | "light";

/** Runtime status of a terminal session. */
export type SessionStatus = "running" | "exited" | "error";

/** A single terminal tab/pane tracked by the store. */
export interface TerminalSession {
  id: string;
  /** Header title, e.g. `bash — 本地 Shell` or `ssh root@10.0.0.5`. */
  title: string;
  /** Short label shown in the session sidebar. */
  label: string;
  /** Working directory reported by the shell (best effort). */
  cwd: string;
  /** Shell kind that backs the session. */
  shell: ShellId;
  status: SessionStatus;
  createdAt: number;
}

/** A row in the process-management modal. */
export interface ProcessInfo {
  pid: number;
  name: string;
  /** Listening port if one could be attributed to the process. */
  port: number | null;
  status: string;
}

/** Persisted user settings. */
export interface AppSettings {
  windowsShell: ShellId;
  macShell: ShellId;
  closeAction: CloseAction;
}

/** Everything written to `termdeck.json` in the install directory. */
export interface AppConfig extends AppSettings {
  theme: Theme;
}
