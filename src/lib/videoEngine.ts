import type { Project, Clip, ExportSettings } from "./types";

// In-memory media cache for loaded images and videos
const imageCache: Map<string, HTMLImageElement> = new Map();
const videoCache: Map<string, HTMLVideoElement> = new Map();

export function getCachedImage(url: string): HTMLImageElement {
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  imageCache.set(url, img);
  return img;
}

export function getCachedVideo(url: string): HTMLVideoElement {
  if (videoCache.has(url)) {
    return videoCache.get(url)!;
  }
  const vid = document.createElement("video");
  vid.crossOrigin = "anonymous";
  vid.src = url;
  vid.muted = true;
  vid.playsInline = true;
  vid.preload = "auto";
  videoCache.set(url, vid);
  return vid;
}

// Convert ColorFilterPreset to CSS filter string
export function getFilterStyle(clip: Clip): string {
  const parts: string[] = [];

  const b = (clip.brightness ?? 0) + 100;
  if (b !== 100) parts.push(`brightness(${b}%)`);

  const c = (clip.contrast ?? 0) + 100;
  if (c !== 100) parts.push(`contrast(${c}%)`);

  const s = (clip.saturation ?? 0) + 100;
  if (s !== 100) parts.push(`saturate(${s}%)`);

  if ((clip.blur ?? 0) > 0) {
    parts.push(`blur(${clip.blur! * 0.15}px)`);
  }

  // Preset LUTs
  switch (clip.filterPreset) {
    case "teal_orange":
      parts.push("contrast(115%) saturate(125%) hue-rotate(-15deg)");
      break;
    case "cyberpunk":
      parts.push("contrast(130%) saturate(160%) hue-rotate(240deg)");
      break;
    case "noir":
      parts.push("grayscale(100%) contrast(140%) brightness(90%)");
      break;
    case "vintage":
      parts.push("sepia(45%) contrast(95%) brightness(105%) saturate(85%)");
      break;
    case "vivid":
      parts.push("saturate(145%) contrast(110%)");
      break;
    case "golden":
      parts.push("sepia(25%) saturate(135%) brightness(108%)");
      break;
  }

  return parts.length > 0 ? parts.join(" ") : "none";
}

