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
  img.addEventListener("load", () => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("vexedit:media-frame"));
  }, { once: true });
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
  const notifyFrameReady = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("vexedit:media-frame"));
  };
  video.addEventListener("loadeddata", notifyFrameReady, { once: true });
  video.addEventListener("seeked", notifyFrameReady);
  video.addEventListener("error", notifyFrameReady, { once: true });
  videoCache.set(url, video);
  return video;
}

const audioCache: Map<string, HTMLAudioElement> = new Map();
let previewAudioContext: AudioContext | null = null;
const audioNodeCache = new WeakMap<HTMLMediaElement, {
  gain: GainNode;
  panner: StereoPannerNode;
}>();

function ensureMediaAudioNodes(media: HTMLMediaElement) {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  previewAudioContext ||= new AudioContextClass();
  let nodes = audioNodeCache.get(media);
  if (!nodes) {
    const source = previewAudioContext.createMediaElementSource(media);
    const gain = previewAudioContext.createGain();
    const panner = previewAudioContext.createStereoPanner();
    source.connect(gain);
    gain.connect(panner);
    panner.connect(previewAudioContext.destination);
    nodes = { gain, panner };
    audioNodeCache.set(media, nodes);
  }
  return nodes;
}

export async function resumePreviewAudio(): Promise<void> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  previewAudioContext ||= new AudioContextClass();
  if (previewAudioContext.state === "suspended") {
    await previewAudioContext.resume();
  }
}

function configurePreviewAudio(media: HTMLMediaElement, volume: number, pan: number) {
  try {
    const nodes = ensureMediaAudioNodes(media);
    if (!nodes) {
      media.volume = Math.max(0, Math.min(1, volume));
      return;
    }
    nodes.gain.gain.value = Math.max(0, Math.min(4, volume));
    nodes.panner.pan.value = Math.max(-1, Math.min(1, pan));
    media.volume = 1;
    if (previewAudioContext?.state === "suspended") {
      void previewAudioContext.resume().catch(() => undefined);
    }
  } catch {
    media.volume = Math.max(0, Math.min(1, volume));
  }
}

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

type AnimatedProperty = "opacity" | "scale" | "x" | "y" | "rotation";

