//app/auth/callback/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const [msg, setMsg] = useState("Finishing sign-in…");
  const router = useRouter();

  function getNext(): string {
    try {
      const fromStore = sessionStorage.getItem("auth:next");
      return fromStore || "/";
    } catch {
      return "/";
    }
  }

  function go(to: string) {
    // Try Next.js router first
    try {
      router.replace(to);
    } catch {}
    // Hard fallback in case router doesn't navigate
    setTimeout(() => {
      if (window.location.pathname.startsWith("/auth")) {
        window.location.replace(to);
      }
    }, 300);
  }

  useEffect(() => {
    (async () => {
      const next = getNext();

      try {
        // If we already have a session, just leave.
        const { data: sess } = await supabase.auth.getSession();
        if (sess.session) {
          go(next);
          return;
        }

        const url = new URL(window.location.href);

        // 1) PKCE/OTP style: ?code=...
        if (url.searchParams.get("code")) {
          const { error } = await supabase.auth.exchangeCodeForSession(url.toString());
          if (error) throw error;
          go(next);
          return;
        }

        // 2) Hash/implicit style: #access_token=...&refresh_token=...
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
          go(next);
          return;
        }

        // 3) Provider error text (if any)
        const errText =
          url.searchParams.get("error_description") ||
          hashParams.get("error_description");
        if (errText) {
          setMsg(decodeURIComponent(errText));
          return;
        }

        // 4) Nothing to exchange; maybe opened directly.
        setMsg("Invalid callback URL. Use the sign-in link from your email.");
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Could not complete sign-in.");
      }
    })();
  }, [router]);

  return (
    <main className="container-content py-20 text-center">
      <div className="mx-auto inline-block h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-app-500" />
      <p className="mt-4 text-sm text-gray-600">{msg}</p>
    </main>
  );
}


