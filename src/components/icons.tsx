import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function S({ size = 22, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {children}
    </svg>
  );
}

export const IcHome = (p: P) => (
  <S {...p}>
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" fill="currentColor" stroke="none" />
  </S>
);
export const IcHomeOutline = (p: P) => (
  <S {...p}>
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
  </S>
);
export const IcFolder = (p: P) => (
  <S {...p}>
    <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
  </S>
);
export const IcAssets = (p: P) => (
  <S {...p}>
    <path d="M4 8h16M4 8v10.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V8M4 8l2.2-3.2A1 1 0 0 1 7 4.3h10a1 1 0 0 1 .8.5L20 8" />
  </S>
);
export const IcUser = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5 19.2c.8-3.2 3.4-5 7-5s6.2 1.8 7 5" />
  </S>
);
export const IcSearch = (p: P) => (
  <S {...p}>
    <circle cx="11" cy="11" r="6.2" />
    <path d="M16 16.5 20 20.5" />
  </S>
);
export const IcPlus = (p: P) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" strokeWidth={2.2} />
  </S>
);
export const IcBack = (p: P) => (
  <S {...p}>
    <path d="M15 5 8 12l7 7" strokeWidth={2} />
  </S>
);
export const IcUndo = (p: P) => (
  <S {...p}>
    <path d="M8 8H4v4" />
    <path d="M4 12a8 8 0 1 0 2-6.5" />
  </S>
);
export const IcRedo = (p: P) => (
  <S {...p}>
    <path d="M16 8h4v4" />
    <path d="M20 12a8 8 0 1 1-2-6.5" />
  </S>
);
export const IcCheck = (p: P) => (
  <S {...p}>
    <path d="M5 12.5 9.5 17 19 7.5" strokeWidth={2.2} />
  </S>
);
export const IcPlay = (p: P) => (
  <S {...p}>
    <path d="M8 5.5v13L19 12z" fill="currentColor" stroke="none" />
  </S>
);
export const IcPause = (p: P) => (
  <S {...p}>
    <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" stroke="none" />
  </S>
);
export const IcSkipBack = (p: P) => (
  <S {...p}>
    <path d="M5 5v14M19 5 9 12l10 7z" fill="currentColor" stroke="none" />
    <path d="M5 5v14" />
  </S>
);
export const IcSkipFwd = (p: P) => (
  <S {...p}>
    <path d="M19 5v14M5 5l10 7-10 7z" fill="currentColor" stroke="none" />
  </S>
);
export const IcLoop = (p: P) => (
  <S {...p}>
    <path d="M3 12a7 7 0 0 1 12-4.5L17 5v6h-6" />
    <path d="M21 12a7 7 0 0 1-12 4.5L7 19v-6h6" />
  </S>
);
export const IcSplit = (p: P) => (
  <S {...p}>
    <path d="M8 4 4 8l4 4" />
    <path d="M16 4l4 4-4 4" />
    <path d="M4 8h16M12 8v12" />
  </S>
);
export const IcSnap = (p: P) => (
  <S {...p}>
    <path d="M8 4v6M16 4v6M4 10h16M9 14h6M12 10v10" />
  </S>
);
export const IcZoomIn = (p: P) => (
  <S {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="m16 16 4 4M11 8v6M8 11h6" />
  </S>
);
export const IcZoomOut = (p: P) => (
  <S {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="m16 16 4 4M8 11h6" />
  </S>
);
export const IcFit = (p: P) => (
  <S {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="m16 16 4 4" />
  </S>
);
export const IcPencil = (p: P) => (
  <S {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="m13 7 4 4" />
  </S>
);
export const IcGauge = (p: P) => (
  <S {...p}>
    <path d="M5 16a7 7 0 1 1 14 0" />
    <path d="M12 16 9.5 11" />
    <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" />
  </S>
);
export const IcSpeaker = (p: P) => (
  <S {...p}>
    <path d="M4 10v4h3l4 3V7L7 10z" />
    <path d="M16 9.5a3.5 3.5 0 0 1 0 5M18.2 7.5a6 6 0 0 1 0 9" />
  </S>
);
export const IcSpark = (p: P) => (
  <S {...p}>
    <path d="M12 3.5 13.7 9H19l-4.4 3.3L16.2 18 12 14.7 7.8 18l1.6-5.7L5 9h5.3z" />
  </S>
);
export const IcCrop = (p: P) => (
  <S {...p}>
    <path d="M7 3v14h14" />
    <path d="M3 7h14v14" />
  </S>
);
export const IcCam = (p: P) => (
  <S {...p} size={p.size ?? 16}>
    <rect x="3" y="7" width="14" height="11" rx="2" />
    <path d="m17 11 4-2v8l-4-2z" />
  </S>
);
export const IcLayers = (p: P) => (
  <S {...p} size={p.size ?? 16}>
    <path d="m12 4 8 4-8 4-8-4z" />
    <path d="m4 12 8 4 8-4" />
    <path d="m4 16 8 4 8-4" />
  </S>
);
export const IcFilm = (p: P) => (
  <S {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M8 5v14M3 10h5M3 14h5M16 9l4 3-4 3z" />
  </S>
);
export const IcWave = (p: P) => (
  <S {...p}>
    <path d="M3 14c2-6 4 6 6 0s4 6 6 0 4 6 6 0" />
    <path d="M9 8v2M15 6v4" />
  </S>
);
export const IcWand = (p: P) => (
  <S {...p}>
    <path d="m4 20 10-10" />
    <path d="m14 4 6 6-6 6-6-6z" />
    <path d="M6 8h.01M8 4h.01M18 16h.01" />
  </S>
);
export const IcPuzzle = (p: P) => (
  <S {...p}>
    <path d="M8 4h4a2 2 0 1 1 0 4h6v4a2 2 0 1 1-4 0v0H8V8a2 2 0 1 1 0-4z" />
    <path d="M8 12h4v4a2 2 0 1 0 0 4H6v-6a2 2 0 1 1 2-2z" />
  </S>
);
export const IcDots = (p: P) => (
  <S {...p} size={p.size ?? 18}>
    <circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </S>
);
export const IcMore = (p: P) => (
  <S {...p} size={p.size ?? 18}>
    <circle cx="12" cy="6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18" r="1.3" fill="currentColor" stroke="none" />
  </S>
);
export const IcGrid = (p: P) => (
  <S {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.4" />
    <rect x="13" y="4" width="7" height="7" rx="1.4" />
    <rect x="4" y="13" width="7" height="7" rx="1.4" />
    <rect x="13" y="13" width="7" height="7" rx="1.4" />
  </S>
);
export const IcList = (p: P) => (
  <S {...p}>
    <path d="M8 7h12M8 12h12M8 17h12" />
    <circle cx="4.5" cy="7" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="17" r="1" fill="currentColor" stroke="none" />
  </S>
);
export const IcClose = (p: P) => (
  <S {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </S>
);
export const IcChevron = (p: P) => (
  <S {...p} size={p.size ?? 16}>
    <path d="m9 6 6 6-6 6" />
  </S>
);
export const IcWifiOff = (p: P) => (
  <S {...p} size={p.size ?? 14}>
    <path d="M5 12.5c2-2 4.5-3 7-3M3 9c3-3 6.5-4.5 9-4.5M8.5 16a5 5 0 0 1 3.5-1.3M12 20h.01M3 3l18 18" />
  </S>
);