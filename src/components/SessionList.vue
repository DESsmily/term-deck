<script setup lang="ts">
import { store } from "@/stores/termdeck";
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: store.state.sidebarCollapsed }">
    <div class="head">
      <span v-if="!store.state.sidebarCollapsed" class="head-title">会话</span>
      <button
        class="collapse-btn"
        :title="store.state.sidebarCollapsed ? '展开会话' : '收缩会话'"
        :aria-expanded="!store.state.sidebarCollapsed"
        @click="store.toggleSidebar()"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path v-if="store.state.sidebarCollapsed" d="M9 6l6 6-6 6" />
          <path v-else d="M15 6l-6 6 6 6" />
        </svg>
      </button>
    </div>
    <ul v-show="!store.state.sidebarCollapsed" class="list">
      <li
        v-for="s in store.state.sessions"
        :key="s.id"
        class="item"
        :class="{ active: s.id === store.state.activeId, exited: s.status !== 'running' }"
        @click="store.setActive(s.id)"
      >
        <span class="dot" :class="s.status"></span>
        <span class="label" :title="s.label">{{ s.label }}</span>
        <button
          class="close"
          title="关闭终端"
          @click.stop="store.closeTerminal(s.id)"
        >
          ×
        </button>
      </li>
      <li v-if="store.state.sessions.length === 0" class="empty">
        暂无终端
      </li>
    </ul>
    <div class="foot">
      <button class="icon-btn" title="设置" @click="store.openSettings()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-w);
  flex: 0 0 var(--sidebar-w);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-soft);
  background: var(--bg);
  min-height: 0;
  transition: width 0.18s ease, flex-basis 0.18s ease;
}
.sidebar.collapsed {
  width: var(--sidebar-w-collapsed);
  flex-basis: var(--sidebar-w-collapsed);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 14px 12px 8px;
  color: var(--text-dim);
  font-size: 12px;
  letter-spacing: 0.5px;
}
.sidebar.collapsed .head {
  justify-content: center;
  padding: 14px 0 8px;
}
.head-title {
  padding-left: 4px;
}
.collapse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-dim);
}
.collapse-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.list {
  list-style: none;
  margin: 0;
  padding: 0 8px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  margin-bottom: 2px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 13px;
}
.item:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.item.active {
  background: var(--bg-elev-2);
  color: var(--text);
  box-shadow: inset 0 0 0 1px var(--border);
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: var(--accent);
}
.dot.exited,
.dot.error {
  background: var(--text-dim);
}
.label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.close {
  border: none;
  background: transparent;
  color: var(--text-dim);
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
  border-radius: 5px;
  opacity: 0;
}
.item:hover .close {
  opacity: 1;
}
.close:hover {
  color: var(--danger);
}
.empty {
  padding: 10px;
  color: var(--text-dim);
  font-size: 13px;
}
.foot {
  border-top: 1px solid var(--border-soft);
  padding: 8px;
  display: flex;
}
.sidebar.collapsed .foot {
  justify-content: center;
  padding: 8px 0;
}
</style>
