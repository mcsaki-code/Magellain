import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const { category, subject, message, email, page_path } = body;

    // Validate
    if (!category || !subject || !message) {
      return NextResponse.json(
        { error: "Category, subject, and message are required" },
        { status: 400 }
      );
    }

    const validCategories = ["suggestion", "bug", "help", "other"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    if (subject.length > 200) {
      return NextResponse.json(
        { error: "Subject must be under 200 characters" },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: "Message must be under 5000 characters" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.from("user_feedback").insert({
      user_id: user?.id ?? null,
      email: email || user?.email || null,
      category,
      subject: subject.trim(),
      message: message.trim(),
      page_path: page_path || null,
      user_agent: request.headers.get("user-agent") || null,
    }).select("id").single();

    if (error) throw error;

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
