<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { backend } from "@/services";
import { store } from "@/stores/termdeck";
import type { TerminalSession } from "@/types";

const props = defineProps<{ session: TerminalSession }>();
const emit = defineEmits<{ (e: "focus"): void }>();

const host = ref<HTMLDivElement | null>(null);

const PALETTE = {
  dark: {
    background: "#0b0e0f",
    foreground: "#e7e9ea",
    cursor: "#3ddc84",
    cursorAccent: "#0b0e0f",
    selectionBackground: "rgba(61, 220, 132, 0.25)",
    black: "#1b1f22",
    red: "#f47174",
    green: "#3ddc84",
    yellow: "#e5c07b",
    blue: "#61afef",
    magenta: "#c678dd",
    cyan: "#56b6c2",
    white: "#dfe3e6",
    brightBlack: "#5c6370",
    brightRed: "#ff8b8d",
    brightGreen: "#7ee787",
    brightYellow: "#ffd866",
    brightBlue: "#7dc4ff",
    brightMagenta: "#d9a3ee",
    brightCyan: "#6fd3e0",
    brightWhite: "#f2f4f5",
  },
  light: {
    background: "#ffffff",
    foreground: "#17191b",
    cursor: "#16a34a",
    cursorAccent: "#ffffff",
    selectionBackground: "rgba(22, 163, 74, 0.2)",
    black: "#1b1f22",
    red: "#dc2626",
    green: "#15803d",
    yellow: "#b45309",
    blue: "#2563eb",
    magenta: "#9333ea",
    cyan: "#0891b2",
    white: "#e5e7eb",
    brightBlack: "#6b7280",
    brightRed: "#ef4444",
    brightGreen: "#16a34a",
    brightYellow: "#d97706",
    brightBlue: "#3b82f6",
    brightMagenta: "#a855f7",
    brightCyan: "#06b6d4",
    brightWhite: "#f9fafb",
  },
} as const;

let term: Terminal | null = null;
let fit: FitAddon | null = null;
let detach: (() => void) | null = null;
let ro: ResizeObserver | null = null;
let resizeTimer: number | undefined;
let removeContextMenu: (() => void) | null = null;

function currentTheme(): "dark" | "light" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Turn an OSC 7 payload (`file://host/path` or a bare path) into a directory. */
function osc7ToPath(payload: string): string | null {
  if (!payload) return null;
  if (payload.startsWith("file://")) {
    const rest = payload.slice(7);
    const i = rest.indexOf("/");
    if (i === -1) return null;
    let path = rest.slice(i);
    try {
      path = decodeURIComponent(path);
    } catch {
      /* keep the raw path */
    }
    if (/^\/[A-Za-z]:/.test(path)) path = path.slice(1);
    return path;
  }
  return payload;
}

function scheduleResize() {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (!term || !fit) return;
    fit.fit();
    void backend.terminal
      .resize(props.session.id, term.cols, term.rows)
      .catch(() => {});
  }, 60);
}

async function copySelection() {
  const text = term?.getSelection();
  if (text) await backend.clipboard.writeText(text).catch(() => {});
}

async function pasteFromClipboard() {
  const text = await backend.clipboard.readText().catch(() => "");
  if (text) term?.paste(text);
}

