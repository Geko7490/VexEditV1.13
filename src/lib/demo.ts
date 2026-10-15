import type { Project, MediaAsset, Clip, Track } from "./types";

export const TRACKS: Track[] = [
  { id: 1, name: "Overlay", type: "overlay", muted: false, locked: false, volume: 1 },
  { id: 2, name: "Video", type: "video", muted: false, locked: false, volume: 1 },
  { id: 3, name: "Audio", type: "audio", muted: false, locked: false, volume: 1 },
  { id: 4, name: "Layer", type: "overlay", muted: false, locked: false, volume: 1 },
];

function clip(partial: Partial<Clip> & { id: string }): Clip {
  return {
    track: 2,
    type: "video",
    name: "Clip",
    start: 0,
    duration: 4,
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
    ...partial,
  };
}

const now = Date.now();

export const demoProjects: Project[] = [
  {
    id: "proj_midnight",
    name: "Midnight Edit",
    resolution: "1920x1080",
    fps: 30,
    aspect: "16:9",
    createdAt: now - 1000 * 60 * 60 * 4,
    updatedAt: now - 1000 * 60 * 60 * 3,
    cover: "/images/preview-car.jpg",
    modules: [],
    history: [],
    historyIndex: -1,
    tracks: TRACKS.map((t) => ({ ...t })),
    clips: [
      clip({
        id: "c_ov1",
        track: 1,
        type: "overlay",
        name: "B-roll",
        start: 18.2,
        duration: 5.4,
        thumb: "/images/clip-alley.jpg",
      }),
      clip({
        id: "c_v1",
        track: 2,
        name: "Street",
        start: 1.6,
        duration: 6.4,
        thumb: "/images/clip-city.jpg",
      }),
      clip({
        id: "c_v2",
        track: 2,
        name: "Drive",
        start: 8.2,
        duration: 7.2,
        thumb: "/images/preview-car.jpg",
        effects: ["fx.vignette"],
      }),
      clip({
        id: "c_v3",
        track: 2,
        name: "Alley",
        start: 15.6,
        duration: 6.8,
        thumb: "/images/neon-street.jpg",
      }),
      clip({
        id: "c_a1",
        track: 3,
        type: "audio",
        name: "Score",
        start: 0,
        duration: 28,
        color: "#3ee0c8",
      }),
    ],
  },
  {
    id: "proj_vlog",
    name: "Morning Vlog",
    resolution: "1920x1080",
    fps: 30,
    aspect: "16:9",
    createdAt: now - 1000 * 60 * 80,
    updatedAt: now - 1000 * 60 * 60,
    cover: "/images/vlog.jpg",
    modules: [],
    history: [],
    historyIndex: -1,
    tracks: TRACKS.map((t) => ({ ...t })),
    clips: [
      clip({
        id: "c_vg1",
        name: "Valley",
        start: 0,
        duration: 8,
        thumb: "/images/vlog.jpg",
      }),
    ],
  },
  {
    id: "proj_urban",
    name: "Urban Beat Drop",
    resolution: "1080x1920",
    fps: 30,
    aspect: "9:16",
    createdAt: now - 1000 * 60 * 60 * 6,
    updatedAt: now - 1000 * 60 * 60 * 5,
    cover: "/images/urban.jpg",
    modules: [],
    history: [],
    historyIndex: -1,
    tracks: TRACKS.map((t) => ({ ...t })),
    clips: [
      clip({
        id: "c_ub1",
        name: "Talking head",
        start: 0,
        duration: 12,
        thumb: "/images/urban.jpg",
      }),
    ],
  },
  {
    id: "proj_sunset",
    name: "Sunset Edit",
    resolution: "1920x1080",
    fps: 24,
    aspect: "16:9",
    createdAt: now - 1000 * 60 * 60 * 50,
    updatedAt: now - 1000 * 60 * 60 * 48,
    cover: "/images/sunset.jpg",
    modules: [],
    history: [],
    historyIndex: -1,
    tracks: TRACKS.map((t) => ({ ...t })),
    clips: [
      clip({
        id: "c_ss1",
        name: "Set",
        start: 0,
        duration: 10,
        thumb: "/images/sunset.jpg",
      }),
    ],
  },
];

export const MEDIA_LIBRARY: MediaAsset[] = [
  { id: "m1", name: "Neon Drive", type: "video", thumb: "/images/preview-car.jpg", duration: 8 },
  { id: "m2", name: "City Rain", type: "video", thumb: "/images/clip-city.jpg", duration: 6 },
  { id: "m3", name: "Alley Fog", type: "video", thumb: "/images/clip-alley.jpg", duration: 5 },
  { id: "m4", name: "Wet Neon", type: "video", thumb: "/images/neon-wet.jpg", duration: 7 },
  { id: "m5", name: "Night Street", type: "video", thumb: "/images/neon-street.jpg", duration: 6 },
  { id: "m6", name: "Sports Night", type: "video", thumb: "/images/sports-car.jpg", duration: 5 },
  { id: "m7", name: "Valley", type: "video", thumb: "/images/vlog.jpg", duration: 9 },
  { id: "m8", name: "Talking Head", type: "video", thumb: "/images/urban.jpg", duration: 11 },
  { id: "m9", name: "Club Set", type: "video", thumb: "/images/sunset.jpg", duration: 8 },
  { id: "m10", name: "Night Pulse", type: "audio", thumb: "", duration: 24 },
];

export function waveBars(seed: string, n = 96): number[] {
  let s = 2166136261;
  for (let i = 0; i < seed.length; i++) s = Math.imul(s ^ seed.charCodeAt(i), 16777619);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    s = Math.imul(s ^ (s >>> 13), 1274126177);
    const a = ((s >>> 0) % 1000) / 1000;
    const env = 0.35 + 0.65 * Math.abs(Math.sin(i / 7.5));
    out.push(0.12 + a * env * 0.88);
  }
  return out;
}