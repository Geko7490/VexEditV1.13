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
  const cached = videoCache.get(url);
  if (cached) return cached;

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.src = url;
  video.muted = false;
  video.volume = 1;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("playsinline", "");
  video.addEventListener("seeked", () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("vexedit:media-frame"));
    }
  });
  videoCache.set(url, video);
  return video;
}

const audioCache: Map<string, HTMLAudioElement> = new Map();

export function getCachedAudio(url: string): HTMLAudioElement {
  const cached = audioCache.get(url);
  if (cached) return cached;
  const audio = document.createElement("audio");
  audio.crossOrigin = "anonymous";
  audio.src = url;
  audio.preload = "auto";
  audioCache.set(url, audio);
  return audio;
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
  options: {
    selectedClipId?: string | null;
    showGrid?: boolean;
    previewQuality?: "fast" | "balanced" | "full";
    playing?: boolean;
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

  const activeVideoUrls = new Set(
    activeClips
      .filter((clip) => clip.type === "video" && clip.src)
      .map((clip) => clip.src as string)
  );
  const activeAudioClips = activeClips.filter((clip) => clip.type === "audio" && clip.src);
  const activeAudioUrls = new Set(activeAudioClips.map((clip) => clip.src as string));

  for (const [url, cachedVideo] of videoCache) {
    if (!activeVideoUrls.has(url) && !cachedVideo.paused) cachedVideo.pause();
  }
  for (const [url, cachedAudio] of audioCache) {
    if (!activeAudioUrls.has(url) && !cachedAudio.paused) cachedAudio.pause();
  }

  // Synchronize audio-only clips with the editor playhead.
  for (const clip of activeAudioClips) {
    const track = project.tracks.find((item) => item.id === clip.track);
    const audio = getCachedAudio(clip.src as string);
    const sourceTime = Math.max(0, (clip.sourceIn ?? 0) + (timeSec - clip.start) * (clip.speed || 1));
    if (track?.muted) {
      audio.pause();
      continue;
    }
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      if (options.playing) {
        if (Math.abs(audio.currentTime - sourceTime) > 0.5 && !audio.seeking) {
          try { audio.currentTime = sourceTime; } catch { /* wait for metadata */ }
        }
        audio.playbackRate = Math.max(0.25, Math.min(4, clip.speed || 1));
        audio.volume = Math.max(0, Math.min(1, (clip.volume ?? 1) * (track?.volume ?? 1)));
        if (audio.paused && !audio.ended) void audio.play().catch(() => undefined);
      } else {
        if (!audio.paused) audio.pause();
        if (!audio.seeking && Math.abs(audio.currentTime - sourceTime) > 0.025) {
          try { audio.currentTime = sourceTime; } catch { /* wait for metadata */ }
        }
      }
    }
  }

  // Render tracks
  for (const clip of activeClips) {
    if (clip.type === "audio") continue;

    // Check if track is muted or locked
    const track = project.tracks.find((t) => t.id === clip.track);
    if (track?.muted) continue;

    const relTime = (timeSec - clip.start) * clip.speed;
    const sourceTime = Math.max(0, (clip.sourceIn ?? 0) + relTime);

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
      const isVideo = clip.type === "video" && (
        clip.sourceMimeType?.startsWith("video/") === true ||
        imgUrl.startsWith("blob:") ||
        /\\.(mp4|m4v|mov|webm|mkv|3gp)(?:$|[?#])/i.test(imgUrl)
      );
      const video = isVideo ? getCachedVideo(imgUrl) : null;
      const img = isVideo ? null : getCachedImage(imgUrl);

      if (video) {
        // Keep the HTML video element as the decoder. Canvas receives decoded
        // frames instead of trying to draw an HTMLImageElement backed by an MP4.
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          if (options.playing) {
            const drift = Math.abs(video.currentTime - sourceTime);
            if (drift > 0.45 && !video.seeking) {
              try { video.currentTime = sourceTime; } catch { /* wait for metadata */ }
            }
            video.playbackRate = Math.max(0.25, Math.min(4, clip.speed || 1));
            video.volume = Math.max(0, Math.min(1, clip.volume ?? 1));
            if (video.paused && !video.ended) {
              void video.play().catch(() => undefined);
            }
          } else {
            if (!video.paused) video.pause();
            if (!video.seeking && Math.abs(video.currentTime - sourceTime) > 0.025) {
              try { video.currentTime = sourceTime; } catch { /* media may still be loading */ }
            }
          }
        }
      }

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

      const mediaReady = video
        ? video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0
        : !!img && img.complete && img.naturalWidth > 0;
      if (mediaReady) {
        ctx.drawImage((video || img) as CanvasImageSource, drawX, drawY, drawW, drawH);
      } else {
        // Keep the preview informative while the decoder loads or when the
        // device cannot decode the selected source.
        ctx.fillStyle = clip.color || "#8b67f7";
        ctx.fillRect(drawX, drawY, drawW, drawH);
        ctx.fillStyle = "#ffffff";
        ctx.font = `${Math.round(height * 0.05)}px sans-serif`;
        ctx.textAlign = "center";
        const status = video?.error ? "Unsupported video format" : "Loading media…";
        ctx.fillText(status, 0, 0);
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
