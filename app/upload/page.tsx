// app/upload/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { validateVideo, extractThumbnail } from "@/utils/videoUploadHelpers";
import { MAX_DURATION_SECONDS, MAX_FILE_SIZE_MB } from "@/utils/videoUploadConstants";

type Status = { type: "ok" | "err"; msg: string } | null;

const VIDEO_BUCKET = process.env.NEXT_PUBLIC_VIDEO_BUCKET || "videos";
const THUMB_BUCKET = process.env.NEXT_PUBLIC_THUMB_BUCKET || "thumbnails";

// helper: create a user-scoped storage key that satisfies storage RLS
function userScopedKey(userId: string, fileName: string) {
  const safe = fileName.replace(/\s+/g, "_").replace(/[^\w.-]/g, "");
  return `${userId}/${crypto.randomUUID()}_${safe}`;
}

// super-simple placeholder "analysis" so you can see feedback immediately.
// (Swap to your Edge Function later.)
function computeQuickAnalysis(skill: string, durationSec?: number) {
  const base = 7.2 + (Math.min(durationSec || 0, 60) / 60) * 1.0; // 7.2 - 8.2
  const score = Math.min(9.4, Math.max(6.5, Number(base.toFixed(1))));
  const area = skill || "General";
  const issues =
    area.toLowerCase().includes("shoot")
      ? ["Inconsistent release point", "Flat arc on longer shots"]
      : area.toLowerCase().includes("handle")
      ? ["High dribble at speed", "Loose off-hand on crossovers"]
      : ["Footwork drifts left", "Low stance breaks late on defense"];
  const suggestions =
    area.toLowerCase().includes("shoot")
      ? "Add 3×(10 makes) form shooting sets from 5 spots; finish with 25 free throws tracking arc."
      : area.toLowerCase().includes("handle")
      ? "Do 3×30s pound-cross and in-out reps, then zig-zag cones focusing on low hips and eyes up."
      : "Mikan series 3×30s, defensive slides 3×25y with consistent hip height, plant foot cues on finishes.";
  return { score, skill_area: area, issues, suggestions, ai_response: `Auto analysis (${area})` };
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [skill, setSkill] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(false);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);

  // to show the analysis inline
  const [analysis, setAnalysis] = useState<{
    score: number;
    skill_area: string;
    issues: string[];
    suggestions: string;
  } | null>(null);

  async function handlePreview(f: File | null) {
    setThumbPreview(null);
    if (!f) return;
    try {
      const blob = await extractThumbnail(f);
      setThumbPreview(URL.createObjectURL(blob));
    } catch {}
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setAnalysis(null);

    // Must be signed in for RLS/Storage policies
    const { data: userResp, error: userErr } = await supabase.auth.getUser();
    const user = userResp?.user;
    if (userErr || !user) {
      setStatus({ type: "err", msg: "Please sign in to upload." });
      return;
    }
    const userId = user.id;

    // Validate file
    const result = await validateVideo(file);
    if (!result.ok) {
      setStatus({ type: "err", msg: result.message });
      return;
    }
    if (!file) return;

    setLoading(true);
    try {
      // 1) Upload video (path starts with userId to satisfy storage RLS)
      const videoKey = userScopedKey(userId, file.name);
      const up = await supabase.storage.from(VIDEO_BUCKET).upload(videoKey, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (up.error) throw up.error;

      // Short-lived signed URL (UI only; do not store)
      await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(videoKey, 60 * 60).catch(() => {});

      // 2) Optional thumbnail
      try {
        const blob = await extractThumbnail(file);
        const thumbFile = new File([blob], "thumb.jpg", { type: "image/jpeg" });
        const thumbKey = userScopedKey(userId, thumbFile.name);
        await supabase.storage.from(THUMB_BUCKET).upload(thumbKey, thumbFile, {
          cacheControl: "3600",
          upsert: false,
        });
        // show preview if we made one successfully
        const { data: t } = await supabase.storage.from(THUMB_BUCKET).createSignedUrl(thumbKey, 60 * 60);
        if (t?.signedUrl) setThumbPreview(t.signedUrl);
      } catch {}

      // 3) Insert the videos row (include a concrete id so we can link feedback)
      const videoId = crypto.randomUUID();
      const payload = {
        id: videoId,
        user_id: userId,
        file_url: videoKey, // storage key
        original_filename: file.name,
        filename: videoKey.split("/").slice(1).join("/"),
        bucket_name: VIDEO_BUCKET,
        file_size: file.size,
        uploaded_at: new Date().toISOString(),
        skill_focus: skill || null,
        status: "uploaded",
      };
      const { error: insErr } = await supabase.from("videos").insert([payload]);
      if (insErr) throw insErr;

      // 4) QUICK ANALYSIS NOW → write to feedback (client-side, respects RLS)
      //    (This guarantees you see an analysis right away. Replace with your Edge Function later.)
      const qa = computeQuickAnalysis(skill, result.meta?.duration);
      const { error: fbErr } = await supabase.from("feedback").insert([{
        id: crypto.randomUUID(),
        user_id: userId,
        video_id: videoId,
        score: qa.score,
        skill_area: qa.skill_area,
        issues: qa.issues,           // text[]
        suggestions: qa.suggestions,
        ai_response: qa.ai_response,
        created_at: new Date().toISOString()
      }]);
      if (fbErr) throw fbErr;

      // update video status to analyzed (nice for your list page)
      await supabase.from("videos").update({ status: "analyzed" }).eq("id", videoId);

      // show analysis inline
      setAnalysis({ score: qa.score, skill_area: qa.skill_area, issues: qa.issues, suggestions: qa.suggestions });

      setStatus({ type: "ok", msg: "Upload complete and analysis created." });
      setFile(null);
      setSkill("");
    } catch (err: any) {
      console.error(err);
      setStatus({ type: "err", msg: err?.message || "Upload failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container-content py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Upload a Clip</h1>
        <Link href="/" className="btn btn-outline">Back to Videos</Link>
      </div>

      <form onSubmit={onSubmit} className="card card-pad mt-6 space-y-4 max-w-2xl">
        <div className="text-sm text-gray-600">
          Allowed: MP4 / MOV / WebM · Max {MAX_FILE_SIZE_MB}MB · ≤ {MAX_DURATION_SECONDS}s
        </div>

        <div>
          <label className="block text-sm font-medium">Video file</label>
          <input
            type="file"
            accept="video/*"
            onChange={async (e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              await handlePreview(f);
            }}
            className="mt-1 block w-full rounded-lg border p-2"
          />
        </div>

        {thumbPreview && (
          <div className="mt-2">
            <p className="text-sm text-gray-600 mb-2">Preview frame</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbPreview} alt="Thumbnail preview" className="h-40 rounded-xl border object-cover" />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium">Skill focus (optional)</label>
          <input
            type="text"
            placeholder="Shooting, Ball Handling, Defense…"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            className="mt-1 block w-full rounded-lg border p-2"
          />
        </div>

        <button disabled={loading} className="btn btn-primary">
          {loading ? "Uploading..." : "Upload"}
        </button>

        {status && (
          <div className={`rounded-xl p-3 text-sm ${status.type === "ok" ? "bg-app-50 text-app-700" : "bg-red-50 text-red-700"}`}>
            {status.msg}
          </div>
        )}
      </form>

      {/* Inline analysis card */}
      {analysis && (
        <div className="card card-pad max-w-2xl mt-6">
          <h2 className="font-semibold text-lg">AI Analysis</h2>
          <p className="text-sm text-gray-600">Skill Area: <b>{analysis.skill_area}</b></p>
          <p className="mt-2"><b>Score:</b> {analysis.score.toFixed(1)} / 10</p>
          <div className="mt-2">
            <b>Issues:</b>
            <ul className="list-disc ml-6 mt-1">
              {analysis.issues.map((i, idx) => <li key={idx}>{i}</li>)}
            </ul>
          </div>
          <div className="mt-2">
            <b>Suggestions:</b>
            <p className="text-sm">{analysis.suggestions}</p>
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-gray-500">
        Buckets used: <b>{VIDEO_BUCKET}</b> and <b>{THUMB_BUCKET}</b> (Private). We store the storage path and create a feedback record immediately.
      </p>
    </main>
  );
}







