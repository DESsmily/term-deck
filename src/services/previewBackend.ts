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
import { candidatesFor } from "@/shells";
import type { AppConfig, ProcessInfo, ShellId } from "@/types";

const enc = new TextEncoder();
const GREEN_PROMPT = "\x1b[32m$\x1b[0m ";

/** OSC 7 carrying a directory — mirrors what the real shells are wired to emit. */
function osc7(cwd: string): string {
  return `\x1b]7;file://localhost${cwd}\x07`;
}

function normalizePath(p: string): string {
  const abs = p.startsWith("/");
  const parts: string[] = [];
  for (const seg of p.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      if (parts.length && parts[parts.length - 1] !== "..") parts.pop();
      else if (!abs) parts.push("..");
    } else parts.push(seg);
  }
  return (abs ? "/" : "") + parts.join("/");
}

function resolveCd(current: string, arg: string): string {
  if (!arg || arg === "~") return "/home/user";
  if (arg.startsWith("~/")) return normalizePath("/home/user/" + arg.slice(2));
  if (arg.startsWith("/")) return normalizePath(arg);
  return normalizePath(`${current}/${arg}`);
}

interface PreviewSession {
  handlers: AttachHandlers | null;
  buffer: string;
  cwd: string;
  banner?: string;
  seed?: string[];
}

const sessions = new Map<string, PreviewSession>();
let counter = 0;

function cmdOutput(cmd: string, cwd: string): string {
  const trimmed = cmd.trim();
  const [name] = trimmed.split(/\s+/);
  switch (trimmed) {
    case "ls -la":
      return "total 48  drwxr-xr-x  6 user";
    case "ls":
      return "src  public  package.json  vite.config.ts";
    case "git status":
      return "On branch main\nnothing to commit, working tree clean";
    case "docker ps":
      return "CONTAINER ID   IMAGE";
    case "top":
      return "Tasks: 142 total,   1 running, 141 sleeping\n%Cpu(s):  6.2 us,  1.8 sy";
    case "pwd":
      return cwd;
    case "whoami":
      return "user";
    case "vite":
    case "npm run dev":
      return "  VITE v5.4.0  ready\n  Local: http://localhost:5173";
    case "python main.py":
    case "python app.py":
      return "Flask app running on :5000\n * Debug mode: on";
    case "help":
      return "TermDeck preview shell — try: ls -la, git status, docker ps, pwd, clear";
    default:
      if (name === "echo") return trimmed.slice(4).trim();
      if (name) return `command not found: ${name}`;
      return "";
  }
}

function emit(id: string, text: string): void {
  const s = sessions.get(id);
  if (s?.handlers) s.handlers.onData(enc.encode(text));
}

const terminal: TerminalBackend = {
  async create(opts: CreateOptions): Promise<CreateResult> {
    const id = `preview-${++counter}`;
    const cwd = opts.cwd ?? "/home/user/project";
    sessions.set(id, {
      handlers: null,
      buffer: "",
      cwd,
      banner: opts.banner,
      seed: opts.seed,
    });
    return { id, cwd };
  },

  async attach(id: string, handlers: AttachHandlers): Promise<() => void> {
    const s = sessions.get(id);
    if (!s) throw new Error(`unknown session ${id}`);
    s.handlers = handlers;
    if (s.banner) handlers.onData(enc.encode(s.banner + "\r\n"));
    for (const cmd of s.seed ?? []) {
      handlers.onData(enc.encode(GREEN_PROMPT + cmd + "\r\n"));
      const out = cmdOutput(cmd, s.cwd);
      if (out) handlers.onData(enc.encode(out + "\r\n"));
    }
    handlers.onData(enc.encode(osc7(s.cwd)));
    handlers.onData(enc.encode(GREEN_PROMPT));
    return () => {
      const cur = sessions.get(id);
      if (cur && cur.handlers === handlers) cur.handlers = null;
    };
  },

  async write(id: string, data: string): Promise<void> {
    const s = sessions.get(id);
    if (!s) return;
    for (const ch of data) {
      const code = ch.codePointAt(0) ?? 0;
      if (code === 13 || code === 10) {
        const line = s.buffer.trim();
        emit(id, "\r\n");
        if (line === "clear") {
          emit(id, "\x1b[2J\x1b[H");
        } else if (line === "cd" || line.startsWith("cd ")) {
          s.cwd = resolveCd(s.cwd, line.slice(2).trim());
          emit(id, osc7(s.cwd));
        } else {
          const out = cmdOutput(s.buffer, s.cwd);
          if (out) emit(id, out + "\r\n");
        }
        s.buffer = "";
        emit(id, GREEN_PROMPT);
      } else if (code === 127 || code === 8) {
        if (s.buffer.length > 0) {
          s.buffer = s.buffer.slice(0, -1);
          emit(id, "\b \b");
        }
      } else if (code === 3) {
        emit(id, "^C\r\n");
        s.buffer = "";
        emit(id, GREEN_PROMPT);
      } else if (code >= 32 && code !== 127) {
        s.buffer += ch;
        emit(id, ch);
      }
    }
  },

  async resize(): Promise<void> {},
  async close(id: string): Promise<void> {
    sessions.get(id)?.handlers?.onExit(null);
    sessions.delete(id);
  },
  async detectShells(): Promise<ShellId[]> {
    // Browser preview can't inspect the host; treat every candidate as available.
    return candidatesFor(detectPlatform()).map((c) => c.id);
  },
};

let previewProcesses: ProcessInfo[] = [
  { pid: 4821, name: "node", port: 5173, status: "运行中" },
  { pid: 3390, name: "python", port: 8000, status: "运行中" },
  { pid: 1204, name: "redis-server", port: 6379, status: "运行中" },
  { pid: 882, name: "nginx", port: 80, status: "运行中" },
  { pid: 5532, name: "java", port: 8080, status: "运行中" },
];

const process: ProcessBackend = {
  async list(): Promise<ProcessInfo[]> {
    return previewProcesses.map((p) => ({ ...p }));
  },
  async kill(pids: number[]): Promise<void> {
    const doomed = new Set(pids);
    previewProcesses = previewProcesses.filter((p) => !doomed.has(p.pid));
  },
};

const CONFIG_KEY = "termdeck.config.v1";

const config: ConfigBackend = {
  async load(): Promise<AppConfig | null> {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      return raw ? (JSON.parse(raw) as AppConfig) : null;
    } catch {
      return null;
    }
  },
  async save(cfg: AppConfig): Promise<void> {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    } catch {
      /* storage unavailable */
    }
  },
};

// Browser Clipboard API is gated behind permissions / focus, so mirror writes in
// an in-memory buffer: a failed read still returns the last thing the UI copied,
// which keeps copy→paste working for preview verification.
let fallbackClipboard = "";

const clipboard: ClipboardBackend = {
  async readText(): Promise<string> {
    try {
      return (await navigator.clipboard.readText()) ?? fallbackClipboard;
    } catch {
      return fallbackClipboard;
    }
  },
  async writeText(text: string): Promise<void> {
    fallbackClipboard = text;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard permission denied in preview — in-memory copy still holds */
    }
  },
};

export function createPreviewBackend(): Backend {
  return {
    kind: "preview",
    platform: detectPlatform(),
    terminal,
    process,
    config,
    clipboard,
  };
}
