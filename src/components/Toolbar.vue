<script setup lang="ts">
import { store } from "@/stores/termdeck";
import type { LayoutMode } from "@/types";

const layouts: { id: LayoutMode; label: string }[] = [
  { id: "grid", label: "网格" },
  { id: "vertical", label: "垂直" },
  { id: "horizontal", label: "水平" },
];
</script>

<template>
  <div class="toolbar">
    <div class="left">
      <button class="btn-primary" @click="store.createTerminal()">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M7 1.5 V12.5 M1.5 7 H12.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        新建终端
      </button>
    </div>

    <div class="center">
      <div class="seg">
        <button
          v-for="l in layouts"
          :key="l.id"
          :class="{ active: store.state.layout === l.id }"
          @click="store.setLayout(l.id)"
        >
          {{ l.label }}
        </button>
      </div>
    </div>

    <div class="right">
      <button class="icon-btn" title="进程管理" @click="store.openProcesses()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7"/><path d="M20 20 L16.5 16.5"/>
        </svg>
      </button>
      <button class="icon-btn" :title="store.state.theme === 'dark' ? '切换到浅色' : '切换到深色'" @click="store.toggleTheme()">
        <svg v-if="store.state.theme === 'dark'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  height: var(--toolbar-h);
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 18px;
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg);
}
.left {
  justify-self: start;
}
.center {
  justify-self: center;
}
.right {
  justify-self: end;
  display: flex;
  gap: 4px;
}
</style>
