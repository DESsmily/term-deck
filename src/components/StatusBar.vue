<script setup lang="ts">
import { computed } from "vue";
import { store } from "@/stores/termdeck";
import type { LayoutMode } from "@/types";

const LAYOUT_LABEL: Record<LayoutMode, string> = {
  grid: "网格布局",
  vertical: "垂直布局",
  horizontal: "水平布局",
};

const active = computed(() => store.activeSession.value);
const connected = computed(() => active.value?.status === "running");
</script>

<template>
  <footer class="statusbar">
    <div class="left">
      <span class="dot" :class="{ on: connected }"></span>
      <span class="txt">{{ connected ? "已连接" : "未连接" }}</span>
      <template v-if="active">
        <span class="sep">·</span>
        <span class="txt">{{ active.title }}</span>
      </template>
    </div>
    <div class="right">
      <span>{{ store.state.sessions.length }} 个终端</span>
      <span class="sep">·</span>
      <span>{{ LAYOUT_LABEL[store.state.layout] }}</span>
      <span class="sep">·</span>
      <span>UTF-8</span>
    </div>
  </footer>
</template>

<style scoped>
.statusbar {
  height: var(--statusbar-h);
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-top: 1px solid var(--border-soft);
  background: var(--bg);
  color: var(--text-muted);
  font-size: 12px;
}
.left,
.right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-dim);
}
.dot.on {
  background: var(--accent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 60%, transparent);
}
.sep {
  color: var(--text-dim);
}
</style>