function getAnimatedValue(clip: Clip, property: AnimatedProperty, time: number, fallback: number): number {
  const points = (clip.keyframes || [])
    .filter((keyframe) => typeof keyframe[property] === "number")
    .sort((a, b) => a.time - b.time);
  if (points.length === 0) return fallback;
  if (time <= points[0].time) return points[0][property] as number;
  if (time >= points[points.length - 1].time) return points[points.length - 1][property] as number;

  for (let index = 0; index < points.length - 1; index++) {
    const left = points[index];
    const right = points[index + 1];
    if (time >= left.time && time <= right.time) {
      const span = Math.max(0.000001, right.time - left.time);
      const progress = (time - left.time) / span;
      const from = left[property] as number;
      const to = right[property] as number;
      return from + (to - from) * progress;
    }
  }
  return fallback;
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
  if ((clip.hue ?? 0) !== 0) {
    parts.push(`hue-rotate(${clip.hue}deg)`);
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
    const sourceIn = Math.max(0, clip.sourceIn ?? 0);
    const sourceEnd = clip.sourceOut ?? clip.sourceDuration ?? sourceIn + clip.duration * (clip.speed || 1);
    const relativeSourceTime = (timeSec - clip.start) * (clip.speed || 1);
    const sourceTime = clip.reversed
      ? Math.max(sourceIn, sourceEnd - relativeSourceTime)
      : sourceIn + (clip.frozen ? 0 : relativeSourceTime);
    if (track?.muted) {
      audio.pause();
      continue;
    }
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      if (options.playing && !clip.frozen && !clip.reversed) {
        if (Math.abs(audio.currentTime - sourceTime) > 0.5 && !audio.seeking) {
          try { audio.currentTime = sourceTime; } catch { /* wait for metadata */ }
        }
        audio.playbackRate = Math.max(0.1, Math.min(3, clip.speed || 1));
        configurePreviewAudio(
          audio,
          (clip.volume ?? 1) * (track?.volume ?? 1),
          clip.pan ?? 0
        );
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
    const sourceIn = Math.max(0, clip.sourceIn ?? 0);
    const sourceEnd = clip.sourceOut ?? clip.sourceDuration ?? sourceIn + clip.duration * (clip.speed || 1);
    const sourceTime = clip.reversed
      ? Math.max(sourceIn, sourceEnd - relTime)
      : sourceIn + (clip.frozen ? 0 : relTime);

    ctx.save();

    // Interpolate animated transform values at the clip-local timeline time.
    const localTime = timeSec - clip.start;
    const animatedOpacity = getAnimatedValue(clip, "opacity", localTime, clip.opacity ?? 1);
    const animatedScale = getAnimatedValue(clip, "scale", localTime, clip.scale ?? 1);
    const animatedX = getAnimatedValue(clip, "x", localTime, clip.x ?? 0);
    const animatedY = getAnimatedValue(clip, "y", localTime, clip.y ?? 0);
    const animatedRotation = getAnimatedValue(clip, "rotation", localTime, clip.rotation ?? 0);

    // Opacity & Global Alpha
    let alpha = animatedOpacity;

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
    const centerX = width / 2 + animatedX * (width / 100);
    const centerY = height / 2 + animatedY * (height / 100);

    ctx.translate(centerX, centerY);
    if (animatedRotation) {
      ctx.rotate((animatedRotation * Math.PI) / 180);
    }
    const scale = animatedScale;
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
          if (options.playing && !clip.frozen && !clip.reversed) {
            const drift = Math.abs(video.currentTime - sourceTime);
            if (drift > 0.45 && !video.seeking) {
              try { video.currentTime = sourceTime; } catch { /* wait for metadata */ }
            }
            video.playbackRate = Math.max(0.1, Math.min(3, clip.speed || 1));
            configurePreviewAudio(video, (clip.volume ?? 1) * (track?.volume ?? 1), 0);
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
function waitForMediaReady(media: HTMLMediaElement, timeoutMs = 12000): Promise<void> {
  if (media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while decoding media."));
    }, timeoutMs);
    const cleanup = () => {
      window.clearTimeout(timeout);
      media.removeEventListener("loadeddata", onReady);
      media.removeEventListener("error", onError);
    };
    const onReady = () => { cleanup(); resolve(); };
    const onError = () => {
      cleanup();
      reject(new Error("The device could not decode one of the imported media files."));
    };
    media.addEventListener("loadeddata", onReady, { once: true });
    media.addEventListener("error", onError, { once: true });
    media.load();
  });
}

function seekMedia(media: HTMLMediaElement, time: number): Promise<void> {
  if (Math.abs(media.currentTime - time) < 0.015 && !media.seeking) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while seeking imported media."));
    }, 8000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      media.removeEventListener("seeked", onSeeked);
      media.removeEventListener("error", onError);
    };
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("Could not seek in an imported media file.")); };
    media.addEventListener("seeked", onSeeked, { once: true });
    media.addEventListener("error", onError, { once: true });
    try { media.currentTime = Math.max(0, time); } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error("Could not seek media."));
    }
  });
}