onMounted(async () => {
  if (!host.value) return;
  term = new Terminal({
    fontFamily:
      '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace',
    fontSize: 13,
    lineHeight: 1.5,
    scrollback: 5000,
    cursorBlink: true,
    theme: PALETTE[currentTheme()],
  });
  fit = new FitAddon();
  term.loadAddon(fit);
  term.open(host.value);
  fit.fit();

  // Shells report their directory as an OSC 7 sequence on every prompt, so this
  // keeps `session.cwd` live even after the user `cd`s elsewhere — which is what
  // the `复制` action opens the new terminal in.
  term.parser.registerOscHandler(7, (data) => {
    const path = osc7ToPath(data);
    if (path) store.setCwd(props.session.id, path);
    return true;
  });

  // Clipboard: Ctrl+Shift+V and Ctrl+V paste; Ctrl+C copies the selection and,
  // with nothing selected, falls through so the shell still gets SIGINT.
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== "keydown" || !(e.ctrlKey || e.metaKey)) return true;
    const key = e.key.toLowerCase();
    if (key === "v") {
      e.preventDefault();
      void pasteFromClipboard();
      return false;
    }
    if (key === "c" && term?.hasSelection()) {
      e.preventDefault();
      void copySelection();
      return false;
    }
    return true;
  });

  // Right-click copies the selection when there is one, otherwise pastes — the
  // native context menu is already suppressed globally, so this is the shortcut.
  const onContextMenu = (ev: MouseEvent) => {
    ev.preventDefault();
    void (term?.hasSelection() ? copySelection() : pasteFromClipboard());
  };
  term.element?.addEventListener("contextmenu", onContextMenu);
  removeContextMenu = () =>
    term?.element?.removeEventListener("contextmenu", onContextMenu);

  detach = await backend.terminal.attach(props.session.id, {
    onData: (bytes) => term?.write(bytes),
    onExit: (code) => {
      store.setStatus(props.session.id, "exited");
      term?.writeln(
        `\r\n\x1b[90m[进程已结束${code != null ? ` · exit ${code}` : ""}]\x1b[0m`,
      );
    },
  });

  term.onData((data) => {
    void backend.terminal.write(props.session.id, data).catch(() => {});
  });
  term.onResize(({ cols, rows }) => {
    void backend.terminal.resize(props.session.id, cols, rows).catch(() => {});
  });

  void backend.terminal
    .resize(props.session.id, term.cols, term.rows)
    .catch(() => {});

  ro = new ResizeObserver(scheduleResize);
  ro.observe(host.value);
});

onBeforeUnmount(() => {
  ro?.disconnect();
  removeContextMenu?.();
  removeContextMenu = null;
  detach?.();
  term?.dispose();
  term = null;
});

watch(
  () => store.state.theme,
  () => {
    if (term) term.options.theme = PALETTE[currentTheme()];
  },
);

function duplicate() {
  void store.duplicateTerminal(props.session.id);
}

function closePane() {
  void store.closeTerminal(props.session.id);
}
</script>

<template>
  <div class="pane" :class="{ focused: store.state.activeId === session.id }" @mousedown="emit('focus')">
    <div class="pane-head">
      <span class="grip" title="拖拽以重新排序">
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
          <circle cx="3.5" cy="3" r="1.2"/><circle cx="8.5" cy="3" r="1.2"/>
          <circle cx="3.5" cy="8" r="1.2"/><circle cx="8.5" cy="8" r="1.2"/>
          <circle cx="3.5" cy="13" r="1.2"/><circle cx="8.5" cy="13" r="1.2"/>
        </svg>
      </span>
      <span class="title" :title="session.title">{{ session.title }}</span>
      <button class="copy" title="在此目录新建终端" @click.stop="duplicate">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>
        </svg>
        复制
      </button>
      <button class="close-pane" title="关闭终端" @click.stop="closePane">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <path d="M6 6 L18 18 M18 6 L6 18"/>
        </svg>
      </button>
    </div>
    <div ref="host" class="term-host"></div>
  </div>
</template>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 200px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.pane.focused {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent);
}
.pane-head {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 42px;
  flex: 0 0 auto;
  padding: 0 12px 0 10px;
  border-bottom: 1px solid var(--border-soft);
}
.grip {
  color: var(--text-dim);
  display: inline-flex;
  cursor: grab;
}
.title {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.copy {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  background: var(--bg-elev-2);
  color: var(--text-muted);
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 7px;
  flex: 0 0 auto;
}
.copy:hover {
  color: var(--text);
  border-color: var(--text-dim);
}
.close-pane {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-dim);
  border-radius: 7px;
}
.close-pane:hover {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 14%, transparent);
}
.term-host {
  flex: 1;
  min-height: 0;
  padding: 8px 6px 8px 12px;
  background: var(--term-bg);
}
</style>
