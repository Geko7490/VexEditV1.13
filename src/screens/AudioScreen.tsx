import { useState } from "react";
import type { AudioChain } from "../lib/types";
import { AUDIO_EFFECTS } from "../lib/mock";
import { waveBars } from "../lib/demo";
import * as Ic from "../components/icons";
import { Slider, Ghost, Primary } from "../components/ui";

export function AudioScreen({
  tr,
  chains,
  setChains,
  savePreset,
  onBack,
}: {
  tr: (k: string) => string;
  chains: AudioChain[];
  setChains: (fn: any) => void;
  savePreset: (effectId: string, name: string, params: Record<string, any>) => void;
  onBack: () => void;
}) {
  const [gain, setGain] = useState(0);
  const [pan, setPan] = useState(0);
  const [selected, setSelected] = useState<string | null>(chains[0]?.id || null);
  const chain = chains.find((c) => c.id === selected);
  const bars = waveBars("studio-wave", 120);

  const addEffect = (eid: string) => {
    if (!chain) return;
    const def = AUDIO_EFFECTS.find((e) => e.id === eid);
    if (!def) return;
    const params: Record<string, any> = {};
    def.params.forEach((p) => (params[p.id] = p.value));
    setChains((prev: AudioChain[]) => prev.map((c) => (c.id === chain.id ? { ...c, effects: [...c.effects, { id: eid, params }] } : c)));
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-1 px-2 pt-2">
        <button onClick={onBack} className="flex h-10 w-10 items-center justify-center">
          <Ic.IcBack />
        </button>
        <h1 className="text-[17px] font-semibold">{tr("audioStudio")}</h1>
      </header>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6">
        <div className="mt-2 overflow-hidden rounded-2xl bg-[#1c1c22] p-3 ring-1 ring-white/6">
          <div className="flex h-28 items-end gap-px">
            {bars.map((b, i) => (
              <div key={i} className="flex-1 rounded-sm bg-violet-400/80" style={{ height: `${b * 100}%` }} />
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-[#1c1c22] p-4 ring-1 ring-white/6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-400">
                <span>{tr("gain")}</span>
                <span>{gain} dB</span>
              </div>
              <Slider value={gain + 24} min={0} max={48} onChange={(v: number) => setGain(v - 24)} />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-400">
                <span>{tr("pan")}</span>
                <span>{pan}</span>
              </div>
              <Slider value={pan + 50} onChange={(v: number) => setPan(v - 50)} />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Ghost>{tr("normalize")}</Ghost>
            <Ghost>{tr("exportAudio")}</Ghost>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-[#1c1c22] p-4 ring-1 ring-white/6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{tr("chainBuilder")}</h3>
            <Ghost
              onClick={() => {
                const c = { id: "chain_" + Math.random().toString(36).slice(2, 8), name: "Chain", effects: [] };
                setChains((prev: AudioChain[]) => [c, ...prev]);
                setSelected(c.id);
              }}
            >
              +
            </Ghost>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {AUDIO_EFFECTS.map((e) => (
              <button key={e.id} onClick={() => addEffect(e.id)} className="rounded-full bg-white/8 px-2.5 py-1 text-[11px]">
                {e.name}
              </button>
            ))}
          </div>
          {chain?.effects.map((ef, idx) => {
            const def = AUDIO_EFFECTS.find((e) => e.id === ef.id);
            return (
              <div key={idx} className="mb-2 rounded-xl bg-[#121216] p-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>{def?.name}</span>
                  <button
                    className="text-xs text-rose-300"
                    onClick={() =>
                      setChains((prev: AudioChain[]) =>
                        prev.map((c) => (c.id === chain.id ? { ...c, effects: c.effects.filter((_, i) => i !== idx) } : c))
                      )
                    }
                  >
                    {tr("delete")}
                  </button>
                </div>
                {def?.params.map((p) => (
                  <div key={p.id} className="mb-2">
                    <div className="mb-0.5 flex justify-between text-[11px] text-zinc-500">
                      <span>{p.name}</span>
                      <span>{ef.params[p.id]}</span>
                    </div>
                    <Slider
                      value={Number(ef.params[p.id] ?? 0)}
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      onChange={(v: number) =>
                        setChains((prev: AudioChain[]) =>
                          prev.map((c) =>
                            c.id === chain.id
                              ? {
                                  ...c,
                                  effects: c.effects.map((e, i) => (i === idx ? { ...e, params: { ...e.params, [p.id]: v } } : e)),
                                }
                              : c
                          )
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            );
          })}
          {chain && chain.effects[0] && (
            <Primary className="mt-2 w-full" onClick={() => savePreset(chain.effects[0].id, chain.name, chain.effects[0].params)}>
              {tr("savePreset")}
            </Primary>
          )}
        </div>
        <p className="mt-4 text-xs text-zinc-500">{tr("beatDetect")}</p>
      </div>
    </div>
  );
}