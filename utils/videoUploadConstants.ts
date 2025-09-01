// utils/videoUploadConstants.ts
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const MAX_FILE_SIZE_MB = 100;           // keep MVP-friendly
export const MAX_DURATION_SECONDS = 60;        // 30–60s clips
export const THUMBNAIL_TIME_SECONDS = 1;       // grab frame at 1s mark
export const THUMBNAIL_WIDTH = 640;            // 16:9-ish preview
