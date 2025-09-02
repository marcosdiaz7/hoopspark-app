//app/analysis/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type VideoRow = {
  id: string;
  user_id: string | null;
  original_filename: string | null;
  uploaded_at: string | null;
  file_url: string | null;
  skill_focus: string | null;
};

type FeedbackRow = {
  id: string;
  video_id: string;
  user_id: string | null;
  score: number | null;          // 0–10 expected (double precision)
  skill_area: string | null;
  issues: string[] | null;       // stored as text[] (ARRAY)
  suggestions: string | null;    // free text
  created_at: string | null;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "not-signed-in" }
  | { kind: "not-found" }
  | { kind: "ready"; video: VideoRow; feedback: FeedbackRow | null };

function scorePill(score: number) {
  if (score >= 9) return "bg-brand-500";
  if (score >= 7) return "bg-app-500";
  if (score >= 5) return "bg-yellow-500";
  return "bg-red-500";
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function AnalysisPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const videoId = useMemo(() => params?.id ?? "", [params]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Must be signed in (RLS)
      const { data: userResp } = await supabase.auth.getUser();
      const user = userResp.user;
      if (!user) {
        setState({ kind: "not-signed-in" });
        return;
      }

      // 1) Fetch the video (owned by current user)
      const { data: video, error: vErr } = await supabase
        .from("videos")
        .select(
          "id,user_id,original_filename,uploaded_at,file_url,skill_focus"
        )
        .eq("id", videoId)
        .eq("user_id", user.id)
        .single<VideoRow>();

      if (cancelled) return;

      if (vErr || !video) {
        setState({ kind: "not-found" });
        return;
      }

      // 2) Latest feedback for this video & user (optional)
      const { data: fb, error: fErr } = await supabase
        .from("feedback")
        .select(
          "id,video_id,user_id,score,skill_area,issues,suggestions,created_at"
        )
        .eq("video_id", video.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<FeedbackRow>();

      if (cancelled) return;

      setState({ kind: "ready", video, feedback: fErr ? null : fb ?? null });
    })();

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  if (state.kind === "loading") {
    return (
      <main className="container-content py-20 text-center">
        <div className="mx-auto inline-block h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-app-500" />
        <p className="mt-4 text-sm text-gray-600">Fetching analysis…</p>
      </main>
    );
  }

  if (state.kind === "not-signed-in") {
    return (
      <main className="container-content py-12">
        <div className="card card-pad">
          <h1 className="text-xl font-semibold">Please sign in</h1>
          <p className="mt-2 text-sm text-gray-600">
            You need to be signed in to view analysis.
          </p>
          <div className="mt-4">
            <Link href={`/auth?next=/analysis/${videoId}`} className="btn btn-primary">
              Go to sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (state.kind === "not-found") {
    return (
      <main className="container-content py-12">
        <div className="card card-pad">
          <h1 className="text-xl font-semibold">Video not found</h1>
          <p className="mt-2 text-sm text-gray-600">
            This video doesn’t exist or you don’t have access.
          </p>
          <div className="mt-4 flex gap-2">
            <button className="btn btn-outline" onClick={() => router.back()}>
              Go back
            </button>
            <Link href="/" className="btn btn-primary-blue">
              Your videos
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { video, feedback } = state;

  const issues = Array.isArray(feedback?.issues)
    ? (feedback!.issues as string[])
    : [];

  return (
    <main className="container-content py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Analysis</h1>
        <div className="flex gap-2">
          <Link href="/" className="btn btn-outline">
            Back to Videos
          </Link>
          <Link href="/upload" className="btn btn-primary-blue">
            Upload another
          </Link>
        </div>
      </div>

      {/* Video context */}
      <section className="card card-pad mt-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1 min-w-[260px]">
            <p className="text-sm text-gray-500">Video</p>
            <p className="text-sm font-medium">
              {video.original_filename ?? "Video"}
            </p>
            <p className="text-xs text-gray-500">{fmtDate(video.uploaded_at)}</p>

            {video.file_url && (
              <div className="mt-4">
                {/* Simple inline player (public URL). If you make buckets private later, swap to signed URLs. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <video
                  src={video.file_url}
                  controls
                  className="w-full max-w-lg rounded-xl border"
                />
                <a
                  href={video.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline mt-3"
                >
                  Open video
                </a>
              </div>
            )}
          </div>

          {/* Score */}
          <div className="min-w-[220px]">
            <div className="rounded-2xl border p-4">
              <p className="text-sm text-gray-500">Overall score</p>
              {typeof feedback?.score === "number" ? (
                <div className="mt-2 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-white text-lg font-bold shadow"
                     style={{ background: "transparent" }}>
                  <span className={`inline-block h-3 w-3 rounded-full ${scorePill(feedback.score)}`} />
                  <span>{feedback.score.toFixed(1)} / 10</span>
                </div>
              ) : (
                <span className="mt-2 inline-block text-sm text-gray-600">
                  No score yet
                </span>
              )}
              <p className="mt-3 text-xs text-gray-500">
                Skill focus: {video.skill_focus ?? feedback?.skill_area ?? "—"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Last updated: {fmtDate(feedback?.created_at)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Findings */}
      {feedback ? (
        <section className="grid gap-5 mt-6 md:grid-cols-2">
          <div className="card card-pad">
            <h2 className="text-lg font-semibold">Issues detected</h2>
            {issues.length > 0 ? (
              <ul className="mt-3 list-disc pl-5 text-sm text-gray-700">
                {issues.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-gray-600">No issues listed.</p>
            )}
          </div>

          <div className="card card-pad">
            <h2 className="text-lg font-semibold">Suggestions</h2>
            {feedback.suggestions ? (
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                {feedback.suggestions}
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-600">No suggestions yet.</p>
            )}
          </div>
        </section>
      ) : (
        <section className="card card-pad mt-6">
          <h2 className="text-lg font-semibold">No analysis yet</h2>
          <p className="mt-2 text-sm text-gray-600">
            We haven’t generated feedback for this clip yet.
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/" className="btn btn-outline">Back to Videos</Link>
            <Link href="/upload" className="btn btn-primary-blue">Analyze another clip</Link>
          </div>
        </section>
      )}
    </main>
  );
}
