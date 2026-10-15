import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadSettings, saveSettings, loadProjects, saveProjects, loadPresets, savePresets,
  loadChains, saveChains, loadModuleState, saveModuleState, uid,
} from "./lib/store";
import { t } from "./lib/i18n";
import type {
  SettingsState, Project, ModuleInfo, Preset, AudioChain, Clip,
  RenderJob, PreviewSettings, ExportSettings, MediaAsset,
} from "./lib/types";
import { MODULE_CATALOG } from "./lib/mock";
import { TRACKS } from "./lib/demo";
import { Toast, Primary, Ghost } from "./components/ui";
import * as Ic from "./components/icons";
import { HomeScreen } from "./screens/HomeScreen";
import { ProjectsScreen } from "./screens/ProjectsScreen";
import { AssetsScreen } from "./screens/AssetsScreen";
import { EditorScreen } from "./screens/EditorScreen";
import { AudioScreen } from "./screens/AudioScreen";
import { EffectsScreen } from "./screens/EffectsScreen";
import { ModulesScreen } from "./screens/ModulesScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

type Tab = "home" | "projects" | "assets" | "settings";
type Overlay = "editor" | "audio" | "effects" | "modules" | "search" | null;

export default function App() {
  const [settings, setSettings] = useState<SettingsState>(() => loadSettings());
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets());
  const [chains, setChains] = useState<AudioChain[]>(() => loadChains());
  const [modules, setModules] = useState<ModuleInfo[]>(() => {
    const saved = loadModuleState();
    if (saved && Array.isArray(saved)) {
      return MODULE_CATALOG.map((m) => {
        const s = saved.find((x: any) => x.id === m.id);
        return s ? { ...m, ...s, status: s.status ?? m.status } : { ...m };
      });
    }
    return MODULE_CATALOG.map((m) => ({ ...m }));
  });
  const [tab, setTab] = useState<Tab>("home");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [savedFlag, setSavedFlag] = useState(true);
  const [clock, setClock] = useState(() => new Date());
  const renderTimers = useRef<Record<string, any>>({});

  const lang = settings.lang;
  const tr = (k: string) => t(lang, k);

  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { saveProjects(projects); setSavedFlag(true); }, [projects]);
  useEffect(() => { savePresets(presets); }, [presets]);
  useEffect(() => { saveChains(chains); }, [chains]);
  useEffect(() => { saveModuleState(modules); }, [modules]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const tmr = setInterval(() => setClock(new Date()), 30000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(tmr);
    };
  }, []);

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2400);
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  const createProject = useCallback((name?: string, aspect = "9:16") => {
    const res = aspect === "9:16" ? "1080x1920" : aspect === "1:1" ? "1080x1080" : "1920x1080";
    const p: Project = {
      id: uid("proj"),
      name: name || (lang === "tr" ? "Yeni Proje" : "New Project"),
      resolution: res,
      fps: settings.export.fps,
      aspect,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      clips: [],
      tracks: TRACKS.map((t) => ({ ...t })),
      modules: [],
      history: [],
      historyIndex: -1,
      cover: "/images/preview-car.jpg",
    };
    setProjects((prev) => [p, ...prev]);
    setActiveProjectId(p.id);
    setOverlay("editor");
    setSavedFlag(true);
  }, [lang, settings.export.fps]);

  const openProject = useCallback((id: string) => {
    setActiveProjectId(id);
    setOverlay("editor");
  }, []);

  const updateProject = useCallback((id: string, patch: Partial<Project>) => {
    setSavedFlag(false);
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)));
  }, []);

  const pushHistory = useCallback((id: string, label: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const snapshot = JSON.stringify({ clips: p.clips, tracks: p.tracks });
        const entry = { label, snapshot, at: Date.now() };
        const hist = p.history.slice(0, p.historyIndex + 1).concat(entry);
        const trimmed = hist.length > 50 ? hist.slice(hist.length - 50) : hist;
        return { ...p, history: trimmed, historyIndex: trimmed.length - 1, updatedAt: Date.now() };
      })
    );
  }, []);

  const undo = useCallback(() => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== activeProjectId || p.historyIndex < 0) return p;
        const idx = p.historyIndex - 1;
        let clips = p.clips, tracks = p.tracks;
        if (idx >= 0) {
          const snap = JSON.parse(p.history[idx].snapshot);
          clips = snap.clips; tracks = snap.tracks;
        }
        return { ...p, clips, tracks, historyIndex: idx, updatedAt: Date.now() };
      })
    );
  }, [activeProjectId]);

  const redo = useCallback(() => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== activeProjectId || p.historyIndex >= p.history.length - 1) return p;
        const idx = p.historyIndex + 1;
        const snap = JSON.parse(p.history[idx].snapshot);
        return { ...p, clips: snap.clips, tracks: snap.tracks, historyIndex: idx, updatedAt: Date.now() };
      })
    );
  }, [activeProjectId]);

  const addClip = useCallback((projectId: string, clip: Omit<Clip, "id">) => {
    const c: Clip = { ...clip, id: uid("clip") };
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, clips: [...p.clips, c], updatedAt: Date.now(), cover: c.thumb || p.cover } : p)));
    pushHistory(projectId, "add");
  }, [pushHistory]);

  const deleteClip = useCallback((projectId: string, clipId: string) => {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, clips: p.clips.filter((c) => c.id !== clipId), updatedAt: Date.now() } : p)));
    pushHistory(projectId, "delete");
  }, [pushHistory]);

  const duplicateClip = useCallback((projectId: string, clipId: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const c = p.clips.find((x) => x.id === clipId);
        if (!c) return p;
        const nc: Clip = { ...c, id: uid("clip"), start: c.start + c.duration + 0.1 };
        return { ...p, clips: [...p.clips, nc], updatedAt: Date.now() };
      })
    );
    pushHistory(projectId, "dup");
  }, [pushHistory]);

  const splitClip = useCallback((projectId: string, clipId: string, at: number) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const c = p.clips.find((x) => x.id === clipId);
        if (!c) return p;
        const rel = at - c.start;
        if (rel <= 0.15 || rel >= c.duration - 0.15) return p;
        const a: Clip = { ...c, duration: rel };
        const b: Clip = { ...c, id: uid("clip"), start: c.start + rel, duration: c.duration - rel };
        return { ...p, clips: p.clips.filter((x) => x.id !== clipId).concat(a, b), updatedAt: Date.now() };
      })
    );
    pushHistory(projectId, "split");
  }, [pushHistory]);

  const updateClip = useCallback((projectId: string, clipId: string, patch: Partial<Clip>) => {
    setSavedFlag(false);
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, clips: p.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)), updatedAt: Date.now() } : p)));
  }, []);

  const installModule = useCallback((id: string) => {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, status: "downloading", progress: 0, downloadedBytes: 0, speed: 0 } : m)));
  }, []);

  const moduleTimers = useRef<Record<string, any>>({});
  useEffect(() => {
    modules.forEach((m) => {
      if (m.status === "downloading" && !moduleTimers.current[m.id]) {
        let downloaded = m.downloadedBytes;
        const total = m.totalBytes;
        const timer = setInterval(() => {
          downloaded += Math.floor(Math.random() * 380000 + 180000);
          if (downloaded >= total) {
            downloaded = total;
            clearInterval(timer);
            delete moduleTimers.current[m.id];
            setModules((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: "verifying", progress: 100, downloadedBytes: total, speed: 0, eta: 0 } : x)));
            setTimeout(() => {
              setModules((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: "installing" } : x)));
              setTimeout(() => {
                setModules((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: "installed", installedAt: Date.now(), progress: 100 } : x)));
              }, 800);
            }, 600);
          } else {
            const speed = Math.floor(Math.random() * 1800000 + 400000);
            setModules((prev) => prev.map((x) => (x.id === m.id ? { ...x, downloadedBytes: downloaded, progress: (downloaded / total) * 100, speed, eta: (total - downloaded) / speed } : x)));
          }
        }, 250);
        moduleTimers.current[m.id] = timer;
      }
    });
  }, [modules]);

  const pauseModule = useCallback((id: string) => {
    const tm = moduleTimers.current[id];
    if (tm) { clearInterval(tm); delete moduleTimers.current[id]; }
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, status: "paused", speed: 0 } : m)));
  }, []);
  const resumeModule = useCallback((id: string) => {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, status: "downloading" } : m)));
  }, []);
  const cancelModule = useCallback((id: string) => {
    const tm = moduleTimers.current[id];
    if (tm) { clearInterval(tm); delete moduleTimers.current[id]; }
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, status: "not_installed", progress: 0, downloadedBytes: 0, speed: 0, eta: 0 } : m)));
  }, []);
  const retryModule = useCallback((id: string) => {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, status: "downloading", error: undefined } : m)));
  }, []);
  const removeModule = useCallback((id: string) => {
    const tm = moduleTimers.current[id];
    if (tm) { clearInterval(tm); delete moduleTimers.current[id]; }
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, status: "not_installed", progress: 0, downloadedBytes: 0, speed: 0, eta: 0, installedAt: undefined } : m)));
  }, []);
  const updateModule = useCallback((id: string) => {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, status: "downloading", progress: 0, downloadedBytes: 0 } : m)));
  }, []);

  const savePreset = useCallback((effectId: string, name: string, params: Record<string, any>) => {
    setPresets((prev) => [{ id: uid("preset"), name, effectId, params, createdAt: Date.now() }, ...prev]);
    showToast(tr("savePreset"));
  }, [showToast, tr]);
  const deletePreset = useCallback((id: string) => setPresets((prev) => prev.filter((p) => p.id !== id)), []);

  const startRender = useCallback((projectId: string) => {
    const p = projects.find((x) => x.id === projectId);
    if (!p) return;
    const exp = settings.export;
    const resMap: Record<string, string> = { "480p": "854x480", "720p": "1280x720", "1080p": "1920x1080", "2K": "2560x1440", "4K": "3840x2160" };
    const dur = Math.max(5, p.clips.reduce((a, c) => Math.max(a, c.start + c.duration), 0));
    const totalFrames = Math.round(exp.fps * dur);
    const job: RenderJob = {
      id: uid("render"),
      projectId,
      status: "PREPARING",
      progress: 0,
      eta: totalFrames / (exp.fps * 0.6),
      speed: 0,
      frame: 0,
      totalFrames,
      resolution: resMap[exp.resolution],
      fps: exp.fps,
      codec: exp.codec === "auto" ? "h264 (hw)" : exp.codec,
      createdAt: Date.now(),
    };
    setRenderJobs((prev) => [job, ...prev]);
    setTimeout(() => setRenderJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "RENDERING" } : j))), 500);
    let frame = 0;
    const timer = setInterval(() => {
      setRenderJobs((prev) => {
        const j = prev.find((x) => x.id === job.id);
        if (!j || j.status !== "RENDERING") return prev;
        frame += Math.max(1, Math.floor(exp.fps / 3));
        if (frame >= totalFrames) {
          clearInterval(timer);
          delete renderTimers.current[job.id];
          return prev.map((x) => (x.id === job.id ? { ...x, frame: totalFrames, progress: 100, status: "FINALIZING", eta: 0, speed: exp.fps } : x));
        }
        return prev.map((x) => (x.id === job.id ? { ...x, frame, progress: (frame / totalFrames) * 100, eta: (totalFrames - frame) / (exp.fps * 0.8), speed: exp.fps * 0.8 } : x));
      });
    }, 280);
    renderTimers.current[job.id] = timer;
    setTimeout(() => {
      setRenderJobs((prev) => prev.map((j) => (j.id === job.id && (j.status === "FINALIZING" || j.status === "RENDERING") ? { ...j, status: "COMPLETED", outputPath: `/exports/${projectId}.mp4`, progress: 100 } : j)));
    }, Math.min(14000, 1800 + totalFrames * 8));
  }, [projects, settings.export]);

  const pauseRender = useCallback((id: string) => {
    const tm = renderTimers.current[id];
    if (tm) { clearInterval(tm); delete renderTimers.current[id]; }
    setRenderJobs((prev) => prev.map((j) => (j.id === id && j.status === "RENDERING" ? { ...j, status: "PAUSED", pausedAt: Date.now() } : j)));
  }, []);
  const resumeRender = useCallback((id: string) => {
    setRenderJobs((prev) => prev.map((j) => (j.id === id && j.status === "PAUSED" ? { ...j, status: "RENDERING" } : j)));
  }, []);
  const cancelRender = useCallback((id: string) => {
    const tm = renderTimers.current[id];
    if (tm) { clearInterval(tm); delete renderTimers.current[id]; }
    setRenderJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "CANCELLED" } : j)));
  }, []);
  const retryRender = useCallback((id: string) => {
    const j = renderJobs.find((x) => x.id === id);
    if (j) startRender(j.projectId);
  }, [renderJobs, startRender]);

  const updatePreview = (patch: Partial<PreviewSettings>) => setSettings((s) => ({ ...s, preview: { ...s.preview, ...patch } }));
  const updateExport = (patch: Partial<ExportSettings>) => setSettings((s) => ({ ...s, export: { ...s.export, ...patch } }));

  const goStudio = (which: "editor" | "audio" | "effects" | "modules") => {
    if (which === "editor") {
      if (!activeProjectId && projects[0]) setActiveProjectId(projects[0].id);
      setOverlay("editor");
    } else setOverlay(which);
  };

  const useAsset = (asset: MediaAsset) => {
    if (!activeProjectId) {
      if (projects[0]) setActiveProjectId(projects[0].id);
    }
    const pid = activeProjectId || projects[0]?.id;
    if (!pid) {
      createProject();
      return;
    }
    addClip(pid, {
      track: asset.type === "audio" ? 3 : 2,
      type: asset.type === "audio" ? "audio" : "video",
      name: asset.name,
      start: 0,
      duration: asset.duration,
      color: asset.type === "audio" ? "#3ee0c8" : "#8b67f7",
      opacity: 1, speed: 1, reversed: false, frozen: false, effects: [],
      thumb: asset.thumb, volume: 1, x: 0, y: 0, scale: 1, rotation: 0, crop: 0,
    });
    setOverlay("editor");
    setActiveProjectId(pid);
    showToast(tr("addToTimeline"));
  };

  const showNav = overlay === null;
  const hh = clock.getHours().toString().padStart(2, "0");
  const mm = clock.getMinutes().toString().padStart(2, "0");

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#050506]">
      <div className="relative flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#111114] text-white shadow-[0_0_80px_rgba(124,92,255,0.12)]">
        {showNav && (
          <div className="flex h-7 shrink-0 items-center justify-between px-5 text-[12px] font-medium text-zinc-200">
            <span>{hh}:{mm}</span>
            <div className="flex items-center gap-1.5 text-zinc-300">
              <span className="inline-block h-2.5 w-3.5 rounded-[2px] ring-1 ring-zinc-400">
                <span className="block h-full w-[70%] bg-zinc-200" />
              </span>
            </div>
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          {overlay === null && tab === "home" && (
            <HomeScreen
              tr={tr} lang={lang} projects={projects}
              onNew={(n, a) => createProject(n, a)}
              onOpen={openProject}
              onSearch={() => setOverlay("search")}
              goStudio={goStudio}
            />
          )}
          {overlay === null && tab === "projects" && (
            <ProjectsScreen
              tr={tr} lang={lang} projects={projects}
              onOpen={openProject}
              onNew={() => createProject()}
              onDelete={(id) => setProjects((p) => p.filter((x) => x.id !== id))}
              onRename={(id, name) => updateProject(id, { name })}
              onDuplicate={(id) => {
                const src = projects.find((p) => p.id === id);
                if (!src) return;
                const copy: Project = { ...src, id: uid("proj"), name: src.name + " copy", createdAt: Date.now(), updatedAt: Date.now() };
                setProjects((p) => [copy, ...p]);
              }}
            />
          )}
          {overlay === null && tab === "assets" && <AssetsScreen tr={tr} onUse={useAsset} />}
          {overlay === null && tab === "settings" && (
            <SettingsScreen
              tr={tr} settings={settings} setSettings={setSettings}
              updatePreview={updatePreview} updateExport={updateExport}
              projects={projects} modules={modules} showToast={showToast}
            />
          )}

          {overlay === "editor" && activeProject && (
            <EditorScreen
              tr={tr} project={activeProject} settings={settings} saved={savedFlag} renderJobs={renderJobs}
              onBack={() => setOverlay(null)} onUndo={undo} onRedo={redo}
              updateProject={updateProject} addClip={addClip} deleteClip={deleteClip}
              duplicateClip={duplicateClip} splitClip={splitClip} updateClip={updateClip}
              startRender={startRender} pauseRender={pauseRender} resumeRender={resumeRender}
              cancelRender={cancelRender} retryRender={retryRender}
              updatePreview={updatePreview} updateExport={updateExport}
            />
          )}
          {overlay === "editor" && !activeProject && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
              <p className="text-sm text-zinc-400">{tr("emptyProjects")}</p>
              <Primary onClick={() => createProject()}>{tr("newProject")}</Primary>
              <Ghost onClick={() => setOverlay(null)}>{tr("close")}</Ghost>
            </div>
          )}
          {overlay === "audio" && (
            <AudioScreen tr={tr} chains={chains} setChains={setChains} savePreset={savePreset} onBack={() => setOverlay(null)} />
          )}
          {overlay === "effects" && (
            <EffectsScreen tr={tr} presets={presets} savePreset={savePreset} deletePreset={deletePreset} onBack={() => setOverlay(null)} />
          )}
          {overlay === "modules" && (
            <ModulesScreen
              tr={tr} modules={modules} online={online}
              installModule={installModule} pauseModule={pauseModule} resumeModule={resumeModule}
              cancelModule={cancelModule} retryModule={retryModule} removeModule={removeModule} updateModule={updateModule}
              onBack={() => setOverlay(null)}
            />
          )}
          {overlay === "search" && (
            <SearchOverlay tr={tr} projects={projects} onOpen={openProject} onClose={() => setOverlay(null)} />
          )}
        </div>

        {showNav && (
          <nav className="grid grid-cols-4 border-t border-white/5 bg-[#16161a] px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-1.5">
            <NavItem active={tab === "home"} label={tr("home")} onClick={() => setTab("home")} icon={tab === "home" ? <Ic.IcHome size={22} /> : <Ic.IcHomeOutline size={22} />} />
            <NavItem active={tab === "projects"} label={tr("projects")} onClick={() => setTab("projects")} icon={<Ic.IcFolder size={22} />} />
            <NavItem active={tab === "assets"} label={tr("assets")} onClick={() => setTab("assets")} icon={<Ic.IcAssets size={22} />} />
            <NavItem active={tab === "settings"} label={tr("profile")} onClick={() => setTab("settings")} icon={<Ic.IcUser size={22} />} />
          </nav>
        )}

        {!settings.onboardingDone && overlay === null && (
          <div className="absolute inset-0 z-50 flex items-end bg-black/60">
            <div className="vx-sheet w-full rounded-t-3xl bg-[#1a1a20] px-5 pb-8 pt-4">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
              <h2 className="text-lg font-semibold">{tr("onboarding")}</h2>
              <p className="mt-2 text-sm text-zinc-400">
                {onboardingStep === 0 ? tr("onboarding1") : onboardingStep === 1 ? tr("onboarding2") : tr("onboarding3")}
              </p>
              <div className="mt-5 flex items-center justify-between">
                <Ghost onClick={() => setSettings((s) => ({ ...s, onboardingDone: true }))}>{tr("skip")}</Ghost>
                {onboardingStep < 2 ? (
                  <Primary onClick={() => setOnboardingStep((x) => x + 1)}>{tr("next")}</Primary>
                ) : (
                  <Primary onClick={() => setSettings((s) => ({ ...s, onboardingDone: true }))}>{tr("done")}</Primary>
                )}
              </div>
            </div>
          </div>
        )}

        <Toast message={toast} />
      </div>
    </div>
  );
}

function NavItem({ active, label, onClick, icon }: { active: boolean; label: string; onClick: () => void; icon: any }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5">
      <span className={`flex h-8 w-14 items-center justify-center rounded-2xl ${active ? "bg-violet-500/25 text-violet-400" : "text-zinc-500"}`}>
        {icon}
      </span>
      <span className={`text-[10px] ${active ? "text-violet-300" : "text-zinc-500"}`}>{label}</span>
    </button>
  );
}

function SearchOverlay({ tr, projects, onOpen, onClose }: { tr: (k: string) => string; projects: Project[]; onOpen: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const list = projects.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex h-full flex-col bg-[#111114]">
      <div className="flex items-center gap-2 px-3 pt-3">
        <button onClick={onClose} className="flex h-10 w-10 items-center justify-center"><Ic.IcBack /></button>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("searchProjects")} className="flex-1 rounded-2xl bg-[#1c1c22] px-3 py-2 text-sm outline-none" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-3">
        {list.map((p) => (
          <button key={p.id} onClick={() => onOpen(p.id)} className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-[#1c1c22] p-2 text-left">
            <div className="h-12 w-16 overflow-hidden rounded-lg bg-zinc-800">
              {p.cover ? <img src={p.cover} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <span className="text-sm">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}