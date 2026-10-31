import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type {
  Clip,
  ClipKeyframe,
  Project,
  RenderJob,
  SettingsState,
  PreviewSettings,
  ExportSettings,
  MediaAsset,
  TransitionType,
  ColorFilterPreset,
} from "../lib/types";
import { formatClock, uid } from "../lib/store";
import { MEDIA_LIBRARY, waveBars } from "../lib/demo";
import { renderCompositeFrame, exportProjectToVideoFile, resumePreviewAudio } from "../lib/videoEngine";
import { resolveMediaSource, saveMediaFile } from "../lib/mediaStore";
import * as Ic from "../components/icons";
import { Sheet, Slider, Select, Field, Primary, Ghost, Progress, Input } from "../components/ui";

type Tool = "edit" | "speed" | "volume" | "effects" | "animation" | "crop" | "text" | "transitions";

export function EditorScreen(props: {
  tr: (k: string) => string;
  project: Project;
  settings: SettingsState;
  saved: boolean;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  pushHistory: (id: string, label: string) => void;
  showToast: (message: string) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  addClip: (projectId: string, clip: Omit<Clip, "id">) => void;
  deleteClip: (projectId: string, clipId: string) => void;
  duplicateClip: (projectId: string, clipId: string) => void;
  splitClip: (projectId: string, clipId: string, at: number) => void;
  updateClip: (projectId: string, clipId: string, patch: Partial<Clip>) => void;
  updatePreview: (p: Partial<PreviewSettings>) => void;
  updateExport: (p: Partial<ExportSettings>) => void;
}) {
  const { tr, project, settings, saved, onBack, onUndo, onRedo } = props;
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [tNow, setTNow] = useState(12.0);
  const [zoom, setZoom] = useState(1.05);
  const [snap, setSnap] = useState(true);
  const [ripple, setRipple] = useState(false);
  const [selected, setSelected] = useState<string | null>(project.clips.find((c) => c.track === 2)?.id ?? null);
  const [tool, setTool] = useState<Tool>("edit");
  const [addOpen, setAddOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aspectOpen, setAspectOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [activeExportJob, setActiveExportJob] = useState<RenderJob | null>(null);
  const [savingExport, setSavingExport] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [resolvedMedia, setResolvedMedia] = useState<Record<string, string>>({});
  const [previewFrameVersion, setPreviewFrameVersion] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragging = useRef<{
    id: string;
    mode: "move" | "left" | "right";
    startX: number;
    initial: Clip;
    clips: Clip[];
    changed: boolean;
  } | null>(null);
  const cancelExportRef = useRef(false);

  useEffect(() => {
    setSelected(project.clips.find((c) => c.track === 2)?.id ?? null);
  }, [project.id]);

  useEffect(() => {
    const refreshPreview = () => setPreviewFrameVersion((version) => version + 1);
    window.addEventListener("vexedit:media-frame", refreshPreview);
    return () => window.removeEventListener("vexedit:media-frame", refreshPreview);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const resolveAll = async () => {
      const entries = await Promise.all(project.clips.map(async (clip) => {
        const reference = clip.src || clip.thumb;
        try {
          const resolved = await resolveMediaSource(reference);
          return [clip.id, resolved || ""] as const;
        } catch (error) {
          console.warn("Could not restore imported media", clip.name, error);
          return [clip.id, ""] as const;
        }
      }));
      if (!cancelled) {
        setResolvedMedia((previous) => ({ ...previous, ...Object.fromEntries(entries) }));
      }
    };
    void resolveAll();
    return () => { cancelled = true; };
  }, [project.id, project.clips]);

  const duration = Math.max(15, ...project.clips.map((c) => c.start + c.duration), 1);
  const px = 38 * zoom;
  const sel = project.clips.find((c) => c.id === selected) || null;
  const localKeyframeTime = sel ? Math.max(0, Math.min(sel.duration, tNow - sel.start)) : 0;
  const keyframeTolerance = 0.5 / Math.max(1, project.fps);
  const currentKeyframe = sel?.keyframes?.find(
    (keyframe) => Math.abs(keyframe.time - localKeyframeTime) <= keyframeTolerance
  ) ?? null;

  const updateAnimatedProperty = (property: "opacity" | "scale" | "x" | "y" | "rotation", value: number) => {
    if (!sel) return;
    const patch: Partial<Clip> = { [property]: value };
    if (currentKeyframe) {
      patch.keyframes = (sel.keyframes || []).map((keyframe) =>
        Math.abs(keyframe.time - currentKeyframe.time) <= keyframeTolerance
          ? { ...keyframe, [property]: value }
          : keyframe
      );
    }
    props.updateClip(project.id, sel.id, patch);
  };

  const addOrUpdateKeyframe = () => {
    if (!sel) return;
    const nextKeyframe: ClipKeyframe = {
      time: localKeyframeTime,
      opacity: sel.opacity,
      scale: sel.scale,
      x: sel.x,
      y: sel.y,
      rotation: sel.rotation,
    };
    const keyframes = (sel.keyframes || []).filter(
      (keyframe) => Math.abs(keyframe.time - localKeyframeTime) > keyframeTolerance
    );
    keyframes.push(nextKeyframe);
    keyframes.sort((a, b) => a.time - b.time);
    props.updateClip(project.id, sel.id, { keyframes });
  };

  const deleteCurrentKeyframe = () => {
    if (!sel || !currentKeyframe) return;
    props.updateClip(project.id, sel.id, {
      keyframes: (sel.keyframes || []).filter(
        (keyframe) => Math.abs(keyframe.time - currentKeyframe.time) > keyframeTolerance
      ),
    });
  };

  // Real Canvas-based Preview Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Canvas resolution according to project aspect ratio
    let w = 640;
    let h = 360;
    if (project.aspect === "9:16") {
      w = 360;
      h = 640;
    } else if (project.aspect === "1:1") {
      w = 480;
      h = 480;
    }

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const previewProject: Project = {
      ...project,
      clips: project.clips.map((clip) => ({
        ...clip,
        src: resolvedMedia[clip.id] || clip.src,
        thumb: resolvedMedia[clip.id] || clip.thumb,
      })),
    };
    renderCompositeFrame(ctx, w, h, previewProject, tNow, {
      selectedClipId: selected,
      previewQuality: settings.preview.effectQuality,
      playing,
    });
  }, [project, tNow, selected, settings.preview.effectQuality, playing, resolvedMedia, previewFrameVersion]);

  // Real Playhead Loop
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTNow((t) => {
        let n = t + dt;
        if (n >= duration) {
          if (loop) return 0;
          setPlaying(false);
          return duration;
        }
        return n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration, loop]);

  const onRulerPointer = (e: React.PointerEvent) => {
    const el = scroller.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left + el.scrollLeft - 40;
    setTNow(Math.max(0, Math.min(duration, x / px)));
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const nextStartByTrack = new Map<number, number>();
    for (const file of files) {
      const isAudio = file.type.startsWith("audio/");
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isAudio && !isVideo && !isImage) continue;

      // Persist the original bytes in IndexedDB. The project stores a stable
      // media key rather than a temporary blob: URL that dies when the app closes.
      let persistentSource: string;
      try {
        persistentSource = await saveMediaFile(file);
      } catch (error) {
        props.showToast(error instanceof Error ? error.message : "Could not save imported media.");
        continue;
      }
      const metadataUrl = URL.createObjectURL(file);
      let mediaDuration = 5;

      if (isVideo || isAudio) {
        mediaDuration = await new Promise<number>((resolve) => {
          const media = document.createElement(isAudio ? "audio" : "video");
          media.preload = "metadata";
          media.onloadedmetadata = () => {
            const duration = media.duration;
            URL.revokeObjectURL(metadataUrl);
            resolve(Number.isFinite(duration) && duration > 0 ? duration : 5);
          };
          media.onerror = () => {
            URL.revokeObjectURL(metadataUrl);
            resolve(5);
          };
          media.src = metadataUrl;
        });
      } else {
        URL.revokeObjectURL(metadataUrl);
      }

      const clipType: Clip["type"] = isAudio ? "audio" : isImage ? "image" : "video";
      const trackId = isAudio ? 3 : 2;
      const existingEnd = project.clips
        .filter((clip) => clip.track === trackId)
        .reduce((latest, clip) => Math.max(latest, clip.start + clip.duration), tNow);
      const end = Math.max(existingEnd, nextStartByTrack.get(trackId) ?? tNow);
      nextStartByTrack.set(trackId, end + mediaDuration);

      props.addClip(project.id, {
        track: trackId,
        type: clipType,
        name: file.name.slice(0, 32),
        start: end,
        duration: mediaDuration,
        sourceDuration: isVideo || isAudio ? mediaDuration : undefined,
        sourceMimeType: file.type,
        sourceIn: isVideo || isAudio ? 0 : undefined,
        sourceOut: isVideo || isAudio ? mediaDuration : undefined,
        color: isAudio ? "#3ee0c8" : "#8b67f7",
        opacity: 1,
        speed: 1,
        reversed: false,
        frozen: false,
        effects: [],
        src: persistentSource,
        thumb: isImage ? persistentSource : undefined,
        volume: 1,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        crop: 0,
      });
    }

    setAddOpen(false);
    e.target.value = "";
  };

  const handleAddText = () => {
    const end = project.clips
      .filter((c) => c.track === 1)
      .reduce((a, c) => Math.max(a, c.start + c.duration), tNow);

    props.addClip(project.id, {
      track: 1,
      type: "text",
      name: "Title Text",
      text: "VexEdit Studio",
      textColor: "#ffffff",
      textBg: "rgba(139, 103, 247, 0.65)",
      fontSize: 28,
      start: end,
      duration: 4,
      color: "#fbbf24",
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
    });
    setAddOpen(false);
  };

  // Perform Real Video Export
  const executeRealExport = async () => {
    cancelExportRef.current = false;
    const jobId = uid("render");

    const newJob: RenderJob = {
      id: jobId,
      projectId: project.id,
      status: "RENDERING",
      progress: 0,
      eta: 10,
      speed: 30,
      frame: 0,
      totalFrames: Math.round(duration * settings.export.fps),
      resolution: settings.export.resolution,
      fps: settings.export.fps,
      codec: settings.export.codec,
      createdAt: Date.now(),
    };

    setActiveExportJob(newJob);

    try {
      const exportProject: Project = {
        ...project,
        clips: await Promise.all(project.clips.map(async (clip) => ({
          ...clip,
          src: await resolveMediaSource(clip.src),
          thumb: await resolveMediaSource(clip.thumb),
        }))),
      };
      const { downloadUrl, fileName } = await exportProjectToVideoFile(
        exportProject,
        settings.export,
        (progress, frame, totalFrames, etaSec) => {
          setActiveExportJob((prev) =>
            prev
              ? {
                  ...prev,
                  progress,
                  frame,
                  totalFrames,
                  eta: etaSec,
                }
              : null
          );
        },
        () => cancelExportRef.current
      );

      setActiveExportJob((prev) =>
        prev
          ? {
              ...prev,
              status: "COMPLETED",
              progress: 100,
              eta: 0,
              downloadBlobUrl: downloadUrl,
              outputPath: fileName,
            }
          : null
      );
    } catch (err: any) {
      if (cancelExportRef.current) {
        setActiveExportJob((prev) => (prev ? { ...prev, status: "CANCELLED" } : null));
      } else {
        setActiveExportJob((prev) =>
          prev
            ? {
                ...prev,
                status: "FAILED",
                error: err?.message || "Export failed",
              }
            : null
        );
      }
    }
  };

  const saveExportToDevice = async () => {
    if (!activeExportJob?.downloadBlobUrl || savingExport) return;
    const fileName = activeExportJob.outputPath || "VexEdit_Export.webm";
    const bridge = (window as any).VexEditAndroid;
    if (!bridge?.isAvailable?.()) {
      const anchor = document.createElement("a");
      anchor.href = activeExportJob.downloadBlobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return;
    }

    let token = "";
    setSavingExport(true);
    setSaveMessage("Preparing video for device storage…");
    try {
      const response = await fetch(activeExportJob.downloadBlobUrl);
      if (!response.ok) throw new Error("Could not read the rendered video.");
      const blob = await response.blob();
      token = bridge.beginSave(fileName, blob.type || "video/webm", blob.size);
      if (!token) throw new Error("Android could not start saving the video.");

      const chunkSize = 256 * 1024;
      for (let offset = 0; offset < blob.size; offset += chunkSize) {
        const bytes = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const accepted = bridge.appendSaveChunk(token, btoa(binary));
        if (!accepted) throw new Error("Android could not write a video chunk.");
        setSaveMessage(`Saving video… ${Math.min(100, Math.round(((offset + bytes.length) / blob.size) * 100))}%`);
      }
      if (!bridge.finishSave(token)) throw new Error("Android could not finish saving the video.");
      token = "";
      setSaveMessage("Saving to Movies/VexEdit. Android will confirm when it is complete.");
    } catch (error) {
      if (token) bridge.cancelSave(token);
      setSaveMessage(error instanceof Error ? error.message : "Could not save the video.");
    } finally {
      setSavingExport(false);
    }
  };

  const ticks: number[] = [];
  for (let s = 0; s <= duration + 0.01; s += 5) ticks.push(s);

  return (
    <div className="flex h-full flex-col bg-[#111114]">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*,audio/*"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-1 px-2">
        <button onClick={onBack} className="flex h-10 w-10 items-center justify-center text-white" aria-label="Back">
          <Ic.IcBack />
        </button>
        <div className="min-w-0 flex-1 truncate text-[16px] font-medium">{project.name}</div>
        <button onClick={onUndo} className="flex h-10 w-10 items-center justify-center text-zinc-300" aria-label={tr("undo")}>
          <Ic.IcUndo />
        </button>
        <button onClick={onRedo} className="flex h-10 w-10 items-center justify-center text-zinc-400" aria-label={tr("redo")}>
          <Ic.IcRedo />
        </button>
        <div className="mr-1 flex items-center gap-1 text-[12px] text-emerald-400">
          <Ic.IcCheck size={16} />
          {saved ? tr("saved") : tr("unsaved")}
        </div>
        <button
          onClick={() => setExportOpen(true)}
          className="mr-1 rounded-xl bg-violet-500 px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(139,103,247,0.4)]"
        >
          {tr("export")}
        </button>
      </header>

      {/* Preview Section */}
      <div className="px-3">
        <div className="relative flex items-center justify-center overflow-hidden rounded-2xl bg-black">
          <div
            className="relative flex items-center justify-center"
            style={{
              aspectRatio: project.aspect === "9:16" ? "9/16" : project.aspect === "1:1" ? "1/1" : "16/9",
              maxHeight: "34vh",
              width: "100%",
            }}
          >
            <canvas ref={canvasRef} className="h-full w-full object-contain" />

            {/* Video Controls overlay */}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8">
              <button onClick={() => setLoop((v) => !v)} className={`text-white/80 ${loop ? "text-violet-400" : ""}`}>
                <Ic.IcLoop size={18} />
              </button>
              <div className="flex items-center gap-5 text-white">
                <button onClick={() => setTNow((t) => Math.max(0, t - 2))}>
                  <Ic.IcSkipBack size={18} />
                </button>
                <button
                  onClick={() => {
                    if (!playing) void resumePreviewAudio().catch(() => undefined);
                    setPlaying((p) => !p);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition active:scale-95"
                >
                  {playing ? <Ic.IcPause size={18} /> : <Ic.IcPlay size={18} />}
                </button>
                <button onClick={() => setTNow((t) => Math.min(duration, t + 2))}>
                  <Ic.IcSkipFwd size={18} />
                </button>
              </div>
              <div className="w-16 text-right font-mono text-[11px] text-white/90">{formatClock(tNow).slice(0, 8)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Info Pill & Aspect Switcher */}
      <div className="flex justify-center gap-2 py-2">
        <button
          onClick={() => setPreviewOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1c1c22] px-3 py-1 text-[11px] text-zinc-300 ring-1 ring-white/6"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
          {tr("preview")}: {settings.preview.resolution} · {settings.preview.mode === "auto" ? tr("auto") : tr("manual")}
        </button>

        <button
          onClick={() => setAspectOpen(true)}
          className="inline-flex items-center gap-1 rounded-full bg-[#1c1c22] px-2.5 py-1 text-[11px] text-zinc-300 ring-1 ring-white/6"
        >
          <Ic.IcCrop size={12} />
          {project.aspect}
        </button>
      </div>

      {/* Editing Toolbar */}
      <div className="flex items-center gap-1 px-3 pb-1 text-[13px] text-zinc-200">
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-1 px-1 py-2 font-medium text-violet-300">
          <Ic.IcPlus size={18} /> {tr("addMedia")}
        </button>
        <button
          onClick={() => {
            if (sel) props.splitClip(project.id, sel.id, tNow);
          }}
          disabled={!sel}
          className="flex items-center gap-1 px-2 py-2 disabled:opacity-40"
        >
          <Ic.IcSplit size={18} /> {tr("split")}
        </button>
        <button onClick={() => setSnap((s) => !s)} className={`flex items-center gap-1 px-2 py-2 ${snap ? "text-violet-300" : ""}`}>
          <Ic.IcSnap size={18} /> {tr("snap")}
        </button>
        <button onClick={() => setRipple((value) => !value)} className={`flex items-center gap-1 px-2 py-2 ${ripple ? "text-violet-300" : "text-zinc-500"}`}>
          <Ic.IcLayers size={16} /> Ripple
        </button>
        <div className="ml-auto flex items-center gap-1 text-zinc-400">
          <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))} className="p-2">
            <Ic.IcZoomOut size={18} />
          </button>
          <button onClick={() => setZoom((z) => Math.min(2.4, z + 0.15))} className="p-2">
            <Ic.IcZoomIn size={18} />
          </button>
          <button onClick={() => setZoom(1.05)} className="p-2">
            <Ic.IcFit size={18} />
          </button>
        </div>
      </div>

      {/* Multi-Track Timeline */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          className="no-scrollbar h-full overflow-auto"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).dataset.role === "ruler") onRulerPointer(e);
          }}
        >
          <div className="relative" style={{ width: duration * px + 80, minHeight: "100%" }}>
            {/* Time ruler */}
            <div data-role="ruler" className="sticky top-0 z-10 h-7 bg-[#111114]" onPointerDown={onRulerPointer}>
              {ticks.map((s) => (
                <div key={s} className="absolute top-0 text-[10px] text-zinc-500" style={{ left: 40 + s * px }}>
                  <div className="h-2 w-px bg-zinc-600" />
                  {formatClock(s).slice(0, 5)}
                </div>
              ))}
            </div>

            {/* Tracks */}
            {project.tracks.map((tk) => {
              const icon =
                tk.type === "audio" ? (
                  <Ic.IcSpeaker size={14} />
                ) : tk.id === 1 ? (
                  <Ic.IcCam size={14} />
                ) : tk.id === 4 ? (
                  <Ic.IcLayers size={14} />
                ) : (
                  <Ic.IcPlay size={14} />
                );
              const h = tk.type === "video" ? 58 : tk.type === "audio" ? 44 : 36;
              return (
                <div key={tk.id} className="relative mb-1 flex items-center" style={{ height: h }}>
                  <div className="sticky left-0 z-20 flex h-full w-10 items-center justify-center bg-[#111114]">
                    <button
                      onClick={() => {
                        props.pushHistory(project.id, "track-mute:before");
                        props.updateProject(project.id, {
                          tracks: project.tracks.map((track) => (track.id === tk.id ? { ...track, muted: !track.muted } : track)),
                        });
                        props.pushHistory(project.id, "track-mute");
                      }}
                      title={tk.muted ? "Unmute track" : "Mute track"}
                      className={`flex h-full w-full items-center justify-center ${
                        tk.muted ? "text-rose-400" : "text-zinc-500"
                      }`}
                    >
                      {icon}
                    </button>
                    <button
                      onClick={() => {
                        props.pushHistory(project.id, "track-lock:before");
                        props.updateProject(project.id, {
                          tracks: project.tracks.map((track) => (track.id === tk.id ? { ...track, locked: !track.locked } : track)),
                        });
                        props.pushHistory(project.id, "track-lock");
                      }}
                      title={tk.locked ? "Unlock track" : "Lock track"}
                      className={`absolute right-0.5 top-0.5 z-30 flex h-4 w-4 items-center justify-center rounded bg-[#27232f] text-[9px] ${
                        tk.locked ? "text-amber-300" : "text-zinc-600"
                      }`}
                    >
                      {tk.locked ? "L" : "·"}
                    </button>
                  </div>
                  <div className="relative h-full flex-1">
                    {project.clips
                      .filter((c) => c.track === tk.id)
                      .map((c) => (
                        <ClipView
                          key={c.id}
                          clip={c}
                          mediaUrl={resolvedMedia[c.id] || c.thumb || c.src || ""}
                          px={px}
                          selected={selected === c.id}
                          height={h - 8}
                          locked={tk.locked}
                          onSelect={() => setSelected(c.id)}
                          onDragStart={(mode, x) => {
                            dragging.current = {
                              id: c.id,
                              mode,
                              startX: x,
                              initial: { ...c },
                              clips: project.clips.map((clip) => ({ ...clip })),
                              changed: false,
                            };
                          }}
                          onDrag={(x) => {
                            const d = dragging.current;
                            if (!d || d.id !== c.id) return;
                            const delta = (x - d.startX) / px;
                            const initial = d.initial;
                            const speed = Math.max(0.01, initial.speed || 1);
                            const trimDelta = initial.type === "image"
                              ? delta
                              : Math.round(delta * Math.max(1, project.fps)) / Math.max(1, project.fps);
                            const minDuration = initial.type === "image"
                              ? 0.01
                              : 1 / Math.max(1, project.fps);

                            if (d.mode === "move") {
                              let nextStart = Math.max(0, initial.start + delta);
                              if (snap) nextStart = Math.round(nextStart * project.fps) / project.fps;
                              if (Math.abs(nextStart - initial.start) < 0.0001) return;
                              if (!d.changed) {
                                props.pushHistory(project.id, "move");
                                d.changed = true;
                              }
                              props.updateClip(project.id, c.id, { start: nextStart });
                              return;
                            }

                            const sourceIn = Math.max(0, initial.sourceIn ?? 0);
                            const sourceOut = initial.sourceOut ??
                              (initial.sourceDuration != null ? initial.sourceDuration : sourceIn + initial.duration * speed);

                            if (d.mode === "left") {
                              const hasSourceBounds = initial.type !== "image" && (initial.sourceDuration != null || initial.sourceOut != null || initial.sourceIn != null);
                              const minDelta = hasSourceBounds
                                ? -Math.min(initial.start, sourceIn / speed)
                                : -initial.start;
                              const maxDelta = Math.max(0, initial.duration - minDuration);
                              const applied = Math.max(minDelta, Math.min(maxDelta, trimDelta));
                              if (Math.abs(applied) < 0.0001) return;
                              if (!d.changed) {
                                props.pushHistory(project.id, "trim");
                                d.changed = true;
                              }
                              const nextDuration = Math.max(minDuration, initial.duration - applied);
                              const nextKeyframes = initial.keyframes?.length
                                ? rebaseKeyframesAfterLeftTrim(initial.keyframes, applied)
                                : undefined;
                              props.updateClip(project.id, c.id, {
                                start: Math.max(0, initial.start + applied),
                                duration: nextDuration,
                                ...(hasSourceBounds ? {
                                  sourceIn: Math.max(0, sourceIn + applied * speed),
                                  sourceOut,
                                } : {}),
                                ...(nextKeyframes ? { keyframes: nextKeyframes } : {}),
                              });
                            } else {
                                const hasSourceBounds = initial.sourceDuration != null || initial.sourceOut != null || initial.sourceIn != null;
                              const sourceEndLimit = initial.sourceDuration ?? initial.sourceOut ?? sourceIn + initial.duration * speed;
                              const maxDuration = hasSourceBounds
                                ? Math.max(minDuration, (sourceEndLimit - sourceIn) / speed)
                                : 600;
                              const nextDuration = Math.max(
                                minDuration,
                                Math.min(maxDuration, initial.duration + trimDelta)
                              );
                              if (Math.abs(nextDuration - initial.duration) < 0.0001) return;
                              if (!d.changed) {
                                props.pushHistory(project.id, "trim");
                                d.changed = true;
                              }
                              const nextSourceOut = Math.min(
                                sourceIn + nextDuration * speed,
                                initial.sourceDuration ?? Number.POSITIVE_INFINITY
                              );
                              const clipPatch: Partial<Clip> = {
                                duration: nextDuration,
                                ...(hasSourceBounds ? { sourceIn, sourceOut: nextSourceOut } : {}),
                              };
                              const mainVideoTrack = project.tracks.find((track) => track.type === "video")?.id ?? 2;
                              const timelineDelta = nextDuration - initial.duration;

                              if (ripple && initial.track === mainVideoTrack) {
                                const originalEnd = initial.start + initial.duration;
                                const nextClips = d.clips.map((other) => {
                                  if (other.id === initial.id) return { ...other, ...clipPatch };
                                  if (other.track === mainVideoTrack && other.start >= originalEnd - 0.001) {
                                    return { ...other, start: Math.max(0, other.start + timelineDelta) };
                                  }
                                  return other;
                                });
                                props.updateProject(project.id, { clips: nextClips });
                              } else {
                                props.updateClip(project.id, c.id, clipPatch);
                              }
                            }
                          }}
                          onDragEnd={() => {
                            if (dragging.current?.id === c.id && dragging.current.changed) {
                              props.pushHistory(project.id, dragging.current.mode === "move" ? "move" : "trim");
                            }
                            dragging.current = null;
                          }}
                        />
                      ))}
                  </div>
                </div>
              );
            })}

            {/* Playhead marker */}
            <div className="pointer-events-none absolute top-0 bottom-0 z-30" style={{ left: 40 + tNow * px }}>
              <div className="absolute -top-0 left-1/2 h-3 w-3 -translate-x-1/2 rounded-sm bg-violet-500 shadow-[0_0_8px_rgba(139,103,247,0.8)]" />
              <div className="h-full w-[2px] bg-violet-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Contextual inspector drawer */}
      {sel && (
        <div className="max-h-48 overflow-y-auto border-t border-white/8 bg-[#181820] px-4 py-2.5">
          {tool === "edit" && (
            <div className="flex flex-wrap items-center gap-2">
              <Ghost onClick={() => props.splitClip(project.id, sel.id, tNow)}>{tr("split")}</Ghost>
              <Ghost onClick={() => props.duplicateClip(project.id, sel.id)}>{tr("duplicate")}</Ghost>
              <Ghost danger onClick={() => props.deleteClip(project.id, sel.id)}>{tr("delete")}</Ghost>
              <Ghost onClick={() => props.updateClip(project.id, sel.id, { start: Math.max(0, sel.start - 0.5) })}>◀ -0.5s</Ghost>
              <Ghost onClick={() => props.updateClip(project.id, sel.id, { start: sel.start + 0.5 })}>+0.5s ▶</Ghost>
            </div>
          )}

          {tool === "text" && (
            <div className="space-y-2">
              <Field label="Text Content">
                <Input
                  value={sel.text || sel.name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    props.updateClip(project.id, sel.id, { text: e.target.value, name: e.target.value.slice(0, 14) })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Font Size">
                  <Slider
                    value={sel.fontSize ?? 28}
                    min={14}
                    max={72}
                    onChange={(v: number) => props.updateClip(project.id, sel.id, { fontSize: v })}
                  />
                </Field>
                <Field label="Text Color">
                  <Select
                    value={sel.textColor ?? "#ffffff"}
                    onChange={(e: any) => props.updateClip(project.id, sel.id, { textColor: e.target.value })}
                  >
                    <option value="#ffffff">White</option>
                    <option value="#8b67f7">Purple</option>
                    <option value="#3ee0c8">Cyan</option>
                    <option value="#fbbf24">Yellow</option>
                    <option value="#f43f5e">Red</option>
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {tool === "speed" && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-400">
                <span>{tr("speedLabel")}</span>
                <span>{sel.speed.toFixed(2)}x</span>
              </div>
              <Slider
                value={sel.speed * 100}
                min={10}
                max={300}
                onChange={(v: number) => {
                  const nextSpeed = v / 100;
                  const sourceIn = sel.sourceIn ?? 0;
                  const sourceOut = sel.sourceOut ?? sel.sourceDuration ?? sourceIn + sel.duration * (sel.speed || 1);
                  const sourceLength = Math.max(1 / Math.max(1, project.fps), sourceOut - sourceIn);
                  props.updateClip(project.id, sel.id, {
                    speed: nextSpeed,
                    duration: sourceLength / nextSpeed,
                  });
                }}
              />
              <div className="mt-2 flex gap-2">
                <Ghost disabled={sel.type !== "video"} onClick={() => props.updateClip(project.id, sel.id, { reversed: !sel.reversed })}>
                  {tr("reverse")} {sel.reversed ? "✓" : ""}
                </Ghost>
                <Ghost onClick={() => props.updateClip(project.id, sel.id, { frozen: !sel.frozen })}>
                  {tr("freeze")} {sel.frozen ? "✓" : ""}
                </Ghost>
              </div>
            </div>
          )}

          {tool === "volume" && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-400">
                <span>{tr("volume")}</span>
                <span>{Math.round((sel.volume ?? 1) * 100)}%</span>
              </div>
              <Slider
                value={Math.round((sel.volume ?? 1) * 100)}
                min={0}
                max={200}
                onChange={(v: number) => props.updateClip(project.id, sel.id, { volume: v / 100 })}
              />
            </div>
          )}

          {tool === "effects" && (
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-zinc-400">Color Grading & Presets</div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["none", "Original"],
                    ["teal_orange", "Teal & Orange"],
                    ["cyberpunk", "Cyberpunk"],
                    ["noir", "Noir (B&W)"],
                    ["vintage", "Vintage"],
                    ["golden", "Golden Hour"],
                    ["vivid", "Vivid"],
                  ] as [ColorFilterPreset, string][]
                ).map(([pKey, pLabel]) => (
                  <button
                    key={pKey}
                    onClick={() => props.updateClip(project.id, sel.id, { filterPreset: pKey })}
                    className={`rounded-full px-2.5 py-1 text-[11px] ${
                      (sel.filterPreset ?? "none") === pKey ? "bg-violet-500 text-white" : "bg-white/8 text-zinc-300"
                    }`}
                  >
                    {pLabel}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[10px] text-zinc-400">Brightness ({(sel.brightness ?? 0)}%)</span>
                  <Slider
                    value={(sel.brightness ?? 0) + 100}
                    min={0}
                    max={200}
                    onChange={(v: number) => props.updateClip(project.id, sel.id, { brightness: v - 100 })}
                  />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400">Contrast ({(sel.contrast ?? 0)}%)</span>
                  <Slider
                    value={(sel.contrast ?? 0) + 100}
                    min={0}
                    max={200}
                    onChange={(v: number) => props.updateClip(project.id, sel.id, { contrast: v - 100 })}
                  />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400">Saturation ({(sel.saturation ?? 0)}%)</span>
                  <Slider
                    value={(sel.saturation ?? 0) + 100}
                    min={0}
                    max={200}
                    onChange={(v: number) => props.updateClip(project.id, sel.id, { saturation: v - 100 })}
                  />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400">Vignette ({(sel.vignette ?? 0)}%)</span>
                  <Slider
                    value={sel.vignette ?? 0}
                    min={0}
                    max={100}
                    onChange={(v: number) => props.updateClip(project.id, sel.id, { vignette: v })}
                  />
                </div>
              </div>
            </div>
          )}

          {tool === "transitions" && (
            <div>
              <div className="mb-2 text-xs text-zinc-400">Clip Transitions</div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["none", "None"],
                    ["fade", "Fade"],
                    ["dissolve", "Dissolve"],
                    ["wipe", "Wipe"],
                    ["zoom", "Zoom"],
                  ] as [TransitionType, string][]
                ).map(([tKey, tLabel]) => (
                  <button
                    key={tKey}
                    onClick={() => props.updateClip(project.id, sel.id, { transition: tKey })}
                    className={`rounded-xl px-3 py-1.5 text-xs ${
                      (sel.transition ?? "none") === tKey ? "bg-violet-500 text-white" : "bg-white/8 text-zinc-300"
                    }`}
                  >
                    {tLabel}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tool === "animation" && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Ghost onClick={addOrUpdateKeyframe}>
                  {currentKeyframe ? "Update Keyframe" : "Add Keyframe"}
                </Ghost>
                <Ghost danger disabled={!currentKeyframe} onClick={deleteCurrentKeyframe}>
                  Delete
                </Ghost>
                <span className="text-[10px] text-zinc-500">
                  {(sel.keyframes || []).length} keyframes · {localKeyframeTime.toFixed(2)}s
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-xs text-zinc-400">{tr("opacity")}</div>
                  <Slider
                    value={sel.opacity * 100}
                    onChange={(v: number) => updateAnimatedProperty("opacity", v / 100)}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-zinc-400">{tr("scale")}</div>
                  <Slider
                    value={sel.scale * 100}
                    min={10}
                    max={250}
                    onChange={(v: number) => updateAnimatedProperty("scale", v / 100)}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-zinc-400">X Position</div>
                  <Slider
                    value={sel.x + 50}
                    min={0}
                    max={100}
                    onChange={(v: number) => updateAnimatedProperty("x", v - 50)}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-zinc-400">Y Position</div>
                  <Slider
                    value={sel.y + 50}
                    min={0}
                    max={100}
                    onChange={(v: number) => updateAnimatedProperty("y", v - 50)}
                  />
                </div>
                <div className="col-span-2">
                  <div className="mb-1 text-xs text-zinc-400">Rotation</div>
                  <Slider
                    value={sel.rotation + 180}
                    min={0}
                    max={360}
                    onChange={(v: number) => updateAnimatedProperty("rotation", v - 180)}
                  />
                </div>
              </div>
            </div>
          )}

          {tool === "crop" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 flex justify-between text-xs text-zinc-400"><span>Crop / Zoom</span><span>{sel.crop ?? 0}%</span></div>
                <Slider
                  value={sel.crop ?? 0}
                  min={0}
                  max={60}
                  onChange={(v: number) => props.updateClip(project.id, sel.id, { crop: v })}
                />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-zinc-400"><span>{tr("rotation")}</span><span>{sel.rotation}°</span></div>
                <Slider
                  value={sel.rotation + 180}
                  min={0}
                  max={360}
                  onChange={(v: number) => props.updateClip(project.id, sel.id, { rotation: v - 180 })}
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-zinc-400">X Position</div>
                <Slider
                  value={sel.x + 50}
                  min={0}
                  max={100}
                  onChange={(v: number) => props.updateClip(project.id, sel.id, { x: v - 50 })}
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-zinc-400">Y Position</div>
                <Slider
                  value={sel.y + 50}
                  min={0}
                  max={100}
                  onChange={(v: number) => props.updateClip(project.id, sel.id, { y: v - 50 })}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Tool Selector Bar */}
      <nav className="grid grid-cols-7 border-t border-white/5 bg-[#16161a] px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-1">
        {(
          [
            ["edit", tr("edit"), Ic.IcPencil],
            ["text", "Text", Ic.IcLayers],
            ["speed", tr("speedLabel"), Ic.IcGauge],
            ["volume", tr("volume"), Ic.IcSpeaker],
            ["effects", tr("effects"), Ic.IcSpark],
            ["transitions", "FX", Ic.IcWand],
            ["crop", tr("crop"), Ic.IcCrop],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTool(id)}
            className={`flex flex-col items-center gap-0.5 py-1.5 text-[10px] ${tool === id ? "text-violet-400" : "text-zinc-500"}`}
          >
            <Icon size={19} />
            {label}
          </button>
        ))}
      </nav>

      {/* Add Media Sheet */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)}>
        <div className="flex items-center justify-between pb-3">
          <h3 className="text-base font-semibold">{tr("addMedia")}</h3>
          <Primary onClick={() => fileInputRef.current?.click()} className="!py-1.5 !px-3 !text-xs">
            + Upload from Device
          </Primary>
        </div>

        <div className="mb-3 flex gap-2">
          <Ghost onClick={handleAddText} className="flex-1 !py-2 !text-xs">
            + Add Text Title
          </Ghost>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {MEDIA_LIBRARY.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                addPresetMedia(props, project, m, tNow);
                setAddOpen(false);
              }}
              className="overflow-hidden rounded-xl bg-[#121216] text-left transition hover:ring-1 hover:ring-violet-400"
            >
              <div className="aspect-video bg-zinc-800">
                {m.thumb ? (
                  <img src={m.thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-cyan-400">
                    <Ic.IcSpeaker />
                  </div>
                )}
              </div>
              <div className="px-2 py-1.5 text-[12px] text-zinc-200">{m.name}</div>
            </button>
          ))}
        </div>
      </Sheet>

      {/* Aspect Ratio Switcher Sheet */}
      <Sheet open={aspectOpen} onClose={() => setAspectOpen(false)}>
        <h3 className="mb-3 font-semibold">Aspect Ratio (Format)</h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "9:16", name: "9:16 (Shorts/TikTok)" },
            { id: "16:9", name: "16:9 (Landscape)" },
            { id: "1:1", name: "1:1 (Square)" },
          ].map((asp) => (
            <button
              key={asp.id}
              onClick={() => {
                props.updateProject(project.id, { aspect: asp.id });
                setAspectOpen(false);
              }}
              className={`rounded-2xl p-3 text-center text-xs font-medium ${
                project.aspect === asp.id ? "bg-violet-500 text-white" : "bg-white/8 text-zinc-300"
              }`}
            >
              {asp.name}
            </button>
          ))}
        </div>
      </Sheet>

      {/* Preview Settings Sheet */}
      <Sheet open={previewOpen} onClose={() => setPreviewOpen(false)}>
        <h3 className="mb-1 font-semibold">{tr("preview")}</h3>
        <p className="mb-3 text-xs text-zinc-500">{tr("previewHint")}</p>
        <Field label={tr("auto") + " / " + tr("manual")}>
          <Select value={settings.preview.mode} onChange={(e: any) => props.updatePreview({ mode: e.target.value })}>
            <option value="auto">{tr("auto")}</option>
            <option value="manual">{tr("manual")}</option>
          </Select>
        </Field>
        <div className="mt-3">
          <Field label={tr("previewQuality")}>
            <Select
              value={settings.preview.resolution}
              onChange={(e: any) => props.updatePreview({ resolution: e.target.value, mode: "manual" })}
            >
              <option value="360p">360p</option>
              <option value="480p">480p</option>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="original">{tr("original")}</option>
            </Select>
          </Field>
        </div>
      </Sheet>

      {/* Real Video Export Sheet */}
      <Sheet open={exportOpen} onClose={() => setExportOpen(false)}>
        <h3 className="mb-3 text-lg font-semibold">{tr("export")}</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Resolution">
            <Select
              value={settings.export.resolution}
              onChange={(e: any) => props.updateExport({ resolution: e.target.value })}
            >
              {["480p", "720p", "1080p", "2K", "4K"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="FPS">
            <Select
              value={settings.export.fps}
              onChange={(e: any) => props.updateExport({ fps: Number(e.target.value) as any })}
            >
              {[15, 24, 30, 60, 120].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <button onClick={() => setAdvanced((a) => !a)} className="mt-3 text-xs text-violet-300">
          {tr("advanced")}
        </button>

        {advanced && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label={tr("quality")}>
              <Select
                value={settings.export.quality}
                onChange={(e: any) => props.updateExport({ quality: e.target.value })}
              >
                <option value="saver">{tr("saver")}</option>
                <option value="balanced">{tr("balanced")}</option>
                <option value="high">{tr("high")}</option>
                <option value="max">{tr("max")}</option>
              </Select>
            </Field>
            <Field label={tr("codec")}>
              <Select
                value={settings.export.codec}
                onChange={(e: any) => props.updateExport({ codec: e.target.value })}
              >
                <option value="auto">Auto · {tr("hwEncode")}</option>
                <option value="h264">H.264</option>
                <option value="h265">H.265</option>
                <option value="av1">AV1</option>
              </Select>
            </Field>
          </div>
        )}

        <p className="mt-2 text-[11px] text-zinc-500">
          Duration: {duration.toFixed(1)}s · Est: ~{Math.max(4, Math.round(duration * settings.export.fps * 0.05))} MB
        </p>

        {activeExportJob ? (
          <div className="mt-4 rounded-xl bg-[#121216] p-3">
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="font-medium text-violet-300">
                {activeExportJob.status === "RENDERING" ? "Rendering Video..." : activeExportJob.status}
              </span>
              <span className="text-zinc-400">
                {activeExportJob.progress.toFixed(0)}% · {activeExportJob.eta.toFixed(0)}s left
              </span>
            </div>
            <Progress value={activeExportJob.progress} />
            {activeExportJob.status === "FAILED" && activeExportJob.error && (
              <p className="mt-2 text-xs text-rose-300">{activeExportJob.error}</p>
            )}
            <div className="mt-3 flex gap-2">
              {activeExportJob.status === "RENDERING" && (
                <Ghost
                  danger
                  onClick={() => {
                    cancelExportRef.current = true;
                  }}
                >
                  {tr("cancel")}
                </Ghost>
              )}
              {activeExportJob.status === "COMPLETED" && activeExportJob.downloadBlobUrl && (
                <div className="w-full space-y-2">
                  <Primary className="w-full !bg-emerald-600" disabled={savingExport} onClick={saveExportToDevice}>
                    <Ic.IcCheck size={18} /> {savingExport ? "Saving…" : "Save to device"}
                  </Primary>
                  {saveMessage && <p className="text-center text-[11px] text-zinc-400">{saveMessage}</p>}
                  <a
                    href={activeExportJob.downloadBlobUrl}
                    download={activeExportJob.outputPath || "VexEdit_Export.webm"}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-white/8 px-3 py-2 text-xs text-zinc-300"
                  >
                    Download file
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Primary className="mt-4 w-full" onClick={executeRealExport}>
            Start Video Export
          </Primary>
        )}
      </Sheet>
    </div>
  );
}

function addPresetMedia(props: any, project: Project, m: MediaAsset, at: number) {
  const end = project.clips.filter((c) => c.track === 2).reduce((a, c) => Math.max(a, c.start + c.duration), at);
  props.addClip(project.id, {
    track: m.type === "audio" ? 3 : 2,
    type: m.type === "audio" ? "audio" : "video",
    name: m.name,
    start: end,
    duration: m.duration,
    color: m.type === "audio" ? "#3ee0c8" : "#8b67f7",
    opacity: 1,
    speed: 1,
    reversed: false,
    frozen: false,
    effects: [],
    thumb: m.thumb,
    src: m.src || m.thumb,
    volume: 1,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    crop: 0,
  });
}

function rebaseKeyframesAfterLeftTrim(
  keyframes: ClipKeyframe[],
  removedTimelineSeconds: number
): ClipKeyframe[] {
  const originalTime = Math.max(0, removedTimelineSeconds);
  const properties = ["opacity", "scale", "x", "y", "rotation"] as const;
  const boundary: ClipKeyframe = { time: 0 };

  for (const property of properties) {
    const points = keyframes
      .filter((keyframe) => typeof keyframe[property] === "number")
      .slice()
      .sort((left, right) => left.time - right.time);
    if (points.length === 0) continue;

    let value = points[0][property] as number;
    if (originalTime >= points[points.length - 1].time) {
      value = points[points.length - 1][property] as number;
    } else if (originalTime > points[0].time) {
      for (let index = 0; index < points.length - 1; index++) {
        const left = points[index];
        const right = points[index + 1];
        if (originalTime >= left.time && originalTime <= right.time) {
          const ratio = (originalTime - left.time) / Math.max(0.000001, right.time - left.time);
          value = (left[property] as number) + ((right[property] as number) - (left[property] as number)) * ratio;
          break;
        }
      }
    }
    boundary[property] = value;
  }

  const shifted = keyframes
    .map((keyframe) => ({ ...keyframe, time: keyframe.time - removedTimelineSeconds }))
    .filter((keyframe) => keyframe.time > 0);
  return [boundary, ...shifted].sort((left, right) => left.time - right.time);
}

function ClipView({
  clip,
  mediaUrl,
  locked = false,
  px,
  selected,
  height,
  onSelect,
  onDragStart,
  onDrag,
  onDragEnd,
}: {
  clip: Clip;
  mediaUrl: string;
  locked?: boolean;
  px: number;
  selected: boolean;
  height: number;
  onSelect: () => void;
  onDragStart: (mode: "move" | "left" | "right", x: number) => void;
  onDrag: (x: number) => void;
  onDragEnd: () => void;
}) {
  const bars = clip.type === "audio" ? waveBars(clip.id, 48) : [];
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
        if (locked) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const handle = (e.target as HTMLElement).closest<HTMLElement>("[data-trim-edge]");
        const edge = handle?.dataset.trimEdge;
        onDragStart(edge === "left" || edge === "right" ? edge : "move", e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons !== 1) return;
        onDrag(e.clientX);
      }}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      className={`absolute top-1 overflow-hidden rounded-[10px] ${locked ? "cursor-not-allowed opacity-75" : ""} ${
        selected ? "ring-[2.5px] ring-violet-400" : "ring-1 ring-black/40"
      }`}
      style={{
        left: clip.start * px,
        width: Math.max(28, clip.duration * px),
        height,
        touchAction: "none",
        background: clip.type === "audio" ? "#1b2430" : clip.type === "text" ? "#372c14" : "#1a1a22",
      }}
    >
      {(clip.thumb || clip.src) && clip.type !== "audio" ? (
        clip.type === "video" && clip.sourceMimeType?.startsWith("video/") ? (
          <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
        ) : (
          <img src={mediaUrl} alt="" className="h-full w-full object-cover" draggable={false} />
        )
      ) : clip.type === "audio" ? (
        <div className="flex h-full items-end gap-px px-1 py-1">
          {bars.map((b, i) => (
            <div key={i} className="flex-1 rounded-sm bg-cyan-400/80" style={{ height: `${b * 100}%` }} />
          ))}
        </div>
      ) : clip.type === "text" ? (
        <div className="flex h-full items-center justify-center px-1 text-[10px] font-bold text-amber-300">
          {clip.text || clip.name}
        </div>
      ) : (
        <div className="h-full w-full bg-violet-800/40" />
      )}
      {clip.keyframes && clip.keyframes.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1.5">
          {clip.keyframes.map((keyframe, index) => (
            <div
              key={index}
              className="absolute top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-amber-300 shadow"
              style={{ left: `${Math.max(0, Math.min(100, (keyframe.time / Math.max(0.01, clip.duration)) * 100))}%` }}
            />
          ))}
        </div>
      )}
      {selected && !locked && (
        <>
          <div
            data-trim-edge="left"
            className="absolute inset-y-0 left-0 z-20 w-3 cursor-ew-resize border-r-2 border-white/90 bg-violet-400/80"
            style={{ touchAction: "none" }}
          />
          <div
            data-trim-edge="right"
            className="absolute inset-y-0 right-0 z-20 w-3 cursor-ew-resize border-l-2 border-white/90 bg-violet-400/80"
            style={{ touchAction: "none" }}
          />
        </>
      )}
    </div>
  );
}
