import { createApp } from "vue";
import App from "./App.vue";
import "./styles/base.css";
import "@xterm/xterm/css/xterm.css";
import { hydrate, seedPreview } from "./stores/termdeck";

/**
 * Suppress native shell chrome this desktop app doesn't want: the right-click
 * context menu and browser shortcuts (reload, print, save, find, zoom, dev
 * tools). Only the listed combos are blocked, so ordinary typing — including
 * anything a terminal forwards — is untouched.
 */
function installBrowserGuard(): void {
  const blockContextMenu = (e: MouseEvent) => e.preventDefault();

  const blockKey = (e: KeyboardEvent) => {
    if (e.key === "F5" || e.key === "F12") {
      e.preventDefault();
      return;
    }
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;
    const key = e.key.toLowerCase();
    // Reload / print / save / open / find / zoom. Ctrl+Shift+R (key 'r') and
    // Ctrl+Shift+P are caught here too.
    if (["r", "p", "s", "o", "f", "0", "+", "=", "-"].includes(key)) {
      e.preventDefault();
      return;
    }
    // DevTools / console shortcuts are Shift-only, so they never collide with a
    // shell control code (which terminals send as plain Ctrl+letter).
    if (e.shiftKey && ["i", "j", "c", "k", "d"].includes(key)) {
      e.preventDefault();
    }
  };

  window.addEventListener("contextmenu", blockContextMenu);
  window.addEventListener("keydown", blockKey, { passive: false });
}

async function bootstrap() {
  installBrowserGuard();
  await hydrate();
  createApp(App).mount("#app");
  await seedPreview();
}

void bootstrap();
