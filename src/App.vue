<script setup lang="ts">
import { store } from "@/stores/termdeck";
import TitleBar from "@/components/TitleBar.vue";
import Toolbar from "@/components/Toolbar.vue";
import SessionList from "@/components/SessionList.vue";
import TerminalWorkspace from "@/components/TerminalWorkspace.vue";
import StatusBar from "@/components/StatusBar.vue";
import SettingsModal from "@/components/SettingsModal.vue";
import ProcessModal from "@/components/ProcessModal.vue";
</script>

<template>
  <div class="app">
    <TitleBar />
    <Toolbar />
    <div class="body">
      <SessionList />
      <TerminalWorkspace />
    </div>
    <StatusBar />
    <SettingsModal v-if="store.state.settingsOpen" />
    <ProcessModal v-if="store.state.processesOpen" />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
}
.body {
  display: flex;
  flex: 1;
  min-height: 0;
}
</style>
