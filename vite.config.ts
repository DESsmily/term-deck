import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

// Tauri expects a fixed dev port; keep this in sync with `build.devUrl`
// in src-tauri/tauri.conf.json. `clearScreen:false` keeps the Rust/Vite logs
// interleaved legibly when running `tauri dev`.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  clearScreen: false,
  server: {
    port: 30001,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 30001 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
