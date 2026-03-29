import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// PATCH /api/admin/feedback — update feedback status and admin notes
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, status, admin_notes } = body;

    if (!id || typeof id !== "number") {
      return NextResponse.json({ error: "Missing feedback id" }, { status: 400 });
    }

    const validStatuses = ["new", "read", "in_progress", "resolved", "closed"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (admin_notes !== undefined) updates.admin_notes = admin_notes;

    const { data, error } = await supabase
      .from("user_feedback")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ feedback: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/feedback — delete feedback item
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");
    const id = idParam ? parseInt(idParam, 10) : NaN;

    if (!idParam || isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "Missing or invalid feedback id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_feedback")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
