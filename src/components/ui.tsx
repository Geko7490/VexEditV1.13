import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ReactNode } from "react";

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export function IconBtn({
  children,
  onClick,
  active,
  disabled,
  label,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 transition active:scale-95 disabled:opacity-35",
        active ? "text-violet-400" : "hover:bg-white/5",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Pill({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-[#1f1f25] px-3 py-1 text-[11px] text-zinc-300 ring-1 ring-white/6",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Sheet({
  open,
  onClose,
  children,
  height = "auto",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  height?: string;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <div className="vx-fade absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        className="vx-sheet relative z-10 w-full rounded-t-3xl bg-[#1a1a20] px-4 pb-6 pt-3 shadow-2xl ring-1 ring-white/8"
        style={{ maxHeight: height === "auto" ? "86%" : height }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/18" />
        <div className="max-h-[78dvh] overflow-y-auto no-scrollbar">{children}</div>
      </div>
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-violet-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none absolute bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-[#2a2a33] px-4 py-2 text-xs text-white shadow-xl ring-1 ring-white/10">
      {message}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      {children}
    </label>
  );
}

export function Select({ className, children, ...rest }: any) {
  return (
    <select
      className={cn(
        "w-full appearance-none rounded-xl bg-[#121216] px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/8",
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Input({ className, ...rest }: any) {
  return (
    <input
      className={cn(
        "w-full rounded-xl bg-[#121216] px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/8 placeholder:text-zinc-600",
        className
      )}
      {...rest}
    />
  );
}

export function Slider({ value, min = 0, max = 100, step = 1, onChange }: any) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange?.(Number(e.target.value))}
      className="w-full accent-violet-500"
    />
  );
}

export function Primary({
  children,
  onClick,
  className,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(124,92,255,0.35)] transition active:scale-[0.98] disabled:opacity-40",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Ghost({
  children,
  onClick,
  className,
  danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl bg-white/6 px-4 py-2.5 text-sm font-medium text-zinc-200 transition active:scale-[0.98]",
        danger && "bg-rose-500/15 text-rose-300",
        className
      )}
    >
      {children}
    </button>
  );
}