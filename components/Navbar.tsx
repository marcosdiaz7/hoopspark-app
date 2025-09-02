// components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) setSignedIn(!!data.session);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isActive = (href: string) => pathname === href;

  return (
    <header className="sticky top-0 z-40 bg-white/70 backdrop-blur">
      <nav className="container-content flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white font-bold">HS</span>
          <span className="font-semibold">HoopSpark</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/help" className={`btn btn-outline ${isActive("/help") ? "ring-2 ring-offset-1" : ""}`}>Help</Link>
          {signedIn ? (
            <>
              <Link href="/upload" className={`btn btn-primary-blue ${isActive("/upload") ? "ring-2 ring-offset-1" : ""}`}>Upload</Link>
              <button
                className="btn btn-outline"
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push("/auth");
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/auth" className="btn btn-primary">Sign in</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
