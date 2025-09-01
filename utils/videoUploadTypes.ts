// utils/videoUploadTypes.ts
export type VideoMeta = {
  duration: number;
  width: number;
  height: number;
};

export type ValidationError =
  | "no_file"
  | "type"
  | "size"
  | "metadata_failed"
  | "duration";

export type ValidationResult =
  | { ok: true; meta: VideoMeta }
  | { ok: false; reason: ValidationError; message: string };
