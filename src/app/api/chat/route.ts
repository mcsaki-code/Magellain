import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

const BASE_SYSTEM_PROMPT = `You are MagellAIn, an expert sailing coach and racing strategist for Great Lakes sailors, especially on Lake Erie and the Detroit River. You have deep knowledge of:

- Racing tactics: starts, mark roundings, laylines, current/wind shifts, VMG optimization
- One-design and PHRF handicap racing rules (Racing Rules of Sailing)
- Lake Erie weather patterns: lake breezes, thermal effects, frontal passages, squall lines
- Boat handling: sail trim, crew coordination, heavy weather technique
- Navigation: chart reading, buoy identification, GPS waypoints
- Local knowledge: Ford Yacht Club, West Shore Sailing Club, DRYA, Lake Erie islands

When answering questions:
- Be concise and actionable — sailors need quick, clear advice
- Reference specific wind angles, sail configurations, and tactical moves
- If asked about current conditions, note that you may not have real-time data but can advise on general patterns
- Use proper sailing terminology but explain it when context suggests a newer sailor
- For safety questions, always err on the side of caution
- Never make up specific race results or weather data you don't have

You can help with:
1. Pre-race strategy based on weather forecasts
2. Tactical decisions during racing
3. Sail selection and trim advice
4. Post-race analysis
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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
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

    // Build messages array from history
    const messages = [
      ...(history ?? []).slice(-20).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return new Response(
        JSON.stringify({
          error: `AI service error (${response.status})`,
          detail: response.status === 401 ? "API key invalid or missing" : undefined,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Stream the response back to the client
    const encoder = new TextEncoder();
    const reader = response.body?.getReader();
    if (!reader) {
      return new Response(JSON.stringify({ error: "No response body" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                    controller.enqueue(encoder.encode(parsed.delta.text));
                  }
                } catch {
                  // Skip non-JSON lines
                }
              }
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
