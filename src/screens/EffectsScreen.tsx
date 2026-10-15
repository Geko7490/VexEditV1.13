import { useState } from "react";
import type { Preset } from "../lib/types";
import { VIDEO_EFFECTS, AUDIO_EFFECTS } from "../lib/mock";
import * as Ic from "../components/icons";
import { Slider, Input, Primary, Ghost } from "../components/ui";

export function EffectsScreen({
  tr,
  presets,
  savePreset,
  deletePreset,
  onBack,
}: {
  tr: (k: string) => string;
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
          <img src="/images/preview-car.jpg" alt="" className="aspect-video w-full object-cover" style={{ filter: `saturate(${1 + (Number(params.value || params.amount || 0) / 200)})` }} />
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
              <div>
                <div className="text-sm">{p.name}</div>
                <div className="text-[11px] text-zinc-500">{p.effectId}</div>
              </div>
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