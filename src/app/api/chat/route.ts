import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const BASE_SYSTEM_PROMPT = `You are MagellAIn, an expert sailing coach and racing strategist for Great Lakes sailors, especially on Lake Erie and the Detroit River. You have deep knowledge of:

- Racing tactics: starts, mark roundings, laylines, current/wind shifts, VMG optimization
- One-design and PHRF handicap racing rules (Racing Rules of Sailing)
- Lake Erie weather patterns: lake breezes, thermal effects, frontal passages, squall lines
- Boat handling: sail trim, crew coordination, heavy weather technique
- Navigation: chart reading, buoy identification, GPS waypoints
- Local knowledge: Ford Yacht Club, West Shore Sailing Club, DRYA, Lake Erie islands

## The Sailor's Boat and Performance

You're coaching the skipper of **Impetuous**, a Kelt 8.5 with Sail Number 63377. Key specs:
- **Handicap:** PHRF 204, JAM 212
- **Career:** 63 events competed
- **Performance Averages:** PHRF VMG 4.15 kts, JAM VMG 2.30 kts

**2025 Season Highlights:**
- Won GIYC Labor Day (JAM A fleet)
- Won WNATR R1 (PHRF)
- 5th overall WNATR series
- 5th Sail Great Lakes Championship
- 4th Jack & Jill Championship

**Top Competitors (shared events):**
- DRAGONLADY: 18 shared events
- Nakiyowin: 17 shared events
- VAGRANT / Bangarang: 12 shared events each

The sailor can ask about specific races, competitor performance, seasonal trends, or how Impetuous stacks up against known competitors. Reference this race history when relevant to tactical or strategic advice.

RESPONSE FORMAT — always structure your answers like this:
1. Start with a **TLDR** line: a single bold sentence summarizing your answer
2. Then organize the rest with clear **section headers** using markdown (##)
3. Use bullet points for lists and keep paragraphs short (2-3 sentences max)
4. End with a "Key Takeaway" or "Bottom Line" if the answer is long

Example structure:
**TLDR: Reef the main and go with your #3 jib for 20+ knot upwind legs.**

## Wind Assessment
...

## Sail Selection
...

## Key Takeaway
...

When answering questions:
- Be concise and actionable — sailors need quick, clear advice
- Reference specific wind angles, sail configurations, and tactical moves
- If asked about current conditions, note that you may not have real-time data but can advise on general patterns
- Use proper sailing terminology but explain it when context suggests a newer sailor
- For safety questions, always err on the side of caution
- Never make up specific race results or weather data you don't have
- When discussing Impetuous's performance, reference the known history and competitors listed above

You can help with:
1. Pre-race strategy based on weather forecasts
2. Tactical decisions during racing
3. Sail selection and trim advice
4. Post-race analysis and competitor comparison
5. General sailing knowledge and rules questions
6. Lake Erie specific navigation and weather patterns`;

