import { useEffect, useState } from "react";
import type { Preset, Project, Clip } from "../lib/types";
import { VIDEO_EFFECTS, AUDIO_EFFECTS } from "../lib/mock";
import { resolveMediaSource } from "../lib/mediaStore";
import * as Ic from "../components/icons";
import { Slider, Input, Primary, Ghost } from "../components/ui";

export function EffectsScreen({
  tr,
  project,
  updateClip,
  showToast,
  presets,
  savePreset,
  deletePreset,
  onBack,
}: {
  tr: (k: string) => string;
  project: Project | null;
  updateClip: (projectId: string, clipId: string, patch: Partial<Clip>) => void;
  showToast: (message: string) => void;
  presets: Preset[];
  savePreset: (effectId: string, name: string, params: Record<string, any>) => void;
  deletePreset: (id: string) => void;
  onBack: () => void;
}) {
  const all = [...VIDEO_EFFECTS, ...AUDIO_EFFECTS];
  const [id, setId] = useState(VIDEO_EFFECTS[0].id);
  const eff = all.find((e) => e.id === id)!;
  const [params, setParams] = useState<Record<string, any>>(() => {
    const p: Record<string, any> = {};
    VIDEO_EFFECTS[0].params.forEach((x) => (p[x.id] = x.value));
    return p;
  });
  const [name, setName] = useState("");
  const videoClips = project?.clips.filter((clip) => clip.type === "video" || clip.type === "image") ?? [];
  const [selectedClipId, setSelectedClipId] = useState<string | null>(videoClips[0]?.id ?? null);
  const selectedClip = videoClips.find((clip) => clip.id === selectedClipId) ?? null;
  const [previewMediaUrl, setPreviewMediaUrl] = useState("");
  useEffect(() => {
    if (!videoClips.some((clip) => clip.id === selectedClipId)) {
      setSelectedClipId(videoClips[0]?.id ?? null);
    }
  }, [project?.id, videoClips, selectedClipId]);
  useEffect(() => {
    let cancelled = false;
    const source = selectedClip?.thumb || selectedClip?.src;
    void resolveMediaSource(source).then((url) => {
      if (!cancelled) setPreviewMediaUrl(url || "");
    }).catch(() => {
      if (!cancelled) setPreviewMediaUrl("");
    });
    return () => { cancelled = true; };
  }, [selectedClip?.id, selectedClip?.src, selectedClip?.thumb]);
  const canApply = !["fx.chroma", "fx.glitch"].includes(id);

  const applyEffect = () => {
    if (!project || !selectedClip) {
      showToast("Open a project and select a video or image clip first.");
      return;
    }
    if (!canApply) {
      showToast("This effect is not supported by the current render engine yet.");
      return;
    }
    const patch: Partial<Clip> = {};
    switch (id) {
      case "fx.blur":
        patch.blur = Number(params.radius ?? params.amount ?? 0);
        break;
      case "fx.brightness":
        patch.brightness = Number(params.value ?? 0);
        break;
      case "fx.contrast":
        patch.contrast = Number(params.value ?? 0);
        break;
      case "fx.saturation":
        patch.saturation = Number(params.value ?? 0);
        break;
      case "fx.hue":
        patch.hue = Number(params.degrees ?? 0);
        break;
      case "fx.vignette":
        patch.vignette = Number(params.amount ?? 0);
        break;
    }
    if (Object.keys(patch).length === 0) return;
    updateClip(project.id, selectedClip.id, patch);
    showToast(`${eff.name} applied to ${selectedClip.name}`);
  };

  const pick = (nid: string) => {
    setId(nid);
    const e = all.find((x) => x.id === nid);
    if (!e) return;
    const p: Record<string, any> = {};
    e.params.forEach((x) => (p[x.id] = x.value));
    setParams(p);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-1 px-2 pt-2">
        <button onClick={onBack} className="flex h-10 w-10 items-center justify-center">
          <Ic.IcBack />
        </button>
        <h1 className="text-[17px] font-semibold">{tr("effectLab")}</h1>
      </header>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6">
        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
          {VIDEO_EFFECTS.map((e) => (
            <button
              key={e.id}
              onClick={() => pick(e.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] ${id === e.id ? "bg-violet-500 text-white" : "bg-white/8 text-zinc-300"}`}
            >
              {e.name}
            </button>
          ))}
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl bg-[#1c1c22] ring-1 ring-white/6">
          {selectedClip?.type === "video" && selectedClip.sourceMimeType?.startsWith("video/") && previewMediaUrl ? (
            <video
              src={previewMediaUrl}
              autoPlay
              loop
              muted
              playsInline
              className="aspect-video w-full object-cover"
              style={{ filter: previewFilter(id, params) }}
            />
          ) : (
            <img
              src={previewMediaUrl || "/images/preview-car.jpg"}
              alt=""
              className="aspect-video w-full object-cover"
              style={{ filter: previewFilter(id, params) }}
            />
          )}
        </div>
        <div className="mt-4 rounded-2xl bg-[#1c1c22] p-4 ring-1 ring-white/6">
          {eff.params.map((p) => (
            <div key={p.id} className="mb-3">
              <div className="mb-1 flex justify-between text-xs text-zinc-400">
                <span>{p.name}</span>
                <span>{params[p.id]}</span>
              </div>
              {p.type === "number" && (
                <Slider value={params[p.id]} min={p.min} max={p.max} step={p.step} onChange={(v: number) => setParams((s) => ({ ...s, [p.id]: v }))} />
              )}
            </div>
          ))}
          <div className="mb-3">
            <div className="mb-1 text-xs text-zinc-400">Apply to clip</div>
            <select
              value={selectedClipId ?? ""}
              onChange={(event) => setSelectedClipId(event.target.value || null)}
              className="w-full rounded-xl bg-[#121216] px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">No clip selected</option>
              {videoClips.map((clip) => <option key={clip.id} value={clip.id}>{clip.name}</option>)}
            </select>
            <Primary className="mt-2 w-full" disabled={!selectedClip || !canApply} onClick={applyEffect}>
              Apply effect to clip
            </Primary>
            {!canApply && <p className="mt-1 text-[10px] text-amber-300">Not yet supported by the render engine.</p>}
          </div>
          <div className="mt-2 flex gap-2">
            <Input placeholder="Preset" value={name} onChange={(e: any) => setName(e.target.value)} />
            <Primary
              onClick={() => {
                if (!name.trim()) return;
                savePreset(id, name.trim(), { ...params });
                setName("");
              }}
            >
              {tr("save")}
            </Primary>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {presets.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-2xl bg-[#1c1c22] px-3 py-2 ring-1 ring-white/6">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{p.name}</div>
                <div className="text-[11px] text-zinc-500">{p.effectId}</div>
              </div>
              <Ghost onClick={() => { pick(p.effectId); setParams({ ...p.params }); }}>
                Load
              </Ghost>
              <Ghost danger onClick={() => deletePreset(p.id)}>
                {tr("delete")}
              </Ghost>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function previewFilter(id: string, params: Record<string, any>): string {
  switch (id) {
    case "fx.blur": return `blur(${Number(params.radius || 0)}px)`;
    case "fx.brightness": return `brightness(${1 + Number(params.value || 0) / 100})`;
    case "fx.contrast": return `contrast(${1 + Number(params.value || 0) / 100})`;
    case "fx.saturation": return `saturate(${1 + Number(params.value || 0) / 100})`;
    case "fx.hue": return `hue-rotate(${Number(params.degrees || 0)}deg)`;
    default: return "none";
  }
}
