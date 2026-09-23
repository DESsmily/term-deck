import { computed, reactive, watch } from "vue";
import { backend } from "@/services";
import { SHELL_LABELS, candidatesFor, platformField } from "@/shells";
import type {
  AppSettings,
  CloseAction,
  LayoutMode,
  ShellId,
  TerminalSession,
  Theme,
} from "@/types";

interface StoreState {
  sessions: TerminalSession[];
  activeId: string | null;
  layout: LayoutMode;
  theme: Theme;
  settings: AppSettings;
  /** Shell ids installed on this machine. Empty until detected. */
  availableShells: ShellId[];
  /** Sessions sidebar collapsed to a slim rail to reclaim terminal space. */
  sidebarCollapsed: boolean;
  settingsOpen: boolean;
  processesOpen: boolean;
}

const state = reactive<StoreState>({
  sessions: [],
  activeId: null,
  layout: "grid",
  theme: "dark",
  settings: { windowsShell: "powershell", macShell: "zsh", closeAction: "tray" },
  availableShells: [],
  sidebarCollapsed: false,
  settingsOpen: false,
  processesOpen: false,
});

let counter = 0;
let hydrated = false;

function defaultShell(): ShellId {
  const field = platformField(backend.platform);
  const preferred = state.settings[field];
  const candidates = candidatesFor(backend.platform).map((c) => c.id);
  const available = state.availableShells.length
    ? state.availableShells
    : candidates;
  if (available.includes(preferred)) return preferred;
  return available.find((s) => candidates.includes(s)) ?? preferred;
}

async function addSession(opts: {
  shell: ShellId;
  cwd?: string;
  title?: string;
  label?: string;
  banner?: string;
  seed?: string[];
}): Promise<void> {
  counter += 1;
  const shellLabel = SHELL_LABELS[opts.shell];
  const { id, cwd } = await backend.terminal.create({
    shell: opts.shell,
    cwd: opts.cwd,
    cols: 80,
    rows: 24,
    banner: opts.banner,
    seed: opts.seed,
  });
  const session: TerminalSession = {
    id,
    title: opts.title ?? `${shellLabel} · 终端 ${counter}`,
    label: opts.label ?? `${shellLabel} ${counter}`,
    cwd,
    shell: opts.shell,
    status: "running",
    createdAt: Date.now(),
  };
  state.sessions.push(session);
  state.activeId = id;
}

export const store = {
  state,
  activeSession: computed(
    () => state.sessions.find((s) => s.id === state.activeId) ?? null,
  ),

  async createTerminal(): Promise<void> {
    await addSession({ shell: defaultShell() });
  },

  /**
   * Open a new terminal in the same directory the source pane is *currently*
   * in. `session.cwd` is kept live by the OSC 7 sequences the shell prints on
   * each prompt, so this follows `cd`, and the duplicate reuses the source
   * shell rather than the configured default.
   */
  async duplicateTerminal(id: string): Promise<void> {
    const src = state.sessions.find((s) => s.id === id);
    if (!src) return;
    await addSession({ shell: src.shell, cwd: src.cwd });
  },

  async closeTerminal(id: string): Promise<void> {
    const idx = state.sessions.findIndex((s) => s.id === id);
    if (idx === -1) return;
    await backend.terminal.close(id).catch(() => {});
    state.sessions.splice(idx, 1);
    if (state.activeId === id) {
      const next = state.sessions[idx] ?? state.sessions[idx - 1] ?? null;
      state.activeId = next?.id ?? null;
    }
  },

  setActive(id: string): void {
    state.activeId = id;
  },
  setLayout(layout: LayoutMode): void {
    state.layout = layout;
  },
  toggleSidebar(): void {
    state.sidebarCollapsed = !state.sidebarCollapsed;
  },
  setStatus(id: string, status: TerminalSession["status"]): void {
    const s = state.sessions.find((x) => x.id === id);
    if (s) s.status = status;
  },
  setCwd(id: string, cwd: string): void {
    const s = state.sessions.find((x) => x.id === id);
    if (s) s.cwd = cwd;
  },
  reorder(dragId: string, overId: string): void {
    if (dragId === overId) return;
    const from = state.sessions.findIndex((s) => s.id === dragId);
    const to = state.sessions.findIndex((s) => s.id === overId);
    if (from === -1 || to === -1) return;
    const [moved] = state.sessions.splice(from, 1);
    state.sessions.splice(to, 0, moved);
  },
  toggleTheme(): void {
    state.theme = state.theme === "dark" ? "light" : "dark";
  },
  setShell(platform: "windows" | "mac", shell: ShellId): void {
    if (platform === "windows") state.settings.windowsShell = shell;
    else state.settings.macShell = shell;
  },
  setCloseAction(action: CloseAction): void {
    state.settings.closeAction = action;
  },
  openSettings(): void {
    state.settingsOpen = true;
  },
  closeSettings(): void {
    state.settingsOpen = false;
  },
  openProcesses(): void {
    state.processesOpen = true;
  },
  closeProcesses(): void {
    state.processesOpen = false;
  },
};

/** Load persisted config + detect installed shells. Call before mount. */
export async function hydrate(): Promise<void> {
  const cfg = await backend.config.load();
  if (cfg) {
    state.theme = cfg.theme ?? "dark";
    state.settings = {
      windowsShell: cfg.windowsShell ?? "powershell",
      macShell: cfg.macShell ?? "zsh",
      closeAction: cfg.closeAction ?? "tray",
    };
  }
  document.documentElement.dataset.theme = state.theme;

  state.availableShells = await backend.terminal.detectShells();

  // If the saved default for this platform isn't installed, fall back to one
  // that is, so the setting never points at a missing shell.
  const field = platformField(backend.platform);
  if (
    state.availableShells.length &&
    !state.availableShells.includes(state.settings[field])
  ) {
    const fallback = candidatesFor(backend.platform)
      .map((c) => c.id)
      .find((id) => state.availableShells.includes(id));
    if (fallback) state.settings[field] = fallback;
  }

  hydrated = true;
  watch(
    () => ({
      windowsShell: state.settings.windowsShell,
      macShell: state.settings.macShell,
      closeAction: state.settings.closeAction,
      theme: state.theme,
    }),
    (cfg) => {
      if (!hydrated) return;
      void backend.config.save(cfg);
    },
    { deep: true },
  );
}

watch(
  () => state.theme,
  (theme) => {
    document.documentElement.dataset.theme = theme;
  },
);

/** Reproduce the design mockups' four demo sessions when running in a browser. */
export async function seedPreview(): Promise<void> {
  if (backend.kind !== "preview" || state.sessions.length > 0) return;
  await addSession({
    shell: "bash",
    title: "bash — 本地 Shell",
    label: "bash — 本地",
    seed: ["ls -la", "git status"],
  });
  await addSession({
    shell: "bash",
    title: "ssh root@10.0.0.5",
    label: "ssh root@10.0.0.5",
    banner: "Last login: Tue Sep 22 18:30",
    seed: ["docker ps"],
  });
  await addSession({
    shell: "bash",
    title: "npm run dev",
    label: "npm run dev",
    seed: ["vite"],
  });
  await addSession({
    shell: "bash",
    title: "python venv",
    label: "python venv",
    seed: ["python main.py"],
  });
  state.activeId = state.sessions[0]?.id ?? null;
}
