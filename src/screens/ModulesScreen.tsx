import { useState } from "react";
import type { ModuleInfo } from "../lib/types";
import { formatBytes } from "../lib/store";
import * as Ic from "../components/icons";
import { Progress, Ghost, Primary } from "../components/ui";

export function ModulesScreen({
  tr,
  modules,
  online,
  installModule,
  pauseModule,
  resumeModule,
  cancelModule,
  retryModule,
  removeModule,
  updateModule,
  onBack,
}: {
  tr: (k: string) => string;
  modules: ModuleInfo[];
  online: boolean;
  installModule: (id: string) => void;
  pauseModule: (id: string) => void;
  resumeModule: (id: string) => void;
  cancelModule: (id: string) => void;
  retryModule: (id: string) => void;
  removeModule: (id: string) => void;
  updateModule: (id: string) => void;
  onBack: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const cats = ["all", ...Array.from(new Set(modules.map((m) => m.category)))];
  const list = modules.filter((m) => filter === "all" || m.category === filter);

  const label = (s: string) => (s === "not_installed" ? tr("notInstalled") : tr(s));

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-1 px-2 pt-2">
        <button onClick={onBack} className="flex h-10 w-10 items-center justify-center">
          <Ic.IcBack />
        </button>
        <h1 className="text-[17px] font-semibold">{tr("moduleCenter")}</h1>
      </header>
      {!online && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <Ic.IcWifiOff /> {tr("offline")} — {tr("noInternetNeeded")}
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-2">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`shrink-0 rounded-full px-3 py-1 text-[12px] ${filter === c ? "bg-violet-500 text-white" : "bg-white/8 text-zinc-300"}`}
          >
            {c === "all" ? "All" : c}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6">
        <div className="space-y-2.5">
          {list.map((m) => (
            <article key={m.id} className="rounded-2xl bg-[#1c1c22] p-3.5 ring-1 ring-white/6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="mt-0.5 text-[12px] text-zinc-500">{m.description}</div>
                </div>
                <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-zinc-300">{label(m.status)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-2 text-[11px] text-zinc-500">
                <span>
                  {tr("version")} {m.version}
                </span>
                <span>{formatBytes(m.downloadSize)}</span>
                <span>{m.developer}</span>
                <span>
                  {tr("compat")} {m.coreCompat}
                </span>
              </div>
              {m.dependencies.length > 0 && (
                <div className="mt-1 text-[11px] text-amber-200/80">
                  {tr("deps")}: {m.dependencies.join(", ")}
                </div>
              )}
              {(m.status === "downloading" || m.status === "paused") && (
                <div className="mt-2">
                  <Progress value={m.progress} />
                  <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
                    <span>
                      {m.progress.toFixed(0)}% · {formatBytes(m.downloadedBytes)}/{formatBytes(m.totalBytes)}
                    </span>
                    <span>
                      {formatBytes(m.speed)}/s · {m.eta.toFixed(0)}s
                    </span>
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {m.status === "not_installed" && (
                  <Primary onClick={() => installModule(m.id)} className="!py-2 !text-xs">
                    {tr("download")}
                  </Primary>
                )}
                {m.status === "downloading" && (
                  <>
                    <Ghost onClick={() => pauseModule(m.id)}>{tr("pause")}</Ghost>
                    <Ghost danger onClick={() => cancelModule(m.id)}>
                      {tr("cancel")}
                    </Ghost>
                  </>
                )}
                {m.status === "paused" && (
                  <>
                    <Ghost onClick={() => resumeModule(m.id)}>{tr("resume")}</Ghost>
                    <Ghost danger onClick={() => cancelModule(m.id)}>
                      {tr("cancel")}
                    </Ghost>
                  </>
                )}
                {m.status === "error" && <Ghost onClick={() => retryModule(m.id)}>{tr("retry")}</Ghost>}
                {m.status === "installed" && (
                  <>
                    <Ghost onClick={() => updateModule(m.id)}>{tr("update")}</Ghost>
                    <Ghost danger onClick={() => removeModule(m.id)}>
                      {tr("remove")}
                    </Ghost>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}