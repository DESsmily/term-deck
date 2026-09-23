<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { backend } from "@/services";
import { store } from "@/stores/termdeck";
import type { ProcessInfo } from "@/types";

const rows = ref<ProcessInfo[]>([]);
const selected = ref<Set<number>>(new Set());
const query = ref("");
const loading = ref(true);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter(
    (r) =>
      r.name.toLowerCase().includes(q) || String(r.port ?? "").includes(q),
  );
});

const allSelected = computed(
  () =>
    filtered.value.length > 0 &&
    filtered.value.every((r) => selected.value.has(r.pid)),
);

const selectedCount = computed(() => selected.value.size);

async function reload() {
  loading.value = true;
  try {
    rows.value = await backend.process.list();
    const alive = new Set(rows.value.map((r) => r.pid));
    selected.value = new Set([...selected.value].filter((p) => alive.has(p)));
  } finally {
    loading.value = false;
  }
}

function toggle(pid: number) {
  const next = new Set(selected.value);
  next.has(pid) ? next.delete(pid) : next.add(pid);
  selected.value = next;
}

function toggleAll() {
  if (allSelected.value) {
    selected.value = new Set();
  } else {
    selected.value = new Set(filtered.value.map((r) => r.pid));
  }
}

async function killPids(pids: number[]) {
  if (pids.length === 0) return;
  await backend.process.kill(pids).catch(() => {});
  await reload();
}

onMounted(reload);
</script>

<template>
  <div class="modal-overlay" @click.self="store.closeProcesses()">
    <div class="modal wide">
      <div class="modal-head">
        <h2>进程管理</h2>
        <button class="modal-close" @click="store.closeProcesses()">×</button>
      </div>

      <div class="search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7"/><path d="M20 20 L16.5 16.5"/>
        </svg>
        <input v-model="query" placeholder="搜索进程名称或端口号…" />
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="c-check">
                <input type="checkbox" :checked="allSelected" @change="toggleAll" />
              </th>
              <th>进程名称</th>
              <th>PID</th>
              <th>端口</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in filtered" :key="r.pid" :class="{ sel: selected.has(r.pid) }">
              <td class="c-check">
                <input type="checkbox" :checked="selected.has(r.pid)" @change="toggle(r.pid)" />
              </td>
              <td class="name">{{ r.name }}</td>
              <td class="mono">{{ r.pid }}</td>
              <td class="mono">{{ r.port ?? "—" }}</td>
              <td><span class="status">{{ r.status }}</span></td>
              <td>
                <button class="kill" @click="killPids([r.pid])">结束</button>
              </td>
            </tr>
            <tr v-if="!loading && filtered.length === 0">
              <td colspan="6" class="empty">没有匹配的进程</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="foot">
        <span class="count">已选 {{ selectedCount }} 项 · 共 {{ rows.length }} 个进程</span>
        <button class="btn-danger" :disabled="selectedCount === 0" @click="killPids([...selected])">
          结束选中进程
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal.wide {
  max-width: 820px;
}
.search {
  margin: 4px 24px 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
}
.search input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  outline: none;
}
.search input::placeholder {
  color: var(--text-dim);
}
.table-wrap {
  margin: 0 24px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  max-height: 46vh;
  overflow-y: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
thead th {
  text-align: left;
  font-weight: 500;
  color: var(--text-muted);
  padding: 12px 16px;
  background: var(--bg-elev-2);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
}
tbody td {
  padding: 13px 16px;
  border-bottom: 1px solid var(--border-soft);
}
tbody tr:last-child td {
  border-bottom: none;
}
tbody tr.sel {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.c-check {
  width: 44px;
}
input[type="checkbox"] {
  width: 17px;
  height: 17px;
  accent-color: var(--accent);
  cursor: pointer;
}
.name {
  font-family: var(--font-mono);
}
.mono {
  font-family: var(--font-mono);
  color: var(--text-muted);
}
.status {
  color: var(--accent);
}
.kill {
  border: none;
  background: transparent;
  color: var(--danger);
  font-size: 14px;
  padding: 4px 6px;
  border-radius: 6px;
}
.kill:hover {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
}
.empty {
  text-align: center;
  color: var(--text-dim);
  padding: 28px !important;
}
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px 22px;
}
.count {
  color: var(--text-muted);
  font-size: 14px;
}
.btn-danger:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