function buildBoatContext(boat: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`\n\n--- SAILOR'S BOAT PROFILE ---`);
  lines.push(`Boat: ${boat.name} (${boat.class_name})`);

  if (boat.hull_type) lines.push(`Hull: ${boat.hull_type}`);
  if (boat.phrf_rating) lines.push(`PHRF Rating: ${boat.phrf_rating}`);
  if (boat.sail_number) lines.push(`Sail Number: ${boat.sail_number}`);

  // Dimensions
  const dims: string[] = [];
  if (boat.loa_ft) dims.push(`LOA ${boat.loa_ft}ft`);
  if (boat.beam_ft) dims.push(`Beam ${boat.beam_ft}ft`);
  if (boat.draft_ft) dims.push(`Draft ${boat.draft_ft}ft`);
  if (boat.displacement_lbs) dims.push(`Displacement ${boat.displacement_lbs}lbs`);
  if (dims.length) lines.push(`Dimensions: ${dims.join(", ")}`);

  if (boat.year_built) lines.push(`Year Built: ${boat.year_built}`);
  if (boat.manufacturer) lines.push(`Manufacturer: ${boat.manufacturer}`);

  // Rigging details from raw_data
  const rawData = boat.raw_data as Record<string, unknown> | null;
  if (rawData) {
    const rigging: string[] = [];
    if (rawData.keel_type) rigging.push(`Keel: ${rawData.keel_type}`);
    if (rawData.rig_type) rigging.push(`Rig: ${rawData.rig_type}`);
    if (rawData.propeller_type) rigging.push(`Prop: ${rawData.propeller_type}`);
    if (rigging.length) lines.push(`Rigging: ${rigging.join(", ")}`);
  }

  // Sail inventory
  const sails = rawData?.sail_inventory as Array<Record<string, unknown>> | undefined;
  if (sails && sails.length > 0) {
    lines.push(`Sail Inventory:`);
    for (const s of sails) {
      const parts: string[] = [String(s.type)];
      if (s.loft) parts.push(`by ${s.loft}`);
      if (s.area) parts.push(`${s.area} sqft`);
      if (s.year) parts.push(`(${s.year})`);
      if (s.condition) parts.push(`[${s.condition}]`);
      lines.push(`  - ${parts.join(" ")}`);
    }
  }

  // Fall back to the structured sail_inventory field
  const structuredSails = boat.sail_inventory as Record<string, { area_sqft?: number; type?: string }> | null;
  if (!sails?.length && structuredSails) {
    const sailEntries = Object.entries(structuredSails).filter(([, v]) => v);
    if (sailEntries.length > 0) {
      lines.push(`Sail Inventory:`);
      for (const [key, val] of sailEntries) {
        const info: string[] = [key];
        if (val.area_sqft) info.push(`${val.area_sqft} sqft`);
        if (val.type) info.push(`(${val.type})`);
        lines.push(`  - ${info.join(" ")}`);
      }
    }
  }

  lines.push(`\nTailor all advice to this specific boat. Consider the PHRF rating, sail inventory, keel/rig configuration, and dimensions when recommending sail selection, trim, tactics, and strategy. For example, reference which sails to use at specific wind angles, account for the boat's displacement-to-length ratio for speed predictions, and factor in keel type for pointing ability.`);

  return lines.join("\n");
}

