import { useState } from "react";
import type { Project, Lang } from "../lib/types";
import { timeAgo } from "../lib/store";
import * as Ic from "../components/icons";
import { Sheet, Input, Ghost, Primary } from "../components/ui";

export function ProjectsScreen({
  tr,
  lang,
  projects,
  onOpen,
  onNew,
  onDelete,
  onRename,
  onDuplicate,
}: {
  tr: (k: string) => string;
  lang: Lang;
  projects: Project[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [menu, setMenu] = useState<Project | null>(null);
  const [rename, setRename] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const list = projects
    .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-5 pt-3 pb-2">
        <h1 className="text-[20px] font-semibold">{tr("projects")}</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => setView("grid")} className={`rounded-lg p-2 ${view === "grid" ? "text-violet-400" : "text-zinc-500"}`}>
            <Ic.IcGrid size={18} />
          </button>
          <button onClick={() => setView("list")} className={`rounded-lg p-2 ${view === "list" ? "text-violet-400" : "text-zinc-500"}`}>
            <Ic.IcList size={18} />
          </button>
        </div>
      </header>
      <div className="px-4">
        <div className="flex items-center gap-2 rounded-2xl bg-[#1c1c22] px-3 py-2 ring-1 ring-white/6">
          <Ic.IcSearch size={18} className="text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr("searchProjects")}
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4 pt-4">
        {list.length === 0 ? (
          <div className="mt-16 text-center">
            <div className="text-white/90">{tr("emptyProjects")}</div>
            <p className="mt-1 text-sm text-zinc-500">{tr("emptyProjectsHint")}</p>
            <Primary className="mx-auto mt-5" onClick={onNew}>
              {tr("newProject")}
            </Primary>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-3">
            {list.map((p) => (
              <article key={p.id} className="overflow-hidden rounded-2xl bg-[#1c1c22] ring-1 ring-white/6">
                <button onClick={() => onOpen(p.id)} className="block w-full">
                  <div className="aspect-video overflow-hidden bg-zinc-800">
                    {p.cover ? <img src={p.cover} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                </button>
                <div className="flex items-start justify-between px-2.5 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{p.name}</div>
                    <div className="text-[11px] text-zinc-500">{timeAgo(p.updatedAt, lang)}</div>
                  </div>
                  <button onClick={() => { setMenu(p); setRename(p.name); }} className="text-zinc-400">
                    <Ic.IcMore />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-[#1c1c22] p-2 ring-1 ring-white/6">
                <button onClick={() => onOpen(p.id)} className="h-14 w-20 overflow-hidden rounded-xl bg-zinc-800">
                  {p.cover ? <img src={p.cover} alt="" className="h-full w-full object-cover" /> : null}
                </button>
                <button onClick={() => onOpen(p.id)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="text-[11px] text-zinc-500">
                    {p.aspect} · {timeAgo(p.updatedAt, lang)}
                  </div>
                </button>
                <button onClick={() => { setMenu(p); setRename(p.name); }} className="text-zinc-400">
                  <Ic.IcMore />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!menu} onClose={() => { setMenu(null); setRenaming(false); setConfirm(false); }}>
        {menu && !renaming && !confirm && (
          <div className="space-y-2">
            <div className="mb-2 text-sm font-medium">{menu.name}</div>
            <Ghost className="w-full" onClick={() => { onOpen(menu.id); setMenu(null); }}>{tr("openProject")}</Ghost>
            <Ghost className="w-full" onClick={() => setRenaming(true)}>{tr("rename")}</Ghost>
            <Ghost className="w-full" onClick={() => { onDuplicate(menu.id); setMenu(null); }}>{tr("copy")}</Ghost>
            <Ghost className="w-full" danger onClick={() => setConfirm(true)}>{tr("delete")}</Ghost>
          </div>
        )}
        {menu && renaming && (
          <div>
            <Input value={rename} onChange={(e: any) => setRename(e.target.value)} />
            <Primary className="mt-3 w-full" onClick={() => { onRename(menu.id, rename); setMenu(null); setRenaming(false); }}>{tr("done")}</Primary>
          </div>
        )}
        {menu && confirm && (
          <div>
            <p className="text-sm text-zinc-300">{tr("confirmDelete")}</p>
            <div className="mt-3 flex gap-2">
              <Ghost className="flex-1" onClick={() => setConfirm(false)}>{tr("cancel")}</Ghost>
              <Ghost className="flex-1" danger onClick={() => { onDelete(menu.id); setMenu(null); setConfirm(false); }}>{tr("delete")}</Ghost>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}