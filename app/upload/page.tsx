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
const FEEDBACK_URL =
  process.env.NEXT_PUBLIC_FEEDBACK_URL || "https://hoopspark.ai/feedback";

// helper: create a user-scoped storage key that satisfies storage RLS
function userScopedKey(userId: string, fileName: string) {
  const safe = fileName.replace(/\s+/g, "_").replace(/[^\w.-]/g, "");
  return `${userId}/${crypto.randomUUID()}_${safe}`;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [skill, setSkill] = useState("");
  const [selfRating, setSelfRating] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(false);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);

  // inline analysis card
  const [analysis, setAnalysis] = useState<{
    score: number;
    skill_area: string;
    issues: string[];
    suggestions: string;
  } | null>(null);

  // track last created video for reactions
  const [lastVideoId, setLastVideoId] = useState<string | null>(null);

  // reaction UI
  const [userNote, setUserNote] = useState("");
  const [savingReact, setSavingReact] = useState(false);

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
    setLastVideoId(null);

    // Require skill focus
    const focus = skill.trim();
    if (!focus) {
      setStatus({ type: "err", msg: "Please enter a Skill focus." });
      return;
    }

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
        skill_focus: focus, // required
        status: "uploaded",
      };
      const { error: insErr } = await supabase.from("videos").insert([payload]);
      if (insErr) throw insErr;
      setLastVideoId(videoId);

      // 4) Real analysis via Edge Function (runs as the signed-in user)
      const { data: fnData, error: fnErr } = await supabase.functions.invoke("analyze-video", {
        body: {
          videoId,
          bucket: VIDEO_BUCKET,
          key: videoKey,
          skillFocus: focus,
          questionnaire:
            selfRating == null ? undefined : { self_rating: selfRating, focus },
        },
      });
      if (fnErr) throw fnErr;

      if (fnData?.analysis) {
        const a = fnData.analysis as {
          score: number; skill_area: string; issues: string[]; suggestions: string;
        };
        setAnalysis(a);
      }

      setStatus({ type: "ok", msg: "Upload complete and analysis created." });
      setFile(null);
      setSkill("");
      setSelfRating(null);
      setUserNote("");
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err ?? "Upload failed.");
      setStatus({ type: "err", msg });
    } finally {
      setLoading(false);
    }
  }

  async function saveReaction(kind: "up" | "down") {
    if (!lastVideoId) return;
    try {
      setSavingReact(true);

      // get the most recent feedback row for this video
      const { data: fbRow, error: selErr } = await supabase
        .from("feedback")
        .select("id, questionnaire_data")
        .eq("video_id", lastVideoId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (selErr) throw selErr;
      if (!fbRow?.id) throw new Error("No feedback found to update.");

      // merge reaction + optional note into questionnaire_data
      const merged: Record<string, unknown> = {
        ...(fbRow.questionnaire_data ?? {}),
        user_reaction: kind,
        ...(userNote.trim() ? { user_note: userNote.trim() } : {}),
      };

      const { error: updErr } = await supabase
        .from("feedback")
        .update({ questionnaire_data: merged })
        .eq("id", fbRow.id);

      if (updErr) throw updErr;

      setStatus({ type: "ok", msg: "Thanks for the feedback!" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus({ type: "err", msg: `Could not save reaction: ${msg}` });
    } finally {
      setSavingReact(false);
    }
  }

  return (
    <main className="container-content py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Upload a Clip</h1>
        <div className="flex items-center gap-2">
          <a
            href={FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Send Feedback
          </a>
          <Link href="/videos" className="btn btn-outline">Back to Videos</Link>
        </div>
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
            required
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
          <label className="block text-sm font-medium">Skill focus (required)</label>
          <input
            type="text"
            placeholder="Shooting, Ball Handling, Defense…"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            className="mt-1 block w-full rounded-lg border p-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">How do you think you did? (0–10)</label>
          <input
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={selfRating ?? ""}
            onChange={(e) => setSelfRating(e.target.value === "" ? null : Number(e.target.value))}
            className="mt-1 block w-full rounded-lg border p-2"
            placeholder="e.g., 7.5"
          />
          <p className="text-xs text-gray-500 mt-1">
            Optional. Your self-rating nudges the AI score.
          </p>
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

      {/* Inline analysis + reactions */}
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

          {/* Quick reaction UI */}
          <div className="mt-4 border-t pt-4">
            <p className="text-sm font-medium mb-2">Was this helpful?</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => saveReaction("up")}
                disabled={savingReact || !lastVideoId}
                className="btn btn-secondary"
              >
                👍 Helpful
              </button>
              <button
                type="button"
                onClick={() => saveReaction("down")}
                disabled={savingReact || !lastVideoId}
                className="btn btn-outline"
              >
                👎 Off
              </button>
            </div>
            <div className="mt-3">
              <label className="block text-sm text-gray-600 mb-1">Add a quick note (optional)</label>
              <textarea
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                rows={3}
                className="w-full rounded-lg border p-2"
                placeholder="Tell us what felt off or what helped…"
              />
              <div className="mt-2 text-xs text-gray-500">
                Your reaction + note get saved with this analysis.
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-gray-500">
        Buckets used: <b>{VIDEO_BUCKET}</b> and <b>{THUMB_BUCKET}</b> (Private). We store the storage path and call an Edge Function to create a feedback record.
      </p>
    </main>
  );
}











