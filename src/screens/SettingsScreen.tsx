import type { SettingsState, PreviewSettings, ExportSettings, Project, ModuleInfo } from "../lib/types";
import { formatBytes } from "../lib/store";
import { Field, Select, Input, Ghost } from "../components/ui";

export function SettingsScreen({
  tr,
  settings,
  setSettings,
  updatePreview,
  updateExport,
  projects,
  modules,
  showToast,
}: {
  tr: (k: string) => string;
  settings: SettingsState;
  setSettings: (fn: any) => void;
  updatePreview: (p: Partial<PreviewSettings>) => void;
  updateExport: (p: Partial<ExportSettings>) => void;
  projects: Project[];
  modules: ModuleInfo[];
  showToast: (m: string) => void;
}) {
  const installed = modules.filter((m) => m.status === "installed").reduce((a, m) => a + m.installSize, 0);
  const pv = settings.preview;
  const ex = settings.export;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 px-5 pt-3 pb-2">
        <img src="/images/avatar.jpg" alt="" className="h-11 w-11 rounded-full object-cover" />
        <div>
          <div className="text-[17px] font-semibold">Alex</div>
          <div className="text-xs text-zinc-500">{tr("offlineFirst")}</div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
        <Section title={tr("appearance")}>
          <Field label={tr("language")}>
            <Select value={settings.lang} onChange={(e: any) => setSettings((s: SettingsState) => ({ ...s, lang: e.target.value }))}>
              <option value="en">English</option>
              <option value="tr">Türkçe</option>
            </Select>
          </Field>
        </Section>

        <Section title={tr("performance")}>
          <p className="mb-3 text-[11px] leading-relaxed text-zinc-500">{tr("previewHint")}</p>
          <Field label={tr("perfProfile")}>
            <Select value={settings.perf} onChange={(e: any) => setSettings((s: SettingsState) => ({ ...s, perf: e.target.value }))}>
              <option value="low">{tr("low")}</option>
              <option value="medium">{tr("medium")}</option>
              <option value="high">{tr("high")}</option>
            </Select>
          </Field>
          <div className="mt-3">
            <Field label={tr("preview") + " · " + tr("auto")}>
              <Select value={pv.mode} onChange={(e: any) => updatePreview({ mode: e.target.value })}>
                <option value="auto">{tr("auto")}</option>
                <option value="manual">{tr("manual")}</option>
              </Select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label={tr("previewQuality")}>
              <Select value={pv.resolution} onChange={(e: any) => updatePreview({ resolution: e.target.value })}>
                <option value="360p">360p</option>
                <option value="480p">480p</option>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="original">{tr("original")}</option>
              </Select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label={tr("effectPreview")}>
              <Select value={pv.effectQuality} onChange={(e: any) => updatePreview({ effectQuality: e.target.value })}>
                <option value="fast">{tr("fast")}</option>
                <option value="balanced">{tr("balanced")}</option>
                <option value="full">{tr("full")}</option>
              </Select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label={tr("proxy")}>
              <Select value={pv.proxy} onChange={(e: any) => updatePreview({ proxy: e.target.value })}>
                <option value="auto">{tr("auto")}</option>
                <option value="always">{tr("always")}</option>
                <option value="off">{tr("off")}</option>
              </Select>
            </Field>
          </div>
        </Section>

        <Section title={tr("exportDefaults")}>
          <Field label="Resolution">
            <Select value={ex.resolution} onChange={(e: any) => updateExport({ resolution: e.target.value })}>
              {["480p", "720p", "1080p", "2K", "4K"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <div className="mt-3">
            <Field label="FPS">
              <Select value={ex.fps} onChange={(e: any) => updateExport({ fps: Number(e.target.value) as any })}>
                {[15, 24, 30, 60, 120].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Section>

        <Section title={tr("storageAnalysis")}>
          <div className="text-sm text-zinc-300">
            {tr("projects")}: {formatBytes(projects.length * 500000)}
          </div>
          <div className="text-sm text-zinc-300">
            {tr("modules")}: {formatBytes(installed)}
          </div>
          <div className="mt-3">
            <Field label={tr("storage")}>
              <Input value={settings.storageLocation} onChange={(e: any) => setSettings((s: SettingsState) => ({ ...s, storageLocation: e.target.value }))} />
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Ghost onClick={() => showToast(tr("cacheClear"))}>{tr("cacheClear")}</Ghost>
            <Ghost onClick={() => showToast(tr("backup"))}>{tr("backup")}</Ghost>
          </div>
        </Section>

        <Section title={tr("about")}>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="font-semibold text-violet-400">VX</span>
            VexEdit Studio 1.1.0
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-zinc-500">{tr("noInternetNeeded")}</p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <section className="mb-4 rounded-2xl bg-[#1c1c22] p-4 ring-1 ring-white/6">
      <h2 className="mb-3 text-[13px] font-semibold text-zinc-200">{title}</h2>
      {children}
    </section>
  );
}