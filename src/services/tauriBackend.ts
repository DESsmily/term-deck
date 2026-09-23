import { Channel, invoke } from "@tauri-apps/api/core";
import type {
  AttachHandlers,
  Backend,
  ClipboardBackend,
  ConfigBackend,
  CreateOptions,
  CreateResult,
  ProcessBackend,
  TerminalBackend,
} from "./backend";
import { detectPlatform } from "./backend";
import type { AppConfig, ProcessInfo, ShellId } from "@/types";

/** Wire shape emitted by the Rust `TerminalFrame` enum. */
type TerminalFrame =
  | { kind: "data"; bytes: number[] | Uint8Array }
  | { kind: "exit"; exitCode: number | null }
  | { kind: "error"; message: string };

function toBytes(bytes: number[] | Uint8Array): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
}

const terminal: TerminalBackend = {
  async create(opts: CreateOptions): Promise<CreateResult> {
    return invoke<CreateResult>("terminal_create", {
      shell: opts.shell,
      cwd: opts.cwd ?? null,
      cols: opts.cols,
      rows: opts.rows,
    });
  },

  async attach(id: string, handlers: AttachHandlers): Promise<() => void> {
    const channel = new Channel<TerminalFrame>();
    channel.onmessage = (frame) => {
      switch (frame.kind) {
        case "data":
          handlers.onData(toBytes(frame.bytes));
          break;
        case "exit":
          handlers.onExit(frame.exitCode);
          break;
        case "error":
          handlers.onExit(null);
          break;
      }
    };
    await invoke("terminal_attach", { id, onEvent: channel });
    return () => {
      // The Rust side replaces the sink on the next attach; nothing to free here.
    };
  },

  write(id, data) {
    return invoke("terminal_write", { id, data });
  },
  resize(id, cols, rows) {
    return invoke("terminal_resize", { id, cols, rows });
  },
  close(id) {
    return invoke("terminal_close", { id });
  },
  async detectShells(): Promise<ShellId[]> {
    const ids = await invoke<string[]>("detect_shells");
    return ids as ShellId[];
  },
};

const process: ProcessBackend = {
  list() {
    return invoke<ProcessInfo[]>("process_list");
  },
  kill(pids) {
    return invoke("process_kill", { pids });
  },
};

const config: ConfigBackend = {
  load() {
    return invoke<AppConfig>("config_load");
  },
  save(cfg) {
    return invoke("config_save", { config: cfg });
  },
};

const clipboard: ClipboardBackend = {
  readText() {
    return invoke<string>("clipboard_read");
  },
  writeText(text) {
    return invoke("clipboard_write", { text });
  },
};

export function createTauriBackend(): Backend {
  return {
    kind: "tauri",
    platform: detectPlatform(),
    terminal,
    process,
    config,
    clipboard,
  };
}
