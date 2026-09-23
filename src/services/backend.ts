import type { AppConfig, ProcessInfo, ShellId } from "@/types";

export type Platform = "windows" | "mac" | "linux" | "unknown";

export interface CreateOptions {
  shell: ShellId;
  cwd?: string;
  cols: number;
  rows: number;
  /** Preview-only: banner line printed before the prompt. Ignored under Tauri. */
  banner?: string;
  /** Preview-only: commands auto-run to reproduce the design mockups. */
  seed?: string[];
}

export interface CreateResult {
  id: string;
  cwd: string;
}

export interface AttachHandlers {
  onData: (bytes: Uint8Array) => void;
  onExit: (code: number | null) => void;
}

export interface TerminalBackend {
  create(opts: CreateOptions): Promise<CreateResult>;
  /** Returns a detach function that stops delivering frames for this pane. */
  attach(id: string, handlers: AttachHandlers): Promise<() => void>;
  write(id: string, data: string): Promise<void>;
  resize(id: string, cols: number, rows: number): Promise<void>;
  close(id: string): Promise<void>;
  /** Shell ids that are actually installed on this machine. */
  detectShells(): Promise<ShellId[]>;
}

export interface ProcessBackend {
  list(): Promise<ProcessInfo[]>;
  kill(pids: number[]): Promise<void>;
}

export interface ClipboardBackend {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

export interface ConfigBackend {
  load(): Promise<AppConfig | null>;
  save(cfg: AppConfig): Promise<void>;
}

export interface Backend {
  kind: "tauri" | "preview";
  platform: Platform;
  terminal: TerminalBackend;
  process: ProcessBackend;
  config: ConfigBackend;
  clipboard: ClipboardBackend;
}

export function detectPlatform(): Platform {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac|iPhone|iPad/i.test(ua)) return "mac";
  if (/Linux|X11/i.test(ua)) return "linux";
  return "unknown";
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
