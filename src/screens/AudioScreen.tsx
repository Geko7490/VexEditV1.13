import { useEffect, useState } from "react";
import type { AudioChain, Clip, Project } from "../lib/types";
import { resolveMediaSource } from "../lib/mediaStore";
import { createAudioEffectNodes } from "../lib/videoEngine";
import { AUDIO_EFFECTS } from "../lib/mock";
import { waveBars } from "../lib/demo";
import * as Ic from "../components/icons";
import { Slider, Ghost, Primary } from "../components/ui";

export function AudioScreen({
  tr,
  project,
  updateClip,
  showToast,
  chains,
  setChains,
  savePreset,
  onBack,
}: {
  tr: (k: string) => string;
  project: Project | null;
  updateClip: (projectId: string, clipId: string, patch: Partial<Clip>) => void;
  showToast: (message: string) => void;
  chains: AudioChain[];
  setChains: (fn: any) => void;
  savePreset: (effectId: string, name: string, params: Record<string, any>) => void;
  onBack: () => void;
}) {
  const audioClips = project?.clips.filter((clip) => clip.type === "audio") ?? [];
  const [gain, setGain] = useState(0);
  const [pan, setPan] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(audioClips[0]?.id ?? null);
  const [selected, setSelected] = useState<string | null>(chains[0]?.id || null);
  const selectedClip = audioClips.find((clip) => clip.id === selectedClipId) ?? null;

  useEffect(() => {
    if (!audioClips.some((clip) => clip.id === selectedClipId)) {
      setSelectedClipId(audioClips[0]?.id ?? null);
    }
  }, [project?.id, audioClips, selectedClipId]);

  useEffect(() => {
    const volume = Math.max(0.001, selectedClip?.volume ?? 1);
    setGain(Math.max(-24, Math.min(12, 20 * Math.log10(volume))));
    setPan(Math.round((selectedClip?.pan ?? 0) * 50));
  }, [selectedClipId, selectedClip?.volume, selectedClip?.pan]);
  const chain = chains.find((c) => c.id === selected);
  const bars = waveBars("studio-wave", 120);

  useEffect(() => {
    if (!chains.some((item) => item.id === selected)) setSelected(chains[0]?.id ?? null);
  }, [chains, selected]);

  const applyChainToClip = () => {
    if (!project || !selectedClip?.src || !chain) {
      showToast("Select an imported audio clip and an effect chain first.");
      return;
    }
    updateClip(project.id, selectedClip.id, {
      audioEffects: chain.effects.map((effect) => ({
        id: effect.id,
        params: { ...effect.params },
      })),
    });
    showToast(`Applied ${chain.name} to ${selectedClip.name}`);
  };

  const deleteChain = () => {
    if (!chain) return;
    setChains((previous: AudioChain[]) => previous.filter((item) => item.id !== chain.id));
    setSelected(chains.find((item) => item.id !== chain.id)?.id ?? null);
  };

  const addEffect = (eid: string) => {
    if (!chain) return;
    const def = AUDIO_EFFECTS.find((e) => e.id === eid);
    if (!def) return;
    const params: Record<string, any> = {};
    def.params.forEach((p) => (params[p.id] = p.value));
    setChains((prev: AudioChain[]) => prev.map((c) => (c.id === chain.id ? { ...c, effects: [...c.effects, { id: eid, params }] } : c)));
  };

  const normalizeSelectedAudio = async () => {
    if (!project || !selectedClip?.src) {
      showToast("Select an imported audio clip in a project first.");
      return;
    }
    let context: AudioContext | null = null;
    try {
      const source = await resolveMediaSource(selectedClip.src);
      if (!source) throw new Error("Audio source is missing.");
      const response = await fetch(source);
      if (!response.ok) throw new Error("Could not read the selected audio file.");
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      context = new AudioContextClass();
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      let peak = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
      }
      if (peak <= 0.000001) throw new Error("The selected audio is silent.");
      const normalizedVolume = Math.min(4, 0.95 / peak);
      updateClip(project.id, selectedClip.id, { volume: normalizedVolume });
      showToast("Audio gain normalized within the available headroom.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Audio normalization failed.");
    } finally {
      await context?.close().catch(() => undefined);
    }
  };

  const exportSelectedAudio = async () => {
    if (!project || !selectedClip?.src) {
      showToast("Select an imported audio clip in a project first.");
      return;
    }
    let decodeContext: AudioContext | null = null;
    try {
      const sourceUrl = await resolveMediaSource(selectedClip.src);
      if (!sourceUrl) throw new Error("Audio source is missing.");
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error("Could not read the selected audio file.");
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      decodeContext = new AudioContextClass();
      const buffer = await decodeContext.decodeAudioData(await response.arrayBuffer());
      const sourceIn = Math.max(0, selectedClip.sourceIn ?? 0);
      const speed = Math.max(0.1, Math.min(3, selectedClip.speed || 1));
      const sourceEnd = Math.min(buffer.duration, selectedClip.sourceOut ?? buffer.duration);
      const timelineDuration = Math.min(
        selectedClip.duration,
        Math.max(0, (sourceEnd - sourceIn) / speed)
      );
      if (timelineDuration <= 0) throw new Error("The selected clip has no exportable audio range.");

      const OfflineContext = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
      if (!OfflineContext) throw new Error("Offline audio rendering is not supported on this device.");
      const sampleRate = buffer.sampleRate;
      const frameCount = Math.max(1, Math.ceil(timelineDuration * sampleRate));
      const offline = new OfflineContext(2, frameCount, sampleRate);
      const node = offline.createBufferSource();
      const gainNode = offline.createGain();
      const panner = offline.createStereoPanner();
      node.buffer = buffer;
      node.playbackRate.value = speed;
      gainNode.gain.value = Math.max(0, Math.min(4, selectedClip.volume ?? 1));
      panner.pan.value = Math.max(-1, Math.min(1, selectedClip.pan ?? 0));
      node.connect(gainNode);
      let previousNode: AudioNode = gainNode;
      const effectNodes = createAudioEffectNodes(offline, selectedClip.audioEffects ?? []);
      for (const effectNode of effectNodes) {
        previousNode.connect(effectNode);
        previousNode = effectNode;
      }
      previousNode.connect(panner);
      panner.connect(offline.destination);
      node.start(0, sourceIn, Math.min(buffer.duration - sourceIn, timelineDuration * speed));

      const rendered = await offline.startRendering();
      const wav = encodeAudioBufferAsWav(rendered);
      const url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${selectedClip.name.replace(/[^a-z0-9_-]/gi, "_")}_audio.wav`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast("WAV audio export completed.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Audio export failed.");
    } finally {
      await decodeContext?.close().catch(() => undefined);
    }
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
          <div className="mb-3">
            <div className="mb-1 text-xs text-zinc-400">Audio clip</div>
            <select
              value={selectedClipId ?? ""}
              onChange={(event) => setSelectedClipId(event.target.value || null)}
              className="w-full rounded-xl bg-[#121216] px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">No audio clip selected</option>
              {audioClips.map((clip) => <option key={clip.id} value={clip.id}>{clip.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-400">
                <span>{tr("gain")}</span>
                <span>{gain} dB</span>
              </div>
              <Slider value={gain + 24} min={0} max={36} onChange={(v: number) => {
                  const nextGain = v - 24;
                  setGain(nextGain);
                  if (project && selectedClip) updateClip(project.id, selectedClip.id, { volume: Math.pow(10, nextGain / 20) });
                }} />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-400">
                <span>{tr("pan")}</span>
                <span>{pan}</span>
              </div>
              <Slider value={pan + 50} onChange={(v: number) => {
                  const nextPan = v - 50;
                  setPan(nextPan);
                  if (project && selectedClip) updateClip(project.id, selectedClip.id, { pan: nextPan / 50 });
                }} />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Ghost disabled={!selectedClip?.src} onClick={normalizeSelectedAudio}>{tr("normalize")}</Ghost>
            <Ghost disabled={!selectedClip?.src} onClick={exportSelectedAudio}>{tr("exportAudio")}</Ghost>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-[#1c1c22] p-4 ring-1 ring-white/6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{tr("chainBuilder")}</h3>
            <Ghost
              onClick={() => {
                const created = { id: "chain_" + Math.random().toString(36).slice(2, 8), name: `Chain ${chains.length + 1}`, effects: [] };
                setChains((prev: AudioChain[]) => [created, ...prev]);
                setSelected(created.id);
              }}
            >
              + New
            </Ghost>
          </div>
          <div className="mb-3 flex gap-2">
            <select
              value={selected ?? ""}
              onChange={(event) => setSelected(event.target.value || null)}
              className="min-w-0 flex-1 rounded-xl bg-[#121216] px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">No chain</option>
              {chains.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <Ghost danger disabled={!chain} onClick={deleteChain}>Delete</Ghost>
          </div>
          <Primary className="mb-3 w-full" disabled={!chain || !selectedClip?.src} onClick={applyChainToClip}>
            Apply chain to selected audio clip
          </Primary>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {AUDIO_EFFECTS.map((effect) => (
              <button
                key={effect.id}
                disabled={!chain}
                onClick={() => addEffect(effect.id)}
                className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] disabled:opacity-35"
              >
                {effect.name}
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

function encodeAudioBufferAsWav(buffer: AudioBuffer): ArrayBuffer {
  const channelCount = Math.min(2, buffer.numberOfChannels);
  const frameCount = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const output = new ArrayBuffer(44 + frameCount * blockAlign);
  const view = new DataView(output);
  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + frameCount * blockAlign, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, frameCount * blockAlign, true);

  const channels = Array.from({ length: channelCount }, (_, index) => buffer.getChannelData(index));
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return output;
}
