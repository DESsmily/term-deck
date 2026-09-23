<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { store } from "@/stores/termdeck";
import TerminalPane from "./TerminalPane.vue";

const draggingId = ref<string | null>(null);
const overId = ref<string | null>(null);

function onPointerDown(e: PointerEvent, id: string) {
  const grip = (e.target as HTMLElement).closest(".grip");
  if (!grip) return;
  draggingId.value = id;
  overId.value = null;
  e.preventDefault();
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
}

function onPointerMove(e: PointerEvent) {
  if (!draggingId.value) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const slot = el?.closest(".slot") as HTMLElement | null;
  const id = slot?.dataset.id ?? null;
  overId.value = id && id !== draggingId.value ? id : null;
}

function onPointerUp() {
  if (draggingId.value && overId.value) store.reorder(draggingId.value, overId.value);
  draggingId.value = null;
  overId.value = null;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerUp);
}

onBeforeUnmount(onPointerUp);
</script>

<template>
  <main class="workspace" :class="[`layout-${store.state.layout}`, { dragging: draggingId }]">
    <section
      v-for="s in store.state.sessions"
      :key="s.id"
      class="slot"
      :data-id="s.id"
      :class="{
        dropping: overId === s.id,
        focused: s.id === store.state.activeId,
        source: draggingId === s.id,
      }"
      @pointerdown="onPointerDown($event, s.id)"
    >
      <TerminalPane :session="s" @focus="store.setActive(s.id)" />
      <div v-if="overId === s.id" class="drop-hint">松手放置到此</div>
    </section>

    <div v-if="store.state.sessions.length === 0" class="blank">
      <button class="btn-primary" @click="store.createTerminal()">
        + 新建终端
      </button>
    </div>
  </main>
</template>

<style scoped>
.workspace {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: var(--gap);
  gap: var(--gap);
  overflow: auto;
  background: var(--bg);
}
.workspace.dragging {
  user-select: none;
  cursor: grabbing;
}
.layout-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: minmax(220px, 1fr);
}
.layout-grid .slot:only-child {
  grid-column: 1 / -1;
}
.layout-vertical {
  display: flex;
  flex-direction: column;
}
.layout-horizontal {
  display: flex;
  flex-direction: row;
}
.layout-vertical .slot,
.layout-horizontal .slot {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
}
.slot {
  position: relative;
  min-height: 200px;
  min-width: 0;
  border-radius: var(--radius);
}
.slot.source {
  opacity: 0.55;
}
.slot.dropping {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.drop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  font-size: 15px;
  background: rgba(61, 220, 132, 0.06);
  border-radius: var(--radius);
  pointer-events: none;
  z-index: 2;
}
.blank {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
