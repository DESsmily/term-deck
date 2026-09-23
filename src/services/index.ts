import { isTauri } from "./backend";
import { createTauriBackend } from "./tauriBackend";
import { createPreviewBackend } from "./previewBackend";

export * from "./backend";

/**
 * Single runtime-selected backend. Under Tauri this drives real PTYs and the
 * live process table; in a plain browser (dev preview / CI screenshots) it
 * falls back to an in-app echo shell so the UI stays fully interactive.
 */
export const backend = isTauri() ? createTauriBackend() : createPreviewBackend();
