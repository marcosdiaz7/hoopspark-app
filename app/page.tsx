// app/page.tsx
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

type VideoRow = {
  id: string;
  file_url: string | null;
  skill_focus: string | null;
  uploaded_at: string | null;
  original_filename: string | null;
};

export default async function Home() {
  const { data, error } = await supabase
    .from("videos")
    .select("id,file_url,skill_focus,uploaded_at,original_filename")
    .order("uploaded_at", { ascending: false });

  if (error) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">HoopSpark App</h1>
        <p className="mt-4 text-red-500">Error: {error.message}</p>
      </main>
    );
  }

  const videos = (data ?? []) as VideoRow[];

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Your Videos</h1>
        <Link
          href="#"
          className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
        >
          + Upload
        </Link>
      </div>

      {videos.length === 0 ? (
        <div className="mt-10 rounded-2xl border p-8 text-center">
          <h2 className="text-xl font-semibold">No videos yet</h2>
          <p className="mt-2 text-gray-600">
            Upload a 30–60s clip to get your first analysis.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <li key={v.id} className="rounded-2xl border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-gray-500">
                  {v.skill_focus ?? "Uncategorized"}
                </span>
                {v.uploaded_at && (
                  <span className="text-xs text-gray-500">
                    {new Date(v.uploaded_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <h3 className="mt-2 line-clamp-2 text-sm font-medium">
                {v.original_filename ?? "Video"}
              </h3>

              <div className="mt-4 flex gap-2">
                {v.file_url ? (
                  <a
                    href={v.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    Open
                  </a>
                ) : (
                  <span className="rounded-lg border px-3 py-1.5 text-sm text-gray-400">
                    No file URL
                  </span>
                )}
                <button className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
                  Analyze
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}