// Draw a single frame to a canvas
export function renderCompositeFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  project: Project,
  timeSec: number,
  _options: {
    selectedClipId?: string | null;
    showGrid?: boolean;
    previewQuality?: "fast" | "balanced" | "full";
  } = {}
) {
  // Clear canvas background
  ctx.save();
  ctx.fillStyle = "#0c0c0f";
  ctx.fillRect(0, 0, width, height);

  // Active clips at current time
  const activeClips = project.clips
    .filter((c) => timeSec >= c.start && timeSec < c.start + c.duration)
    .sort((a, b) => a.track - b.track);

  // Render tracks
  for (const clip of activeClips) {
    if (clip.type === "audio") continue;

    // Check if track is muted or locked
    const track = project.tracks.find((t) => t.id === clip.track);
    if (track?.muted) continue;

    const relTime = (timeSec - clip.start) * clip.speed;

    ctx.save();

    // Opacity & Global Alpha
    let alpha = clip.opacity ?? 1.0;

    // Transition calculations (e.g. fade in/out)
    if (clip.transition === "fade") {
      const fadeDur = Math.min(0.8, clip.duration * 0.25);
      if (relTime < fadeDur) {
        alpha *= (relTime / fadeDur);
      } else if (relTime > clip.duration - fadeDur) {
        alpha *= ((clip.duration - relTime) / fadeDur);
      }
    }
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // Transformations
    const centerX = width / 2 + (clip.x ?? 0) * (width / 100);
    const centerY = height / 2 + (clip.y ?? 0) * (height / 100);

    ctx.translate(centerX, centerY);
    if (clip.rotation) {
      ctx.rotate((clip.rotation * Math.PI) / 180);
    }
    const scale = clip.scale ?? 1.0;
    ctx.scale(scale, scale);

    if (clip.type === "text") {
      // Draw Text Clip
      const fontSize = Math.round((clip.fontSize ?? 28) * (height / 480));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const text = clip.text || clip.name;
      const textWidth = ctx.measureText(text).width;
      const textHeight = fontSize * 1.2;

      if (clip.textBg) {
        ctx.fillStyle = clip.textBg;
        ctx.fillRect(-textWidth / 2 - 12, -textHeight / 2 - 6, textWidth + 24, textHeight + 12);
      }

      ctx.fillStyle = clip.textColor || "#ffffff";
      ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
      ctx.shadowBlur = 8;
      ctx.fillText(text, 0, 0);
    } else {
      // Draw Image / Video Clip
      const imgUrl = clip.src || clip.thumb || "/images/preview-car.jpg";
      const img = getCachedImage(imgUrl);

      // Apply Filter
      const filterStr = getFilterStyle(clip);
      if (filterStr !== "none" && ctx.filter !== undefined) {
        ctx.filter = filterStr;
      }

      const drawW = width;
      const drawH = height;
      const drawX = -drawW / 2;
      const drawY = -drawH / 2;

      // Handle wipe transition
      if (clip.transition === "wipe" && relTime < 0.6) {
        const wipeProgress = relTime / 0.6;
        ctx.beginPath();
        ctx.rect(drawX, drawY, drawW * wipeProgress, drawH);
        ctx.clip();
      }

      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      } else {
        // Fallback procedural visual
        ctx.fillStyle = clip.color || "#8b67f7";
        ctx.fillRect(drawX, drawY, drawW, drawH);
        ctx.fillStyle = "#ffffff";
        ctx.font = `${Math.round(height * 0.05)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(clip.name, 0, 0);
      }

      // Vignette effect overlay
      if ((clip.vignette ?? 0) > 0) {
        const radGrad = ctx.createRadialGradient(0, 0, width * 0.25, 0, 0, width * 0.7);
        radGrad.addColorStop(0, "rgba(0,0,0,0)");
        radGrad.addColorStop(1, `rgba(0,0,0,${(clip.vignette! / 100) * 0.85})`);
        ctx.fillStyle = radGrad;
        ctx.fillRect(drawX, drawY, drawW, drawH);
      }
    }

    ctx.restore();
  }

  ctx.restore();
}

// Real Video Export Function producing a real downloadable MP4/WebM file
export async function exportProjectToVideoFile(
  project: Project,
  settings: ExportSettings,
  onProgress: (progress: number, frame: number, totalFrames: number, etaSec: number) => void,
  isCancelled: () => boolean
): Promise<{ downloadUrl: string; fileName: string }> {
  // Determine resolution
  const resMap: Record<string, { w: number; h: number }> = {
    "480p": { w: 854, h: 480 },
    "720p": { w: 1280, h: 720 },
    "1080p": { w: 1920, h: 1080 },
    "2K": { w: 2560, h: 1440 },
    "4K": { w: 3840, h: 2160 },
  };

  const dim = resMap[settings.resolution] || { w: 1280, h: 720 };
  // Adjust for aspect ratio
  let targetWidth = dim.w;
  let targetHeight = dim.h;
  if (project.aspect === "9:16") {
    targetWidth = Math.min(dim.w, dim.h);
    targetHeight = Math.max(dim.w, dim.h);
  } else if (project.aspect === "1:1") {
    const minDim = Math.min(dim.w, dim.h);
    targetWidth = minDim;
    targetHeight = minDim;
  }

  const fps = settings.fps || 30;
  const duration = Math.max(
    3.0,
    project.clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0)
  );
  const totalFrames = Math.round(duration * fps);

  // Create offscreen canvas
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d")!;

  // Create audio context for mixing audio tracks
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  let audioContext: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;

  try {
    if (AudioCtxClass) {
      audioContext = new AudioCtxClass();
      audioDest = audioContext.createMediaStreamDestination();
    }
  } catch (e) {
    console.warn("AudioContext init skipped for export", e);
  }

  // Preload all media assets used in project
  const preloadPromises = project.clips.map((clip) => {
    return new Promise<void>((resolve) => {
      const url = clip.src || clip.thumb || "/images/preview-car.jpg";
      const img = getCachedImage(url);
      if (img.complete) {
        resolve();
      } else {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      }
    });
  });
  await Promise.all(preloadPromises);

  // Set up capture stream & MediaRecorder
  const canvasStream = canvas.captureStream(fps);
  if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
    audioDest.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
  }

  let mimeType = "video/webm;codecs=vp9";
  if (MediaRecorder.isTypeSupported("video/mp4;codecs=avc1.42E01E")) {
    mimeType = "video/mp4;codecs=avc1.42E01E";
  } else if (MediaRecorder.isTypeSupported("video/mp4")) {
    mimeType = "video/mp4";
  } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
    mimeType = "video/webm;codecs=vp8";
  } else if (MediaRecorder.isTypeSupported("video/webm")) {
    mimeType = "video/webm";
  }

  const bitrateBps = (settings.bitrate > 0 ? settings.bitrate : 8000) * 1000;
  const mediaRecorder = new MediaRecorder(canvasStream, {
    mimeType,
    videoBitsPerSecond: bitrateBps,
  });

  const recordedChunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  const recordingFinishedPromise = new Promise<Blob>((resolve, reject) => {
    mediaRecorder.onstop = () => {
      const finalBlob = new Blob(recordedChunks, {
        type: mimeType.startsWith("video/mp4") ? "video/mp4" : "video/webm",
      });
      resolve(finalBlob);
    };
    mediaRecorder.onerror = (err) => reject(err);
  });

  mediaRecorder.start(100);

  // Frame by frame rendering loop
  const startTime = performance.now();
  for (let f = 0; f < totalFrames; f++) {
    if (isCancelled()) {
      mediaRecorder.stop();
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close();
      }
      throw new Error("Render cancelled by user");
    }

    const timeSec = f / fps;
    renderCompositeFrame(ctx, targetWidth, targetHeight, project, timeSec, {
      previewQuality: "full",
    });

    // Notify progress
    const progress = (f / totalFrames) * 100;
    const elapsedSec = (performance.now() - startTime) / 1000;
    const framesPerSec = f > 0 ? f / elapsedSec : fps;
    const etaSec = (totalFrames - f) / Math.max(1, framesPerSec);

    onProgress(progress, f, totalFrames, etaSec);

    // Yield execution briefly to let MediaRecorder ingest frames smoothly
    await new Promise((r) => setTimeout(r, 1000 / fps / 2));
  }

  // Draw final frame and finish recording
  renderCompositeFrame(ctx, targetWidth, targetHeight, project, duration, { previewQuality: "full" });
  await new Promise((r) => setTimeout(r, 200));

  mediaRecorder.stop();
  if (audioContext && audioContext.state !== "closed") {
    audioContext.close();
  }

  const finalBlob = await recordingFinishedPromise;
  const downloadUrl = URL.createObjectURL(finalBlob);

  const cleanProjectName = (project.name || "VexEdit_Video").replace(/[^a-zA-Z0-9_-]/g, "_");
  const ext = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
  const fileName = `${cleanProjectName}_${settings.resolution}_${settings.fps}fps.${ext}`;

  onProgress(100, totalFrames, totalFrames, 0);

  return { downloadUrl, fileName };
}
