import { useState } from "react";
import type { Project, Lang } from "../lib/types";
import { timeAgo } from "../lib/store";
import * as Ic from "../components/icons";
import { Sheet, Input, Primary } from "../components/ui";

export function HomeScreen({
  tr,
  lang,
  projects,
  onNew,
  onOpen,
  onSearch,
  goStudio,
}: {
  tr: (k: string) => string;
  lang: Lang;
  projects: Project[];
  onNew: (name: string, aspect: string) => void;
  onOpen: (id: string) => void;
  onSearch: () => void;
  goStudio: (tab: "editor" | "audio" | "effects" | "modules") => void;
}) {
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState("");
  const [aspect, setAspect] = useState("9:16");


  const recent = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-5 pt-2 pb-1">
        <div className="flex items-center gap-2.5">
          <div className="text-[22px] font-extrabold tracking-tight text-violet-400">VX</div>
          <div className="text-[17px] font-semibold tracking-tight text-white">{tr("app")}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSearch}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-300"
            aria-label={tr("search")}
          >
            <Ic.IcSearch />
          </button>
          <img src="/images/avatar.jpg" alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4 pt-3">
        <div className="rounded-[26px] bg-[#1c1c22] p-3 ring-1 ring-white/5">
          <button
            onClick={() => {
              setName(lang === "tr" ? "Yeni Proje" : "New Project");
              setSheet(true);
            }}
            className="flex h-[92px] w-full items-center justify-center gap-2 rounded-[20px] bg-gradient-to-b from-violet-400 to-violet-600 text-[22px] font-semibold text-white shadow-[0_10px_28px_rgba(124,92,255,0.38)] active:scale-[0.99]"
          >
            <Ic.IcPlus size={26} />
            {tr("newProject")}
          </button>
          <p className="mt-2.5 text-center text-[12px] text-zinc-500">{tr("startCreation")}</p>

          <h2 className="mb-2.5 mt-5 px-1 text-[15px] font-semibold text-white">{tr("explore")}</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <ExploreTile icon={<Ic.IcFilm />} label={tr("videoStudio")} onClick={() => goStudio("editor")} />
            <ExploreTile icon={<Ic.IcWave />} label={tr("audio")} onClick={() => goStudio("audio")} />
            <ExploreTile icon={<Ic.IcWand />} label={tr("effects")} onClick={() => goStudio("effects")} />
            <ExploreTile icon={<Ic.IcPuzzle />} label={tr("modules")} onClick={() => goStudio("modules")} />
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between px-1">
          <h2 className="relative text-[16px] font-semibold text-white">
            {tr("recent")}
            <span className="absolute -bottom-1 left-0 h-[2px] w-10 rounded bg-violet-500" />
          </h2>
        </div>

        {recent.length === 0 ? (
          <div className="mt-8 text-center text-sm text-zinc-500">
            <div className="text-white/80">{tr("emptyProjects")}</div>
            <div className="mt-1">{tr("emptyProjectsHint")}</div>
          </div>
        ) : (
          <div className="mt-4 flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {recent.map((p, i) => (
              <button
                key={p.id}
                onClick={() => onOpen(p.id)}
                className={`relative w-[148px] shrink-0 overflow-hidden rounded-2xl bg-[#1c1c22] text-left ring-1 ${
                  i === 0 ? "ring-violet-500" : "ring-white/6"
                }`}
              >
                <div className="relative aspect-[5/4] overflow-hidden bg-zinc-800">
                  {p.cover ? (
                    <img src={p.cover} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-violet-900 to-zinc-800" />
                  )}
                  {p.id === "proj_urban" && (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-cyan-400 ring-2 ring-black/40" />
                  )}
                </div>
                <div className="px-2.5 pb-2 pt-2">
                  <div className="truncate text-[13px] font-medium text-white">{p.name}</div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    {tr("lastEdited")} {timeAgo(p.updatedAt, lang)}
                  </div>
                  <div className="mt-1 flex justify-between text-violet-400/70">
                    <Ic.IcDots size={16} />
                    <Ic.IcDots size={16} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)}>
        <h3 className="mb-3 text-base font-semibold">{tr("newProject")}</h3>
        <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder={tr("projectName")} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {["9:16", "16:9", "1:1"].map((a) => (
            <button
              key={a}
              onClick={() => setAspect(a)}
              className={`rounded-xl py-2.5 text-sm ${aspect === a ? "bg-violet-500 text-white" : "bg-white/6 text-zinc-300"}`}
            >
              {a}
            </button>
          ))}
        </div>
        <Primary
          className="mt-4 w-full"
          onClick={() => {
            onNew(name || tr("newProject"), aspect);
            setSheet(false);
          }}
        >
          {tr("create")}
        </Primary>
      </Sheet>

    </div>
  );
}

function ExploreTile({ icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-2xl bg-[#16161b] px-3 py-3.5 text-left ring-1 ring-white/5 active:scale-[0.99]"
    >
      <span className="text-violet-400">{icon}</span>
      <span className="text-[13px] font-medium text-zinc-100">{label}</span>
    </button>
  );
}