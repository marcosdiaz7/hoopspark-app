import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { videoId, bucket, key, skillFocus, questionnaire } = await req.json();
    if (!videoId || !bucket || !key) return json({ error: "Missing required fields: videoId, bucket, key" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = authData.user.id;

    const { data: video, error: vErr } = await supabase
      .from("videos")
      .select("id,user_id,file_url,bucket_name,status,skill_focus")
      .eq("id", videoId)
      .single();
    if (vErr || !video) return json({ error: "Video not found" }, 404);

    const areaInput =
      (typeof skillFocus === "string" && skillFocus) ||
      (typeof video.skill_focus === "string" && video.skill_focus) ||
      (questionnaire && typeof questionnaire["focus"] === "string" && (questionnaire["focus"] as string)) ||
      "General";

    const analysis = computeAnalysis(areaInput, questionnaire);

    const { error: fbErr } = await supabase.from("feedback").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      video_id: videoId,
      score: analysis.score,
      skill_area: analysis.skill_area,
      issues: analysis.issues,
      suggestions: analysis.suggestions,
      ai_response: analysis.ai_response,
      questionnaire_data: questionnaire ?? null,
      created_at: new Date().toISOString(),
    });
    if (fbErr) return json({ error: fbErr.message }, 400);

    await supabase.from("videos").update({ status: "analyzed" }).eq("id", videoId);

    return json({ ok: true, analysis }, 200);
  } catch (e) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

type Category = "shooting" | "ball-handling" | "defense" | "finishing" | "footwork" | "general";

function computeAnalysis(
  focus: string,
  questionnaire?: Record<string, unknown> | null,
) {
  const category = classify(focus);
  const label = categoryLabel(category);

  const sr = toNum(questionnaire?.["self_rating"]);
  let base = 7.4;
  if (!Number.isNaN(sr)) base = 6.0 + Math.min(Math.max(sr, 0), 10) * 0.35;

  let issues: string[] = [];
  let suggestions = "";

  switch (category) {
    case "shooting":
      issues = ["Inconsistent release point", "Flat arc on longer shots"];
      suggestions = "Form shooting 3×10 from 5 spots; add 3×15 one-motion reps; finish with 25 FTs focusing on arc.";
      break;
    case "ball-handling":
      issues = ["High dribble at speed", "Inconsistent off-hand control", "Head down on first move"];
      suggestions = "Pound-cross and in-out 3×30s; zig-zag cones keeping hips low and eyes up; stationary combo 3×45s.";
      break;
    case "defense":
      issues = ["Slow first step on closeouts", "Upright stance in slides"];
      suggestions = "Closeout reps 4×6 with stick hand; lane-slide shuttles 4×20y maintaining hip height; mirror drill 3×30s.";
      break;
    case "finishing":
      issues = ["Inside-hand usage inconsistent", "Weak off-foot takeoff near rim"];
      suggestions = "Mikan + reverse Mikan 3×30s; 1-foot and 2-foot finishes 3×8 each side; add pad contact finishes.";
      break;
    case "footwork":
      issues = ["Extra steps on pivots", "Poor balance out of jump stop"];
      suggestions = "Jump-stop to front/reverse pivots 3×8 each side; stride-stop into shot/drive 3×8; cadence cues.";
      break;
    default:
      issues = ["Footwork drifts left", "Closeouts too upright"];
      suggestions = "Mikan series 3×30s; slides 3×25y keeping consistent hip height; simple plant-foot cues on finishes.";
  }

  const score = Math.min(9.5, Math.max(6.0, Number(base.toFixed(1))));
  return { score, skill_area: label, issues, suggestions, ai_response: `Edge analysis (${label})` };
}

function classify(raw: string): Category {
  const s = raw.toLowerCase();
  const has = (arr: string[]) => arr.some(w => s.includes(w));
  if (has(["shoot", "shooting", "jumper", "jump shot", "form"])) return "shooting";
  if (has(["handle", "handling", "dribble", "dribbling", "crossover", "ball handling", "ball-handling"])) return "ball-handling";
  if (has(["defense", "defensive", "closeout", "on-ball", "onball", "steal"])) return "defense";
  if (has(["finish", "finishing", "layup", "layups", "rim", "mikan"])) return "finishing";
  if (has(["footwork", "pivot", "pivots", "euro", "steps", "balance"])) return "footwork";
  return "general";
}

function categoryLabel(c: Category): string {
  switch (c) {
    case "shooting": return "Shooting";
    case "ball-handling": return "Ball Handling";
    case "defense": return "Defense";
    case "finishing": return "Finishing";
    case "footwork": return "Footwork";
    default: return "General";
  }
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