export async function exportProjectToVideoFile(
  project: Project,
  settings: ExportSettings,
  onProgress: (progress: number, frame: number, totalFrames: number, etaSec: number) => void,
  isCancelled: () => boolean
): Promise<{ downloadUrl: string; fileName: string }> {
  const resMap: Record<string, { w: number; h: number }> = {
    "480p": { w: 854, h: 480 },
    "720p": { w: 1280, h: 720 },
    "1080p": { w: 1920, h: 1080 },
    "2K": { w: 2560, h: 1440 },
    "4K": { w: 3840, h: 2160 },
  };
  const dim = resMap[settings.resolution] || { w: 1280, h: 720 };
  let targetWidth = dim.w;
  let targetHeight = dim.h;
  if (project.aspect === "9:16") {
    targetWidth = Math.min(dim.w, dim.h);
    targetHeight = Math.max(dim.w, dim.h);
  } else if (project.aspect === "1:1") {
    targetWidth = Math.min(dim.w, dim.h);
    targetHeight = targetWidth;
  }

  const fps = settings.fps || 30;
  const duration = Math.max(0.1, project.clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0));
  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the video render canvas.");
  if (typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") {
    throw new Error("This Android WebView does not support video recording.");
  }

  // Preload the actual media decoders. Video files are never passed to Image().
  const preload = project.clips.map(async (clip) => {
    const url = clip.src || clip.thumb;
    if (!url) return;
    if (clip.type === "video" && clip.sourceMimeType?.startsWith("video/")) {
      const video = getCachedVideo(url);
      await waitForMediaReady(video);
      await seekMedia(video, clip.sourceIn ?? 0);
    } else if (clip.type === "audio") {
      const audio = getCachedAudio(url);
      await waitForMediaReady(audio);
      await seekMedia(audio, clip.sourceIn ?? 0);
    } else {
      const image = getCachedImage(url);
      if (!image.complete) {
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error(`Could not load image: ${clip.name}`));
        });
      }
      if (image.naturalWidth <= 0) throw new Error(`Could not decode image: ${clip.name}`);
    }
  });
  await Promise.all(preload);

  // Route all video and audio element sound into the recorded stream.
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  let audioContext: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  if (AudioContextClass) {
    previewAudioContext ||= new AudioContextClass();
    audioContext = previewAudioContext;
    audioDest = audioContext.createMediaStreamDestination();
    const audioSources = [
      ...project.clips.filter((clip) => clip.type === "audio" && clip.src).map((clip) => getCachedAudio(clip.src as string)),
      ...project.clips.filter((clip) => clip.type === "video" && clip.sourceMimeType?.startsWith("video/") && clip.src).map((clip) => getCachedVideo(clip.src as string)),
    ];
    for (const media of audioSources) {
      const nodes = ensureMediaAudioNodes(media);
      if (nodes) nodes.panner.connect(audioDest);
    }
    if (audioContext.state === "suspended") await audioContext.resume();
  }

  const canvasStream = canvas.captureStream(fps);
  if (audioDest) {
    audioDest.stream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
  }

  const mimeCandidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const mimeType = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  if (!mimeType) throw new Error("This device does not support MP4 or WebM video recording.");

  const bitrateBps = (settings.bitrate > 0 ? settings.bitrate : 8000) * 1000;
  const mediaRecorder = new MediaRecorder(canvasStream, {
    mimeType,
    videoBitsPerSecond: bitrateBps,
  });
  const recordedChunks: Blob[] = [];
  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) recordedChunks.push(event.data);
  };
  const recordingFinishedPromise = new Promise<Blob>((resolve, reject) => {
    mediaRecorder.onstop = () => resolve(new Blob(recordedChunks, { type: mimeType.startsWith("video/mp4") ? "video/mp4" : "video/webm" }));
    mediaRecorder.onerror = (event) => reject(event);
  });

  mediaRecorder.start(100);
  const startTime = performance.now();
  try {
    for (let frame = 0; frame < totalFrames; frame++) {
      if (isCancelled()) throw new Error("Export cancelled by user.");
      const timeSec = frame / fps;
      renderCompositeFrame(ctx, targetWidth, targetHeight, project, timeSec, {
        previewQuality: "full",
        playing: true,
      });
      const progress = ((frame + 1) / totalFrames) * 100;
      const elapsed = (performance.now() - startTime) / 1000;
      const measuredFps = frame > 0 ? (frame + 1) / Math.max(0.001, elapsed) : fps;
      onProgress(progress, frame + 1, totalFrames, (totalFrames - frame - 1) / Math.max(1, measuredFps));
      await new Promise((resolve) => window.setTimeout(resolve, 1000 / fps));
    }

    renderCompositeFrame(ctx, targetWidth, targetHeight, project, duration, {
      previewQuality: "full",
      playing: false,
    });
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    mediaRecorder.stop();
    const finalBlob = await recordingFinishedPromise;

    const downloadUrl = URL.createObjectURL(finalBlob);
    const cleanProjectName = (project.name || "VexEdit_Video").replace(/[^a-zA-Z0-9_-]/g, "_");
    const extension = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
    const fileName = `${cleanProjectName}_${settings.resolution}_${fps}fps.${extension}`;
    onProgress(100, totalFrames, totalFrames, 0);
    return { downloadUrl, fileName };
  } catch (error) {
    if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
    await recordingFinishedPromise.catch(() => undefined);
    throw error;
  } finally {
    videoCache.forEach((video) => video.pause());
    audioCache.forEach((audio) => audio.pause());
  }
}
