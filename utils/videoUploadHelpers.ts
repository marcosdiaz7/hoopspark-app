// utils/videoUploadHelpers.ts
import {
  ALLOWED_VIDEO_TYPES,
  MAX_DURATION_SECONDS,
  MAX_FILE_SIZE_MB,
  THUMBNAIL_TIME_SECONDS,
  THUMBNAIL_WIDTH,
} from "./videoUploadConstants";
import type { ValidationResult, VideoMeta } from "./videoUploadTypes";

/** Read video metadata in the browser using a hidden <video> element. */
export function readVideoMetadata(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      cleanup();
      if (!duration || !width || !height) {
        reject(new Error("Could not read video metadata."));
      } else {
        resolve({ duration, width, height });
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video metadata."));
    };
  });
}

/** Validate type/size/duration (duration requires metadata read). */
export async function validateVideo(file: File | null): Promise<ValidationResult> {
  if (!file) return { ok: false, reason: "no_file", message: "Choose a video file first." };

  if (!ALLOWED_VIDEO_TYPES.includes(file.type as (typeof ALLOWED_VIDEO_TYPES)[number])) {
    return { ok: false, reason: "type", message: "Unsupported file type." };
  }

  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_FILE_SIZE_MB) {
    return {
      ok: false,
      reason: "size",
      message: `File is too large (${sizeMb.toFixed(1)} MB). Max is ${MAX_FILE_SIZE_MB} MB.`,
    };
  }

  try {
    const meta = await readVideoMetadata(file);
    if (meta.duration > MAX_DURATION_SECONDS) {
      return {
        ok: false,
        reason: "duration",
        message: `Clip is ${meta.duration.toFixed(0)}s. Max is ${MAX_DURATION_SECONDS}s.`,
      };
    }
    return { ok: true, meta };
  } catch {
    return { ok: false, reason: "metadata_failed", message: "Could not read video metadata." };
  }
}

/** Create a JPEG thumbnail from the video at T seconds (default 1s). */
export async function extractThumbnail(
  file: File,
  atSeconds = THUMBNAIL_TIME_SECONDS,
  width = THUMBNAIL_WIDTH
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.crossOrigin = "anonymous";
  video.preload = "auto";

  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(Math.max(0, atSeconds), video.duration - 0.05);
    };
    video.onseeked = () => res();
    video.onerror = () => rej(new Error("Failed to seek video for thumbnail."));
  });

  const ratio = video.videoWidth / video.videoHeight || 16 / 9;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round(width / ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);

  const blob: Blob = await new Promise((res) =>
    canvas.toBlob((b) => res(b || new Blob()), "image/jpeg", 0.85)
  );
  return blob;
}

/** Generate a storage path (keeps extension). */
export function storagePathFor(prefix: "videos" | "thumbnails", file: File) {
  const ext = file.name.split(".").pop() || "bin";
  const safeBase = file.name.replace(/\s+/g, "_").replace(/[^\w.-]/g, "");
  return `${prefix}/${Date.now()}_${safeBase}.${ext}`;
}
