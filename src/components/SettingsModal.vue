<script setup lang="ts">
import { computed } from "vue";
import { backend } from "@/services";
import { candidatesFor, platformField } from "@/shells";
import { store } from "@/stores/termdeck";
import type { CloseAction, ShellId } from "@/types";

const platform = backend.platform;
const field = platformField(platform);
const rowLabel =
  platform === "windows" ? "Windows" : platform === "mac" ? "macOS" : "Linux";
const shellArg = platform === "windows" ? "windows" : "mac";

const shellOptions = computed(() => {
  const candidates = candidatesFor(platform);
  const available = store.state.availableShells;
  return available.length
    ? candidates.filter((c) => available.includes(c.id))
    : candidates;
});

const currentShell = computed(() => store.state.settings[field]);

const closeOptions: { id: CloseAction; label: string }[] = [
  { id: "tray", label: "最小化到托盘" },
  { id: "quit", label: "关闭应用程序" },
];

function pickShell(id: ShellId) {
  store.setShell(shellArg, id);
}
</script>

<template>
  <div class="modal-overlay" @click.self="store.closeSettings()">
    <div class="modal">
      <div class="modal-head">
        <h2>设置</h2>
        <button class="modal-close" @click="store.closeSettings()">×</button>
      </div>
      <div class="content">
        <div class="section-title">默认打开方式</div>
        <div class="row">
          <div class="row-label">{{ rowLabel }}</div>
          <div class="seg wide">
            <button
              v-for="o in shellOptions"
              :key="o.id"
              :class="{ active: currentShell === o.id }"
              @click="pickShell(o.id)"
            >
              {{ o.label }}
            </button>
          </div>
        </div>

        <div class="section-title">关闭操作</div>
        <div class="row">
          <div class="row-label">点击关闭</div>
          <div class="seg wide">
            <button
              v-for="o in closeOptions"
              :key="o.id"
              :class="{ active: store.state.settings.closeAction === o.id }"
              @click="store.setCloseAction(o.id)"
            >
              {{ o.label }}
            </button>
          </div>
        </div>

        <p class="note">修改后立即生效，下次新建终端时应用</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.content {
  padding: 8px 24px 28px;
}
.section-title {
  color: var(--text-muted);
  font-size: 14px;
  margin: 8px 0 20px;
}
.row {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 26px;
}
.row-label {
  width: 84px;
  font-weight: 700;
  font-size: 15px;
}
.seg.wide {
  flex-wrap: wrap;
}
.seg.wide button {
  padding: 9px 18px;
  font-size: 14px;
}
.note {
  color: var(--text-dim);
  font-size: 13px;
  margin: 4px 0 0;
}
</style>
