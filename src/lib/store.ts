import type { Project, SettingsState, Preset, AudioChain, Clip } from "./types";
import { demoProjects } from "./demo";

const KEY_SETTINGS = "vexedit_settings";
const KEY_PROJECTS = "vexedit_projects";
const KEY_PRESETS = "vexedit_presets";
const KEY_CHAINS = "vexedit_chains";
const KEY_MODULES = "vexedit_modules";

export const defaultSettings: SettingsState = {
  lang: "en",
  perf: "medium",
  theme: "dark",
  onboardingDone: true,
  storageLocation: "/storage/emulated/0/VexEdit",
  catalogUrl: "https://github.com/vexedit/modules/releases/latest/download/manifest.json",
  autoSave: true,
  preview: {
    mode: "auto",
    profile: "medium",
    resolution: "720p",
    scale: 50,
    effectQuality: "balanced",
    proxy: "auto",
  },
  export: {
    resolution: "1080p",
    fps: 30,
    quality: "high",
    codec: "auto",
    bitrate: 0,
    audioBitrate: 192,
    audioSampleRate: 48000,
    estimateSizeMB: 0,
    estimateTimeSec: 0,
  },
};

export function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem(KEY_SETTINGS);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    return {
      ...defaultSettings,
      ...parsed,
      preview: { ...defaultSettings.preview, ...(parsed.preview || {}) },
      export: { ...defaultSettings.export, ...(parsed.export || {}) },
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: SettingsState) {
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
}

function normalizeClip(c: Partial<Clip> & { id: string }): Clip {
  return {
    track: 1,
    type: "video",
    name: "Clip",
    start: 0,
    duration: 3,
    color: "#8b67f7",
    opacity: 1,
    speed: 1,
    reversed: false,
    frozen: false,
    effects: [],
    volume: 1,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    crop: 0,
    ...c,
  } as Clip;
}

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(KEY_PROJECTS);
    if (!raw) {
      saveProjects(demoProjects);
      return demoProjects;
    }
    const parsed = JSON.parse(raw) as Project[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveProjects(demoProjects);
      return demoProjects;
    }
    return parsed.map((p) => ({
      ...p,
      clips: (p.clips || []).map((c) => normalizeClip(c)),
      tracks: p.tracks?.length ? p.tracks : demoProjects[0].tracks,
    }));
  } catch {
    return demoProjects;
  }
}

export function saveProjects(p: Project[]) {
  localStorage.setItem(KEY_PROJECTS, JSON.stringify(p));
}

export function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(KEY_PRESETS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
export function savePresets(p: Preset[]) {
  localStorage.setItem(KEY_PRESETS, JSON.stringify(p));
}

export function loadChains(): AudioChain[] {
  try {
    const raw = localStorage.getItem(KEY_CHAINS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
export function saveChains(c: AudioChain[]) {
  localStorage.setItem(KEY_CHAINS, JSON.stringify(c));
}

export function loadModuleState(): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(KEY_MODULES);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
export function saveModuleState(s: any) {
  localStorage.setItem(KEY_MODULES, JSON.stringify(s));
}

export function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function formatBytes(b: number): string {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + " MB";
  return (b / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

export function formatClock(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 100);
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}:${cs.toString().padStart(2, "0")}`;
}

export function timeAgo(ts: number, lang: "tr" | "en"): string {
  const d = Math.max(0, Date.now() - ts);
  const m = Math.floor(d / 60000);
  if (m < 1) return lang === "tr" ? "şimdi" : "just now";
  if (m < 60) return lang === "tr" ? `${m} dk önce` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === "tr" ? `${h} sa önce` : `${h}h ago`;
  const days = Math.floor(h / 24);
  return lang === "tr" ? `${days} g önce` : `${days}d ago`;
}