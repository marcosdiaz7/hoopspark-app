// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Basic sanity checks (helps catch typos/mismatched project)
function looksLikeUrl(v?: string) {
  return !!v && v.startsWith("https://") && v.includes(".supabase.co") && !v.endsWith("/");
}
function looksLikeJwt(v?: string) {
  // JWT-ish: three dot parts and base64-ish prefix
  return !!v && v.startsWith("ey") && v.split(".").length >= 3;
}

if (!looksLikeUrl(url) || !looksLikeJwt(anon)) {
  const maskedUrl = url ? url.replace(/^https:\/\//, "https://").slice(0, 40) + "…" : "MISSING";
  const maskedKey = anon ? anon.slice(0, 6) + "…" + anon.slice(-6) : "MISSING";
  throw new Error(
    `Supabase env invalid.
URL: ${maskedUrl}
KEY: ${maskedKey}
→ Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY come from the SAME project (Settings → API).`
  );
}

export const supabase = createClient(url!, anon!, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "hoopspark-auth",
  },
});




