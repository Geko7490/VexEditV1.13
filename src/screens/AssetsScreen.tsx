import { MEDIA_LIBRARY } from "../lib/demo";
import type { MediaAsset } from "../lib/types";
import * as Ic from "../components/icons";

export function AssetsScreen({
  tr,
  onUse,
}: {
  tr: (k: string) => string;
  onUse: (asset: MediaAsset) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="px-5 pt-3 pb-2">
        <h1 className="text-[20px] font-semibold">{tr("assets")}</h1>
        <p className="mt-1 text-xs text-zinc-500">{tr("noInternetNeeded")}</p>
      </header>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4">
        <div className="grid grid-cols-2 gap-2.5">
          {MEDIA_LIBRARY.map((m) => (
            <button
              key={m.id}
              onClick={() => onUse(m)}
              className="overflow-hidden rounded-2xl bg-[#1c1c22] text-left ring-1 ring-white/6"
            >
              <div className="aspect-video bg-zinc-800">
                {m.type === "audio" ? (
                  <div className="flex h-full items-center justify-center text-violet-400">
                    <Ic.IcSpeaker />
                  </div>
                ) : (
                  <img src={m.thumb} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="px-2.5 py-2">
                <div className="truncate text-[13px] font-medium">{m.name}</div>
                <div className="text-[11px] text-zinc-500">
                  {m.type} · {m.duration}s
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}