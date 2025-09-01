// app/page.tsx
export const dynamic = "force-dynamic"; // ensure runtime fetch, avoids SSG pitfalls

import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

type VideoRow = {
  id: string;
  file_url: string | null;
  skill_focus: string | null;
  uploaded_at: string | null;
  original_filename: string | null;
};

function skillBadgeClass(skill?: string | null) {
  const base = "badge";
  if (!skill) return `${base} badge-muted`;
  const s = skill.toLowerCase();
  if (s.includes("shoot") || s.includes("offense") || s.includes("finishing"))
    return `${base} badge-brand`;
  if (s.includes("handle") || s.includes("dribble") || s.includes("ball"))
    return `${base} badge-blue`;
  if (s.includes("defense") || s.includes("footwork"))
    return `${base} badge-blue`;
  return `${base} badge-muted`;
}

export default async function Home() {
  const hasEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let videos: VideoRow[] = [];
  let errorMessage: string | null = null;

  if (!hasEnv) {
    errorMessage =
      "Supabase environment variables are missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.";
  } else {
    try {
      const { data, error } = await supabase
        .from("videos")
        .select("id,file_url,skill_focus,uploaded_at,original_filename")
        .order("uploaded_at", { ascending: false });

      if (error) errorMessage = error.message;
      videos = (data ?? []) as VideoRow[];
    } catch (e: any) {
      errorMessage = e?.message ?? "Unknown error fetching videos.";
    }
  }

  return (
    <main>
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur">
        <nav className="container-content flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white font-bold">
              HS
            </span>
            <span className="font-semibold">HoopSpark</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/help" className="btn btn-outline">
              Help
            </Link>
            <Link href="/upload" className="btn btn-primary-blue">
              Upload
            </Link>
          </div>
        </nav>
      </header>

      {/* Content */}
      <section className="container-content py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Your Videos</h1>
          <Link href="/upload" className="btn btn-primary">
            + Upload
          </Link>
        </div>

        {/* Error state */}
        {errorMessage && (
          <div className="mt-6 card card-pad border-red-200 bg-red-50 text-red-800">
            <p className="font-semibold">Can’t load videos</p>
            <p className="mt-1 text-sm">{errorMessage}</p>
          </div>
        )}

        {/* Empty state */}
        {!errorMessage && videos.length === 0 && (
          <div className="mt-10 card card-pad text-center">
            <h2 className="text-xl font-semibold">No videos yet</h2>
            <p className="mt-2 text-gray-600">
              Upload a 30–60s clip to get your first analysis.
            </p>
            <div className="mt-5">
              <Link href="/upload" className="btn btn-primary-blue">
                Upload your first clip
              </Link>
            </div>
          </div>
        )}

        {/* List */}
        {!errorMessage && videos.length > 0 && (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <li key={v.id} className="card p-0 overflow-hidden">
                <div className="card-pad">
                  <div className="flex items-center justify-between">
                    <span className={skillBadgeClass(v.skill_focus)}>
                      {v.skill_focus ?? "Uncategorized"}
                    </span>
                    {v.uploaded_at && (
                      <span className="text-xs text-gray-500">
                        {new Date(v.uploaded_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 line-clamp-2 text-sm font-medium">
                    {v.original_filename ?? "Video"}
                  </h3>

                  <div className="mt-4 flex gap-2">
                    {v.file_url ? (
                      <a
                        href={v.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="btn btn-outline text-gray-400 cursor-not-allowed">
                        No file URL
                      </span>
                    )}
                    <button className="btn btn-outline">Analyze</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Tailwind smoke test */}
        <div className="mt-12 p-6 bg-black text-white rounded-2xl text-center shadow">
          Tailwind v4 is working 🎉
        </div>
      </section>
    </main>
  );
}



