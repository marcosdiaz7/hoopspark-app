// components/AuthGate.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  children: React.ReactNode;
  /** Any path that should not require auth (prefix match) */
  publicPrefixes?: string[];
};

export default function AuthGate({
  children,
  publicPrefixes = ["/auth"],
}: Props) {
  const [checking, setChecking] = useState(true);
  const pathname = usePathname() || "/";
  const router = useRouter();

  // Bypass for public routes (e.g., /auth and /auth/callback)
  const isPublic = publicPrefixes.some((p) => pathname.startsWith(p));
  useEffect(() => {
    if (isPublic) {
      setChecking(false);
      return;
    }

    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
      } else {
        setChecking(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [isPublic, pathname, router]);

  if (checking) {
    return (
      <main className="container-content py-20 text-center">
        <div className="mx-auto inline-block h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-app-500" />
        <p className="mt-4 text-sm text-gray-600">Checking session…</p>
      </main>
    );
  }

  return <>{children}</>;
}

