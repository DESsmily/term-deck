<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { isTauri } from "@/services";

const maximized = ref(false);
let unlistenResize: (() => void) | null = null;

async function currentWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

async function minimize() {
  if (isTauri()) (await currentWindow()).minimize();
}
async function maximize() {
  if (isTauri()) {
    const win = await currentWindow();
    await win.toggleMaximize();
    maximized.value = await win.isMaximized();
  } else {
    maximized.value = !maximized.value;
  }
}
async function close() {
  if (isTauri()) (await currentWindow()).close();
}

onMounted(async () => {
  if (!isTauri()) return;
  const win = await currentWindow();
  maximized.value = await win.isMaximized();
  unlistenResize = await win.onResized(async () => {
    maximized.value = await win.isMaximized();
  });
});
onBeforeUnmount(() => unlistenResize?.());
</script>

<template>
  <header class="titlebar" data-tauri-drag-region>
    <div class="brand" data-tauri-drag-region>
      <span class="name">TermDeck</span>
      <span class="sep" data-tauri-drag-region>·</span>
      <span class="sub" data-tauri-drag-region>终端管理器</span>
    </div>
    <div class="lights">
      <button class="light min" title="最小化" @click="minimize">
        <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="4.6" width="8" height="1.2" rx="0.6" fill="currentColor"/></svg>
      </button>
      <button class="light max" :title="maximized ? '还原' : '最大化'" @click="maximize">
        <svg v-if="!maximized" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round">
          <rect x="2.3" y="2.3" width="5.4" height="5.4" rx="1"/>
        </svg>
        <svg v-else width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round">
          <rect x="3.2" y="1.9" width="4.9" height="4.9" rx="1"/>
          <path d="M1.9 4.1 V2.1 H3.9"/>
        </svg>
      </button>
      <button class="light close" title="关闭" @click="close">
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2.5 2.5 L7.5 7.5 M7.5 2.5 L2.5 7.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.titlebar {
  height: var(--titlebar-h);
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 0 18px;
  background: var(--bg);
  border-bottom: 1px solid var(--border-soft);
  user-select: none;
}
.brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.2px;
}
.sep {
  color: var(--text-dim);
}
.sub {
  color: var(--text-muted);
  font-size: 14px;
}
.lights {
  display: flex;
  align-items: center;
  gap: 12px;
}
.light {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: none;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  background: var(--text-dim);
  transition: background 0.15s, color 0.15s;
}
.light:hover {
  color: rgba(0, 0, 0, 0.55);
}
.light.min,
.light.max {
  background: #4a5155;
}
:root[data-theme="light"] .light.min,
:root[data-theme="light"] .light.max {
  background: #c2c8cc;
}
.light.close {
  background: #ff5f57;
}
</style>