function buildProfileContext(profile: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`\n\n--- SAILOR PROFILE ---`);

  if (profile.display_name || profile.full_name) {
    lines.push(`Name: ${profile.display_name || profile.full_name}`);
  }

  if (profile.sailing_experience) {
    lines.push(`Experience Level: ${profile.sailing_experience}`);
    if (profile.sailing_experience === "beginner") {
      lines.push(`Adjust your language: explain sailing terms, be encouraging, focus on fundamentals.`);
    } else if (profile.sailing_experience === "intermediate") {
      lines.push(`Use standard sailing terminology. Explain advanced concepts when they come up.`);
    } else if (profile.sailing_experience === "advanced" || profile.sailing_experience === "expert") {
      lines.push(`Use advanced sailing terminology freely. Focus on nuanced tactics and optimization.`);
    }
  }

  const clubs = profile.club_affiliations as string[] | null;
  if (clubs && clubs.length > 0) {
    lines.push(`Club Affiliations: ${clubs.join(", ")}`);
  }

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured. Set ANTHROPIC_API_KEY in Netlify environment variables." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build personalized system prompt with boat + profile data
    let systemPrompt = BASE_SYSTEM_PROMPT;

    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return req.cookies.getAll().map((c) => ({
                name: c.name,
                value: c.value,
              }));
            },
            setAll() {
              // Route Handlers can't set cookies on a streaming response — safe to no-op
            },
          },
        }
      );

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Fetch profile and primary boat in parallel
        const [profileResult, boatResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single(),
          supabase
            .from("boats")
            .select("*")
            .eq("owner_id", user.id)
            .eq("is_primary", true)
            .single(),
        ]);

        if (profileResult.data) {
          systemPrompt += buildProfileContext(profileResult.data as Record<string, unknown>);
        }

        if (boatResult.data) {
          systemPrompt += buildBoatContext(boatResult.data as Record<string, unknown>);
        }
      }
    } catch (err) {
      // If auth/DB fails, continue with base prompt — chat should still work for anonymous users
      console.error("Failed to load user context for chat:", err);
    }

    // Inject live weather from the app's own /api/weather endpoint (best-effort, non-blocking)
    try {
      const weatherRes = await fetch(
        `${req.nextUrl.origin}/api/weather`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (weatherRes.ok) {
        const wd = await weatherRes.json();
        const lines: string[] = ["\n\n--- LIVE CONDITIONS (fetched moments ago) ---"];
        // Primary buoy observation
        const stations = Object.values(wd.observations ?? {}) as Record<string, unknown>[];
        if (stations.length > 0) {
          const primary = stations[0] as Record<string, unknown>;
          if (primary.wind_speed_kts != null) lines.push(`Wind: ${primary.wind_speed_kts} kts from ${primary.wind_direction_deg}°${primary.wind_gust_kts ? ` (gusting ${primary.wind_gust_kts} kts)` : ""}`);
          if (primary.wave_height_ft != null) lines.push(`Waves: ${primary.wave_height_ft} ft`);
          if (primary.water_temp_f != null) lines.push(`Water temp: ${primary.water_temp_f}°F`);
          if (primary.air_temp_f != null) lines.push(`Air temp: ${primary.air_temp_f}°F`);
        }
        // Sailing conditions summary
        const sc = wd.sailingConditions as Record<string, unknown> | null;
        if (sc) {
          lines.push(`Conditions rating: ${sc.rating}`);
          if (sc.summary) lines.push(`Summary: ${sc.summary}`);
        }
        // Active alerts
        const alerts = (wd.alerts ?? []) as Record<string, unknown>[];
        if (alerts.length > 0) {
          lines.push(`Active NOAA Alerts: ${alerts.map((a) => a.headline).join("; ")}`);
        }
        if (lines.length > 1) {
          systemPrompt += lines.join("\n");
          systemPrompt += "\n\nUse this live data when answering questions about current conditions. If the sailor asks what the wind is doing right now, reference these numbers specifically.";
        }
      }
    } catch {
      // Weather fetch failed — continue without it, coach still works
    }

    // Build messages array from history
    const messages = [
      ...(history ?? []).slice(-20).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    // Stream responses using Anthropic's SSE streaming API
    // Try claude-sonnet-4-20250514 first, fall back to claude-3-5-sonnet-20241022
    const models = ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022"];
    let lastError = "";

    for (const model of models) {
      const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          messages,
          stream: true,
        }),
      });

      // If 401 (auth), don't bother trying another model — the key is the problem
      if (anthropicResponse.status === 401) {
        return new Response(
          JSON.stringify({
            error: "API authentication failed. Please check your ANTHROPIC_API_KEY in Netlify environment variables.",
          }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }

      if (anthropicResponse.ok && anthropicResponse.body) {
        // Create a transform stream that extracts text from SSE events
        const stream = new ReadableStream({
          async start(controller) {
            const reader = anthropicResponse.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? ""; // keep incomplete line

                for (const line of lines) {
                  if (!line.startsWith("data: ")) continue;
                  const data = line.slice(6).trim();
                  if (data === "[DONE]") {
                    controller.close();
                    return;
                  }
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                      controller.enqueue(new TextEncoder().encode(parsed.delta.text));
                    }
                    if (parsed.type === "message_delta" && parsed.delta?.stop_reason) {
                      controller.close();
                      return;
                    }
                  } catch {
                    // skip malformed JSON
                  }
                }
              }
              // Stream ended normally — close the controller so the client
              // reader receives done=true instead of hanging forever
              controller.close();
            } catch (err) {
              try { controller.error(err); } catch { /* already closed */ }
            } finally {
              reader.releaseLock();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no", // disable Netlify response buffering
          },
        });
      }

      const errText = await anthropicResponse.text();
      console.error(`Anthropic API error (model=${model}):`, anthropicResponse.status, errText);
      lastError = `AI service error (${anthropicResponse.status}): ${errText.slice(0, 300)}`;
    }

    // Both models failed
    return new Response(
      JSON.stringify({ error: lastError || "AI service unavailable" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Chat API error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
