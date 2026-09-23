import type { Platform } from "./services/backend";
import type { ShellId, ShellOption } from "./types";

/** Shell candidates offered per platform, in display order. */
export const SHELL_CANDIDATES: Record<
  "windows" | "mac" | "linux",
  ShellOption[]
> = {
  windows: [
    { id: "cmd", label: "CMD" },
    { id: "powershell", label: "Powershell" },
    { id: "git-bash", label: "Git Bash" },
  ],
  mac: [
    { id: "bash", label: "Bash" },
    { id: "zsh", label: "zsh" },
    { id: "iterm", label: "iTerm" },
  ],
  linux: [
    { id: "bash", label: "Bash" },
    { id: "zsh", label: "zsh" },
  ],
};

export const SHELL_LABELS: Record<ShellId, string> = {
  cmd: "CMD",
  powershell: "PowerShell",
  pwsh: "PowerShell 7",
  "git-bash": "Git Bash",
  bash: "bash",
  zsh: "zsh",
  iterm: "iTerm",
};

export function candidatesFor(
  platform: Platform,
): ShellOption[] {
  if (platform === "windows") return SHELL_CANDIDATES.windows;
  if (platform === "mac") return SHELL_CANDIDATES.mac;
  return SHELL_CANDIDATES.linux;
}

/** Which settings field a platform's choice lives in. */
export function platformField(
  platform: Platform,
): "windowsShell" | "macShell" {
  return platform === "windows" ? "windowsShell" : "macShell";
}
