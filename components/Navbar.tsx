// components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  return (
    <header className="sticky top-0 z-40 bg-white/70 backdrop-blur">
      <nav className="container-content flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white font-bold">
            HS
          </span>
          <span className="font-semibold">HoopSpark</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/help"
            className={`btn btn-outline ${isActive("/help") ? "ring-2 ring-offset-1" : ""}`}
          >
            Help
          </Link>
          <Link
            href="/upload"
            className={`btn btn-primary-blue ${isActive("/upload") ? "ring-2 ring-offset-1" : ""}`}
          >
            Upload
          </Link>
        </div>
      </nav>
    </header>
  );
}
