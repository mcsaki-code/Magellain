"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import {
  Users, MessageSquare, Plus, ChevronRight, Loader2, Sailboat,
} from "lucide-react";

interface CrewGroup {
  id: string;
  name: string;
  description: string | null;
  boat_id: string | null;
  created_by: string;
  created_at: string;
  member_count?: number;
  last_message?: { content: string; created_at: string; sender_name?: string };
}

interface DirectConversation {
  user_id: string;
  display_name: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export default function MessagesPage() {
  const [groups, setGroups] = useState<CrewGroup[]>([]);
  const [dms, setDms] = useState<DirectConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"crews" | "direct">("crews");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return;
    }

    // Load crew groups the user belongs to
    const { data: memberData } = await supabase
      .from("crew_members")
      .select("group_id, crew_groups(id, name, description, boat_id, created_by, created_at)")
      .eq("user_id", user.id);

    if (memberData) {
      const groupsList: CrewGroup[] = memberData
        .map((m: Record<string, unknown>) => m.crew_groups as CrewGroup)
        .filter(Boolean);

      // Get member counts and last messages for each group
      for (const group of groupsList) {
        const { count } = await supabase
          .from("crew_members")
          .select("*", { count: "exact", head: true })
          .eq("group_id", group.id);
        group.member_count = count ?? 0;

        const { data: lastMsg } = await supabase
          .from("crew_messages")
          .select("content, created_at, sender_id")
          .eq("group_id", group.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (lastMsg) {
          const { data: sender } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", lastMsg.sender_id)
            .single();
          group.last_message = {
            content: lastMsg.content,
            created_at: lastMsg.created_at,
            sender_name: sender?.display_name ?? "Unknown",
          };
        }
      }

      setGroups(groupsList);
    }

    // Load direct message conversations
    const { data: sentDms } = await supabase
      .from("direct_messages")
      .select("recipient_id, content, created_at")
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false });

    const { data: receivedDms } = await supabase
      .from("direct_messages")
      .select("sender_id, content, created_at, read_at")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false });

    // Combine and deduplicate into conversations
    const convMap = new Map<string, DirectConversation>();

    for (const msg of sentDms ?? []) {
      const otherId = msg.recipient_id;
      if (!convMap.has(otherId)) {
        convMap.set(otherId, {
          user_id: otherId,
          display_name: "",
          last_message: msg.content,
          last_message_at: msg.created_at,
          unread_count: 0,
        });
      }
    }

    for (const msg of receivedDms ?? []) {
      const otherId = msg.sender_id;
      const existing = convMap.get(otherId);
      if (!existing || new Date(msg.created_at) > new Date(existing.last_message_at)) {
        convMap.set(otherId, {
          user_id: otherId,
          display_name: "",
          last_message: msg.content,
          last_message_at: msg.created_at,
          unread_count: (existing?.unread_count ?? 0) + (msg.read_at ? 0 : 1),
        });
      } else if (!msg.read_at) {
        existing.unread_count++;
      }
    }

    // Fetch display names
    const userIds = Array.from(convMap.keys());
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, full_name")
        .in("id", userIds);

      for (const p of profiles ?? []) {
        const conv = convMap.get(p.id);
        if (conv) conv.display_name = p.display_name || p.full_name || "Unknown";
      }
    }

    setDms(Array.from(convMap.values()).sort((a, b) =>
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    ));

    setIsLoading(false);
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    setCreating(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }

    const { data: group } = await supabase
      .from("crew_groups")
      .insert({ name: newGroupName.trim(), created_by: user.id })
      .select()
      .single();

    if (group) {
      // Add creator as owner
      await supabase.from("crew_members").insert({
        group_id: group.id,
        user_id: user.id,
        role: "owner",
      });

      setNewGroupName("");
      setShowCreateGroup(false);
      loadConversations();
    }
    setCreating(false);
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="Messages">
        <button
          onClick={() => setShowCreateGroup(true)}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
          title="New crew group"
        >
          <Plus className="h-4 w-4" />
        </button>
      </Header>

      <div className="flex-1 p-4">
        {/* Tabs */}
        <div className="mb-4 flex rounded-lg border bg-muted/30 p-1">
          <button
            onClick={() => setActiveTab("crews")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              activeTab === "crews" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Users className="mr-1.5 inline h-4 w-4" />
            Crews
          </button>
          <button
            onClick={() => setActiveTab("direct")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              activeTab === "direct" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <MessageSquare className="mr-1.5 inline h-4 w-4" />
            Direct
            {dms.reduce((sum, d) => sum + d.unread_count, 0) > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ocean px-1.5 text-[10px] font-bold text-white">
                {dms.reduce((sum, d) => sum + d.unread_count, 0)}
              </span>
            )}
          </button>
        </div>

        {/* Create Group Modal */}
        {showCreateGroup && (
          <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-3 font-semibold">Create Crew Group</h3>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g. Wind Dancer Race Crew"
              className="mb-3 w-full rounded-lg border bg-muted px-3 py-2 text-sm focus:border-ocean focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={createGroup}
                disabled={!newGroupName.trim() || creating}
                className="rounded-lg bg-ocean px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => { setShowCreateGroup(false); setNewGroupName(""); }}
                className="rounded-lg bg-muted px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Crew Groups */}
            {activeTab === "crews" && (
              <div className="space-y-2">
                {groups.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">No crew groups yet</p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      Create a crew to chat with your sailing team
                    </p>
                    <button
                      onClick={() => setShowCreateGroup(true)}
                      className="mt-4 rounded-xl bg-ocean px-5 py-2.5 text-sm font-semibold text-white"
                    >
                      Create First Crew
                    </button>
                  </div>
                ) : (
                  groups.map((group) => (
                    <Link
                      key={group.id}
                      href={`/messages/crew/${group.id}`}
                      className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean/10">
                        <Sailboat className="h-5 w-5 text-ocean" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="truncate font-semibold">{group.name}</h3>
                          {group.last_message && (
                            <span className="text-xs text-muted-foreground">
                              {timeAgo(group.last_message.created_at)}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {group.last_message
                            ? `${group.last_message.sender_name}: ${group.last_message.content}`
                            : `${group.member_count} member${group.member_count !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))
                )}
              </div>
            )}

            {/* Direct Messages */}
            {activeTab === "direct" && (
              <div className="space-y-2">
                {dms.length === 0 ? (
                  <div className="py-12 text-center">
                    <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      Direct messages with crew members will appear here
                    </p>
                  </div>
                ) : (
                  dms.map((conv) => (
                    <Link
                      key={conv.user_id}
                      href={`/messages/dm/${conv.user_id}`}
                      className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-100 dark:bg-navy-800">
                        <span className="text-sm font-bold text-navy-600 dark:text-navy-300">
                          {conv.display_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className={`truncate font-semibold ${conv.unread_count > 0 ? "" : ""}`}>
                            {conv.display_name}
                          </h3>
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(conv.last_message_at)}
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {conv.last_message}
                        </p>
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ocean px-1.5 text-[10px] font-bold text-white">
                          {conv.unread_count}
                        </span>
                      )}
                    </Link>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
