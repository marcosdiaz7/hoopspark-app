//app/auth/page.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<null | { type: "ok" | "err"; msg: string }>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  function rememberNext() {
    try {
      sessionStorage.setItem("auth:next", next);
    } catch {}
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      rememberNext();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setStatus({ type: "ok", msg: "Check your email for the sign-in link." });
    } catch (err: unknown) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not send link." });
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    rememberNext();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="container-content py-10 max-w-md">
      <h1 className="text-3xl font-bold">Sign in</h1>
      <form onSubmit={sendMagicLink} className="card card-pad mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            required
            className="mt-1 w-full rounded-lg border p-2"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button disabled={loading} className="btn btn-primary">
          {loading ? "Sending…" : "Send magic link"}
        </button>
        <button type="button" onClick={signInWithGoogle} className="btn btn-primary-blue w-full">
          Continue with Google
        </button>
        {status && (
          <div className={`rounded-xl p-3 text-sm ${status.type === "ok" ? "bg-app-50 text-app-700" : "bg-red-50 text-red-700"}`}>
            {status.msg}
          </div>
        )}
      </form>
    </main>
  );
}

