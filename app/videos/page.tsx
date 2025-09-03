// app/videos/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Row = {
  id: string;
  file_url: string;
  bucket_name: string;
  uploaded_at: string | null;
  status: string | null;
  original_filename: string | null;
  skill_focus: string | null;
};

const PAGE_SIZE = 12;

export default function VideosPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMore() {
    if (loading || !hasMore) return;
    setLoading(true);
    setErr(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErr("Please sign in to view your videos.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("videos")
      .select("id, file_url, bucket_name, uploaded_at, status, original_filename, skill_focus")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    const newRows = data ?? [];
    setRows(prev => [...prev, ...newRows]);
    setOffset(prev => prev + newRows.length);
    if (newRows.length < PAGE_SIZE) setHasMore(false);

    // sign each video's storage key for playback
    const entries = await Promise.all(
      newRows.map(async (r) => {
        const { data: s } = await supabase
          .storage
          .from(r.bucket_name)
          .createSignedUrl(r.file_url, 60 * 60);
        return [r.id, s?.signedUrl ?? ""] as const;
      })
    );
    setUrls(prev => ({ ...prev, ...Object.fromEntries(entries) }));
    setLoading(false);
  }

  function formatDate(ts: string | null) {
    return ts ? new Date(ts).toLocaleString() : "—";
  }

  return (
    <main className="container-content py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Your Videos</h1>
        <Link href="/upload" className="btn btn-primary">Upload New</Link>
      </div>

      {err && <div className="mt-4 rounded-xl bg-red-50 text-red-700 p-3 text-sm">{err}</div>}

      <div className="grid gap-4 mt-6 md:grid-cols-2 lg:grid-cols-3">
        {rows.map(r => (
          <div key={r.id} className="card card-pad">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">{formatDate(r.uploaded_at)}</div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                r.status === "analyzed" ? "bg-green-100 text-green-700" :
                r.status === "uploaded" ? "bg-yellow-100 text-yellow-700" :
                "bg-gray-100 text-gray-700"
              }`}>
                {r.status ?? "—"}
              </span>
            </div>
            <p className="font-medium truncate">
              {r.original_filename ?? r.file_url.split("/").pop()}
            </p>
            {r.skill_focus && (
              <p className="text-sm text-gray-600 mt-1">
                Focus: <b>{r.skill_focus}</b>
              </p>
            )}
            {urls[r.id] ? (
              <video
                src={urls[r.id]}
                controls
                className="mt-3 w-full rounded-xl border"
              />
            ) : (
              <div className="mt-3 h-40 rounded-xl bg-gray-100 animate-pulse" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-6">
        {hasMore ? (
          <button onClick={loadMore} disabled={loading} className="btn btn-outline">
            {loading ? "Loading..." : "Load more"}
          </button>
        ) : (
          rows.length > 0 && <div className="text-sm text-gray-500">No more videos.</div>
        )}
      </div>
    </main>
  );
}
